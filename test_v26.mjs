import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
let store={};
const state={filters:{},data:enterpriseAnalysis()};
const win={EnterpriseV08:{state,load(){}},render(){}};
const document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(fs.readFileSync('static/m02_spend_strategy.js','utf8'),{window:win,document,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v},console,Intl,Number,String,Math,Date,Set,Map,JSON});
const page=win.PharmaSpendV25;
assert(page);
let m=page.model(state.data);
assert.equal(m.po.length,24);
assert.equal(m.total,580704);
assert.equal(m.lotScope.length,12);
assert.equal(m.budgetAccuracyRows.length,12);
assert.equal(m.consumptionRows.length,12);
assert.equal(m.budgetAccuracyRows.filter(r=>r.actual!==null).length,3);
assert.equal(m.consumptionRows.filter(r=>r.actualQty!==null).length,3);
assert.equal(m.materialInventory.reduce((a,r)=>a+r.spend,0),m.total);
assert.equal(m.materialInventory.reduce((a,r)=>a+r.released+r.held,0),m.lotsValue);
assert.equal(m.materialInventory.reduce((a,r)=>a+r.transit,0),m.pending.reduce((a,r)=>a+r.pending_amount,0));
assert.equal(m.pending.length,0); // In the seeded PO register all 24 were fully received.
assert(m.fundingTimeline.some(r=>r.released>0)&&m.fundingTimeline.some(r=>r.held>0));
assert.equal(m.fundingTimeline.reduce((a,r)=>a+r.released+r.held,0),m.lotsValue);
assert.equal(m.optimizeStages.length,3);
assert(m.optimizeStages.every(r=>r.value>=0));
assert(m.referenceAccuracy>0&&m.referenceAccuracy<=100);
assert.equal(m.consumptionRows.find(r=>r.period==='2026-09').forecastQty,600);
assert.equal(m.consumptionRows.find(r=>r.period==='2026-09').actualQty,595);
const july=m.budgetAccuracyRows.find(r=>r.period==='2026-07');assert.equal(july.actual,326392);
const h=page.render();
for(const heading of ['预算准确率','月度库存资金估算趋势｜三类库存','在途库存分界线','采购差异原因拆分','库存优化降本累计图','滚动预算准确率复盘表','物料库存金额排行','采购金额占比','可用库存','在检/隔离库存','在途库存','月度滚动预算复盘｜消耗数量与金额','年初库存预算数量','预测消耗金额','实际消耗金额','偏差原因','年度采购预算编制']){
 assert(h.includes(heading),'missing '+heading);
}
assert.equal((h.match(/class="sp-kpi"/g)||[]).length,8);
assert(h.includes('data-sp-month-budget="2026-07"'));
assert(h.includes('data-sp-open-budget="2026-09"'));
assert(!h.includes('Savings 项目登记累计值'));
assert(!h.includes('模拟参考预算执行率'));
assert(!h.includes('NaN'));
page.state.budgetMonths['2026-07']='250000';
assert.equal(page.model(state.data).budgetAccuracyRows.find(x=>x.period==='2026-07').budget,250000);
page.state.openingPlan['2026-09']='300';
assert.equal(page.model(state.data).consumptionRows.find(x=>x.period==='2026-09').openingPlan,300);
page.state.budgetMonths={};page.state.openingPlan={};
for(const sid of ['SUP-001','SUP-002','SUP-003']){
 state.filters={supplier:sid};state.data=enterpriseAnalysis({supplier:sid});m=page.model(state.data);
 assert.equal(m.total,state.data.overview.current.spend);
 assert.equal(m.referenceAccuracy,null);
 assert(m.materialInventory.reduce((a,x)=>a+x.spend,0)===m.total);
 assert(m.budgetAccuracyRows.every(x=>x.budget===null));
}
state.filters={};state.data=enterpriseAnalysis();
const html=fs.readFileSync('static/index.html','utf8');
assert(html.includes('data-bundled-src="/static/m02_spend_strategy.js"'));
assert(html.includes('/static/m02_spend_strategy.css'));
assert(fs.statSync('static/m02_spend_strategy.css').size>11000);
console.log('PASS V2.6: funding lines, source PO/lot/WO reconciliation, budget accuracy, two monthly ledgers, optimization opportunity source, supplier scope and 8 KPIs');
