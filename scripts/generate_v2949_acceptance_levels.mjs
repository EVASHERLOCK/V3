/** Three distinct levels prevent an offline green check from becoming GxP signoff. */
import fs from 'node:fs';
const root='docs/';
const get=f=>JSON.parse(fs.readFileSync(root+f,'utf8'));
const legacy=get('V2948_逐实际控件验收清单.json');
const browser=get('V2949_离线浏览器交互测试.json');
const index=get('V2949_统一引擎快速门禁.json');
const staticCalc=get('V2948_静态Excel重算逐格对账.json');
const kpi=get('V2949_绩效115KPI逐格重算.json');
const http=get('V2949_HTTP接口冒烟.json');
const source=get('V2948_来源公式结构测试.json');
const summary={
 version:'2.9.49',
 basis:'ACTUAL_EXECUTABLE_EVIDENCE_WITH_EXPLICIT_SCOPE; NOT_SIGNOFF',
 criteria:{function:'三入口存在、离线交互操作与HTTP资源检查；不代表正式站点浏览器全覆盖',simulated:'在指定模拟筛选数据集上进行Excel独立公式复算和来源分页验证；不代表企业数据库',enterprise:'真实部署、数据库全量审计、逐个浏览器点击、业务Owner签字、每项12证据均具备'},
 registered_actual_controls:legacy.components.length,
 formal_component_passed:legacy.components.filter(x=>x.status==='PASS').length,
 canonical_metric_definitions:index.canonical_metric_definitions,
 tiers:[
  {id:'FUNCTION_TESTED',status:browser.failures.length||http.errors.length?'BLOCKED':'SCOPED_PASS',boundary:'14 iframe injected DOM + 22 running Node HTTP paths only; 217 historical components not live-clicked',iframe_execution_pages:browser.execution.length,iframe_decision_pages:browser.decision.length,offline_execution_panels:browser.execution.reduce((n,p)=>n+p.panels,0),offline_decision_entry_positions:browser.decision.reduce((n,p)=>n+p.entry_groups,0),http_smoke_checks:http.checks.length},
  {id:'SIMULATED_RECONCILED',status:kpi.failures.length||staticCalc.failures.length?'BLOCKED':'SCOPED_PASS_WITH_UNVERIFIED_INDICATOR',boundary:'SUP-001 static filtered samples + deterministic simulated source, not all filters or enterprise data',decision_metric_formula_matches:kpi.match,decision_metric_formula_total:kpi.formula_rows,execution_cell_formula_matches:staticCalc.summary.derived_cell_matches,execution_metric_aggregations:staticCalc.summary.kpi_aggregations_reconciled,execution_metric_unverified:staticCalc.summary.unverified_aggregations,simulated_tables:source.summary.tables_ok,simulated_rows:source.summary.table_rows},
  {id:'ENTERPRISE_BUSINESS_SIGNED',status:'BLOCKED',reason:['217 legacy modules still lack live deployment end-to-end click evidence','585 control-level formal evidence sets still unverified','No ERP/QMS real full-table connection, provenance or snapshots','No business-owner sign-off']}
 ],
 officially_accepted:false,
};
if(summary.registered_actual_controls!==585||summary.formal_component_passed!==0||summary.tiers[0].status!=='SCOPED_PASS'||summary.tiers[1].status!=='SCOPED_PASS_WITH_UNVERIFIED_INDICATOR')throw Error('Unexpected evidence state, review acceptance levels');
fs.writeFileSync(root+'V2949_分层验收与剩余工作.json',JSON.stringify(summary,null,2)+'\n');
console.log('V2949 acceptance levels:',summary.tiers.map(x=>x.id+'='+x.status).join('; '));
