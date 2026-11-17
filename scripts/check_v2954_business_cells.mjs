/** V2.9.54: conservative per-component business-evidence audit.
 * Never promotes a successful button click or an XLSX formula count to a numerical PASS.
 * Checks returned source-key samples against all 23 bundled Demo CSV files and records
 * missing independent evaluators, incomplete key sets, display results and narrative checks.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ALL_SOURCE_TABLES,overview,rowsFor,fileFor} from '../sim_data_center_v2941.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const inventory=read('docs/V2953_Demo_585逐组件验收明细.json').components;
const previous=read('docs/V2952_217历史组件_离线浏览器真实Node接口点击证据.json').components;
const fresh=['docs/V2953_m09_clicks.json','docs/V2953_ssdata_clicks.json','docs/V2953_perf_four.json'].flatMap(p=>read(p).components);
const proofs=new Map(previous.filter(x=>x?.id).map(x=>[x.id,x]));
for(const x of fresh)proofs.set(x.id,x);
const keyFields=overview().keys;
const indices=new Map();
const tableSummaries=[];
for(const table of ALL_SOURCE_TABLES){
 const pk=keyFields[table],records=rowsFor(table),byKey=new Map(),dups=[];
 for(const r of records){const key=String(r[pk]??'');if(!key||byKey.has(key))dups.push(key);else byKey.set(key,r)}
 indices.set(table,{pk,byKey});
 tableSummaries.push({table,primary_key:pk,rows:records.length,unique_keys:byKey.size,sha256:sha(fs.readFileSync(fileFor(table))),duplicates:dups.length});
}
const guesses={po_id:'purchase_orders',invoice_id:'invoices',payment_id:'payments',claim_id:'claims',change_id:'change_controls',contract_id:'contracts',supplier_id:'suppliers',material_id:'materials',project_id:'projects',event_id:'metric_events',document_id:'supplier_documents'};
function matchKey(sample){
 const related=['supplier_id','material_id','project_id','product_line_id'];
 const keys=Object.entries(sample||{}).filter(([k,v])=>v!=null&&v!==''&&k!=='source_row');
 // A business-record ID is the anchor; supplier/material are dimensions, not competing record identities.
 const anchors=keys.filter(([k])=>k==='id'||(k.endsWith('_id')&&!related.includes(k))||k==='month');
 const selected=anchors.length?anchors:keys.filter(([k])=>related.includes(k));
 const matches=[];
 for(const [field,value] of selected){
  for(const [table,{pk,byKey}] of indices){
   if(field!==pk&&field!=='id')continue;
   const row=byKey.get(String(value));if(!row)continue;
   const dimensionConflicts=related.filter(k=>sample[k]!=null&&sample[k]!==''&&row[k]!=null&&String(sample[k])!==String(row[k]));
   matches.push({table,field:pk,value:String(value),role:field==='id'?'GENERIC_ID_LOOKUP':'EXPLICIT_PRIMARY_KEY',dimension_conflicts:dimensionConflicts});
  }
 }
 const unique=[...new Map(matches.map(x=>[`${x.table}:${x.value}`,x])).values()];
 if(unique.length===0)return {status:'KEY_NOT_FOUND_IN_23_CSV',matches:[]};
 if(unique.some(x=>x.dimension_conflicts.length))return {status:'CSV_PRIMARY_KEY_DIMENSION_CONFLICT',matches:unique};
 return {status:unique.length===1?'KEY_AND_DECLARED_DIMENSIONS_MATCH_CSV':'AMBIGUOUS_CSV_KEY',matches:unique};
}
const statuses=new Map();
const audit=inventory.map(c=>{
 const p=proofs.get(c.id),trace=p?.api_trace||null;
 const metrics=(trace?.metric_source_key_evidence||[]).map(m=>{
  const samples=Array.isArray(m.source_key_sample)?m.source_key_sample:[];
  const matches=samples.map(s=>({...matchKey(s),source_row:s.source_row||null}));
  const auditItem=(trace?.strict_metric_audit||[]).find(x=>x.metric_id===m.metric_id);
  const distinctKeys=new Set(samples.map(s=>JSON.stringify(s)));
  const full=Number(m.row_count_returned)===samples.length&&distinctKeys.size===samples.length&&samples.length>0;
  const csvMatches=matches.filter(x=>x.status==='KEY_AND_DECLARED_DIMENSIONS_MATCH_CSV').length;
  return {metric_id:m.metric_id,formula:m.formula||null,rows_reported:m.row_count_returned??null,key_samples:samples.length,
    sample_set_complete:full,sample_keys_unique:distinctKeys.size===samples.length,
    confirmed_in_23_demo_csv:csvMatches,not_confirmed:samples.length-csvMatches,
    source_key_resolution:!samples.length?'NO_KEYS':csvMatches===samples.length?(full?'RETURNED_KEYS_MATCH_CSV_SCOPE_NOT_ESTABLISHED':'SAMPLED_KEYS_MATCH_ONLY'):'MIXED_OR_UNMATCHED_KEYS',
    independent_evaluator:auditItem?.status||'NOT_RECORDED',key_evidence:matches};
 });
 const sourceKeys=metrics.length>0&&metrics.every(x=>x.rows_reported>0&&x.sample_set_complete&&x.not_confirmed===0);
 const hasRealCalc=metrics.length>0&&metrics.every(x=>/RECOMPUTED/.test(x.independent_evaluator));
 const displayed=trace?.displayed_figures||0,displayPass=trace?.display_passed||0,displayUnverified=trace?.display_unverified||0;
 const displayStatus=!trace?'NO_COMPONENT_PAGE_EVIDENCE':displayed===0?'NO_TAGGED_VISIBLE_CELLS':displayUnverified>0?'UNVERIFIED_VISIBLE_CELLS':displayPass!==displayed?'NOT_ALL_VISIBLE_CELLS_RECALCULATED':'DISPLAY_ONLY_RECONCILED_NOT_EXCEL';
 const narrativeCount=trace?.narrative_paragraphs||0,narrativeUnverified=trace?.narrative_unverified||0;
 const narrativeStatus=narrativeCount===0?'NO_EVALUABLE_NARRATIVE':narrativeUnverified>0?'NARRATIVE_CONDITIONS_NOT_VERIFIED':'NARRATIVE_API_CHECK_RECORDED_NEEDS_SEMANTIC_REVIEW';
 const xlsx=p?.excel?.formula_cells||0;
 const flags=[];
 if(!p||p.status!=='OFFLINE_BRIDGED_CLICK_OK')flags.push('COMPONENT_UI_NOT_CURRENTLY_PROVEN');
 if(metrics.length===0)flags.push('NO_PER_METRIC_KEYS');
 if(!sourceKeys)flags.push('FULL_COMPONENT_SOURCE_PRIMARY_KEYS_NOT_PROVEN');
 if(!hasRealCalc)flags.push('INDEPENDENT_SOURCE_EVALUATOR_NOT_PROVEN');
 if(displayStatus!=='DISPLAY_ONLY_RECONCILED_NOT_EXCEL')flags.push('VISIBLE_WEB_CELLS_NOT_RECONCILED');
 flags.push('XLSX_VS_WEB_INDEPENDENT_CELL_RECALC_NOT_PROVEN');
 if(narrativeStatus!=='NARRATIVE_API_CHECK_RECORDED_NEEDS_SEMANTIC_REVIEW')flags.push('NARRATIVE_CONDITIONS_NOT_VERIFIED');
 const result={id:c.id,route:c.route,kind:c.kind,title:c.title,ui_three_entry:c.three_entry_browser_demo,
  evidence_origin:c.browser_evidence_origin,metric_definitions_found:metrics.length,reported_source_rows:metrics.reduce((n,x)=>n+(x.rows_reported||0),0),
  source_key_samples_checked:metrics.reduce((n,x)=>n+x.key_samples,0),source_key_samples_found_in_csv:metrics.reduce((n,x)=>n+x.confirmed_in_23_demo_csv,0),
  component_source_keys_full:sourceKeys?'SAMPLE_SET_CHECKED_NOT_FULL_SCOPE_PROVEN':'PENDING',independent_metric_recalculation:hasRealCalc?'API_INDEPENDENT_CALC_REPORTED':'PENDING',
  visible_web_cells:displayed,visible_web_cells_verified:displayPass,web_cell_status:displayStatus,
  excel_formula_cells:xlsx,web_excel_same_cell:'PENDING_NO_FULL_RECALC',narrative_paragraphs:narrativeCount,narrative_status:narrativeStatus,
  business_acceptance:'PENDING',blockers:flags,metric_details:metrics};
 for(const f of flags)statuses.set(f,(statuses.get(f)||0)+1);
 return result;
});
const kpiReport=read('docs/V2949_绩效115KPI逐格重算.json');
const executionReport=read('docs/V2948_静态Excel重算逐格对账.json');
if(kpiReport.match!==115||kpiReport.failures?.length||executionReport.summary?.derived_cell_matches!==1512||executionReport.summary?.failures||executionReport.summary?.kpi_aggregations_reconciled!==55)throw Error('Previously independently recalculated XLSX baseline regressed');
const sampleRecalculation={decision_kpi_formula_match:115,execution_derived_cells_match:1512,execution_aggregates_match:55,execution_aggregates_unverified:executionReport.summary.unverified_aggregations,scope:'ONLY_SPECIFIC_SIMULATED_SUPPLIER_FILTERED_SAMPLES',is_all_585_component_reconciliation:false};
const summary={version:'2.9.54',data_mode:'BUNDLED_SIMULATED_DEMO',components:inventory.length,legacy:inventory.filter(x=>x.kind==='legacy_module').length,
 iframe:inventory.filter(x=>x.kind!=='legacy_module').length,verified_demo_source_files:tableSummaries.length,
 source_rows:tableSummaries.reduce((a,x)=>a+x.rows,0),source_tables_all_unique:tableSummaries.every(t=>t.duplicates===0),
 browser_proof_records:proofs.size,with_metric_source_key_samples:audit.filter(x=>x.source_key_samples_checked>0).length,
 source_key_samples_checked:audit.reduce((a,x)=>a+x.source_key_samples_checked,0),source_key_samples_found_in_csv:audit.reduce((a,x)=>a+x.source_key_samples_found_in_csv,0),
 api_independent_metric_recalc_reported:audit.filter(x=>x.independent_metric_recalculation==='API_INDEPENDENT_CALC_REPORTED').length,
 full_business_pass:audit.filter(x=>x.business_acceptance==='PASS').length,
 status:'FULL_DEMO_BUSINESS_ACCEPTANCE_PENDING',blockers:Object.fromEntries([...statuses].sort((a,b)=>b[1]-a[1])),
 verified_sample_xlsx_recalculation:sampleRecalculation,
 provenance:'V2952 historical test proof plus V2953 17 re-tests; no new browser clicks claimed. V2954 independently resolves returned source-key samples against 23 current Demo CSVs.',
 important:'Source-key samples, API self-reported recomputation, XLSX formula counts, and button clicks are distinct from complete source scope, independent workbook calculation, or narrative semantic correctness.'};
if(audit.length!==585||tableSummaries.length!==23||summary.source_rows!==21455||!summary.source_tables_all_unique)throw Error('V2954 inventory/source integrity regression');
fs.writeFileSync('docs/V2954_585项业务证据逐项核验.json',JSON.stringify({summary,source_tables:tableSummaries,components:audit},null,2)+'\n');
const fields=['id','route','kind','title','ui_three_entry','metric_definitions_found','reported_source_rows','source_key_samples_checked','source_key_samples_found_in_csv','component_source_keys_full','independent_metric_recalculation','visible_web_cells','visible_web_cells_verified','web_cell_status','excel_formula_cells','web_excel_same_cell','narrative_paragraphs','narrative_status','business_acceptance','blockers'];
const q=v=>'"'+String(Array.isArray(v)?v.join(';'):v??'').replaceAll('"','""')+'"';
fs.writeFileSync('docs/V2954_585项计算与来源缺口.csv',[fields.join(','),...audit.map(row=>fields.map(f=>q(row[f])).join(','))].join('\n')+'\n');
fs.writeFileSync('docs/V2954_业务计算验收汇总.json',JSON.stringify(summary,null,2)+'\n');
console.log('V2954 source evidence scan: '+JSON.stringify({components:summary.components,files:summary.verified_demo_source_files,rows:summary.source_rows,keys_checked:summary.source_key_samples_checked,keys_found:summary.source_key_samples_found_in_csv,full_pass:summary.full_business_pass}));
if(process.argv.includes('--strict')&&summary.full_business_pass!==585)process.exitCode=2;
