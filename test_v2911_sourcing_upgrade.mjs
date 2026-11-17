import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
const code=f=>fs.readFileSync(f,'utf8');
const raw=enterpriseAnalysis({});
function sandbox(addons={}){
 const listener={};const store=new Map();const window={},document={addEventListener:(t,fn)=>{listener[t]=fn}};
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const ctx={window,document,localStorage,sessionStorage:localStorage,location:{hash:'#ss-ai'},fetch:async()=>({ok:true,json:async()=>raw}),setTimeout,clearTimeout,AbortController,Date,Math,Number,Set,Map,URL,Blob,Intl,console,...addons};
 for(const f of ['static/strategic_sourcing_runtime.js','static/strategic_sourcing_official.js','static/strategic_sourcing_universe.js','static/strategic_sourcing_overview.js','static/strategic_sourcing_market.js','static/strategic_sourcing_ai.js'])vm.runInNewContext(code(f),ctx,{filename:f,timeout:10000});
 return {window,ctx,store,listener};
}
{
 const {window:w}=sandbox(),u=w.PharmaSourcingUniverse;
 assert.equal(u.catalog.length,80);
 assert.equal(u.catalog.filter(x=>x.is_scenario).length,77);
 assert.equal(u.catalog.filter(x=>x.data_origin==='BASE_DEMO').length,3);
 assert(u.catalog.every(s=>s.material_id&&s.material_category&&s.region));
 assert(u.catalog.filter(s=>s.is_scenario).every(s=>s.qualified_for_purchase!=='APPROVED'));
 const funnel=w.PharmaStrategicHub.build(raw,{category:'all',region:'all',mode:'all',time:'all'}).projectFunnel;
 assert.equal(funnel.length,5);
 for(let i=0;i<funnel.length;i++){assert.equal(funnel[i].count,funnel[i].npi+funnel[i].stock);if(i)assert(funnel[i].count<=funnel[i-1].count);}
 assert(w.PharmaStrategicHub.build(raw,{category:'all',region:'all',mode:'all',time:'all'}).demoProjects.every(x=>x.project_id.startsWith('DEMO-PJ-')));
 const ai=w.PharmaAISourcing.build(raw,{demoComparison:true,material:'API-001',category:'API'},u.catalog);
 assert(ai.ranked.length>=10,`expected at least 10 demonstrable scores, found ${ai.ranked.length}`);
 assert(ai.rows.filter(x=>x.is_scenario).every(x=>!x.qualified));
 w.PharmaAISourcing.hydrate(raw);
 const aiHtml=w.PharmaAISourcing.render();
 assert((aiHtml.match(/data-ai-required=/g)||[]).length>=4);
 assert((aiHtml.match(/class="ai-bd-row"/g)||[]).length===10);
 assert((aiHtml.match(/class="ai-cost-col"/g)||[]).length===10);
 assert(aiHtml.includes('ai-average-line')&&aiHtml.includes('Top 10'));
 assert(code('static/strategic_sourcing_market.js').includes('openFDA')); 
 const mr=w.PharmaStrategicMarket.build(raw,{category:'all',region:'all'});
 assert.equal(mr.catalog.length,80);
 assert.equal(mr.riskRows.length,7);
 assert(mr.riskRows.some(x=>/ESG/.test(x.name)));
}
{
 let reads=0;
 const {window:w}=sandbox({fetch:async url=>{reads++;assert.equal(url,'/api/v08');return {ok:true,json:async()=>raw};}});
 const [a,b,c]=await Promise.all([w.PharmaSourcingData.load(),w.PharmaSourcingData.load(),w.PharmaSourcingData.load()]);
 assert.equal(reads,1,'parallel readers must share one request');assert.equal(a,b);assert.equal(b,c);
 await w.PharmaSourcingData.load();assert.equal(reads,1,'revisiting a page should use shared cached raw');
 w.PharmaSourcingData.invalidate();await w.PharmaSourcingData.load();assert.equal(reads,2,'explicit invalidation should reload');
}
{
 let reads=0;
 const fdaResponse={meta:{last_updated:'2026-11-01'},results:[{registration:{fei_number:'1234567',name:'Example Device Registration',iso_country_code:'DE',city:'Berlin'}},{registration:{fei_number:'1234567',name:'Example Duplicate',iso_country_code:'DE'}}]};
 const {window:w}=sandbox({fetch:async()=>{reads++;return {ok:true,json:async()=>fdaResponse}}});
 w.PharmaOfficialSourcing.setAuto(true);
 const a=await w.PharmaOfficialSourcing.maybeDaily();
 assert.equal(a.items.length,1);assert.equal(reads,1);
 assert.equal(a.items[0].material_category,'DeviceComponent');
 assert.equal(a.items[0].qualified_for_purchase,'NO');
 assert.equal(a.items[0].data_origin,'FDA_DEVICE_REGISTRATION');
 assert.equal(a.items[0].risk_index_scenario,null);
 assert(w.PharmaSourcingUniverse.catalog.some(s=>s.data_origin==='FDA_DEVICE_REGISTRATION'));
 await w.PharmaOfficialSourcing.maybeDaily();assert.equal(reads,1);
 assert(!w.PharmaSourcingUniverse.catalog.some(s=>s.data_origin==='FDA_DEVICE_REGISTRATION'&&s.qualified_for_purchase==='APPROVED'));
}
const src=code('static/strategic_sourcing_technical.js');
assert(!src.includes('完整 50 家候选目录'));
assert(code('static/strategic_sourcing_kraljic.css').includes('display:contents'));
assert(code('static/index.html').includes('PharmaOfficialSourcing'));
console.log('PASS V2.9.11: 80 base catalog, five-stage source-labeled demo funnel, Top10 charts, seven risk kinds, functional qualification checks, request de-duplication, FDA opt-in refresh and no false regulatory approval.');
