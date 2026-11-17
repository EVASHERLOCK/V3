import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const files=['static/module_traceability_v2928.js','static/module_traceability_v2928.css','module_traceability_v2928.mjs','docs/COMPONENT_TRACEABILITY_INVARIANTS.md','static/metric_audit_ui.js','static/index.html','server.mjs','scripts/regenerate-inline.mjs'];
for(const f of files)if(!fs.existsSync(f))throw Error('Missing mandatory traceability component '+f);
const ui=read(files[0]),css=read(files[1]),source=read(files[2]),html=read('static/index.html'),server=read('server.mjs');
const checks={
 '逐模块右上角公式和分析依据':ui.includes('∑ 本模块公式 / 分析依据')&&css.includes('.pharma-module-ready > .pharma-module-top{position:relative')&&css.includes('margin:10px 10px 0 auto'),
 '模块左下角独立来源表':ui.includes('展开全量计算依据和来源表'),
 '模块每份Excel真实公式':ui.includes('Excel 含真实公式')&&source.includes('exportMetricWorkbook'),
 '服务端模块专属数据和公式':server.includes('/api/lineage/module')&&server.includes('enterpriseInputs()'),
 '复合OTD/PPV独立指标':ui.includes("ids.add('SRC.PO.OTD');ids.add('SRC.PO.PPV')"),
 '文字建议有数据依据':source.includes('actionReport')&&source.includes('文字分析依据'),
 '屏幕值与企业来源严格区别':source.includes('UI 展示快照')&&source.includes('factsOverride'),
 '全站旧版空白占位入口由新版替代':read('static/metric_audit_ui.js').includes('window.PharmaModuleTrace.apply()'),
 'Bolt合并脚本包含模块血缘':read('scripts/regenerate-inline.mjs').includes('module_traceability_v2928.js'),
 '页面含模块血缘CSS':html.includes('module_traceability_v2928.css')
};
for(const [name,pass] of Object.entries(checks)){if(!pass)throw Error('FAILED '+name);console.log('PASS '+name)}
console.log('PASS V2.9.28 two top-level site-wide traceability invariants');
