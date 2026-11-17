/** Mandatory build gate. Protects the highest-priority cross-site rule.
 * Structural gate cannot replace every browser visual/click test; custom charts
 * must include the ranking annotation or provide a ranked Top10 breakdown.
 */
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const missing=[];
for(const p of ['docs/TOP10_SITE_INVARIANT.md','static/top10_governance.js','static/top10_governance.css','static/sourcing_admin_ui.js','docs/OFFICIAL_ERP_INTEGRATION.md','static/global_help.js','static/app.js','static/index.html','static/portfolio_strategy.js','static/suite_ui.js','static/enterprise_v08.js','README.md']){if(!fs.existsSync(p))missing.push('file '+p)}
if(missing.length)throw Error(missing.join('\n'));
const policy=read('docs/TOP10_SITE_INVARIANT.md'),js=read('static/top10_governance.js'),html=read('static/index.html'),help=read('static/global_help.js'),app=read('static/app.js'),regen=read('scripts/regenerate-inline.mjs'),docs=read('README.md');
const tests={
 '最高优先级产品规则':policy.includes('所有页面')&&policy.includes('Top 10')&&policy.includes('展开'),
 '完整数据折叠展示':js.includes('remaining.forEach')&&js.includes('top10-overflow')&&js.includes('data-rank-chart'),
 '全站渲染钩子':app.includes('PharmaTopTen')&&app.includes('.apply'),
 '主页样式与代码':html.includes('/static/top10_governance.css')&&html.includes('ALL_PAGES_ALL_CATEGORICAL_CHARTS_TOP10_REST_EXPAND'),
 '代码打包器':regen.includes('top10_governance.js')&&regen.includes('sourcing_admin_ui.js'),
 '已有通用图表Top10':read('static/suite_ui.js').includes('ordered.slice(0,10)')&&read('static/enterprise_v08.js').includes('ordered.slice(0,10)'),
 '组合策略默认Top10':read('static/portfolio_strategy.js').includes("range:'top10'"),
 '统一80家候选':read('static/strategic_sourcing_universe.js').includes('normalizeProfile')&&read('static/strategic_sourcing_runtime.js').includes('hydrate'),
 '首页永久规则说明':docs.includes('最高优先级')&&docs.includes('check_top10_rule.mjs'),
 '数据准入边界':read('sourcing_registry.mjs').includes('approved_for_purchase:false'),
 '全站每条路由帮助覆盖':help.includes("ROUTES[key]=['top10',...ROUTES[key]]")
};
const w={};vm.runInNewContext(js,{window:w},{timeout:3000});const g=w.PharmaTopTen;
if(!g||g.LIMIT!==10)throw Error('Top10 runtime missing');
const {top,rest}=g.split([{score:9},{score:null},{score:13},{score:1},...Array.from({length:17},(_,i)=>({score:i+2}))]);
if(top.length!==10||rest.length!==11||top[0].score!==18||rest[rest.length-1].score!==null)throw Error('ranking order or unknown-last failed');
const helpWindow={addEventListener:()=>{}};
vm.runInNewContext(help,{window:helpWindow,document:{readyState:'loading',addEventListener:()=>{}},location:{hash:'#overview'}},{timeout:3500});
const registry=helpWindow.PharmaGlobalHelp;
if(!registry?.groups?.top10||Object.values(registry.routes).some(x=>x[0]!=='top10'))throw Error('Not every route has Top10 help');
for(const [label,ok]of Object.entries(tests)){if(!ok)missing.push(label)}
const pkg=JSON.parse(read('package.json'));
for(const cmd of ['dev','start','test','build','check:files'])if(!pkg.scripts[cmd].includes('check_top10_rule.mjs'))missing.push(`build gate ${cmd}`);
if(missing.length){console.error('FAIL site-wide Top10 governance:\n- '+missing.join('\n- '));process.exit(1)}
console.log(`PASS site-wide Top10 governance: Top10 order, unknown-last, all ${Object.keys(registry.routes).length} routes, HTML/table/chart hooks, build gate and provenance policy.`);
