import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {enterpriseAnalysis} from './enterprise_v08.mjs';
let listeners={};let context={console,Intl,URL,URLSearchParams,Blob,FormData,Date,Math,Number,JSON,Response,TextEncoder,setTimeout(){},document:{readyState:'loading',addEventListener(x,fn){(listeners[x]??=[]).push(fn)}},localStorage:{getItem(){return null},setItem(){}},window:{}};
vm.runInNewContext(fs.readFileSync('static/enterprise_v08.js','utf8'),context,{filename:'enterprise_v08.js'});
vm.runInNewContext(fs.readFileSync('static/v09_ui.js','utf8'),context,{filename:'v09_ui.js'});
const S=context.window.PharmaV09.state;S.seed={master:JSON.parse(fs.readFileSync('demo_master.json')),extension:JSON.parse(fs.readFileSync('v08_demo.json'))};
const d=enterpriseAnalysis();context.window.EnterpriseV08.state.data=d;
const views=['overview','m01','m02','m03','m04','m05','m06','m07','m08','m09','m10','documents','regulatory','workflow','reports','access','master','alerts'];
for(let v of views){let t={m01:'demand',m02:'spend',m04:'asl',m05:'orders',m06:'lifecycle',m07:'score',m08:'invoices',m09:'changes',m10:'exec'}[v]||'register';let html=context.window.PharmaV09.main(v,d,t);assert(html.length>600,`${v} too short`);assert(html.includes('v9-'),`${v} has no v9`);assert(!html.includes('NaN'),`${v} NaN`);console.log('V09 VIEW',v,html.length)}
for(let [v,tabs] of Object.entries({m02:['price','savings'],m06:['capital','trace']}))for(let t of tabs){let h=context.window.PharmaV09.main(v,d,t);assert(h.length>900,`${v}:${t}`);console.log('V09 TAB',v,t,h.length)}
const s=context.window.PharmaV09.main('m03',d,'');assert(s.includes('综合评分')&&s.includes('落地成本')&&s.includes('资质否决'));assert(context.window.PharmaV09.main('overview',d,'').includes('580,704'));console.log('PASS V0.9 module rendering, 18 modules, 4 key analytics tabs');

// Integration: wrapper must actually replace live enterprise view, not just render isolated HTML.
context.fetch=async()=>({ok:true,json:async()=>S.seed});context.window.render=()=>{};
context.window.PharmaV09.start();await new Promise(resolve=>setTimeout(resolve,12));
let wrapped=context.window.EnterpriseV08.render('overview');
assert(wrapped.includes('v9-main')&&wrapped.includes('v9-legacy'),'overlay not mounted in actual dashboard');
assert(wrapped.includes('最高优风险'),'new overview missing risk ribbon');
const html=context.window.EnterpriseV08.sourcingExtra(d);
assert(html.includes('落地成本分项'),'sourcing enhancement missing from actual module');
console.log('PASS V0.9 enterprise wrapper, sourcing bridge and re-render mounting');
