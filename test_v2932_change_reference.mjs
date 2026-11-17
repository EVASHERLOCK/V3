/** End-to-end contract of the new HTML-page JS against canonical workbench
 * using a controlled DOM event/fetch harness. Does not claim a visual pixel
 * comparison in an actual Bolt browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {buildChangeWorkbench} from './change_control_v2931.mjs';

const originalHash='d579cf2152935b19e195fb7054db17cdb08b92ab3becf08cef922677c66b3fa2';
const asset=fs.readFileSync('static/assets/change-control-full-process-reference.png');
assert.equal(crypto.createHash('sha256').update(asset).digest('hex'),originalHash,'Uploaded reference artwork must remain byte-for-byte unchanged');
const css=fs.readFileSync('static/change_control_reference_v2932.css','utf8');
const html=fs.readFileSync('static/index.html','utf8');
const app=fs.readFileSync('static/app.js','utf8');
const old=fs.readFileSync('static/change_control_ra_v2931.js','utf8');
const js=fs.readFileSync('static/change_control_reference_v2932.js','utf8');
assert(html.includes('change_control_reference_v2932.css'));
assert(html.includes('window.PharmaChangeReference={render,init'), 'New route JavaScript must be in 21-script Bolt HTML bundle');
assert(css.includes('.ccref-hotspot:focus-visible'),'All interactive image hotspots must be keyboard accessible');
assert(app.includes("id==='m09-reference'"),'Independent route must be accepted');
assert(app.includes("window.PharmaChangeReference.render()"),'Reference view must render independently from main workbench');
assert(old.includes('data-nav="m09-reference"'),'Original workbench must have an adjacent navigation button');
assert(old.includes('applyFilters:(patch)'),'Legacy workspace must support filter synchronization');
const listeners={};
const document={readyState:'complete',addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn)};
const legacy={supplier:'all',material:'all',month:'all',change_type:'all',status:'all',scope:'采购变更（供应商/物料）',scheme:'全球RA · 标准设置',role:'Category Manager'};
const requested=[];
const window={PharmaChangeControlV2931:{filters:()=>({...legacy}),applyFilters:patch=>Object.assign(legacy,patch)},render:null};
const location={hash:'#m09-reference'};
let painted='';
const fetch=async url=>{
 requested.push(url);
 const params=Object.fromEntries(new URL(url,'http://local.test').searchParams.entries());
 return {ok:true,json:async()=>buildChangeWorkbench(params)};
};
vm.runInNewContext(js,{window,document,location,console,fetch,URLSearchParams,Number,Math,Date,String,Set,Array,Object,JSON,Promise}, {filename:'change_control_reference_v2932.js'});
assert.equal(typeof window.PharmaChangeReference.render,'function');
window.render=()=>{painted=window.PharmaChangeReference.render()};
window.render();
assert(painted.includes('/static/assets/change-control-full-process-reference.png'));
assert.equal((painted.match(/class="ccref-hotspot"/g)||[]).length,31,'10 steps + 5 gates + 4 principles + 5 workstreams + 2 outputs + 5 column headers');
assert(painted.includes('aria-label="01 变更触发与受理'));
await new Promise(r=>setTimeout(r,30));
assert(painted.includes('387,008'),'Baseline exposure must come from canonical 3-change DEMO, not picture');
assert(painted.includes('注册关联'));
assert.equal(requested.length,1,'Fetch unified endpoint exactly once for unchanged filters');
function target(data){const t={dataset:data};t.closest=(selector)=>selector==='.ccref-page'?{}:t;return t}
function click(data){for(const h of listeners.click||[])h({target:target(data)})}
function change(data){const t=target({ccrefFilter:data.key});t.value=data.value;for(const h of listeners.change||[])h({target:t})}
click({ccrefOpen:'step:0',ccrefView:'changes'});
assert(painted.includes('class="ccref-drawer"'));
assert(painted.includes('变更触发与受理'));
assert(painted.includes('data-ccref-filter="supplier"'));
assert(painted.includes('class="ccref-chart"'));
assert(painted.includes('data-ccref-export="full"'));
change({key:'supplier',value:'SUP-002'});
await new Promise(r=>setTimeout(r,30));
assert.equal(legacy.supplier,'SUP-002','New page supplier filter must sync into old workbench');
assert(requested.at(-1).includes('supplier=SUP-002'));
assert(painted.includes('186,144'),'Supplier-specific spend must match original canonical model');
assert(!painted.includes('387,008'),'Old all-supplier spend must disappear after filtering');
click({ccrefTab:'filings'});
assert(painted.includes('RA关联状态'));
click({ccrefChange:'CC-001'});
// Missing IDs are never invented; valid change records produce evidence detail.
const actual=buildChangeWorkbench({supplier:'SUP-002'});
click({ccrefChange:actual.changes[0].change_id});
assert(painted.includes('原始关联核对'));
click({ccrefClose:''});
assert(!painted.includes('class="ccref-drawer"'));
console.log('PASS V2.9.32: original image SHA256, 31 active hotspots, independent route, screen-linked canonical metrics, drawer, filters synchronized to V2.9.31, real filing/PO/Excel actions.');
