/** V2.9.31 — screenshot-faithful Change Control / Global RA workbench.
 * Only displays document/filing/PO facts from the canonical EnterpriseV08 model.
 * Gantt segment positioning is a planning visualization, not signed stage evidence.
 * No QMS/RA/ASL approvals are inferred from this prototype. */
import {createWorkbook} from './formula_workbook.mjs';
import {enterpriseAnalysis} from './enterprise_v08.mjs';

const num=x=>Number(x)||0;
const date=x=>String(x||'').slice(0,10);
const validDate=x=>/^\d{4}-\d\d-\d\d$/.test(date(x));
const days=(x,y)=>validDate(x)&&validDate(y)?Math.round((Date.parse(date(x))-Date.parse(date(y)))/86400000):null;
const uniq=xs=>[...new Set(xs.filter(Boolean))];
const sum=(arr,f)=>arr.reduce((s,r)=>s+num(f(r)),0);
const csvFields=['supplier','material','month','change_type','status','scope','role','scheme'];
export const normalizeFilters=q=>Object.fromEntries(csvFields.map(k=>[k,String(q?.[k]||'all').slice(0,100)]));
const fit=(val,sel)=>sel==='all'||!sel||val===sel;
const statusGroup=c=>String(c.status).toLowerCase().includes('closed')?'closed':/RA|regulatory/i.test(c.status)?'ra':/QA/i.test(c.status)?'qa':'open';
const riskScore=(c,n,d)=>{const sev=String(c.severity||'').toUpperCase();const base=sev==='HIGH'?40:sev==='MEDIUM'?25:10;const age=Math.min(20,Math.max(0,Number(c.elapsed_days)||Math.max(0,days(d,c.opened_date)||0)));const markets=Math.max(0,n)*5;const gap=String(c.status).toLowerCase().includes('closed')?0:15;return {score:Math.min(100,base+age+markets+gap),base,age,markets,gap,formula:'风险分 = 严重度基础分(高40/中25/低10) + min(开放天数,20) + 5×受影响市场数 + 未关闭加15；上限100。管理优先级模型，非监管裁定。'};};
const typedDocs=[
 {name:'注册资料',items:[['DMF/CEP 变更申请','CEP|DMF'],['MAH 注册资料','Regulatory Support'],['CTD 3.3.S 章节','CTD']]},
 {name:'质量体系文件',items:[['SOP-PR-001 工艺变更流程','SOP'],['SOP-QA-007 变更评估流程','SOP'],['SOP-QC-012 验证管理','SOP'],['QMS 变更记录模板','Change Notification']]},
 {name:'技术 / 图纸文件',items:[['工艺流程图（PFD）','Process Flow'],['设备参数清单','Equipment'],['包装图纸','Packaging'],['物料清单（BOM）','BOM']]},
 {name:'合规 / 法规文本',items:[['ICH Q12','ICH Q12'],['EU GMP 附录 1','EU GMP'],['NMPA 变更指南','NMPA']]},
 {name:'验证批次 / 稳定性',items:[['工艺验证方案','Validation'],['稳定性方案','Stability'],['验证批次执行','Batch Validation']]}
];
const STAGES=['申请/立项','RA评估','QA审核','实施/验证','关闭'];
export function buildChangeWorkbench(input={}){
 const f=normalizeFilters(input); const base=enterpriseAnalysis(Object.fromEntries(['supplier','material'].filter(k=>f[k]!=='all').map(k=>[k,f[k]])));
 const all=base.change.changes;
 const changes=all.filter(c=>fit(c.category,f.change_type)&&fit(statusGroup(c),f.status)&&fit(date(c.opened_date).slice(0,7),f.month)&&(f.scope==='all'||f.scope==='全部变更'||(c.supplier_id&&c.material_id)));
 const ids=new Set(changes.map(c=>c.change_id));
 const filings=base.change.filings.filter(x=>ids.has(x.change_id));
 const keys=new Set(changes.map(c=>c.supplier_id+'|'+c.material_id));
 const orders=base.purchasing.orders.filter(x=>keys.has(x.supplier_id+'|'+x.material_id));
 const openKeys=new Set(changes.filter(x=>statusGroup(x)!=='closed').map(x=>x.supplier_id+'|'+x.material_id));
 const activeOrders=orders.filter(x=>openKeys.has(x.supplier_id+'|'+x.material_id));
 const docs=base.documents.register.filter(x=>keys.has(x.supplier_id+'|'+x.material_id));
 const lots=base.material.lots.filter(x=>changes.some(c=>x.material_id===c.material_id));
 const quality=base.material.qc.filter(x=>changes.some(c=>x.material_id===c.material_id));
 const associated=changes.map(c=>{
  const fs=filings.filter(x=>x.change_id===c.change_id);
  const po=orders.filter(x=>x.material_id===c.material_id&&x.supplier_id===c.supplier_id);
  const dc=docs.filter(x=>x.material_id===c.material_id&&x.supplier_id===c.supplier_id);
  const r=riskScore(c,uniq(fs.map(x=>x.market)).length,base.meta.as_of);
  return {...c,markets_list:uniq(fs.map(x=>x.market)),file_ids:dc.map(x=>x.doc_id),po_ids:po.map(x=>x.po_id),po_amount:sum(po,x=>x.amount),doc_count:dc.length,risk:r.score,risk_parts:r,stage:statusGroup(c)};
 });
 const matchedDocuments=typedDocs.map(g=>({...g,items:g.items.map(([title,pattern])=>{
  const re=new RegExp(pattern,'i');const attached=docs.filter(x=>re.test(x.type));const current=attached.filter(x=>x.is_current&&x.status==='Valid');
  return {title,document_type_pattern:pattern,recorded:attached.length,valid:current.length,documents:attached.map(x=>x.doc_id),status:current.length?'登记有效（DEMO，未核验官方）':'待补证据'};
 })})).map(g=>({...g,total:g.items.length,available:g.items.filter(x=>x.valid>0).length,missing:g.items.filter(x=>!x.valid).length}));
 const open=associated.filter(x=>x.stage!=='closed');const ra=associated.filter(x=>x.stage==='ra'); const high=open.filter(x=>x.severity==='HIGH');
 const aging= open.length? Math.max(...open.map(x=>Number(x.elapsed_days)||0)):null;
 const closure=associated.length?associated.filter(x=>x.stage==='closed').length/associated.length*100:null;
 const raLinked=filings.length;
 const pool=base.purchasing.orders;
 const impact=associated.map(c=>({...c,stock_lot_count:lots.filter(x=>x.material_id===c.material_id).length,filing_count:filings.filter(x=>x.change_id===c.change_id).length}));
 const report={
  source:{scope:'V08 DEMO / 受控原站模拟数据',as_of:base.meta.as_of,version:base.meta.version||'v08',currency:base.meta.currency||'DEMO-USD',not_gxp:true,filters:f,origin:'canonical enterpriseAnalysis(change_controls + filings + PO + documents + lots)'},
  filters:f,
  available:{supplier:uniq(enterpriseAnalysis({}).change.changes.map(x=>x.supplier_id)).sort(),material:uniq(enterpriseAnalysis({}).change.changes.map(x=>x.material_id)).sort(),month:uniq(enterpriseAnalysis({}).change.changes.map(x=>date(x.opened_date).slice(0,7))).sort(),change_type:uniq(enterpriseAnalysis({}).change.changes.map(x=>x.category)),status:['open','ra','qa','closed']},
  changes:associated,filings,orders,docs,lots,quality,document_groups:matchedDocuments,impact,
  kpis:{open_changes:open.length,filings:raLinked,ra_pending:filings.filter(x=>/required|assessment|pending|review/i.test(x.status)).length,high_risk:high.length,exposure:sum(activeOrders,x=>x.amount),oldest_open_days:aging,closure_rate:closure,planned_closed:associated.length,completed_count:associated.filter(x=>x.stage==='closed').length,closed_count:associated.filter(x=>x.stage==='closed').length,
   assessment_60_rate:open.length?open.filter(x=>num(x.elapsed_days)<=60).length/open.length*100:null,
   ra_approval_rate:null,validation_completion_rate:null,inventory_buffer_rate:null,controlled_site_coverage_rate:null},
  methods:[
   {id:'CC31.OPEN',name:'开放变更',formula:'COUNT(change_id WHERE status != Closed)',value:open.length,source:'change_controls.change_id, status'},
   {id:'CC31.FILINGS',name:'注册关联数',formula:'COUNT(change_id × market × product 的真实关联记录)',value:raLinked,source:'regulatory_filings change_id/market/product'},
   {id:'CC31.RA_PENDING',name:'RA待评估',formula:'COUNT(注册关联 status 包含 required/assessment/pending/review)',value:filings.filter(x=>/required|assessment|pending|review/i.test(x.status)).length,source:'regulatory_filings.status'},
   {id:'CC31.HIGH',name:'高风险变更',formula:'COUNT(非Closed 且 severity==HIGH)',value:high.length,source:'change_controls.status/severity'},
   {id:'CC31.EXPOSURE',name:'变更影响金额',formula:'SUM(仍开放变更关联的来源 PO 金额，按 supplier_id × material_id 唯一去重；已关闭变更不计入开放风险敞口)',value:sum(activeOrders,x=>x.amount),source:'purchase_orders.po_id, supplier_id, material_id, amount'},
   {id:'CC31.AGE',name:'最长开放天数',formula:'MAX(未关闭变更 elapsed_days，as_of - opened_date)',value:aging,source:'change_controls.opened_date; data as_of'},
   {id:'CC31.ASSESS60',name:'60天目标达成率',formula:'COUNT(开放变更 elapsed_days ≤ 60)/COUNT(开放变更)×100%',value:open.length?open.filter(x=>num(x.elapsed_days)<=60).length/open.length*100:null,source:'change_controls.opened_date/status'},
   {id:'CC31.CLOSED',name:'已完成率',formula:'COUNT(Closed 变更)/COUNT(本筛选变更)×100%',value:closure,source:'change_controls.status'},
   {id:'CC31.RISK',name:'风险优先级',formula:'MAX(逐变更风险分)；逐变更分=严重度基础分 + min(开放天数,20) + 市场数×5 + 未关闭15，100封顶',value:associated.length?Math.max(...associated.map(x=>x.risk)):null,source:'change_controls.severity/status/opened_date; regulatory_filings.market'},
   {id:'CC31.DOCUMENTS',name:'文件完整度',formula:'COUNT(有相符文件类型、状态有效的文件要求)/COUNT(截图文件要求)',value:matchedDocuments.reduce((s,g)=>s+g.available,0)/matchedDocuments.reduce((s,g)=>s+g.total,0)*100,source:'supplier_documents.type/status/expiry'},
   {id:'CC31.PLAN_CLOSE',name:'预计关闭数（本季度）',formula:'COUNT(变更计划关闭日期落在本季度且已有批准基准版本)',value:null,source:'尚无正式季度承诺及QA/RA批准的计划基准；不能从变更目标日期直接认定'},
   {id:'CC31.RA_PASS',name:'RA风险通过率',formula:'COUNT(正式RA评估批准记录)/COUNT(应进行RA评估记录)×100%',value:null,source:'缺少正式 RA 签核结果、审核人及签核日期'},
   {id:'CC31.RA_TIMELY',name:'RA评估及时率',formula:'COUNT(正式RA评估完成日期≤计划日期)/COUNT(有批准时间及计划时间的RA评估)×100%',value:null,source:'缺少逐市场RA评估开始/完成/批准时点'},
   {id:'CC31.QA_TIMELY',name:'QA审核准时率',formula:'COUNT(正式QA签核日期≤计划QA日期)/COUNT(有QA批准完成日期的审批)×100%',value:null,source:'缺少QMS正式审核计划与电子签名日期'},
   {id:'CC31.VALIDATION',name:'验证完成率',formula:'COUNT(正式验证已批准完成报告)/COUNT(适用验证方案)×100%',value:null,source:'缺少已签核验证方案、验证执行结果和放行记录'},
   {id:'CC31.INVENTORY_BUFFER',name:'库存缓冲达标率',formula:'COUNT(受变更影响物料在计划生效日缓冲库存≥审核阈值)/COUNT(受影响物料)×100%',value:null,source:'缺少ERP/WMS生效日期、可用库存及批准缓冲天数'},
   {id:'CC31.PRODUCTION_READY',name:'生产切换准备率',formula:'COUNT(生产切换清单均经QA/生产确认)/COUNT(应切换站点/物料)×100%',value:null,source:'缺少已批准切换清单、MES/生产安排'},
   {id:'CC31.SITE_COVERAGE',name:'受控站点覆盖率',formula:'COUNT(变更影响站点均有正式资格和市场批准)/COUNT(受影响站点)×100%',value:null,source:'变更台账无经批准的变更站点清单、正式市场准入资格'}
  ],
  reasoning:[
   {title:'高风险变更前置提醒',inputs:'高风险未关闭数、受影响市场数、关联 PO 金额',logic:'若存在 HIGH 且未关闭的变更，应优先进行 QA/RA 影响评估；对应 PO 金额为业务关联敞口，不等于冻结或财务损失。',conclusion:high.length?'存在高风险未关闭变更，建议 QA/RA 优先确认注册与验证要求。':'当前筛选内未发现 HIGH 且未关闭的变更。',evidence:high.map(x=>x.change_id)},
   {title:'注册关联与实施风险',inputs:'filings.status、filings.implementation、markets',logic:'逐市场检查是否记录正式实施准入条件；状态为 assessment required / Blocked 的不能视为正式可实施。',conclusion:filings.some(x=>/Blocked|assessment required/i.test(x.implementation+' '+x.status))?'存在待 RA 审核/实施阻断的注册关联，应继续评估。':'未见明确阻断；仍需人工核实批准证据。',evidence:filings.map(x=>x.change_id+'|'+x.market)},
   {title:'变更文档差距',inputs:'document_groups 的每组可映射来源证书编号',logic:'只把证据台账里实际存在、当前有效且名称符合的文件算入已登记数；不能凭截图的绿色勾推断文件存在。',conclusion:matchedDocuments.some(g=>g.missing)?'文档类别存在来源缺口，需采购/SQM/QA/RA 补件和归档。':'文档已登记；仍需 QA/RA 核验版本和批准。',evidence:docs.map(x=>x.doc_id)},
   {title:'业务影响与采购敞口',inputs:'open change.supplier_id/material_id 与 PO supplier_id/material_id',logic:'按仍开放变更的供应商×物料组合去重匹配 PO，然后 Σ(订单数量×实际单价)；已关闭变更不计开放风险敞口，金额只是潜在业务关联，不等于受控批次、库存或产品注册实际损失。',conclusion:activeOrders.length?'开放变更与现有采购记录有关联，建议逐 PO 核实是否需要过渡库存和交期计划。':'当前筛选未找到同组合 PO，不能推断无实际业务影响。',evidence:activeOrders.map(x=>x.po_id)}
  ]
 };
 return report;
}
const formula=x=>({formula:x});
const fmt=x=>x==null?'':Array.isArray(x)?x.join('; '):typeof x==='object'?JSON.stringify(x):x;
const T=(name,columns,records)=>({name,rows:[[name],['受控原站 DEMO 数据 · 公式在 Excel 中可直接查看与重算；非正式 GxP/RA 电子签核'],columns,...records]});
export function exportChangeWorkbook(report,{poOnly=false,module=''}={}){
 const po=report.orders,changes=report.changes,poEnd=Math.max(4,po.length+3),changeEnd=Math.max(4,changes.length+3);
 const tabs=[T('来源及筛选',['项目','取值'],[['数据源',report.source.scope],['数据模型版本',report.source.version],['查询基准日期',report.source.as_of],['币种',report.source.currency],...Object.entries(report.filters).map(([k,v])=>['筛选 '+k,v]),['生产边界','Non-GxP DEMO，不能用于正式市场批准']])];
 tabs.push(T('PO原始行',['PO编号','供应商','物料','PO日期','数量','单价','金额(可重算)','原站金额','复核差额','关联未关闭变更'],po.map((o,i)=>{const j=i+4;return [o.po_id,o.supplier_id,o.material_id,o.created_date,num(o.ordered_qty),num(o.unit_price),formula(`E${j}*F${j}`),num(o.amount),formula(`G${j}-H${j}`),report.changes.some(c=>c.stage!=='closed'&&c.supplier_id===o.supplier_id&&c.material_id===o.material_id)?'YES':'NO'];})));
 if(poOnly)return createWorkbook(tabs);
 tabs.push(T('变更原始行',['变更编号','供应商','物料','类型','状态','风险等级','申请日','目标日','市场数','开放天数','风险分(可重算)','源模型风险分','关联PO金额'],changes.map((c,i)=>{const j=i+4;return [c.change_id,c.supplier_id,c.material_id,c.category,c.status,c.severity,c.opened_date,c.target_date,c.markets_list.length,num(c.elapsed_days),formula(`MIN(100,IF(F${j}="HIGH",40,IF(F${j}="MEDIUM",25,10))+MIN(20,J${j})+I${j}*5+IF(E${j}="Closed",0,15))`),c.risk,c.po_amount];})));
 tabs.push(T('注册关联',['变更','市场','产品','MA标识','申报分类','RA状态','实施条件','规则版本'],report.filings.map(x=>[x.change_id,x.market,x.product_id,x.ma_number,x.regulatory_route,x.status,x.implementation,x.rule_version])));
 tabs.push(T('文件台账',['文件编号','供应商','Site','物料','类型','状态','到期日','是否生效','来源'],report.docs.map(x=>[x.doc_id,x.supplier_id,x.site_id,x.material_id,x.type,x.status,x.expiry,x.is_current?'是':'否',x.is_simulated?'原站DEMO':'受控来源'])));
 tabs.push(T('文件要求缺口',['分区','文件要求','实际登记证据','有效计数','缺口(可重算)','状态'],report.document_groups.flatMap(g=>g.items.map(x=>[g.name,x.title,x.documents.join(';'),x.valid,formula(`IF(D${4+report.document_groups.flatMap(x=>x.items).findIndex(y=>y===x)}=0,1,0)`),x.status]))));
 tabs.push(T('变更业务影响',['变更','供应商','物料','关联PO数','关联PO金额','风险分','关联注册数','当前阶段'],report.impact.map(x=>[x.change_id,x.supplier_id,x.material_id,x.po_ids.length,x.po_amount,x.risk,x.filing_count,x.stage])));
 tabs.push(T('甘特流程',['变更','申请日期','目标日期','状态','阶段','来源说明'],changes.map(x=>[x.change_id,x.opened_date,x.target_date,x.status,x.stage,'阶段色条为流程比例示意，不是签核实际日期'])));
 tabs.push(T('关键里程碑',['阶段','数据来源','计划日期','限制'],[['提交变更申请','change_controls.opened_date',changes[0]?.opened_date||'', '仅示例登记'],['QA评审（变更可行性）','QMS签核记录','未登记','不能自动证明已批准'],['RA评估（全球申报路径影响）','filings','未登记','待RA确认'],['客户/市场确认（如适用）','客户回执','未登记','不能自动证明'],['验证计划（工艺/分析/稳定性）','验证方案','未登记','不能推断验证完成'],['执行切换（生产/物料）','ERP/MES','未登记','待业务确认'],['关闭审批（变更验证）','QMS电子签核','未登记','Closed状态不构成正式签核']]));
 tabs.push(T('文字判断依据',['分析主题','输入指标与字段','判断方法','文字结论','对应证据ID'],report.reasoning.map(x=>[x.title,x.inputs,x.logic,x.conclusion,x.evidence.join(';')])));
 tabs.push(T('指标字典',['指标ID','指标名称','当前结果','原始计算公式','来源字段'],report.methods.map(x=>[x.id,x.name,x.value??'证据不足',x.formula,x.source])));
 tabs.push(T('汇总可重算',['指标','Excel可重算公式','当前源数值','解释'],[
 ['变更总数',formula(changes.length?`COUNTA('变更原始行'!A4:A${changeEnd})`:'0'),changes.length,'按照当前筛选的变更编号计数'],
 ['开放变更',formula(changes.length?`COUNTIF('变更原始行'!E4:E${changeEnd},"<>Closed")`:'0'),report.kpis.open_changes,'排除关闭状态'],
 ['高风险开放变更',formula(changes.length?`COUNTIFS('变更原始行'!E4:E${changeEnd},"<>Closed",'变更原始行'!F4:F${changeEnd},"HIGH")`:'0'),report.kpis.high_risk,'高风险且未关闭'],
 ['关联PO金额',formula(po.length?`SUMIF('PO原始行'!J4:J${poEnd},"YES",'PO原始行'!G4:G${poEnd})`:'0'),report.kpis.exposure,'仍开放变更的供应商×物料去重关联的PO金额'],
 ['关闭率 %',formula('IFERROR((B4-B5)/B4*100,"")'),report.kpis.closure_rate??'无分母','仅在有变更记录时有效'],
 ['注册关联数',formula(report.filings.length?`COUNTA('注册关联'!A4:A${report.filings.length+3})`:'0'),report.kpis.filings,'实际关联行数']
 ]));
 const moduleTabs={
  gantt:['甘特流程','关键里程碑','变更原始行'],
  documents:['文件台账','文件要求缺口','变更业务影响'],
  risk:['变更原始行','变更业务影响','注册关联'],
  milestones:['关键里程碑','变更原始行','注册关联'],
  overview:['变更业务影响','注册关联','文件台账','文件要求缺口']
 };
 if(module){
  if(!Object.hasOwn(moduleTabs,module))throw Error('不支持的模块计算依据');
  const keep=new Set(['来源及筛选','PO原始行','变更原始行','指标字典','汇总可重算','文字判断依据',...moduleTabs[module]]);
  return createWorkbook(tabs.filter(t=>keep.has(t.name)));
 }
 return createWorkbook(tabs);
}
