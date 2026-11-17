/** Explainable rule-based action ledger. Transparent evidence, not LLM private
 * reasoning or claims of causation. Every decision is recalculated from source
 * records at request time. No guessed root causes or invented CAPA. */
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {metricReport} from './metric_registry_v2921.mjs';
export const ACTIONS=Object.freeze({
 'ACT.SOURCE.SECOND':{title:'第二来源开发建议',metrics:['SRC.ACTION.DEVELOP_SECOND_SOURCE','SRC.QUAL.COMBINATIONS','SRC.PO.SPEND'],thresholds:[['合格样例来源数','≤',1],['同物料来源采购额','>',0]],prerequisites:['需指定单一物料','需要来源采购记录与资格组合记录']},
 'ACT.DELIVERY.INVESTIGATE':{title:'交付延期原因调查',metrics:['SRC.ACTION.DELIVERY_REVIEW','SRC.PO.OTD'],thresholds:[['OTD','<',90]],prerequisites:['必须有可判断交期的 PO 行','不能仅凭 OTD 自动推断根因']},
 'ACT.COST.PPV':{title:'采购价差复核',metrics:['SRC.PO.PPV','SRC.PO.WEIGHTED_BASELINE','SRC.PO.SPEND'],thresholds:[['采购 PPV','>',5]],prerequisites:['必须有相同物料、数量和币种口径','阈值为内部演示规则，须由采购财务审核']},
 'ACT.DOC.RECHECK':{title:'文件证据完整性复核',metrics:['SRC.DOC.VALID_RATE'],thresholds:[['示例文件有效率','<',100]],prerequisites:['文件登记有效性≠证书官方核验或QA批准','证据缺失优先触发人工补件']},
 'ACT.RISK.SUPPLIER_CONCENTRATION':{title:'供应商集中度治理',metrics:['SRC.RISK.CONCENTRATION','SRC.PO.SPEND'],thresholds:[['同物料供应商 Spend 份额','>',60]],prerequisites:['必须指定物料和供应商','跨类别金额不可计算单物料集中度']},
 'ACT.MARKET.SUPPLY_SIGNAL':{title:'供给风险情报复核',metrics:['SRC.CANDIDATE.OFFICIAL','SRC.CANDIDATE.TOTAL'],thresholds:[['已发布未准入官方线索数','>',0]],prerequisites:['来源事件≠停供概率','需要质量/采购人工核对后再作供应决策']},
 'ACT.QMS.CAPA_ESCALATE':{title:'CAPA 逾期升级建议',metrics:['SRC.QMS.OVERDUE_CAPA','SRC.QMS.OPEN_CAPA'],thresholds:[['逾期且未关闭CAPA数','>',0]],prerequisites:['必须有受控QMS事件、到期日期和状态','根因、责任归属与QA批准仍需人工核验']},
 'ACT.QMS.CRITICAL_REVIEW':{title:'重大质量事件复核建议',metrics:['SRC.QMS.CRITICAL_COUNT','SRC.QMS.EVENT_COUNT'],thresholds:[['CRITICAL严重程度事件数','>',0]],prerequisites:['重大事件的严重程度来自QMS原始记录','不得据此自动冻结订单或认定GMP违法']},
 'ACT.CONTRACT.RENEWAL':{title:'合同续签与到期复核',metrics:['SRC.CONTRACT.DUE90','SRC.CONTRACT.ACTIVE'],thresholds:[['90天内到期合同','>',0]],prerequisites:['合同仅为内置V08演示台账','必须核对真实盖章版与供应商合同条款']},
 'ACT.SAVINGS.ATTAINMENT':{title:'降本项目达成率复盘',metrics:['SRC.SAVINGS.ATTAINMENT','SRC.SAVINGS.REALIZED','SRC.SAVINGS.PLANNED'],thresholds:[['降本计划达成率','<',75]],prerequisites:['财务签核字段仅为DEMO标签','不能将计划降幅误判为已兑现节省']},
 'ACT.AUDIT.FINDINGS':{title:'供应商审计发现项整改建议',metrics:['SRC.AUDIT.OPEN_FINDINGS','SRC.AUDIT.COUNT'],thresholds:[['未关闭发现项','>',0]],prerequisites:['审计发现项来自V08 DEMO','整改根因与关闭证据须由QA确认']},
 'ACT.RECEIPT.GAP':{title:'采购收货差额核查',metrics:['SRC.PO.UNRECEIVED_QTY','SRC.PO.RECEIPT_RATE'],thresholds:[['尚未收货数量','>',0]],prerequisites:['必须具备逐笔收货数量','数量差额本身不能说明违约或质量问题']},
 'ACT.INVOICE.MATCH_EXCEPTION':{title:'发票三单匹配异常复核',metrics:['SRC.INVOICE.EXCEPTIONS','SRC.INVOICE.MATCH_RATE'],thresholds:[['匹配异常行数','>',0]],prerequisites:['应以企业授权发票/PO/GR来源核对','当前只有DEMO发票，不代表企业实际未匹配账款']},
 'ACT.INVOICE.OVERDUE_REVIEW':{title:'逾期未付发票核查',metrics:['SRC.INVOICE.OVERDUE'],thresholds:[['已逾期且未付款发票行','>',0]],prerequisites:['付款状态与到期日必须有凭证','当前为DEMO，不可直接认定实际拖欠']},
 'ACT.INVENTORY.RETEST_REVIEW':{title:'库存复验及到期预警',metrics:['SRC.INVENTORY.RETEST_90','SRC.INVENTORY.QC_HOLD'],thresholds:[['90天内复验/到期批次数','>',0]],prerequisites:['需由QC/QA复核批次状态','临期不自动等于报废']},
 'ACT.CHANGE.CONTROL_REVIEW':{title:'待完成变更控制复核',metrics:['SRC.CHANGE.OPEN','SRC.CHANGE.HIGH'],thresholds:[['未关闭变更控制','>',0]],prerequisites:['仅来自DEMO变更台账','正式适用市场需RA判定']},
 'ACT.WORKFLOW.RELIABILITY':{title:'工作流失败与重试建议',metrics:['SRC.WORKFLOW.FAILURES','SRC.WORKFLOW.SUCCESS_RATE'],thresholds:[['工作流失败数','>',0]],prerequisites:['模拟工作流不等于真实生产服务SLA','需结合错误日志确认原因']},
 'ACT.ALERT.HIGH_REVIEW':{title:'高优先级预警依据核对',metrics:['SRC.ALERT.HIGH'],thresholds:[['演示高风险预警数量','>',0]],prerequisites:['预警来自规则组合，不代表真实监管处罚','需核对每项事件关联的官方或企业来源']}


});
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
export function actionReport(id,{data=enterpriseAnalysis({}),scope={},published=[],factsOverride=null}={}){
 const def=ACTIONS[id];const norm={material:String(scope.material||'all'),supplier:String(scope.supplier||'all'),year:String(scope.year||'all')};
 if(!def)return {action_id:id,status:'UNREGISTERED_ANALYSIS',scope:norm,decision:'尚未登记',rationale:'这个文字分析尚无对应的指标规则和原始输入，不能宣称已经完成AI分析或确定根因。',inputs:[],thresholds:[],rows:[],missing:['请业务负责人定义公式、阈值、来源记录、数据范围和结论验收条件']};
 const reports=def.metrics.map(k=>metricReport(k,{data,scope:norm,published,factsOverride}));
 const basis=reports.map(r=>({metric_id:r.metric_id,label:r.label,value:r.result,unit:r.unit,status:r.status,numerator:r.numerator,denominator:r.denominator,formula:r.formula,source_class:r.source_class,scope:r.scope,evidence_count:r.rows?.length||0}));
 const primary=reports[0],rows=[...new Map(reports.flatMap(r=>(r.rows||[]).map(x=>[JSON.stringify(x),x]))).entries()].map(([,r])=>r).slice(0,500);
 let status='DEMO_RULE_EXPLANATION',decision='',conditions=[];
 if(reports.some(x=>['MISSING_LINEAGE','INSUFFICIENT_SOURCE','REQUIRES_SCOPE'].includes(x.status))){status='INSUFFICIENT_EVIDENCE';decision='证据不足，不生成管理决策';}
 else if(id==='ACT.SOURCE.SECOND'){decision=String(primary.result||'未判定');conditions=[`示例合格来源数 = ${primary.numerator??'未知'}`,`同物料来源采购金额 = ${primary.denominator??'未知'} USD`,`门槛：合格来源数 ≤ 1 且采购金额 > 0`];}
 else if(id==='ACT.DELIVERY.INVESTIGATE'){decision=String(primary.result||'未判定');conditions=[`OTD = ${primary.numerator??'—'} / ${primary.denominator??'—'} ×100`,`目标 OTD = 90%`,`仅能提示调查交付原因，不能得出供应商实际过错`];}
 else if(id==='ACT.COST.PPV'){const p=num(primary.result);if(p==null){status='INSUFFICIENT_EVIDENCE';decision='缺少价差或基准记录，无法判断'}else{decision=p>5?'采购价差超出演示阈值，建议核对 PO 与价格条款':'采购价差未触发 >5% 演示阈值';conditions=[`PPV=${p}%`,`阈值 5%`,`需逐笔检查 PO 数量、单价、基准价`]}}
 else if(id==='ACT.DOC.RECHECK'){const p=num(primary.result);if(p==null){status='INSUFFICIENT_EVIDENCE';decision='没有文件登记，无法判断'}else{decision=p<100?'建议人工复核未有效文件和到期记录':'当前登记文件全为有效（并非官方资格证明）';conditions=[`登记有效率 ${p}%`,`阈值 100%`];}}
 else if(id==='ACT.RISK.SUPPLIER_CONCENTRATION'){const p=num(primary.result);if(p==null){status='INSUFFICIENT_EVIDENCE';decision='需要单一物料和供应商筛选'}else{decision=p>60?'建议评估供应集中度与第二来源':'当前未触发 >60% 的集中度演示门槛';conditions=[`同物料该供应商份额 ${p}%`,`演示阈值 60%`];}}
 else if(id==='ACT.QMS.CAPA_ESCALATE'){const v=num(primary.result);decision=v==null?'QMS证据不足':v>0?'建议由SQM与QA核查逾期CAPA并按既有SOP升级':'没有逾期且未关闭的CAPA';conditions=[`逾期CAPA：${v??'未知'}条`,`规则阈值：>0条`,`仅触发复核，不推断事故根因或自动审批`];}
 else if(id==='ACT.QMS.CRITICAL_REVIEW'){const v=num(primary.result);decision=v==null?'QMS证据不足':v>0?'建议SQM/QA复核重大质量事件及关联供应范围':'未记录CRITICAL级别事件';conditions=[`QMS标记CRITICAL：${v??'未知'}条`,`规则阈值：>0条`,`不自动改变ASL或法规资格`];}
 else if(id==='ACT.CONTRACT.RENEWAL'||id==='ACT.SAVINGS.ATTAINMENT'||id==='ACT.AUDIT.FINDINGS'||id==='ACT.RECEIPT.GAP'){
  const v=num(primary.result),threshold=id==='ACT.SAVINGS.ATTAINMENT'?75:0;
  if(v==null){status='INSUFFICIENT_EVIDENCE';decision='缺少可复核来源记录';}
  else{
   const triggered=id==='ACT.SAVINGS.ATTAINMENT'?v<threshold:v>threshold;
   const verb={
    'ACT.CONTRACT.RENEWAL':'应核对即将到期合同的续签计划和对应供应保障',
    'ACT.SAVINGS.ATTAINMENT':'建议按供应商和项目复核未达成的降本原因，不可编造降本根因',
    'ACT.AUDIT.FINDINGS':'建议SQM/QA核实发现项整改与CAPA有效性',
    'ACT.RECEIPT.GAP':'建议采购/仓库核对收货差额、在途状态及异常单据'
   };
   decision=triggered?verb[id]:'当前记录未触发该演示规则门槛';
   conditions=[`${primary.label} = ${v}${primary.unit||''}`,`规则阈值 ${id==='ACT.SAVINGS.ATTAINMENT'?'< 75%':'> 0'}`,`证据来源 ${primary.source_class}`];
  }
 }
 else if(['ACT.INVOICE.MATCH_EXCEPTION','ACT.INVOICE.OVERDUE_REVIEW','ACT.INVENTORY.RETEST_REVIEW','ACT.CHANGE.CONTROL_REVIEW','ACT.WORKFLOW.RELIABILITY','ACT.ALERT.HIGH_REVIEW'].includes(id)){
  const v=num(primary.result),limit=0;
  if(v==null){status='INSUFFICIENT_EVIDENCE';decision='当前没有足够来源记录；不得生成确定结论';}
  else{
   const affected=v>limit;
   const conclusions={
    'ACT.INVOICE.MATCH_EXCEPTION':'建议财务/采购按发票ID核对三单匹配异常及差额',
    'ACT.INVOICE.OVERDUE_REVIEW':'建议财务核查付款计划及合同账期',
    'ACT.INVENTORY.RETEST_REVIEW':'建议QC/QA复核临期批次和复验安排',
    'ACT.CHANGE.CONTROL_REVIEW':'建议RA/QA核查未关闭变更及市场影响',
    'ACT.WORKFLOW.RELIABILITY':'建议运维核查失败执行、错误日志和重试记录',
    'ACT.ALERT.HIGH_REVIEW':'建议采购/质量核实高风险预警的实际证据'
   };
   decision=affected?conclusions[id]:'当前未触发此规则的演示阈值';
   conditions=[`${primary.label} = ${v} ${primary.unit||''}`,`触发条件：${primary.label} > 0`,`此判断是确定性规则；事实根因必须通过人工调查确定`];
  }
 }
 else if(id==='ACT.MARKET.SUPPLY_SIGNAL'){const p=num(primary.result);decision=p>0?'发现已复核发布但仍未准入的官方线索，建议采购/RA核对':'没有已发布官方线索，不能推断供应市场安全';conditions=[`已发布线索 ${p??'—'} 条`,`不会改变已批准 ASL/GMP/CEP 状态`];}
 const missing=[...new Set(reports.filter(x=>['MISSING_LINEAGE','INSUFFICIENT_SOURCE','REQUIRES_SCOPE'].includes(x.status)).flatMap(x=>x.missing||[]))];
 return {action_id:id,title:def.title,status,decision,scope:norm,inputs:basis,thresholds:def.thresholds.map(([field,operator,value])=>({field,operator,value})),conditions,rows,rationale:status==='INSUFFICIENT_EVIDENCE'?'没有充分来源数据，不允许输出确定结论。':`${def.title}：${conditions.join('；')}。结果“${decision}”由上述公开阈值和示例记录触发，仅是可核查的决策依据，不是自动生成的真实事故根因或模型内部思维过程。`,missing,prerequisites:def.prerequisites,source_boundary:factsOverride?.scope?.source_boundary||'V08_DEMO_SAMPLE / OFFICIAL_UNQUALIFIED_LEADS'};
}
export function listActionDefinitions(){return Object.entries(ACTIONS).map(([action_id,v])=>({action_id,title:v.title,metric_ids:v.metrics,thresholds:v.thresholds}));}
