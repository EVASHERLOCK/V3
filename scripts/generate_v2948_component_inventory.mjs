/** Create full 217 legacy + 368 exact UI component inventory.
 * IDs are deterministic and built from authoritative 115 KPI, 22 analysis,
 * 30 rule, 24 action and 62 execution panel definitions. */
import fs from 'node:fs';
const read=x=>JSON.parse(fs.readFileSync(x,'utf8'));
const active=read('docs/V2929_组件扫描基线.json').components.filter(c=>!['m05','m08','m10'].includes(c.route));
if(active.length!==217)throw Error('Legacy active baseline altered, investigate before merging');
const definition=read('decision_center_template_v2934.json');
const text=fs.readFileSync('static/procurement-execution/site-data.js','utf8');
const db=JSON.parse(text.slice(text.indexOf('=')+1).trim().replace(/;$/,''));
if(definition.metrics.length!==115||definition.analysis.length!==22||definition.rules.length!==30||definition.actions.length!==24||db.pages.length!==9)throw Error('Actual component count changed; re-map source before building');
const make=(id,route,title,kind='iframe_submodule')=>({id,route,title,kind,status:'PENDING',evidence:{}});
const oldIdCounts=new Map();
const components=active.map(c=>{const repeat=oldIdCounts.get(c.id)||0;oldIdCounts.set(c.id,repeat+1);return make(repeat?`${c.id}__baseline_duplicate_${repeat}`:c.id,c.route,c.title,'legacy_module');});
for(const m of definition.metrics)components.push(make(`decision-01.metric.${m.id}`,'decision-01',m.name));
for(const [i,a] of definition.analysis.entries())components.push(make(`decision-02.analysis.${String(i+1).padStart(2,'0')}`,'decision-02',a[0]));
for(const [i,r] of definition.rules.entries())components.push(make(`decision-03.rule.${String(i+1).padStart(2,'0')}`,'decision-03',r[1]));
for(const [i,a] of definition.actions.entries())components.push(make(`decision-04.action.${String(i+1).padStart(2,'0')}`,'decision-04',a[1]));
for(const m of definition.metrics)components.push(make(`decision-05.dictionary.${m.id}`,'decision-05',m.name));
const standard=['kpis','ledger','business','workflow','trend','distribution','analysis'];
for(const [i,p] of db.pages.entries()){
 const route='exec-0'+i,panels=standard.filter(name=>name!=='ledger'||p.id!=='rfq');
 for(const key of panels)components.push(make(`${route}.panel.${key}`,route,`${p.title} · ${key}`));
}
const out={version:'2.9.48',generated_from:['docs/V2929_组件扫描基线.json','decision_center_template_v2934.json','static/procurement-execution/site-data.js','static/procurement-execution/assets/app.js'],scope:'ACTUAL_KPI_AND_PANEL_UI_AUDIT_SLOTS_NOT_BUSINESS_VERIFIED',evidence_fields:['click_formula','formula_variables','calculation_conditions','source_row_identity','source_row_count','full_source_pagination','cell_formula_web','cell_formula_xlsx','excel_numeric_match','narrative_steps','browser_e2e','business_signoff'],components};
fs.writeFileSync('docs/V2948_逐实际控件验收清单.json',JSON.stringify(out,null,2)+'\n');
console.log('V2.9.48 inventory:',components.length,'total; 217 legacy +',components.length-active.length,'explicit iframe UI units');
