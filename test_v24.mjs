import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
const js=fs.readFileSync('static/material_lifecycle_v23.js','utf8');
const d=enterpriseAnalysis({});
const W={EnterpriseV08:{state:{data:d,filters:{},loading:false},load(){}},render(){}};
vm.runInNewContext(js,{window:W,document:{readyState:'loading',addEventListener(){}},console,Date,setTimeout,Intl,Blob,URL});
const L=W.PharmaLifecycleV23;
const m=L.model(d);
const expected=m.byMat.reduce((a,x)=>a+x.available,0)/m.byMat.reduce((a,x)=>a+x.daily,0);
assert(Math.abs(m.coverDays-expected)<1e-9);
assert(m.coverDays>0 && m.coverageMethod.includes('Released'));
assert.equal(m.poMonths.reduce((a,x)=>a+x.ordered,0),m.selectedOrders.reduce((a,x)=>a+Number(x.ordered_qty),0));
assert.equal(m.poMonths.reduce((a,x)=>a+x.received,0),m.selectedOrders.reduce((a,x)=>a+Number(x.received_qty),0));
const html=L.render();
for(const label of ['平均可用库存覆盖天数','在途库存与到货计划','lc-line-svg','批次总台账','安全库存缺口清单','呆滞 / 效期处置行动','批次追溯明细'])assert(html.includes(label),label);
assert(!html.includes('受控批次库存估值'));
assert.equal((html.match(/data-lc-ledger=/g)||[]).length,4);
for(const id of ['batches','safety','expiry','trace']){
 assert(html.includes(`data-lc-search="${id}"`));
 assert(html.includes(`data-lc-act="export:${id}"`));
 assert(html.includes(`data-lc-sort="${id}:0"`));
}
assert.equal((html.match(/data-lc-tab=/g)||[]).length,0);
for(const c of ['lc-abc-tier-a','lc-abc-tier-b','lc-abc-tier-c'])assert(html.includes(c));
assert.equal(['A','B','C'].reduce((n,c)=>n+m.byMat.filter(x=>x.abc===c).length,0),m.byMat.length);
L.state.status='Quarantined';const filtered=L.model(d);assert(filtered.lots.every(x=>x.status==='Quarantined'));assert.equal(filtered.releasedQty,0);assert.equal(filtered.coverDays,0);L.state.status='all';
for(const [key,val] of [['supplier','SUP-001'],['material','API-001'],['month','2026-08']]){
 W.EnterpriseV08.state.filters={[key]:val};W.EnterpriseV08.state.data=enterpriseAnalysis({[key]:val});const mm=L.model(W.EnterpriseV08.state.data);
 assert.equal(mm.lots.length,W.EnterpriseV08.state.data.material.lots.length);
 assert.equal(mm.poMonths.reduce((n,x)=>n+x.ordered,0),mm.selectedOrders.reduce((n,x)=>n+Number(x.ordered_qty),0));
}
const index=fs.readFileSync('static/index.html','utf8');assert(index.includes('平均可用库存覆盖天数'));assert(index.includes('lc-abc-v24'));
assert.equal((index.match(/<script\b/g)||[]).length,(index.match(/<\/script>/g)||[]).length);
console.log('PASS V2.4: inventory coverage; PO source reconciliation; ABC cards; 4 independent ledgers; filters; scripts');
