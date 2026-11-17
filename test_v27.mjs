import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
const state={data:enterpriseAnalysis(),filters:{}};
const mockStorage=new Map();
const win={EnterpriseV08:{state,load(){}},render(){}};
vm.runInNewContext(fs.readFileSync('static/m02_spend_strategy.js','utf8'),{
 window:win,document:{readyState:'loading',addEventListener(){}},
 localStorage:{getItem(k){return mockStorage.get(k)||null},setItem(k,v){mockStorage.set(k,v)}},
 console,Intl,Number,String,Math,Date,Set,Map,JSON
});
const page=win.PharmaSpendV25;
const model=page.model(state.data);const result=page.annualBudgetNumbers(model);
assert.equal(model.po.length,24);
assert.equal(model.total,580704);
assert.equal(model.optimizeStages.length,3);
assert.deepEqual([...model.optimizeStages.map(s=>s.label)],['报废减少','资金利息节约','退回供应商换回']);
assert.equal(model.optimizeStages[2].value,0,'Return recovery must be 0 until confirmed');
assert(result.b>aFix(result.a),'10% API price increase must increase scenario budget');
assert(result.c<=result.a,'Second-source discount must not increase budget');
assert.equal(result.monthRows.length,12);
assert.equal(result.byCategory.reduce((x,y)=>x+y.value,0),model.total);
const doc=page.render();
const required=['库存优化降本累计收益图','报废减少','资金利息节约','退回供应商换回','年度采购预算编制','Annual Procurement Budget Planning','上年度实际消耗量','下年度生产计划量','期初可用库存','在途未到货量','编制参数控制面板','需求侧参数','库存侧参数','供应侧参数','价格侧参数','风险侧参数','场景 A｜基准情景','场景 B｜涨价10%情景','场景 C｜二供落地情景','月度预算资金分布','品类预算占比','预算编制说明','编制依据','假设条件','风险提示','提交审批','导出预算报告'];
for(const x of required)assert(doc.includes(x),'Missing reference UI: '+x);
assert(doc.indexOf('月度滚动预算复盘｜消耗数量与金额')<doc.indexOf('物料库存金额排行'),'Consumption table must now be above inventory list');
assert(doc.indexOf('滚动预算准确率复盘表')>doc.indexOf('物料库存金额排行'),'Budget accuracy table must be swapped lower');
assert.equal((doc.match(/class="sp-scenario-v27/g)||[]).length,3);
assert.equal((doc.match(/class="sp-param-card/g)||[]).length,5);
assert(!doc.includes('NaN'));
const a0=result.a;
page.state.annualParams.priceRise=15;
assert(page.annualBudgetNumbers(page.model(state.data)).b>result.b);
page.state.annualParams.priceRise=10;
page.state.annualParams.planQty='1500';
assert.notEqual(page.annualBudgetNumbers(page.model(state.data)).a,a0);
page.state.annualParams.planQty=null;
for(const supplier of ['SUP-001','SUP-002','SUP-003']){
 const d=enterpriseAnalysis({supplier});state.data=d;state.filters={supplier};
 const m=page.model(d),a=page.annualBudgetNumbers(m);
 assert.equal(m.total,d.overview.current.spend);
 assert.equal(a.byCategory.reduce((x,y)=>x+y.value,0),m.total);
 assert.equal(m.referenceAccuracy,null);
}
state.filters={};state.data=enterpriseAnalysis();
const html=fs.readFileSync('static/index.html','utf8');
assert(html.includes('/static/m02_spend_strategy.js'));
assert(html.includes('/static/m02_spend_strategy.css'));
console.log('PASS V2.7: reference chart events, five parameter groups, three scenario model, ABC shares, table reorder, supplier scope, safe no-approval semantics.');
function aFix(v){return Number.isFinite(v)?v:0}
