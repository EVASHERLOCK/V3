/** Persistent all-route release inventory; no external dependencies.
 * Structural PASS != business evidence PASS. `--strict` fails on every known gap. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('static/app.js'),moduleUI=read('static/module_traceability_v2928.js');
const pkg=JSON.parse(read('package.json'));
const spec='requirements/全站最高优先级规则_管理层公式来源逐格文字解释_V2945.md';
const policy=read(spec);
for(const phrase of ['∑ 本模块公式 / 分析依据','展开全量计算依据和来源表','Excel 含真实公式','iframe','单元格','文字分析','无记录','模拟'])assert.ok(policy.includes(phrase),'强制规则缺失: '+phrase);
for(const phrase of ['paragraphs=x.narrativeAnalysis||[]','const tablesHtml','技术核验附录','row_count','data-module-action','pharma-module-inline'])assert.ok(moduleUI.includes(phrase),'渲染合同缺失: '+phrase);
for(const phrase of ['/api/lineage/module','/api/lineage/module/workbook.xlsx'])assert.ok(read('server.mjs').includes(phrase),'Node 来源接口缺失：'+phrase);
assert.ok(read('static/index.html').includes('paragraphs=x.narrativeAnalysis||[]'),'内联脚本尚未和权威JS同步，执行 npm run build');
assert.ok(pkg.scripts['check:governance']?.includes('check_v2945_governance'),'未来版本门禁未接入 package.json');
const old=JSON.parse(read('docs/V2929_组件扫描基线.json'));
assert.equal(old.routes.length,26,'旧基线变化，必须复核');
const retired=new Set(['m05','m08','m10']);
const activeOld=old.routes.filter(r=>!retired.has(r));
const additional=['m09-reference','sim-center',...Array.from({length:5},(_,i)=>`decision-0${i+1}`),...Array.from({length:9},(_,i)=>`exec-0${i}`)];
const routes=[...new Set([...activeOld,...additional])];
assert.equal(routes.length,39,'当前路由需要重新盘点');
const codeIds=new Set([...app.matchAll(/\bid:'([^']+)'/g)].map(m=>m[1]));
const inactive=new Set(['m05','m08','m10']);
for(const id of codeIds)if(!inactive.has(id))assert.ok(routes.includes(id),'发现新增路由 '+id+'，但未登记最高级规则的验收清单，禁止打包');
for(const id of routes)assert.ok(codeIds.has(id)||['overview','portfolio','m09-reference'].includes(id),'验收清单路由已从源码消失: '+id);
for(let n=0;n<9;n++){const html=path.join(root,'static','procurement-execution');const slug=(app.match(new RegExp(`id:'exec-0${n}'[^}]*file:'([^']+)'`))||[])[1];assert.ok(slug&&fs.existsSync(path.join(html,slug)),`执行页面 ${n} 源文件缺失`)}
for(let n=1;n<=5;n++){const slug=(app.match(new RegExp(`id:'decision-0${n}'[^}]*file:'([^']+)'`))||[])[1];assert.ok(slug&&fs.existsSync(path.join(root,'static','decision-center',slug)),`绩效页面 ${n} 源文件缺失`)}
const countByRoute=new Map();for(const x of old.components)countByRoute.set(x.route,(countByRoute.get(x.route)||0)+1);
const rows=routes.map(r=>{
 const source=r.startsWith('exec-')?'采购执行管理独立iframe':r.startsWith('decision-')?'绩效中心独立iframe':r==='sim-center'?'数据中心独立iframe':r==='m09-reference'?'Change Control 自定义模块':'主站动态DOM';
 const stat=source==='主站动态DOM'?'RUNTIME_AND_SOURCE_AUDIT_PENDING':source==='Change Control 自定义模块'?'CUSTOM_COMPONENT_EVIDENCE_REVIEW_PENDING':source==='数据中心独立iframe'?'ADMIN_CONTROLS_AND_SOURCE_AUDIT_PENDING': 'IFRAME_SEPARATE_CONTRACT_PENDING';
 const reason=source==='主站动态DOM'?'旧版模块扫描是静态历史快照；仍需逐组件真实按钮、原始图表数组、公式和Excel校对':source==='Change Control 自定义模块'?'自定义交互绕过通用扫描，需逐点击与报告对应检查':source==='数据中心独立iframe'?'需验证每张数据表的筛选、修改审计和导出':r.startsWith('exec-')?'独立模板有专用血缘/工作簿，但当前展开表显示派生值而不一定逐格显示公式文本；需逐模块对账':'独立KPI原型有指标下钻，但未逐个采用主站统一三个按钮的规范';
 return {route:r,source,legacy_components:countByRoute.get(r)||0,formula_button:'NOT_VERIFIED',source_table_cell_formulas:'NOT_VERIFIED',xlsx_formula_and_narrative:'NOT_VERIFIED',business_source_reconciliation:'NOT_VERIFIED',status:stat,reason};
});
const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const keys=Object.keys(rows[0]);
fs.writeFileSync('docs/V2945_逐页覆盖与未完成项.csv',[keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n')+'\n');
const meta={version:'2.9.45',generated_at:new Date().toISOString(),routes:routes.length,old_legacy_routes:old.routes.length,old_legacy_components:old.components.length,active_legacy_components:old.components.filter(c=>!retired.has(c.route)).length,standalone_iframe_routes:15,known_defects_fixed:['管理层面板 paragraphs 未声明导致按钮打开后报错'],known_gaps:['历史组件清单未覆盖新15个iframe路由','运行时可见表格采集最多800行；不是数据库全量','服务端模块来源返回的指标明细有限流；不等于全源数据库','部分业务页面只使用自己的图表/公式展示，未遵循主站统一三个入口','源码校验不能证明每个业务模块的真实计算和Excel一一对应','静态发布和Node预览还需要独立按路由验证'],release:'NOT_FULLY_VERIFIED',rows};
fs.writeFileSync('docs/V2945_正式放行审计.json',JSON.stringify(meta,null,2)+'\n');
console.log(`PASS V2.9.45 全站强制规则结构门禁：${routes.length} 个当前路由、旧基线 ${old.components.length} 个组件已登记；正式业务放行状态=${meta.release}`);
if(process.argv.includes('--strict')){console.error(`FAIL 全站业务放行：${rows.length} 个路由仍未完成逐组件三按钮+同源Excel真实浏览器审查。请查阅 docs/V2945_逐页覆盖与未完成项.csv`);process.exitCode=2;}
