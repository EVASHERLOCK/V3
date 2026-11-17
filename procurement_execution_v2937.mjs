import {simulatedExecutionRows,SIM_ASOF} from './execution_sim_v2941.mjs';
/** V2.9.37 unified procurement execution read model.
 * The uploaded nine-page HTML/CSS/business workflows remain intact.
 * Only the factual rows are supplied by existing site sample CSV; no invented
 * contract, invoice, AP payment, claim, ASN, QA approval or RFQ record is issued.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWorkbook} from './formula_workbook.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const tpl=fs.readFileSync(path.join(ROOT,'static/procurement-execution/assets/data.js'),'utf8');
const TEMPLATE=JSON.parse(tpl.slice(tpl.indexOf('=')+1).trim().replace(/;\s*$/,''));
export const PAGE_IDS=['rfq','contracts','orders','shipments','invoices','payments','claims','closing','exceptions'];
const sources={po:'purchase_orders.csv',quotes:'quotes.csv',qc:'qc_lots.csv',inventory:'inventory.csv',changes:'change_controls.csv',suppliers:'suppliers.csv',docs:'supplier_documents.csv'};
function readCSV(s){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){field+='"';i++}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x!==''))rows.push(row);row=[];}else field+=c}row.push(field);if(row.some(x=>x!==''))rows.push(row);const names=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/,'').trim());return rows.map(r=>Object.fromEntries(names.map((k,i)=>[k,r[i]??''])))}
const load=()=>Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,readCSV(fs.readFileSync(path.join(ROOT,process.env.PHARMA_DATA_MODE==='SIMULATED'&&fs.existsSync(path.join(ROOT,'seed_simulated',v))?'seed_simulated':'samples',v),'utf8'))]));
const numeric=v=>v!==undefined&&v!==null&&v!==''&&Number.isFinite(Number(v));
const num=v=>numeric(v)?Number(v):null;
const diff=(a,b)=>a&&b&&/^\d{4}-\d\d-\d\d$/.test(a)&&/^\d{4}-\d\d-\d\d$/.test(b)?Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000):null;
const month=d=>d&&/^\d{4}-\d\d/.test(d)?d.slice(0,7):'未登记';
const s=(v,missing='未登记')=>v===undefined||v===null||v===''?missing:v;
const meta={
 rfq:{source:'samples/quotes.csv',support:[],missing:'原站仅有候选报价，无受控 RFQ 编号、报价接收日期、源文件有效性或正式批准；不能计算已收报价/就绪率。'},
 contracts:{source:'未连接合同条款与受控合同版本',support:[],missing:'缺少与 PO 主键匹配的已签合同、单价、合同日期与付款条款，不将原型 CTR 记录当作公司合同。'},
 orders:{source:'samples/purchase_orders.csv',support:['orders'],missing:'24条 PO 行可核对；未连接 PR、供应商回签、确认价格与签署状态，数量确认率/回签率/价差待接入。'},
 shipments:{source:'samples/purchase_orders.csv + samples/qc_lots.csv',support:['otd','otif','late','short'],missing:'以 PO 承诺日、收货日和收货数量计算 OTD/OTIF；不推断 ASN、发运日期、温控偏差或正式 QA 放行。'},
 invoices:{source:'未连接供应商发票事实表',support:[],missing:'缺少实际发票 ID、开票数量/价格/税额、GR关联和去重键，三/四单匹配不可计算。'},
 payments:{source:'未连接 AP 实付和银行回单事实表',support:[],missing:'缺少发票主键、应付余额、付款日期、付款币种、授权记录，不能推断已付款或逾期应付。'},
 claims:{source:'未连接受控退货/RMA和索赔事实表',support:[],missing:'缺少真实 RMA、索赔金额、贷项、回款及关联证据；不将异常信号视为已发起索赔。'},
 closing:{source:'samples/purchase_orders.csv + samples/qc_lots.csv',support:['remaining'],missing:'可核算未收货数量；无发票、支付、结案审批记录，不能判断正式关单率、支付余额或已结案。'},
 exceptions:{source:'同源 PO/QC/Change 规则核查信号',support:[],missing:'展示由底层事实派生的候选信号，不是正式已建案的跨流程异常；未连接受控 case_id、审批与闭环日志。'}
};
function createRows(src){
 const qcByPO=new Map();for(const q of src.qc){if(!qcByPO.has(q.po_id))qcByPO.set(q.po_id,[]);qcByPO.get(q.po_id).push(q)}
 const orders=src.po.map(p=>({po:p.po_id,pr:'未关联PR',supplier:p.supplier_id,material:p.material_id,site:'未登记',month:month(p.created_date),po_qty:num(p.ordered_qty),po_price:num(p.unit_price),po_date:p.created_date,approval:p.approved_date?'有批准日期字段（授权待核）':'待核验',requested_date:p.promised_date,confirmed_date:'',ack_date:'',ack_price:null,ack_qty:null,pr_qty:null,source_id:p.po_id,source_file:'purchase_orders.csv'}));
 const shipments=src.po.map(p=>{const lateDays=diff(p.receipt_date,p.promised_date),ready=lateDays!==null&&numeric(p.received_qty)&&numeric(p.ordered_qty);const qty=num(p.received_qty),ordered=num(p.ordered_qty);return {po:p.po_id,asn:'未登记',supplier:p.supplier_id,material:p.material_id,site:'未登记',month:month(p.created_date),ordered_qty:ordered,ship_qty:null,received_qty:qty,promised_date:p.promised_date,arrival_date:p.receipt_date,temp_excursion:null,coa_received:null,qa_status:qcByPO.get(p.po_id)?.map(q=>q.status).join(', ')||'无对应 QC 台账',waybill:'未登记',incoterm:'未登记',ontime:ready?(lateDays<=0?1:0):null,infull:ready?(qty>=ordered?1:0):null,short_qty:ready?Math.max(0,ordered-qty):null,late_days:lateDays,late_flag:ready?(lateDays>0?1:0):null,qa_pending:null,otif:ready?(lateDays<=0&&qty>=ordered?1:0):null,source_id:p.po_id,source_file:'purchase_orders.csv'}});
 const closing=src.po.map(p=>{const ordered=num(p.ordered_qty),received=num(p.received_qty);return {po:p.po_id,supplier:p.supplier_id,material:p.material_id,site:'未登记',month:month(p.created_date),ordered_qty:ordered,received_qty:received,accepted_qty:null,invoiced_qty:null,invoice_amount:null,paid_amount:null,open_cases:null,qa_status:qcByPO.get(p.po_id)?.map(q=>q.status).join(', ')||'无对应 QC 台账',planned_close:'',actual_close:'',status:'关单状态未核验',remaining_qty:ordered!==null&&received!==null?Math.max(0,ordered-received):null,payment_balance:null,close_ready:null,closed_flag:null,on_time_close:null,overdue_close:null,source_id:p.po_id,source_file:'purchase_orders.csv'}});
 const signals=[];
 function signal(record,source,page,issue,due,when){signals.push({case_id:'SIGNAL-'+(record.po_id||record.lot_id||record.change_id),source_page:page,po:record.po_id||'未关联PO',supplier:s(record.supplier_id),material:s(record.material_id),month:month(when),issue_type:issue,amount:null,risk:'未评估',owner:'待分配',opened:when||'',due:due||'',closed:'',status:'候选信号·未正式建案',evidence_count:1,approval_status:'未经核准',rechecks:0,open_flag:null,overdue_flag:null,high_open:null,evidence_missing:null,age_days:null,close_days:null,closed_flag:null,source_id:record.po_id||record.lot_id||record.change_id,source_file:source});}
 for(const p of src.po){const d=diff(p.receipt_date,p.promised_date);if(d!==null&&d>0)signal(p,'purchase_orders.csv','shipments','已收货PO晚于承诺日',p.promised_date,p.receipt_date);if(numeric(p.ordered_qty)&&numeric(p.received_qty)&&Number(p.ordered_qty)>Number(p.received_qty))signal({...p,po_id:p.po_id+'-SHORT'},'purchase_orders.csv','shipments','收货量低于订单量',p.promised_date,p.receipt_date);}
 for(const q of src.qc)if(q.status!=='Released')signal(q,'qc_lots.csv','shipments','QC批次非Released：'+q.lot_id,'',q.gr_date);
 for(const c of src.changes)if(!['Closed','Completed'].includes(c.status))signal(c,'change_controls.csv','contracts','未关闭的变更控制影响评估',c.target_date,c.opened_date);
 const rfq=src.quotes.map((q,i)=>({rfq_id:'未登记',pr:'未登记',quote_id:'报价源行'+String(i+2),quote_version:'未登记',supplier:q.supplier_id,material:q.material_id,site:'未登记',market:'待RA核对',month:'未登记',request_qty:null,quoted_qty:null,moq:num(q.moq),quoted_unit_price:num(q.unit_price),currency:q.currency,fx_to_usd:num(q.fx_to_usd),freight_usd:num(q.freight_usd),duty_usd:null,cold_chain_usd:null,lead_days:num(q.lead_days),required_lead_days:null,rfq_issue_date:'',rfq_due_date:'',response_date:'',valid_until:'',supplier_approved:null,site_approved:null,qaa_effective:null,ra_ready:null,spec_confirmed:null,coa_sample:null,quality_docs_complete:null,incoterms:q.incoterm||'未登记',storage_condition:'待核验',origin_country:'未登记',quote_source:'samples/quotes.csv · 无受控RFQ文件',review_status:'候选报价样例·待人工复核',quote_status:'未验证为正式已收报价',order_qty:null,excess_qty:null,unit_price_usd:null,landed_cost:null,landed_per_needed:null,source_id:`quotes.csv:${i+2}`,source_file:'quotes.csv'}));
 return {rfq,contracts:[],orders,shipments,invoices:[],payments:[],claims:[],closing,exceptions:signals};
}
export function buildExecutionDataset(q={}){
 const src=load();const simulation=process.env.PHARMA_DATA_MODE==='SIMULATED';const rows=simulation?simulatedExecutionRows():createRows(src);const options={suppliers:[...new Set([...src.po.map(r=>r.supplier_id),...src.quotes.map(r=>r.supplier_id),...src.changes.map(r=>r.supplier_id)])].sort(),materials:[...new Set([...src.po.map(r=>r.material_id),...src.quotes.map(r=>r.material_id)])].sort(),months:[...new Set(src.po.map(r=>month(r.created_date)))].sort(),projects:[...new Set(src.po.map(r=>r.project_id))].sort()};
 const pages=TEMPLATE.pages.map(original=>{const config=meta[original.id];return {...original,rows:rows[original.id],site_contract:simulation?{...config,source:'SIMULATED / seed_simulated linked master tables',missing:'仅模拟交易与审批，不代表真实ERP/QMS',source_mode:'SIMULATED_FULL_CHAIN',supported_metrics:original.metrics.map(m=>m.key),rows:rows[original.id].length}:{...config,source_mode:'SITE_DEMO_RECALCULATED',supported_metrics:config.support,rows:rows[original.id].length}}});
 const page=PAGE_IDS.includes(q.page)?q.page:'orders',selection={supplier:options.suppliers.includes(q.supplier)?q.supplier:'all',material:options.materials.includes(q.material)?q.material:'all',month:options.months.includes(q.month)?q.month:'all',project:options.projects.includes(q.project)?q.project:'all'};
 const matching=r=>(selection.supplier==='all'||r.supplier===selection.supplier)&&(selection.material==='all'||r.material===selection.material)&&(selection.month==='all'||r.month===selection.month)&&(selection.project==='all'||r.project_id===selection.project);
 const selected=pages.find(p=>p.id===page);return {asof:simulation?SIM_ASOF:TEMPLATE.asof,demo:true,version:'2.9.43-integrated-execution-simulation',pages,modules:TEMPLATE.modules,source:{description:simulation?'统一模拟种子库 seed_simulated · 非 GxP':'主站同一份 samples CSV · 仅 DEMO 非 GxP',source_files:Object.values(sources),state:simulation?'V2941 LINKED SIMULATED, not enterprise ERP/QMS/RA':'V2.9.36 DEMO fixture, not enterprise ERP/QMS/RA',source_snapshot:simulation?'SIMULATED_SEED_V2941':'样例源文件（每请求即时读取）',missing:simulation?'模拟事件，仅用于演示':meta[page].missing},options,scope:selection,page,rows:selected.rows.filter(matching),row_count:selected.rows.filter(matching).length,available_metrics:simulation?selected.metrics.map(m=>m.key):meta[page].support};
}
export function browserDataSource(){const d=buildExecutionDataset();return {asof:d.asof,demo:true,pages:d.pages,modules:d.modules,version:d.version,site_sync:true};}
export function metricForPage(page,metric,records){const template=buildExecutionDataset().pages.find(p=>p.id===page);if(!template)return null;const m=template.metrics.find(x=>x.key===metric);if(!m)return null;const allowed=(process.env.PHARMA_DATA_MODE==='SIMULATED'||meta[page].support.includes(metric));if(!allowed||!records.length)return {metric:m,value:null,status:'NOT_VERIFIED',formula:m.excel_formula||m.explain,reason:meta[page].missing};
 const vs=records.map(r=>r[m.field]).filter(numeric).map(Number);if(m.op!=='count'&&vs.length!==records.length)return {metric:m,value:null,status:'SOURCE_FIELD_INCOMPLETE',reason:'源数据在当前筛选行缺少计算字段',formula:m.excel_formula||m.explain};
 const sum=vs.reduce((a,b)=>a+b,0);const denom=m.denom_field?records.reduce((a,r)=>a+(numeric(r[m.denom_field])?Number(r[m.denom_field]):0),0):0;const v=m.op==='count'?records.length:m.op==='sum'?sum:m.op==='rate'||m.op==='avg'?sum/records.length:m.op==='ratio'?(denom?sum/denom:null):m.op==='sumif'?records.filter(r=>r[m.condition_field]===m.condition_value).reduce((a,r)=>a+(numeric(r[m.field])?Number(r[m.field]):0),0):null;
 return {metric:m,value:v,status:v===null?'NOT_VERIFIED':process.env.PHARMA_DATA_MODE==='SIMULATED'?'SIMULATED_RECALCULATED':'SITE_DEMO_RECALCULATED',formula:m.excel_formula||m.explain,reason:meta[page].missing};
}
/** Full nine-stage PO key chain. No independent finance/demo values are introduced here. */
export function executionCrossflowRows(q={}){
 const selected=buildExecutionDataset(q).rows;
 if(process.env.PHARMA_DATA_MODE!=='SIMULATED')return [];
 const poids=[...new Set(selected.map(r=>r.po).filter(Boolean))];
 const r=t=>readCSV(fs.readFileSync(path.join(ROOT,'seed_simulated',t+'.csv'),'utf8'));
 const get=(t,key)=>new Map(r(t).map(v=>[v[key],v]));
 const po=get('purchase_orders','po_id'),rfq=get('quotes','po_id'),contract=get('contracts','po_id'),qc=get('qc_lots','po_id'),invoice=get('invoices','po_id'),payment=get('payments','po_id');
 const claims=new Map(),settled=get('claim_settlements','claim_id'),exceptions=new Map();
 for(const x of r('claims')){if(!claims.has(x.po_id))claims.set(x.po_id,[]);claims.get(x.po_id).push(x)}
 for(const x of r('exceptions')){if(!exceptions.has(x.po_id))exceptions.set(x.po_id,[]);exceptions.get(x.po_id).push(x)}
 const num=v=>Number(v)||0;
 return poids.map(id=>{
  const p=po.get(id),q=rfq.get(id),c=contract.get(id),lot=qc.get(id),iv=invoice.get(id),pm=payment.get(id),cl=claims.get(id)||[],ex=exceptions.get(id)||[];
  const claimed=cl.reduce((a,x)=>a+num(x.claim_amount_usd),0),recovered=cl.reduce((a,x)=>a+num(settled.get(x.claim_id)?.settlement_amount_usd),0),paid=num(pm?.payment_amount_usd),invoiceAmount=num(iv?.invoice_amount_usd);
  return {po_id:id,supplier_id:p.supplier_id,material_id:p.material_id,project_id:p.project_id,month:p.created_date.slice(0,7),rfq_id:'RFQ-'+id,awarded_quote_id:q?.quote_id||'SIMULATED_NO_AWARD',contract_id:c?.contract_id||'SIMULATED_NO_CONTRACT',lot_id:lot?.lot_id||'SIMULATED_NO_RECEIPT',invoice_id:iv?.invoice_id||'SIMULATED_NO_INVOICE',payment_id:pm?.payment_id||'SIMULATED_NO_PAYMENT',claim_ids:cl.map(x=>x.claim_id).join(';')||'SIMULATED_NONE',exception_ids:ex.map(x=>x.exception_id).join(';')||'SIMULATED_NONE',ordered_qty:num(p.ordered_qty),received_qty:num(p.received_qty),po_amount_usd:num(p.po_amount_usd),invoice_amount_usd:invoiceAmount,paid_amount_usd:paid,outstanding_usd:Math.max(0,invoiceAmount-paid),claim_amount_usd:Math.round(claimed*100)/100,recovered_amount_usd:Math.round(recovered*100)/100,unrecovered_amount_usd:Math.round((claimed-recovered)*100)/100,qa_status:lot?.status||'SIMULATED_UNASSESSED',open_claims:cl.filter(x=>x.status!=='SIMULATED_CLOSED').length,open_exceptions:ex.filter(x=>x.status!=='SIMULATED_CLOSED').length,source:'seed_simulated/purchase_orders,quotes,contracts,qc_lots,invoices,payments,claims,claim_settlements,exceptions'};
 });
}
/** Formula cells use the site's existing dependency-free XLSX generator.
 *  This works in GitHub/Bolt without a separate ExcelJS install and is testable.
 *  Missing financial/GxP source facts remain explicitly NOT_VERIFIED, never 0.
 */
export async function exportExecutionWorkbook(q={}){
 const ds=buildExecutionDataset(q),p=ds.pages.find(x=>x.id===ds.page),rec=ds.rows;
 const fields=[...new Set([...p.columns,...p.derived].map(x=>x.key))];
 // The exported row is a calculation sheet, not a copied set of derived values.
 // Each derived field is a real, editable Excel formula on the SAME source row.
 const col=n=>{let out='';for(let v=n;v;v=Math.floor((v-1)/26))out=String.fromCharCode(65+(v-1)%26)+out;return out;};
 const fieldCol=new Map(fields.map((k,i)=>[k,col(i+3)]));
 const rawMeta=new Map(p.columns.map(c=>[c.key,c]));
 const sourceCell=(key,row)=>{
   const address=fieldCol.get(key);if(!address)throw Error(`派生字段 ${p.id} 使用未登记变量 ${key}`);
   const ref=address+row,kind=rawMeta.get(key)?.kind;
   // Source ISO dates are strings: Excel must convert them before subtraction and comparison.
   return kind==='date'?`IFERROR(DATE(VALUE(LEFT(${ref},4)),VALUE(MID(${ref},6,2)),VALUE(MID(${ref},9,2))),0)`:ref;
 };
 const formulaCell=(d,row)=>{
   const names=[...d.formula.matchAll(/\{([a-zA-Z_][a-zA-Z_0-9]*)\}/g)].map(x=>x[1]);
   const base=d.formula.replace(/\{([a-zA-Z_][a-zA-Z_0-9]*)\}/g,(_,key)=>sourceCell(key,row));
   const missing=names.filter(key=>rawMeta.has(key)).map(key=>`ISBLANK(${fieldCol.get(key)}${row})`);
   // A missing source value is not a zero and must not cause a misleading positive flag.
   return missing.length?`IF(OR(${missing.join(',')}),"",${base.slice(1)})`:base.slice(1);
 };
 const dataStart=2;
 const inputRows=[['来源文件','源记录ID',...fields],...rec.map((r,i)=>{
   const row=i+dataStart;
   return [r.source_file||p.site_contract.source,r.source_id||'',...fields.map(k=>{
     if(p.derived.some(d=>d.key===k))return {formula:formulaCell(p.derived.find(d=>d.key===k),row)};
     if(r[k]===undefined||r[k]===null||r[k]==='')return '';
     return rawMeta.get(k)?.kind==='number'&&numeric(r[k])?Number(r[k]):r[k];
   })];
 })];
 const dict=[['字段键','字段名称','原型定义','来源','单位','当前核验'],...[...p.columns,...p.derived].map(c=>[c.key,c.label,c.definition||'',c.source||'',c.unit||'',rec.length&&rec.every(r=>r[c.key]!==null&&r[c.key]!==undefined&&r[c.key]!=='')?'当前行可核对':'待接入 / 含缺失'])];
 const start=2,end=rec.length+1;
 const info=[['项目','详情'],['页面',p.code+' '+p.title],['模块',q.module||'kpis'],['来源',p.site_contract.source],['数据状态','SIMULATED_FULL_CHAIN / 非企业 ERP/QMS'],['当前筛选',JSON.stringify(ds.scope)],['来源明细行数',rec.length],['数据缺口',p.site_contract.missing],['边界','全部数据来自可追溯模拟交易；不代表企业真实审批或银行付款']];
 const metrics=[['指标Key','指标名称','计算结果（当前快照）','真实Excel公式','指标定义及依赖','核验状态','不满足时的原因']];
 let formulaCount=0;
 for(const m of p.metrics){
  const k=fields.indexOf(m.field),letter=k<0?null:col(k+3),rng=letter?`'原始来源与派生'!${letter}${start}:${letter}${end}`:null;
  const allow=(process.env.PHARMA_DATA_MODE==='SIMULATED'||p.site_contract.supported_metrics.includes(m.key))&&rec.length>0;
  const fieldComplete=m.op==='count'||(rng&&rec.every(r=>numeric(r[m.field])));
  let formula=null;
  if(allow&&fieldComplete){
   if(m.op==='count')formula=`COUNTA('原始来源与派生'!B${start}:B${end})`;
   else if(m.op==='sum')formula=`SUM(${rng})`;
   else if(m.op==='sumif'){const ck=fields.indexOf(m.condition_field);if(ck>=0){const cond=`'原始来源与派生'!${col(ck+3)}${start}:${col(ck+3)}${end}`;formula=`SUMIF(${cond},${Number(m.condition_value)===1?'1':'0'},${rng})`;}}
   else if(m.op==='rate'||m.op==='avg')formula=`IFERROR(SUM(${rng})/COUNT(${rng}),"")`;
   else if(m.op==='ratio'){
    const dk=fields.indexOf(m.denom_field);
    if(dk>=0&&rec.every(r=>numeric(r[m.denom_field])))formula=`IFERROR(SUM(${rng})/SUM('原始来源与派生'!${col(dk+3)}${start}:${col(dk+3)}${end}),"")`;
   }
  }
  const source=metricForPage(p.id,m.key,rec);
  if(formula)formulaCount++;
  metrics.push([m.key,m.label,source?.value??'未核验',formula?{formula}:'缺失来源，待核验',m.excel_formula||m.explain||'',formula?'SIMULATED_RECALCULATED':'NOT_VERIFIED',formula?'Excel打开后自动重算':p.site_contract.missing]);
 }
 const reconciliation=[['来源记录ID','源工作表地址','派生字段','网页快照值','Excel公式重算值','同值校验（Excel公式）','单元格公式原文','字段说明','核验范围']];
 for(let i=0;i<rec.length;i++)for(const d of p.derived){
   const sourceRow=i+2,cell=fieldCol.get(d.key)+sourceRow,r=rec[i];
   const displayed=numeric(r[d.key])?Number(r[d.key]):'';
   const target=reconciliation.length+1;
   reconciliation.push([r.source_id||'',`原始来源与派生!${cell}`,d.key,displayed,{formula:`'原始来源与派生'!${cell}`},
     {formula:`IF(OR(NOT(ISNUMBER(D${target})),NOT(ISNUMBER(E${target}))),"MISSING",IF(ABS(D${target}-E${target})<0.000001,"MATCH","DIFF"))`},
     '='+formulaCell(d,sourceRow),d.definition||'',JSON.stringify(ds.scope)]);
 }
 const params=[['参数','演示值','说明'],['as_of',{formula:`DATE(${Number(ds.asof.slice(0,4))},${Number(ds.asof.slice(5,7))},${Number(ds.asof.slice(8,10))})`},'受控模拟数据基准日（Excel DATE）'],['price_tolerance',0.01,'报价/发票单价比较容差 USD'],['ack_days',3,'示例供应商确认 SLA 自然天'],['expiry_window',60,'示例合同到期窗口（天）']];
 // Referenced demo formulas require 参数!$B$2..$B$5; do not silently create #REF!.
 const analyses=[['步骤','分析方式','证据与逻辑'],['1','原始来源',p.site_contract.source],['2','逐行核对',`${rec.length} 行；源字段缺失则空置，不按0计算`],['3','逐指标公式',p.metrics.map(m=>m.key+'：'+(m.excel_formula||m.explain||'公式未登记')).join('\n')],['4','分维度拆解','供应商ID / 物料ID / 订单建立月份 与全站CSV同源'],['5','交叉校验','通过 PO / supplier_id / material_id / project_id 连接合同、收货、发票、付款、索赔、异常'],['6','结论边界','全部记录是 SIMULATED；真实放行、授权与银行付款必须以受控企业系统为准']];
 const gaps=[['页面','缺失字段/数据表','风险边界','复核责任','结论'],[p.title,p.site_contract.missing,'SIMULATED 数据不代表企业 ERP/QMS 已批准','模拟数据库校验','全字段已建立模拟映射']];
 // Real Excel guard formulas even when there are no verifiable invoice/payment rows.
 // These attest to presence of evidence; they do NOT masquerade as metric values.
 const validEnd=Math.max(2,end);
 const evidenceGates=[['核查对象','公式单元格','仅作为来源完整性门禁 · 不是KPI'],
 ['主键记录数',{formula:`COUNTA('原始来源与派生'!B2:B${validEnd})`},'数据来源实际行数（无记录时 0）'],
 ...p.metrics.map(metric=>[metric.key,{formula:'IF(B2=0,\"来源行缺失\",\"有来源行 · 须按指标所需字段核验\")'},metric.excel_formula||metric.explain||'公式口径待登记'])
 ];
 const crossflow=executionCrossflowRows(q);
 const joined=[['PO','供应商ID','物料ID','项目ID','月份','RFQ编号','已选报价','合同ID','QC批次','发票ID','付款ID','索赔ID','异常ID','订货量','收货量','发票额USD','已付额USD','未付余额（Excel公式）','索赔金额USD','已回收USD','索赔余额（Excel公式）','QA状态','未结索赔数','未结异常数','来源表'],...crossflow.map((r,i)=>[
   r.po_id,r.supplier_id,r.material_id,r.project_id,r.month,r.rfq_id,r.awarded_quote_id,r.contract_id,r.lot_id,r.invoice_id,r.payment_id,r.claim_ids,r.exception_ids,
   r.ordered_qty,r.received_qty,r.invoice_amount_usd,r.paid_amount_usd,{formula:`MAX(0,P${i+2}-Q${i+2})`},r.claim_amount_usd,r.recovered_amount_usd,{formula:`MAX(0,S${i+2}-T${i+2})`},r.qa_status,r.open_claims,r.open_exceptions,r.source])];
 return createWorkbook([
  {name:'跨流程PO关联与余额',rows:joined},
  {name:'口径与来源',rows:info},{name:'参数',rows:params},{name:'原始来源与派生',rows:inputRows},
  {name:'网页Excel逐格对账',rows:reconciliation},
  {name:'变量字典',rows:dict},{name:'指标计算',rows:metrics},
  {name:'分析与血缘',rows:analyses},{name:'证据缺口与复核',rows:gaps},{name:'来源完整性公式',rows:evidenceGates}
 ]);
}
