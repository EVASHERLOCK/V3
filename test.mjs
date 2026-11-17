import fs from 'node:fs';
import {kpiAnalyze,sourcingAnalyze,checklist} from './calculations.mjs';
function csv(name){let text=fs.readFileSync('./samples/'+name,'utf8').replace(/^\ufeff/,'').trim();let [header,...lines]=text.split(/\r?\n/);let keys=header.split(',');return lines.map(x=>Object.fromEntries(x.split(',').map((v,i)=>[keys[i],v])))}
function assert(x,msg){if(!x)throw new Error(msg)}
const p=csv('purchase_orders.csv'),q=csv('qc_lots.csv'),prod=csv('production.csv'),inv=csv('inventory.csv'),changes=csv('change_controls.csv');
let a=kpiAnalyze({po:p,qc:q,production:prod,inventory:inv,changes});let m=Object.fromEntries(a.metrics.map(x=>[x.key,x.value]));
for(const [k,v] of Object.entries({otd:91.7,availability:41.7,qc_lead:12.1,ppv:2.53,inventory_risk:4,open_changes:2}))assert(m[k]===v,`KPI ${k}: ${m[k]} expected ${v}`);
assert(a.v5.comparable_funnel.stages.at(-1).count===5,'funnel mismatch');assert(a.v5.cause_breakdown.reduce((n,x)=>n+x.count,0)===7,'cause lines mismatch');
let b=kpiAnalyze({po:p,qc:q,production:csv('production_scenario_b.csv'),inventory:inv,changes});assert(b.metrics.find(x=>x.key==='availability').value===75,'scenario B mismatch');
let source=sourcingAnalyze({suppliers:csv('suppliers.csv'),quotes:csv('quotes.csv'),documents:csv('supplier_documents.csv')});assert(source.results.length>0&&source.results[0].score>0,'sourcing failed');
let d=checklist({docs:csv('supplier_documents.csv')});assert(d.length>0,'checklist failed');
console.log('PASS: KPI 91.7/41.7/12.1/2.53 + alternative 75%; funnel, supplier sourcing, compliance checklist');
