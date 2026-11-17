/** V2.9.52 evidence-aware DEMO progress. Real business signoff is NOT required.
 * Only actual per-component evidence can turn an individual component green.
 * Prior page-wide sample checks are not promoted into 585 component PASS labels.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const root=process.cwd(),list=read('docs/V2948_逐实际控件验收清单.json').components;
const previous=read('docs/V2951_Demo_验收报告.json');
const source=fs.existsSync('docs/V2952_Demo_23表全量API分页逐行同值.json')?read('docs/V2952_Demo_23表全量API分页逐行同值.json'):null;
const uiFile='docs/V2952_217历史组件_离线浏览器真实Node接口点击证据.json';
const ui=fs.existsSync(uiFile)?read(uiFile):null;
const validUi=ui?.test_type==='CHROMIUM_OFFLINE_BUNDLED_SITE_WITH_REAL_NODE_API_BRIDGE'&&Array.isArray(ui.components)&&ui.components.length===217&&!ui.is_real_browser_native_http_navigation&&ui.registered_legacy===217;
const byId=new Map(validUi?ui.components.map(x=>[x.id,x]):[]);
const offlineDom=fs.existsSync('docs/V2952_217历史模块_完整DOM位置核验.json')?read('docs/V2952_217历史模块_完整DOM位置核验.json'):null;
const seenIds=new Set(validUi?ui.components.filter(x=>x.status!=='NO_EXACT_DOM_NODE').map(x=>x.id):(offlineDom?.components?.filter(x=>x.status!=='NO_EXACT_DOM_NODE').map(x=>x.id)||[]));
const allSourcesPass=source?.overall==='PASS'&&source.table_count===23&&source.total_rows===21455&&source.sources.length===23&&source.sources.every(t=>t.status==='PASS'&&t.unique_keys===t.rows);
const sourceFingerprint=allSourcesPass?sha(fs.readFileSync('docs/V2952_Demo_23表全量API分页逐行同值.json')):null;
const problems=[];
if(list.length!==585)problems.push('Component inventory changed, inspect UI and re-register');
if(!allSourcesPass)problems.push('23 CSV paginated API source completeness not proven');
if(!validUi)problems.push('217 legacy modules full offline-bridge browser report absent or incomplete');
if(previous?.source_rows!==21455||previous?.decision_kpis_recalculated!==115||previous?.execution_sample_cells_reconciled!==1512)problems.push('Previous scoped deterministic demo formula baseline changed');
const routeStatus=new Map();
const each=list.map(x=>{
 const legacy=x.kind==='legacy_module';const proof=byId.get(x.id);
 const clicked=proof?.status==='OFFLINE_BRIDGED_CLICK_OK'&&proof.formula?.ok&&proof.sources?.ok&&proof.excel?.formula_cells>0;
 const forced=proof?.status==='OFFLINE_BRIDGED_FORCED_POINTER_ONLY';
 const api=proof?.api_trace||{};
 const browserReal=false; // This suite uses set_content + a Python API bridge, never page.goto HTTP.
 const sourceRowsVerified=false; // Complete CSV source evidence is not component-level row identity.
 const xlsxSameValue=false; // ZIP formula count != independent numerical equality.
 const narrativeValidated=false; // Narrative text hash != business semantics proof.
 const isMappedChangeControl=legacy&&x.route==='m09';
 const status=clicked?'DEMO_OFFLINE_BROWSER_3_ENTRY_CHECKED':forced?'FORCED_POINTER_NEEDS_UX_FIX':legacy?isMappedChangeControl?'REPLACED_UI_NEEDS_REMAP':'PENDING_REAL_COMPONENT_CLICKS':'PENDING_SUBMODULE_SPECIFIC_EVIDENCE';
 const blockers=[];
 if(!clicked){if(isMappedChangeControl)blockers.push('原 m09 旧组件已被 CC31 新页面替换，须按新控件映射');else blockers.push('本组件三入口未获得正常 Chromium 点击+Node Demo API 下载完整证据')}
 if(!sourceRowsVerified)blockers.push('本组件来源行主键、数量和筛选范围尚未与全量 Demo 数据逐项对应');
 if(!xlsxSameValue)blockers.push('本组件网页逐格结果与下载 Excel 每一计算格尚未独立同值复算');
 if(!narrativeValidated)blockers.push('本组件全部文字结论的变量、阈值和步骤尚未逐条语义核验');
 const item={id:x.id,route:x.route,title:x.title,kind:x.kind,status,
  offline_dom_present:legacy?seenIds.has(x.id):null,
  offline_normal_pointer_three_entry_verified:!!clicked,
  offline_forced_pointer_only:!!forced,
  actual_http_browser_navigation_verified:browserReal,
  downloaded_xlsx_formula_cells:proof?.excel?.formula_cells||0,
  node_api_trace_status:api.status||'NO_PER_COMPONENT_TRACE',
  demo_source_23_files_paginated_verified:allSourcesPass,
  component_source_rows_all_verified:sourceRowsVerified,
  component_excel_cell_equal_verified:xlsxSameValue,
  component_narrative_semantic_verified:narrativeValidated,
  component_demo_full_acceptance:'PENDING',blockers};
 const old=routeStatus.get(x.route)||{route:x.route,registered:0,normal_three_entry:0,unverified:0};old.registered++;old.normal_three_entry+=Number(clicked);old.unverified+=Number(!clicked);routeStatus.set(x.route,old);
 return item;
});
const counts={registered:list.length,legacy:each.filter(x=>x.kind==='legacy_module').length,iframe:each.filter(x=>x.kind!=='legacy_module').length,
 legacy_dom_found:each.filter(x=>x.kind==='legacy_module'&&x.offline_dom_present).length,
 legacy_offline_3_entry_normal:each.filter(x=>x.kind==='legacy_module'&&x.offline_normal_pointer_three_entry_verified).length,
 legacy_offline_3_entry_forced:each.filter(x=>x.kind==='legacy_module'&&x.offline_forced_pointer_only).length,
 legacy_xlsx_downloads_with_formula:each.filter(x=>x.kind==='legacy_module'&&x.downloaded_xlsx_formula_cells>0).length,
 fully_accepted_demo:each.filter(x=>x.component_demo_full_acceptance==='PASS').length};
const overall=counts.fully_accepted_demo===585&&allSourcesPass?'DEMO_ACCEPTED':'DEMO_PARTIALLY_VERIFIED';
const summary={version:'2.9.52',acceptance_type:'SIMULATED_DEMO_ONLY',tested_at:new Date().toISOString(),overall,
 no_erp_qms_or_enterprise_signatures_required:true,
 source_23_files_full_http_paginated:allSourcesPass?'PASS':'BLOCKED',source_rows:source?.total_rows||0,
 previous_independent_kpi_scoped:'115/115',previous_independent_execution_scoped:'1512 cells MATCH, 55 numeric KPI aggregate MATCH, 1 unverified',
 browser_level:'CHROMIUM_BUNDLED_SCRIPTS_PLUS_LIVE_NODE_API_BRIDGE_NOT_BROWSER_NATIVE_HTTP_NAVIGATION',
 registry_integrity:counts.registered===585?'PASS':'BLOCKED', ...counts,
 route_progress:[...routeStatus.values()],unresolved:problems,
 blocked_conditions:['Each component must have independent source-row identity and filter scope','Each calculated web cell must be numerically reconciled to a true XLSX formula','Each narrative assertion and rule must be semantically checked'],
 evidence_sha256:{source_report:sourceFingerprint,browser_report:validUi?sha(fs.readFileSync(uiFile)):null},
 note:'此页不要求 ERP、QMS 或企业签名；离线 Chromium真实点击与真实 Node API 可证明可操作性，但不等同浏览器直接 HTTP 导航，也不等同所有公式和文字结论业务正确。'};
fs.mkdirSync('docs',{recursive:true});
fs.writeFileSync('docs/V2952_Demo_585逐组件分层进度.json',JSON.stringify({version:'2.9.52',components:each},null,2)+'\n');
fs.writeFileSync('docs/V2952_Demo_验收总报告.json',JSON.stringify(summary,null,2)+'\n');
const cols=['id','route','title','kind','status','offline_dom_present','offline_normal_pointer_three_entry_verified','offline_forced_pointer_only','downloaded_xlsx_formula_cells','node_api_trace_status','demo_source_23_files_paginated_verified','component_source_rows_all_verified','component_excel_cell_equal_verified','component_narrative_semantic_verified','component_demo_full_acceptance','blockers'];
const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';
fs.writeFileSync('docs/V2952_Demo_585逐组件验收进度.csv',[cols.join(','),...each.map(x=>cols.map(k=>quote(Array.isArray(x[k])?x[k].join('；'):x[k])).join(','))].join('\n')+'\n');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const routeRows=[...routeStatus.values()].map(r=>`<tr><td>${esc(r.route)}</td><td>${r.registered}</td><td>${r.normal_three_entry}</td><td>${r.unverified}</td></tr>`).join('');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V2.9.52 采购 Demo 验收进度</title><style>body{font:14px/1.65 system-ui,'Microsoft YaHei',sans-serif;background:#f7f9fc;color:#24394d;max-width:980px;margin:25px auto;padding:0 20px}h1{font-size:24px}h2{font-size:18px}section{background:#fff;border:1px solid #d7e1e9;border-radius:12px;margin:15px 0;padding:17px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.stat{background:#f4f8fd;border-radius:8px;padding:12px}.stat b{display:block;font-size:25px}.muted{color:#5c7184}.ok{color:#176f52}.warning{color:#aa641e}table{width:100%;border-collapse:collapse}th,td{padding:7px 9px;border-bottom:1px solid #e3ebf1;text-align:left}th{background:#f3f7fa}a{color:#225ea3}</style></head><body><h1>采购网站 · Demo 实际验收进度 V2.9.52</h1><p class="muted">只使用现有模拟数据。不需要 ERP、QMS、公司授权数据库或企业负责人签名。</p><section><div class="stats"><div class="stat">模拟来源 API 全量核验<b class="${allSourcesPass?'ok':'warning'}">${allSourcesPass?'23 / 23':'未通过'}</b>CSV ${esc(source?.total_rows||0)} 行</div><div class="stat">历史组件在离线浏览器三入口正常点击<b>${counts.legacy_offline_3_entry_normal} / 217</b>真实 Node Demo API + XLSX</div><div class="stat">历史组件 DOM 可识别<b>${counts.legacy_dom_found} / 217</b>基线ID位置核对</div><div class="stat">585 项逐组件完整验收<b class="warning">${counts.fully_accepted_demo} / 585</b>缺少逐格与文字语义验收</div></div></section><section><h2>证据含义</h2><p>本轮使用 Chromium 运行实际网站打包脚本、真实浏览器点击三入口，并将 fetch 通过 Python 转发到本地运行的 Node Demo API；这解决了本环境浏览器 HTTP 导航受限的问题，但<strong>不是</strong>浏览器原生 HTTP 导航端到端测试。点击通过也不等于公式逐格同值或文字结论正确。</p><p>限定样本：115/115 项 KPI 和 1,512 个采购执行单元格原有独立复算证据保留。旧版变更控制 m09 已替换为 CC31，旧组件 ID 需要独立映射，不能虚报旧按钮存在。</p></section><section><h2>按页面统计</h2><table><thead><tr><th>页面路由</th><th>已登记</th><th>本轮点击验证</th><th>仍待完成</th></tr></thead><tbody>${routeRows}</tbody></table></section><section><h2>验收边界</h2><p>模拟数据全表验证只证明来源完整读取；每个组件的来源选取范围、公式单元格和文字结论仍必须分别复核。全站 Demo PASS 只有三类独立证据全部具备后才允许标记。</p><a href="demo-acceptance.json">下载机器可读进度 (JSON)</a></section><p class="muted">生成时间：${esc(summary.tested_at)} · Non-GxP Demo</p></body></html>`;
fs.mkdirSync('static/audit',{recursive:true});
fs.writeFileSync('static/audit/demo-acceptance.html',html);
fs.writeFileSync('static/audit/demo-acceptance.json',JSON.stringify(summary,null,2)+'\n');
console.log(`V2952 Demo: ${summary.overall}; 23 API sources ${source?.total_rows||0} rows (${allSourcesPass?'PASS':'BLOCKED'}); legacy browser normal 3-entry ${counts.legacy_offline_3_entry_normal}/217; 585 full ${counts.fully_accepted_demo}/585`);
if(process.argv.includes('--strict')&&overall!=='DEMO_ACCEPTED')process.exitCode=2;
if(problems.length)process.exitCode=1;
