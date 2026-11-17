/** V2.9.48 source- and formula-level checks. NEVER reports browser E2E PASS. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TABLES,rowsFor} from '../sim_data_center_v2941.mjs';
import {buildExecutionDataset,exportExecutionWorkbook,PAGE_IDS} from '../procurement_execution_v2937.mjs';
import {inspectXlsxFormulas} from './zip_formula_assert.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url))+'/..';
const base=process.env.PHARMA_TEST_URL||'http://127.0.0.1:39476';
const out={version:'2.9.48',tested_at:new Date().toISOString(),scope:'SOURCE_API_AND_WORKBOOK_STRUCTURAL_NOT_BROWSER_E2E',tables:[],execution_pages:[],decision_pages:[],failures:[]};
async function api(url){const r=await fetch(base+url);const body=await r.json().catch(()=>({}));return {status:r.status,body};}
for(const table of TABLES){
 try{
  const local=rowsFor(table),unique=new Set(),count=local.length;let offset=0,snapshot=null,pages=0;
  while(true){const q=new URLSearchParams({table,offset:String(offset),limit:'137'});if(snapshot)q.set('snapshot',snapshot);
   const {status,body}=await api('/api/sim-data/complete-page?'+q.toString());assert.equal(status,200,table+' '+JSON.stringify(body).slice(0,350));
   assert.equal(body.source_type,'SIMULATED_LOCAL_CSV_NON_GXP');assert.equal(body.full_source_covered,false);
   if(snapshot)assert.equal(body.source_snapshot,snapshot);else snapshot=body.source_snapshot;
   assert.equal(body.total,count);assert.equal(body.offset,offset);assert.equal(body.returned,body.rows.length);assert.equal(body.row_ids.length,body.returned);
   for(const id of body.row_ids){assert.ok(id);assert.ok(!unique.has(id),table+': duplicate '+id);unique.add(id);}
   pages++;offset+=body.returned;
   if(!body.has_more){assert.equal(body.next_offset,null);break;}
   assert.equal(body.next_offset,offset);assert.ok(pages<200);
  }
  assert.equal(offset,count);assert.equal(unique.size,count);
  const mismatch=await api('/api/sim-data/complete-page?'+new URLSearchParams({table,snapshot:'invalid-old-snapshot',limit:'2'}));
  assert.equal(mismatch.status,409);
  out.tables.push({table,local_records:count,pages,unique_keys:unique.size,consistent_snapshot:true,all_simulated_rows_retrieved:true,enterprise_source_verified:false});
 }catch(e){out.failures.push({stage:'table',table,message:e.message});}
}
for(const page of PAGE_IDS){
 try{
  const q={page,supplier:'SUP-001'},ds=buildExecutionDataset(q),pageModel=ds.pages.find(p=>p.id===page);
  const x=await exportExecutionWorkbook(q),r=inspectXlsxFormulas(x);
  assert.ok(r.sheets>=9);assert.ok(r.xml.includes('网页Excel逐格对账')||r.xml.includes('MATCH'));
  assert.ok(r.xml.includes('<f>')||r.xml.includes('<f '));
  assert.ok(!/\{(?:request_qty|po_qty|ship_qty|invoice_amount)\}/.test(r.xml),'Unresolved variable');
  const min=ds.rows.length*pageModel.derived.length*2;
  assert.ok(r.formulas>=min,`Derived row formulas and comparison formulas missing ${r.formulas} vs ${min}`);
  const shell=fs.readFileSync(path.join(ROOT,'static/procurement-execution',`0${PAGE_IDS.indexOf(page)}_${['询价与报价比对','合同核查','PO创建与比对','发运与到货','发票核对','付款与应付','退货与索赔','订单关闭与绩效','异常处理中心'][PAGE_IDS.indexOf(page)]}.html`),'utf8');
  assert.ok(shell.includes(`data-page="${page}"`));
  out.execution_pages.push({page,records_in_test_scope:ds.rows.length,derived_variables:pageModel.derived.length,metrics:pageModel.metrics.length,workbook_sheets:r.sheets,formula_cells:r.formulas,formula_structural_check:true,excel_recomputed_values_browser_verified:false});
 }catch(e){out.failures.push({stage:'execution',page,message:e.message});}
}
for(let i=1;i<=5;i++){
 const name=['KPI总览','深度分析','智能预警','行动闭环','指标治理'][i-1],html=fs.readFileSync(path.join(ROOT,`static/decision-center/0${i}_${name}.html`),'utf8');
 const injected=html.includes('lineage_entry_v2948.js');
 if(!injected)out.failures.push({stage:'decision',page:i,message:'Missing shared triple entry'});
 out.decision_pages.push({page:`0${i}`,three_entry_script:injected,actual_click_browser_e2e:false});
}
fs.writeFileSync(path.join(ROOT,'docs/V2948_来源公式结构测试.json'),JSON.stringify({...out,summary:{tables_ok:out.tables.length,table_rows:out.tables.reduce((a,x)=>a+x.local_records,0),execution_pages_ok:out.execution_pages.length,decision_pages_scripted:out.decision_pages.filter(x=>x.three_entry_script).length,failures:out.failures.length,all_business_verified:false}},null,2)+'\n');
console.log('V2.9.48 integrity:',out.tables.length,'source tables',out.tables.reduce((a,x)=>a+x.local_records,0),'unique synthetic rows;',out.execution_pages.length,'execution xlsx;',out.decision_pages.length,'decision entry pages;',out.failures.length,'failures');
if(out.failures.length){console.error(JSON.stringify(out.failures,null,2));process.exitCode=1;}
