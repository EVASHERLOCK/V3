import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectXlsxFormulas,readZipEntries} from './scripts/zip_formula_assert.mjs';
import {EnterpriseConnectorStore,secureEndpoint} from './enterprise_connector_v2923.mjs';
import {metricReport,exportMetricWorkbook,METRICS} from './metric_registry_v2921.mjs';
import {PAGE_METRIC_INDEX,pageMetricCoverage} from './page_metric_manifest_v2923.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pharma-v2923-'));
const po=[{po_id:'PO-001',supplier_id:'SUP-ERP',site_id:'SITE-1',material_id:'API-001',created_date:'2026-10-01',ordered_qty:100,received_qty:100,amount_usd:10000,unit_price_usd:100,benchmark_price_usd:110,delay_days:2,currency:'USD'},
 {po_id:'PO-002',supplier_id:'SUP-ERP2',site_id:'SITE-2',material_id:'API-001',created_date:'2026-10-12',ordered_qty:50,received_qty:50,amount_usd:5500,unit_price_usd:110,benchmark_price_usd:115,delay_days:0,currency:'USD'}];
const qms=[{event_id:'QMS-CAPA-1',record_type:'CAPA',supplier_id:'SUP-ERP',site_id:'SITE-1',material_id:'API-001',opened_at:'2026-09-01',due_date:'2026-10-01',status:'IN_PROGRESS',severity:'MAJOR'},
 {event_id:'QMS-CAPA-2',record_type:'CAPA',supplier_id:'SUP-ERP2',site_id:'SITE-2',material_id:'API-001',opened_at:'2026-09-15',due_date:'2026-10-31',closed_at:'2026-10-30',status:'CLOSED',severity:'CRITICAL'}];
const store=new EnterpriseConnectorStore({file:path.join(dir,'reconcile.json')});
assert.equal(store.facts(),null,'未审核快照不可读取');
const pending=store.stage({po,qms});assert.equal(pending.staged.po_count,2);assert.equal(store.facts(),null,'审核前不参与指标');
assert.throws(()=>store.release({snapshot_id:pending.staged.snapshot_id,reviewer:'QA',reason:'x'}),/justification/);
assert.throws(()=>store.stage({po:[po[0],po[0]]}),/Duplicate/);
assert.throws(()=>store.stage({po:[{...po[0],amount_usd:99}]}),/amount != quantity/);
assert.throws(()=>store.stage({po:[{...po[0],currency:'EUR'}]}),/currency/);
// Repair test state after intentionally invalid stages (failed calls must be atomic).
const staged=store.stage({po,qms});store.release({snapshot_id:staged.staged.snapshot_id,reviewer:'Business controller',reason:'Reconciled PO amounts and supplier/site IDs against authorized source'});
const facts=store.facts({material:'API-001'});
assert.equal(metricReport('SRC.PO.SPEND',{factsOverride:facts}).result,15500);
assert.equal(metricReport('SRC.PO.OTD',{factsOverride:facts}).result,50);
assert.equal(metricReport('SRC.PO.ACTIVE_SUPPLIERS',{factsOverride:facts}).result,2);
assert.equal(metricReport('SRC.QMS.EVENT_COUNT',{factsOverride:facts}).result,2);
assert.equal(metricReport('SRC.QMS.OVERDUE_CAPA',{factsOverride:facts}).result,1);
assert.equal(metricReport('SRC.QMS.CAPA_CLOSED_RATE',{factsOverride:facts}).result,50);
assert.equal(metricReport('SRC.QUAL.COMBINATIONS',{factsOverride:facts}).status,'INSUFFICIENT_SOURCE');
assert.equal(metricReport('SRC.PO.SPEND').result,580704,'内置演示金额必须保持独立');
const wb=exportMetricWorkbook({factsOverride:facts,scope:{material:'API-001'},metricIds:['SRC.PO.SPEND','SRC.PO.OTD','SRC.QMS.CAPA_CLOSED_RATE']});
const file=path.join(dir,'metrics.xlsx');fs.writeFileSync(file,wb);
assert.ok(wb.subarray(0,2).toString()==='PK');
const zipContent=readZipEntries(wb);assert.ok(zipContent.has('xl/worksheets/sheet10.xml'));
const sheet=zipContent.get('xl/worksheets/sheet9.xml').toString('utf8');assert.ok(sheet.includes('SRC.QMS.CAPA_CLOSED_RATE')&&sheet.includes('<f>'));
assert.equal(Object.keys(PAGE_METRIC_INDEX).length,26);
assert.ok(Object.keys(METRICS).length>=40);
assert.ok(Object.keys(PAGE_METRIC_INDEX).every(p=>pageMetricCoverage(p).complete===false));
await assert.rejects(()=>secureEndpoint('http://example.com/erp',{allowHosts:'example.com'}),/HTTPS/);
await assert.rejects(()=>secureEndpoint('https://169.254.169.254/a',{allowHosts:'169.254.169.254'}),/public/);
await assert.rejects(()=>secureEndpoint('https://example.com/erp',{allowHosts:'example.com',dnsLookup:async()=>[{address:'10.0.0.1'}]}),/private/);
assert.match(await secureEndpoint('https://erp.example.com/api/po',{allowHosts:'erp.example.com',dnsLookup:async()=>[{address:'93.184.216.34'}]}),/^https/);
// Test direct HTTPS adapter without any enterprise credentials or real network.
const oldEnv={ERP_PO_API_URL:process.env.ERP_PO_API_URL,QMS_EVENTS_API_URL:process.env.QMS_EVENTS_API_URL,ENTERPRISE_ALLOWED_HOSTS:process.env.ENTERPRISE_ALLOWED_HOSTS};
process.env.ERP_PO_API_URL='https://erp.example.com/api/po';process.env.QMS_EVENTS_API_URL='https://qms.example.com/api/events';process.env.ENTERPRISE_ALLOWED_HOSTS='erp.example.com,qms.example.com';
try{const mocked=new EnterpriseConnectorStore({file:path.join(dir,'remote.json'),lookup:async()=>[{address:'93.184.216.34'}],fetchImpl:async url=>({ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(url.includes('qms')?qms:po)})});
 const result=await mocked.pull();assert.equal(result.staged.origin,'CONFIGURED_HTTPS_ENTERPRISE_API');assert.equal(result.staged.qms_count,2);
}finally{for(const [k,v] of Object.entries(oldEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
store.revoke({reviewer:'QA',reason:'Verification revoked'});assert.equal(store.facts(),null);
console.log('PASS V2.9.23 ERP/QMS staging, authorization boundary, exact metric lineage, 26-page manifest and workbook');
fs.rmSync(dir,{recursive:true,force:true});
