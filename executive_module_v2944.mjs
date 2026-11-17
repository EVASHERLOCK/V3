/** V2.9.44: management-readable explanation computed from the same module trace.
 * Does NOT claim that UI-only rows are audited enterprise records. */
const c=i=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const glossary=[
 ['PO','Purchase Order：采购订单，按订单号与物料、供应商、项目连接'],
 ['RFQ','Request for Quotation：询价，比较候选供应商报价、交期及合规条件'],
 ['OTD','On-Time Delivery：准时交付比例；分子为准时行数，分母为有效交期行数'],
 ['OTIF','On-Time In-Full：按时且足量到货比例，不可将 OTD 直接当作 OTIF'],
 ['PPV','Purchase Price Variance：采购价差；须区分单位价差和金额加权价差'],
 ['CAPA','Corrective and Preventive Action：纠正预防措施，关闭需独立有效证据'],
 ['QMS','Quality Management System：质量管理体系，展示信号不等于质量批准'],
 ['RA','Regulatory Affairs：注册法规事务；模拟旗标不代表真实批准'],
 ['QA','Quality Assurance：质量保证；模拟状态不等于正式签核'],
 ['ASN','Advance Shipping Notice：发运预通知，用于与订单及收货匹配'],
 ['GMP','Good Manufacturing Practice：药品生产质量管理规范'],
 ['KPI','Key Performance Indicator：关键绩效指标，需确定统计对象、期间和单位'],
 ['supplier_id','供应商统一主键，用于跨合同、订单、发运和付款筛选'],
 ['material_id','物料统一主键，不同计量单位不得直接相加'],
 ['project_id','项目统一主键，支持项目采购成本与交付归因'],
 ['金额','需要币种、单价单位和期间口径；未标明币种不能默认 USD'],
 ['数量','需区分订购量、发运量、收货量及合格放行量'],
 ['状态','根据事件和业务流程定义；展示标签不是审批事实']
];
const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
function derived(t,i){
 const hs=Array.from({length:Math.max(1,Math.min(24,(t.headers||[]).length,...(t.rows||[]).map(r=>r.length)))},(_,j)=>t.headers?.[j]||`列${j+1}`),norm=hs.map(h=>String(h).toLowerCase().replace(/\s/g,''));
 const find=regex=>norm.findIndex(h=>regex.test(h));
 const qty=find(/数量|qty|ordered_qty|采购量/),price=find(/单价|unit_price|price_usd|usd\/kg/);
 const score=find(/评分|score|得分/),weight=find(/权重|weight/);
 const act=find(/实际|actual/),base=find(/目标|基准|预算|target|baseline/);
 const modes=[];
 if(qty>=0&&price>=0&&qty!==price)modes.push({name:'金额=数量×单价',left:qty,right:price,kind:'multiply',explanation:`${hs[qty]} × ${hs[price]}，仅当数量和单价口径兼容时成立`});
 if(score>=0&&weight>=0&&score!==weight)modes.push({name:'加权贡献=得分×权重',left:score,right:weight,kind:'weighted',explanation:`${hs[score]} × ${hs[weight]}（权重大于1时按百分数转换）`});
 if(act>=0&&base>=0&&act!==base)modes.push({name:'差额=实际−目标',left:act,right:base,kind:'difference',explanation:`${hs[act]} − ${hs[base]}`});
 const rows=(t.rows||[]).slice(0,800).map((values,k)=>({excel_row:4+k,values,derived:modes.map((m,j)=>{
 const a=`${c(m.left)}${k+4}`,b=`${c(m.right)}${k+4}`;
 const expression=m.kind==='multiply'?`${a}*${b}`:m.kind==='weighted'?`${a}*IF(ABS(${b})>1,${b}/100,${b})`:`${a}-${b}`;
 const formula=`=IF(AND(ISNUMBER(${a}),ISNUMBER(${b})),${expression},"")`;
 const x=numeric(values[m.left]),y=numeric(values[m.right]);
 const calculated=x===null||y===null?null:m.kind==='multiply'?x*y:m.kind==='weighted'?x*(Math.abs(y)>1?y/100:y):x-y;
 return {name:m.name,cell:`${c(hs.length+j)}${4+k}`,formula,result:calculated,explanation:m.explanation};
 })}));
 const numerical=hs.map((h,j)=>({header:String(h),index:j,column:c(j),values:(t.rows||[]).map(row=>numeric(row[j])).filter(x=>x!==null)})).filter(col=>col.values.length);
 const totals=numerical.map(n=>({column:n.column,name:n.header,count:n.values.length,sum:n.values.reduce((a,b)=>a+b,0),formula:`=SUM('${`模块表${i+1}`}'!${n.column}4:${n.column}${Math.max(4,3+(t.rows||[]).length)})`,meaning:'仅为当前可见数字列求和；不能自动认作金额或跨单位业务总量'}));
 return {title:t.title,headers:hs,row_count:t.row_count??t.rows?.length??0,sheet:`模块表${i+1}`,rows,modes,totals};
}
export function executiveModule(report){
 const tables=(report.tables||[]).map(derived);
 const keys=[report.title,...tables.flatMap(x=>x.headers),...(report.metrics||[]).map(x=>x.label),...(report.narratives||[])].join(' ').toLowerCase();
 const terms=glossary.filter(([term])=>keys.includes(term.toLowerCase())||['supplier_id','material_id','project_id','KPI'].includes(term));
 const known=new Set(terms.map(t=>t[0].toLowerCase()));
 const definition=name=>{const a=String(name).toLowerCase();if(/_id$|编号|代码/.test(a))return '业务关联标识：用于关联记录和查找明细，不能参与求和';
  if(/date|日期|月份|期间/.test(a))return '业务发生或统计期间字段：必须先统一时间范围再计算';
  if(/price|单价|成本/.test(a))return '价格或成本变量：先核对币种、税率、计量单位和基准口径';
  if(/amount|金额|spend|费用/.test(a))return '金额变量：先核对币种、是否含税及来源交易单据';
  if(/qty|数量|收货|库存/.test(a))return '数量变量：明确订购、发运、收货、放行等业务阶段';
  if(/rate|比例|率|percent/.test(a))return '比率变量：必须明确分子、分母、异常值与单位';
  if(/status|状态|risk|风险/.test(a))return '状态或风险维度：应根据事件记录和已批准的规则分类';
  if(/score|评分|权重/.test(a))return '评分或权重变量：需确认评分区间、权重是否归一';
  return '当前模块的原始展示字段；具体业务口径依赖同名来源列与数据字典';};
 for(const header of tables.flatMap(t=>t.headers).map(String))if(header.trim()&&!known.has(header.toLowerCase())){terms.push([header,definition(header)]);known.add(header.toLowerCase())}
 const narrativeAnalysis=(report.narratives||[]).map((p,i)=>({number:i+1,text:p,inputs:(report.metrics||[]).map(m=>`${m.label}=${m.result??'不可计算'} ${m.unit||''}`),method:'先检查上述变量的期间、单位、明细和计算公式；再与本模块目标/阈值比较。',conclusion:'原文属于展示层分析或建议；没有专属阈值时不能把相关性解释为已证实的根因。'}));
 const steps=[`确定统计范围：页面 ${report.route}，模块「${report.title}」，查询条件 ${JSON.stringify(report.scope||{})}；将 UI 展示快照和原始源行分开。`];
 const calculations=[];
 for(const m of report.metrics||[]){
  const detail=`${m.label}（${m.metric_id}）：公式 ${m.formula||'业务公式待确认'}；分子 ${m.numerator??'不适用/缺失'}；分母 ${m.denominator??'不适用/缺失'}；计算值 ${m.result??'无可复算值'} ${m.unit||''}；${m.rows?.length||0} 条可核查源行。`;
  steps.push(detail);calculations.push({name:m.label,id:m.metric_id,formula:m.formula||'',numerator:m.numerator,denominator:m.denominator,result:m.result,unit:m.unit,source:m.source_class,source_rows:m.rows?.length||0});
 }
 for(const t of tables){steps.push(`展示表「${t.title}」：共 ${t.row_count} 行；页面当前提交 ${t.rows.length} 行用于逐格核对，源行不可视为已签核企业记录。`);
  for(const mode of t.modes)steps.push(`逐行计算「${mode.name}」：${mode.explanation}；请对照表内 Excel 单元格公式。`);
  for(const total of t.totals.slice(0,10))steps.push(`数值列「${total.name}」：Excel ${total.formula}；可见数字 ${total.count} 个，求和 ${Number(total.sum.toFixed(5))}，仅为同列核验。`);
 }
 if(!report.metrics?.length&&!tables.some(t=>t.modes.length))steps.push('本模块没有可靠匹配的业务指标或可判定的逐行计算字段。仍展示所有可读原始列和变量含义；不把空缺证据编造为业务公式。');
 const analysis=(report.actions||[]).map(a=>({name:a.title,inputs:a.inputs||[],thresholds:a.thresholds||[],reason:a.rationale,conclusion:a.decision,conditions:a.conditions||[],status:a.status}));
 for(const a of analysis){steps.push(`决策分析「${a.name}」：先核查 ${a.inputs.map(x=>x.label||x.metric_id).join('、')||'尚无绑定指标'}，再比较阈值 ${a.thresholds.map(x=>`${x.field} ${x.operator} ${x.value}`).join('、')||'尚未确认'}；最后根据规则解释「${a.reason||'无已验证原因'}」。`)}
 const explanation=analysis.length?'结论按各规则逐一展示计算输入、阈值与行动建议；模拟信号不得当作真实业务审批。':calculations.length?'计算结果来自所列公式和源行；业务判断还需要批准的目标阈值，不能仅凭结果推断根因。':'当前只可对显示字段做定义与算术检查；尚无充分的因果证据支持战略结论。';
 return {version:'EXECUTIVE_TRACE_V2944',scope:report.scope,calculations,tables,terms,steps,analysis,narrativeAnalysis,explanation,source_note:'以下逐格公式对应下载 Excel 的「模块表N」；未加工原始字段是来源值而不是 Excel 计算公式。模拟来源不等于真实企业/GxP记录。'};
}
