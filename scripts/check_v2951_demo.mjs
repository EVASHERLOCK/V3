/** V2.9.51 DEMO-only acceptance. No real ERP, QMS, company signatures or HTTPS deployment needed.
 * A verified synthetic source is NOT evidence that every UI control has been clicked.
 * This script intentionally never promotes a component from sample/reconciled to fully passed without per-control proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {TABLES,rowsFor,parseCSV,overview,validateAll,fileFor} from '../sim_data_center_v2941.mjs';
import {buildAuditCatalog} from '../audit_registry_v2949.mjs';
const root=process.cwd(), args=process.argv.slice(2);
const outDir=path.resolve(args.includes('--out-dir')?args[args.indexOf('--out-dir')+1]:'docs');
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(buf)=>crypto.createHash('sha256').update(buf).digest('hex');
const seed=read('seed_simulated/manifest.json');
const inventory=read('docs/V2948_逐实际控件验收清单.json').components;
const kpi=read('docs/V2949_绩效115KPI逐格重算.json');
const xlsx=read('docs/V2948_静态Excel重算逐格对账.json');
const browser=read('docs/V2949_离线浏览器交互测试.json');
const livePath='docs/V2951_Demo_浏览器逐组件点击.json';
const live=fs.existsSync(livePath)?read(livePath):null;
const liveById=new Map((live?.test_type==='LIVE_CHROMIUM_HTTP_BROWSER'?live.components:[]||[]).map(item=>[item.id,item]));
const sourceReport=read('docs/V2948_来源公式结构测试.json');
const catalog=buildAuditCatalog();
const errors=[];
const addError=(key,detail)=>errors.push({key,detail:String(detail)});
const source={source_type:'SIMULATED_CSV_DEMO',seed:seed.seed,table_count:0,canonical_table_count:TABLES.length,auxiliary_table_count:0,row_count:0,pk_unique:true,referential_valid:false,manifest_counts_equal:true,monthly_summary_reconciled:false,verified_tables:[],sha256_manifest:null};
const ids=overview().keys;
for(const table of TABLES){
 const rows=rowsFor(table),pk=ids[table],seen=new Set(),duplicates=[];
 for(const [i,row] of rows.entries()){
  const id=row[pk];if(!id||seen.has(id))duplicates.push({line:i+2,id:String(id??'')});seen.add(id);
 }
 const expected=seed[table],file=fileFor(table),fingerprint=sha(fs.readFileSync(file));
 source.table_count++;source.row_count+=rows.length;
 const good=duplicates.length===0&&rows.length===expected;
 if(!good){source.pk_unique&&=duplicates.length===0;source.manifest_counts_equal&&=rows.length===expected;addError('source.'+table,JSON.stringify({duplicates:duplicates.slice(0,3),expected,actual:rows.length}))}
 source.verified_tables.push({table,file:'seed_simulated/'+table+'.csv',primary_key:pk,expected_rows:expected,actual_rows:rows.length,unique_primary_keys:seen.size,source_sha256:fingerprint,status:good?'PASS':'BLOCKED'});
}
// The synthetic seed folder also contains two supported auxiliary CSVs omitted from the canonical 21-table API list.
// Include them in the DEMO full-source scan rather than silently claiming every CSV was covered.
const extraFiles=fs.readdirSync('seed_simulated').filter(x=>x.endsWith('.csv')&&!TABLES.includes(x.slice(0,-4))).sort();
const auxKeys={supplier_documents:'document_id',monthly_kpi_summary:'month'};
for(const name of extraFiles){
 const table=name.slice(0,-4),filename='seed_simulated/'+name,rows=parseCSV(fs.readFileSync(filename,'utf8'));
 const pk=auxKeys[table],seen=new Set();
 if(!pk){addError('source.unregistered_auxiliary',name);continue}
 const dup=rows.filter(r=>!r[pk]||(seen.has(r[pk])?true:(seen.add(r[pk]),false)));
 const expected=seed[table]??(table==='monthly_kpi_summary'?12:undefined);
 if(dup.length||expected!==rows.length){source.pk_unique&&=dup.length===0;source.manifest_counts_equal&&=expected===rows.length;addError('source.aux.'+table,JSON.stringify({duplicates:dup.length,expected,actual:rows.length}))}
 source.table_count++;source.auxiliary_table_count++;source.row_count+=rows.length;
 source.verified_tables.push({table,file:filename,primary_key:pk,expected_rows:expected,actual_rows:rows.length,unique_primary_keys:seen.size,source_sha256:sha(fs.readFileSync(filename)),status:dup.length||expected!==rows.length?'BLOCKED':'PASS',coverage:'AUXILIARY_FILE_NOT_IN_21_TABLE_API'});
}
if(extraFiles.length!==2)addError('source.auxiliary_count','Expected two additional synthetic CSVs, found '+extraFiles.join(','));
// Cross-check auxiliary document keys against canonical master data.
const docs=parseCSV(fs.readFileSync('seed_simulated/supplier_documents.csv','utf8'));
for(const [ref,table,pk] of [['supplier_id','suppliers','supplier_id'],['material_id','materials','material_id'],['project_id','projects','project_id']]){
 const known=new Set(rowsFor(table).map(x=>x[pk]));if(docs.some(x=>!known.has(x[ref])))addError('source.aux.orphans','supplier_documents.'+ref);
}
// Recalculate all 12 monthly derived summary rows from the actual 1440 synthetic PO records, linked invoices and payments.
const sums=parseCSV(fs.readFileSync('seed_simulated/monthly_kpi_summary.csv','utf8'));
const pos=rowsFor('purchase_orders'),invoices=rowsFor('invoices'),payments=rowsFor('payments');
const byPO=new Map(pos.map(p=>[p.po_id,p]));
const sum=(list,key)=>list.reduce((total,r)=>total+Number(r[key]||0),0);
const round=(v,p)=>Number(v.toFixed(p));
let summaryErrors=[];
for(const m of sums){
 const pm=pos.filter(p=>p.created_date.startsWith(m.month));
 const invm=invoices.filter(i=>byPO.get(i.po_id)?.created_date.startsWith(m.month));
 const paym=payments.filter(p=>p.payment_status==='SIMULATED_SETTLED'&&byPO.get(p.po_id)?.created_date.startsWith(m.month));
 const actual={po_count:pm.length,po_spend_usd:round(sum(pm,'po_amount_usd'),2),otd_percent:round(100*pm.filter(p=>p.receipt_date<=p.promised_date).length/pm.length,3),infull_percent:round(100*pm.filter(p=>Number(p.received_qty)>=Number(p.ordered_qty)).length/pm.length,3),invoiced_usd:round(sum(invm,'invoice_amount_usd'),2),paid_usd:round(sum(paym,'payment_amount_usd'),2)};
 for(const [key,value] of Object.entries(actual))if(Math.abs(Number(m[key])-value)>0.0001)summaryErrors.push({month:m.month,key,expected:m[key],actual:value});
}
source.monthly_summary_reconciled=summaryErrors.length===0;
if(summaryErrors.length)addError('source.aux.monthly_recalc',JSON.stringify(summaryErrors.slice(0,4)));
const relations=validateAll();source.referential_valid=relations.ok;
if(!relations.ok)addError('source.foreign_keys',JSON.stringify(relations.violations.slice(0,5)));
source.sha256_manifest=sha(JSON.stringify(source.verified_tables));
const sourcePass=source.table_count===23&&source.pk_unique&&source.manifest_counts_equal&&source.referential_valid&&source.monthly_summary_reconciled&&!errors.some(x=>x.key.startsWith('source.'));
const definitionsPass=catalog.metric_count===171&&catalog.decision_metric_count===115&&catalog.execution_metric_count===56;
if(!definitionsPass)addError('metric.catalog','Catalog counts changed');
const kpipass=kpi.match===115&&kpi.formula_rows===115&&kpi.diff===0&&kpi.missing===0&&(kpi.failures||[]).length===0;
if(!kpipass)addError('metric.kpi_excel','KPI workbook comparison not 115/115');
const xpass=xlsx.summary?.pages_recalculated===9&&xlsx.summary?.derived_cell_matches===1512&&xlsx.summary?.failures===0&&xlsx.pages?.length===9;
if(!xpass)addError('metric.execution_excel','Nine-page XLSX recalc differs from recorded sample');
const iframeClickPass=(browser.failures||[]).length===0&&browser.execution?.length===9&&browser.decision?.length===5&&browser.execution?.reduce((a,x)=>a+x.panels,0)===62;
if(!iframeClickPass)addError('ui.iframe_offline','14 iframe offline DOM smoke test absent or failed');
const allSourcePagination=sourceReport.tables?.length===21&&sourceReport.summary?.table_rows===source.verified_tables.filter(x=>TABLES.includes(x.table)).reduce((n,x)=>n+x.actual_rows,0)&&(sourceReport.failures||[]).length===0;
if(!allSourcePagination)addError('source.api_pagination','Source pagination report incomplete');
if(inventory.length!==585)addError('ui.registry','Registered slots are not 585');
// Offline iframe smoke tests provide page-level samples, not per-submodule final evidence.
const each=inventory.map(c=>{
 const kind=c.kind==='legacy_module'?'LEGACY':'IFRAME';
 const pageClick=kind==='IFRAME'&&iframeClickPass&&browser.execution.some(x=>c.route==='exec-0'+['rfq','contracts','orders','shipments','invoices','payments','claims','closing','exceptions'].indexOf(x.page));
 const pageFormula=kind==='IFRAME'&&((c.route.startsWith('decision-')&&kpipass)||(c.route.startsWith('exec-')&&xpass));
 const click=liveById.get(c.id);const realDemoClick=click?.status==='CLICK_TESTED'&&click.formula?.ok&&click.sources?.ok&&click.excel?.ok;
 return {id:c.id,route:c.route,title:c.title,kind,
  demo_status:'PENDING_COMPONENT_EVIDENCE',
  source_dataset_verified:sourcePass,
  metric_catalog_mapped:pageFormula,
  offline_page_click_sample_verified:pageClick,
  real_demo_browser_click_verified:!!realDemoClick,
  workbook_download_has_formula:!!(realDemoClick&&click.excel?.formula_cells>0),
  component_formula_click_verified:!!realDemoClick,
  component_source_rows_verified:false,
  component_excel_formula_same_value_verified:false,
  component_narrative_verified:false,
  blocker:kind==='LEGACY'?'尚无本组件的真实交互和逐格对账证据（仅有旧版基线登记）':'离线按页抽样及公式范围对账不能代替此控件的逐项点击、来源/Excel/文字结论证据'};
});
const stage1=sourcePass&&definitionsPass&&allSourcePagination;
const stage2=kpipass&&xpass&&iframeClickPass;
const totalExcelAggregate=xlsx.pages.reduce((n,p)=>n+(p.numeric_kpi_reconciled||0),0);
const aggregateUnverified=xlsx.pages.reduce((n,p)=>n+(p.non_numeric_kpi_unverified||0),0);
const passed=each.filter(x=>x.demo_status==='PASS').length;
const finalPass=stage1&&stage2&&passed===585&&errors.length===0&&aggregateUnverified===0;
const summary={version:'2.9.51',acceptance_type:'DEMO_SIMULATED_ONLY',tested_at:new Date().toISOString(),not_required:['REAL_ERP','REAL_QMS','ENTERPRISE_SIGNATURE','ENTERPRISE_DEPLOYMENT_HTTPS'],
 source_mode:'SIMULATED',source_version:seed.seed,stage_1_demo_full_source_and_catalog:stage1?'PASS':'BLOCKED',stage_2_scoped_formula_and_iframe_checks:stage2?'SCOPED_PASS':'BLOCKED',stage_3_all_585_demo_controls:finalPass?'PASS':'PENDING',overall:finalPass?'DEMO_ACCEPTED':'DEMO_PARTIALLY_VERIFIED',
 source_tables:source.table_count,source_rows:source.row_count,source_table_integrity:sourcePass?'PASS':'BLOCKED',canonical_source_tables:source.canonical_table_count,auxiliary_source_files:source.auxiliary_table_count,source_pagination_report:allSourcePagination?'21_CANONICAL_TABLES_PASS__2_AUX_FILES_LOCAL_AUDIT_ONLY':'BLOCKED',monthly_aux_summary_recalculated:source.monthly_summary_reconciled,metric_definitions:catalog.metric_count,
 decision_kpis_recalculated:kpi.match,decision_kpis_total:kpi.formula_rows,execution_sample_cells_reconciled:xlsx.summary?.derived_cell_matches,execution_numeric_aggregates_reconciled:totalExcelAggregate,execution_aggregates_unverified:aggregateUnverified,
 real_demo_http_clicked:each.filter(x=>x.real_demo_browser_click_verified).length,iframe_pages_offline_sampled:(browser.execution?.length||0)+(browser.decision?.length||0),iframe_panels_offline_clicked:browser.execution?.reduce((n,p)=>n+p.panels,0)||0,
 components_registered:inventory.length,components_fully_verified_demo:passed,legacy_components_unverified:each.filter(c=>c.kind==='LEGACY'&&c.demo_status!=='PASS').length,
 evidence_note:'DEMO: no enterprise ERP/QMS, credentials or signer required. Source and sample formulas PASS do not imply all 585 modules passed click, all filters, narrative or Excel checks. Optional real HTTP click tests may be on local localhost.',
 independent_recalculation_recorded_at:{decision:kpi.tested_at_utc||null,execution:xlsx.tested_at_utc||null},
 browser_boundary:'Offline DOM smoke only. Full per-control browser click still missing. Enterprise network limitation is NOT a demo-data blocker.',errors};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'V2951_Demo_全量来源清单.json'),JSON.stringify(source,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'V2951_Demo_585项逐组件进度.json'),JSON.stringify({version:'2.9.51',scope:'DEMO',components:each},null,2)+'\n');
const q=x=>'"'+String(x??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(outDir,'V2951_Demo_585项验收进度.csv'),[['id','route','title','kind','demo_status','source_dataset_verified','metric_catalog_mapped','offline_page_click_sample_verified','blocker'].join(','),...each.map(x=>['id','route','title','kind','demo_status','source_dataset_verified','metric_catalog_mapped','offline_page_click_sample_verified','blocker'].map(k=>q(x[k])).join(','))].join('\n')+'\n');
fs.writeFileSync(path.join(outDir,'V2951_Demo_验收报告.json'),JSON.stringify(summary,null,2)+'\n');
if(outDir===path.resolve('docs')){
 const publicDir='static/audit';fs.mkdirSync(publicDir,{recursive:true});
 fs.writeFileSync(path.join(publicDir,'demo-acceptance.json'),JSON.stringify(summary,null,2)+'\n');
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>采购演示站 · Demo 验收进度</title><style>body{font:15px/1.7 system-ui,sans-serif;max-width:1000px;margin:30px auto;padding:0 22px;color:#243c42;background:#f7f9f9}h1{font-size:27px}h2{font-size:19px}section{background:white;border:1px solid #dde6e8;border-radius:12px;padding:18px;margin:18px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #e4eded}.note{color:#56676b}.ok{color:#157452;font-weight:700}.pending{color:#aa6530;font-weight:700}code{font-size:13px}</style></head><body><h1>采购 Demo 验收状态</h1><p class="note">数据模式：SIMULATED（纯模拟）。不需要企业 ERP/QMS、企业数据库、真实采购记录或业务签字。</p><section><h2>本次结果</h2><table><tr><th>检查项目</th><th>当前状态</th></tr><tr><td>全部模拟 CSV 完整性</td><td class="ok">${safe(summary.source_tables)} 份 / ${safe(summary.source_rows)} 行 · ${safe(summary.source_table_integrity)}</td></tr><tr><td>115 项 KPI 公式复算</td><td class="ok">${safe(summary.decision_kpis_recalculated)} / ${safe(summary.decision_kpis_total)}</td></tr><tr><td>采购执行逐格计算（指定样本）</td><td class="ok">${safe(summary.execution_sample_cells_reconciled)} 项一致</td></tr><tr><td>14 iframe 页离线点击样本</td><td>${safe(summary.iframe_pages_offline_sampled)} 页</td></tr><tr><td>585 项逐组件完整 Demo 验收</td><td class="pending">${safe(summary.components_fully_verified_demo)} / ${safe(summary.components_registered)}，仍待逐项验证</td></tr></table></section><section><h2>边界说明</h2><p>本报告只对 Demo 数据和现有测试证据负责。已完成的来源表全量核对不等于每个页面中每段文字分析都已核对。缺失的组件级真实点击及公式一致性证据仍明确列为待办，而不是凭系统数据正确性自动放行。</p><p>21 张业务表有分页接口核验；另 2 份辅助 CSV 进行了文件完整性与月度汇总复算，没有冒称支持相同的分页 API。</p><a href="demo-acceptance.json">查看机器可读验收结果 (JSON)</a></section><p class="note">生成时间：${safe(summary.tested_at)} · 不属于企业 GxP 认证</p></body></html>`;
 fs.writeFileSync(path.join(publicDir,'demo-acceptance.html'),html);
}
console.log(`V2951 DEMO: ${summary.overall} | synthetic sources ${source.table_count} tables / ${source.row_count} rows | KPI ${kpi.match}/115 | execution cells ${xlsx.summary?.derived_cell_matches} | UI complete ${passed}/585 | ERP/QMS required: NO`);
for(const x of errors)console.log('BLOCKER',x.key,x.detail);
if(args.includes('--strict')&&!finalPass)process.exitCode=2;
if(errors.length)process.exitCode=1;
