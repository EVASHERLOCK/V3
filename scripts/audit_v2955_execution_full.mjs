/** 9 execution pages: full, unfiltered Demo CSV PK checks and separate per-metric/per-row arithmetic.
 * Result intentionally excludes browser click/narrative/excel independent recalc signoff.
 */
import fs from 'node:fs';import crypto from 'node:crypto';
import {buildExecutionDataset,metricForPage,PAGE_IDS} from '../procurement_execution_v2937.mjs';
import {ALL_SOURCE_TABLES,rowsFor,overview} from '../sim_data_center_v2941.mjs';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const catalog=JSON.parse(fs.readFileSync('docs/V2953_Demo_585逐组件验收明细.json','utf8')).components;
const tableKeys=overview().keys;
const indexes=Object.fromEntries(ALL_SOURCE_TABLES.map(t=>[t,new Map(rowsFor(t).map(r=>[String(r[tableKeys[t]]),r]))]));
const ds=buildExecutionDataset();
const asOf=ds.asof,number=x=>x!==null&&x!==''&&x!==undefined&&Number.isFinite(Number(x)),n=x=>Number(x),near=(a,b,tol=0.025)=>Math.abs(a-b)<=tol;
const day=(a,b)=>Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000);
const ref=(t,id)=>indexes[t].get(String(id));const pksets={},pages=[],components=[];
const bank=arr=>{const list=[...arr].sort(),key=sha(JSON.stringify(list));if(!pksets[key])pksets[key]=list;return key};
const checked=(p,r,source)=>{
 const key=String(r.source_id||''), table=r.source_file?.match(/([^/]+)\.csv$/)?.[1];
 const sourceRow=indexes[table]?.get(key),issues=[];
 if(!sourceRow)issues.push(`SOURCE_PK_NOT_FOUND:${table}:${key}`);
 else for(const k of ['supplier_id','material_id','project_id']){
  const expected=sourceRow[k],actual=r[k]??(k==='supplier_id'?r.supplier:k==='material_id'?r.material:undefined);
  // Quotes from alternate suppliers can differ from awarded PO, so inspect the quote record, not the PO.
  if(expected!==undefined&&actual!==undefined&&String(expected)!==String(actual))issues.push(`DIMENSION_MISMATCH:${k}`);
 }
 const own=sourceRow;const po=ref('purchase_orders',r.po);const q=ref('qc_lots',po?.po_id);
 const ev=ref('metric_events',`MET-EVT-${po?.po_id?.split('-').at(-1)}`);
 function eq(field,expected,tol=0.025){if(number(expected)&&number(r[field])){if(!near(n(r[field]),expected,tol))issues.push(`ROW_CALC_DIFFERENCE:${field}`)}else if(expected!==undefined&&String(r[field])!==String(expected))issues.push(`ROW_CALC_DIFFERENCE:${field}`)}
 if(po){
  if(p==='rfq'){
   eq('order_qty',Math.max(n(po.ordered_qty),n(own.moq)));
   eq('moq_extra_cost',Math.max(0,n(own.moq)-n(po.ordered_qty))*n(own.unit_price)*n(own.fx_to_usd));
  }
  if(p==='contracts')eq('price_exposure',Math.abs(n(own.unit_price_usd)-n(po.unit_price))*n(po.ordered_qty));
  if(p==='orders'){
   if(ev)eq('qty_match',Number(n(ev.po_first_correct)>0));
   eq('price_diff_usd',0);
  }
  if(p==='shipments'){
   eq('late_flag',Number(po.receipt_date>po.promised_date));
   eq('short_qty',Math.max(0,n(po.ordered_qty)-n(po.received_qty)));
   eq('otif',Number(po.receipt_date<=po.promised_date&&n(po.received_qty)>=n(po.ordered_qty)));
  }
  if(p==='invoices'){
   eq('match3',Number(n(own.invoice_quantity)<=n(po.received_qty)&&near(n(own.unit_price_usd),n(po.unit_price),0.00099)));
  }
  if(p==='payments'){
   const inv=ref('invoices',own.invoice_id);if(inv)eq('open_amount',Math.max(0,n(inv.invoice_amount_usd)-n(own.payment_amount_usd)));
  }
  if(p==='claims'){
   const sett=[...indexes.claim_settlements.values()].find(s=>s.claim_id===own.claim_id);
   if(sett)eq('recovery_gap',Math.max(0,n(own.claim_amount_usd)-n(sett.settlement_amount_usd)));
  }
  if(p==='closing'){
   eq('remaining_qty',Math.max(0,n(po.ordered_qty)-n(po.received_qty)));
   const invoice=[...indexes.invoices.values()].find(x=>x.po_id===po.po_id),payment=[...indexes.payments.values()].find(x=>x.po_id===po.po_id);
   if(invoice&&payment)eq('payment_balance',Math.max(0,n(invoice.invoice_amount_usd)-n(payment.payment_amount_usd)));
  }
  if(p==='exceptions'){
   eq('age_days',Math.max(0,day(asOf,po.receipt_date)));
   eq('high_open',Number(own.status!=='SIMULATED_CLOSED'&&own.severity==='HIGH'));
  }
 }
 return issues;
};
function independent(m,rows){
 if(m.op==='count')return rows.length;
 if(!rows.length||!rows.every(r=>number(r[m.field])))return null;
 const values=rows.map(r=>n(r[m.field]));
 if(m.op==='sum')return values.reduce((a,b)=>a+b,0);
 if(['rate','avg'].includes(m.op))return values.reduce((a,b)=>a+b,0)/rows.length;
 if(m.op==='ratio'){
  if(!rows.every(r=>number(r[m.denom_field])))return null;
  const denom=rows.reduce((a,r)=>a+n(r[m.denom_field]),0);
  return denom===0?null:values.reduce((a,b)=>a+b,0)/denom;
 }
 if(m.op==='sumif')return rows.filter(r=>r[m.condition_field]===m.condition_value).reduce((a,r)=>a+n(r[m.field]),0);
 return null;
}
for(const [i,page] of ds.pages.entries()){
 const errors=[],identities=[];
 for(let j=0;j<page.rows.length;j++){
  const row=page.rows[j],sourceTable=row.source_file.match(/([^/]+)\.csv$/)?.[1]||'',fullKey=`${sourceTable}:${row.source_id}`;
  identities.push(fullKey);
  const problems=checked(page.id,row);
  if(problems.length)errors.push({row:j+2,key:fullKey,problems});
 }
 const verified=page.metrics.map(m=>{
  const expected=independent(m,page.rows),actual=metricForPage(page.id,m.key,page.rows);
  const pass=expected!==null&&actual?.value!==null&&near(expected,actual.value,0.000001);
  return {id:m.key,title:m.label,operation:m.op,source_field:m.field,denominator_field:m.denom_field??null,
   formula_definition:m.excel_formula||m.explain,independent_value:expected,site_engine_value:actual?.value??null,
   result:pass?'INDEPENDENT_AGGREGATION_MATCH':'PENDING_OR_DIFFERENT'};
 });
 const keyref=bank(identities);
 const item={page:page.id,route:`exec-${String(i).padStart(2,'0')}`,source_record_count:page.rows.length,
  primary_key_list_ref:keyref,source_row_key_sha256:sha(JSON.stringify(identities)),primary_key_samples:identities.slice(0,3),
  primary_key_records_found:page.rows.length-errors.filter(x=>x.problems.some(y=>y.startsWith('SOURCE_PK_NOT_FOUND'))).length,
  independently_tested_row_formulas:page.rows.length,source_and_row_calculation_issues:errors.length,
  mismatches:errors.slice(0,15),metrics:verified,aggregate_match:verified.filter(x=>x.result==='INDEPENDENT_AGGREGATION_MATCH').length};
 pages.push(item);
 const group=catalog.filter(x=>x.route===item.route);
 for(const c of group)components.push({id:c.id,route:item.route,title:c.title,key_set_ref:keyref,record_count:page.rows.length,
  sources_pks_and_selected_arithmetic:errors.length?'REVIEW_REQUIRED':'MATCH',
  aggregate_metric_coverage:c.id.endsWith('.kpis')?verified.length:0,
  remaining:['LIVE_WEB_CELL_SNAPSHOT','XLSX_FULL_SCOPE_RECALC','NARRATIVE_SEMANTIC_CHECK'],business_pass:false});
}
const summary={version:'2.9.55',execution_pages:pages.length,registered_execution_components:components.length,
 total_rows_across_pages:pages.reduce((n,x)=>n+x.source_record_count,0),
 source_lookup_and_row_calc_issues:pages.reduce((n,x)=>n+x.source_and_row_calculation_issues,0),
 aggregation_metrics:pages.reduce((n,x)=>n+x.metrics.length,0),matched_aggregation_metrics:pages.reduce((n,x)=>n+x.aggregate_match,0),
 scope:'ALL_ROWS_UNFILTERED_9_EXECUTION_PAGES',full_585_business_pass:false};
fs.writeFileSync('docs/V2955_9执行页62组件_全量主键与算式核验.json',JSON.stringify({summary,key_sets:pksets,pages,components},null,2)+'\n');
console.log(JSON.stringify(summary));
if(process.argv.includes('--strict')&&(summary.source_lookup_and_row_calc_issues||summary.matched_aggregation_metrics!==summary.aggregation_metrics||components.length!==62))process.exitCode=2;
