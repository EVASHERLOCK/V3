import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {sourcingFacts} from './sourcing_domain_v2921.mjs';
import {metricReport,exportMetricWorkbook} from './metric_registry_v2921.mjs';
import {SourcingRegistry} from './sourcing_registry.mjs';
import {inspectXlsxFormulas,readZipEntries} from './scripts/zip_formula_assert.mjs';
const raw=enterpriseAnalysis({});
const d=sourcingFacts(raw);
assert.equal(d.catalog.length,80,'80 canonical shared candidates');
assert.equal(d.catalog.filter(x=>x.source_class==='SCENARIO').length,77);
assert.equal(d.purchaseOrders.length,24);
assert.equal(d.quotes.length,3);
assert.equal(d.purchaseOrders.reduce((v,r)=>v+r.amount_usd,0),580704);
assert.equal(d.catalog.every(x=>x.spend_usd==null&&x.qualified_for_purchase===false),true,'catalog never creates trade facts or approvals');
for(const id of ['SRC.PO.SPEND','SRC.PO.OTD','SRC.PO.PPV','SRC.QUAL.COMBINATIONS','SRC.CANDIDATE.SCENARIO','SRC.QUOTE.COUNT','SRC.DOC.VALID_RATE']){
 const r=metricReport(id,{data:raw});assert.equal(r.status,'DEMO_RECOMPUTABLE');assert.ok(r.rows.length>0,id);assert.ok(r.formula,id);assert.ok(r.metric_id===id);
}
const spend=metricReport('SRC.PO.SPEND',{data:raw});assert.equal(spend.result,580704);
const ontime=metricReport('SRC.PO.OTD',{data:raw});assert.ok(ontime.result>0&&ontime.result<=100);
const spendMat=metricReport('SRC.PO.SPEND',{data:raw,scope:{material:'API-001'}});
const spendMatSup=metricReport('SRC.PO.SPEND',{data:raw,scope:{material:'API-001',supplier:'SUP-001'}});
assert.equal(spendMat.result,387008);
assert.equal(spendMatSup.result,200864);
const con=metricReport('SRC.RISK.CONCENTRATION',{data:raw,scope:{material:'API-001',supplier:'SUP-001'}});
assert.equal(con.status,'DEMO_RECOMPUTABLE');assert.ok(Math.abs(con.result-100*200864/387008)<0.01);
assert.equal(metricReport('SRC.RISK.CONCENTRATION',{data:raw}).status,'REQUIRES_SCOPE');
assert.equal(metricReport('SRC.ACTION.DEVELOP_SECOND_SOURCE',{data:raw}).status,'REQUIRES_SCOPE');
assert.equal(metricReport('SRC.ACTION.DEVELOP_SECOND_SOURCE',{data:raw,scope:{material:'API-002'}}).status,'DEMO_RULE_ANALYSIS');
assert.equal(metricReport('SRC.MYSTERY.RATE',{data:raw}).status,'MISSING_LINEAGE');
const out=exportMetricWorkbook({data:raw,scope:{material:'API-001',supplier:'SUP-001'}});
assert.ok(out.length>7000&&out.subarray(0,2).toString()==='PK');
const workbookEntries=readZipEntries(out);
assert.ok(workbookEntries.has('xl/worksheets/sheet9.xml'));
const workbookXml=workbookEntries.get('xl/worksheets/sheet9.xml').toString('utf8');
assert.ok(workbookXml.includes('<f>')&&workbookXml.includes('SRC.PO.SPEND'));
// Published official leads are never qualification or PO records.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'v2921-reg-'));try{
 const reg=new SourcingRegistry({file:path.join(temp,'registry.json'),fetchImpl:async()=>{throw Error('No network')}});
 const signal={id:'COMPANY_WEBSITE:TEST',type:'company_watch',provider:'COMPANY:TEST',source_url:'https://example.com/supplier',source_record_id:'TEST-1',source_hash:'SHA123',company_unverified:'Example Pharma',material_unverified:'API Alpha',observed_at:'2026-11-08T00:00:00Z',review_status:'PENDING',priority:30};
 reg.upsert(signal);reg.review({id:signal.id,decision:'ACCEPT_EVIDENCE',reviewer:'SQM-Test',supplier_id:'SUP-NEW1',site_id:'SITE-NEW1',material_id:'API-001'});
 const pub=reg.publishLead({id:signal.id});assert.equal(pub.approved_for_purchase,false);assert.equal(pub.qualification_status,'UNVERIFIED');
 assert.equal(reg.publishedCandidates().length,1);
 const updated=sourcingFacts(raw,{published:reg.publishedCandidates()});assert.equal(updated.catalog.length,81);
 assert.equal(updated.purchaseOrders.length,24);
 assert.equal(metricReport('SRC.PO.SPEND',{data:raw,published:reg.publishedCandidates()}).result,580704);
 assert.equal(metricReport('SRC.CANDIDATE.OFFICIAL',{data:raw,published:reg.publishedCandidates()}).result,1);
 assert.equal(reg.publishedCandidates()[0].asl_status,'NOT_APPROVED');
 reg.upsert({...signal,source_hash:'CHANGED',observed_at:'2026-11-08T12:00:00Z'});
 assert.equal(reg.publishedCandidates().length,0,'source changes revoke published status');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
// Source-data segregation: test the actual performance UI model with 80 candidates.
const context={window:{},document:{addEventListener(){}},sessionStorage:{getItem(){return null},setItem(){}},location:{hash:'#ss-performance'},console};context.window=context;vm.createContext(context);
for(const f of ['static/strategic_sourcing_universe.js','static/strategic_sourcing_performance.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{timeout:8000});
const perf=context.PharmaSupplierPerformance.build(raw,{view:'commercial'});
assert.equal(perf.candidates.length,80);
assert.equal(perf.totals.spend,580704,'formal Spend is source-only');
assert.equal(perf.totals.spend_scenario_excluded,77);
assert.ok(perf.candidates.filter(r=>r.is_scenario).every(r=>r.spend==null&&r.share==null&&r.riskScore==null),'scenario has no formal spend, share or risk rating');
assert.equal(perf.totals.highRisk,perf.candidates.filter(r=>!r.is_scenario&&r.riskLevel==='高').length);
const js=fs.readFileSync('static/metric_audit_ui.js','utf8');assert.ok(js.includes('UNREGISTERED.')&&js.includes('data-metric-id')&&js.includes('/api/metrics/detail'),'metric-specific audit links must exist');
console.log('PASS V2.9.21 shared source contract, metric identity, Excel formulas, official publication/retraction and no scenario Spend mixing');
