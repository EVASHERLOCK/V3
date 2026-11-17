import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectXlsxFormulas} from './scripts/zip_formula_assert.mjs';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {METRICS,metricReport,exportMetricWorkbook} from './metric_registry_v2921.mjs';
import {ACTIONS,actionReport} from './analysis_rules_v2922.mjs';
import {PAGE_METRIC_INDEX} from './page_metric_manifest_v2923.mjs';
import {OP_METRICS} from './operational_metrics_v2925.mjs';
const data=enterpriseAnalysis({});const scope={as_of:'2026-11-08',supplier:'all',material:'all',year:'all'};
assert.ok(Object.keys(METRICS).length>=77);
assert.equal(Object.keys(ACTIONS).length,18);
assert.equal(Object.keys(PAGE_METRIC_INDEX).length,26);
for(const [route,ids] of Object.entries(PAGE_METRIC_INDEX))assert.ok(ids.every(id=>METRICS[id]),route);
const expected={
 'SRC.INVOICE.COUNT':24,'SRC.INVOICE.MATCHED':19,'SRC.INVOICE.MATCH_RATE':79.1667,'SRC.INVOICE.EXCEPTIONS':5,
 'SRC.INVOICE.OVERDUE':5,'SRC.INVOICE.AMOUNT':614050,'SRC.CHANGE.COUNT':3,'SRC.CHANGE.OPEN':2,'SRC.CHANGE.HIGH':1,
 'SRC.WORKFLOW.RUNS':12,'SRC.WORKFLOW.FAILURES':2,'SRC.WORKFLOW.SUCCESS_RATE':83.3333,
 'SRC.WORKFLOW.AVG_MS':898.5,'SRC.INVENTORY.LOTS':12,'SRC.INVENTORY.QC_HOLD':3,'SRC.INVENTORY.RETEST_90':4,
 'SRC.MASTER.MATERIALS':2,'SRC.MASTER.SUPPLIERS':3,'SRC.REG.FILINGS':3,'SRC.ALERT.HIGH':6};
for(const id of Object.keys(OP_METRICS)){
 const r=metricReport(id,{data,scope});assert.equal(r.result,expected[id],id);assert.equal(r.status,'DEMO_RECOMPUTABLE');assert.ok(r.rows.every(x=>x.source_row&&x.source_class==='V08_DEMO_SAMPLE'),id);
 const ent=metricReport(id,{data,scope,factsOverride:{scope:{source_boundary:'ENTERPRISE_API_RELEASED_NON_GXP'},has_erp_input:true,has_qms_input:true,purchaseOrders:[],catalog:[],quotes:[],documents:[],qualifications:[],supplierMaster:[],qmsEvents:[]}});
 assert.equal(ent.status,'INSUFFICIENT_SOURCE',id);assert.equal(ent.result,null);
}
assert.equal(metricReport('SRC.INVOICE.COUNT',{data,scope:{...scope,supplier:'UNRELATED'}}).status,'INSUFFICIENT_SOURCE');
assert.equal(metricReport('SRC.MASTER.SUPPLIERS',{data,scope:{...scope,year:'2026'}}).status,'REQUIRES_SCOPE');
for(const id of Object.keys(ACTIONS).slice(-6)){
 const r=actionReport(id,{data,scope});assert.ok(r.decision);assert.ok(r.rationale.includes(r.decision));assert.ok(r.inputs[0].metric_id.startsWith('SRC.'));assert.ok(r.rows.length>0,id);
}
const wb=exportMetricWorkbook({data,scope});
const {xml,formulas}=inspectXlsxFormulas(wb);
assert.ok(xml.includes('SRC.INVOICE.MATCH_RATE'));assert.ok(xml.includes('SRC.WORKFLOW.SUCCESS_RATE'));
assert.ok(formulas>150,`formula cells: ${formulas}`);
console.log(`PASS V2925: 77 metrics, 18 decision rules, 26 page maps, ${formulas} real XLSX formula cells`);
