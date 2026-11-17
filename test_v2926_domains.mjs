import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {EnterpriseConnectorStore} from './enterprise_connector_v2923.mjs';
import {buildReleasedDashboard} from './enterprise_dashboard_v2925.mjs';
import {metricReport,exportMetricWorkbook,METRICS} from './metric_registry_v2921.mjs';
import {exportDomainEvidenceWorkbook,DOMAIN_METRICS,DOMAIN_NAMES} from './enterprise_evidence_v2926.mjs';
import {PAGE_METRIC_INDEX} from './page_metric_manifest_v2923.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pharma-v2926-domains-'));
const po=[{po_id:'PO-Z1',supplier_id:'SUP-A',site_id:'SITE-A',material_id:'API-001',created_date:'2026-09-30',ordered_qty:20,received_qty:20,unit_price_usd:101,amount_usd:2020,benchmark_price_usd:106,delay_days:0,currency:'USD'}];
const base={supplier_id:'SUP-A',site_id:'SITE-A',material_id:'API-001',currency:'USD'};
const domains={
 bom:[{...base,id:'BOM-L1',category:'原料药',qty:20,target_unit_usd:100,quoted_unit_usd:98,as_of:'2026-09-30',evidence_ref:'DOC-BOM-1'},{...base,id:'BOM-L2',category:'检验与放行',qty:1,target_unit_usd:40,quoted_unit_usd:60,as_of:'2026-09-30',evidence_ref:'DOC-BOM-2'}],
 stages:[{...base,id:'PR-1',project_id:'NPI-001',stage:'采购初审',start_date:'2026-09-01',end_date:'2026-09-09',status:'DONE',evidence_ref:'PM-1'},{...base,id:'PR-2',project_id:'NPI-001',stage:'SQM审核',start_date:'2026-09-10',end_date:'2026-09-19',status:'BLOCKED',evidence_ref:'PM-2'},{...base,id:'PR-3',project_id:'NPI-001',stage:'RA注册评估',start_date:'2026-09-20',end_date:'2026-09-29',status:'NOT_STARTED',evidence_ref:'PM-3'}],
 scores:[{...base,id:'SCORE-1',quality:90,delivery:80,technical:85,compliance:70,commercial:65,weights:{quality:24,delivery:18,technical:22,compliance:22,commercial:14},evidence_ref:'EVAL-S1'}, {id:'SCORE-2',supplier_id:'SUP-B',site_id:'SITE-B',material_id:'API-001',quality:70,delivery:75,technical:65,compliance:85,commercial:90,weights:{quality:24,delivery:18,technical:22,compliance:22,commercial:14},evidence_ref:'EVAL-S2'}],
 documents:[{...base,id:'DOCREG-1',document_type:'CEP',market:'EU',expiry_date:'2027-05-30',review_status:'REVIEWED',evidence_ref:'EDQM-1'},{...base,id:'DOCREG-2',document_type:'EU GMP',market:'EU',expiry_date:'2026-01-01',review_status:'PENDING',evidence_ref:'EUDRA-2'}],
 quotes:[{...base,id:'RFQ-1',quote_date:'2026-09-22',unit_price_usd:96,moq:20,freight_usd:100,review_status:'REVIEWED',evidence_ref:'Q-1'},{id:'RFQ-2',supplier_id:'SUP-B',site_id:'SITE-B',material_id:'API-001',currency:'USD',quote_date:'2026-09-22',unit_price_usd:104,moq:10,freight_usd:60,review_status:'RECEIVED',evidence_ref:'Q-2'}]
};
const stage=()=>new EnterpriseConnectorStore({file:path.join(tmp,'data.json')});
const metric=(store,id,scope={material:'API-001',as_of:'2026-11-08'})=>metricReport(id,{factsOverride:store.facts(scope),scope});
try{
 const store=stage(),st=store.stage({po,domains});assert.equal(st.staged.domain_counts.bom,2);assert.equal(st.staged.domain_counts.scores,2);
 const rev=store.release({snapshot_id:st.staged.snapshot_id,reviewer:'audit-tester',reason:'Independent source row comparison for test analytics'});
 assert.equal(store.verifyRelease(),true);
 assert.equal(metric(store,'SRC.BOM.TARGET_TOTAL').result,2040);
 assert.equal(metric(store,'SRC.BOM.QUOTED_TOTAL').result,2020);
 assert.equal(metric(store,'SRC.BOM.VARIANCE').result,-20);
 assert.equal(metric(store,'SRC.BOM.VARIANCE_RATE').result,-0.9804);
 assert.equal(metric(store,'SRC.PROJECT.PROGRESS').result,33.3333);
 assert.equal(metric(store,'SRC.PROJECT.BLOCKED').result,1);
 assert.equal(metric(store,'SRC.SCORE.REVIEWS').result,2);
 assert.equal(metric(store,'SRC.EVIDENCE.DOCUMENTS').result,2);
 assert.equal(metric(store,'SRC.EVIDENCE.REVIEWED_VALID').result,1);
 assert.equal(metric(store,'SRC.EVIDENCE.REGISTERED_VALID_RATE').result,50);
 assert.equal(metric(store,'SRC.EVIDENCE.EXPIRED').result,1);
 assert.equal(metric(store,'SRC.RFQ.RECORDS').result,2);
 assert.equal(metric(store,'SRC.RFQ.BEST_UNIT').result,96);
 for(const id of Object.keys(DOMAIN_METRICS)){
   const r=metric(store,id);assert.equal(r.status,'ENTERPRISE_RECOMPUTABLE_NON_GXP',id);assert.ok(r.rows.length);assert.ok(r.formula);assert.ok(r.rows.every(x=>x.evidence_ref&&x.source_row));
 }
 const onlyA=metric(store,'SRC.SCORE.REVIEWS',{material:'API-001',supplier:'SUP-A',as_of:'2026-11-08'});
 assert.equal(onlyA.result,1);
 const unrelated=metric(store,'SRC.BOM.VARIANCE',{material:'OTHER',as_of:'2026-11-08'});
 assert.equal(unrelated.status,'INSUFFICIENT_SOURCE');assert.equal(unrelated.result,null);
 const cost=buildReleasedDashboard({connector:store,route:'ss-cost',scope:{material:'API-001',as_of:'2026-11-08'}});
 assert.equal(cost.status,'ENTERPRISE_RECONCILED_NON_GXP');assert.equal(cost.reconciliation.passed,true);assert.ok(cost.specialist.panels.some(x=>x.kind==='bom_waterfall'));assert.ok(cost.specialist.panels.some(x=>x.kind==='rfq_compare'));
 const gantt=buildReleasedDashboard({connector:store,route:'ss-project',scope:{material:'API-001',as_of:'2026-11-08'}});
 assert.ok(gantt.specialist.panels.some(x=>x.kind==='project_gantt'));
 assert.ok(gantt.specialist.panels.some(x=>x.kind==='score_matrix'));
 const compliance=buildReleasedDashboard({connector:store,route:'ss-compliance',scope:{material:'API-001',as_of:'2026-11-08'}});
 assert.equal(compliance.specialist.panels.find(x=>x.kind==='evidence_matrix').points.length,2);
 for(const route of Object.keys(PAGE_METRIC_INDEX)){
  const out=buildReleasedDashboard({connector:store,route,scope:{as_of:'2026-11-08'}});
  assert.equal(out.status,'ENTERPRISE_RECONCILED_NON_GXP',route);assert.equal(out.source.sha256,cost.source.sha256);
  assert.equal(out.reconciliation.passed,true);assert.ok(out.specialist&&out.metrics.length>0);
 }
 assert.equal(Object.keys(PAGE_METRIC_INDEX).length,26);assert.equal(Object.keys(DOMAIN_METRICS).length,20);assert.equal(Object.keys(METRICS).length,97);
 for(const invalid of [
  {scores:[{...domains.scores[0],weights:{...domains.scores[0].weights,quality:23}}]},
  {quotes:[{...domains.quotes[0],currency:'EUR'}]},
  {bom:[{...domains.bom[0],evidence_ref:''}]},
  {documents:[{...domains.documents[0],expiry_date:'2026-02-30'}]},
  {bom:[{...domains.bom[0]},{...domains.bom[0]}]}
 ])assert.throws(()=>store.stage({domains:invalid}),/invalid|weights|USD|evidence|date|duplicate|required/i);
 const book=exportDomainEvidenceWorkbook(store.facts({material:'API-001',as_of:'2026-11-08'}),{material:'API-001',as_of:'2026-11-08'});
 const all=exportMetricWorkbook({factsOverride:store.facts({material:'API-001',as_of:'2026-11-08'}),scope:{material:'API-001',as_of:'2026-11-08'},metricIds:['SRC.BOM.VARIANCE']});
 assert.equal(book.subarray(0,2).toString(),'PK');assert.equal(all.subarray(0,2).toString(),'PK');
 fs.writeFileSync(path.join(tmp,'domain.xlsx'),book);
 const tamper=stage();assert.equal(tamper.verifyRelease(),true);tamper.data.released.domains.bom[0].qty=999;assert.equal(tamper.verifyRelease(),false);assert.equal(buildReleasedDashboard({connector:tamper,route:'ss-cost'}).status,'SNAPSHOT_INTEGRITY_FAILED');
 store.revoke({reviewer:'audit-tester',reason:'Completed test'});assert.equal(buildReleasedDashboard({connector:store,route:'ss-project'}).status,'NO_RELEASED_ENTERPRISE_SNAPSHOT');
 console.log('PASS V2926: 97 metrics, 5 evidence domains, 26 routes, BOM/Gantt/scores/docs/RFQ/Excel, integrity and missing-source safeguards');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
