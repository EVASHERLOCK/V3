import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {SourcingRegistry,SOURCES,validateCompanyUrl,companyPageFacts} from './sourcing_registry.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v2913-source-test-'));
const f=path.join(dir,'registry.json');
const calls=[],payload={page:'<html><head><title>Acme API - Product catalogue</title><meta name="description" content="Product availability and plant updates"></head><body><main>Medicines and manufacturing update 2026</main></body></html>'};
const fetchImpl=async (url,opts={})=>{
 calls.push([url,opts]);
 if(url.includes('robots.txt'))return new Response('User-agent: *\nDisallow: /blocked',{status:200,headers:{'Content-Type':'text/plain'}});
 if(url.includes('www.acme.example'))return new Response(payload.page,{status:200,headers:{'Content-Type':'text/html','ETag':'"v1"'}});
 if(url.includes('/shortages.json'))return new Response(JSON.stringify({meta:{last_updated:'2026-11-06'},results:[{id:'SH-1',company_name:'Shortage Source Inc',generic_name:'Metformin',status:'Current'}]}),{status:200});
 if(url.includes('/enforcement.json'))return new Response(JSON.stringify({results:[{report_number:'RC-1',recalling_firm:'Recall Corp',classification:'Class I',product_description:'Material A'}]}),{status:200});
 if(url.includes('/ndc.json'))return new Response(JSON.stringify({results:[{product_ndc:'12345-0001',labeler_name:'FDA Labeler Company',active_ingredients:[{name:'Metformin'}],marketing_start_date:'20250101'}]}),{status:200});
 return new Response('not found',{status:404});
};
const resolveHost=async()=>[{address:'8.8.8.8',family:4}];
try{
 assert.equal(new URL(SOURCES.FDA_DRUG_SHORTAGES.url).pathname,'/drug/shortages.json');
 for(const url of ['http://www.acme.example','https://localhost','https://127.0.0.1','https://other.example','https://user:pwd@www.acme.example','https://www.acme.example:8443'])assert.throws(()=>validateCompanyUrl(url,{allowedDomains:'acme.example'}));
 assert.ok(validateCompanyUrl('https://www.acme.example/products',{allowedDomains:'acme.example'}).includes('/products'));
 assert.equal(companyPageFacts(payload.page).title,'Acme API - Product catalogue');
 const reg=new SourcingRegistry({file:f,fetchImpl,resolveHost,allowDomains:'acme.example'});
 assert.deepEqual(reg.getConfig().search_terms,[]);assert.equal(reg.getSummary().company_sites.length,0);
 reg.setTerms(['Metformin'],{actor:'ops'});
 assert.throws(()=>reg.setTerms(['Metformin:*)']),/检索词/);
 const site=reg.addCompanySite({name:'Acme API Ltd',url:'https://www.acme.example/products'});
 assert.equal(reg.getSummary().company_sites.length,1);
 let result=await reg.sync({force:true});
 assert.equal(result.total_signals,4,'two risk records + one NDC listing + one website watch');
 assert.equal(result.pending_review,4);assert.equal(result.discovery_count,2);
 for(const s of reg.allSignals()){
  assert.equal(s.approved_for_purchase,false);assert.equal(s.gmp_approved,false);assert.equal(s.cep_approved,false);assert.equal(s.asl_approved,false);
  assert.ok(s.source_url?.startsWith('https://'));assert.ok(s.source_hash.length===64);assert.ok(s.observed_at);
 }
 const snapshot=reg.getSummary();assert.equal(snapshot.sources['COMPANY:'+site.id].status,'OK');
 assert.equal(snapshot.sources.FDA_NDC_LABELERS.status,'OK');
 assert.ok(calls.some(([u])=>u.includes('search=active_ingredients.name')));
 const company=reg.allSignals().find(s=>s.type==='company_watch');assert.ok(company);assert.ok(company.evidence_excerpt.includes('manufacturing update'));
 const linked=reg.review({id:company.id,decision:'ACCEPT_EVIDENCE',reviewer:'QA-MOCK',supplier_id:'SUP-001',site_id:'SITE-01',material_id:'API-001',notes:'test review'});
 assert.equal(linked.approved_for_purchase,false);assert.equal(reg.verifiedLeads().length,1);
 await reg.sync({force:true,providers:[],include_sites:true});assert.equal(reg.getSummary().pending_review,3,'unchanged source does not reset human review');
 payload.page=payload.page.replace('manufacturing update','manufacturing site changed');
 await reg.sync({force:true,providers:[],include_sites:true});assert.equal(reg.getSummary().pending_review,4,'changed page resets review');
 assert.ok(reg.data.audit.some(x=>x.action==='OFFICIAL_CHANGED'));
 reg.removeCompanySite({id:site.id});assert.equal(reg.getConfig().company_sites.length,0);
 assert.ok(reg.allSignals().some(x=>x.id===company.id),'removing watcher retains history');
 const restored=new SourcingRegistry({file:f,fetchImpl,resolveHost,allowDomains:'acme.example'});assert.equal(restored.getSummary().total_signals,4);
 assert.equal(restored.getSummary().search_terms.length,1);
 const app=fs.readFileSync('static/app.js','utf8');assert.ok(app.includes("id:'ss-data',cn:'官方数据源与同步管理'"));
 const ui=fs.readFileSync('static/sourcing_admin_ui.js','utf8');for(const key of ['PharmaDataManager','data-sd-terms','data-sd-site-url','data-data-action="more"','/api/sourcing/registry/signals','/api/sourcing/registry/audit'])assert.ok(ui.includes(key),key);
 const css=fs.readFileSync('static/sourcing_data_management.css','utf8');assert.ok(css.includes('.sd-page'));
 const server=fs.readFileSync('server.mjs','utf8');for(const url of ['/config/sites','/config/terms','/signals','/leads','/audit'])assert.ok(server.includes(url),url);
 console.log('PASS V2.9.13 official sourcing: verified FDA endpoints, configured NDC search, HTTPS domain allowlist, robots, website change hashes, review reset, provenance, preserved approval boundary, dedicated navigation and paginated Top10 UI.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
