import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EnterpriseConnectorStore} from './enterprise_connector_v2923.mjs';
import {buildReleasedDashboard} from './enterprise_dashboard_v2925.mjs';
import {PAGE_METRIC_INDEX} from './page_metric_manifest_v2923.mjs';
import {metricReport,exportMetricWorkbook} from './metric_registry_v2921.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pharma-v2925-'));
const connector=new EnterpriseConnectorStore({file:path.join(tmp,'released.json')});
const orders=[
 {po_id:'PO-A1',supplier_id:'SUP-A',site_id:'SITE-A',material_id:'API-001',created_date:'2026-09-01',ordered_qty:10,received_qty:10,amount_usd:1000,unit_price_usd:100,benchmark_price_usd:110,delay_days:0,currency:'USD'},
 {po_id:'PO-A2',supplier_id:'SUP-A',site_id:'SITE-A',material_id:'API-001',created_date:'2026-10-02',ordered_qty:20,received_qty:20,amount_usd:2200,unit_price_usd:110,benchmark_price_usd:110,delay_days:4,currency:'USD'},
 {po_id:'PO-B1',supplier_id:'SUP-B',site_id:'SITE-B',material_id:'EXC-001',created_date:'2026-10-10',ordered_qty:10,received_qty:10,amount_usd:500,unit_price_usd:50,benchmark_price_usd:50,delay_days:0,currency:'USD'}
];
const qms=[{event_id:'CAPA-A1',record_type:'CAPA',supplier_id:'SUP-A',site_id:'SITE-A',material_id:'API-001',opened_at:'2026-10-01',due_date:'2026-11-30',status:'OPEN',severity:'MAJOR'}];
try{
 let r=buildReleasedDashboard({connector,route:'overview'});assert.equal(r.status,'NO_RELEASED_ENTERPRISE_SNAPSHOT');
 const staged=connector.stage({po:orders,qms,origin:'CONFIGURED_HTTPS_ENTERPRISE_API'});assert.equal(staged.staged.po_count,3);
 assert.equal(buildReleasedDashboard({connector,route:'overview'}).status,'NO_RELEASED_ENTERPRISE_SNAPSHOT');
 connector.release({snapshot_id:staged.staged.snapshot_id,reviewer:'audit-test',reason:'Validated test fixture and scope'});
 const a=buildReleasedDashboard({connector,route:'overview'});assert.equal(a.status,'ENTERPRISE_RECONCILED_NON_GXP');assert.equal(a.reconciliation.passed,true);
 assert.equal(a.reconciliation.detail.po_rows,3);assert.equal(a.source.po_rows_total,3);assert.equal(a.source.sha256.length,64);
 const grouped=a.charts.find(x=>x.id==='spend_supplier');assert.ok(grouped);assert.deepEqual(grouped.points.map(x=>x.value),[3200,500]);assert.ok(grouped.points.every(x=>x.source_breakdown.length===x.order_count && Math.abs(x.source_breakdown.reduce((s,r)=>s+r.amount_usd,0)-x.value)<.01));
 assert.equal(a.metrics.find(x=>x.id==='SRC.PO.SPEND').value,3700);
 assert.equal(a.metrics.find(x=>x.id==='SRC.PO.OTD').value,66.6667);
 const byMonth=a.charts.find(x=>x.id==='spend_month');assert.deepEqual(byMonth.points.map(x=>x.value),[2700,1000]);
 const matrix=a.charts.find(x=>x.id==='otd_ppv');assert.equal(matrix.points.length,2);assert.ok(matrix.points[0].source_ids.length>=1);assert.ok(matrix.points.every(x=>x.source_breakdown.length===x.order_count&&x.source_breakdown.every(r=>r.id&&Number.isFinite(r.amount_usd))));
 assert.equal(a.reconciliation.checks.every(x=>x.pass!==false),true);
 const one=buildReleasedDashboard({connector,route:'ss-cost',scope:{material:'API-001'}});assert.equal(one.metrics.find(x=>x.id==='SRC.PO.SPEND').value,3200);
 assert.equal(one.reconciliation.passed,true);
 const filtered=buildReleasedDashboard({connector,route:'overview',scope:{supplier:'SUP-B'}});assert.equal(filtered.metrics.find(x=>x.id==='SRC.PO.SPEND').value,500);
 assert.notEqual(filtered.fingerprint,a.fingerprint);
 const sameMetricOtherPage=buildReleasedDashboard({connector,route:'ss-performance'});
 assert.equal(sameMetricOtherPage.reconciliation.detail.otd,a.reconciliation.detail.otd);
 const qmsOnly=buildReleasedDashboard({connector,route:'m09'});assert.ok(qmsOnly.metrics.some(x=>x.id==='SRC.QMS.EVENT_COUNT'&&x.value===1));assert.equal(qmsOnly.charts.find(x=>x.id==='qms').points[0].source_breakdown[0].id,'CAPA-A1');
 const noRecords=buildReleasedDashboard({connector,route:'ss-cost',scope:{material:'API-NOT-FOUND'}});assert.notEqual(noRecords.status,'RECONCILIATION_FAILED');assert.equal(noRecords.metrics.find(x=>x.id==='SRC.PO.SPEND').value,null);
 for(const route of Object.keys(PAGE_METRIC_INDEX)){
  r=buildReleasedDashboard({connector,route});assert.equal(r.route,route);assert.equal(r.reconciliation.passed,true,route);assert.ok(r.metrics.length>0,route);
  assert.ok(r.metrics.every(x=>x.id&&x.formula&&x.status),route);
  assert.ok(r.metrics.filter(x=>x.status==='INSUFFICIENT_SOURCE').every(x=>x.value===null),route);
 }
 assert.equal(Object.keys(PAGE_METRIC_INDEX).length,26);
 const facts=connector.facts({material:'API-001'});assert.equal(metricReport('SRC.PO.SPEND',{factsOverride:facts,scope:{material:'API-001'}}).result,3200);
 const bytes=exportMetricWorkbook({factsOverride:facts,scope:{material:'API-001'},metricIds:['SRC.PO.SPEND']});assert.equal(bytes.subarray(0,2).toString(),'PK');
 const old=a.source.snapshot_id;
 const staged2=connector.stage({po:orders.map((x,i)=>i===0?{...x,amount_usd:1500,unit_price_usd:150}:x),qms,origin:'CONFIGURED_HTTPS_ENTERPRISE_API'});
 connector.release({snapshot_id:staged2.staged.snapshot_id,reviewer:'audit-test',reason:'Second controlled test publication'});
 const b=buildReleasedDashboard({connector,route:'overview'});
 assert.notEqual(b.source.snapshot_id,old);assert.equal(b.metrics.find(x=>x.id==='SRC.PO.SPEND').value,4200);assert.notEqual(b.fingerprint,a.fingerprint);
 connector.revoke({reviewer:'audit-test',reason:'Tested snapshot revoke'});
 assert.equal(buildReleasedDashboard({connector,route:'overview'}).status,'NO_RELEASED_ENTERPRISE_SNAPSHOT');
 assert.equal(connector.verifyAudit(),true);
 // A modified release without republishing must fail the hash check.
 const again=connector.stage({po:orders,qms,origin:'CONFIGURED_HTTPS_ENTERPRISE_API'});
 connector.release({snapshot_id:again.staged.snapshot_id,reviewer:'audit-test',reason:'Re-release for tamper detection'});
 connector.data.released.po[0].amount_usd=99;
 assert.equal(buildReleasedDashboard({connector,route:'overview'}).status,'SNAPSHOT_INTEGRITY_FAILED');

 console.log('PASS V2925: 26 route enterprise dashboards, source reconciliation, filters, QMS/ERP isolation, 2 publications and revoke');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
