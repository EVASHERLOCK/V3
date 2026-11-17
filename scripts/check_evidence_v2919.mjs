import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {inspectXlsxFormulas} from './zip_formula_assert.mjs';
import {enterpriseAnalysis} from '../enterprise_v08.mjs';
import {exportProjectWorkbook,exportPerformanceWorkbook} from '../formula_workbook.mjs';
const raw=enterpriseAnalysis({});const listeners={};const env={window:{},sessionStorage:{getItem:()=>null,setItem(){}},document:{addEventListener:(type,cb)=>{listeners[type]=cb},body:{append(){}},createElement:()=>({remove(){},dataset:{}}),getElementById:()=>null},location:{hash:'#ss-project'},console,Number,Math,Date,Map,Set,Intl};env.window=env;env.PharmaGlobalHelp={open(){}};vm.createContext(env);
for(const f of ['static/strategic_sourcing_universe.js','static/strategic_sourcing_project.js','static/strategic_sourcing_performance.js'])vm.runInContext(fs.readFileSync(f,'utf8'),env,{filename:f});
const project=env.PharmaSourcingProject,performance=env.PharmaSupplierPerformance;
const m=project.build(raw,'API-001');assert.equal(m.stages.length,16);assert(m.stages.some(x=>x.status.includes('情景已结束')));assert(m.stages.some(x=>x.status.includes('尚未开始')));assert.equal(m.documents.length,22);assert(m.suppliers.length>=10);
assert(m.evidenceBySupplier[m.suppliers[0].supplier_id].length===22);assert(m.documents.some(x=>x.supplierCoverage>=0));
const evidence=m.suppliers[0];const recompute=Math.round((evidence.quality*.24+evidence.delivery*.18+evidence.technical*.22+evidence.compliance*.22+evidence.commercial*.14)*10)/10;assert(Math.abs(evidence.score-recompute)<.11);
project.hydrate(raw);const html=project.render();for(const t of ['sp-gantt-svg','sp-gantt-progress','sp-doc-mark','sp-doc-summary','data-sp-supplier','质量 (24%)','交付 (18%)','技术 (22%)','合规 (22%)','商务 (14%)','data-sp-open="scoring:all"'])assert(html.includes(t),t);
const p=performance.build(raw,{view:'rd'});performance.hydrate(raw);env.location.hash='#ss-performance';const h2=performance.render();assert.equal(p.candidates.length,80);assert.equal(p.tierGroups.reduce((a,b)=>a+b.count,0),80);assert.equal(p.riskRows.filter(x=>x.riskLevel==='高').length,p.totals.highRisk);for(const t of ['spf-tier-donut-layout','spf-tier-legend','spf-analytics-grid','spf-ppv-plot','图表6：高风险项整改进度甘特图','data-spf-detail="chart:advice"','data-spf-detail="riskchart:matrix"','data-spf-action="new-event"','data-spf-detail="chart:coverage"'])assert(h2.includes(t),t);
assert.equal((h2.match(/class="spf-analysis-card"/g)||[]).length,12);
const expectedRisk=p.candidates[0];const calc=expectedRisk.probability*.30+expectedRisk.impact*.27+Math.max(0,100-expectedRisk.otd)*.18+Math.min(100,expectedRisk.avgDelay*11)*.15+Math.min(100,expectedRisk.qualityDev*20)*.10;assert(Math.abs(expectedRisk.riskScore-calc)<.011,'risk formula reconcile');
for(const [type,buf] of [['project',exportProjectWorkbook({material:'API-001'})],['performance',exportPerformanceWorkbook({view:'rd'})]]){
 assert(buf.length>10000&&buf.subarray(0,4).toString()==='PK\x03\x04',type);
 const check=inspectXlsxFormulas(buf);
 assert(check.formulas>=20, `${type}: at least 20 formula cells expected, found ${check.formulas}`);
 assert(!check.xml.includes('#REF!'), `${type}: broken Excel cell reference`);
 console.log(type,'xlsx formula count',check.formulas);
}
const rule=fs.readFileSync('docs/CORE_TRACEABILITY_RULE_V2919.md','utf8');for(const line of ['全站最高优先级规则','完整公式','文字建议','Top10','待登记'])assert(rule.includes(line));
console.log('PASS V2.9.19 project Gantt/documents and weighted evidence, 12 performance cards/risk charts, global lineage rule, formula-driven project+performance Excel');
