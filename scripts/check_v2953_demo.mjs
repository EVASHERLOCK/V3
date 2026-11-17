/** V2.9.53 cumulative Demo acceptance. NEVER promotes click-only proof to complete business PASS.
 * 202 unchanged UI items carry V2952 baseline evidence; 15 are fresh V2953 re-tests.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
const get=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const exists=p=>fs.existsSync(p);
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const list=get('docs/V2948_逐实际控件验收清单.json').components;
const oldPath='docs/V2952_217历史组件_离线浏览器真实Node接口点击证据.json';
const old=get(oldPath);
const incoming=[
 ['m09','docs/V2953_m09_clicks.json',6],
 ['ss-data','docs/V2953_ssdata_clicks.json',7],
 ['ss-performance','docs/V2953_perf_four.json',4]
];
const legacy=list.filter(x=>x.kind==='legacy_module');
const prev=new Map(old.components.map(x=>[x.id,x]));
const renewed=new Map();const issues=[];
for(const [route,file,count] of incoming){
 if(!exists(file)){issues.push(`missing retest ${file}`);continue}
 const report=get(file);
 if(report.components.length!==count||report.components.some(x=>x.route!==route)){issues.push(`retest scope mismatch ${file}`);continue}
 for(const item of report.components){
   if(!prev.has(item.id)){issues.push(`unregistered retest ID ${item.id}`);continue}
   if(item.status!=='OFFLINE_BRIDGED_CLICK_OK'||!item.formula?.ok||!item.sources?.ok||!(item.excel?.formula_cells>0)||!item.api_trace?.status||item.api_trace.status==='MISSING_API_TRACE') issues.push(`retest incomplete ${item.id}: ${item.status}`);
   renewed.set(item.id,{...item,evidence_file:file,evidence_sha256:digest(file)});
 }
}
const expectedNew=new Set([
 'm09.6d7eec95','m09.643115a6','m09.6c93d7bf','m09.eb351d3d','m09.8f402240','m09.154104ce',
 'ss-data.a81bda8e','ss-data.df8b36c8','ss-data.ce0ad5d4','ss-data.78efcb9c','ss-data.176118ca',
 'ss-performance.bb546065','ss-performance.ea85f424','ss-performance.63a41dc0','ss-performance.fa9c5927']);
for(const id of expectedNew)if(!renewed.has(id))issues.push(`required 15-item fresh retest absent ${id}`);
if(list.length!==585||legacy.length!==217||prev.size!==217)issues.push('Inventory or historical baseline mismatch');
const sourcePath='docs/V2952_Demo_23表全量API分页逐行同值.json';
const source=get(sourcePath);
const allSource=source.overall==='PASS'&&source.total_rows===21455&&source.table_count===23&&source.sources.length===23&&source.sources.every(x=>x.status==='PASS'&&x.unique_keys===x.rows);
if(!allSource)issues.push('23 CSV source pagination proof incomplete');
const prior=get('docs/V2951_Demo_验收报告.json');
if(prior.decision_kpis_recalculated!==115||prior.execution_sample_cells_reconciled!==1512)issues.push('Previous specific-sample Excel baselines changed');
const result=list.map(item=>{
 const historical=item.kind==='legacy_module';
 const proof=renewed.get(item.id)||prev.get(item.id)||null;
 const fresh=renewed.has(item.id);
 const clicked=historical&&proof?.status==='OFFLINE_BRIDGED_CLICK_OK'&&proof.formula?.ok&&proof.sources?.ok&&proof.excel?.formula_cells>0;
 const blockers=[];
 if(!clicked)blockers.push(historical?'本模块缺正常三入口证据':'尚未完成本轮 iframe 逐模块交互复核');
 if(!historical)blockers.push('需验证 iframe 的本模块计算条件、来源主键集合和下载工作簿');
 blockers.push('需建立本组件所使用的全部来源主键及筛选范围与23份Demo文件的独立行级匹配');
 blockers.push('需独立重算本组件所有网页显示单元格，并与导出的Excel公式逐格对账');
 blockers.push('需逐段复核本组件文字结论的变量、阈值、步骤、事实与推断');
 return {
  id:item.id,route:item.route,kind:item.kind,title:item.title,
  three_entry_browser_demo:clicked?'PASS':historical?'BLOCKED':'NOT_RETESTED',
  browser_evidence_origin:fresh?'V2953_NEW_15_ITEM_RETEST':clicked?'V2952_REUSED_BASELINE':'UNVERIFIED',
  demo_source_23_file_full_check:allSource?'PASS':'BLOCKED',
  component_source_primary_keys:'PENDING',web_excel_independent_cell_recalculation:'PENDING',
  narrative_variable_condition_semantic_check:'PENDING',
  full_demo_acceptance:'PENDING',
  formula_xlsx_cells:historical?(proof?.excel?.formula_cells||0):null,
  api_calculation_status:historical?(proof?.api_trace?.status||'NO_TRACE'):null,
  metric_source_key_evidence:historical?(proof?.api_trace?.metric_source_key_evidence||[]):[],
  independent_source_metric_checks:historical?(proof?.api_trace?.strict_metric_audit||[]):[],
  narrative_audit_statuses:historical?(proof?.api_trace?.narrative_audit_statuses||[]):[],
  source_key_evidence_scope:fresh?'API_RETURNED_KEYS_SAMPLED_NOT_FULL_DATASET':'NOT_COMPUTED_IN_THIS_RELEASE',
  limitations:blockers
 };
});
const stats={registered:list.length,legacy:legacy.length,iframe:list.length-legacy.length,
 historical_three_entry_cumulative:result.filter(x=>x.kind==='legacy_module'&&x.three_entry_browser_demo==='PASS').length,
 historical_new_retested:result.filter(x=>x.browser_evidence_origin==='V2953_NEW_15_ITEM_RETEST').length,
 historical_previous_15_repaired:[...expectedNew].filter(id=>renewed.get(id)?.status==='OFFLINE_BRIDGED_CLICK_OK').length,
 historical_prior_baseline_reused:result.filter(x=>x.browser_evidence_origin==='V2952_REUSED_BASELINE').length,
 full_demo_acceptance_pass:result.filter(x=>x.full_demo_acceptance==='PASS').length};
if(stats.historical_three_entry_cumulative!==217)issues.push(`Cumulative historical three-entry count ${stats.historical_three_entry_cumulative}/217`);
const summary={version:'2.9.53',mode:'SIMULATED_DEMO_ONLY',overall:issues.length?'EVIDENCE_REGRESSION_BLOCKED':'CUMULATIVE_LEGACY_THREE_ENTRY_COMPLETE_FULL_DEMO_PENDING',
 generated_at:new Date().toISOString(),counts:stats,
 source_csv:{files:23,rows:21455,full_http_paginated_verified:allSource},
 previous_sample_recalculation:{decision_kpis_match:115,execution_cells_match:1512,scope:'PREVIOUS_SPECIFIC_FILTER_SAMPLES_ONLY'},
 browser_mode:'CHROMIUM_INJECTED_SITE_HTML_PLUS_ACTUAL_NODE_HTTP_API_BRIDGE__NOT_NATIVE_HTTP_NAVIGATION',
 test_provenance:'15 previously missing IDs plus 2 already-passing ss-data controls freshly re-tested; remaining 200 retain V2952 evidence. Do not describe cumulative proof as a fresh full-site regression.',
 caveat:'Clicking three controls and checking XLSX formula count are not proof of independent formula equality, all source keys, or narrative correctness.',
 full_demo_release_gate:'BLOCKED',audit_issues:issues,
 hashes:{previous_ui:digest(oldPath),fresh:incoming.map(([route,p])=>({route,path:p,sha256:exists(p)?digest(p):null})),source:digest(sourcePath)}};
fs.writeFileSync('docs/V2953_Demo_585逐组件验收明细.json',JSON.stringify({summary,components:result},null,2)+'\n');
fs.writeFileSync('docs/V2953_Demo_验收总报告.json',JSON.stringify(summary,null,2)+'\n');
const cols=['id','route','kind','title','three_entry_browser_demo','browser_evidence_origin','demo_source_23_file_full_check','component_source_primary_keys','web_excel_independent_cell_recalculation','narrative_variable_condition_semantic_check','full_demo_acceptance','formula_xlsx_cells','api_calculation_status','limitations'];
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync('docs/V2953_Demo_585逐组件进度.csv',[cols.join(','),...result.map(x=>cols.map(k=>csv(Array.isArray(x[k])?x[k].join('；'):x[k])).join(','))].join('\n')+'\n');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V2.9.53 Demo 累积验收</title><style>body{font:15px/1.7 system-ui,sans-serif;color:#183d59;max-width:980px;margin:28px auto;padding:0 20px;background:#f7fbff}section{padding:20px;background:#fff;border:1px solid #d5e4f0;border-radius:12px;margin:15px 0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.card{padding:16px;background:#f0f6fc;border-radius:8px}.card strong{display:block;font-size:28px}.warn{color:#b75025}a{color:#225f9f}li{margin:8px 0}</style><h1>采购 Demo 验收 · V2.9.53</h1><p>仅使用模拟数据；企业 ERP/QMS、负责人签核都不是 Demo 必备条件。</p><section><div class="cards"><div class="card">累计历史三入口<br><strong>${stats.historical_three_entry_cumulative} / 217</strong></div><div class="card">前版15项缺口已复测<br><strong>${stats.historical_previous_15_repaired} / 15</strong></div><div class="card">Demo CSV 全量来源<br><strong>23 / 23</strong><small>21,455 行</small></div><div class="card">585 项完整业务验收<br><strong class="warn">${stats.full_demo_acceptance_pass} / 585</strong></div></div></section><section><h2>测试边界</h2><p>15 个缺口与另 2 个同路由控件为本轮真实复测，其余 200 项沿用 V2.9.52 逐组件点击证据，尚不是新版全量重跑。浏览器使用页面脚本和本地 Node API 的 HTTP 桥接，不是 Chromium 原生 HTTP 页面访问。</p><p>统一三入口可点击、下载 Excel 存在公式，与全部来源主键匹配、网页与 Excel 每格同值、文字分析结论独立成立，是不同验收层级。</p></section><section><h2>剩余严格验收</h2><ol><li>逐组件确立来源主键和全部筛选范围</li><li>逐格独立重算 XLSX 单元格及网页数字</li><li>逐条核验文字分析的判断条件与证据</li><li>14 个 iframe 页面的控件级完整复核</li></ol><p>完整 Demo PASS 在以上条件未达成之前保持阻止。</p><a href="v2953-component-progress.csv">下载585项逐组件状态 CSV</a></section><p>生成时间 ${esc(summary.generated_at)} · 当前 ${esc(summary.overall)}</p></html>`;
fs.mkdirSync('static/audit',{recursive:true});
fs.writeFileSync('static/audit/demo-acceptance-v2953.html',html);
fs.copyFileSync('docs/V2953_Demo_585逐组件进度.csv','static/audit/v2953-component-progress.csv');
console.log(`V2953 Demo ${summary.overall}, cumulative historical UI ${stats.historical_three_entry_cumulative}/217, fresh ${stats.historical_new_retested} (15 repaired + 2 retested existing), full ${stats.full_demo_acceptance_pass}/585, issues ${issues.length}`);
if(issues.length||process.argv.includes('--strict')&&summary.full_demo_release_gate==='BLOCKED')process.exitCode=2;
