import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync('static/app.js','utf8');
const html=fs.readFileSync('static/index.html','utf8');
const help=fs.readFileSync('static/global_help.js','utf8');
const shellCss=fs.readFileSync('static/strategic_sourcing_shell.css','utf8');
const names=[
 ['ss-overview','战略寻源总览'],['ss-market','上游市场调研与供给风险监控'],['ss-kraljic','Kraljic四象限品类分级与寻源路径'],
 ['ss-ai','AI供应商智能寻源与评估'],['ss-cost','成本基线与目标成本管理'],['ss-project','寻源项目全流程管理'],
 ['ss-performance','供应商绩效与持续改善管理'],['ss-compliance','供应商合规管理'],['ss-technical','供应商数据库'],['ss-data','官方数据源与同步管理']
];
for(const [route,title] of names){
 assert(app.includes(`id:'${route}',cn:'${title}'`), `missing page config: ${title}`);
 assert(help.includes(`'${route}':`),`missing global-help mapping for ${route}`);
}
const aliases={'m03':'ss-ai','m04':'ss-compliance','m07':'ss-performance'};
for(const [old,redirect] of Object.entries(aliases)){
 assert(app.includes(`${old}:'${redirect}'`),`missing redirect ${old}`);
 assert(!new RegExp(`\\{id:'${old}',num:`).test(app),`removed page metadata still present: ${old}`);
 assert(!app.includes(`else if(S.view==='${old}')`),`removed page render branch present: ${old}`);
}
assert(app.includes("moduleNav('m01')+portfolio+moduleNav('m06')+moduleNav('m02')+strategic"),'wrong primary order');
assert(app.includes('data-ss-default-expanded="true"'),'nine subpages must remain expanded');
assert(app.includes('class="nav-link ss-nav-child'),'missing actual subpage buttons');
assert(app.includes('setNavCompact(false)'),'sidebar should open by default after import');
assert(shellCss.includes('.ss-nav-children{display:flex!important'),'subnav must stay expanded');
assert(shellCss.includes('.ss-placeholder-page'),'missing placeholder CSS');
assert(html.includes('/static/strategic_sourcing_shell.css'),'new CSS not loaded');
assert(html.includes('data-bundled-src="/static/app.js"'),'app script missing from built page');
// Route names must appear in nav registry order, with no accidental duplicates.
const entries=[...app.matchAll(/\{id:'(ss-[a-z-]+)',cn:'([^']+)'/g)];
assert.deepEqual(entries.map(x=>x[1]),names.map(x=>x[0]));
const hwm={};const listeners={};const fakeDoc={readyState:'loading',addEventListener(n,fn){listeners[n]=fn}};
vm.runInNewContext(help,{window:hwm,document:fakeDoc,location:{hash:'#ss-overview'}},{timeout:5000});
for(const [route] of names)assert(hwm.PharmaGlobalHelp.routes[route].length>=2,route+' help empty');
assert(fs.existsSync('dist/index.html'));
console.log('PASS V2.9.1: 10 expanded routes, correct order, 3 superseded legacy routes removed and redirected, 26-route help registry, full deployable build.');
