/** V2.9.49 canonical formula/variable/analysis catalog, generated ONCE from the
 * existing business models. It does not calculate independent replacement KPI
 * values. All three outlets must use the same underlying model and filters. */
import {browserDataSource} from './procurement_execution_v2937.mjs';
import {DECISION_TEMPLATE} from './decision_center_v2935.mjs';
import {SIM_KPI_REGISTRY} from './simulation_kpi_v2942.mjs';
import {explainMetric} from './decision_center_definitions_v2935.mjs';

export const REQUIRED_ENTRIES=Object.freeze(['formula','sources','excel']);
export const ACCEPTANCE_LEVELS=Object.freeze(['FUNCTION_TESTED','SIMULATED_RECONCILED','ENTERPRISE_BUSINESS_SIGNED']);
const STEP=['核对筛选条件/来源版本、主键和完整行数','逐行按变量字典取值，缺值或不合法分母不得代入0','按公式计算逐行值并作指标汇总','网页同一筛选结果与Excel公式计算结果独立对账','给出异常来源、计算条件和限制说明；业务结论等待相关负责人签核'];
function dedupe(list){return [...new Set(list.filter(Boolean))]}
function execution(){const pages=browserDataSource().pages,all=[];
 for(const p of pages){const fields=new Map([...p.columns,...p.derived].map(c=>[c.key,c]));
  if(fields.size!==p.columns.length+p.derived.length)throw Error(`Duplicate variable in ${p.id}`);
  function resolve(key,path=[]){if(!fields.has(key))throw Error(`Unmapped variable ${p.id}.${key}`);if(path.includes(key))throw Error(`Derived cycle ${p.id}: ${[...path,key].join(' -> ')}`);
   const item=fields.get(key);const direct=[...String(item.formula||'').matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map(x=>x[1]);
   return dedupe([...direct,...direct.flatMap(x=>resolve(x,[...path,key]))]);
  }
  const rawKeys=new Set(p.columns.map(x=>x.key));
  for(const d of p.derived){for(const key of resolve(d.key))if(!fields.has(key))throw Error(`Unknown dependency ${key}`)}
  for(const m of p.metrics){const roots=dedupe([m.field,m.denom_field,m.condition_field]);
   const deps=dedupe([...roots,...roots.flatMap(x=>resolve(x))]);
   all.push({id:`execution.${p.id}.${m.key}`,family:'procurement-execution',page:p.id,name:m.label,metric_key:m.key,
    operation:m.op,formula:m.excel_formula||m.explain||'NOT_DEFINED',analysis_formula:m.explain||'',
    parameters:{denominator:m.denom_field||null,condition_field:m.condition_field||null,condition_value:m.condition_value??null},
    variables:deps.map(key=>{const v=fields.get(key);return {key,label:v.label,definition:v.definition||'',source:v.source||'',unit:v.unit||'',kind:v.kind||'derived',formula:v.formula||null,raw:rawKeys.has(key)};}),
    source:p.site_contract.source,coverage:'SIMULATED_SAMPLE_ONLY',steps:STEP});
  }
 }
 return all;
}
function decision(){return DECISION_TEMPLATE.metrics.map(m=>{const candidate=explainMetric(m),sim=SIM_KPI_REGISTRY.get(m.id);if(!sim)throw Error('Missing simulation mapping '+m.id);
 return {id:`decision.${m.id}`,family:'decision-center',page:'01-05',name:m.name,metric_key:m.id,
  operation:sim.type,formula:candidate.formula,analysis_formula:sim.note||'',
  parameters:{simulated_type:sim.type,simulation_only:true},variables:sim.fields.map(k=>({key:k,definition:candidate.needs,source:'metric_events + referenced joined simulation source',unit:'see metric'})),
  source:m.source,coverage:'SIMULATED_SAMPLE_ONLY',conditions:candidate.exclude,steps:candidate.steps};});}
export function buildAuditCatalog(){const metrics=[...decision(),...execution()],seen=new Set();for(const m of metrics){if(seen.has(m.id))throw Error('Duplicate canonical audit metric '+m.id);seen.add(m.id);if(!m.formula||!m.steps?.length)throw Error('Missing formula / analysis '+m.id);if(!Array.isArray(m.variables))throw Error('Missing variables '+m.id)}
 return {version:'2.9.49',source_model:'DECISION_TEMPLATE + SIM_KPI_REGISTRY + browserDataSource',entries:REQUIRED_ENTRIES,levels:ACCEPTANCE_LEVELS,metric_count:metrics.length,decision_metric_count:DECISION_TEMPLATE.metrics.length,execution_metric_count:metrics.length-DECISION_TEMPLATE.metrics.length,source_boundary:'SIMULATED_NON_GXP; no enterprise ERP/QMS signoff',metrics};}
