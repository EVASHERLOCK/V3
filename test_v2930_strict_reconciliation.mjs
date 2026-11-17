import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {EnterpriseConnectorStore} from './enterprise_connector_v2923.mjs';
import {buildReleasedDashboard} from './enterprise_dashboard_v2925.mjs';
import {metricReport} from './metric_registry_v2921.mjs';
import {buildModuleTrace,exportModuleTraceWorkbook} from './module_traceability_v2928.mjs';
import {auditMetricSource,auditPublishedDashboard} from './component_reconciliation_v2930.mjs';
import {inspectXlsxFormulas} from './scripts/zip_formula_assert.mjs';
import {PAGE_METRIC_INDEX} from './page_metric_manifest_v2923.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'v2930-recon-'));
const scope={supplier:'all',material:'API-001',year:'all',as_of:'2026-11-09'};
const po=[{po_id:'PO-2930-A',supplier_id:'S1',site_id:'SITE-A',material_id:'API-001',created_date:'2026-10-01',ordered_qty:10,received_qty:10,unit_price_usd:90,amount_usd:900,benchmark_price_usd:100,delay_days:0,currency:'USD'},
{po_id:'PO-2930-B',supplier_id:'S2',site_id:'SITE-B',material_id:'API-001',created_date:'2026-10-02',ordered_qty:20,received_qty:16,unit_price_usd:110,amount_usd:2200,benchmark_price_usd:100,delay_days:4,currency:'USD'}];
try{
 const connector=new EnterpriseConnectorStore({file:path.join(tmp,'enterprise.json')});const staged=connector.stage({po});
 // Staged records are inaccessible as released analytical facts.
 assert.equal(connector.facts(scope),null);
 connector.release({snapshot_id:staged.staged.snapshot_id,reviewer:'QA-test',reason:'Test of independent source/visible report reconciliation'});
 const facts=connector.facts(scope);const snapshot=connector.data.released.snapshot_id;
 assert.equal(connector.verifyRelease(),true);
 const spend=metricReport('SRC.PO.SPEND',{factsOverride:facts,scope});
 assert.equal(spend.result,3100);
 const src=auditMetricSource(spend,{facts,scope,enterprise:true,snapshot});
 assert.equal(src.status,'CONTROLLED_SOURCE_RECOMPUTED_NON_GXP');assert.equal(src.independent_result,3100);
 // An exact displayed value, ID, unit, scope and immutable snapshot may pass.
 const display=(overrides={})=>({route:'ss-performance',title:'采购支出与OTD × PPV绩效',component_id:'ss-performance.spend',metrics:['SRC.PO.SPEND','SRC.PO.OTD','SRC.PO.PPV'],
 figures:[{label:'采购总金额',value:'3100',metric_id:'SRC.PO.SPEND',unit:'USD',snapshot_id:snapshot,scope,...overrides}]});
 const opts={scope,factsOverride:facts};
 let out=buildModuleTrace(display(),opts);assert.equal(out.reconciliation.summary.source_metrics_recomputed,3);assert.equal(out.reconciliation.figures[0].status,'CONTROLLED_DISPLAY_RECONCILED_NON_GXP');
 out=buildModuleTrace(display({snapshot_id:'WRONG'}),opts);assert.equal(out.reconciliation.figures[0].status,'VALUE_MATCH_SCOPE_OR_RELEASE_UNVERIFIED');
 out=buildModuleTrace(display({scope:{...scope,year:'2025'}}),opts);assert.equal(out.reconciliation.figures[0].status,'VALUE_MATCH_SCOPE_OR_RELEASE_UNVERIFIED');
 out=buildModuleTrace(display({value:'3300'}),opts);assert.equal(out.reconciliation.figures[0].status,'DISPLAY_VALUE_MISMATCH');assert.equal(out.reconciliation.status,'FAIL');
 out=buildModuleTrace(display({metric_id:''}),opts);assert.equal(out.reconciliation.figures[0].status,'MISSING_EXPLICIT_METRIC_ID');
 // A chart with complete group PO IDs is independently recomputed from raw rows.
 const d=buildReleasedDashboard({connector,route:'overview',scope});assert.equal(d.status,'ENTERPRISE_RECONCILED_NON_GXP');
 const chart=auditPublishedDashboard(d,facts);assert.equal(chart.status,'PASSED_SOURCE_CHARTS');assert(chart.summary.chart_points_verified>=7);
 const bad=structuredClone(d);bad.charts.find(x=>x.id==='spend_supplier').points[0].value+=100;
 const wrong=auditPublishedDashboard(bad,facts);assert.equal(wrong.status,'FAILED');assert(wrong.charts.some(x=>x.point_failed>0));
 const missing=structuredClone(d);missing.charts.find(x=>x.id==='spend_supplier').points[0].source_ids=[];
 assert.equal(auditPublishedDashboard(missing,facts).status,'PARTIAL');
 const domain=buildReleasedDashboard({connector,route:'ss-project',scope});assert.equal(domain.reconciliation.passed,true);
 for(const route of Object.keys(PAGE_METRIC_INDEX)){
  const view=buildReleasedDashboard({connector,route,scope});assert.equal(view.source.snapshot_id,snapshot);assert.equal(view.reconciliation.passed,true);
  assert.notEqual(auditPublishedDashboard(view,facts).status,'FAILED');
 }
 // Signed-in-but-tampered release must be blocked by the existing connector.
 connector.data.released.po[0].amount_usd=999999;
 assert.equal(connector.verifyRelease(),false);
 assert.equal(buildReleasedDashboard({connector,route:'overview',scope}).status,'SNAPSHOT_INTEGRITY_FAILED');
 connector.data.released.po[0].amount_usd=900;
 const xlsx=inspectXlsxFormulas(exportModuleTraceWorkbook(display(),opts));
 assert(xlsx.formulas>=5);assert(xlsx.xml.includes('严格对账总览'));assert(xlsx.xml.includes('源行独立复算'));assert(xlsx.xml.includes('图表来源核验'));
 connector.revoke({reviewer:'QA-test',reason:'Fixture completed'});assert.equal(connector.facts(scope),null);
 console.log('PASS V2930: strict ID/period/unit/snapshot, 26-page chart source checks, mismatch & missing-IDs fail closed, Excel and revoked/tampered snapshot protections');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
