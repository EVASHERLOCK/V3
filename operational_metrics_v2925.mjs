/** V2.9.25: additional evidence-bound operational DEMO metrics.
 * No ERP/QMS snapshot reuse: these source types have not been integrated.
 */
export const OP_METRICS=Object.freeze({
 'SRC.INVOICE.COUNT':{label:'发票登记数量',unit:'行',formula:'COUNT(发票登记ID)',type:'ops'},
 'SRC.INVOICE.MATCHED':{label:'三单匹配发票数',unit:'行',formula:'COUNTIF(match_status="Matched")',type:'ops'},
 'SRC.INVOICE.MATCH_RATE':{label:'发票三单匹配率',unit:'%',formula:'100×匹配发票数/全部发票数',type:'ops'},
 'SRC.INVOICE.EXCEPTIONS':{label:'发票匹配异常行数',unit:'行',formula:'COUNTIF(match_status<>"Matched")',type:'ops'},
 'SRC.INVOICE.OVERDUE':{label:'逾期未付发票数',unit:'行',formula:'COUNTIF(paid=false 且 due_date<统计基准日)',type:'ops'},
 'SRC.INVOICE.AMOUNT':{label:'发票登记总金额（演示）',unit:'DEMO-USD',formula:'SUM(invoice_amount)',type:'ops'},
 'SRC.CHANGE.COUNT':{label:'变更控制登记数',unit:'项',formula:'COUNT(change_id)',type:'ops'},
 'SRC.CHANGE.OPEN':{label:'未关闭变更控制数',unit:'项',formula:'COUNTIF(change_status<>Closed)',type:'ops'},
 'SRC.CHANGE.HIGH':{label:'高严重度变更控制数',unit:'项',formula:'COUNTIF(severity=HIGH)',type:'ops',description:'严重度是演示场景标记，并非正式 QA 风险评级。'},
 'SRC.WORKFLOW.RUNS':{label:'演示工作流执行记录数',unit:'次',formula:'COUNT(run_id)',type:'ops'},
 'SRC.WORKFLOW.FAILURES':{label:'演示工作流失败次数',unit:'次',formula:'COUNTIF(status=Failed)',type:'ops'},
 'SRC.WORKFLOW.SUCCESS_RATE':{label:'演示工作流成功率',unit:'%',formula:'100×COUNTIF(status=Completed)/COUNT(run_id)',type:'ops'},
 'SRC.WORKFLOW.AVG_MS':{label:'演示工作流平均耗时',unit:'ms',formula:'SUM(duration_ms)/COUNT(duration_ms)',type:'ops'},
 'SRC.INVENTORY.LOTS':{label:'库存批次登记数量',unit:'批',formula:'COUNT(lot_id)',type:'ops'},
 'SRC.INVENTORY.QC_HOLD':{label:'尚未放行库存批次数',unit:'批',formula:'COUNTIF(status<>Released)',type:'ops'},
 'SRC.INVENTORY.RETEST_90':{label:'90天内到期/复验的库存批次数',unit:'批',formula:'COUNTIF(min(expiry_date,retest_date)<=基准日+90天)',type:'ops'},
 'SRC.MASTER.MATERIALS':{label:'原站主数据物料条目数',unit:'项',formula:'COUNT(唯一 material_id)',type:'ops'},
 'SRC.MASTER.SUPPLIERS':{label:'原站主数据供应商条目数',unit:'家',formula:'COUNT(唯一 supplier_id)',type:'ops'},
 'SRC.REG.FILINGS':{label:'法规申报关联登记数',unit:'条',formula:'COUNT(变更关联的法规申报记录)',type:'ops'},
 'SRC.ALERT.HIGH':{label:'演示规则高风险预警数',unit:'条',formula:'COUNTIF(规则预警 severity=HIGH)',type:'ops',description:'是由 V08 DEMO 规则生成的预警，不代表真实监管风险事件。'}
});
const round=(x)=>Math.round(x*10000)/10000;
const empty=(r,status,msg)=>({...r,status,result:null,numerator:null,denominator:null,missing:[msg]});
const asOfDate=x=>new Date(x+'T00:00:00Z');
const match=(row,scope)=>['supplier','material'].every(k=>!scope[k]||scope[k]==='all'||row[k+'_id']===scope[k]);
function sourceRows(id,data,scope){
 const raw=id.startsWith('SRC.INVOICE.')?data.p2p?.invoices:id.startsWith('SRC.CHANGE.')?data.change?.changes:id.startsWith('SRC.WORKFLOW.')?data.workflow?.runs:id.startsWith('SRC.INVENTORY.')?data.material?.lots:id==='SRC.MASTER.MATERIALS'?data.master?.materials:id==='SRC.MASTER.SUPPLIERS'?data.master?.suppliers:id.startsWith('SRC.REG.')?data.change?.filings:id.startsWith('SRC.ALERT.')?data.actions?.alerts:null;
 const path=id.startsWith('SRC.INVOICE.')?'p2p.invoices':id.startsWith('SRC.CHANGE.')?'change.changes':id.startsWith('SRC.WORKFLOW.')?'workflow.runs':id.startsWith('SRC.INVENTORY.')?'material.lots':id==='SRC.MASTER.MATERIALS'?'master.materials':id==='SRC.MASTER.SUPPLIERS'?'master.suppliers':id.startsWith('SRC.REG.')?'change.filings':'actions.alerts';
 const dateField=id.startsWith('SRC.INVOICE.')?'invoice_date':id.startsWith('SRC.CHANGE.')?'opened_date':id.startsWith('SRC.WORKFLOW.')?'date':null;
 const noDates=scope.year&&scope.year!=='all'&&!dateField;
 if(noDates)return {error:'此来源不具备可审计的年份字段，不能对该指标进行年度筛选。'};
 return {path,rows:(raw||[]).map((x,i)=>({...x,source_row:`${path}[${i}]`,source_class:'V08_DEMO_SAMPLE'})).filter(x=>match(x,scope)&&(!scope.year||scope.year==='all'||String(x[dateField]||'').startsWith(scope.year)))};
}
export function operationalMetricReport(id,{data,scope={},factsOverride,asOf}){
 const def=OP_METRICS[id];if(!def)return null;
 let r={id,metric_id:id,label:def.label,unit:def.unit,formula:def.formula,source_class:'V08_DEMO_SAMPLE',source_release:data.meta?.as_of||null,scope:{...scope,as_of:asOf},status:'DEMO_RECOMPUTABLE',result:null,numerator:null,denominator:null,rows:[],inputs:[],weights:[],thresholds:[],missing:[],explanation:def.description||'仅用于内置演示账本。企业来源 API 快照目前只有 ERP PO 与 QMS 事件，不包含本源表。'};
 if(factsOverride)return empty(r,'INSUFFICIENT_SOURCE','未接入该企业来源业务域；禁止复用演示发票、合同、库存或主数据。');
 const d=sourceRows(id,data,scope);if(d.error)return empty(r,'REQUIRES_SCOPE',d.error);
 if(!d.rows.length)return empty(r,'INSUFFICIENT_SOURCE','该筛选范围无登记记录；不能把未知业务数据当0。');
 r.rows=d.rows;const R=d.rows,v=id.split('.').pop();
 const matched=x=>String(x.match_status||'')==='Matched';
 if(id==='SRC.INVOICE.COUNT'||id==='SRC.CHANGE.COUNT'||id==='SRC.WORKFLOW.RUNS'||id==='SRC.INVENTORY.LOTS'||id==='SRC.REG.FILINGS')r.numerator=R.length;
 else if(id==='SRC.INVOICE.MATCHED')r.numerator=R.filter(matched).length;
 else if(id==='SRC.INVOICE.EXCEPTIONS')r.numerator=R.filter(x=>!matched(x)).length;
 else if(id==='SRC.INVOICE.MATCH_RATE'){r.numerator=R.filter(matched).length;r.denominator=R.length;}
 else if(id==='SRC.INVOICE.OVERDUE'){
  if(R.some(x=>!x.due_date||typeof x.paid!=='boolean'))return empty(r,'INSUFFICIENT_SOURCE','发票缺少可核验的应付日期或付款状态');
  r.numerator=R.filter(x=>!x.paid&&x.due_date<asOf).length;
 }
 else if(id==='SRC.INVOICE.AMOUNT'){
  if(R.some(x=>x.invoice_amount==null||!Number.isFinite(Number(x.invoice_amount))))return empty(r,'INSUFFICIENT_SOURCE','发票金额存在缺失');
  r.numerator=R.reduce((s,x)=>s+Number(x.invoice_amount),0);
 }
 else if(id==='SRC.CHANGE.OPEN')r.numerator=R.filter(x=>String(x.status).toLowerCase()!=='closed').length;
 else if(id==='SRC.CHANGE.HIGH')r.numerator=R.filter(x=>x.severity==='HIGH').length;
 else if(id==='SRC.WORKFLOW.FAILURES')r.numerator=R.filter(x=>x.status==='Failed').length;
 else if(id==='SRC.WORKFLOW.SUCCESS_RATE'){r.numerator=R.filter(x=>x.status==='Completed').length;r.denominator=R.length;}
 else if(id==='SRC.WORKFLOW.AVG_MS'){
  const valid=R.filter(x=>x.duration_ms!=null&&Number.isFinite(Number(x.duration_ms)));
  if(valid.length!==R.length)return empty(r,'INSUFFICIENT_SOURCE','工作流记录缺少 duration_ms');
  r.numerator=valid.reduce((s,x)=>s+Number(x.duration_ms),0);r.denominator=valid.length;
 }
 else if(id==='SRC.INVENTORY.QC_HOLD')r.numerator=R.filter(x=>x.status!=='Released').length;
 else if(id==='SRC.INVENTORY.RETEST_90'){
  if(R.some(x=>!x.expiry_date&&!x.retest_date))return empty(r,'INSUFFICIENT_SOURCE','库存批次没有到期/复验日期');
  const cut=asOfDate(asOf).getTime()+90*864e5;
  r.numerator=R.filter(x=>Math.min(...[x.expiry_date,x.retest_date].filter(Boolean).map(x=>asOfDate(x).getTime()))<=cut).length;
 }
 else if(id==='SRC.MASTER.MATERIALS')r.numerator=new Set(R.map(x=>x.material_id)).size;
 else if(id==='SRC.MASTER.SUPPLIERS')r.numerator=new Set(R.map(x=>x.supplier_id)).size;
 else if(id==='SRC.ALERT.HIGH')r.numerator=R.filter(x=>x.severity==='HIGH').length;
 r.result=r.denominator!=null?(r.denominator>0?round(r.numerator/r.denominator*(id.endsWith('RATE')?100:1)):null):round(r.numerator);
 if(r.result==null)return empty(r,'INSUFFICIENT_SOURCE','没有可使用的计算分母。');
 r.explanation+=` 源表：${d.path}；实际纳入 ${R.length} 条；统计基准日 ${asOf}；未知值不自动填0。`;
 return r;
}
const F=x=>({formula:x});
const sheet=(name,columns,rows)=>({name,rows:[[name],['数据来源：V08 DEMO，非 ERP/QMS 正式证据'],columns,...rows]});
export function operationalWorkbook({data,scope={},factsOverride}={}){
 const empty=factsOverride;
 const rows=id=>empty?[]:sourceRows(id,data,scope).rows||[];
 const inv=rows('SRC.INVOICE.COUNT'),changes=rows('SRC.CHANGE.COUNT'),work=rows('SRC.WORKFLOW.RUNS'),lots=rows('SRC.INVENTORY.LOTS'),mat=rows('SRC.MASTER.MATERIALS'),sups=rows('SRC.MASTER.SUPPLIERS'),reg=rows('SRC.REG.FILINGS'),alerts=rows('SRC.ALERT.HIGH');
 const end=a=>Math.max(4,3+a.length),date="'说明与来源'!B6";
 const formula={
  'SRC.INVOICE.COUNT':`COUNTA('Ops_Invoices'!A4:A${end(inv)})`,
  'SRC.INVOICE.MATCHED':`COUNTIF('Ops_Invoices'!E4:E${end(inv)},"Matched")`,
  'SRC.INVOICE.EXCEPTIONS':`COUNTIFS('Ops_Invoices'!E4:E${end(inv)},"<>Matched",'Ops_Invoices'!A4:A${end(inv)},"<>")`,
  'SRC.INVOICE.MATCH_RATE':`IFERROR(100*COUNTIF('Ops_Invoices'!E4:E${end(inv)},"Matched")/COUNTA('Ops_Invoices'!A4:A${end(inv)}),"")`,
  'SRC.INVOICE.OVERDUE':`COUNTIFS('Ops_Invoices'!F4:F${end(inv)},0,'Ops_Invoices'!G4:G${end(inv)},"<"&${date},'Ops_Invoices'!A4:A${end(inv)},"<>")`,
  'SRC.INVOICE.AMOUNT':`SUM('Ops_Invoices'!H4:H${end(inv)})`,
  'SRC.CHANGE.COUNT':`COUNTA('Ops_Changes'!A4:A${end(changes)})`,
  'SRC.CHANGE.OPEN':`COUNTIFS('Ops_Changes'!C4:C${end(changes)},"<>Closed",'Ops_Changes'!A4:A${end(changes)},"<>")`,
  'SRC.CHANGE.HIGH':`COUNTIF('Ops_Changes'!D4:D${end(changes)},"HIGH")`,
  'SRC.WORKFLOW.RUNS':`COUNTA('Ops_Workflow'!A4:A${end(work)})`,
  'SRC.WORKFLOW.FAILURES':`COUNTIF('Ops_Workflow'!C4:C${end(work)},"Failed")`,
  'SRC.WORKFLOW.SUCCESS_RATE':`IFERROR(100*COUNTIF('Ops_Workflow'!C4:C${end(work)},"Completed")/COUNTA('Ops_Workflow'!A4:A${end(work)}),"")`,
  'SRC.WORKFLOW.AVG_MS':`IFERROR(AVERAGE('Ops_Workflow'!D4:D${end(work)}),"")`,
  'SRC.INVENTORY.LOTS':`COUNTA('Ops_Lots'!A4:A${end(lots)})`,
  'SRC.INVENTORY.QC_HOLD':`COUNTIFS('Ops_Lots'!C4:C${end(lots)},"<>Released",'Ops_Lots'!A4:A${end(lots)},"<>")`,
  'SRC.INVENTORY.RETEST_90':`SUM('Ops_Lots'!F4:F${end(lots)})`,
  'SRC.MASTER.MATERIALS':`COUNTA('Ops_Materials'!A4:A${end(mat)})`,
  'SRC.MASTER.SUPPLIERS':`COUNTA('Ops_Suppliers'!A4:A${end(sups)})`,
  'SRC.REG.FILINGS':`COUNTA('Ops_Filings'!A4:A${end(reg)})`,
  'SRC.ALERT.HIGH':`COUNTIF('Ops_Alerts'!C4:C${end(alerts)},"HIGH")`
 };
 const lotRows=lots.map((x,i)=>{const k=i+4;return [x.lot_id,x.material_id,x.status,x.expiry_date,x.retest_date,F(`IF(OR(AND(D${k}<>"",DATEVALUE(D${k})<=DATEVALUE(${date})+90),AND(E${k}<>"",DATEVALUE(E${k})<=DATEVALUE(${date})+90)),1,0)`)]});
 return {formulas:formula,sheets:[
  sheet('Ops_Invoices',['Invoice','Supplier','Material','Invoice_Date','Match_Status','Paid(1/0)','Due_Date','Amount'],inv.map(x=>[x.invoice_id,x.supplier_id,x.material_id,x.invoice_date,x.match_status,x.paid?1:0,x.due_date,x.invoice_amount])),
  sheet('Ops_Changes',['Change_ID','Material','Status','Severity','Date'],changes.map(x=>[x.change_id,x.material_id,x.status,x.severity,x.opened_date])),
  sheet('Ops_Workflow',['Run_ID','Date','Status','Duration_ms'],work.map(x=>[x.run_id,x.date,x.status,x.duration_ms])),
  sheet('Ops_Lots',['Lot_ID','Material','Status','Expiry','Retest','Within90_Formula'],lotRows),
  sheet('Ops_Materials',['Material_ID','Name'],mat.map(x=>[x.material_id,x.name])),
  sheet('Ops_Suppliers',['Supplier_ID','Name'],sups.map(x=>[x.supplier_id,x.supplier_name])),
  sheet('Ops_Filings',['Change_ID','Market','Product'],reg.map(x=>[x.change_id,x.market,x.product_id])),
  sheet('Ops_Alerts',['Alert_ID','Type','Severity'],alerts.map(x=>[x.id,x.type,x.severity]))
 ]}
}
