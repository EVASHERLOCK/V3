/** V2.9.35: source lineage and real-formula workbook contract regression. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildDecisionDataset, buildDecisionEvidence, buildDecisionModule, buildDecisionExportFacts} from './decision_center_v2935.mjs';
import {exportDecisionModuleWorkbook} from './decision_center_workbook_v2935.mjs';
const root=process.cwd();
const pageFiles=['01_KPI总览.html','02_深度分析.html','03_智能预警.html','04_行动闭环.html','05_指标治理.html'];
const css=fs.readFileSync('static/decision_center_v2935.css','utf8');
const js=fs.readFileSync('static/decision_center_v2935.js','utf8');
assert.match(css,/body\.dc35-page \.left, body\.dc35-page \.top\{display:none!important\}/);
assert.match(css,/body\.decision-fullpage \.topbar\{display:none!important\}/);
assert.match(js,/dc35-modal/);assert.match(js,/dc35-dictionary/);
for(const [i,file] of pageFiles.entries()){
 const html=fs.readFileSync(path.join('static/decision-center',file),'utf8');
 assert.match(html,/class="dc35-page"/);assert.match(html,/decision_center_v2935\.css/);assert.match(html,/decision_center_v2935\.js/);
 assert.match(html,new RegExp(`const PAGE='0${i+1}'`));
}
const app=fs.readFileSync('static/app.js','utf8');
assert.match(app,/decision-fullpage/);
assert.match(app,/m09-reference/);
assert.match(app,/decision-05/);
const all=buildDecisionDataset();
assert.equal(all.metrics.length,115);
assert.equal(all.source_meta.coverage.total,115);
assert.equal(all.source_meta.coverage.computed,15);
assert.equal(all.source_meta.coverage.missing,100);
assert.equal(all.groups.length,11);assert.equal(all.analysis.length,22);
assert.equal(all.rules.length,30);assert.equal(all.actions.length,24);
assert.equal(all.source_meta.source_boundary,'DEMO_SAMPLE_NON_GXP');
assert.doesNotMatch(all.source_meta.currency,/演示USD/);
assert.equal(all.metrics.filter(m=>m.status==='待接入').length,100);
assert.ok(all.metrics.every(m=>m.id && m.formula && m.analysis_steps && m.required_fields));
const po=all.metrics.find(m=>m.id==='KPI-03-01');assert.equal(po.status,'已计算');assert.ok(Number(po.value)>0);
const spend=all.metrics.find(m=>m.id==='KPI-01-01');assert.match(spend.unit,/币种未核/);
const evidence=buildDecisionEvidence({metric:'KPI-03-04'});assert.ok(evidence.calculation_contract.rows.length>0);
assert.ok(evidence.calculation_contract.numerator>=0);
const chosenSupplier=all.source_meta.options.suppliers[0];
const subset=buildDecisionDataset({supplier:chosenSupplier});
assert.equal(subset.source_meta.scope.supplier,chosenSupplier);
assert.ok(Number(subset.metrics.find(m=>m.id==='KPI-03-01').value) < Number(po.value));
for(const [kind,id] of [['metric','KPI-03-04'],['group','d03'],['analysis','1'],['rule','4'],['action','6'],['dictionary','all'],['page','01'],['page','02'],['page','03'],['page','04'],['page','05'],['source','po'],['signal','delivery']]){
 const module=buildDecisionModule({kind,id}); assert.ok(module,`${kind}/${id}`);assert.ok(module.title);assert.ok(module.analysis_steps.length>2);assert.ok(module.conclusions.length>0);assert.ok(module.source_meta.scope);
 for(const m of module.metrics){assert.ok(m.formula);assert.ok(m.required_fields);assert.ok(m.analysis_steps)}
}
const module=buildDecisionModule({kind:'group',id:'d03'});
assert.ok(module.tables.some(t=>t.rows.length));
assert.ok(module.computed>0);
const source=buildDecisionExportFacts({supplier:chosenSupplier});
assert.ok(source.tables.po.every(p=>p.supplier_id===chosenSupplier));
assert.throws(()=>buildDecisionDataset({source:'enterprise'}),/受控企业快照未授权/);
const bytes=await exportDecisionModuleWorkbook({kind:'group',id:'d03'});
assert.equal(bytes.toString('ascii',0,2),'PK');assert.ok(bytes.length>10000);
fs.writeFileSync('/tmp/pharma-v2935-test-workbook.xlsx',bytes);
console.log('V2.9.35: 5 pages, navigation, 115 KPI data contracts, 15 sourced KPI, source scope, 13 module kinds, XLSX generated OK');
