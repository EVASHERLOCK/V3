import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.cwd(),fail=[];
function read(file){const name=path.join(root,file);if(!fs.existsSync(name)){fail.push(`缺失强制文件：${file}`);return ''}return fs.readFileSync(name,'utf8')}
const js=read('static/global_help.js'),css=read('static/global_help.css'),html=read('static/index.html'),regen=read('scripts/regenerate-inline.mjs'),build=read('build_static.mjs'),pkg=read('package.json'),readme=read('README.md'),doc=read('docs/GLOBAL_HELP_INVARIANT.md');
const keys=['riskRoot','riskType','riskGrade','issueType','action','outcome','taskStatus','calendar','supply','spend','abc','inventory','forecast','price','quality','change','budget','invoices','data','filter'];
let catalog;
try{
 const listeners={};const window={addEventListener:()=>{}};
 const document={readyState:'loading',addEventListener:(evt,fn)=>{listeners[evt]=fn}};
 vm.runInNewContext(js,{window,document,location:{hash:'#overview'}},{timeout:4000});
 catalog=window.PharmaGlobalHelp;
 if(!catalog)fail.push('未导出 window.PharmaGlobalHelp 审计接口');
}catch(err){fail.push('问号脚本无法解析/初始化：'+String(err.message||err))}
if(catalog){
 for(const key of keys){const g=catalog.groups[key];if(!g||g.items.length<7)fail.push(`缺少关键完整分类：${key}`)}
 const routes=['overview','m01','portfolio','m02','ss-overview','ss-market','ss-kraljic','ss-ai','ss-cost','ss-project','ss-performance','ss-compliance','ss-technical','ss-data','m05','m06','m08','m09','m10','documents','regulatory','workflow','reports','access','master','alerts'];
 for(const id of routes)if(!catalog.routes[id]||catalog.routes[id].length<2)fail.push(`页面 ${id} 缺少分类字典默认映射`);
 const needles=['销售预测波动','GMP 审计/资质问题','单一来源依赖','供应商短交/欠交','启动第二供应商开发','资质证书续期','库存资金占用下降','招标启动','新供应商导入','实际消耗金额','全部类别'];
 for(const n of needles)if(!js.includes(n))fail.push(`强制参考类别/交互缺失：${n}`)
}
if(!html.includes('/static/global_help.css'))fail.push('未在主页加载全站问号样式');
if(!html.includes('data-bundled-src="/static/global_help.js"'))fail.push('缺少内嵌全站问号启动脚本');
if(!html.includes('global_help.js')||!regen.includes('scripts.length!==21'))fail.push('打包器未纳入 21 段脚本及全站帮助');
if(!css.includes('.gh-trigger')||!css.includes('.gh-drawer'))fail.push('缺少模块问号和完整抽屉样式');
if(!doc.includes('永久强制')||!doc.includes('全覆盖'))fail.push('不可删除的规则文档缺失');
if(!readme.includes('全站强制问号'))fail.push('README 首要规则缺失');
if(!build.includes('global_help.js')||!build.includes('scriptOpens!==22'))fail.push('构建安全检查缺少全站帮助');
try{const d=JSON.parse(pkg);for(const n of ['build','dev','test','check:files'])if(!d.scripts?.[n]?.includes('check_global_help.mjs'))fail.push(`${n} 未启用不可移除的构建前检查`)}catch{fail.push('package.json 无法解析')}
if(fail.length){console.error('FAIL Global Help Invariant:\n- '+fail.join('\n- '));process.exit(1)}
console.log('PASS Global Help Invariant: 26 routes, '+Object.keys(catalog.groups).length+' comprehensive taxonomies, per-module injection, independent reference catalog, build-time protection.');
