/** V2.9.55: merge full-scope source+calculation checks with existing 585 registration.
 * A numeric/source PASS is NOT an end-to-end Demo acceptance PASS.
 */
import fs from 'node:fs';
import {getDecisionMetricAssociations,DECISION_TEMPLATE} from '../decision_center_v2935.mjs';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const inventory=load('docs/V2953_Demo_585逐组件验收明细.json').components;
const previous=load('docs/V2954_585项业务证据逐项核验.json').components;
const old=new Map(previous.map(x=>[x.id,x]));
const decision=load('docs/V2955_115KPI_全量来源主键与独立复算.json');
const execution=load('docs/V2955_9执行页62组件_全量主键与算式核验.json');
const ki=new Map(decision.metrics.map(x=>[x.id,x]));
const ei=new Map(execution.components.map(x=>[x.id,x]));
const pageMetricMap=new Map();
const associations=getDecisionMetricAssociations();
for(const c of inventory.filter(c=>c.route.startsWith('decision-'))){
 if(c.id.includes('.metric.')||c.id.includes('.dictionary.')){pageMetricMap.set(c.id,[c.id.split(/\.(?:metric|dictionary)\./)[1]]);continue;}
 if(c.id.includes('.analysis.')){
  // Analysis definitions are indexed from the built-in 22-route model.
  const index=Number(c.id.split('.').at(-1)),source=DECISION_TEMPLATE.analysis?.[index-1];
  if(source){const ids=source[2].map(n=>DECISION_TEMPLATE.metrics.find(m=>m.name===n)?.id).filter(Boolean);pageMetricMap.set(c.id,ids);}
  continue;
 }
 // Runtime rule/action graph is the actual site source of KPI associations.
 const [kind,index]=c.id.split('.').slice(1);
 const refs=kind==='rule'?associations.ruleRefs:associations.actionRefs;
 if(refs)pageMetricMap.set(c.id,refs[Number(index)]||[]);
}
const checked=inventory.map(c=>{
 const prev=old.get(c.id),kpis=pageMetricMap.get(c.id)||[];
 const km=kpis.map(k=>ki.get(k)).filter(Boolean);const ex=ei.get(c.id);
 const metricCoverage=km.length&&km.length===kpis.length&&km.every(x=>x.tested_result==='SOURCE_AND_INDEPENDENT_CALC_MATCH');
 const lineage=ex?ex.sources_pks_and_selected_arithmetic:metricCoverage?'FULL_CSV_KEYS_AND_INDEPENDENT_NUMERIC_MATCH':'PENDING';
 const missing=ex?ex.remaining:[
  'LIVE_WEB_CELL_SNAPSHOT_AND_SCOPE','XLSX_FULL_SCOPE_INDEPENDENT_RECALC','NARRATIVE_CONDITION_AND_SEMANTIC_REVIEW',
  ...(metricCoverage?[]:['PER_COMPONENT_FULL_SOURCE_LINEAGE_OR_NUMERIC_PROOF'])
 ];
 return {id:c.id,route:c.route,title:c.title,kind:c.kind,three_entry_demo:c.three_entry_browser_demo,
  kpi_ids:kpis,source_provenance:lineage,source_key_set_refs:km.map(x=>x.full_source_key_set_ref),
  execution_source_key_set_ref:ex?.key_set_ref||null,
  independent_numeric_calculation:kpis.length?(metricCoverage?'RECALCULATED_FROM_ALL_CSV_ROWS':'NOT_FULLY_RECALCULATED'):ex?'PAGE_56_AGGREGATES_RECONCILED_NOT_EVERY_PANEL':'PENDING',
  prior_sample_key_matches:prev?.source_key_samples_found_in_csv||0,
  web_to_xlsx_cell_by_cell:'NOT_VERIFIED_FULL_SCOPE',narrative_semantic_check:'PENDING',
  full_demo_pass:false,remaining:missing};
});
const summary={version:'2.9.55',data_mode:'SIMULATED_DEMO_ONLY',total_registered:checked.length,
 legacy_components:checked.filter(x=>x.kind==='legacy_module').length,performance_components:checked.filter(x=>x.route.startsWith('decision-')).length,
 execution_components:checked.filter(x=>x.route.startsWith('exec-')).length,
 performance_components_with_full_csv_kpi_lineage:checked.filter(x=>x.source_provenance==='FULL_CSV_KEYS_AND_INDEPENDENT_NUMERIC_MATCH').length,
 execution_components_with_full_csv_primary_keys:checked.filter(x=>x.execution_source_key_set_ref).length,
 full_115_kpi_numeric_match:decision.summary.source_and_number_match,
 full_56_execution_aggregate_match:execution.summary.matched_aggregation_metrics,
 full_585_business_pass:checked.filter(x=>x.full_demo_pass).length,
 strict_status:'BLOCKED_PENDING_FULL_WEB_XLSX_NARRATIVE',notes:'Historical V08 pages still contain legacy sample data and cannot be silently mapped to current 23 CSVs. Full browser-cell, full-scope XLSX and narrative checks remain distinct requirements.'};
if(checked.length!==585||summary.legacy_components!==217||summary.performance_components!==306||summary.execution_components!==62)throw Error('Inventory mismatch');
const output={summary,components:checked};fs.writeFileSync('docs/V2955_Demo_585项逐组件最新验收.json',JSON.stringify(output,null,2)+'\n');
const fields=['id','route','title','kind','three_entry_demo','source_provenance','independent_numeric_calculation','web_to_xlsx_cell_by_cell','narrative_semantic_check','full_demo_pass','remaining'];
const csv=x=>'"'+String(Array.isArray(x)?x.join(';'):x??'').replaceAll('"','""')+'"';
fs.writeFileSync('docs/V2955_Demo_585项逐组件最新验收.csv',[fields.join(','),...checked.map(x=>fields.map(f=>csv(x[f])).join(','))].join('\n')+'\n');
fs.writeFileSync('docs/V2955_验收摘要.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));if(process.argv.includes('--strict')&&summary.full_585_business_pass!==585)process.exitCode=2;
