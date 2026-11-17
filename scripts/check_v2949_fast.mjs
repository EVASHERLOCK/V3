/* V2.9.49 fast compile-time safety gate; intentionally not business sign-off. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildAuditCatalog,REQUIRED_ENTRIES,ACCEPTANCE_LEVELS} from '../audit_registry_v2949.mjs';
import {buildDecisionModule} from '../decision_center_v2935.mjs';
const catalog=buildAuditCatalog(),disk=JSON.parse(fs.readFileSync('static/audit/metric_catalog_v2949.json','utf8'));
assert.deepEqual(disk,catalog,'The canonical metric model changed without regenerating its audit catalog');
assert.equal(catalog.decision_metric_count,115);assert.equal(catalog.execution_metric_count,56);
assert.deepEqual(REQUIRED_ENTRIES,['formula','sources','excel']);
assert.deepEqual(ACCEPTANCE_LEVELS,['FUNCTION_TESTED','SIMULATED_RECONCILED','ENTERPRISE_BUSINESS_SIGNED']);
const common=fs.readFileSync('static/audit/audit_ui_v2949.js','utf8');
for(const s of ['decisionControls','executionControls','data-audit','data-action','workbooks/'])assert.ok(common.includes(s),s);
let iframe=0;
for(const [group,names] of [['decision-center',['01_KPI总览','02_深度分析','03_智能预警','04_行动闭环','05_指标治理']],['procurement-execution',['00_询价与报价比对','01_合同核查','02_PO创建与比对','03_发运与到货','04_发票核对','05_付款与应付','06_退货与索赔','07_订单关闭与绩效','08_异常处理中心']]])for(const slug of names){const f=`static/${group}/${slug}.html`,html=fs.readFileSync(f,'utf8');assert.ok(html.includes('audit_ui_v2949.js'),f+' missing shared controls');iframe++}
assert.equal(iframe,14);
const decUI=fs.readFileSync('static/decision-center/lineage_entry_v2948.js','utf8');
for(const needle of ['offline_v2942.mjs','decisionModule(kind,id,q)','downloadOfflineWorkbook','data-source-page','企业来源接口不可用'])assert.ok(decUI.includes(needle),'offline audit fallback missing '+needle);
const execUI=fs.readFileSync('static/procurement-execution/assets/app.js','utf8');assert.ok(execUI.includes('PHARMA_AUDIT_UI.executionControls'));
const offline=fs.readFileSync('static/decision-center/offline_v2942.mjs','utf8');for(const needle of ['网页Excel逐格对账','术语及变量','sourceSheets','selectedIds','selection.kind'])assert.ok(offline.includes(needle),needle);
const node=fs.readFileSync('decision_center_v2935.mjs','utf8');assert.ok(!node.includes('rows:p.rows.slice(0,500)'));assert.ok(!node.includes('rows:found.slice(0,1000)'));
let tableCount=0;for(const [kind,id] of [['metric','KPI-01-01'],['analysis','1'],['rule','1'],['action','1'],['dictionary','1']]){const rep=buildDecisionModule({kind,id,supplier:'SUP-001',month:'all',material:'all',project:'all'});assert.ok(rep.metrics.length,kind);for(const t of rep.tables){assert.equal(t.count,t.rows.length,kind+':'+t.table+' incomplete snapshot');tableCount++}}
const summary={version:'2.9.49',control_source:'static/audit/audit_ui_v2949.js',iframe_pages:iframe,canonical_metric_definitions:catalog.metric_count,decision_metrics:catalog.decision_metric_count,execution_metrics:catalog.execution_metric_count,decision_source_tables_checked:tableCount,compile_gate:'PASS',simulated_formula_recalc:'SEPARATE_TEST',live_browser_http_e2e:'NOT_TESTED',enterprise_db:'NOT_CONNECTED',official_signoff:'PENDING',formal_business_acceptance:'BLOCKED'};
fs.writeFileSync('docs/V2949_统一引擎快速门禁.json',JSON.stringify(summary,null,2)+'\n');
console.log('V2949 quick structural gate PASS:',JSON.stringify(summary));
