/** V2.9.42 – 115 independent KPI mappings for STRICTLY SIMULATED events.
 * Data lineage: one metric_event per PO, joined by po_id to canonical supplier,
 * material, project, GR/QC, inventory, invoice/payment and production tables.
 * These are scenario observations and simulated attestations, NOT actual QA/RA/Finance approvals.
 */
import {explainMetric} from './decision_center_definitions_v2935.mjs';
const registry=new Map();
const reg=(id,type,fields=[],note='')=>{if(registry.has(id))throw Error('Duplicate KPI mapping '+id);registry.set(id,{id,type,fields,note});};
const S=(id,field)=>reg(id,'sum',[field]);
const A=(id,field)=>reg(id,'avg',[field]);
const P=(id,field)=>reg(id,'pct_flag',[field]);
const R=(id,num,den)=>reg(id,'pct_ratio',[num,den]);
const C=(id,field)=>reg(id,'count_flag',[field]);
const D=(id,field,by)=>reg(id,'distinct',[field,by]);
const PD=(id,field,by)=>reg(id,'pct_distinct',[field,by]);
const X=(id,type,fields=[],note='')=>reg(id,type,fields,note);
// 01 Spend, savings and budget – monetary events are joined to the same PO ledger.
S('KPI-01-01','amount_usd'); S('KPI-01-02','top30_spend_usd'); X('KPI-01-03','ppv',['amount_usd','benchmark_amount_usd']);
S('KPI-01-04','approved_savings_usd');R('KPI-01-05','approved_savings_usd','savings_target_usd');S('KPI-01-06','cost_avoidance_usd');
R('KPI-01-07','amount_usd','budget_usd');X('KPI-01-08','difference',['amount_usd','budget_usd']);X('KPI-01-09','reduction',['old_tco_usd','new_tco_usd']);
S('KPI-01-10','expedite_fee_usd');S('KPI-01-11','fx_exposure_usd');
// 02 Sourcing, technical, research portfolio.
P('KPI-02-01','sourcing_project_ontime');S('KPI-02-02','approved_savings_usd');A('KPI-02-03','rfq_days');A('KPI-02-04','onboard_days');
P('KPI-02-05','production_readiness_flag');P('KPI-02-06','research_milestone_ontime');X('KPI-02-07','difference_pct',['amount_usd','budget_usd']);
P('KPI-02-08','technical_ready');R('KPI-02-09','approved_savings_usd','savings_target_usd');P('KPI-02-10','early_procurement');
// 03 P2P cycle: monetary exposure matches PO quantity × unit price, not confirmed financial loss.
X('KPI-03-01','count');C('KPI-03-02','late_flag');X('KPI-03-03','flag_amount',['late_flag','amount_usd']);P('KPI-03-04','otif_flag');
A('KPI-03-05','pr_po_days');P('KPI-03-06','po_first_correct');R('KPI-03-07','covered_spend_usd','amount_usd');
X('KPI-03-08','inverse_ratio',['covered_spend_usd','amount_usd']);P('KPI-03-09','contract_renewed');P('KPI-03-10','supplier_ack_ontime');
X('KPI-03-11','inverse_pct',['match3']);X('KPI-03-12','po_per_fte');A('KPI-03-13','po_admin_cost_usd');
// 04 MRP: quantities are compared only within a single PO/material unit.
P('KPI-04-01','production_readiness_flag');D('KPI-04-02','material_id','high_material_risk');S('KPI-04-03','shortage_amount_usd');
A('KPI-04-04','stock_days');X('KPI-04-05','forecast_accuracy',['forecast_qty','actual_qty']);P('KPI-04-06','shortage_flag');
C('KPI-04-07','shortage_flag');P('KPI-04-08','mitigation_ontime');R('KPI-04-09','supply_committed','quantity_required');P('KPI-04-10','expedite_flag');
// 05 Inventory: normalized lot units are SIMULATED approximations, not convertible pharmaceutical units.
X('KPI-05-01','distinct',['lot_id']);S('KPI-05-02','usable_inventory_qty');P('KPI-05-03','stock_safety_ok');A('KPI-05-04','stock_days');
A('KPI-05-05','stock_days');R('KPI-05-06','hold_inventory_value_usd','inventory_value_usd');
X('KPI-05-07','loss_variance',['inventory_loss_qty','inventory_loss_baseline_qty']);S('KPI-05-08','inventory_value_usd');S('KPI-05-09','near_expiry_value_usd');
X('KPI-05-10','inverse_pct',['stock_qualified']);X('KPI-05-11','turnover',['consumed_value_usd','inventory_value_usd']);
// 06 Supplier delivery and QA event attestations.
P('KPI-06-01','ontime_flag');A('KPI-06-02','supplier_score');A('KPI-06-03','supplier_research_score');P('KPI-06-04','qc_first_pass');
C('KPI-06-05','quality_incident');P('KPI-06-06','capa_ontime');X('KPI-06-07','stddev',['delivery_variance_days']);P('KPI-06-08','major_response_ontime');
P('KPI-06-09','quality_recurrence');P('KPI-06-10','inbound_ontime');
// 07 Quality, documents, source scope.
R('KPI-07-01','approved_spend_usd','amount_usd');P('KPI-07-02','qaa_valid');C('KPI-07-03','audit_overdue');P('KPI-07-04','gmp_valid');
P('KPI-07-05','approved_source_link_valid');C('KPI-07-06','audit_finding_overdue');P('KPI-07-07','change_notice_ontime');
C('KPI-07-08','restricted_source_order');X('KPI-07-09','cert_90_days');P('KPI-07-10','cold_chain_compliant');
// 08 Change control – the first two KPIs use real simulated change event IDs.
X('KPI-08-01','open_changes');X('KPI-08-02','high_risk_changes');P('KPI-08-03','work_package_ontime');P('KPI-08-04','dossier_ontime');
P('KPI-08-05','validation_sample_ontime');P('KPI-08-06','validation_batch_ontime');P('KPI-08-07','technical_evidence_ready');
P('KPI-08-08','ra_market_ready');C('KPI-08-09','ra_blocked');P('KPI-08-10','change_milestone_ontime');C('KPI-08-11','change_notice_gap');C('KPI-08-12','post_change_incident');
// 09 Top30 and strategic supplier/material concentration.
X('KPI-09-01','distinct',['product_line_id']);R('KPI-09-02','top30_spend_usd','amount_usd');D('KPI-09-03','product_line_id','shortage_flag');
D('KPI-09-04','material_id','single_source_material');D('KPI-09-05','supplier_id','high_supplier_risk');PD('KPI-09-06','material_id','second_source_approved');
X('KPI-09-07','top_suppliers');P('KPI-09-08','strategic_event_ready');P('KPI-09-09','source_switch_ready');C('KPI-09-10','strategy_issue_open');
// 10 Inbound and risk mitigation.
P('KPI-10-01','inbound_ontime');C('KPI-10-02','temperature_excursion');P('KPI-10-03','customs_delayed');R('KPI-10-04','expedite_fee_usd','freight_base_usd');
P('KPI-10-05','bcp_effective');X('KPI-10-06','top_country');D('KPI-10-07','supplier_id','financial_risk');
R('KPI-10-08','capacity_committed','quantity_required');P('KPI-10-09','transport_compliant');
// 11 Action/control process.
C('KPI-11-01','high_action_overdue');P('KPI-11-02','action_closed_ontime');P('KPI-11-03','improvement_verified');P('KPI-11-04','data_fresh');
P('KPI-11-05','kpi_target_valid');P('KPI-11-06','source_link_valid');P('KPI-11-07','digitally_processed');A('KPI-11-08','requester_satisfaction');P('KPI-11-09','training_authorized');

export const SIM_KPI_REGISTRY=registry;
export const allSimulationMappings=()=>[...registry.values()];
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const sum=(rows,f)=>rows.reduce((s,x)=>s+num(f(x)),0);
const unique=(rows,key,flag)=>new Set(rows.filter(r=>!flag||num(r[flag])>0).map(r=>r[key]).filter(Boolean));
const round=x=>Number(x.toFixed(2));
const excelL=i=>{let s='';while(i){s=String.fromCharCode(65+(i-1)%26)+s;i=Math.floor((i-1)/26)}return s};
const safeDiv=(a,b)=>b? a/b:0;
function evaluate(spec, rows, source){
 const [a,b]=spec.fields;let numerator=null,denominator=null,value=0;
 switch(spec.type){
  case 'count':value=numerator=rows.length;break;
  case 'sum':value=numerator=sum(rows,r=>r[a]);break;
  case 'avg':numerator=sum(rows,r=>r[a]);denominator=rows.length;value=safeDiv(numerator,denominator);break;
  case 'count_flag':value=numerator=sum(rows,r=>Number(r[a])>0?1:0);denominator=rows.length;break;
  case 'pct_flag':numerator=sum(rows,r=>Number(r[a])>0?1:0);denominator=rows.length;value=100*safeDiv(numerator,denominator);break;
  case 'inverse_pct':numerator=sum(rows,r=>Number(r[a])===0?1:0);denominator=rows.length;value=100*safeDiv(numerator,denominator);break;
  case 'pct_ratio':numerator=sum(rows,r=>r[a]);denominator=sum(rows,r=>r[b]);value=100*safeDiv(numerator,denominator);break;
  case 'inverse_ratio':numerator=sum(rows,r=>num(r[b])-num(r[a]));denominator=sum(rows,r=>r[b]);value=100*safeDiv(numerator,denominator);break;
  case 'difference':numerator=sum(rows,r=>num(r[a])-num(r[b]));value=numerator;break;
  case 'difference_pct':numerator=sum(rows,r=>num(r[a])-num(r[b]));denominator=sum(rows,r=>r[b]);value=100*safeDiv(numerator,denominator);break;
  case 'ppv':numerator=sum(rows,r=>num(r[a])-num(r[b]));denominator=sum(rows,r=>r[b]);value=100*safeDiv(numerator,denominator);break;
  case 'reduction':numerator=sum(rows,r=>num(r[a])-num(r[b]));denominator=sum(rows,r=>r[a]);value=100*safeDiv(numerator,denominator);break;
  case 'flag_amount':numerator=sum(rows,r=>num(r[a])?r[b]:0);value=numerator;break;
  case 'distinct':value=numerator=unique(rows,a,b).size;break;
  case 'pct_distinct':numerator=unique(rows,a,b).size;denominator=unique(rows,a).size;value=100*safeDiv(numerator,denominator);break;
  case 'forecast_accuracy':numerator=sum(rows,r=>Math.abs(num(r[a])-num(r[b])));denominator=sum(rows,r=>r[b]);value=100*(1-safeDiv(numerator,denominator));break;
  case 'loss_variance':numerator=sum(rows,r=>num(r[a])-num(r[b]));denominator=sum(rows,r=>r[b]);value=100*safeDiv(numerator,denominator);break;
  case 'turnover':numerator=sum(rows,r=>r[a]);denominator=sum(rows,r=>r[b]);value=safeDiv(numerator,denominator);break;
  case 'stddev': {const mean=safeDiv(sum(rows,r=>r[a]),rows.length);value=Math.sqrt(safeDiv(sum(rows,r=>Math.pow(num(r[a])-mean,2)),rows.length));numerator=round(sum(rows,r=>Math.pow(num(r[a])-mean,2)));denominator=rows.length;break}
  case 'po_per_fte':numerator=rows.length;denominator=unique(rows,'buyer_owner').size;value=safeDiv(numerator,denominator);break;
  case 'open_changes':{const v=source.changes.filter(r=>!['Closed','Completed','Complete'].includes(r.status));value=numerator=new Set(v.map(r=>r.change_id)).size;denominator=source.changes.length;break;}
  case 'high_risk_changes':{const v=source.changes.filter(r=>!['Closed','Completed','Complete'].includes(r.status)&&r.risk_level==='High');value=numerator=new Set(v.map(r=>r.change_id)).size;denominator=source.changes.length;break;}
  case 'cert_90_days':{const as=Date.parse(source.as_of+'T00:00:00Z');const end=as+90*86400000;const v=source.docs.filter(r=>r.document_type==='DOC-004'&&Date.parse(r.expiry_date+'T00:00:00Z')>=as&&Date.parse(r.expiry_date+'T00:00:00Z')<=end);value=numerator=new Set(v.map(r=>r.document_id||r.supplier_id)).size;denominator=source.docs.length;break;}
  case 'top_suppliers': {const m=new Map();for(const r of rows)m.set(r.supplier_id,(m.get(r.supplier_id)||0)+num(r.amount_usd));numerator=[...m.values()].sort((a,b)=>b-a).slice(0,5).reduce((x,y)=>x+y,0);denominator=sum(rows,r=>r.amount_usd);value=100*safeDiv(numerator,denominator);break;}
  case 'top_country':{const m=new Map();for(const r of rows)m.set(r.supplier_country,(m.get(r.supplier_country)||0)+num(r.amount_usd));numerator=Math.max(0,...m.values());denominator=sum(rows,r=>r.amount_usd);value=100*safeDiv(numerator,denominator);break;}
  default:throw Error('Unknown KPI type '+spec.type+' / '+spec.id)
 }
 if(!Number.isFinite(value))throw Error('Nonfinite KPI '+spec.id);return {value:round(value),numerator:numerator===null?null:round(numerator),denominator:denominator===null?null:round(denominator)};
}
function formula(spec){const [a,b]=spec.fields,tt=spec.type;
 const field=x=>`metric_events.${x}`;
 if(tt==='sum')return `SUM(${field(a)})`;
 if(tt==='count')return 'COUNT(DISTINCT metric_events.po_id)';
 if(tt==='avg')return `AVG(${field(a)})`;
 if(tt==='pct_flag')return `100 × SUM(IF(${field(a)}=1,1,0)) / COUNT(event_id)`;
 if(tt==='inverse_pct')return `100 × SUM(IF(${field(a)}=0,1,0)) / COUNT(event_id)`;
 if(tt==='count_flag')return `SUM(IF(${field(a)}=1,1,0))`;
 if(tt==='pct_ratio')return `100 × SUM(${field(a)}) / SUM(${field(b)})`;
 if(tt==='inverse_ratio')return `100 × (SUM(${field(b)})−SUM(${field(a)})) / SUM(${field(b)})`;
 if(tt==='ppv'||tt==='difference_pct')return `${tt==='ppv'?'100 × ':''}(SUM(${field(a)})−SUM(${field(b)})) / ${tt==='ppv'||tt==='difference_pct'?'SUM('+field(b)+')':'1'}`;
 if(tt==='difference')return `SUM(${field(a)})−SUM(${field(b)})`;
 if(tt==='reduction')return `100 × (SUM(${field(a)})−SUM(${field(b)})) / SUM(${field(a)})`;
 if(tt==='flag_amount')return `SUM(IF(${field(a)}=1,${field(b)},0))`;
 if(tt==='distinct')return `COUNT(DISTINCT ${field(a)} WHERE ${field(b)||'all records'}=1)`;
 if(tt==='pct_distinct')return `100 × COUNT(DISTINCT ${field(a)} WHERE ${field(b)}=1) / COUNT(DISTINCT ${field(a)})`;
 if(tt==='forecast_accuracy')return `100 × (1−SUM(ABS(${field(a)}−${field(b)}))/SUM(${field(b)}))`;
 if(tt==='loss_variance')return `100 × (SUM(${field(a)})−SUM(${field(b)}))/SUM(${field(b)})`;
 if(tt==='turnover')return `SUM(${field(a)})/SUM(${field(b)})`;
 if(tt==='stddev')return `STDEV.P(${field(a)})`;
 if(tt==='po_per_fte')return 'COUNT(DISTINCT po_id) / COUNT(DISTINCT project.owner [simulated FTE])';
 if(tt==='open_changes')return 'COUNT(DISTINCT change_controls.change_id WHERE status NOT IN Closed/Completed)';
 if(tt==='high_risk_changes')return 'COUNT(DISTINCT open Change ID JOIN supplier.risk_level=High)';
 if(tt==='cert_90_days')return 'COUNT(DISTINCT DOC-004 document_id WHERE expiry_date BETWEEN as_of AND as_of+90d)';
 if(tt==='top_suppliers')return '100 × SUM(TOP5 supplier amount_usd) / SUM(amount_usd)';
 if(tt==='top_country')return '100 × MAX(country SUM(amount_usd)) / SUM(amount_usd)';
 throw Error('Unregistered KPI formula '+spec.id);
}
/** Build enriched rows using strict 1:1 PO-event linkage, no random runtime data. */
export function simulateKPIs(template,raw,scope){
 if(registry.size!==115||template.metrics.length!==115)throw Error(`115-KPI registry coverage failed: ${registry.size}/${template.metrics.length}`);
 const po=new Map(raw.po.map(r=>[r.po_id,r]));const suppliers=new Map(raw.suppliers.map(r=>[r.supplier_id,r]));const projects=new Map((raw.projects||[]).map(r=>[r.project_id,r]));
 const production=new Map(raw.production.map(r=>[r.lot_id,r]));const inv=new Map(raw.inventory.map(r=>[r.lot_id,r]));const qc=new Map(raw.qc.map(r=>[r.po_id,r]));const mat=new Map((raw.materials||[]).map(r=>[r.material_id,r]));
 const productLines=new Set((raw.product_lines||[]).map(r=>r.product_line_id));
 const rows=[];for(const r of raw.simEvents||[]){const p=po.get(r.po_id);if(!p)throw Error('metric_event orphan PO '+r.po_id);if(p.supplier_id!==r.supplier_id||p.material_id!==r.material_id||p.project_id!==r.project_id||r.month!==p.created_date.slice(0,7))throw Error('metric_event inconsistent dimensions '+r.event_id);
  if(scope.month!=='all'&&r.month!==scope.month||scope.supplier!=='all'&&r.supplier_id!==scope.supplier||scope.material!=='all'&&r.material_id!==scope.material||scope.project!=='all'&&r.project_id!==scope.project)continue;
  const q=qc.get(r.po_id),lot=q?.lot_id,stock=inv.get(lot),prod=production.get(lot),project=projects.get(r.project_id),su=suppliers.get(r.supplier_id);
  if(!q||!stock||!prod||!project||!su||!mat.has(r.material_id))throw Error('metric_event missing PO/QC/Inventory/Production/Master join '+r.event_id);
  const amount=num(p.ordered_qty)*num(p.unit_price),base=num(p.ordered_qty)*num(p.benchmark_price),released=stock.status==='Released';
  const releaseAt=Date.parse(q.release_date+'T00:00:00Z'),requiredAt=Date.parse(prod.required_date+'T00:00:00Z');
  const ready=Number(released&&releaseAt<=requiredAt&&num(prod.allocated_qty)>=num(prod.required_qty));
  const usable=released?num(stock.quantity):0;const product_line_id=prod.product_id;
  const e={...r,amount_usd:amount,benchmark_amount_usd:base,product_line_id,buyer_owner:project.project_owner,supplier_country:su.country,
   high_supplier_risk:Number(su.risk_level==='High'),high_material_risk:Number(su.risk_level==='High'&&(num(r.shortage_flag)>0)),
   source_link_valid:1,approved_source_link_valid:Number(su.approved_status==='Approved'),otif_flag:Number(p.receipt_date<=p.promised_date&&num(p.received_qty)>=num(p.ordered_qty)),
   ontime_flag:Number(p.receipt_date<=p.promised_date),late_flag:Number(p.receipt_date>p.promised_date),
   production_readiness_flag:ready,usable_inventory_qty:usable,stock_safety_ok:Number(usable>=num(r.safety_stock_qty)),
   stock_days:usable/Math.max(0.001,num(r.daily_consumption_qty)),inventory_value_usd:num(stock.quantity)*num(p.unit_price),
   hold_inventory_value_usd:released?0:num(stock.quantity)*num(p.unit_price),consumed_value_usd:num(r.consumed_qty)*num(p.unit_price),
   inventory_loss_baseline_qty:num(r.inventory_loss_baseline_qty),expedite_flag:Number(num(r.expedite_fee_usd)>0),
   covered_spend_usd:num(r.contract_covered)?amount:0,approved_spend_usd:su.approved_status==='Approved'?amount:0,
   top30_spend_usd:productLines.has(product_line_id)?amount:0,lot_id:lot};
  if(!Number.isFinite(e.stock_days))throw Error('Invalid stock days');rows.push(e);
 }
 if(!rows.length)return {metrics:new Map(),rows,sourceTables:{},note:'所选筛选条件没有关联模拟事件，禁止把无记录强行显示为0。'};
 const sameScope=r=> (scope.supplier==='all'||r.supplier_id===scope.supplier)&&(scope.material==='all'||r.material_id===scope.material)&&(scope.project==='all'||r.project_id===scope.project);
 // Changes are scoped by their own created month; month filtering of docs uses as-of snapshot, not PO history.
 const changes=(raw.changes||[]).filter(r=>sameScope(r)&&(scope.month==='all'||r.opened_date?.startsWith(scope.month))).map(r=>({...r,risk_level:suppliers.get(r.supplier_id)?.risk_level||'Unknown'}));
 const docs=(raw.docs||[]).filter(r=>sameScope(r));
 const source={changes,docs,as_of:scope.as_of};const map=new Map();
 for(const m of template.metrics){const spec=registry.get(m.id);if(!spec)throw Error('Missing simulation mapping '+m.id);const value=evaluate(spec,rows,source);const contract=explainMetric(m);const sourceName=spec.type==='open_changes'||spec.type==='high_risk_changes'?'changes':spec.type==='cert_90_days'?'docs':'simEvents';
  const selected=sourceName==='changes'?changes:sourceName==='docs'?docs:rows;
  map.set(m.id,{...value,unit:m.unit,source:'SIMULATED / 统一模拟业务事件与关联主表',formula:formula(spec),source_table:sourceName,
   rows:selected,count:selected.length,status:'已计算',reason:'模拟事件字段和受控模拟旗标，非真实 ERP/QMS/RA 审批。',route:'sim-center',excel_key:'v2942_'+m.id,
   simulation:true,simulation_contract:{type:spec.type,fields:spec.fields,join_keys:['po_id','supplier_id','material_id','project_id'],snapshot:'V2941-SIMULATED-20261111',input_count:rows.length}});
 }
 return {metrics:map,rows,sourceTables:{changes,docs},note:'全 115 项基于确定性的模拟业务事件、统一 PO 关联及模拟批准旗标；非真实企业批准。'};
}
/** Returns a real Excel formula over the raw 1:1 event table for every KPI, using same registry. */
export function simulatedExcelFormula(id,keys,rowCount,scope,{changeSheet='原始_变更',docSheet='原始_文件'}={}){
 const spec=registry.get(id);if(!spec)return null;const col=k=>{const i=keys.indexOf(k)+1;if(!i)throw Error(`Excel missing simulated source field ${k} for ${id}`);return excelL(i)};
 const N=Math.max(2,rowCount+1),sheet="'模拟指标事件'!",rg=k=>`${sheet}${col(k)}2:${col(k)}${N}`,sm=k=>`SUM(${rg(k)})`,ct=k=>`COUNT(${rg(k)})`,rat=(nu,de)=>`IFERROR((${nu})/(${de}),0)`;
 const [a,b]=spec.fields,t=spec.type;
 if(t==='sum'||t==='count_flag')return sm(a);
 if(t==='count')return `COUNTA(${rg('event_id')})`;
 if(t==='avg')return rat(sm(a),ct(a));
 if(t==='pct_flag')return rat('100*'+sm(a),ct(a));
 if(t==='inverse_pct')return rat(`100*(${ct(a)}-${sm(a)})`,ct(a));
 if(t==='pct_ratio')return rat('100*'+sm(a),sm(b));
 if(t==='inverse_ratio')return rat(`100*(${sm(b)}-${sm(a)})`,sm(b));
 if(t==='difference')return `${sm(a)}-${sm(b)}`;
 if(t==='difference_pct'||t==='ppv')return rat(`100*(${sm(a)}-${sm(b)})`,sm(b));
 if(t==='reduction')return rat(`100*(${sm(a)}-${sm(b)})`,sm(a));
 if(t==='flag_amount')return `SUMPRODUCT(${rg(a)},${rg(b)})`;
 if(t==='forecast_accuracy'){const h='${rg(a)}';return rat('100*(SUM('+rg(b)+')-SUMPRODUCT(ABS('+rg(a)+'-'+rg(b)+')))',sm(b))}
 if(t==='loss_variance')return rat(`100*(${sm(a)}-${sm(b)})`,sm(b));
 if(t==='turnover')return rat(sm(a),sm(b));
 if(t==='stddev')return `STDEV.P(${rg(a)})`;
 if(t==='distinct')return b?`IFERROR(SUMPRODUCT((${rg(a)}<>"")*IFERROR(1/COUNTIFS(${rg(a)},${rg(a)},${rg(b)},1),0)*(${rg(b)}=1)),0)`:`IFERROR(SUMPRODUCT((${rg(a)}<>"")*IFERROR(1/COUNTIF(${rg(a)},${rg(a)}),0)),0)`;
 if(t==='pct_distinct')return rat(`100*SUMPRODUCT((${rg(a)}<>"")*IFERROR(1/COUNTIFS(${rg(a)},${rg(a)},${rg(b)},1),0)*(${rg(b)}=1))`,`SUMPRODUCT((${rg(a)}<>"")*IFERROR(1/COUNTIF(${rg(a)},${rg(a)}),0))`);
 if(t==='po_per_fte')return rat(`COUNTA(${rg('event_id')})`,`SUMPRODUCT((${rg('buyer_owner')}<>"")*IFERROR(1/COUNTIF(${rg('buyer_owner')},${rg('buyer_owner')}),0))`);
 if(t==='open_changes'||t==='high_risk_changes')return `SUM('${changeSheet}'!${t==='open_changes'?'A':'B'}2:${t==='open_changes'?'A':'B'}${Math.max(2,rowCount+1)})`;// overridden by dedicated simulated audit sheets
 if(t==='cert_90_days')return `COUNTIFS('${docSheet}'!A2:A${N},"DOC-004",'${docSheet}'!B2:B${N},">="&TODAY(),'${docSheet}'!B2:B${N},"<="&TODAY()+90)`;// overridden by audit sheet
 if(t==='top_suppliers'||t==='top_country')return null; // dedicated aggregation sheet required; no static result permitted
 throw Error('Unsupported simulated Excel formula '+id+' '+t);
}
