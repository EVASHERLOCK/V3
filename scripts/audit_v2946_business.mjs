/** V2.9.46: evidence-based route/business audit, never conflates a data-model pass with full UI acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {buildDecisionDataset} from '../decision_center_v2935.mjs';
import {buildExecutionDataset,metricForPage,PAGE_IDS,exportExecutionWorkbook} from '../procurement_execution_v2937.mjs';
import {validateAll} from '../sim_data_center_v2941.mjs';
import {buildModuleTrace,exportModuleTraceWorkbook} from '../module_traceability_v2928.mjs';
const ROOT=process.cwd(), read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const prior=JSON.parse(read('docs/V2945_正式放行审计.json'));
const app=read('static/app.js'),rows=[],errors=[];
const result=(route,fields)=>rows.push({route,...fields});
const metricValue=(m,records)=>{const numeric=x=>x!==''&&x!==null&&x!==undefined&&Number.isFinite(Number(x));const vs=records.map(r=>r[m.field]).filter(numeric).map(Number);if(m.op!=='count'&&vs.length!==records.length)return null;const sum=vs.reduce((a,b)=>a+b,0);const denom=m.denom_field?records.reduce((a,r)=>a+(numeric(r[m.denom_field])?Number(r[m.denom_field]):0),0):0;return m.op==='count'?records.length:m.op==='sum'?sum:m.op==='rate'||m.op==='avg'?sum/records.length:m.op==='ratio'?(denom?sum/denom:null):m.op==='sumif'?records.filter(r=>r[m.condition_field]===m.condition_value).reduce((a,r)=>a+(numeric(r[m.field])?Number(r[m.field]):0),0):null;};
function verify(condition,msg){if(!condition)errors.push(msg);return !!condition;}
const sim=validateAll();verify(sim.violation_count===0,'模拟数据库外键/业务校验不通过: '+sim.violation_count);
const decision=buildDecisionDataset({month:'all'});
verify(decision.metrics?.length===115,'绩效中心不是115项');
const metricIds=new Set();let completeKpi=0;
for(const metric of decision.metrics||[]){
 const ok=!!(metric.id&&metric.name&&metric.formula&&metric.required_fields&&Array.isArray(metric.analysis_steps)&&metric.analysis_steps.length>=3&&Number.isFinite(metric.value)&&metric.evidence?.source_table&&metric.evidence?.count>=0);
 if(ok)completeKpi++;
 verify(!metricIds.has(metric.id),'KPI重复ID: '+metric.id);metricIds.add(metric.id);
 if(!ok)errors.push('KPI公式或来源缺口: '+metric.id);
}
let executionKpis=0,executionSource=0, executionDisplayedEmptyCells=0;
const allPages=new Map();
for(const id of PAGE_IDS){
 const data=buildExecutionDataset({page:id}),page=data.pages.find(x=>x.id===id);
 allPages.set(id,{data,page});
 let valid=!!(page?.columns?.length&&data.rows?.length&&page.metrics?.length);
 const metricErrors=[];
 for(const m of page?.metrics||[]){
  const value=metricValue(m,data.rows);
  if(Number.isFinite(value)&&m.excel_formula&&m.explain)executionKpis++;
  else metricErrors.push(m.key);
 }
 for(const r of data.rows||[]){if(!r.source_id||!r.source_file||!r.project_id||!r.material||!r.supplier||!r.month){valid=false;}for(const col of [...(page?.columns||[]),...(page?.derived||[])])if(r[col.key]===null||r[col.key]===undefined||r[col.key]==='')executionDisplayedEmptyCells++;}
 if(valid)executionSource++;
 if(metricErrors.length)errors.push(`执行模块 ${id} 无完整KPI计算: ${metricErrors.join(',')}`);
}
// Verify cross-process transaction identity and arithmetic for one consistent common sample and all PO chains.
const by=id=>new Map(allPages.get(id).data.rows.map(x=>[x.po,x]));
const orders=allPages.get('orders').data.rows,shipments=by('shipments'),invoices=by('invoices'),payments=by('payments'),closing=by('closing');
let reconciled=0;
for(const po of orders){
 const s=shipments.get(po.po),i=invoices.get(po.po),p=payments.get(po.po),c=closing.get(po.po);
 const ok=!!(s&&i&&p&&c&&po.po_qty===s.ordered_qty&&s.received_qty===i.invoiced_qty&&Math.abs(i.invoice_total-i.invoiced_qty*i.invoice_price)<.025&&Math.abs(p.open_amount-(i.invoice_total-p.paid_amount))<.025&&Math.abs(c.payment_balance-p.open_amount)<.025);
 if(ok)reconciled++;else errors.push('PO跨表不一致 '+po.po);
}
// Twelve monthly cohorts and production-static snapshot: same numeric KPI results as live Node universe.
const months=[...new Set(orders.map(x=>x.month))].sort();
verify(months.length===12,'时间维度不是12个月: '+months.join(','));
let monthlyPassed=0;
for(const month of months){const monthly=buildDecisionDataset({month});if(monthly.metrics.length===115&&monthly.metrics.every(m=>Number.isFinite(m.value)))monthlyPassed++;else errors.push('绩效月度重算异常 '+month);}
let snapshotMatched=0;
const snapshotPath='dist/static/decision-center/snapshot_v2942.json';
if(fs.existsSync(snapshotPath)){
 const ss=JSON.parse(read(snapshotPath));const mapping=new Map(ss.metrics.map(m=>[m.id,m]));
 for(const m of decision.metrics){const p=mapping.get(m.id);if(p&&p.unit===m.unit&&Number(p.value)===Number(m.value))snapshotMatched++;else errors.push('静态发布与Node指标不一致 '+m.id);}
}else errors.push('构建后静态KPI快照缺失: '+snapshotPath);
// Report interface contract per active route; do not claim visual click pass without browser interaction.
for(const priorRow of prior.rows){
 const route=priorRow.route;let sourceState='NOT_FULLY_TESTED',calcState='NOT_FULLY_TESTED',UI='NOT_VERIFIED',excelState='NOT_VERIFIED',reason='仍需逐组件点击与对应来源/公式/Excel同值复算';
 let moduleCount=priorRow.legacy_components;
 if(route.startsWith('decision-')){
  const n=Number(route.split('-')[1]),match=app.match(new RegExp(`id:'${route}'[^}]*file:'([^']+)'`));
  const file=match&&path.join('static/decision-center',match[1]);
  sourceState=verify(!!file&&fs.existsSync(file),route+' 文件缺失')?'115_KPI_MODEL_VERIFIED':'MISSING_PAGE';
  calcState=completeKpi===115?'115_KPI_FORMULAS_VERIFIED':'PARTIAL';
  const html=file&&fs.existsSync(file)?read(file):'';
  UI=/全量计算依据和来源表/.test(html)&&/本模块公式/.test(html)?'THREE_GLOBAL_CONTROLS_IN_IFRAME':'INDEPENDENT_UI_NOT_SAME_THREE_CONTROLS';
  excelState='NODE_WORKBOOK_CONTRACT_TESTED_SEPARATELY';
  reason='115项指标数据层可计算，但五页独立UI未完成每图表、每分析文字及下载Excel的逐格比较';
 }else if(route.startsWith('exec-')){
  const n=Number(route.slice(-2)),id=PAGE_IDS[n],e=allPages.get(id),match=app.match(new RegExp(`id:'${route}'[^}]*file:'([^']+)'`));
  const file=match&&path.join('static/procurement-execution',match[1]);
  sourceState=e.data.rows.length>0&&fs.existsSync(file)?`LINKED_ROWS_${e.data.rows.length}`:'MISSING_DATA';
  calcState=e.page.metrics.every(m=>Number.isFinite(metricValue(m,e.data.rows)))?'KPI_FORMULAS_VERIFIED':'PARTIAL';
  const html=file&&fs.existsSync(file)?read(file):'';
  UI=/全量计算依据和来源表/.test(html)&&/本模块公式/.test(html)?'THREE_GLOBAL_CONTROLS_IN_IFRAME':'INDEPENDENT_UI_NOT_SAME_THREE_CONTROLS';
  excelState='NODE_WORKBOOK_CONTRACT_TESTED_SEPARATELY';
  reason='九页模拟数据及公式已检查；仍需每个小卡片的浏览器展开、逐格来源公式和下载对照';
 }else if(route==='sim-center'){
  sourceState=sim.violation_count===0?'DB_FK_VALIDATED':'FAILED';reason='数据中心主键关联通过；写入权限、删除保护、审计日志和导出仍需实际工作流/持久化验收';
 }else{
  sourceState=route==='m09-reference'?'REFERENCE_STATIC_RENDER_NOT_BROWSER_VERIFIED':'LEGACY_BI_COMPONENTS_REQUIRE_EVIDENCE';
 }
 result(route,{page_kind:priorRow.source,component_count:moduleCount,source_validation:sourceState,formula_contract:calcState,formula_button:UI,web_excel_cell_compare:excelState,full_business_acceptance:'NOT_VERIFIED',remaining_work:reason});
}
// Shared module trace business example: explicit cells and formula bytes, not just cosmetic DOM text.
const example={route:'overview',title:'PO逐笔总金额',component_id:'v2946.po.amount',metrics:['SRC.PO.SPEND'],tables:[{title:'示例PO',headers:['PO','数量','单价','金额'],rows:[['EX-001',5,20,100],['EX-002',8,13,104]]}],narratives:['先逐单计算，再按同币种加总；与预算对比需有批准的基准。']};
const trace=buildModuleTrace(example),formula=trace.executive?.tables?.[0]?.rows?.[0]?.derived?.[0]?.formula;
verify(formula==='=IF(AND(ISNUMBER(B4),ISNUMBER(C4)),B4*C4,"")','通用逐格公式地址不一致');
const wb=exportModuleTraceWorkbook(example);verify(wb?.subarray(0,2).toString()==='PK','通用Excel不是有效zip');
// Live XLSX exported for each of the nine pages under a small four-dimensional slice: avoid multi-MB/slow full export.
let workbooks=0;const workbookErrors=[];
for(const id of PAGE_IDS){
 const exampleRow=allPages.get(id).data.rows[0];
 try{
  const buffer=await exportExecutionWorkbook({page:id,month:exampleRow.month,project:exampleRow.project_id,supplier:exampleRow.supplier,material:exampleRow.material});
  if(buffer?.subarray(0,2).toString()==='PK')workbooks++;else workbookErrors.push(id+':无有效XLSX');
 }catch(e){workbookErrors.push(id+':'+e.message);}
}
for(const e of workbookErrors)errors.push('Excel '+e);
const audit={version:'2.9.46-business-audit',date:new Date().toISOString(),source_mode:process.env.PHARMA_DATA_MODE,route_count:rows.length,legacy_active_components:prior.active_legacy_components,kpis_decision_verified:completeKpi,kpi_months_passed:monthlyPassed,static_decision_kpi_matches:snapshotMatched,kpis_execution_verified:executionKpis,execution_pages_data_verified:executionSource,execution_displayed_cells_missing:executionDisplayedEmptyCells,execution_excel_generated:workbooks,execution_excel_scope:'九页各按一笔联合筛选来源生成真实XLSX（仅下载文件有效性，非所有单元格逐格核验）',po_chains_reconciled:reconciled,po_chains_total:orders.length,db_violations:sim.violation_count,known_browser_limitation:'ERR_BLOCKED_BY_ADMINISTRATOR: local HTTP URL cannot be opened by current Chromium harness; offline rendering cannot prove live server end-to-end.',release:'NOT_FULLY_VERIFIED',failure_count:errors.length,errors,rows};
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/V2946_全站业务级复核.json',JSON.stringify(audit,null,2)+'\n');
const keys=Object.keys(rows[0]);const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';fs.writeFileSync('docs/V2946_39页业务级核验.csv',[keys.map(quote).join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\n')+'\n');
const summary=`# V2.9.46 全站业务级复核（不得用数据层通过冒充UI正式放行）\n\n- 现行路由：${rows.length}。历史组件基线：${prior.active_legacy_components}。\n- 模拟数据库外键违规：${sim.violation_count}。\n- 绩效中心指标模拟计算契约：${completeKpi}/115；12个月独立指标计算：${monthlyPassed}/12；静态发布快照与Node值：${snapshotMatched}/115。\n- 采购执行指标模拟计算契约：${executionKpis}/56；9页带关联数据：${executionSource}/9。\n- 逐笔 PO→发运→发票→付款→关单核对：${reconciled}/${orders.length}。\n- 采购执行九页按当前来源小范围生成有效 Excel：${workbooks}/9（仅文件有效性，不表示逐格完全对账）。\n- 全站逐组件点击、公式面板、完整来源表、每格Excel同值、文字分析、筛选跳转、静态发布：**未取得39页全部真实浏览器证据；严格放行不得通过**。\n- 当前浏览器限制：${audit.known_browser_limitation}\n- 仍需解决的源代码问题：独立 iframe 没有统一三入口完整合同，部分历史模块只扫描800行可见DOM，不能称数据库全量。\n- 本次核验中遇到的异常：${errors.length} 项，详见 JSON。\n\n**结论：严格业务验收不通过，不能宣称零遗漏。** 数据层的通过项可作为下一轮修复的回归基线。\n`;
fs.writeFileSync('docs/V2946_全站业务级核验报告.md',summary);
console.log(`AUDIT V2.9.46: ${rows.length} routes, decision ${completeKpi}/115, static ${snapshotMatched}/115, months ${monthlyPassed}/12, execution ${executionKpis}/56, linked pages ${executionSource}/9, XLSX ${workbooks}/9, reconciled PO ${reconciled}/${orders.length}, missing displayed cells=${executionDisplayedEmptyCells}, errors=${errors.length}; release=${audit.release}`);
if(process.argv.includes('--strict'))process.exitCode=2;
