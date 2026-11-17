from pathlib import Path
root=Path(__file__).resolve().parent.parent

# Common presentation contracts for all fourteen iframe pages. Handlers remain
# in the existing business applications so business logic is not forked.
audit=root/'static/audit';audit.mkdir(exist_ok=True)
(audit/'audit_ui_v2949.js').write_text('''/* V2.9.49 single three-entry presentation contract across 14 iframe pages. */
(function(global){'use strict';
 const entries=Object.freeze([
  {id:'formula',label:'∑ 本模块公式 / 分析依据'},
  {id:'sources',label:'▤ 展开全量计算依据和来源表'},
  {id:'excel',label:'↓ Excel 含真实公式'}
 ]);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function decisionControls(){return entries.map(e=>e.id==='excel'?`<a data-audit="excel" download>${e.label}</a>`:`<button type="button" data-audit="${e.id}">${e.label}</button>`).join('');}
 function executionControls(code,key){const url=`workbooks/${escape(code)}_${escape(key)}.xlsx`;return entries.map(e=>e.id==='formula'?`<button class="btn sm" type="button" data-action="lineage" data-module="${escape(key)}">${e.label}</button>`:e.id==='sources'?`<button class="btn sm" type="button" data-action="fold" data-module="${escape(key)}">${e.label}</button>`:`<a class="btn success" href="${url}" download>${e.label}</a>`).join('');}
 global.PHARMA_AUDIT_UI=Object.freeze({version:'2.9.49',entries,decisionControls,executionControls});
})(window);
''',encoding='utf8')

# Both iframe families load the SAME button contract.
for path in (root/'static/decision-center').glob('0*.html'):
 s=path.read_text(encoding='utf8');marker='<script src="/static/decision-center/lineage_entry_v2948.js"></script>'
 assert marker in s,path
 s=s.replace(marker,'<script src="/static/audit/audit_ui_v2949.js"></script>'+marker)
 path.write_text(s,encoding='utf8')
for path in (root/'static/procurement-execution').glob('0*.html'):
 s=path.read_text(encoding='utf8');marker='<script defer src="assets/site_integration_v2937.js"></script>'
 assert marker in s,path
 s=s.replace(marker,'<script defer src="../audit/audit_ui_v2949.js"></script>'+marker)
 path.write_text(s,encoding='utf8')

app=root/'static/procurement-execution/assets/app.js';s=app.read_text(encoding='utf8')
old='<button class="btn sm" data-action="lineage" data-module="${key}">∑ 计算血缘 / 分析规则</button>'
assert old in s
s=s.replace(old,'<span class="tag">统一三入口 · V2.9.49</span>')
old='${btn(\'▤ 展开全量计算依据和来源表\',\'fold\',`data-module="${key}"`)}<a class="btn success" href="workbooks/${PAGE.code}_${key}.xlsx" download>↓ 下载本模块带公式 Excel</a>'
assert old in s
s=s.replace(old,'${window.PHARMA_AUDIT_UI.executionControls(PAGE.code,key)}')
app.write_text(s,encoding='utf8')

# Remove hard limits that wrongly conflate truncated source rows with complete tables.
server=root/'decision_center_v2935.mjs';s=server.read_text(encoding='utf8')
assert 'rows:p.rows.slice(0,500)' in s
s=s.replace('rows:p.rows.slice(0,500)','rows:p.rows')
s=s.replace('rows:a.rows.slice(0,500)','rows:a.rows')
assert 'rows:found.slice(0,1000)' in s and 'rows:[...v.rows.values()].slice(0,1000)' in s
s=s.replace('rows:found.slice(0,1000)','rows:found')
s=s.replace('rows:[...v.rows.values()].slice(0,1000)','rows:[...v.rows.values()]')
server.write_text(s,encoding='utf8')
static=root/'static/decision-center/offline_v2942.mjs';s=static.read_text(encoding='utf8')
assert 'rows:sources[k].slice(0,500)' in s
s=s.replace('rows:sources[k].slice(0,500)','rows:sources[k]')
# Scoped formulas in the static workbook use the same metric selection as Node:
# don't claim the entire 115 KPI catalog was exported for one audit control.
s=s.replace("export async function downloadOfflineWorkbook(q={},name='Pharma_115_KPI_SIMULATED_Formula.xlsx'){", "export async function downloadOfflineWorkbook(q={},name='Pharma_115_KPI_SIMULATED_Formula.xlsx',selection={kind:'page',id:'01'}){")
needle=" const rows=sim.rows,keys=Object.keys(rows[0]||{}),letter=n=>"
assert needle in s
s=s.replace(needle," const selected=await decisionModule(selection.kind||'page',selection.id||'01',q);\n const selectedIds=new Set(selected.metrics.map(m=>m.id));\n const rows=sim.rows,keys=Object.keys(rows[0]||{}),letter=n=>")
needle=' for(const m of dataset.metrics){const spec=regs.SIM_KPI_REGISTRY.get(m.id);'
assert needle in s
s=s.replace(needle,' for(const m of dataset.metrics.filter(m=>selectedIds.has(m.id))){const spec=regs.SIM_KPI_REGISTRY.get(m.id);')
needle="xlsx.downloadXlsx([{name:'范围',rows:[['筛选属性','值'],['数据来源','SIMULATED / 非真实企业系统'],['检查日'"
assert needle in s
s=s.replace(needle,"xlsx.downloadXlsx([{name:'模块分析',rows:[['模块/核验维度','说明'],['模块类型',selection.kind],['模块编号',selection.id],['指标数',selected.metrics.length],['原始来源行数',selected.tables.map(t=>t.table+': '+t.count).join('; ')],['变量与公式',selected.metrics.map(m=>m.id+' '+m.formula).join('\\n')],['逐步文字分析',selected.analysis_steps.join('\\n')],['风险说明','SIMULATED / Non-GxP，未接企业审批与数据库全量'],['企业签核','PENDING']]},{name:'范围',rows:[['筛选属性','值'],['数据来源','SIMULATED / 非真实企业系统'],['检查日'")
static.write_text(s,encoding='utf8')

# Dynamic metric evidence cannot be allowed to silently truncate rows.
print('PATCHED shared UI + decision full source + static metric workbook selection')
