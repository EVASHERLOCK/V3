import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseCepExport,EdqmCatalog,EDQM_SOURCE,EDQM_DOWNLOAD_URL} from './edqm_cep_v2922.mjs';
import {ACTIONS,actionReport} from './analysis_rules_v2922.mjs';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {metricReport,METRICS,exportMetricWorkbook} from './metric_registry_v2921.mjs';
import {SourcingRegistry} from './sourcing_registry.mjs';
const source='CEP Number\tHolder Name\tSubstance Name\tStatus\tMonograph Number\tIssue Date of CEP\nCEP 2026-001 Rev 00\tTest API Manufacturer\tAtorvastatin calcium\tVALID\t1234\t01/03/2026\nCEP 2026-002 Rev 00\tTest Intermediate Co\tIbuprofen\tVALID\t4321\t02/03/2026\n';
const parsed=parseCepExport(source);assert.equal(parsed.records.length,2);assert.equal(parsed.records[0].holder,'Test API Manufacturer');
assert.throws(()=>parseCepExport('Supplier\tStatus\nFoo\tVALID'),/表头/);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'edqm-verify-'));
try{
 const c=new EdqmCatalog({file:path.join(tmp,'edqm.json')});assert.equal(c.summary().record_count,0);
 let imported=c.importText(source,{filename:'EDQM_2026_11_08.txt'});assert.equal(imported.record_count,2);assert.equal(imported.latest_changes.added,2);assert.match(imported.file_sha256,/^[a-f0-9]{64}$/);
 let result=c.search('Atorvastatin');assert.equal(result.total,1);assert.equal(c.get('CEP 2026-001 Rev 00').status,'VALID');
 imported=c.importText(source.replace('Atorvastatin calcium\tVALID','Atorvastatin calcium\tSUSPENDED BY EDQM'),{filename:'edqm-new.txt'});
 assert.equal(imported.latest_changes.status_changed,1);assert.equal(imported.status_changes[0].from,'VALID');assert.equal(imported.status_changes[0].to,'SUSPENDED BY EDQM');
 assert.equal(new EdqmCatalog({file:path.join(tmp,'edqm.json')}).search('CEP 2026-001').total,1);
 let contacted='';const fetched=await c.syncOfficial({force:true,fetchImpl:async (url,opts)=>{
  contacted=url;assert.equal(opts.redirect,'manual');assert.equal(url,EDQM_DOWNLOAD_URL);
  return {ok:true,status:200,headers:{get:k=>k==='content-length'?String(Buffer.byteLength(source)):null},body:await import('node:stream').then(({Readable})=>Readable.from([Buffer.from(source)]))};
 }});
 assert.equal(fetched.transport_verified,'HTTPS_OFFICIAL_HOST_ONLY');assert.equal(fetched.record_count,2);
 assert.equal(c.summary().source_class,'HTTPS_EDQM_OFFICIAL_EXPORT');
 const before=c.summary().file_sha256;
 await assert.rejects(c.syncOfficial({force:true,fetchImpl:async()=>{throw Error('Network unavailable')}}),/Network unavailable/);
 assert.equal(c.summary().file_sha256,before,'failed upstream must not erase previous parsed data');
 assert.equal(contacted,EDQM_DOWNLOAD_URL);

 assert.ok(EDQM_SOURCE.startsWith('https://extranet.edqm.eu'));
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
const raw=enterpriseAnalysis({});
for(const id of Object.keys(ACTIONS)){
 const r=actionReport(id,{data:raw,scope:{material:'API-001',supplier:'SUP-001'}});
 assert.ok(r.action_id===id&&Array.isArray(r.thresholds)&&r.thresholds.length>0,id);
 assert.ok(Array.isArray(r.inputs)&&r.inputs.every(x=>x.metric_id&&x.formula),id);
 assert.ok(Array.isArray(r.rows));assert.ok(r.source_boundary.includes('V08'),id);
}
const second=actionReport('ACT.SOURCE.SECOND',{data:raw,scope:{material:'API-001'}});
assert.ok(second.conditions.length>=2&&second.rows.length>0);
const noScope=actionReport('ACT.RISK.SUPPLIER_CONCENTRATION',{data:raw});assert.equal(noScope.status,'INSUFFICIENT_EVIDENCE');
assert.equal(actionReport('ACT.UNKNOWN',{data:raw}).status,'UNREGISTERED_ANALYSIS');
assert.ok(Object.keys(METRICS).length>=28);
for(const id of ['SRC.PO.LATE_COUNT','SRC.PO.ON_TIME_COUNT','SRC.PO.AVG_LATE_DAYS','SRC.PO.RECEIPT_RATE','SRC.QUOTE.AVG_LANDED','SRC.DOC.COUNT','SRC.DOC.EXPIRED_COUNT','SRC.DOC.DUE_30','SRC.DOC.DUE_90','SRC.QUAL.RECORDED']){
 const result=metricReport(id,{data:raw});assert.ok(result.formula&&result.status==='DEMO_RECOMPUTABLE',id);
}
assert.equal(metricReport('SRC.PO.LATE_COUNT',{data:raw}).result,2);
assert.equal(metricReport('SRC.PO.ON_TIME_COUNT',{data:raw}).result,22);
assert.equal(metricReport('SRC.PO.RECEIPT_RATE',{data:raw}).result,100);
assert.ok(exportMetricWorkbook({data:raw}).length>10000);
const saved=process.env.OPENFDA_API_KEY;try{
 process.env.OPENFDA_API_KEY='SECRET_FDA_TEST_KEY_MUST_NOT_LEAK';
 const reg=new SourcingRegistry({file:path.join(os.tmpdir(),'v2922-no-live-registry-'+process.pid+'.json')});let seen='';
 reg.fetchBounded=async url=>{seen=url;return {body:JSON.stringify({results:[{recall_number:'TEST-999'}]})}};
 const result=await reg.fetchOfficial('FDA_DRUG_RECALLS');
 assert.ok(seen.includes('SECRET_FDA_TEST_KEY_MUST_NOT_LEAK'),'key sent to FDA only');
 assert.ok(!result.url.includes('SECRET_FDA_TEST_KEY_MUST_NOT_LEAK'),'source URL must never leak credential');
}finally{if(saved==null)delete process.env.OPENFDA_API_KEY;else process.env.OPENFDA_API_KEY=saved}
assert.equal(metricReport('SRC.PO.SPEND',{data:raw}).result,580704);
const js=fs.readFileSync('static/metric_audit_ui.js','utf8');assert.ok(js.includes("data-audit='analysis'")||js.includes("dataset.audit='analysis'"));
console.log('PASS V2922 EDQM CEP file import/version hash/status differences; six source-based analysis rules and explicit missing lineage');
