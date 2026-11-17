/** v2.9.21: exact metric ID -> filtered input rows -> formula -> deterministic
 * result -> evidence provenance. All values are DEMO_SAMPLE unless separately
 * integrated with a validated ERP source. No opaque fallback formula. */
import {createWorkbook} from './formula_workbook.mjs';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {sourcingFacts} from './sourcing_domain_v2921.mjs';
import {EXTRA_METRICS,extraMetricReport,extraMetricWorkbook} from './metric_extensions_v2924.mjs';
import {OP_METRICS,operationalMetricReport,operationalWorkbook} from './operational_metrics_v2925.mjs';
import {DOMAIN_METRICS,enterpriseDomainMetric,domainEvidenceSheets} from './enterprise_evidence_v2926.mjs';
const n=x=>Number.isFinite(Number(x))?Number(x):0;
const sum=(a,f)=>a.reduce((s,x)=>s+n(f(x)),0);
const round=(x,dec=4)=>x==null||!Number.isFinite(x)?null:Math.round(x*10**dec)/10**dec;
export const METRICS=Object.freeze({
 ...EXTRA_METRICS,
 ...OP_METRICS,
 ...DOMAIN_METRICS,
 'SRC.CANDIDATE.TOTAL':{label:'寻源候选数（含演示）',unit:'家',formula:'COUNT(候选目录中唯一 Supplier ID)',type:'candidate',description:'只统计线索数量，不代表合格或有报价。'},
 'SRC.CANDIDATE.SCENARIO':{label:'情景候选数量',unit:'家',formula:'COUNTIF(候选目录, SOURCE_CLASS = SCENARIO)',type:'candidate',description:'不计入 PO Spend、OTD、有效报价或资格合格率。'},
 'SRC.CANDIDATE.OFFICIAL':{label:'人工关联且已发布的官方线索',unit:'条',formula:'COUNTIF(候选目录,SOURCE_CLASS=OFFICIAL_REVIEWED_LEAD)',type:'candidate',description:'只证明官方线索已关联发布，绝不自动取得 GMP/CEP/ASL 或订单准入。'},
 'SRC.SUPPLIER.RECORDED':{label:'原站 DEMO 供应商数',unit:'家',formula:'COUNT(原始主数据中唯一 Supplier ID)',type:'master',description:'V08 DEMO 供应商主档，而不是80家候选。'},
 'SRC.PO.COUNT':{label:'采购订单记录数',unit:'行',formula:'COUNT(满足过滤范围的 PO_ID)',type:'po'},
 'SRC.PO.SPEND':{label:'来源采购金额',unit:'USD',formula:'SUM(PO.amount_usd)',type:'po'},
 'SRC.PO.QUANTITY':{label:'采购数量',unit:'kg',formula:'SUM(PO.ordered_qty)',type:'po'},
 'SRC.PO.LATE_COUNT':{label:'延期采购订单行数',unit:'行',formula:'COUNTIF(PO.delay_days,>0)',type:'po'},
 'SRC.PO.ON_TIME_COUNT':{label:'准时采购订单行数',unit:'行',formula:'COUNTIF(PO.delay_days,<=0)（排除未知交期行）',type:'po'},
 'SRC.PO.AVG_LATE_DAYS':{label:'延期订单平均延期天数',unit:'天',formula:'AVG(PO.delay_days WHERE delay_days>0)',type:'po'},
 'SRC.PO.RECEIPT_RATE':{label:'采购收货数量完成率',unit:'%',formula:'100×SUM(PO.received_qty)/SUM(PO.ordered_qty)',type:'po',description:'只是收货完成率，不是市场供应充足率。'},
 'SRC.PO.WEIGHTED_PRICE':{label:'采购加权成交单价',unit:'USD/kg',formula:'SUM(PO.amount_usd)/SUM(PO.ordered_qty)',type:'po'},
 'SRC.PO.WEIGHTED_BASELINE':{label:'采购加权基准价',unit:'USD/kg',formula:'SUM(PO.ordered_qty×PO.benchmark_price)/SUM(PO.ordered_qty)',type:'po'},
 'SRC.PO.OTD':{label:'订单准时交付率 OTD',unit:'%',formula:'100×COUNT(PO.delay_days<=0)/COUNT(有 delay_days 的 PO 行)',type:'po'},
 'SRC.PO.PPV':{label:'采购价差率 PPV',unit:'%',formula:'100×SUM(PO.qty×(unit_price−benchmark_price))/SUM(PO.qty×benchmark_price)',type:'po'},
 'SRC.QUOTE.COUNT':{label:'原站同物料有效报价数',unit:'份',formula:'COUNT(原站报价，物料/供应商筛选匹配)',type:'quote'},
 'SRC.QUOTE.AVG_LANDED':{label:'原始报价平均落地单价',unit:'USD/kg',formula:'AVG(USD报价 + 运费/MAX(MOQ,1))',type:'quote'},
 'SRC.QUOTE.BEST_LANDED':{label:'最优原始报价估算（含运费）',unit:'USD/kg',formula:'MIN(报价USD/kg + 运费USD/MAX(MOQ,1))',type:'quote',description:'仅同物料且币种转换已知的 V08 演示报价。情景候选不参与。'},
 'SRC.QUAL.COMBINATIONS':{label:'有登记的示例合格 Site×Material 数',unit:'组',formula:'COUNTIF(资格记录:prequalified AND approved_for_use AND in_asl_for_site AND NOT critical_expired)',type:'qualification'},
 'SRC.DOC.COUNT':{label:'文件登记数量',unit:'份',formula:'COUNT(原站文件登记行)',type:'document'},
 'SRC.DOC.EXPIRED_COUNT':{label:'已过期文件数',unit:'份',formula:'COUNTIF(days_to_expiry<=0)',type:'document'},
 'SRC.DOC.DUE_30':{label:'未来30天到期文件数',unit:'份',formula:'COUNTIFS(0<days_to_expiry<=30)',type:'document'},
 'SRC.DOC.DUE_90':{label:'未来90天到期文件数',unit:'份',formula:'COUNTIFS(0<days_to_expiry<=90)',type:'document'},
 'SRC.QUAL.RECORDED':{label:'Site×Material 资格登记数量',unit:'组',formula:'COUNT(资格登记行)',type:'qualification'},
 'SRC.DOC.VALID_RATE':{label:'文件登记有效率',unit:'%',formula:'100×COUNT(status=Valid 且 days_to_expiry>0)/COUNT(文件登记)',type:'document'},
 'SRC.RISK.CONCENTRATION':{label:'供应商采购集中度',unit:'%',formula:'100×某供应商该物料采购金额/该物料采购总金额',type:'po',description:'需要 supplier 和 material 筛选；未指定具体供应商不能生成单家集中度。'},
 'SRC.ACTION.DEVELOP_SECOND_SOURCE':{label:'是否需要第二来源开发',unit:'规则结论',formula:'IF(示例合格来源数<=1 AND 采购金额>0,"建议开发第二来源","无需因单一来源自动立项")',type:'analysis',description:'规则解释不是模型的私密推理；只能得出明确阈值触发的建议，不代表真实独家供应。'},
 'SRC.ACTION.DELIVERY_REVIEW':{label:'交付改善建议依据',unit:'规则结论',formula:'IF(OTD<90%,"建议调查交付","未触发 OTD 低于90%预警")',type:'analysis',description:'按源站 DEMO PO 准时行数计算；无法归因于特定根因，需提供调查记录。'},
 'SRC.PO.BENCHMARK_SPEND':{label:'采购基准金额',unit:'USD',formula:'SUM(PO.qty × PO.benchmark_price)',type:'po'},
 'SRC.PO.PPV_AMOUNT':{label:'采购价差金额',unit:'USD',formula:'SUM(PO.qty × (PO.unit_usd − PO.benchmark_usd))',type:'po'},
 'SRC.PO.LATE_RATE':{label:'订单延期率',unit:'%',formula:'100×迟交订单行数/可判断交期订单行数',type:'po'},
 'SRC.PO.ACTIVE_SUPPLIERS':{label:'有PO记录供应商数量',unit:'家',formula:'COUNT(DISTINCT PO.supplier_id)',type:'po'},
 'SRC.PO.AVG_ORDER_VALUE':{label:'订单行平均金额',unit:'USD',formula:'SUM(PO.amount_usd)/COUNT(PO行)',type:'po'},
 'SRC.PO.ON_TIME_SPEND':{label:'准时交货订单金额',unit:'USD',formula:'SUM(PO.amount_usd WHERE delay_days<=0)',type:'po'},
 'SRC.QMS.EVENT_COUNT':{label:'QMS质量事件数量',unit:'条',formula:'COUNT(QMS.event_id)',type:'qms'},
 'SRC.QMS.OPEN_DEVIATIONS':{label:'未关闭偏差数',unit:'条',formula:'COUNTIF(QMS.kind=DEVIATION, status<>CLOSED)',type:'qms'},
 'SRC.QMS.OPEN_CAPA':{label:'未关闭 CAPA 数',unit:'条',formula:'COUNTIF(QMS.kind=CAPA,status<>CLOSED)',type:'qms'},
 'SRC.QMS.OVERDUE_CAPA':{label:'逾期 CAPA 数',unit:'条',formula:'COUNTIF(QMS.kind=CAPA,status<>CLOSED,due_date<as_of)',type:'qms'},
 'SRC.QMS.CAPA_CLOSED_RATE':{label:'CAPA 关闭率',unit:'%',formula:'100×已关闭 CAPA/全部 CAPA',type:'qms'},
 'SRC.QMS.CRITICAL_COUNT':{label:'重大质量事件数',unit:'条',formula:'COUNTIF(QMS.severity=CRITICAL)',type:'qms'}
});
const inputs=(data,filters,published=[])=>sourcingFacts(data,{filters,published});
function reportBase(id,scope,def){return {id,metric_id:id,label:def.label,unit:def.unit,formula:def.formula,explanation:def.description||'使用指定过滤范围的原始记录确定性重算，资料为 V08 DEMO，不能替代企业正式财务/质量证据。',weights:[],source_class:'V08_DEMO_SAMPLE',scope,status:'DEMO_RECOMPUTABLE',result:null,numerator:null,denominator:null,rows:[],inputs:[],thresholds:[],missing:[],source_release:'2026-11-01'};}
function unique(arr,field){return new Set(arr.map(x=>String(x[field]))).size}
const validated=arr=>arr.filter(x=>x!=null);
export function metricReport(id,{data=enterpriseAnalysis({}),scope={},published=[],factsOverride=null,asOf=null}={}){
 asOf=asOf||scope.as_of||new Date().toISOString().slice(0,10);
 const norm={material:String(scope.material||'all'),supplier:String(scope.supplier||'all'),year:String(scope.year||'all'),as_of:String(asOf)};
 const def=METRICS[id]; if(!def)return {metric_id:id,label:String(scope.label||id),formula:null,source_class:null,scope:norm,status:'MISSING_LINEAGE',result:null,rows:[],inputs:[],weights:[],missing:['此指标尚未登记原始行/公式/权重/版本。禁止仅根据页面数字逆推公式或编造数据。']};
 const d=factsOverride||inputs(data,norm,published),p=d.purchaseOrders,q=d.quotes,s=d.qualifications,docs=d.documents,c=d.catalog;
 if(DOMAIN_METRICS[id])return enterpriseDomainMetric(id,{scope:norm,factsOverride});
 if(EXTRA_METRICS[id])return extraMetricReport(id,{data,scope:norm,purchaseOrders:p,factsOverride,asOf});
 if(OP_METRICS[id])return operationalMetricReport(id,{data,scope:norm,factsOverride,asOf});
 const o=reportBase(id,norm,def);
 if(factsOverride){o.source_class=d.scope?.source_boundary||'ENTERPRISE_API_RELEASED_NON_GXP';o.source_release=d.scope?.source_release||null;o.status='ENTERPRISE_RECOMPUTABLE_NON_GXP';o.explanation='从经过管理员复核发布的企业接口快照确定性重算；未完成 GxP 计算机系统验证，不代表采购准入或电子签名。';}
 if(factsOverride&&['qualification','quote','document'].includes(def.type)){o.status='INSUFFICIENT_SOURCE';o.missing=['本企业来源快照没有经过验证的资质、报价或文件记录，不得将缺失解释为0或已批准'];return o;}
 if(factsOverride&&def.type==='po'&&(!d.has_erp_input||!p.length)){o.status='INSUFFICIENT_SOURCE';o.missing=[!d.has_erp_input?'当前发布的快照不包含ERP订单来源，不能按0计算':'当前企业来源筛选范围没有可验证 PO 明细；不能把范围缺口冒充0'];return o;}
 if(factsOverride&&def.type==='qms'&&!d.has_qms_input){o.status='INSUFFICIENT_SOURCE';o.missing=['当前发布的快照不包含QMS事件来源，不能按0计算'];return o;}const records=xs=>xs.map(x=>({...x}));
 if(id==='SRC.CANDIDATE.TOTAL'){o.rows=records(c);o.numerator=unique(c,'supplier_id');o.result=o.numerator;o.source_class='MIXED_CATALOG_COUNT';}
 else if(id==='SRC.CANDIDATE.SCENARIO'){o.rows=records(c.filter(x=>x.source_class==='SCENARIO'));o.numerator=unique(o.rows,'supplier_id');o.result=o.numerator;o.source_class='SCENARIO_ONLY';}
 else if(id==='SRC.CANDIDATE.OFFICIAL'){o.rows=records(c.filter(x=>x.source_class==='OFFICIAL_REVIEWED_LEAD'));o.numerator=unique(o.rows,'supplier_id');o.result=o.numerator;o.source_class='OFFICIAL_REVIEWED_UNQUALIFIED_LEAD';}
 else if(id==='SRC.SUPPLIER.RECORDED'){o.rows=records(d.supplierMaster.filter(x=>norm.supplier==='all'||norm.supplier===x.supplier_id));o.result=unique(o.rows,'supplier_id');o.numerator=o.result;}
 else if(id==='SRC.PO.BENCHMARK_SPEND'||id==='SRC.PO.PPV_AMOUNT'){
  const valid=p.filter(x=>x.baseline_usd!=null&&x.price_usd!=null&&x.qty!=null);
  o.rows=records(valid);o.numerator=id==='SRC.PO.BENCHMARK_SPEND'?sum(valid,x=>x.qty*x.baseline_usd):sum(valid,x=>x.qty*(x.price_usd-x.baseline_usd));
  o.result=valid.length===p.length&&p.length?round(o.numerator,2):null;
  if(valid.length<p.length)o.missing=[`缺少基准价的 PO 行数 ${p.length-valid.length}，不能把未知基准价当0`];
 }
 else if(id==='SRC.PO.LATE_RATE'){o.rows=records(p.filter(x=>x.delay_days!=null));o.numerator=o.rows.filter(x=>x.delay_days>0).length;o.denominator=o.rows.length;o.result=o.denominator?round(100*o.numerator/o.denominator):null;}
 else if(id==='SRC.PO.ACTIVE_SUPPLIERS'){o.rows=records(p);o.numerator=unique(p,'supplier_id');o.result=o.numerator;}
 else if(id==='SRC.PO.AVG_ORDER_VALUE'){o.rows=records(p);o.numerator=sum(p,x=>x.amount_usd);o.denominator=p.length;o.result=o.denominator?round(o.numerator/o.denominator,2):null;}
 else if(id==='SRC.PO.ON_TIME_SPEND'){o.rows=records(p.filter(x=>x.delay_days!=null&&x.delay_days<=0));o.numerator=sum(o.rows,x=>x.amount_usd);o.result=p.length?round(o.numerator,2):null;}
 else if(def.type==='qms'){
  if(!factsOverride||!d.qmsEvents?.length){o.status='INSUFFICIENT_SOURCE';o.missing=['V08 DEMO 未包含可审计的 QMS 事件表。请接入受控 QMS 快照。'];return o;}
  const all=d.qmsEvents||[],capa=all.filter(x=>x.kind==='CAPA'),open=capa.filter(x=>x.status!=='CLOSED');
  const counted=id==='SRC.QMS.EVENT_COUNT'?all:id==='SRC.QMS.OPEN_DEVIATIONS'?all.filter(x=>x.kind==='DEVIATION'&&x.status!=='CLOSED'):id==='SRC.QMS.OPEN_CAPA'?open:id==='SRC.QMS.OVERDUE_CAPA'?open.filter(x=>x.due_date&&x.due_date<asOf):id==='SRC.QMS.CRITICAL_COUNT'?all.filter(x=>x.severity==='CRITICAL'):capa.filter(x=>x.status==='CLOSED');
  o.rows=records(id==='SRC.QMS.CAPA_CLOSED_RATE'?capa:counted);o.numerator=counted.length;
  if(id==='SRC.QMS.CAPA_CLOSED_RATE'){o.denominator=capa.length;o.result=capa.length?round(100*counted.length/capa.length):null;}else{o.result=counted.length;}
 }
 else if(id==='SRC.PO.COUNT'){o.rows=records(p);o.result=p.length;o.numerator=p.length;}
 else if(id==='SRC.PO.SPEND'){o.rows=records(p);o.numerator=sum(p,x=>x.amount_usd);o.result=round(o.numerator,2);}
 else if(id==='SRC.PO.QUANTITY'){o.rows=records(p);o.numerator=sum(p,x=>x.qty);o.result=round(o.numerator,2);}
 else if(id==='SRC.PO.LATE_COUNT'){o.rows=records(p.filter(x=>x.delay_days!=null));o.numerator=o.rows.filter(x=>x.delay_days>0).length;o.result=o.numerator;}
 else if(id==='SRC.PO.ON_TIME_COUNT'){o.rows=records(p.filter(x=>x.delay_days!=null));o.numerator=o.rows.filter(x=>x.delay_days<=0).length;o.result=o.numerator;}
 else if(id==='SRC.PO.AVG_LATE_DAYS'){o.rows=records(p.filter(x=>x.delay_days!=null&&x.delay_days>0));o.numerator=sum(o.rows,x=>x.delay_days);o.denominator=o.rows.length;o.result=o.denominator?round(o.numerator/o.denominator):null;}
 else if(id==='SRC.PO.RECEIPT_RATE'){if(p.some(x=>x.received==null)){o.status='INSUFFICIENT_SOURCE';o.missing=['部分PO无收货数量，不能把缺失值当0'];return o;}o.rows=records(p);o.numerator=sum(p,x=>x.received);o.denominator=sum(p,x=>x.qty);o.result=o.denominator?round(100*o.numerator/o.denominator):null;}
 else if(id==='SRC.PO.WEIGHTED_PRICE'){o.rows=records(p);o.numerator=sum(p,x=>x.amount_usd);o.denominator=sum(p,x=>x.qty);o.result=o.denominator?round(o.numerator/o.denominator):null;}
 else if(id==='SRC.PO.WEIGHTED_BASELINE'){if(p.some(x=>x.baseline_usd==null)){o.status='INSUFFICIENT_SOURCE';o.missing=['存在缺少基准价的PO，不能按零补齐'];return o;}o.rows=records(p);o.numerator=sum(p,x=>x.qty*x.baseline_usd);o.denominator=sum(p,x=>x.qty);o.result=o.denominator?round(o.numerator/o.denominator):null;}
 else if(id==='SRC.PO.OTD'){o.rows=records(p);o.denominator=p.filter(x=>x.delay_days!=null).length;o.numerator=p.filter(x=>x.delay_days!=null&&x.delay_days<=0).length;o.result=o.denominator?round(100*o.numerator/o.denominator):null;}
 else if(id==='SRC.PO.PPV'){if(p.some(x=>x.baseline_usd==null||x.price_usd==null)){o.status='INSUFFICIENT_SOURCE';o.missing=['存在缺少基准价或成交价的PO'];return o;}o.rows=records(p);o.numerator=sum(p,x=>x.qty*(x.price_usd-x.baseline_usd));o.denominator=sum(p,x=>x.qty*x.baseline_usd);o.result=o.denominator?round(100*o.numerator/o.denominator):null;}
 else if(id==='SRC.QUOTE.COUNT'){o.rows=records(q);o.numerator=q.length;o.result=o.numerator;}
 else if(id==='SRC.QUOTE.AVG_LANDED'){o.rows=records(q.filter(x=>x.unit_usd!=null&&x.moq!=null).map(x=>({...x,landed_usd:x.unit_usd+n(x.freight_usd)/Math.max(1,n(x.moq))})));o.numerator=sum(o.rows,x=>x.landed_usd);o.denominator=o.rows.length;o.result=o.denominator?round(o.numerator/o.denominator):null;}
 else if(id==='SRC.QUOTE.BEST_LANDED'){o.rows=records(q);const priced=q.filter(x=>x.unit_usd!=null&&x.moq!=null).map(x=>({...x,landed_usd:x.unit_usd+n(x.freight_usd)/Math.max(1,n(x.moq))}));o.rows=priced;o.numerator=priced.length;o.result=priced.length?round(Math.min(...priced.map(x=>x.landed_usd))):null;}
 else if(id==='SRC.QUAL.COMBINATIONS'){o.rows=records(s);o.numerator=s.filter(x=>x.sample_qualification).length;o.result=o.numerator;}
 else if(id==='SRC.DOC.COUNT'){o.rows=records(docs);o.numerator=docs.length;o.result=o.numerator;}
 else if(id==='SRC.DOC.EXPIRED_COUNT'){o.rows=records(docs);o.numerator=docs.filter(x=>x.days_to_expiry!=null&&Number(x.days_to_expiry)<=0).length;o.result=o.numerator;}
 else if(id==='SRC.DOC.DUE_30'){o.rows=records(docs);o.numerator=docs.filter(x=>x.days_to_expiry!=null&&Number(x.days_to_expiry)>0&&Number(x.days_to_expiry)<=30).length;o.result=o.numerator;}
 else if(id==='SRC.DOC.DUE_90'){o.rows=records(docs);o.numerator=docs.filter(x=>x.days_to_expiry!=null&&Number(x.days_to_expiry)>0&&Number(x.days_to_expiry)<=90).length;o.result=o.numerator;}
 else if(id==='SRC.QUAL.RECORDED'){o.rows=records(s);o.numerator=s.length;o.result=o.numerator;}
 else if(id==='SRC.DOC.VALID_RATE'){o.rows=records(docs);o.numerator=docs.filter(x=>x.status==='Valid'&&n(x.days_to_expiry)>0).length;o.denominator=docs.length;o.result=o.denominator?round(100*o.numerator/o.denominator):null;}
 else if(id==='SRC.RISK.CONCENTRATION'){
  if(norm.supplier==='all'||norm.material==='all'){o.status='REQUIRES_SCOPE';o.missing=['请先选择供应商和物料，避免用全部物料金额代表单一物料集中度。'];return o}
  const all=factsOverride?(factsOverride.rawPurchaseOrders||[]).filter(x=>x.material_id===norm.material&&(norm.year==='all'||x.created_date.startsWith(norm.year))):sourcingFacts(data,{filters:{material:norm.material,year:norm.year}}).purchaseOrders;o.rows=records(all);o.numerator=sum(all.filter(x=>x.supplier_id===norm.supplier),x=>x.amount_usd);o.denominator=sum(all,x=>x.amount_usd);o.result=o.denominator?round(100*o.numerator/o.denominator):null;
 }
 else if(id==='SRC.ACTION.DEVELOP_SECOND_SOURCE'){
  if(norm.material==='all'){o.status='REQUIRES_SCOPE';o.missing=['请先选择物料；不同物料的来源数量不能合并判定独家供应。'];return o}
  const allowed=s.filter(x=>x.sample_qualification);const cnt=new Set(allowed.map(x=>x.supplier_id+'|'+x.site_id)).size,amount=sum(p,x=>x.amount_usd);o.status='DEMO_RULE_ANALYSIS';o.rows=records([...s,...p]);o.numerator=cnt;o.denominator=amount;o.thresholds=[{field:'sample_qualified_source_count',operator:'<=',value:1},{field:'source_PO_spend',operator:'>',value:0}];o.inputs=[{name:'示例合格来源数',value:cnt},{name:'相同过滤条件采购金额',value:amount,unit:'USD'}];o.result=cnt<=1&&amount>0?'建议启动第二来源评估':'当前证据未触发单一来源立项规则';o.explanation=`依据原站样例：合格厂址×物料来源 ${cnt}，PO金额 ${round(amount,2)} USD。${o.result}。该结论不推断事故原因，也不代表真实企业已被监管批准。`;
 }
 else if(id==='SRC.ACTION.DELIVERY_REVIEW'){
  const known=p.filter(x=>x.delay_days!=null),on=known.filter(x=>x.delay_days<=0).length,otd=known.length?100*on/known.length:null;o.status='DEMO_RULE_ANALYSIS';o.rows=records(known);o.numerator=on;o.denominator=known.length;o.inputs=[{name:'准时 PO 行数',value:on},{name:'可判交期 PO 行数',value:known.length},{name:'OTD',value:otd==null?null:round(otd),unit:'%'}];o.thresholds=[{field:'OTD',operator:'<',value:90}];o.result=otd==null?'缺少准时交付基础数据':otd<90?'建议调查交付可靠性':'未触发交付异常阈值';o.explanation=`OTD = ${on}/${known.length}×100 = ${otd==null?'不可计算':round(otd)+'%'}；门槛90%。${o.result}。根因不能从延迟天数自动得出，需实际质量/物流调查。`;
 }
 if(o.result==null){o.status='INSUFFICIENT_SOURCE';o.missing=[...(o.missing||[]),'本范围缺少可计算的原始输入或分母为0，不强行返回0。']}
 if(o.rows.length>500)o.rows=o.rows.slice(0,500);
 return o;
}
export function listMetricDefinitions(){return Object.entries(METRICS).map(([id,v])=>({metric_id:id,label:v.label,formula:v.formula,unit:v.unit,type:v.type,description:v.description||null}));}

export function exportMetricWorkbook({data=enterpriseAnalysis({}),scope={},metricIds=null,published=[],factsOverride=null,extraSheets=[]}={}){
 const d=factsOverride||sourcingFacts(data,{filters:scope,published});const f=x=>({formula:x});
 const po=d.purchaseOrders.map((r,i)=>{const k=i+4;return [r.id,r.supplier_id,r.site_id,r.material_id,r.created_date,r.qty,r.amount_usd,r.price_usd,r.baseline_usd,r.delay_days,f(`F${k}*I${k}`),f(`F${k}*(H${k}-I${k})`),f(`IF(ISNUMBER(J${k}),IF(J${k}<=0,1,0),"")`),r.source_row,r.received,f(`MAX(0,F${k}-O${k})`)]});
 const q=d.quotes.map((r,i)=>{const k=i+4;return [r.id,r.supplier_id,r.material_id,r.unit_usd,n(r.moq),n(r.freight_usd),f(`D${k}+F${k}/MAX(1,E${k})`),r.source_row]});
 const qual=d.qualifications.map((r,i)=>{const k=i+4;return [r.id,r.supplier_id,r.site_id,r.material_id,r.prequalified?1:0,r.approved_for_use?1:0,r.in_asl_for_site?1:0,r.critical_expired?1:0,f(`IF(AND(E${k}=1,F${k}=1,G${k}=1,H${k}=0),1,0)`),r.source_row]});
 const docs=d.documents.map((r,i)=>{const k=i+4;return [r.doc_id||`DOC-${k}`,r.supplier_id,r.material_id,r.status,n(r.days_to_expiry),f(`IF(AND(D${k}="Valid",E${k}>0),1,0)`),r.source_row]});
 const cat=d.catalog.map(r=>[r.supplier_id,r.material_id,r.source_class,r.source_class==='OFFICIAL_REVIEWED_LEAD'?1:0,0,null]);
 const master=d.supplierMaster.map(r=>[r.supplier_id,r.supplier_name,d.scope?.source_boundary||'V08_DEMO_SAMPLE']);
 const allScope=scope.supplier&&scope.supplier!=='all'?{...scope,supplier:'all'}:scope;
 const concentrationRows=(factsOverride?(factsOverride.rawPurchaseOrders||[]).filter(x=>(!scope.material||scope.material==='all'||x.material_id===scope.material)):sourcingFacts(data,{filters:allScope}).purchaseOrders).map((r,i)=>[r.id,r.supplier_id,r.material_id,r.amount_usd,r.source_row]);
 const concentrationEnd=Math.max(4,3+concentrationRows.length);
 const pr=Math.max(4,3+po.length),qr=Math.max(4,3+q.length),qualr=Math.max(4,3+qual.length),dr=Math.max(4,3+docs.length),cr=Math.max(4,3+cat.length),mr=Math.max(4,3+master.length);
 const qe=d.qmsEvents||[],qmr=Math.max(4,3+qe.length);
 const extension=extraMetricWorkbook({data,scope,factsOverride,poRows:po});
 const ops=operationalWorkbook({data,scope,factsOverride});
 const ex={
  'SRC.CANDIDATE.TOTAL':`COUNTA('Candidates_Source'!A4:A${cr})`,
  'SRC.CANDIDATE.SCENARIO':`COUNTIF('Candidates_Source'!C4:C${cr},"SCENARIO")`,
  'SRC.CANDIDATE.OFFICIAL':`COUNTIF('Candidates_Source'!C4:C${cr},"OFFICIAL_REVIEWED_LEAD")`,
  'SRC.SUPPLIER.RECORDED':`COUNTA('Master_Inputs'!A4:A${mr})`,
  'SRC.PO.COUNT':`COUNTA('PO_Inputs'!A4:A${pr})`,
  'SRC.PO.SPEND':`SUM('PO_Inputs'!G4:G${pr})`,
  'SRC.PO.QUANTITY':`SUM('PO_Inputs'!F4:F${pr})`,
  'SRC.PO.LATE_COUNT':`COUNTIF('PO_Inputs'!J4:J${pr},">0")`,
  'SRC.PO.ON_TIME_COUNT':`COUNT('PO_Inputs'!J4:J${pr})-COUNTIF('PO_Inputs'!J4:J${pr},">0")`,
  'SRC.PO.AVG_LATE_DAYS':`IFERROR(AVERAGEIF('PO_Inputs'!J4:J${pr},">0"),"")`,
  'SRC.PO.RECEIPT_RATE':`IFERROR(100*SUM('PO_Inputs'!O4:O${pr})/SUM('PO_Inputs'!F4:F${pr}),"")`,
  'SRC.PO.WEIGHTED_PRICE':`IFERROR(SUM('PO_Inputs'!G4:G${pr})/SUM('PO_Inputs'!F4:F${pr}),"")`,
  'SRC.PO.WEIGHTED_BASELINE':`IFERROR(SUM('PO_Inputs'!K4:K${pr})/SUM('PO_Inputs'!F4:F${pr}),"")`,
  'SRC.PO.OTD':`IFERROR(100*SUM('PO_Inputs'!M4:M${pr})/COUNT('PO_Inputs'!J4:J${pr}),"")`,
  'SRC.PO.PPV':`IFERROR(100*SUM('PO_Inputs'!L4:L${pr})/SUM('PO_Inputs'!K4:K${pr}),"")`,
  'SRC.QUOTE.COUNT':`COUNTA('Quotes_Inputs'!A4:A${qr})`,
  'SRC.QUOTE.AVG_LANDED':`IFERROR(AVERAGE('Quotes_Inputs'!G4:G${qr}),"")`,
  'SRC.QUOTE.BEST_LANDED':`IF(COUNT('Quotes_Inputs'!G4:G${qr})=0,"",MIN('Quotes_Inputs'!G4:G${qr}))`,
  'SRC.QUAL.COMBINATIONS':`SUM('SiteMaterial_Inputs'!I4:I${qualr})`,
  'SRC.DOC.COUNT':`COUNTA('Documents_Inputs'!A4:A${dr})`,
  'SRC.DOC.EXPIRED_COUNT':`COUNTIFS('Documents_Inputs'!E4:E${dr},"<=0",'Documents_Inputs'!E4:E${dr},"<>")`,
  'SRC.DOC.DUE_30':`COUNTIFS('Documents_Inputs'!E4:E${dr},">0",'Documents_Inputs'!E4:E${dr},"<=30")`,
  'SRC.DOC.DUE_90':`COUNTIFS('Documents_Inputs'!E4:E${dr},">0",'Documents_Inputs'!E4:E${dr},"<=90")`,
  'SRC.QUAL.RECORDED':`COUNTA('SiteMaterial_Inputs'!A4:A${qualr})`,
  'SRC.DOC.VALID_RATE':`IFERROR(100*SUM('Documents_Inputs'!F4:F${dr})/COUNTA('Documents_Inputs'!A4:A${dr}),"")`,
  'SRC.PO.BENCHMARK_SPEND':`SUM('PO_Inputs'!K4:K${pr})`,
  'SRC.PO.PPV_AMOUNT':`SUM('PO_Inputs'!L4:L${pr})`,
  'SRC.PO.ACTIVE_SUPPLIERS':`IFERROR(SUMPRODUCT(('PO_Inputs'!B4:B${pr}<>"")/COUNTIF('PO_Inputs'!B4:B${pr},'PO_Inputs'!B4:B${pr}&"")),0)`,
  'SRC.PO.AVG_ORDER_VALUE':`IFERROR(SUM('PO_Inputs'!G4:G${pr})/COUNTA('PO_Inputs'!A4:A${pr}),"")`,
  'SRC.PO.LATE_RATE':`IFERROR(100*COUNTIF('PO_Inputs'!J4:J${pr},">0")/COUNT('PO_Inputs'!J4:J${pr}),"")`,
  'SRC.PO.ON_TIME_SPEND':`SUMIF('PO_Inputs'!M4:M${pr},1,'PO_Inputs'!G4:G${pr})`,
  'SRC.QMS.EVENT_COUNT':`COUNTA('QMS_Inputs'!A4:A${qmr})`,
  'SRC.QMS.OPEN_DEVIATIONS':`COUNTIFS('QMS_Inputs'!B4:B${qmr},"DEVIATION",'QMS_Inputs'!C4:C${qmr},"<>CLOSED")`,
  'SRC.QMS.OPEN_CAPA':`COUNTIFS('QMS_Inputs'!B4:B${qmr},"CAPA",'QMS_Inputs'!C4:C${qmr},"<>CLOSED")`,
  'SRC.QMS.OVERDUE_CAPA':`COUNTIFS('QMS_Inputs'!B4:B${qmr},"CAPA",'QMS_Inputs'!C4:C${qmr},"<>CLOSED",'QMS_Inputs'!I4:I${qmr},"<"&'说明与来源'!B6)`,
  'SRC.QMS.CAPA_CLOSED_RATE':`IFERROR(100*COUNTIFS('QMS_Inputs'!B4:B${qmr},"CAPA",'QMS_Inputs'!C4:C${qmr},"CLOSED")/COUNTIF('QMS_Inputs'!B4:B${qmr},"CAPA"),"")`,
  'SRC.QMS.CRITICAL_COUNT':`COUNTIF('QMS_Inputs'!D4:D${qmr},"CRITICAL")`,
  'SRC.RISK.CONCENTRATION':`IFERROR(100*SUMIF('Concentration_Inputs'!B4:B${concentrationEnd},"${String(scope.supplier||'')}",'Concentration_Inputs'!D4:D${concentrationEnd})/SUM('Concentration_Inputs'!D4:D${concentrationEnd}),"")`
 };
 Object.assign(ex,extension.formulas,ops.formulas);
 const defs=metricIds===null?Object.keys(METRICS):metricIds;
 const metricRows=defs.map(id=>{const r=metricReport(id,{data,scope,published,factsOverride});return [id,r.label||id,r.status,typeof r.result==='number'?r.result:String(r.result??''),r.result!=null&&ex[id]?f(ex[id]):'输入不足，未输出公式结果',r.unit||'',r.numerator,r.denominator,JSON.stringify(r.scope),r.formula||'未登记',r.source_class||'未登记']});
 const H=(name,columns,rows)=>({name,rows:[[name],['非正式企业证据 · V08 DEMO / 情景目录必须隔离'],columns,...rows]});
 return createWorkbook([
 H('说明与来源',['版本','数据边界','范围'],[['2.9.21','V08 DEMO PO/报价/资格，77家情景候选不得进入Spend/OTD/PPV/正式风险',JSON.stringify(scope)],['提醒','原站DEMO不等于企业ERP/QMS/GMP证据','无数据时不能自动按0计算'],['统计基准日期',String(scope.as_of||new Date().toISOString().slice(0,10)),'QMS逾期由该固定日期重算，避免打开Excel后TODAY导致历史结果漂移']]),
 H('PO_Inputs',['PO_ID','供应商','Site','物料','日期','Qty','Amount_USD','Unit_USD','Benchmark_USD','Delay_Days','基准金额_公式','价差金额_公式','OnTime_公式','来源','Received_Qty','Unreceived_Formula'],po),
 H('Quotes_Inputs',['RFQ_ID','Supplier','Material','Unit_USD','MOQ','Freight_USD','Landed_Formula','Source'],q),
 H('SiteMaterial_Inputs',['ID','Supplier','Site','Material','Prequalified','Approved','ASL','CriticalExpired','Qualified_Formula','Source'],qual),
 H('Documents_Inputs',['Document','Supplier','Material','Status','DaysToExpiry','Valid_Formula','Source'],docs),
 H('Candidates_Source',['Supplier','Material','SourceClass','PublishedLead','Purchasable','ScenarioSpend'],cat),
 H('Master_Inputs',['Supplier','Name','Source'],master),
 H('Concentration_Inputs',['PO_ID','Supplier','Material','Amount_USD','Source'],concentrationRows),
 H('指标_逐项公式',['Metric_ID','名称','状态','服务端重算结果','Excel公式重算','单位','分子','分母','筛选范围','规则','证据级别'],metricRows),
 ...extension.sheets,
 ...ops.sheets,
 ...domainEvidenceSheets(d,scope),
 H('QMS_Inputs',['Event_ID','Kind','Status','Severity','Supplier','Site','Material','Opened','Due','Closed','Source'],qe.map(r=>[r.id,r.kind,r.status,r.severity,r.supplier_id,r.site_id,r.material_id,r.opened_at,r.due_date,r.closed_at,r.source_row])),
 ...extraSheets
 ]);
}
