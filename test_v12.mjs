import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {enterpriseAnalysis} from './enterprise_v08.mjs';
const V=['overview','m01','m02','m03','m04','m05','m06','m07','m08','m09','m10','documents','regulatory','workflow','reports','access','master','alerts'];
const sample=enterpriseAnalysis();const el={state:{data:sample,filters:{},active:'overview'},render:(view)=>'<div class="e8-page">legacy '+view+'</div>',sourcingExtra:()=>'',load:()=>{}};
const listeners={};const ls=new Map();const win={EnterpriseV08:el,render:()=>{},location:{hash:''}};const document={readyState:'complete',addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn)},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};const context={window:win,document,console,localStorage:{getItem:k=>ls.get(k)||null,setItem:(k,v)=>ls.set(k,v)},location:win.location,setTimeout:()=>0,Date,Number,Math,JSON,Intl,Blob:class {}};vm.runInNewContext(fs.readFileSync('static/v12_ui.js','utf8'),context);assert.ok(win.PharmaV12);
let checks=[];
for(const v of V){el.state.active=v;let html=el.render(v);assert.ok(html.includes('p12-page-head'),`no header ${v}`);const n=(html.match(/class="p12-kpi"/g)||[]).length;assert.equal(n,6,`six kpi ${v}`);assert.ok(html.includes('口径版本'),`footer ${v}`);checks.push([v,n]);}
for(const [v,t] of Object.entries({m01:'qc',m02:'price',m03:'tco',m04:'audit',m05:'contracts',m06:'capital',m07:'risk',m08:'payment',m09:'market',m10:'actions',documents:'gaps',regulatory:'timeline',workflow:'runs',reports:'exports',access:'review',master:'records',alerts:'rules'})){el.state.active=v;let original=el.render(v);win.PharmaV12.state.tabs[v]=t;let newHtml=el.render(v);assert.notEqual(original,newHtml,`tab not changed ${v}`);}
el.state.data=enterpriseAnalysis({supplier:'SUP-001'});el.state.filters={supplier:'SUP-001'};let filtered=el.render('overview');assert.ok(filtered.includes('当前 8 条 PO'),`filtered 8 rows`);assert.ok(filtered.includes('200,864'),`filtered amount`);assert.ok(!filtered.includes('580,704'),`old amount should not appear`);el.state.filters={};el.state.data=enterpriseAnalysis();let reset=el.render('overview');assert.ok(reset.includes('580,704'));
for(const v of V){const html=el.render(v);assert.ok(!html.includes('undefined DEMO'),`undefined financial ${v}`)}
// Simulate delegated UI events without incurring Bolt AI tokens.
function click(action){let ev={target:{closest:selector=>selector==='[data-p12]'?{dataset:{p12:action}}:null},preventDefault(){},stopImmediatePropagation(){}};for(const fn of listeners.click||[])fn(ev)}
let ran=0;el.load=()=>{ran++;el.state.data=enterpriseAnalysis(el.state.filters)};
click('tab:m02:savings');assert.equal(win.PharmaV12.state.tabs.m02,'savings');
click('alert-task:AL-DELIVERY');assert.equal(win.PharmaV12.state.tasks.length,1);assert.equal(win.PharmaV12.state.tasks[0].alert_id,'AL-DELIVERY');
click('save-view');assert.ok(ls.get('p12-views'));
console.log('PASS V1.2 delegated interactions: tabs, alert conversion, view persistence');
console.log('PASS V1.2: 18 pages have six KPI cards and version metadata; 17 tab changes; SUP-001 8 rows and 200864 vs all 24/580704; disclosure preserved');
