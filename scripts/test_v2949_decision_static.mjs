/* Runtime test of the ACTUAL shipped offline decision engine with the 115 KPI
 * mapping, local snapshot CSV and a capture shim for its XLSX writer.
 * Does not pretend a live browser click or enterprise database certification. */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=fs.readFileSync(path.join(root,'static/decision-center/offline_v2942.mjs'),'utf8');
const sim=pathToFileURL(path.join(root,'simulation_kpi_v2942.mjs')).href;
const shim=pathToFileURL(path.join(root,'scripts/v2949_xlsx_capture.mjs')).href;
const source=code.replaceAll('/engine/simulation_kpi_v2942.mjs',sim).replaceAll('/engine/browser_xlsx_v2939.mjs',shim);
const realFetch=globalThis.fetch;
globalThis.fetch=async input=>{const pathname=String(input);if(!pathname.startsWith('/static/decision-center/')&&!pathname.startsWith('/seed_simulated/'))throw Error('Unexpected URL in offline test: '+pathname);const target=path.join(root,pathname.startsWith('/static/decision-center/')?'dist/'+pathname.slice(1):pathname.slice(1));return new Response(fs.readFileSync(target),{status:200});};
const {scopedDecision,decisionModule,downloadOfflineWorkbook}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const scope={month:'all',supplier:'SUP-001',material:'all',project:'all',as_of:'2026-11-11'};
let failures=[],kpiCount=0,sourceRows=0,sourceSheets=0,formulas=0,compare=0;
try{
 const {dataset}=await scopedDecision(scope);assert.equal(dataset.metrics.length,115);
 const check=[['metric','KPI-01-01'],['analysis','1'],['rule','1'],['action','1'],['dictionary','1'],['page','01']];
 for(const [kind,id] of check){const report=await decisionModule(kind,id,scope);assert.ok(report.metrics.length,kind);for(const t of report.tables){assert.equal(t.count,t.rows.length,kind+' '+t.table);sourceRows+=t.rows.length;}
  await downloadOfflineWorkbook(scope,`V2949_${kind}_${id}.xlsx`,{kind,id});const {tabs,name}=globalThis.__v2949Xlsx;
  assert.ok(name.endsWith('.xlsx'));const wanted=new Set(['模块分析','范围','KPI公式','网页Excel逐格对账','术语及变量','模拟指标事件']);
  for(const n of wanted)assert.ok(tabs.some(t=>t.name===n),kind+' missing '+n);
  const k=tabs.find(t=>t.name==='KPI公式'),cmp=tabs.find(t=>t.name==='网页Excel逐格对账');
  assert.equal(k.rows.length,report.metrics.length+1);assert.equal(cmp.rows.length,k.rows.length);
  assert.ok(k.rows.slice(1).every(r=>typeof r[1]?.formula==='string'&&r[1].formula.length>6));
  assert.ok(cmp.rows.slice(1).every(r=>String(r[3]?.formula).includes('MATCH')));
  for(const tab of tabs.filter(t=>t.name.startsWith('模块来源_'))){const table=report.tables.find(t=>`模块来源_${t.table}`.slice(0,31)===tab.name);assert.ok(table);assert.equal(tab.rows.length,table.rows.length+1);sourceSheets++}
  kpiCount+=report.metrics.length;formulas+=k.rows.length-1;compare+=cmp.rows.length-1;
  console.log('OFFLINE_DECISION',kind,id,report.metrics.length,'formulas',tabs.length,'sheets');
 }
 const metrics=dataset.metrics.map(m=>m.id);for(const id of metrics){const r=await decisionModule('metric',id,scope);assert.equal(r.metrics.length,1,id);if(r.tables.some(t=>t.count!==t.rows.length))throw Error(id+' truncated source')}
}catch(e){failures.push({message:e.stack||e.message});console.error('V2949 static decision test failure',String(e.message||e).slice(0,700))}finally{globalThis.fetch=realFetch;}
const output={version:'2.9.49',scope:'SIMULATED_OFFLINE_STATIC_RUNTIME_NOT_HTTP',decision_kpi_definitions:115,smoke_module_types:6,generated_kpi_formulas:formulas,formula_comparisons:compare,source_tables_with_complete_rows:sourceSheets,source_rows_inspected_in_six_exports:sourceRows,live_browser_clicks:0,enterprise_database_verified:false,failures};
fs.writeFileSync(path.join(root,'docs/V2949_绩效静态计算Excel测试.json'),JSON.stringify(output,null,2)+'\n');
if(failures.length)process.exitCode=1;else console.log('V2949 static decision passed:',JSON.stringify(output));
