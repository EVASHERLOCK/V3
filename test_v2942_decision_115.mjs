/** Full simulated KPI mapping regression, including scopes, lineage and workbook. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDecisionDataset,buildDecisionEvidence,buildDecisionModule,buildDecisionExportFacts} from './decision_center_v2935.mjs';
import {exportDecisionModuleWorkbook} from './decision_center_workbook_v2935.mjs';
import {SIM_KPI_REGISTRY} from './simulation_kpi_v2942.mjs';
import {overview,validateAll} from './sim_data_center_v2941.mjs';
process.env.PHARMA_DATA_MODE='SIMULATED';
const dataset=buildDecisionDataset();
assert.equal(SIM_KPI_REGISTRY.size,115);assert.equal(dataset.metrics.length,115);assert.equal(dataset.source_meta.coverage.computed,115);assert.equal(dataset.source_meta.coverage.missing,0);
assert(dataset.metrics.every(m=>m.value!=='—'&&Number.isFinite(Number(m.value))&&m.status==='已计算'&&m.evidence.availability==='SIMULATED_EVENT_RECOMPUTED'&&m.formula&&!m.missing_reason));
assert(dataset.metrics.every(m=>m.evidence.rows.length===0),'Dataset payload must be bounded; use drilldown endpoints');
assert(dataset.metrics.every(m=>m.numerator!==null),'Every KPI has numeric numerator or aggregate');
assert(dataset.source_meta.source_boundary==='SIMULATED_115_KPIS_NON_GXP');
const index=Object.fromEntries(dataset.metrics.map(x=>[x.id,x]));
const scope=buildDecisionExportFacts();const po=scope.tables.po;const sim=scope.tables.simEvents;
assert.equal(po.length,1440);assert.equal(sim.length,1440);assert.equal(scope.tables.docs.length,80);
const sum=(xs,f)=>xs.reduce((a,r)=>a+Number(f(r)),0),round=x=>Number(x.toFixed(2));
assert.equal(Number(index['KPI-01-01'].value),round(sum(po,r=>r.unit_price*r.ordered_qty)));
assert.equal(Number(index['KPI-03-01'].value),po.length);
assert.equal(Number(index['KPI-03-04'].value),round(100*po.filter(r=>r.receipt_date<=r.promised_date&&Number(r.received_qty)>=Number(r.ordered_qty)).length/po.length));
assert.equal(Number(index['KPI-06-01'].value),round(100*po.filter(r=>r.receipt_date<=r.promised_date).length/po.length));
assert.equal(Number(index['KPI-09-01'].value),30);
assert.equal(dataset.rules.length,30);assert.equal(dataset.actions.length,24);assert.equal(dataset.analyses.length,22);
assert(dataset.rules.every(r=>r[6].includes('模拟数据已核对')));
assert.equal(validateAll().violation_count,0);
const months=dataset.source_meta.options.months;assert.equal(months.length,12);
for(const month of months){const d=buildDecisionDataset({month});assert.equal(d.source_meta.coverage.computed,115);assert(d.metrics.every(m=>m.status==='已计算'),month);assert.equal(Number(d.metrics.find(m=>m.id==='KPI-03-01').value),120)}
const supplied=buildDecisionDataset({supplier:'SUP-001'});assert.equal(supplied.source_meta.coverage.computed,115);assert.equal(supplied.source_meta.scope.supplier,'SUP-001');
const mat=buildDecisionDataset({material:'MAT-001'});assert.equal(mat.source_meta.coverage.computed,115);
const proj=buildDecisionDataset({project:'PRJ-001'});assert.equal(proj.source_meta.scope.project,'PRJ-001');assert.equal(proj.source_meta.coverage.computed,115);
assert.equal(Number(proj.metrics.find(m=>m.id==='KPI-03-01').value),60);
const lastPo=po.find(r=>String(r.created_date||'').startsWith('2026-10'));assert(lastPo,'Expected October purchase order');
const chosen=buildDecisionDataset({month:'2026-10',supplier:lastPo.supplier_id,material:lastPo.material_id,project:lastPo.project_id});assert.equal(chosen.source_meta.coverage.computed,115);
const impossible=buildDecisionDataset({month:'2026-10',supplier:'SUP-001',material:'MAT-001',project:'PRJ-001'});
assert.equal(impossible.source_meta.coverage.computed,0);assert(impossible.metrics.every(m=>m.status==='无匹配模拟记录'&&m.value==='—'));
for(const id of ['KPI-01-07','KPI-02-05','KPI-03-11','KPI-05-08','KPI-07-09','KPI-08-02','KPI-09-07','KPI-10-06','KPI-11-05']){
 const ev=buildDecisionEvidence({metric:id});assert(ev&&ev.calculation_contract.rows.length>0,id);assert(ev.metric.formula&&ev.metric.analysis_steps&&ev.metric.evidence.source_table,id)
}
for(const group of dataset.groups){const mod=buildDecisionModule({kind:'group',id:group.id});assert(mod,group.id);assert.equal(mod.missing,0);assert(mod.metrics.length>=9);assert(mod.tables.some(t=>t.count>0));assert(mod.metrics.every(m=>!m.evidence.rows.length));}
const all=buildDecisionModule({kind:'dictionary',id:'all'});assert.equal(all.computed,115);assert.equal(all.missing,0);
const book=await exportDecisionModuleWorkbook({kind:'dictionary',id:'all'});assert(book.length>250000);assert.equal(book.toString('ascii',0,2),'PK');
for(const f of ['dist/static/decision-center/snapshot_v2942.json','dist/engine/simulation_kpi_v2942.mjs','dist/static/decision-center/offline_v2942.mjs'])assert(fs.existsSync(f),f);
const cached=JSON.parse(fs.readFileSync('dist/static/decision-center/snapshot_v2942.json','utf8'));assert.equal(cached.source_meta.coverage.computed,115);
console.log('PASS V2.9.42: 115/115 synthetic KPI; 12 months; supplier/material/project; source lineage; 30 rules; workbook; static snapshot');
