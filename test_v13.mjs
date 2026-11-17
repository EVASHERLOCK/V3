import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {enterpriseAnalysis} from './enterprise_v08.mjs';
const sample=enterpriseAnalysis();const events={};const store=new Map();const el={state:{data:sample,filters:{},active:'overview'},render:view=>'legacy '+view,load:()=>{el.state.data=enterpriseAnalysis(el.state.filters)}};
const win={EnterpriseV08:el,render:()=>{},location:{hash:''}};
const document={readyState:'complete',addEventListener:(type,fn)=>{(events[type]??=[]).push(fn)},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
const sandbox={window:win,document,console,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},location:win.location,setTimeout:()=>0,Date,Number,Math,JSON,Intl,Blob:class{}};
vm.runInNewContext(fs.readFileSync('static/v12_ui.js','utf8'),sandbox);
function view(v,tab){el.state.active=v;if(tab)win.PharmaV12.state.tabs[v]=tab;return el.render(v)}
function click(action){let ev={target:{closest:selector=>selector==='[data-p12]'?{dataset:{p12:action}}:null},preventDefault(){},stopImmediatePropagation(){}};for(const f of events.click||[])f(ev)}
// Every page renders, even when scoped to 1 supplier, and document boundaries visible.
for(const key of ['overview','m01','m02','m03','m04','m05','m06','m07','m08','m09','m10','documents','regulatory','workflow','reports','access','master','alerts']){
 const page=view(key);assert.equal((page.match(/class="p12-kpi"/g)||[]).length,6,key);assert.ok(page.includes('Non-GxP'),key);
 assert.ok(!page.includes('undefined DEMO-USD'),key);
}
assert.ok(view('m01','qc').includes('需求日 vs 放行日'));
assert.ok(view('m01','plan').includes('提前到货待仓容复核'));
assert.ok(view('m02','savings').includes('p13-bridge'));
assert.ok(view('m02','price').includes('同期市场涨幅'));
assert.ok(view('m03','tco').includes('模拟目标价'));
assert.ok(view('m04','audit').includes('已逾期单列'));
assert.ok(view('m05','po').includes('距承诺日'));
assert.ok(view('m06','capital').includes('Released 可用金额'));
assert.ok(view('m07','risk').includes('按季最大供应商采购依赖'));
assert.ok(view('m07','score').includes('季度供应商 OTD'));
assert.ok(view('m08','payment').includes('需要发票实际'));
assert.ok(view('m09','change').includes('风险触发口径'));
assert.ok(view('m09','market').includes('证据齐备度'));
assert.ok(view('m10','exec').includes('建议DDL'));
assert.ok(view('workflow','runs').includes('生成修复任务'));
assert.ok(view('alerts','center').includes('金额敞口'));
assert.ok(view('master','quality').includes('判定规则'));
// Scope-specific actual numbers come from the same model.
el.state.data=enterpriseAnalysis({supplier:'SUP-001'});el.state.filters={supplier:'SUP-001'};
const scope=view('overview');assert.ok(scope.includes('当前 8 条 PO'));assert.ok(scope.includes('200,864'));assert.ok(!scope.includes('580,704'));
el.state.data=sample;el.state.filters={};
// All new actions must mutate local state; never touch authoritative GxP systems.
view('regulatory','timeline');click('subscribe:90');assert.equal(win.PharmaV12.state.subscriptions[0].window,90);
view('access','review');click('user:DEMO-001');assert.equal(win.PharmaV12.state.reviewRequests.length,1);
click('access-review:DEMO-001');assert.equal(win.PharmaV12.state.reviewRequests[0].status,'模拟已复核（不生效）');
view('workflow','runs');const failed=sample.workflow.runs.find(x=>x.status==='Failed');assert.ok(failed);
click('fix-run:'+failed.run_id);assert.ok(win.PharmaV12.state.tasks[0].title.includes(failed.run_id));
view('m05','po');click('goto-ref:m01:qc:WO-0001');assert.equal(win.PharmaV12.state.selected,'WO-0001');assert.equal(win.location.hash,'m01');
console.log('PASS V1.3: 18 pages, 6 KPI each, scoped PO figures, price/QA/PO/MA/alerts improvements, local reminders, access review, failure task, WO navigation');
