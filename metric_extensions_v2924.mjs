/** V2.9.24 source-bound extensions. Business data marked V08_DEMO_SAMPLE.
 * These MUST NOT claim that a DEMO quality event is an actual QMS record.
 * Calculations are deterministically reproduced by the exported workbook. */
const sum=(xs,field)=>xs.reduce((a,x)=>a+Number(typeof field==='function'?field(x):x[field]||0),0);
const rnd=x=>Math.round(x*10000)/10000;
const defined=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
export const EXTRA_METRICS=Object.freeze({
 'SRC.PO.RECEIVED_QTY':{label:'已收货数量',unit:'kg',formula:'SUM(PO.received_qty)',type:'po'},
 'SRC.PO.UNRECEIVED_QTY':{label:'尚未收货数量',unit:'kg',formula:'SUM(PO.qty−PO.received_qty)',type:'po'},
 'SRC.PO.INCOMPLETE_RECEIPTS':{label:'未完全收货 PO 行数',unit:'行',formula:'COUNTIF(PO.received_qty<PO.qty)',type:'po'},
 'SRC.PO.LATE_SPEND':{label:'已判定延期的 PO 金额',unit:'USD',formula:'SUM(PO.amount_usd WHERE delay_days>0)',type:'po'},
 'SRC.PO.LATE_QUANTITY':{label:'已判定延期 PO 数量',unit:'kg',formula:'SUM(PO.qty WHERE delay_days>0)',type:'po'},
 'SRC.PO.CR3_SHARE':{label:'前三大供应商 Spend 占比 CR3',unit:'%',formula:'100×TOP3供应商采购额/同范围采购总额',type:'po'},
 'SRC.PO.CR5_SHARE':{label:'前五大供应商 Spend 占比 CR5',unit:'%',formula:'100×TOP5供应商采购额/同范围采购总额',type:'po'},
 'SRC.CONTRACT.COUNT':{label:'合同登记份数',unit:'份',formula:'COUNT(合同登记)',type:'contract'},
 'SRC.CONTRACT.ACTIVE':{label:'指定基准日有效合同份数',unit:'份',formula:'COUNTIFS(status包含Active, effective<=as_of, expiry>=as_of)',type:'contract'},
 'SRC.CONTRACT.DUE90':{label:'未来90天到期合同份数',unit:'份',formula:'COUNTIFS(as_of<expiry<=as_of+90天)',type:'contract'},
 'SRC.AUDIT.COUNT':{label:'供应商审计登记数',unit:'次',formula:'COUNT(qualification.audits)',type:'audit'},
 'SRC.AUDIT.OPEN_FINDINGS':{label:'未关闭供应商审计发现项',unit:'项',formula:'SUM(findings WHERE capa_status<>Closed)',type:'audit'},
 'SRC.SAVINGS.PLANNED':{label:'台账计划降本金额',unit:'USD',formula:'SUM(spend.ledger.planned_amount)',type:'saving'},
 'SRC.SAVINGS.REALIZED':{label:'台账已确认降本金额（DEMO）',unit:'USD',formula:'SUM(realized_amount WHERE finance_approval包含signed-off)',type:'saving'},
 'SRC.SAVINGS.ATTAINMENT':{label:'降本计划达成率',unit:'%',formula:'100×台账已确认金额/台账计划金额',type:'saving'},
 'SRC.QEVENT.COUNT':{label:'原站演示质量事件数（非QMS）',unit:'条',formula:'COUNT(qualification.quality_events)',type:'qualityevent'},
 'SRC.QEVENT.OPEN':{label:'原站演示未关闭质量事件数（非QMS）',unit:'条',formula:'COUNTIF(status<>Closed)',type:'qualityevent'}
});
const dataset=(id,raw,scope)=>{
 const supplier=String(scope.supplier||'all'),material=String(scope.material||'all'),year=String(scope.year||'all');
 const match=x=>(supplier==='all'||x.supplier_id===supplier)&&(material==='all'||x.material_id===material);
 if(id.startsWith('SRC.CONTRACT.'))return {rows:(raw.purchasing?.contracts||[]).filter(match),source:'purchasing.contracts',yearSupported:false};
 if(id.startsWith('SRC.AUDIT.')){
  const eligible=new Set((raw.qualification?.sources||[]).filter(x=>x.material_id===material).map(x=>x.site_id));
  return {rows:(raw.qualification?.audits||[]).filter(x=>(supplier==='all'||x.supplier_id===supplier)&&(material==='all'||eligible.has(x.site_id))),source:'qualification.audits',yearSupported:true,dateField:'planned'};
 }
 if(id.startsWith('SRC.SAVINGS.'))return {rows:(raw.spend?.ledger||[]).filter(match),source:'spend.ledger',yearSupported:true,dateField:'start'};
 if(id.startsWith('SRC.QEVENT.'))return {rows:(raw.qualification?.quality_events||[]).filter(match),source:'qualification.quality_events',yearSupported:false};
 return null;
};
export function extraMetricReport(id,{data,scope,purchaseOrders,factsOverride,asOf}){
 const def=EXTRA_METRICS[id];if(!def)return null;
 const r={metric_id:id,id,label:def.label,unit:def.unit,formula:def.formula,weights:[],scope:{...scope,as_of:asOf},source_class:'V08_DEMO_SAMPLE',source_release:data.meta?.as_of||null,status:'DEMO_RECOMPUTABLE',result:null,numerator:null,denominator:null,rows:[],inputs:[],thresholds:[],missing:[],explanation:'可复算的V08内置演示记录，不能代替ERP/QMS正式证据。'};
 const invalid=(status,message)=>({...r,status,missing:[message]});
 if(def.type==='po'){
  if(factsOverride&&!factsOverride.has_erp_input)return invalid('INSUFFICIENT_SOURCE','企业快照没有已发布的ERP订单。');
  const p=purchaseOrders;
  if(!p.length)return invalid('INSUFFICIENT_SOURCE','范围内没有PO行，不能将无数据解释为0。');
  if(['SRC.PO.RECEIVED_QTY','SRC.PO.UNRECEIVED_QTY','SRC.PO.INCOMPLETE_RECEIPTS'].includes(id)&&p.some(x=>!defined(x.qty)||!defined(x.received)))return invalid('INSUFFICIENT_SOURCE','缺少完整收货数量；不允许按0补齐。');
  if(['SRC.PO.LATE_SPEND','SRC.PO.LATE_QUANTITY'].includes(id)&&p.some(x=>!defined(x.delay_days)||!defined(x.amount_usd)||!defined(x.qty)))return invalid('INSUFFICIENT_SOURCE','存在没有交期或金额/数量的PO行。');
  if(['SRC.PO.CR3_SHARE','SRC.PO.CR5_SHARE'].includes(id)&&scope.supplier!=='all')return invalid('REQUIRES_SCOPE','CR3/CR5需要同范围全部供应商，请清除单一供应商筛选；否则会误把单家显示为100%。');
  if(['SRC.PO.CR3_SHARE','SRC.PO.CR5_SHARE'].includes(id)&&p.some(x=>!defined(x.amount_usd)))return invalid('INSUFFICIENT_SOURCE','存在没有金额的PO行。');
  r.rows=p.map(x=>({...x}));
  if(id==='SRC.PO.RECEIVED_QTY')r.numerator=sum(p,'received');
  if(id==='SRC.PO.UNRECEIVED_QTY')r.numerator=sum(p,x=>Math.max(0,x.qty-x.received));
  if(id==='SRC.PO.INCOMPLETE_RECEIPTS')r.numerator=p.filter(x=>x.received<x.qty).length;
  if(id==='SRC.PO.LATE_SPEND')r.numerator=sum(p.filter(x=>x.delay_days>0),'amount_usd');
  if(id==='SRC.PO.LATE_QUANTITY')r.numerator=sum(p.filter(x=>x.delay_days>0),'qty');
  if(id==='SRC.PO.CR3_SHARE'||id==='SRC.PO.CR5_SHARE'){
   const groups=[...new Set(p.map(x=>x.supplier_id))].map(supplier_id=>({supplier_id,spend_usd:sum(p.filter(x=>x.supplier_id===supplier_id),'amount_usd')})).sort((a,b)=>b.spend_usd-a.spend_usd);
   r.inputs=groups;r.rows=p.map(x=>({...x}));r.numerator=sum(groups.slice(0,id==='SRC.PO.CR3_SHARE'?3:5),'spend_usd');r.denominator=sum(groups,'spend_usd');
  }
  r.result=r.denominator!==null?(r.denominator>0?rnd(r.numerator/r.denominator*100):null):rnd(r.numerator);
  if(factsOverride){r.source_class=factsOverride.scope?.source_boundary||'ENTERPRISE_RELEASED_NON_GXP';r.source_release=factsOverride.scope?.source_release;r.status='ENTERPRISE_RECOMPUTABLE_NON_GXP';r.explanation='管理员审核发布的受控企业订单来源，尚未完成GxP系统验证。';}
 }else{
  if(factsOverride)return invalid('INSUFFICIENT_SOURCE','当前企业快照不包含已核验的合同、审计、降本或演示质量事件，不能复用内置DEMO。');
  const d=dataset(id,data,scope);if(!d)return invalid('MISSING_LINEAGE','缺少源表');
  if(scope.year&&scope.year!=='all'&&!d.yearSupported)return invalid('REQUIRES_SCOPE','此源表没有可用于年度筛选的记录日期，请选择全部年份。');
  const rows=scope.year&&scope.year!=='all'?d.rows.filter(x=>String(x[d.dateField]||'').startsWith(scope.year)):d.rows;
  if(!rows.length)return invalid('INSUFFICIENT_SOURCE','筛选范围内没有登记记录。');
  const sourceArray=d.source==='purchasing.contracts'?data.purchasing.contracts:d.source==='qualification.audits'?data.qualification.audits:d.source==='spend.ledger'?data.spend.ledger:data.qualification.quality_events;
  r.rows=rows.map(x=>({...x,source_row:`${d.source}[${sourceArray.indexOf(x)}]`,source_class:'V08_DEMO_SAMPLE'}));
  if(id==='SRC.CONTRACT.COUNT'||id==='SRC.AUDIT.COUNT'||id==='SRC.QEVENT.COUNT')r.numerator=rows.length;
  if(id==='SRC.CONTRACT.ACTIVE'){r.rows=r.rows.map(x=>({...x,matched:!!(String(x.status).includes('Active')&&x.effective<=asOf&&x.expiry>=asOf)}));r.numerator=r.rows.filter(x=>x.matched).length;}
  if(id==='SRC.CONTRACT.DUE90'){const until=new Date(Date.parse(asOf+'T00:00:00Z')+90*86400000).toISOString().slice(0,10);r.rows=r.rows.map(x=>({...x,matched:!!(x.expiry>asOf&&x.expiry<=until)}));r.numerator=r.rows.filter(x=>x.matched).length;}
  if(id==='SRC.AUDIT.OPEN_FINDINGS'){if(rows.some(x=>!defined(x.findings)))return invalid('INSUFFICIENT_SOURCE','审计记录缺少发现项数量。');r.numerator=sum(rows.filter(x=>String(x.capa_status).toLowerCase()!=='closed'),'findings');}
  if(id==='SRC.SAVINGS.PLANNED'){if(rows.some(x=>!defined(x.planned_amount)))return invalid('INSUFFICIENT_SOURCE','计划金额有缺失。');r.numerator=sum(rows,'planned_amount');}
  if(id==='SRC.SAVINGS.REALIZED'||id==='SRC.SAVINGS.ATTAINMENT'){
   const approved=rows.filter(x=>String(x.finance_approval||'').toLowerCase().includes('signed-off'));
   if(approved.some(x=>!defined(x.realized_amount)))return invalid('INSUFFICIENT_SOURCE','签核台账存在未知实现金额。');
   if(id==='SRC.SAVINGS.ATTAINMENT'&&rows.some(x=>!defined(x.planned_amount)))return invalid('INSUFFICIENT_SOURCE','计划金额有缺失。');
   r.numerator=sum(approved,'realized_amount');if(id==='SRC.SAVINGS.ATTAINMENT')r.denominator=sum(rows,'planned_amount');
   r.rows=r.rows.map(x=>({...x,recognized:approved.some(v=>v.project_id===x.project_id)}));
  }
  if(id==='SRC.QEVENT.OPEN'){r.rows=r.rows.map(x=>({...x,matched:String(x.status||'').toLowerCase()!=='closed'}));r.numerator=r.rows.filter(x=>x.matched).length;}
  r.result=r.denominator!==null?(r.denominator>0?rnd(r.numerator/r.denominator*100):null):rnd(r.numerator);
 }
 if(r.result==null)return invalid('INSUFFICIENT_SOURCE','分母不存在或等于0，不输出计算值。');
 return r;
}
export function extraMetricWorkbook({data,scope={},factsOverride=null,poRows=[]}){
 const demo=!factsOverride;
 const use=x=>!scope.supplier||scope.supplier==='all'||x.supplier_id===scope.supplier;
 const useMat=x=>!scope.material||scope.material==='all'||x.material_id===scope.material;
 const rows=(category)=>demo?(category||[]).filter(x=>use(x)&&useMat(x)):[];
 const c=rows(data.purchasing?.contracts),s=rows(data.spend?.ledger).filter(x=>!scope.year||scope.year==='all'||String(x.start||'').startsWith(scope.year)),e=rows(data.qualification?.quality_events);
 const audits=demo?(data.qualification?.audits||[]).filter(use).filter(x=>!scope.material||scope.material==='all'||(data.qualification?.sources||[]).some(q=>q.material_id===scope.material&&q.site_id===x.site_id)).filter(x=>!scope.year||scope.year==='all'||String(x.planned||'').startsWith(scope.year)):[];
 const asOf=String(scope.as_of||new Date().toISOString().slice(0,10));
 const H=(name,head,records)=>({name,rows:[[name],['V08 DEMO only · enterprise snapshots do not carry these tables'],head,...records]});
 const contracts=c.map((x,i)=>{const k=i+4;return [x.contract_id,x.supplier_id,x.material_id,x.status,x.effective,x.expiry,x.unit_price,{formula:`IF(AND(ISNUMBER(SEARCH("Active",D${k})),DATEVALUE(E${k})<=DATEVALUE('说明与来源'!B6),DATEVALUE(F${k})>=DATEVALUE('说明与来源'!B6)),1,0)`},{formula:`IF(AND(DATEVALUE(F${k})>DATEVALUE('说明与来源'!B6),DATEVALUE(F${k})<=DATEVALUE('说明与来源'!B6)+90),1,0)`}]});
 const auditRows=audits.map(x=>[x.audit_id,x.supplier_id,x.site_id,x.planned,x.findings,x.capa_status]);
 const savings=s.map((x,i)=>{const k=i+4;return [x.project_id,x.supplier_id,x.material_id,x.start,x.planned_amount,x.realized_amount,x.finance_approval,x.status,{formula:`IF(ISNUMBER(SEARCH("signed-off",G${k})),F${k},0)`}]});
 const qEvents=e.map(x=>[x.event_id,x.supplier_id,x.material_id,x.status,x.capa_id]);
 const suppliers=[...new Set(poRows.map(x=>x[1]))];
 const poEnd=Math.max(4,3+poRows.length),agEnd=Math.max(4,3+suppliers.length),contractEnd=Math.max(4,3+c.length),auditEnd=Math.max(4,3+audits.length),savEnd=Math.max(4,3+s.length),evEnd=Math.max(4,3+e.length);
 const agg=suppliers.map((supplier,i)=>[supplier,{formula:`SUMIF('PO_Inputs'!B4:B${poEnd},A${i+4},'PO_Inputs'!G4:G${poEnd})`}]);
 const largest=k=>Array.from({length:k},(_,i)=>`IFERROR(LARGE('Supplier_Agg'!B4:B${agEnd},${i+1}),0)`).join(',');
 const formulas={
  'SRC.PO.RECEIVED_QTY':`SUM('PO_Inputs'!O4:O${poEnd})`,
  'SRC.PO.UNRECEIVED_QTY':`SUM('PO_Inputs'!P4:P${poEnd})`,
  'SRC.PO.INCOMPLETE_RECEIPTS':`SUMPRODUCT(--('PO_Inputs'!O4:O${poEnd}<'PO_Inputs'!F4:F${poEnd}))`,
  'SRC.PO.LATE_SPEND':`SUMIF('PO_Inputs'!J4:J${poEnd},">0",'PO_Inputs'!G4:G${poEnd})`,
  'SRC.PO.LATE_QUANTITY':`SUMIF('PO_Inputs'!J4:J${poEnd},">0",'PO_Inputs'!F4:F${poEnd})`,
  'SRC.PO.CR3_SHARE':`IFERROR(100*SUM(${largest(3)})/SUM('PO_Inputs'!G4:G${poEnd}),"")`,
  'SRC.PO.CR5_SHARE':`IFERROR(100*SUM(${largest(5)})/SUM('PO_Inputs'!G4:G${poEnd}),"")`,
  'SRC.CONTRACT.COUNT':`COUNTA('Contract_Inputs'!A4:A${contractEnd})`,
  'SRC.CONTRACT.ACTIVE':`SUM('Contract_Inputs'!H4:H${contractEnd})`,
  'SRC.CONTRACT.DUE90':`SUM('Contract_Inputs'!I4:I${contractEnd})`,
  'SRC.AUDIT.COUNT':`COUNTA('Audit_Inputs'!A4:A${auditEnd})`,
  'SRC.AUDIT.OPEN_FINDINGS':`SUMIF('Audit_Inputs'!F4:F${auditEnd},"<>Closed",'Audit_Inputs'!E4:E${auditEnd})`,
  'SRC.SAVINGS.PLANNED':`SUM('Savings_Inputs'!E4:E${savEnd})`,
  'SRC.SAVINGS.REALIZED':`SUM('Savings_Inputs'!I4:I${savEnd})`,
  'SRC.SAVINGS.ATTAINMENT':`IFERROR(100*SUM('Savings_Inputs'!I4:I${savEnd})/SUM('Savings_Inputs'!E4:E${savEnd}),"")`,
  'SRC.QEVENT.COUNT':`COUNTA('Demo_Quality_Events'!A4:A${evEnd})`,
  'SRC.QEVENT.OPEN':`COUNTIFS('Demo_Quality_Events'!D4:D${evEnd},"<>Closed",'Demo_Quality_Events'!A4:A${evEnd},"<>")`
 };
 return {formulas,sheets:[
  H('Contract_Inputs',['Contract','Supplier','Material','Status','Effective','Expiry','Unit','Is_Active','Due_90'],contracts),
  H('Audit_Inputs',['Audit','Supplier','Site','Planned','Findings','CAPA_Status'],auditRows),
  H('Savings_Inputs',['Project','Supplier','Material','Start','Planned','Realized','Finance','Status','Recognized'],savings),
  H('Demo_Quality_Events',['Event','Supplier','Material','Status','CAPA'],qEvents),
  H('Supplier_Agg',['Supplier','PO_Spend'],agg)
 ]};
}
