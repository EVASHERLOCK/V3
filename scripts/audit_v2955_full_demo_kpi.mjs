/** V2.9.55 full-scope (unfiltered) Demo KPI lineage and separately coded arithmetic.
 * Compares calculation engine result with an independently implemented reducer.
 * The original 23 CSV rows, not prior browser samples, establish row identity.
 * This is NOT a browser-click or Excel recalculation certificate.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {rowsFor,overview,ALL_SOURCE_TABLES,fileFor} from '../sim_data_center_v2941.mjs';
import {simulateKPIs,SIM_KPI_REGISTRY} from '../simulation_kpi_v2942.mjs';
import {DECISION_TEMPLATE} from '../decision_center_v2935.mjs';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const raw={po:rowsFor('purchase_orders'),qc:rowsFor('qc_lots'),production:rowsFor('production'),inventory:rowsFor('inventory'),changes:rowsFor('change_controls'),suppliers:rowsFor('suppliers'),docs:rowsFor('supplier_documents'),simEvents:rowsFor('metric_events'),materials:rowsFor('materials'),projects:rowsFor('projects'),product_lines:rowsFor('product_lines')};
const scope=Object.freeze({supplier:'all',material:'all',project:'all',month:'all',as_of:'2026-11-14'});
const result=simulateKPIs(DECISION_TEMPLATE,raw,scope);
const keys=overview().keys;
const by={};for(const t of ALL_SOURCE_TABLES)by[t]=new Map(rowsFor(t).map(r=>[String(r[keys[t]]),r]));
const setBank={};const bank=arr=>{const sorted=[...new Set(arr)].sort();const digest=sha(JSON.stringify(sorted));if(!setBank[digest])setBank[digest]={count:sorted.length,keys:sorted};return digest};
const numeric=x=>x!==''&&x!==null&&x!==undefined&&Number.isFinite(Number(x));
const N=x=>numeric(x)?Number(x):NaN;
const money=(a,b)=>Math.abs(a-b)<=0.025;
const unique=(rows,k,flag)=>new Set(rows.filter(r=>!flag||N(r[flag])>0).map(r=>r[k]).filter(Boolean)).size;
const s=(rows,k)=>rows.reduce((a,r)=>a+N(r[k]),0);
const divide=(n,d)=>d===0?{value:null,condition:'ZERO_DENOMINATOR'}:{value:n/d,condition:'OK'};
function separatelyReduce(spec,rows,source){
 const [a,b]=spec.fields, t=spec.type;
 const count=rows.length;
 let value,condition='OK';
 if(['sum','count_flag'].includes(t)){value=t==='sum'?s(rows,a):rows.filter(r=>N(r[a])>0).length;}
 else if(t==='count')value=count;
 else if(t==='avg')({value,condition}=divide(s(rows,a),count));
 else if(t==='pct_flag')({value,condition}=divide(rows.filter(r=>N(r[a])>0).length*100,count));
 else if(t==='inverse_pct')({value,condition}=divide(rows.filter(r=>N(r[a])===0).length*100,count));
 else if(t==='pct_ratio')({value,condition}=divide(s(rows,a)*100,s(rows,b)));
 else if(t==='inverse_ratio')({value,condition}=divide((s(rows,b)-s(rows,a))*100,s(rows,b)));
 else if(['difference','difference_pct','ppv','reduction','loss_variance'].includes(t)){
  const diff=s(rows,a)-s(rows,b);if(t==='difference')value=diff;
  else ({value,condition}=divide(diff*100,t==='reduction'?s(rows,a):s(rows,b)));
 }
 else if(t==='flag_amount')value=rows.reduce((total,r)=>total+(N(r[a])>0?N(r[b]):0),0);
 else if(t==='distinct')value=unique(rows,a,b);
 else if(t==='pct_distinct')({value,condition}=divide(unique(rows,a,b)*100,unique(rows,a)));
 else if(t==='forecast_accuracy'){
  const total=rows.reduce((v,r)=>v+Math.abs(N(r[a])-N(r[b])),0);
  const den=s(rows,b);({value,condition}=divide((den-total)*100,den));
 }
 else if(t==='turnover')({value,condition}=divide(s(rows,a),s(rows,b)));
 else if(t==='stddev'){
  const avg=s(rows,a)/count;value=Math.sqrt(rows.reduce((total,r)=>total+(N(r[a])-avg)**2,0)/count);
 }
 else if(t==='po_per_fte')({value,condition}=divide(count,unique(rows,'buyer_owner')));
 else if(t==='open_changes')value=new Set(source.changes.filter(r=>!['Closed','Completed','Complete'].includes(r.status)).map(r=>r.change_id)).size;
 else if(t==='high_risk_changes')value=new Set(source.changes.filter(r=>!['Closed','Completed','Complete'].includes(r.status)&&r.risk_level==='High').map(r=>r.change_id)).size;
 else if(t==='cert_90_days'){
  const from=Date.parse(scope.as_of+'T00:00:00Z'),to=from+90*86400000;
  value=new Set(source.docs.filter(r=>r.document_type==='DOC-004'&&Date.parse(r.expiry_date+'T00:00:00Z')>=from&&Date.parse(r.expiry_date+'T00:00:00Z')<=to).map(r=>r.document_id)).size;
 }
 else if(t==='top_suppliers'||t==='top_country'){
  const group=new Map(),field=t==='top_suppliers'?'supplier_id':'supplier_country';
  for(const r of rows)group.set(r[field],(group.get(r[field])||0)+N(r.amount_usd));
  const ranked=[...group.values()].sort((a,b)=>b-a);
  ({value,condition}=divide((t==='top_suppliers'?ranked.slice(0,5).reduce((a,v)=>a+v,0):ranked[0])*100,s(rows,'amount_usd')));
 }
 else return {value:null,condition:'EVALUATOR_MISSING'};
 if(value!==null&&(!Number.isFinite(value)))return {value:null,condition:'MISSING_OR_INVALID_INPUT'};
 return {value:value===null?null:Number(value.toFixed(2)),condition};
}
const po=new Map(raw.po.map(p=>[p.po_id,p]));const qc=new Map(raw.qc.map(q=>[q.po_id,q]));
const inventory=new Map(raw.inventory.map(i=>[i.lot_id,i]));const production=new Map(raw.production.map(i=>[i.lot_id,i]));
const suppliers=new Map(raw.suppliers.map(i=>[i.supplier_id,i]));const projects=new Map(raw.projects.map(i=>[i.project_id,i]));
const productLines=new Set(raw.product_lines.map(x=>x.product_line_id));
const problems=[];
for(const ev of result.rows){
 const base=by.metric_events.get(String(ev.event_id)),p=po.get(ev.po_id),q=qc.get(ev.po_id),st=inventory.get(q?.lot_id),pr=production.get(q?.lot_id),su=suppliers.get(ev.supplier_id),pj=projects.get(ev.project_id);
 if(!base||!p||!q||!st||!pr||!su||!pj){problems.push({key:ev.event_id,type:'MISSING_CSV_JOIN'});continue;}
 for(const k of ['po_id','supplier_id','material_id','project_id','month'])if(String(ev[k])!==String(base[k]))problems.push({key:ev.event_id,type:'SOURCE_DIMENSION_MISMATCH',field:k});
 for(const [k,v] of Object.entries(base))if(ev[k]!==undefined&&String(ev[k])!==String(v)&&!(numeric(ev[k])&&numeric(v)&&Math.abs(N(ev[k])-N(v))<1e-6))problems.push({key:ev.event_id,type:'SOURCE_EVENT_FIELD_MISMATCH',field:k});
 const amount=N(p.ordered_qty)*N(p.unit_price),benchmark=N(p.ordered_qty)*N(p.benchmark_price),released=st.status==='Released',quantity=released?N(st.quantity):0;
 const derive={amount_usd:amount,benchmark_amount_usd:benchmark,product_line_id:pr.product_id,buyer_owner:pj.project_owner,supplier_country:su.country,high_supplier_risk:Number(su.risk_level==='High'),high_material_risk:Number(su.risk_level==='High'&&N(base.shortage_flag)>0),source_link_valid:1,approved_source_link_valid:Number(su.approved_status==='Approved'),
  otif_flag:Number(p.receipt_date<=p.promised_date&&N(p.received_qty)>=N(p.ordered_qty)),ontime_flag:Number(p.receipt_date<=p.promised_date),late_flag:Number(p.receipt_date>p.promised_date),
  production_readiness_flag:Number(released&&q.release_date<=pr.required_date&&N(pr.allocated_qty)>=N(pr.required_qty)),usable_inventory_qty:quantity,stock_safety_ok:Number(quantity>=N(base.safety_stock_qty)),
  stock_days:quantity/Math.max(0.001,N(base.daily_consumption_qty)),inventory_value_usd:N(st.quantity)*N(p.unit_price),hold_inventory_value_usd:released?0:N(st.quantity)*N(p.unit_price),consumed_value_usd:N(base.consumed_qty)*N(p.unit_price),
  expedite_flag:Number(N(base.expedite_fee_usd)>0),covered_spend_usd:N(base.contract_covered)?amount:0,approved_spend_usd:su.approved_status==='Approved'?amount:0,top30_spend_usd:productLines.has(pr.product_id)?amount:0,lot_id:q.lot_id};
 for(const [k,v] of Object.entries(derive))if(numeric(v)?Math.abs(N(ev[k])-v)>1e-7:String(ev[k])!==String(v))problems.push({key:ev.event_id,type:'DERIVED_FIELD_INCONSISTENT_WITH_RAW_JOIN',field:k,expected:v,actual:ev[k]});
}
const reports=[];const reserved=new Set();
for(const [id,spec] of SIM_KPI_REGISTRY){
 const m=result.metrics.get(id),sourceKey=m.source_table==='changes'?'change_controls':m.source_table==='docs'?'supplier_documents':'metric_events';
 const pk=keys[sourceKey],original=by[sourceKey],sourceRows=m.rows;
 const identities=sourceRows.map(r=>String(r[pk]??''));
 let missing=identities.filter(k=>!k||!original.has(k));
 const allKeysMatch=missing.length===0&&new Set(identities).size===identities.length;
 const source={changes:result.sourceTables.changes,docs:result.sourceTables.docs};
 const evaluated=separatelyReduce(spec,result.rows,source);
 const differences=evaluated.value===null?null:Number((evaluated.value-m.value).toFixed(6));
 const vars=[...spec.fields];const absent=vars.filter(k=>!result.rows.every(row=>row[k]!==undefined&&row[k]!==''));
 const compared=allKeysMatch&&Math.abs(differences??Infinity)<=0.011&&evaluated.condition==='OK'&&absent.length===0;
 const md={id,component_ids:[`decision-01.metric.${id}`,`decision-05.metric.${id}`],name:DECISION_TEMPLATE.metrics.find(x=>x.id===id)?.name,formula:m.formula,
  type:spec.type,variables:vars,scope,source_file:`seed_simulated/${sourceKey}.csv`,source_pk:pk,source_record_count:sourceRows.length,
  full_source_key_set_ref:bank(identities),full_source_key_set_sha256:sha(JSON.stringify(identities)),all_pk_present_and_unique:allKeysMatch,
  source_join_field_check_issues:sourceKey==='metric_events'?problems.filter(p=>identities.includes(p.key)).length:0,
  independent_numeric_result:evaluated.value,site_engine_result:m.value,delta:differences,condition:evaluated.condition,missing_variables:absent,
  tested_result:compared&&problems.length===0?'SOURCE_AND_INDEPENDENT_CALC_MATCH':'NOT_PASS',
  narrative_check:'STATIC_DEFINITION_ONLY_SEMANTIC_CONCLUSION_NOT_VALIDATED',xlsx_web_same_cell:'NOT_EVALUATED_FOR_THIS_UNFILTERED_SCOPE'};
 reports.push(md);if(!compared)reserved.add(id);
}
const summary={version:'2.9.55',source:'bundled 23 Demo CSV, unfiltered',as_of:scope.as_of,source_files:ALL_SOURCE_TABLES.length,
 source_rows:ALL_SOURCE_TABLES.reduce((n,t)=>n+rowsFor(t).length,0),metric_count:reports.length,metric_source_keys_unique:Object.keys(setBank).length,
 simulated_event_count:result.rows.length,csv_join_mismatches:problems.length,source_and_number_match:reports.filter(x=>x.tested_result==='SOURCE_AND_INDEPENDENT_CALC_MATCH').length,
 unresolved:reports.filter(x=>x.tested_result!=='SOURCE_AND_INDEPENDENT_CALC_MATCH').map(x=>x.id),
 scope_boundary:'FULL UNFILTERED 115 KPI numeric + source join checks. Not per-visible-cell browser or XLSX full-scope verification; no narrative semantic signoff; no 585-wide PASS.'};
const report={summary,key_sets:setBank,metrics:reports,join_issues:problems.slice(0,1000)};
fs.writeFileSync('docs/V2955_115KPI_全量来源主键与独立复算.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary));
if(process.argv.includes('--strict')&&(problems.length||summary.source_and_number_match!==115))process.exitCode=2;
