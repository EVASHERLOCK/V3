/** V2.9.28 mandatory module-level evidence: per-component source calculations,
 * visible-row snapshot and attributable narrative. The client DOM is NEVER
 * claimed to be a validated ERP/QMS record. */
import {exportMetricWorkbook,metricReport,METRICS} from './metric_registry_v2921.mjs';
import {createWorkbook} from './formula_workbook.mjs';
import {executiveModule} from './executive_module_v2944.mjs';
import {actionReport,ACTIONS} from './analysis_rules_v2922.mjs';
import {resolveComponentLineage,assessDisplayedTables,auditNarrativeParagraphs} from './component_lineage_v2929.mjs';
import {reconcileModule} from './component_reconciliation_v2930.mjs';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {sourcingFacts} from './sourcing_domain_v2921.mjs';

const cut=(v,len=240)=>String(v??'').slice(0,len).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const safeScalar=v=>{if(typeof v==='number')return Number.isFinite(v)?v:null;return cut(v,600)};
const cleanRow=a=>(Array.isArray(a)?a:[]).slice(0,24).map(safeScalar);
const formula=s=>({formula:s});
const column=i=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const isValidId=v=>/^(SRC\.[A-Z_0-9.]+|ACT\.[A-Z_0-9.]+)$/.test(v);
const isNumeric=v=>typeof v==='number'&&Number.isFinite(v);

export function sanitizeModuleInput(body={}){
 const route=cut(body.route,48),title=cut(body.title,150);
 if(!/^[a-z][a-z0-9-]{0,40}$/.test(route)||!title)throw Error('非法模块路由或标题');
 const tables=(Array.isArray(body.tables)?body.tables:[]).slice(0,16).map((t,i)=>({
  title:cut(t.title||`表格 ${i+1}`,110),
  headers:cleanRow(t.headers).map(x=>cut(x,120)),
  rows:(Array.isArray(t.rows)?t.rows:[]).map(cleanRow),
  row_count:Number.isSafeInteger(t.row_count)?t.row_count:undefined,
  source_scope:cut(t.source_scope||body.source_scope||'VISIBLE_DOM_ONLY',80),
  full_database_verified:false,
  scope:cut(t.scope,120)
 }));
 const metrics=[...new Set((Array.isArray(body.metrics)?body.metrics:[]).filter(x=>typeof x==='string'&&isValidId(x)).slice(0,24))];
 const actions=[...new Set((Array.isArray(body.actions)?body.actions:[]).filter(x=>typeof x==='string'&&isValidId(x)).slice(0,12))];
 return {route,title,group_title:cut(body.group_title,140),component_id:cut(body.component_id||`${route}.${title}`,145),tables,metrics,actions,
  figures:(Array.isArray(body.figures)?body.figures:[]).slice(0,80).map(x=>({label:cut(x.label,100),value:cut(x.value,100),metric_id:cut(x.metric_id,120),unit:cut(x.unit,24),snapshot_id:cut(x.snapshot_id,100),scope:x.scope&&typeof x.scope==='object'?Object.fromEntries(['supplier','material','year','as_of'].map(k=>[k,cut(x.scope[k],100)])):null})),
  narratives:(Array.isArray(body.narratives)?body.narratives:[]).slice(0,48).map(x=>cut(x,700)),
  charts:(Array.isArray(body.charts)?body.charts:[]).slice(0,16).map((c,i)=>({title:cut(c.title||`图表${i+1}`,130),chart_type:cut(c.chart_type,40),source_hint:cut(c.source_hint,200),series:(Array.isArray(c.series)?c.series:[]).slice(0,180).map(y=>({label:cut(y.label,140),value:cut(y.value,140),element:cut(y.element,32),position:cut(y.position,90),metric_id:cut(y.metric_id,120),group_dimension:cut(y.group_dimension,32),group_key:cut(y.group_key,160),unit:cut(y.unit,24),snapshot_id:cut(y.snapshot_id,100),scope:y.scope&&typeof y.scope==='object'?Object.fromEntries(['supplier','material','year','as_of'].map(k=>[k,cut(y.scope[k],100)])):null,source_ids:(Array.isArray(y.source_ids)?y.source_ids:[]).slice(0,1000).map(z=>cut(z,90))}))})),
  context:cut(body.context,160),as_of:/^20\d{2}-\d{2}-\d{2}$/.test(body.as_of||'')?body.as_of:null};
}

export function buildModuleTrace(body,{scope={},published=[],factsOverride=null}={}){
 const input=sanitizeModuleInput(body);
 const finalScope={...scope,...(input.as_of?{as_of:input.as_of}:{})};
 const contract=resolveComponentLineage(input);
 const ids=contract.metrics.filter(id=>Object.hasOwn(METRICS,id));
 const actionIds=contract.actions.filter(id=>Object.hasOwn(ACTIONS,id));
 const metrics=ids.map(id=>metricReport(id,{scope:finalScope,published,factsOverride}));
 const actions=actionIds.map(id=>actionReport(id,{scope:finalScope,published,factsOverride}));
 const rows=input.tables.flatMap(t=>t.rows).length;
 const tableAudits=assessDisplayedTables(input.tables);
 const narrativeAudits=auditNarrativeParagraphs(input,actions,metrics,contract);
 const recomputable=metrics.filter(r=>r.result!==null&&r.result!==undefined&&!['INSUFFICIENT_SOURCE','MISSING_LINEAGE','REQUIRES_SCOPE'].includes(r.status));
 const steps=[];
 steps.push(`1. 固定范围：${input.route} / ${input.title}；${JSON.stringify(finalScope)}。保留本模块 ${input.tables.length} 张展示表、${rows} 条可见表格行和 ${input.figures.length} 个数值标记。`);
 if(contract.methods.length)for(const [i,m] of contract.methods.entries())steps.push(`领域计算方法 ${i+1}：${m}`);
 if(metrics.length){for(const [i,r] of metrics.entries())steps.push(`${i+2}. ${r.label||r.metric_id}：${r.formula||'未登记计算公式'}。分子 ${r.numerator??'缺少来源'}，分母 ${r.denominator??'不适用/缺少来源'}，当前来源复算 ${r.result??'证据不足'} ${r.unit||''}；来源 ${r.source_class||'未知'}；有效明细 ${r.rows?.length||0} 行。`)}
 else steps.push(contract.binding_status==='NO_BUSINESS_CALC_REQUIRED'?'2. 此部分是操作或筛选控件：没有独立的业务计算结果，列出当前配置和操作日志证据即可。':'2. 本模块尚无可确认匹配的服务端计算指标；展示值不能当作已经完成的可复算财务/质量指标。');
 if(/\bOTD\s*[×x*]\s*PPV|PPV\s*[×x*]\s*OTD/i.test(input.title))steps.push('交叉矩阵说明：OTD = 准时PO行数/有效交期PO行数；PPV = 采购价差金额/基准采购金额。两者是不同坐标轴，不应把OTD与PPV相乘作为业务得分。');
 steps.push(`下一步核验：${actions.length?'规则结论必须逐项检查下面的输入、阈值和证据。':'尚无已匹配的独立决策规则；文字描述只作为待复核假设，不能推断因果或生成GMP结论。'}`);
 const decisions=actions.map(a=>({title:a.title||a.action_id,status:a.status,decision:a.decision,rationale:a.rationale,inputs:a.inputs||[],thresholds:a.thresholds||[],conditions:a.conditions||[],missing:a.missing||[],source_boundary:a.source_boundary}));
 const displayReconciliations=input.figures.map(f=>{
  const raw=String(f.value||'').replace(/[,，\s]/g,'');
  const m=raw.match(/^([+-]?\d+(?:\.\d+)?)\s*(%|USD|美元|家|条|笔|次)?$/i);
  const ui=m?Number(m[1]):null;
  const label=String(f.label||'');
  const direct=[[/\bOTD\b|准时交付率/i,'SRC.PO.OTD'],[/\bPPV\b|采购价格偏差率/i,'SRC.PO.PPV'],[/采购总金额|采购支出金额|来源采购金额/i,'SRC.PO.SPEND'],[/延期率/i,'SRC.PO.LATE_RATE'],[/候选供应商总数/i,'SRC.CANDIDATE.TOTAL']].find(([re])=>re.test(label));
  const r=direct?metrics.find(x=>x.metric_id===direct[1]):null;
  const compatible=!!(r&&ui!==null&&r.result!==null&&r.result!==undefined&&(!m[2]||m[2]==='%'&&r.unit==='%'||m[2]==='USD'&&r.unit==='USD'||m[2]==='家'&&r.unit==='家'));
  return {label,value:f.value,display_number:ui,metric_id:direct?.[1]||'',source_result:compatible?r.result:null,delta:compatible?ui-r.result:null,status:compatible?(Math.abs(ui-r.result)<=0.15?'SAME_VALUE_SCOPE_NOT_VERIFIED':'DIFFERENT_UI_AND_SOURCE_NEEDS_SCOPE_CHECK'):'UNBOUND_OR_UNCOMPARABLE',boundary:'不满足来源期间、筛选和单位同一性时，不允许根据数值相近宣称正式对账成功'};
 });
 const missing=[...(metrics.length||contract.binding_status==='NO_BUSINESS_CALC_REQUIRED'?[]:['本模块缺少正式绑定的指标定义']),...metrics.filter(r=>r.result==null).map(r=>`${r.metric_id}: ${r.missing?.join('；')||'来源数据不足'}`),...actions.filter(a=>['INSUFFICIENT_EVIDENCE','UNREGISTERED_ANALYSIS'].includes(a.status)).map(a=>`分析规则 ${a.title}: ${a.missing?.join('；')||'输入指标、阈值或来源尚不完整'}`),...(actions.length?[]:input.narratives.length?['显示的文字结论尚无专属已验证规则：不能据此声称已定位根因']:[])];
 if(input.charts.some(x=>!x.series.length))missing.push('部分图表没有机器可读的原始点值；请接入图表序列或受控来源表，不能从像素坐标推算采购/质量数据');
 if(contract.binding_status==='NO_BUSINESS_FORMULA_MATCH')missing.push('该模块尚无已确认的业务指标计算契约；已保留当前表格与图表显示证据，但不能宣称完成业务复算');
 const response={schema:'MODULE_TRACE_V2928',traceability_version:'V2930',component_id:input.component_id,route:input.route,title:input.title,scope:finalScope,source_class:factsOverride?'RELEASED_ENTERPRISE_NON_GXP':'V08_DEMO / UNVERIFIED_PRESENTATION',status:missing.length?'PARTIAL_EVIDENCE':contract.binding_status==='NO_BUSINESS_CALC_REQUIRED'?'NO_CALCULATION_REQUIRED':'SOURCE_METRICS_RECOMPUTABLE',metrics,actions:decisions,steps,missing,figures:input.figures,display_reconciliations:displayReconciliations,tables:input.tables,charts:input.charts,table_audits:tableAudits,narrative_audits:narrativeAudits,contract,contextual_metrics:contract.contextual_metrics,narratives:input.narratives,summary:{matched_metrics:metrics.length,computed_metrics:recomputable.length,matched_rules:actions.length,displayed_rows:rows,table_count:input.tables.length,chart_count:input.charts.length,narrative_count:input.narratives.length,business_contract_count:contract.contracts.length},boundary:'模块画面数值属于 UI 展示快照；仅带原始来源行及可复算指标 ID 的数据才属于服务端校验来源。无记录不能按0，DEMO不等于真实企业/GxP证据。'};
 // Distinguish independent source recalculation from matching a UI value.
 // The browser's posted numbers and legacy SVG text are NOT trusted facts.
 const facts=factsOverride||sourcingFacts(enterpriseAnalysis({}),{filters:finalScope,published});
 const snapshot=factsOverride?factsOverride.scope?.snapshot_id||null:'V08_DEMO';
 response.reconciliation=reconcileModule(response,input,{facts,scope:finalScope,enterprise:!!factsOverride,snapshot});
 response.display_reconciliations=response.reconciliation.figures;
 response.executive=executiveModule(response);
 if(response.reconciliation.status!=='PASS')response.missing.push(`V2930严格对账：${response.reconciliation.status}；${response.reconciliation.summary.display_unverified} 个未验证显示数值，${response.reconciliation.summary.charts_unverified} 个图表未完成原始序列对账。`);
 if(response.reconciliation.status==='FAIL')response.status='RECONCILIATION_FAILED';
 return response;
}

function sourceTableSheet(t,index){
 const columns=Math.max(1,Math.min(24,t.headers.length,...t.rows.map(x=>x.length)));
 const header=Array.from({length:columns},(_,i)=>cut(t.headers[i]||`列${i+1}`,100));
 const headNorm=header.map(x=>String(x).toLowerCase().replace(/\s/g,''));
 const find=patterns=>headNorm.findIndex(x=>patterns.some(re=>re.test(x)));
 const qty=find([/数量/,/qty/,/ordered_qty/,/采购量/]);
 const unit=find([/单价/,/unit_price/,/price_usd/,/usd\/kg/]);
 const score=find([/评分/,/score/,/得分/]);
 const weight=find([/权重/,/weight/]);
 const act=find([/实际/,/actual/]),target=find([/目标/,/基准/,/预算/,/target/,/baseline/]);
 const calcModes=[];
 if(qty>=0&&unit>=0&&qty!==unit)calcModes.push(['multiply','金额=数量×单价',qty,unit]);
 if(score>=0&&weight>=0&&score!==weight)calcModes.push(['weighted','贡献=评分×归一权重',score,weight]);
 if(act>=0&&target>=0&&act!==target)calcModes.push(['difference','差额=实际−目标',act,target]);
 const formulaName=calcModes.map(x=>x[1]).join('；');
 const raw=t.rows.map(x=>Array.from({length:columns},(_,i)=>{const v=x[i];return v===undefined?'':v}));
 const records=raw.map((r,i)=>{
  const k=i+4;
  for(const [kind,,left,right] of calcModes){
   const a=`${column(left)}${k}`,b=`${column(right)}${k}`;
   if(kind==='multiply')r.push(formula(`IF(AND(ISNUMBER(${a}),ISNUMBER(${b})),${a}*${b},"")`));
   else if(kind==='weighted')r.push(formula(`IF(AND(ISNUMBER(${a}),ISNUMBER(${b})),${a}*IF(ABS(${b})>1,${b}/100,${b}),"")`));
   else r.push(formula(`IF(AND(ISNUMBER(${a}),ISNUMBER(${b})),${a}-${b},"")`));
  }
  return r;
 });
 const ext=calcModes.length,last=3+records.length;
 const foot=Array.from({length:columns+ext},()=>null);
 foot[0]='显示记录数（公式）';foot[1]=records.length?formula(`COUNTA(A4:A${last})`):0;
 if(columns>2)foot[2]='仅核对本页可见记录，不代表企业完整源数据';
 for(let c=0;c<calcModes.length;c++){const col=column(columns+c);foot[columns+c]=records.length?formula(`SUM(${col}4:${col}${last})`):0;}
 return {name:`模块表${index+1}`,rows:[[`模块来源表 ${index+1}｜${t.title}`],[`UI 展示快照，不等同企业ERP/QMS；${formulaName||'未确认适用的逐行业务公式'}`],[...header,...calcModes.map(x=>'Excel '+x[1])] ,...records,foot],widths:Array.from({length:columns+ext},(_,i)=>i===0?28:22)};
}
export function exportModuleTraceWorkbook(body,options={}){
 const report=buildModuleTrace(body,options),input=sanitizeModuleInput(body);
 const H=(name,columns,rows)=>({name,rows:[[name],['本模块专属证据包；UI快照与服务端来源必须分开核验'],columns,...rows]});
 const narrative=H('文字分析依据',['类型','序号','内容','状态'],[
  ...report.steps.map((s,i)=>['计算/分析步骤',i+1,s,'含来源口径']),
  ...report.actions.flatMap((a,i)=>[...((a.inputs||[]).map((m,j)=>['数据输入与计算公式',`${i+1}.${j+1}`,`${a.title} / ${m.metric_id} = ${m.value??'证据不足'} ${m.unit||''}；公式：${m.formula||'缺少定义'}；分子：${m.numerator??'缺失'}；分母：${m.denominator??'不适用/缺失'}；来源：${m.source_class||'未知'}`,m.status||a.status])),...((a.thresholds||[]).map((t,j)=>['规则阈值',`${i+1}.${j+1}`,`${t.field} ${t.operator} ${t.value}`,a.status])),['决策触发',i+1,`${a.title}：${a.decision}`,a.status],['决策条件',i+1,(a.conditions||[]).join('；'),a.status],['数据核查',i+1,a.rationale,a.status]]),
  ...input.narratives.map((s,i)=>['界面原始分析文字',i+1,s,report.actions.length?'需与上述触发规则逐条核对':'缺少已批准的指标/阈值，不可确认为真实根因']),
  ...report.missing.map((s,i)=>['未满足的证据',i+1,s,'不得据此下决策'])
 ]);
 const primary=H('模块概览',['字段','值','说明'],[
  ['模块标题',report.title,'所点模块独立导出'],['模块ID',report.component_id,'不同模块唯一'],['路由',report.route,'共享导航范围'],['来源',report.source_class,'DEMO/UI不得与正式来源混算'],['已匹配指标',report.summary.matched_metrics,'只统计有定义ID的指标'],['已复算指标',report.summary.computed_metrics,'仅本筛选条件与来源'],['规则分析',report.summary.matched_rules,'必须人工确认实际根因'],['展示表格数',report.summary.table_count,'UI可见快照'],['展示行数',report.summary.displayed_rows,'不是企业源记录总数'],['当前范围',JSON.stringify(report.scope),'记录时点固定'],['证据状态',report.status,'显示并不等于可复算'],['关键警示',report.boundary,'无完整来源禁止冒充']]);
 const dictionary=H('模块指标字典',['Metric_ID','名称','服务端状态','源重算结果','单位','分子','分母','公式定义','权重','来源级别','来源行数'],report.metrics.map(r=>[
  r.metric_id,r.label,r.status,r.result??'证据不足',r.unit,r.numerator??'',r.denominator??'',r.formula||'未登记',JSON.stringify(r.weights||[]),r.source_class,r.rows?.length||0
 ]).concat(report.metrics.length?[]:[['NOT_REGISTERED',report.title,'未登记','不可推定','','','','本模块未找到可证明的公式，需业务负责人补充真实数据与定义','','仅UI展示',0]]));
 const figures=H('界面数值',['标签','原始显示文本','来源等级'],input.figures.map(x=>[x.label,x.value,'UI快照，可能含演示/情景数据']));
 const figureReconciliation=H('界面与来源对账',['标签','界面原值','界面数值','指标ID','服务端来源值','界面-服务端','对账状态','适用限制'],report.display_reconciliations.map((f,i)=>[f.label,f.value,f.display_number??'不可解析',f.metric_id||'尚未绑定',f.source_result??'无同口径值',f.source_result!==null&&f.display_number!==null?formula(`IF(AND(ISNUMBER(C${4+i}),ISNUMBER(E${4+i})),C${4+i}-E${4+i},"")`):'不可对账',f.status,f.boundary]));

 const strict=report.reconciliation;
 const independent=H('源行独立复算',['Metric ID','独立来源校验状态','引擎结果','独立复算值','差额','容差','来源数量','计算说明','版本 / 失败原因'],strict.source_metrics.map((m,i)=>[
   m.metric_id,m.status,m.engine_result??'',m.independent_result??m.result??'',m.difference??'',m.tolerance??'',m.source_row_count??0,m.formula_validation||'',m.reason||''
 ]));
 const strictCharts=H('图表来源核验',['图表名称','可见点数','带来源行ID点数','状态','缺口说明'],strict.charts.map(c=>[c.title,c.point_count,c.source_ids_declared,c.status,c.reason]));
 const strictSummary=H('严格对账总览',['检查项','值','含义'],[
  ['来源级别',strict.mode,'DEMO不能视为企业ERP/QMS'],['企业发布快照',strict.snapshot_id||'无','必须审核发布并且哈希通过'],['严格对账结论',strict.status,'只要存在未验证内容就不能判全模块PASS'],['源指标独立复算数',strict.summary.source_metrics_recomputed,'仅表示源引擎和独立公式可核对'],['页面显示严格通过数',strict.summary.display_passed,'要求ID/范围/单位/快照一致'],['页面显示差异数',strict.summary.display_failed,'严格范围一致的情况下显示不符'],['页面显示未验证数',strict.summary.display_unverified,'包括缺少同范围元数据'],['原始序列未核验图表数',strict.summary.charts_unverified,'SVG文字不能替代完整图表数组'],['校验报告指纹',strict.report_digest,'针对当前数据和报告生成']]);
 const check=H('数据结构校验',['检查项','Excel计算单元格','说明'],[
  ['本模块来源表张数',input.tables.length,'这里只表示模块当前展示的原始表数量'],
  ['本模块待复算指标数',report.metrics.length-report.summary.computed_metrics,'无证据时不可填为业务数字'],
  ['已登记指标数（公式）',formula(`COUNTIF('模块指标字典'!A4:A${Math.max(4,3+report.metrics.length)},"SRC.*")`),'只核对指标定义行，非业务风险/绩效指标'],
  ['模块页面表格总行数',report.summary.displayed_rows,'只统计页面当前呈现的行']
 ]);

 const charts=H('图表数据点',['图表','标记类型','可见标签','可见数值','页面位置','来源级别','验证说明'],report.charts.flatMap(c=>c.series.map(d=>[c.title,d.element,d.label,d.value,d.position,'UI_CHART_SNAPSHOT','不能由像素坐标推定真实业务值；需要来源指标ID或原始序列'])).concat(report.charts.length&&!report.charts.some(c=>c.series.length)?[['未取得可读取序列','','','','','MISSING','请从图表生成器暴露原始数组，不可从绘图路径反推数值']]:[]));
 const tableMath=H('展示数据列核算',['表格','列名','类型','非空数字数','Excel数值求和','Excel均值','业务核算前置条件'],report.table_audits.flatMap((t,i)=>t.columns.map(c=>[
    `模块表${i+1}`,c.header,c.type,c.known_count,
    c.type==='NUMERIC'?formula(`SUM('模块表${i+1}'!${column(c.column_index)}4:${column(c.column_index)}${3+input.tables[i].rows.length})`):'不适用',
    c.type==='NUMERIC'?formula(`IFERROR(AVERAGE('模块表${i+1}'!${column(c.column_index)}4:${column(c.column_index)}${3+input.tables[i].rows.length}),"")`):'不适用',
    c.type==='NUMERIC'?'仅UI数值核查；无企业来源/单位/期间匹配不可用于正式汇总':'分类列只可作分组计数'
  ])));
 const reasoning=H('逐段文字分析',['序号','原始分析文字','所需指标','已算来源输入','绑定规则ID','规则判断结果','证据状态','数据→推断→结论'],report.narrative_audits.map(a=>[
   a.number,a.paragraph,a.metric_inputs.map(m=>m.metric_id).join('；'),a.metric_inputs.map(m=>`${m.metric_id}=${m.value??'证据不足'}`).join('；'),a.related_action_ids.join('；'),a.rule_result||'尚无独立规则',a.status,a.steps.join(' ｜ ')
 ]));
 const contract=H('组件计算契约',['字段','值','注意事项'],[
   ['规则匹配',report.contract.contracts.join('；')||'未匹配','属于算法映射，不构成该模块已完成业务验算'],
   ['绑定状态',report.contract.binding_status,'有匹配算法不代表具有真实原始数据'],
   ['业务计算方法',report.contract.methods.join('；')||'待业务负责人确认','复合指标需分别核算每一项'],
   ['候选上下文指标',report.contextual_metrics.join('；')||'无','此列不可作为当前组件的已验算指标'],
   ['表格可验证逐行演算',report.table_audits.flatMap(t=>t.calculations.map(c=>t.title+':'+c.expression)).join('；')||'无','仅页面可见输入校核'],
   ['图表可见数据点',report.charts.reduce((n,c)=>n+c.series.length,0),'仅UI数据点快照，非原始系统来源'],
   ['文字分析逐段覆盖',report.narrative_audits.length,'每段均列出指标或缺失原因']
 ]);
 const executive=report.executive;
 const managerSteps=H('管理层逐步文字解析',['步骤','计算/判断说明','口径'],executive.steps.map((x,i)=>[i+1,x,'模拟/页面可见记录；正式决策须复核来源']));
 const managerGlossary=H('变量术语解释',['变量或术语','业务定义'],executive.terms);
 const formulaIndex=H('逐格公式索引',['来源表','Excel计算单元格','业务公式','Excel真实公式','按当前可见输入重算','计算说明'],executive.tables.flatMap(t=>t.rows.flatMap(r=>r.derived.map(d=>[t.sheet,d.cell,d.name,d.formula,d.result??'输入非数字，无法计算',d.explanation]))));
 const paragraphAnalysis=H('原文逐段解释',['段落','显示分析原文','相关变量','分析步骤','结论边界'],executive.narrativeAnalysis.map(a=>[a.number,a.text,a.inputs.join('；'),a.method,a.conclusion]));
 const managerAnalysis=H('管理层结论与条件',['规则','输入变量','阈值','分析步骤','结论','证据状态'],executive.analysis.map(a=>[a.name,a.inputs.map(x=>x.label||x.metric_id).join('、'),a.thresholds.map(x=>`${x.field} ${x.operator} ${x.value}`).join('；'),a.reason,a.conclusion,a.status]).concat([['结论边界','','',executive.explanation,'SIMULATED不等于真实企业/GxP证据','需人工复核']]));
 const sheets=[primary,managerSteps,managerGlossary,formulaIndex,managerAnalysis,paragraphAnalysis,strictSummary,independent,strictCharts,dictionary,contract,narrative,reasoning,figures,figureReconciliation,charts,tableMath,check,...input.tables.map(sourceTableSheet)];

 // Unmatched modules must NOT silently export irrelevant PO/QMS rows or 97
 // unrelated KPI formulas. An informative workbook is more honest than a
 // fabricated business calculation.
 if(!report.metrics.length)return createWorkbook(sheets);
 // Known metric IDs retain their precise original evidence rows and real
 // Excel formulas, augmented with the selected module's unique visible inputs.
 return exportMetricWorkbook({scope:report.scope,metricIds:report.metrics.map(r=>r.metric_id),published:options.published||[],factsOverride:options.factsOverride||null,extraSheets:sheets});
}
