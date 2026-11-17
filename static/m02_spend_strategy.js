/* V2.7 Spend & Category Intelligence — connected read-only analytical view.
   Financial inventory values are explicitly estimated from linked PO prices.
   Budget parameters and Savings ledgers are DEMO scenarios, never approved ERP budgets.
*/
(function(){'use strict';
const S={abc:'all',month:'all',tab:'explore',detail:null,tableSearch:'',localBudget:null,assumptions:{volume:0,price:0,safety:0},saved:false,persisted:false,budgetMonths:{},openingPlan:{},budgetVersion:'V2.0修订版',savedVersions:[],annualParams:{planQty:null,validationQty:0,shutdownMonths:0,safetyFactor:1.2,maxInventoryDays:180,batchDiscount:3.5,priceRise:10,logistics:4.2,dualSourceReserve:40,fxBuffer:3,interestRate:4,secondSourceDiscount:3,returnRecovery:0}};
const E=()=>window.EnterpriseV08,D=()=>E()?.state?.data;
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const sum=(a,k)=>a.reduce((s,x)=>s+N(typeof k==='function'?k(x):x[k]),0);
const uniq=a=>[...new Set(a.filter(Boolean))];
const H=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(x,d=0)=>x==null||!Number.isFinite(Number(x))?'—':Number(x).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const usd=x=>x==null?'—':f(x)+' USD';
const pct=(a,b)=>b?f(a/b*100,1)+'%':'—';
function moneyInput(n){return Math.round(N(n))}
try{const old=JSON.parse(localStorage.getItem('pharma.v25.spend.scenario')||'null');if(old){S.localBudget=old.budget;S.assumptions={volume:N(old.volume),price:N(old.price),safety:N(old.safety)}}}catch{}
try{const more=JSON.parse(localStorage.getItem('pharma.v26.spend.months')||'null');if(more){S.budgetMonths=more.budgetMonths||{};S.openingPlan=more.openingPlan||{}}}catch{}
try{const savedAnnual=JSON.parse(localStorage.getItem('pharma.v27.annual.params')||'null');if(savedAnnual&&typeof savedAnnual==='object'){for(const k of Object.keys(S.annualParams))if(Object.hasOwn(savedAnnual,k))S.annualParams[k]=savedAnnual[k]}}catch{}
try{const hist=JSON.parse(localStorage.getItem('pharma.v27.annual.versions')||'[]');if(Array.isArray(hist))S.savedVersions=hist.slice(-15)}catch{}
const q=(v,label,sel)=>`<option value="${H(v)}" ${String(v)===String(sel)?'selected':''}>${H(label)}</option>`;
const link=(label,act,cl='')=>`<button type="button" class="sp-btn ${cl}" data-sp-act="${H(act)}">${label}</button>`;
function model(d){
 if(!d)return null;
 const eng=E()?.state?.filters||{},asOf=d.meta?.as_of||'2026-11-01';
 const master=d.master?.materials||[],supp=d.master?.suppliers||[],mm=Object.fromEntries(master.map(x=>[x.material_id,x])),sm=Object.fromEntries(supp.map(x=>[x.supplier_id,x]));
 const po0=d.purchasing?.orders||[],lots0=d.material?.lots||[],ledger0=d.spend?.ledger||[];
 const matSpend=Object.entries(po0.reduce((o,r)=>(o[r.material_id]=(o[r.material_id]||0)+N(r.amount),o),{})).map(([id,value])=>({id,value})).sort((a,b)=>b.value-a.value);
 let prev=0,tot0=sum(matSpend,'value'),abc={};for(const r of matSpend){abc[r.id]=tot0&&prev/tot0<.8?'A':tot0&&prev/tot0<.95?'B':'C';prev+=r.value}
 let po=po0.filter(r=>(S.abc==='all'||abc[r.material_id]===S.abc)&&(S.month==='all'||String(r.created_date||'').slice(0,7)===S.month));
 // Inventory status is a stock snapshot; the month selector applies to PO activity, not historical stock.
 const activeMatIds=uniq(po.map(r=>r.material_id));
 const lotScope=lots0.filter(r=>(S.abc==='all'||abc[r.material_id]===S.abc)&&(S.month==='all'||activeMatIds.includes(r.material_id)));
 const priceLines=uniq(po.map(r=>r.material_id)).map(id=>{const rows=po.filter(x=>x.material_id===id);return {material_id:id,spend:sum(rows,'amount'),variance_amount:sum(rows,x=>(N(x.unit_price)-N(x.benchmark_price))*N(x.ordered_qty)),ppv:null}});
 const ledger=ledger0.filter(r=>(S.abc==='all'||abc[r.material_id]===S.abc)&&(S.month==='all'||activeMatIds.includes(r.material_id)));
 const total=sum(po,'amount'),lotsValue=sum(lotScope,'amount'),released=lotScope.filter(r=>r.status==='Released'),quarantined=lotScope.filter(r=>r.status!=='Released'),
 stale=lotScope.filter(r=>r.stale===true||N(r.age_days)>90),expiry=lotScope.filter(r=>r.expiring===true||N(r.days_to_control)<=90);
 const atRisk=lotScope.filter(r=>stale.includes(r)||expiry.includes(r)||quarantined.includes(r));
 const byMat=uniq([...po.map(x=>x.material_id),...lotScope.map(x=>x.material_id)]).map(id=>{const orders=po.filter(x=>x.material_id===id),lots=lotScope.filter(x=>x.material_id===id);return {id,name:mm[id]?.name||id,category:mm[id]?.category_group||'—',abc:abc[id]||'—',spend:sum(orders,'amount'),inventory:sum(lots,'amount'),released:sum(lots.filter(x=>x.status==='Released'),'amount'),stale:sum(lots.filter(x=>stale.includes(x)),'amount'),expiry:sum(lots.filter(x=>expiry.includes(x)),'amount'),lots,orders}}).sort((a,b)=>b.inventory-a.inventory||a.id.localeCompare(b.id));
 const monthly=Object.values(po.reduce((o,r)=>{const period=String(r.created_date||'').slice(0,7);if(!period)return o;let x=o[period]||={period,spend:0,rows:[],variance:0};x.spend+=N(r.amount);x.variance+=(N(r.unit_price)-N(r.benchmark_price))*N(r.ordered_qty);x.rows.push(r);o[period]=x;return o},{})).sort((a,b)=>a.period.localeCompare(b.period));
 const qcMap=Object.fromEntries((d.material?.qc||[]).map(x=>[x.lot_id,x]));
 const arrival=Object.values(lotScope.reduce((o,r)=>{const rec=qcMap[r.lot_id]?.gr_date||(po0.find(p=>p.po_id===r.linked_po)?.receipt_date)||null;const period=String(rec||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(period))return o;let x=o[period]||={period,released:0,held:0,rows:[]};x[r.status==='Released'?'released':'held']+=N(r.amount);x.rows.push(r);o[period]=x;return o},{})).sort((a,b)=>a.period.localeCompare(b.period));
 const ageBins=[['0–30天',0,30],['31–60天',31,60],['61–90天',61,90],['91–180天',91,180],['180天以上',181,999999]].map(([label,lo,hi])=>({label,rows:lotScope.filter(x=>N(x.age_days)>=lo&&N(x.age_days)<=hi)}));
 const abcGroups=['A','B','C'].map(label=>({label,rows:byMat.filter(x=>x.abc===label),value:sum(byMat.filter(x=>x.abc===label),'inventory')}));
 const baseline=d.overview?.current?.budget??null, budget=S.localBudget===null?baseline:S.localBudget;
 const comparable=!['supplier','material','category','supplier_class','site','month'].some(k=>eng[k])&&S.abc==='all'&&S.month==='all';
 const coverage=window.PharmaLifecycleV23?.model?.(d)?.coverDays;
 const extraPerSafetyDay=coverage&&coverage>0?sum(lots0.filter(r=>r.status==='Released'),'amount')/coverage:0;
 const target=budget===null?null:N(budget),baseScenario=target===null?null:target*(1+S.assumptions.volume/100)*(1+S.assumptions.price/100)+S.assumptions.safety*extraPerSafetyDay,
 lowScenario=baseScenario===null?null:baseScenario*.94,highScenario=baseScenario===null?null:baseScenario*1.08;
 const actualVariance=sum(po,r=>(N(r.unit_price)-N(r.benchmark_price))*N(r.ordered_qty));
 const allCalendar=[...new Set([...monthly.map(x=>x.period),...arrival.map(x=>x.period)])].sort();
 const spendBySupplier=uniq(po.map(x=>x.supplier_id)).map(id=>({id,name:sm[id]?.supplier_name||id,spend:sum(po.filter(x=>x.supplier_id===id),'amount')})).sort((a,b)=>b.spend-a.spend);
 const budgetMonthly=monthly.map(x=>({...x,monthlyReference:target===null||!comparable?null:target/12,deviation:target===null||!comparable?null:x.spend-target/12}));
 const base={d,eng,asOf,po,po0,comparable,abc,byMat,monthly,arrival,allCalendar,lotScope,released,quarantined,stale,expiry,atRisk,priceLines,ledger,ageBins,abcGroups,spendBySupplier,total,lotsValue,budget:target,baseScenario,lowScenario,highScenario,actualVariance,budgetMonthly,scenarioNote:target===null?'参考预算未接入':'参考预算来自 DEMO 参数，可编辑但不是正式批准预算'};
 return Object.assign(base,computeExtras(base));
}
const empty=(s='当前筛选暂无数据')=>`<div class="sp-empty">${H(s)}</div>`;
const title=(s,tip='')=>`<div class="sp-cardhead"><strong>${H(s)}</strong><span class="sp-help" title="${H(tip||'点击图表或数据行查看对应来源记录')}">ⓘ</span></div>`;
const card=(name,value,foot,key)=>`<button class="sp-kpi" type="button" data-sp-open="${H(key)}"><span>${H(name)} <span>ⓘ</span></span><strong>${H(value)}</strong><small>${H(foot)}</small></button>`;
const tiny=(name,val)=>`<div class="sp-tile"><span>${H(name)}</span><b>${H(val)}</b></div>`;
function lineChart(data,series,open='monthly',unit='USD',fill=false){
 if(!data.length)return empty('没有可追溯的期间数据，未生成示意走势');
 const W=670,Hh=220,left=58,top=18,right=15,bottom=38,inner=W-left-right,h=Hh-top-bottom;
 const max=Math.max(1,...data.flatMap(r=>series.map(s=>N(r[s.key]))))*1.12;
 const X=i=>left+(data.length===1?inner/2:(i/(data.length-1))*inner);
 const Y=v=>top+h-N(v)/max*h;
 const paths=series.map((s,j)=>{let pts=data.map((r,i)=>[X(i),Y(r[s.key])]);const xy=pts.map(v=>v.map(n=>n.toFixed(1)).join(',')).join(' ');
 const area=fill?`<polygon points="${left},${top+h} ${xy} ${X(data.length-1)},${top+h}" fill="${s.fill||s.color}" opacity=".10"/>`:'';
 return `${area}<polyline points="${xy}" fill="none" stroke="${s.color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>${pts.map((p,i)=>`<circle class="sp-point" data-sp-open="${open}:${H(data[i].period)}" tabindex="0" role="button" aria-label="${H(data[i].period)} ${H(s.name)} ${H(f(data[i][s.key]))}" cx="${p[0]}" cy="${p[1]}" r="5" fill="${s.color}" stroke="white" stroke-width="2"><title>${H(data[i].period)} · ${H(s.name)}: ${H(f(data[i][s.key]))} ${H(unit)}</title></circle>`).join('')}`}).join('');
 const grid=Array.from({length:5},(_,i)=>{let v=max*(4-i)/4,y=Y(v);return `<line x1="${left}" x2="${W-right}" y1="${y}" y2="${y}" stroke="#e5edf5" stroke-dasharray="3 3"/><text x="${left-8}" y="${y+4}" font-size="11" fill="#7c91a6" text-anchor="end">${f(v,0)}</text>`}).join('');
 const ticks=data.map((r,i)=>`<text x="${X(i)}" y="${Hh-12}" font-size="11" fill="#667f96" text-anchor="middle">${H(r.period.slice(5))}月</text>`).join('');
 return `<div class="sp-chart"><svg viewBox="0 0 ${W} ${Hh}" aria-label="真实来源期间折线趋势，点击节点查看明细" role="img">${grid}${paths}${ticks}</svg></div><div class="sp-legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${H(s.name)}</span>`).join('')}</div>`;
}
function donut(rows,open='abc'){
 const all=sum(rows,'value');if(!all)return empty();const colors=['#234f70','#f1b778','#df6e61','#69af9a','#8bc5dc'];let x=0;const stops=rows.map((r,i)=>{let old=x;x+=r.value/all*100;return `${colors[i%colors.length]} ${old.toFixed(2)}% ${x.toFixed(2)}%`});
 return `<div class="sp-donut-row"><div class="sp-donut" data-sp-open="kpi:inventory" tabindex="0" role="button" title="查看库存估值来源" style="background:conic-gradient(${stops.join(',')})"><div><b>${f(all)}</b><small>估算 USD</small></div></div><div class="sp-donut-legend">${rows.map((r,i)=>`<button data-sp-open="${open}:${H(r.label)}"><i style="background:${colors[i%colors.length]}"></i>${H(r.label)} 类 <b>${pct(r.value,all)}</b></button>`).join('')}</div></div>`;
}
function bars(rows,key,label,open='material'){
 if(!rows.length)return empty();const max=Math.max(1,...rows.map(x=>N(x[key])));
 return `<div class="sp-bar-list">${rows.map(r=>`<button data-sp-open="${open}:${H(r.id||r.label)}"><span>${H(r[label])}</span><i><em style="width:${Math.max(2,N(r[key])/max*100)}%"></em></i><strong>${f(r[key])}</strong></button>`).join('')}</div>`;
}
function dataTable(cols,rows,kind){return `<div class="sp-tablewrap"><table><thead><tr>${cols.map(c=>`<th>${H(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr tabindex="0" data-sp-open="${kind}:${H(r.id||r.lot_id||r.period||r.po_id||i)}">${cols.map(c=>`<td>${H(typeof c[1]==='function'?c[1](r):r[c[1]]??'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}">当前范围没有对应记录</td></tr>`}</tbody></table></div>`}

// V2.6: all portfolio quantities derive from the same PO, Lot and production-order rows.
// Unapproved monthly budget values are scenario-only browser inputs, never actual ERP budgets.
function computeExtras(m){
 const year=String(m.asOf||'2026').slice(0,4),monthIds=Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
 const allOrders=m.po,prod=(m.d.material?.production||[]).filter(r=>m.byMat.some(x=>x.id===r.material_id));
 const unitPrice=id=>{let rows=m.po0.filter(x=>x.material_id===id);let qty=sum(rows,x=>x.ordered_qty);return qty?sum(rows,x=>N(x.amount))/qty:null};
 const pending=allOrders.filter(x=>Math.max(0,N(x.ordered_qty)-N(x.received_qty))>0).map(x=>({...x,pending_qty:Math.max(0,N(x.ordered_qty)-N(x.received_qty)),pending_amount:Math.max(0,N(x.ordered_qty)-N(x.received_qty))*N(x.unit_price)}));
 const fundingTimeline=monthIds.map(period=>{let entry=m.arrival.find(x=>x.period===period);return {period,released:entry?.released||0,held:entry?.held||0,transit:sum(pending.filter(x=>String(x.promised_date||'').slice(0,7)===period),'pending_amount'),rows:entry?.rows||[]}});
 const varianceMonths=monthIds.map(period=>{let pos=allOrders.filter(x=>String(x.created_date||'').slice(0,7)===period),wos=prod.filter(x=>String(x.required_date||'').slice(0,7)===period);
   return {period,price:Math.abs(sum(pos,x=>(N(x.unit_price)-N(x.benchmark_price))*N(x.ordered_qty))),quantity:Math.abs(sum(wos,x=>(N(x.actual_consumed_qty)-N(x.standard_qty))*N(unitPrice(x.material_id)))),structure:null,po:pos,production:wos};
 }).filter(r=>r.po.length||r.production.length);
 const budgetAccuracyRows=monthIds.map(period=>{let poRows=allOrders.filter(x=>String(x.created_date||'').slice(0,7)===period),actual=poRows.length?sum(poRows,'amount'):null,defaultBudget=m.comparable&&m.budget!==null?m.budget/12:null,
 budget=Object.hasOwn(S.budgetMonths,period)&&S.budgetMonths[period]!==''?N(S.budgetMonths[period]):defaultBudget,accuracy=(actual!==null&&budget>0)?Math.max(0,100*(1-Math.abs(actual-budget)/budget)):null;
 return {period,budget,actual,accuracy,delta:actual===null||budget===null?null:actual-budget,po:poRows,note:poRows.length?'按已登记 PO 汇总':'当月无采购源记录',budgetKind:Object.hasOwn(S.budgetMonths,period)?'用户本地情景':'年度演示预算等额参考'};
 });
 const consumptionRows=monthIds.map(period=>{let wos=prod.filter(x=>String(x.required_date||'').slice(0,7)===period),budgetQ=Object.hasOwn(S.openingPlan,period)&&S.openingPlan[period]!==''?N(S.openingPlan[period]):null;
 const qtyForecast=wos.length?sum(wos,x=>x.standard_qty):null,qtyActual=wos.length?sum(wos,x=>x.actual_consumed_qty):null;
 const forecastAmount=wos.length?sum(wos,x=>N(x.standard_qty)*N(unitPrice(x.material_id))):null,actualAmount=wos.length?sum(wos,x=>N(x.actual_consumed_qty)*N(unitPrice(x.material_id))):null;
 const avgUnit=wos.length&&qtyForecast?forecastAmount/qtyForecast:null;
 const deviation=forecastAmount&&actualAmount!==null?(actualAmount-forecastAmount)/forecastAmount*100:null;
 return {period,openingPlan:budgetQ,unitPrice:avgUnit,forecastQty:qtyForecast,forecastAmount,actualQty:qtyActual,actualAmount,deviation,cause:wos.length?(deviation>0.01?'实际耗用高于标准量':deviation<-0.01?'实际耗用低于标准量':'标准量与实际耗用一致'):'未接入该月工单',production:wos};
 });
 const materialInventory=m.byMat.map(r=>({...r,held:sum(r.lots.filter(x=>x.status!=='Released'),'amount'),transit:sum(pending.filter(x=>x.material_id===r.id),'pending_amount'),purchaseShare:m.total?r.spend/m.total*100:null}));
 const sourceProd=prod.filter(x=>x.actual_consumed_qty!==undefined&&x.required_date),dates=sourceProd.map(x=>new Date(x.required_date+'T00:00:00Z').getTime()).filter(Number.isFinite),dSpan=dates.length?Math.max(1,(Math.max(...dates)-Math.min(...dates))/86400000+1):null;
 const optimization=m.byMat.map(r=>{let rel=r.lots.filter(x=>x.status==='Released'),qa=r.lots.filter(x=>x.status!=='Released'),safeRel=rel.filter(x=>!(x.expiring||N(x.days_to_control)<=90)),unit=N(unitPrice(r.id));let prodR=sourceProd.filter(x=>x.material_id===r.id),daily=dSpan?sum(prodR,x=>x.actual_consumed_qty)/dSpan:0;
 const safety=N(m.d.master?.materials?.find(x=>x.material_id===r.id)?.safety_days),available=sum(safeRel,x=>x.quantity),excess=Math.max(0,available-daily*safety);
 return {id:r.id,excessValue:unit*excess,expiringValue:sum(rel.filter(x=>x.expiring||N(x.days_to_control)<=90),'amount'),holdValue:sum(qa,'amount'),lots:r.lots};});
 // These are independent inventory capital opportunities, not realized savings.
 // Returns cannot be counted without a signed supplier return agreement; default = 0.
 const apr=Math.max(0,N(S.annualParams.interestRate))/100,assumedDays=90;
 const optimizeStages=[
  {label:'报废减少',value:sum(optimization,'expiringValue'),rows:m.expiry.filter(x=>x.status==='Released'),basis:'可能避免的临期处置资金上限（不是已避免报废损失）'},
  {label:'资金利息节约',value:sum(optimization,'excessValue')*apr*assumedDays/365,rows:m.released.filter(x=>!(x.expiring||N(x.days_to_control)<=90)),basis:'可释放资金 × 演示年化资金率 × 90/365'},
  {label:'退回供应商换回',value:sum(optimization,'holdValue')*Math.max(0,N(S.annualParams.returnRecovery))/100,rows:m.quarantined,basis:'在检隔离价值 × 已确认退货回收比例；未签署回收协议时为0'}
 ];
 let cumulative=0;optimizeStages.forEach(x=>{cumulative+=x.value;x.cumulative=cumulative});
 const monthlyBudgetTotal=budgetAccuracyRows.every(x=>x.budget!==null)?sum(budgetAccuracyRows,x=>x.budget):null;
 const referenceAccuracy=m.comparable&&monthlyBudgetTotal>0?Math.max(0,100*(1-Math.abs(m.total-monthlyBudgetTotal)/monthlyBudgetTotal)):null;
 return {year,monthIds,pending,fundingTimeline,varianceMonths,budgetAccuracyRows,consumptionRows,materialInventory,optimization,optimizeStages,referenceAccuracy,monthlyBudgetTotal,sourceProduction:prod};
}
function spSvgAxisChart(records,series,{unit='USD',open='variance',mode='column',separator=null,xLabel='月份'}={}){
 if(!records.length)return empty('没有可追溯的期间数据');const W=740,Hh=260,L=68,R=16,T=30,B=45,IW=W-L-R,IH=Hh-T-B;
 const all=records.flatMap(r=>series.map(s=>r[s.key]).filter(x=>x!=null).map(x=>Math.max(0,N(x))));const vmax=Math.max(1,...all)*1.16;
 const X=i=>L+(i+.5)*IW/records.length,Y=v=>T+IH-Math.max(0,N(v))/vmax*IH;
 let out=Array.from({length:5},(_,k)=>{const val=vmax*k/4,y=Y(val);return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#dbe5f1" stroke-dasharray="4 4"/><text x="${L-9}" y="${y+4}" fill="#6a7e95" font-size="11" text-anchor="end">${f(val)}</text>`}).join('');
 out+=`<line x1="${L}" x2="${W-R}" y1="${T+IH}" y2="${T+IH}" stroke="#8299ad"/><line x1="${L}" x2="${L}" y1="${T}" y2="${T+IH}" stroke="#8299ad"/><text x="13" y="17" fill="#758a9e" font-size="11">${H(unit)}</text>`;
 if(mode==='stacked'){
 records.forEach((r,i)=>{let base=0;for(const [j,s] of series.entries()){const v=r[s.key];if(v===null||v===undefined)continue;const h=N(v)/vmax*IH,x=L+i*IW/records.length+IW/records.length*.22,y=Y(base+N(v));out+=`<rect data-sp-open="${H(open+':'+r.period)}" tabindex="0" role="button" class="sp-point" x="${x}" y="${y}" width="${IW/records.length*.56}" height="${Math.max(0,h)}" rx="2" fill="${s.color}"><title>${H(r.period)} · ${H(s.name)}: ${usd(v)}</title></rect>`;base+=N(v)}});
 }else{
 series.forEach(s=>{let p=[];records.forEach((r,i)=>{if(r[s.key]===null||r[s.key]===undefined){p.push(null);return}const x=X(i),y=Y(r[s.key]);p.push([x,y]);});let seg=[];const flush=()=>{if(seg.length>1)out+=`<polyline points="${seg.map(p=>p.join(',')).join(' ')}" stroke="${s.color}" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;seg=[]};p.forEach(pt=>pt?seg.push(pt):flush());flush();p.forEach((pt,i)=>{if(!pt)return;out+=`<circle data-sp-open="${H(open+':'+records[i].period)}" tabindex="0" role="button" class="sp-point" cx="${pt[0]}" cy="${pt[1]}" r="4.8" fill="${s.color}" stroke="#fff" stroke-width="1.5"><title>${H(records[i].period)} · ${H(s.name)} ${usd(records[i][s.key])}</title></circle>`});});
 }
 out+=records.map((r,i)=>`<text x="${X(i)}" y="${Hh-22}" text-anchor="middle" font-size="10.5" fill="#6e8399">${H(r.period.slice(5))}月</text>`).join('');
 if(separator!==null&&separator>=0&&separator<records.length){const x=L+(separator+.5)*IW/records.length+IW/records.length*.5;out+=`<line x1="${x}" x2="${x}" y1="${T}" y2="${T+IH}" stroke="#f6a742" stroke-width="2" stroke-dasharray="5 4"/><rect x="${Math.min(W-164,Math.max(L+6,x-80))}" y="${T-19}" width="144" height="17" rx="6" fill="#fff2e3"/><text x="${Math.min(W-92,Math.max(L+78,x-8))}" y="${T-7}" text-anchor="middle" fill="#bd7a23" font-size="10">在途库存分界线</text>`}
 return `<div class="sp-chart sp-axes"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="带横纵坐标和源数据下钻的分析图">${out}</svg></div><div class="sp-legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${H(s.name)}</span>`).join('')}</div>`;
}
function spFundsChart(m){const entries=m.fundingTimeline.filter(x=>x.released||x.held||x.transit);const first=entries.length?Math.max(0,m.fundingTimeline.indexOf(entries[0])-1):0;const last=entries.length?Math.min(11,m.fundingTimeline.indexOf(entries.at(-1))+2):5;
 const subset=m.fundingTimeline.slice(first,Math.max(last+1,first+3)),cut=subset.findIndex(x=>x.period>=String(m.asOf).slice(0,7));return spSvgAxisChart(subset,[{key:'released',name:'可放行库存',color:'#3a98c3'},{key:'held',name:'在检隔离库存',color:'#eaaa60'},{key:'transit',name:'在途库存（未收 PO）',color:'#55aa90'}],{open:'funds',mode:'line',separator:cut<=0?null:cut-1})+`<p class="sp-caption">按已登记批次入库月份及 PO 未收数量计算估算金额；不是历史月末财务库存。当前未收 PO：${m.pending.length} 笔，零值用 0 线表示。</p>`}
function spOptimizationChart(m){
 const stages=m.optimizeStages;
 if(!stages.length)return empty('暂无可追溯的库存优化来源');
 const W=920,Hh=360,L=86,R=34,T=46,B=62,IW=W-L-R,IH=Hh-T-B;
 const max=Math.max(1,...stages.map(x=>x.cumulative))*1.26;
 const X=i=>L+(i+1)*IW/4,Y=v=>T+IH-Math.max(0,N(v))/max*IH;
 const values=[0,...stages.map(x=>x.cumulative)];
 // Monotone smooth area instead of fabricated peaks: values come from lot-level opportunity records.
 const path=[];const pts=values.map((v,i)=>[L+i*IW/4,Y(v)]);
 path.push(`M ${pts[0][0]} ${pts[0][1]}`);
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],mid=(a[0]+b[0])/2;
  path.push(`C ${mid} ${a[1]} ${mid} ${b[1]} ${b[0]} ${b[1]}`)
 }
 const curve=path.join(' '),area=curve+` L ${pts.at(-1)[0]} ${T+IH} L ${L} ${T+IH} Z`;
 const grid=Array.from({length:5},(_,i)=>{const v=max*i/4,y=Y(v);return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#dfe9f0" stroke-dasharray="5 6"/><text x="${L-13}" y="${y+5}" text-anchor="end" font-size="13" fill="#8b9dac">${f(v,0)}</text>`}).join('');
 const shades=['#70b8a5','#e3b34e','#2a82b4'];
 const events=stages.map((s,i)=>{const x=X(i),y=Y(s.cumulative),marker=T+68+(i%2)*20;
  return `<line x1="${x}" y1="${T+32}" x2="${x}" y2="${T+IH}" stroke="${shades[i]}" stroke-dasharray="5 4" stroke-width="1.7" opacity=".65"/><circle cx="${x}" cy="${T+32}" r="8" fill="${shades[i]}"/><circle cx="${x}" cy="${y}" r="7" fill="${shades[i]}" stroke="white" stroke-width="3" class="sp-point" data-sp-open="optimize:${i+1}" tabindex="0" role="button"><title>${H(s.label)} · ${usd(s.value)} · ${H(s.basis)}</title></circle><g tabindex="0" role="button" data-sp-open="optimize:${i+1}" class="sp-opt-svg-label"><circle cx="${Math.max(L+45,Math.min(W-R-140,x+18))}" cy="${marker}" r="6" fill="${shades[i]}"/><text x="${Math.max(L+57,Math.min(W-R-127,x+30))}" y="${marker+6}" fill="#233a45" font-size="18" font-weight="700">${H(s.label)}</text></g>`
 }).join('');
 return `<div class="sp-chart sp-opt-v27"><div class="sp-opt-unit"><span class="sp-opt-dot"></span> 情景测算 <span class="sp-opt-sub">库存资本优化机会 · USD（非已实现降本）</span></div><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="库存优化降本累计收益图，三项来源机会及阶段事件标记"><defs><linearGradient id="spOptFill27" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#2d8bb7" stop-opacity=".51"/><stop offset="100%" stop-color="#d9f2fc" stop-opacity=".44"/></linearGradient></defs>${grid}<line x1="${L}" y1="${T+IH}" x2="${W-R}" y2="${T+IH}" stroke="#9cb6c8"/><path d="${area}" fill="url(#spOptFill27)"/><path d="${curve}" fill="none" stroke="#3d7896" stroke-width="3.2" stroke-linecap="round"/>${events}${stages.map((s,i)=>`<text x="${X(i)}" y="${Hh-21}" text-anchor="middle" fill="#456e85" font-size="13">阶段 ${i+1}</text>`).join('')}</svg><div class="sp-opt-key">${stages.map((x,i)=>`<button type="button" data-sp-open="optimize:${i+1}"><i style="background:${shades[i]}"></i><span>${H(x.label)}</span><strong>${usd(x.value)}</strong></button>`).join('')}</div></div><p class="sp-caption">金额按原始批次记录测算：报废减少为潜在临期金额、资金利息节约采用演示年化资金率 ${f(S.annualParams.interestRate,1)}% 和 90 天、退回供应商需要已确认的回收比例；均非财务已实现降本。</p>`;
}
function spBudgetChart(m){const rows=m.budgetAccuracyRows.filter(x=>x.budget!==null||x.actual!==null);return spSvgAxisChart(rows,[{key:'budget',name:'月度预算（本地模拟）',color:'#e9a675'},{key:'actual',name:'实际采购（PO）',color:'#347fb4'}],{open:'budgetMonth',mode:'line'} )+`<p class="sp-caption">蓝线仅连有实际 PO 的月份；其余月份为“无来源记录”，不补造实际采购。预算可在下方逐月编辑。</p>`}
function spVarianceBar(m){const rows=m.varianceMonths;return spSvgAxisChart(rows,[{key:'price',name:'价格差异｜PO',color:'#db7765'},{key:'quantity',name:'数量耗用差异｜WO',color:'#e6ab6d'}],{open:'variance',mode:'stacked',unit:'偏差贡献 USD'})+`<p class="sp-caption">按实际月份显示绝对偏差贡献，负号及原因在来源明细中查看；结构差异暂无正式预算品类基线，不生成虚构柱。</p>`}
function spRollingBudgetTable(m){return `<div class="sp-tablewrap sp-wide-table"><table><thead><tr><th>月份</th><th>预算金额（USD，模拟）</th><th>实际采购（PO，USD）</th><th>预算准确率（模拟）</th><th>金额差异</th><th>数据状态</th></tr></thead><tbody>${m.budgetAccuracyRows.map(x=>`<tr><td><button class="sp-link" data-sp-open="budgetMonth:${x.period}">${H(x.period)}</button></td><td><input type="number" min="0" step="100" aria-label="${x.period} 本地预算" data-sp-month-budget="${x.period}" value="${x.budget===null?'':Math.round(x.budget)}" placeholder="未录入"/></td><td>${x.actual===null?'—':usd(x.actual)}</td><td>${x.accuracy===null?'—':f(x.accuracy,1)+'%'}</td><td>${x.delta===null?'—':usd(x.delta)}</td><td><span class="sp-status ${x.po.length?'success':'muted'}">${x.po.length?x.po.length+' 条 PO':'无采购记录'}</span></td></tr>`).join('')}</tbody></table></div><p class="sp-caption">“预算金额”为浏览器本地情景，可逐月编辑并保存；源数据没有正式批准的月度预算。预算准确率 = max(0, 1 − |实际采购 − 预算| / 预算)。</p>`}
function spConsumptionTable(m){return `<div class="sp-tablewrap sp-wide-table"><table><thead><tr>${['月份','年初库存预算数量','单价（USD）','预测消耗数量','预测消耗金额','实际消耗数量','实际消耗金额','偏差率','偏差原因'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${m.consumptionRows.map(x=>`<tr><td><button class="sp-link" data-sp-open="consumption:${x.period}">${H(x.period)}</button></td><td><input type="number" min="0" step="1" data-sp-open-budget="${x.period}" aria-label="${x.period} 年初库存预算数量" value="${x.openingPlan??''}" placeholder="待录入" /></td><td>${x.unitPrice===null?'—':f(x.unitPrice,2)}</td><td>${x.forecastQty===null?'—':f(x.forecastQty)}</td><td>${x.forecastAmount===null?'—':usd(x.forecastAmount)}</td><td>${x.actualQty===null?'—':f(x.actualQty)}</td><td>${x.actualAmount===null?'—':usd(x.actualAmount)}</td><td class="${x.deviation>0?'sp-up':'sp-down'}">${x.deviation===null?'—':f(x.deviation,1)+'%'}</td><td>${H(x.cause)}</td></tr>`).join('')}</tbody></table></div><p class="sp-caption">“预测”采用原工单 standard_qty 作为基准代理，“实际”来自 actual_consumed_qty；单价为物料关联 PO 加权平均，不等同会计实际耗用成本。年初库存预算数量缺失时可输入本地方案，不回写 ERP。</p>`}


function annualBudgetNumbers(m){
 const ap=S.annualParams,production=m.sourceProduction||[],actualQty=sum(production,'actual_consumed_qty'),standardQty=sum(production,'standard_qty');
 const releasedQty=sum(m.released,x=>x.quantity),pendingQty=sum(m.pending,'pending_qty');
 const planQty=ap.planQty==null||ap.planQty===''?null:Math.max(0,N(ap.planQty));
 const volFactor=planQty!==null&&standardQty>0?planQty/standardQty:1;
 const ref=m.budget??m.total;
 const safePct=(v)=>Math.max(0,Math.min(100,N(v)))/100;
 const buffer=1+safePct(ap.fxBuffer);
 const shutdownFactor=Math.max(0,12-Math.min(12,N(ap.shutdownMonths)))/12;
 const procurementBase=(ref*volFactor+N(ap.validationQty)*(m.total/Math.max(1,sum(m.po,'ordered_qty'))))
   *(1+S.assumptions.volume/100)*(1+S.assumptions.price/100)*shutdownFactor*(1-safePct(ap.batchDiscount));
 const base=procurementBase*(1+safePct(ap.logistics))*buffer;
 // Inventory policy is a separate cash requirement; it is not booked as purchased goods.
 const targetInventoryDays=Math.max(1,N(ap.maxInventoryDays)),coverDays=Number(window.PharmaLifecycleV23?.model?.(m.d)?.coverDays)||null;
 const safetyBuffer=sum(m.released,'amount')*Math.max(0,N(ap.safetyFactor)-1);
 const coverageCap=coverDays?m.lotsValue*Math.max(0,coverDays-targetInventoryDays)/coverDays:0;
 const a=Math.max(0,base+safetyBuffer-coverageCap);
 const apiShare=m.total?sum(m.byMat.filter(x=>String(x.category).toUpperCase().includes('API')),'spend')/m.total:0;
 const b=a*(1+apiShare*Math.max(0,N(ap.priceRise))/100);
 const c=Math.max(0,a*(1-apiShare*Math.max(0,N(ap.dualSourceReserve))/100*Math.max(0,N(ap.secondSourceDiscount))/100));
 const leadDays=m.po.filter(p=>p.created_date&&p.promised_date).map(p=>(Date.parse(p.promised_date)-Date.parse(p.created_date))/86400000).filter(x=>Number.isFinite(x)&&x>=0);
 const weightedContractUnit=sum(m.po,'ordered_qty')?m.total/sum(m.po,'ordered_qty'):null;
 const byCategory=Object.values(m.byMat.reduce((o,r)=>{const k=r.category||'其他';const g=o[k]??={name:k,value:0,rows:[]};g.value+=r.spend;g.rows.push(r);return o},{})).sort((a,b)=>b.value-a.value);
 const monthRows=m.budgetAccuracyRows.map(row=>({period:row.period,budget:row.budget===null&&m.comparable&&m.budget!==null?m.budget/12:row.budget,actual:row.actual,po:row.po}));
 return {production,actualQty,standardQty,releasedQty,pendingQty,planQty,ref,a,b,c,base,buffer,leadDays,weightedContractUnit,apiShare,byCategory,monthRows,safetyBuffer,coverageCap,shutdownFactor};
}
const annualInput=(id,v,{unit='',type='number',placeholder='待录入',step='any',min='0'}={})=>`<input type="${type}" data-sp-annual="${H(id)}" value="${v==null?'':H(v)}" placeholder="${H(placeholder)}" step="${step}" ${type==='number'?`min="${min}"`:''} aria-label="${H(id)}"/><span class="sp-param-unit">${H(unit)}</span>`;
const annualValue=(n,unit='')=>n==null?'<span class="sp-missing">待录入</span>':`<strong>${f(n,unit==='%'?1:0)}${unit}</strong>`;
function annualParameterPanel(m,a){
 const p=S.annualParams;
 const field=(label,body,note='')=>`<div class="sp-param-row"><span>${H(label)}${note?`<sup title="${H(note)}">ⓘ</sup>`:''}</span><span class="sp-param-edit">${body}</span></div>`;
 const group=(icon,label,kind,rows)=>`<div class="sp-param-card ${kind}"><div class="sp-param-header"><span class="sp-param-icon">${icon}</span><b>${label}</b><span class="sp-param-chevron">⌄</span></div><div class="sp-param-rows">${rows.join('')}</div></div>`;
 return `<div class="sp-section-head"><h3>编制参数控制面板</h3><span>蓝色字段可编辑；未接入项不会自动写入 ERP</span></div><div class="sp-param-grid">
 ${group('▣','需求侧参数','blue',[
 field('年度生产计划',annualInput('planQty',p.planQty,{unit:'源单位',placeholder:'待录入'}),'源数据仅覆盖当前生产工单，不能代替下一年度计划'),
 field('验证批额外需求',annualInput('validationQty',p.validationQty,{unit:'源单位'})),
 field('工厂停产月份',annualInput('shutdownMonths',p.shutdownMonths,{unit:'/12月',step:'1'}),'没有工厂停产计划接入')])}
 ${group('▤','库存侧参数','orange',[
 field('安全库存系数',annualInput('safetyFactor',p.safetyFactor,{unit:'倍',step:'.1'})),
 field('效期最大库存限制',annualInput('maxInventoryDays',p.maxInventoryDays,{unit:'天',step:'1'}))])}
 ${group('♧','供应侧参数','blue',[
 field('供应商标准交期LT',a.leadDays.length?`<strong>${f(sum(a.leadDays.map(days=>({days})),'days')/a.leadDays.length,0)}天</strong>`:'<span class="sp-missing">未接入</span>','已登记 PO 下单至承诺日平均值'),
 field('最小起订量MOQ','<span class="sp-missing">未接入</span>','源台账没有统一可核验 MOQ'),
 field('批量采购折扣',annualInput('batchDiscount',p.batchDiscount,{unit:'%',step:'.1'}),'仅为演示假设')])}
 ${group('▧','价格侧参数','orange',[
 field('基准合同价',a.weightedContractUnit==null?'<span class="sp-missing">待录入</span>':`<strong>${f(a.weightedContractUnit,2)} USD/源单位</strong>`,'采购订单的加权均价，非合同批复价'),
 field('预计涨价幅度',annualInput('priceRise',p.priceRise,{unit:'%',step:'.5'})),
 field('物流关税成本',annualInput('logistics',p.logistics,{unit:'%',step:'.1'}))])}
 ${group('♢','风险侧参数','orange',[
 field('双源采购预留比例',annualInput('dualSourceReserve',p.dualSourceReserve,{unit:'%',step:'1'})),
 field('价格波动风险缓冲池',annualInput('fxBuffer',p.fxBuffer,{unit:'%',step:'.1'}))])}
 </div>`;
}
function annualFundsChart(m,a){
 const data=a.monthRows, W=755,Hh=270,L=57,R=20,T=44,B=45,iw=W-L-R,ih=Hh-T-B;
 const top=Math.max(1,...data.map(x=>x.budget||0),...data.map(x=>x.actual||0))*1.22;
 const Y=v=>T+ih-Math.max(0,N(v))/top*ih,barW=Math.max(19,iw/data.length*.45);
 const grid=[0,.25,.5,.75,1].map(k=>{const y=Y(top*k);return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#e3eaf0" stroke-dasharray="3 3"/><text x="${L-9}" y="${y+4}" fill="#96a8b5" text-anchor="end" font-size="11">${f(top*k)}</text>`}).join('');
 const bars=data.map((x,i)=>{const cx=L+(i+.5)*iw/data.length,barH=ih-Math.max(0,Y(x.budget??0)-T),y=Y(x.budget||0);
 return `<g class="sp-funds-bar" data-sp-open="budgetMonth:${x.period}" tabindex="0" role="button"><rect x="${cx-barW/2}" y="${y}" width="${barW}" height="${Math.max(1,T+ih-y)}" rx="3" fill="${x.actual===null?'#8abef2':'#318beb'}"><title>${H(x.period)} · 预算 ${x.budget===null?'待录入':usd(x.budget)} · 实际 ${x.actual===null?'无来源':usd(x.actual)}</title></rect><text x="${cx}" y="${Hh-16}" fill="#66849a" font-size="12" text-anchor="middle">${H(x.period.slice(5))}月</text></g>`}).join('');
 const labels=`<rect x="${W-206}" y="9" rx="7" width="188" height="23" fill="#e3f6ff"/><text x="${W-112}" y="25" text-anchor="middle" fill="#2b84ae" font-weight="700" font-size="12">停产月份：${N(S.annualParams.shutdownMonths)?f(S.annualParams.shutdownMonths)+'月（情景）':'未接入正式计划'}</text>`;
 return `<div class="sp-annual-funds-chart"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="2026 年逐月预算资金分布柱状图，点击查看 PO 来源">${grid}${bars}${labels}</svg><div class="sp-funds-note">蓝柱：月度预算情景；有来源的月份可展开实际 PO。尚未接入工厂正式停产与下一年度排产日历。</div></div>`;
}
function annualCategoryDonut(a){
 const list=a.byCategory.length?a.byCategory:[{name:'未接入品类',value:0,rows:[]}];const colors=['#3279df','#3dc2a8','#f7b266','#8da6d9','#9b94d1'];const total=sum(list,'value');let cum=0;
 const css=list.map((x,i)=>{const first=cum;cum+=total?x.value/total*100:0;return `${colors[i%colors.length]} ${f(first,3)}% ${f(cum,3)}%`}).join(',');
 return `<div class="sp-annual-donut-wrap"><div class="sp-annual-donut" title="品类占比来自当前真实 PO 采购金额" style="background:${total?`conic-gradient(${css})`:'#e0e9f3'}"><span>品类<br/>占比</span></div><div class="sp-annual-donut-key">${list.map((x,i)=>`<button data-sp-open="annualCategory:${encodeURIComponent(x.name)}"><i style="background:${colors[i%colors.length]}"></i><span>${H(x.name)}</span><strong>${total?f(x.value/total*100,1)+'%':'—'}</strong></button>`).join('')}</div></div>`;
}
function annualBudgetPanel(m){
 const a=annualBudgetNumbers(m),p=S.annualParams,poVal=m.total;
 const moduleKpi=(icon,label,val,delta,note)=>`<div class="sp-annual-kpi"><span class="sp-annual-kpi-icon">${icon}</span><span class="sp-annual-kpi-label">${label}</span><strong>${val}</strong>${delta?`<b>${delta}</b>`:''}<small>${H(note)}</small></div>`;
 const scenario=(tag,name,color,budget,second,foot,note,draw)=>`<button class="sp-scenario-v27 ${color}" data-sp-open="scenario:${tag}"><span class="sp-scen-head"><i>✥</i> 场景 ${tag}｜${name}</span><span class="sp-scen-line"><small>年度预算</small><strong>${usd(budget)}</strong></span><span class="sp-scen-line"><small>${H(foot)}</small><strong>${H(second)}</strong></span><span class="sp-scen-foot">◎ 核心假设：${H(note)}</span><span class="sp-scen-art" aria-hidden="true">${draw}</span></button>`;
 return `<section id="sp-annual" class="sp-annual sp-annual-v27">
 <div class="sp-annual-head sp-annual-header-v27"><div><h2>年度采购预算编制 <span>｜Annual Procurement Budget Planning</span></h2><p>基于需求预测、价格、库存、交期多因子预测全年采购资金预算</p></div><div class="sp-annual-actions">${link('▢ 保存版本','save')}${link('▧ 提交审批','approval','primary')}${link('▣ 导出预算报告','report','primary')}</div></div>
 <div class="sp-annual-topbar"><label>◴ 预算年度 <select data-sp-filter="budgetYear"><option value="2026">2026</option></select></label><label>◴ 预算版本 <select data-sp-filter="budgetVersion"><option value="V2.0修订版">V2.0修订版（本地情景）</option></select></label><label>▣ 编制范围 <select data-sp-filter="budgetScope"><option value="all" ${m.eng.category?'':'selected'}>全部品类</option><option value="API" ${m.eng.category==='API'?'selected':''}>API 原料</option></select></label><span>非正式财务审批 · 演示情景</span></div>
 <div class="sp-annual-kpis">
 ${moduleKpi('▧','上年度实际消耗量','待接入','',`本期实际耗用参考 ${f(a.actualQty)} 源单位`)}
 ${moduleKpi('▧','下年度生产计划量',a.planQty===null?'待录入':f(a.planQty)+' 源单位','',`当前工单标准量参考 ${f(a.standardQty)}`)}
 ${moduleKpi('▣','期初可用库存','待录入','',`当前 Released 参考 ${f(a.releasedQty)}`)}
 ${moduleKpi('▧','在途未到货量',f(a.pendingQty)+' 源单位','',`${m.pending.length} 条未收足 PO`)}
 </div>
 ${annualParameterPanel(m,a)}
 <div class="sp-section-head sp-scen-section"><h3>多场景测算对比</h3><span>所有金额为本地测算，非已批准预算</span></div>
 <div class="sp-scenario-row-v27">
 ${scenario('A','基准情景','blue',a.a,usd(a.a-(m.budget??a.a)),'现金流净值（情景差额）',`现有供应商、现有价格、正常交付；物流成本情景 ${f(p.logistics,1)}%`,'▥')}
 ${scenario('B',`涨价${f(p.priceRise,0)}%情景`,'orange',a.b,usd(a.b-a.a),'现金流净值（增量）',`关键 API 涨价 ${f(p.priceRise,1)}%、汇率波动缓冲 ${f(p.fxBuffer,1)}%（提示用）`,'♢')}
 ${scenario('C','二供落地情景','green',a.c,'待验证','断供风险降低',`引入第二供应商、价格谈判优化；模拟潜在节约 ${usd(a.a-a.c)}，风险降低比例待评估`,'▤')}
 </div>
 <div class="sp-annual-bottom-v27"><article class="sp-card sp-annual-money"><div class="sp-cardhead"><strong>月度预算资金分布</strong><span class="sp-help" title="根据月度本地预算情景绘制；无月度预算时使用全年演示参考均摊。">ⓘ</span></div><div class="sp-money-composite"><div>${annualFundsChart(m,a)}</div><aside><h4>品类预算占比</h4>${annualCategoryDonut(a)}</aside></div></article>
 <article class="sp-card sp-budget-description"><div class="sp-cardhead"><strong>预算编制说明</strong><span class="sp-help" title="所有假设与真实来源分开披露">ⓘ</span></div><div class="sp-budget-description-inner"><p><b>编制依据：</b>下年度生产计划（未接入，未录入时用本期标准量作情景代理）、当前合同/PO 价格、历史消耗趋势、供应商交期与库存政策</p><p><b>假设条件：</b>汇率波动控制在 ±${f(p.fxBuffer,1)}% 内，关键原材料供应稳定，停产计划不发生重大调整</p><p><b>风险提示：</b>若 API 价格上涨超过 ${f(p.priceRise,0)}%，年度预算预计增加约 <strong>${usd(a.b-a.a)}</strong>；此为情景测算，并非承诺成本</p><p class="sp-budget-note">数据边界：源 PO ${m.po.length} 行；当前预算属于 DEMO / Non-GxP 本地方案。正式生效须获得财务、采购和质量审批。</p><div class="sp-budget-final-actions">${link('↻ 锁定生效','approval','primary')}${link('▧ 对比上版预算','compareBudget')}</div></div></article></div>
 ${S.saved?`<div class="sp-save-note">${S.persisted?'预算版本已保存在本浏览器。':'当前浏览器限制持久化，仅保存于页面。'} 本地预算草稿不代表 ERP 或财务审批。</div>`:''}
 </section>`;
}
function mathFix(n){return Number.isFinite(n)?n:0}

function render(){const d=D(),m=model(d);if(!m){if(E()?.state&&!E().state.loading&&!E().state.data)setTimeout(()=>E().load(),0);return '<div class="sp-root sp-loading">正在读取统一采购数据…</div>'}
 const mats=m.d.master.materials||[],sups=m.d.master.suppliers||[],sites=m.d.master.sites||[],months=uniq(m.po0.map(x=>String(x.created_date||'').slice(0,7))).filter(Boolean).sort();
 const shared=E().state.filters||{},ref=m.budget;
 const status=ref===null?'预算数据未接入':'演示参考预算 · 非正式获批';
 const budgetDeviation=ref===null||!m.comparable?'—（筛选范围无独立预算）':usd(m.total-ref);
 const abcValue=m.abcGroups.map(r=>({label:r.label,value:r.value}));
 const expiryRows=m.expiry.slice().sort((a,b)=>N(a.days_to_control)-N(b.days_to_control));
 const staleRows=m.stale.slice().sort((a,b)=>N(b.age_days)-N(a.age_days));
 const good=m.ledger.filter(r=>N(r.realized_amount)>0);
 const ledgerMonthly=Object.values(m.ledger.reduce((o,r)=>{let period=String(r.start||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(period))return o;let v=o[period]||{period,planned:0,recorded:0,rows:[]};v.planned+=N(r.planned_amount);v.recorded+=N(r.realized_amount);v.rows.push(r);o[period]=v;return o},{})).sort((a,b)=>a.period.localeCompare(b.period));let runPlan=0,runRec=0;ledgerMonthly.forEach(x=>{runPlan+=x.planned;runRec+=x.recorded;x.planned=runPlan;x.recorded=runRec});
 const categories=m.materialInventory.map(r=>({id:r.id,name:r.id,category:r.category,abc:r.abc,po_amount:r.spend,purchase_share:r.purchaseShare,inventory_value:r.inventory,released_value:r.released,held_value:r.held,transit_value:r.transit,at_risk_value:r.stale+r.expiry,po_lines:r.orders.length}));
 return `<div class="sp-root">
 <div class="sp-head"><div><span class="sp-eyebrow">PURCHASING INTELLIGENCE / MODULE 03</span><h1>支出与品类策略 <span>Spend &amp; Category Intelligence</span></h1><p>采购支出、价格差异、库存资金与年度预算情景；与 Overview、01、02 和 Top30 共用采购数据。</p></div><div class="sp-head-actions">${link('↧ 支出报表','report')}${link('☷ 预算方案','jump:annual','primary')}</div></div>
 <div class="sp-filter-panel"><div class="sp-filter-title"><b>支出与品类策略</b><span>数据截至 ${H(m.asOf)} · 采购演示基线</span><button data-sp-act="reset">↻ 重置筛选</button></div><div class="sp-filters">
 <label>供应商<select data-sp-filter="supplier">${q('','全部供应商',shared.supplier||'')}${sups.map(x=>q(x.supplier_id,x.supplier_name||x.supplier_id,shared.supplier||'')).join('')}</select></label>
 <label>物料<select data-sp-filter="material">${q('','全部物料',shared.material||'')}${mats.map(x=>q(x.material_id,x.material_id+' · '+(x.name||''),shared.material||'')).join('')}</select></label>
 <label>品类<select data-sp-filter="category">${q('','全部品类',shared.category||'')}${uniq(mats.map(x=>x.category_group)).map(x=>q(x,x,shared.category||'')).join('')}</select></label>
 <label>供应商类别<select data-sp-filter="supplier_class">${q('','全部分类',shared.supplier_class||'')}${uniq(sups.map(x=>x.approved_status)).map(x=>q(x,x,shared.supplier_class||'')).join('')}</select></label>
 <label>月份<select data-sp-filter="month">${q('all','所有有来源月份',S.month)}${months.map(x=>q(x,x,S.month)).join('')}</select></label>
 <label>ABC 分类（本页）<select data-sp-filter="abc">${[['all','全部 ABC'],['A','A 类'],['B','B 类'],['C','C 类']].map(x=>q(...x,S.abc)).join('')}</select></label>
 </div></div>
 <div class="sp-tabs">${[['explore','Spend Explorer'],['ppv','Price & PPV'],['savings','库存优化降本'],['cash','库存资金与结构优化'],['budget','年度预算与现金流'],['annual','年度采购预算编制']].map(([v,t])=>`<button data-sp-act="jump:${v}" class="${S.tab===v?'active':''}">${H(t)}</button>`).join('')}</div>
 <section id="sp-explore" class="sp-section"><div class="sp-kpis">${card('期末批次库存估算金额',usd(m.lotsValue),'源于批次数量 × 关联 PO 单价','kpi:inventory')}${card('采购价差 PPV',pct(m.actualVariance,m.total),'价差金额 '+usd(m.actualVariance),'kpi:ppv')}${card('库存周转天数','未接入','正式期间平均库存与耗用成本不足','kpi:turnover')}${card('呆滞库存估算金额',usd(sum(m.stale,'amount')),'库龄超过 90 天的关联批次','kpi:stale')}${card('非放行库存估算金额',usd(sum(m.quarantined,'amount')),'待检、隔离等不计生产可用','kpi:held')}${card('临期 / 复验关注金额',usd(sum(m.expiry,'amount')),'批次效期或复验控制预警','kpi:expiry')}${card('年度库存持有成本','未接入','缺少仓储、资本与损耗成本参数','kpi:holding')}${card('预算准确率（模拟）',m.referenceAccuracy===null?'—':f(m.referenceAccuracy,1)+'%','PO 对演示参考预算偏差；非正式财务准确率','kpi:budget')}</div>
 <div class="sp-layout-a"><section class="sp-card">${title('月度库存资金估算趋势｜三类库存','按实际收货月份归集当前存量批次的估算金额，不是财务月末余额')}${spFundsChart(m)}</section>
 <section class="sp-card">${title('ABC 分类库存金额占比','ABC 按本期 PO 采购金额累计排序；金额为当前批次估算值')}${donut(abcValue)}<div class="sp-caption">点击 A/B/C 扇区或图例，下钻对应物料和批次。</div></section></div></section>
 <section id="sp-ppv" class="sp-grid2"><article class="sp-card">${title('呆滞金额分级条形图','库龄按照批次收货日期与 2026-11-01 演示截止日计算')}${bars(m.ageBins.map(x=>({id:x.label,label:x.label,value:sum(x.rows,'amount')})),'value','label','age')}</article><article class="sp-card">${title('采购差异原因拆分','现有数据仅支持价格价差与采购金额分布；数量/结构原因需要真实预算明细')}${spVarianceBar(m)}</article></section>
 <section id="sp-savings" class="sp-grid2"><article class="sp-card">${title('库存优化降本累计收益图','库存优化降本累计图 · 基于当前批次超额库存、临期关注和待检资金的机会测算，非已实现降本')}${spOptimizationChart(m)}</article><article class="sp-card">${title('滚动预算准确率复盘','逐月预算与实际 PO 采购对比；缺失月份和预算情景均有明显提示')}${spBudgetChart(m)}</article></section>
 <section class="sp-card sp-budget-review">${title('月度滚动预算复盘｜消耗数量与金额','工单标准耗用与实际耗用逐月对照；预算库存数量可以本地填写')}${spConsumptionTable(m)}</section>
 <section id="sp-cash" class="sp-card">${title('物料库存金额排行','当前已登记批次估算金额；点击可追溯关联 Lot/PO')}${dataTable([['物料编码','id'],['ABC','abc'],['品类','category'],['采购金额',r=>usd(r.po_amount)],['采购金额占比',r=>r.purchase_share===null?'—':f(r.purchase_share,1)+'%'],['可用库存',r=>usd(r.released_value)],['在检/隔离库存',r=>usd(r.held_value)],['在途库存',r=>usd(r.transit_value)],['库存合计',r=>usd(r.inventory_value)],['PO 行','po_lines']],categories,'material')}</section>
 <div class="sp-grid2"><section class="sp-card">${title('呆滞 / 临期批次处置明细','来源为 M02 原材料生命周期，点击可进入批次证据')}${dataTable([['Lot','lot_id'],['物料','material_id'],['状态','status'],['估算价值',r=>usd(r.amount)],['库龄天数','age_days'],['复验日期','retest_date'],['效期日期','expiry_date']],m.atRisk,'lot')}</section><section class="sp-card">${title('滚动预算准确率复盘表','按月份展示预算金额、实际 PO 采购金额与准确率；预算为用户可编辑模拟情景')}${spRollingBudgetTable(m)}</section></div>
 ${annualBudgetPanel(m)}
<footer class="sp-disclaimer">数据边界：DEMO / Non-GxP · PO 采购金额、批次、QC 与物料关联来自统一数据源；库存金额为估算，演示预算不能视为正式获批财务计划。未接入的财务月末余额/周转成本不填造数据。</footer>
 ${S.detail?drawer(m):''}</div>`;
}
function detailData(m,key){const [kind,id='']=key.split(':');if(kind==='kpi'){if(id==='inventory')return {title:'库存估值来源',rows:m.lotScope,route:'m06'};if(id==='ppv')return {title:'采购价格差异',rows:m.priceLines,route:'m05'};if(id==='stale')return {title:'呆滞库存批次',rows:m.stale,route:'m06'};if(id==='held')return {title:'未放行批次',rows:m.quarantined,route:'m06'};if(id==='expiry')return {title:'复验/效期预警批次',rows:m.expiry,route:'m06'};if(id==='budget')return {title:'预算准确率模拟参考 · 源 PO',rows:m.po,route:'m05'};return {title:'数据口径说明',rows:[],note:id==='turnover'?'正式周转天数需会计期初/期末平均库存与耗用成本；当前未提供':'库存持有成本需仓储、资金和质量处置成本参数；当前未接入'};}
 if(kind==='funds')return {title:'库存资金趋势 · '+id,rows:[...m.fundingTimeline.find(x=>x.period===id)?.rows||[],...m.pending.filter(x=>String(x.promised_date||'').slice(0,7)===id)],route:'m06'};
 if(kind==='variance')return {title:'采购与耗用差异来源 · '+id,rows:[...m.varianceMonths.find(x=>x.period===id)?.po||[],...m.varianceMonths.find(x=>x.period===id)?.production||[]],route:'m05'};
 if(kind==='optimize')return {title:'库存优化机会 · '+(m.optimizeStages[Number(id)-1]?.label||''),rows:m.optimizeStages[Number(id)-1]?.rows||[],route:'m06'};
 if(kind==='consumption')return {title:'工单标准与实际耗用 · '+id,rows:m.consumptionRows.find(x=>x.period===id)?.production||[],route:'m01'};
 if(kind==='monthly')return {title:'本月采购订单',rows:m.monthly.find(x=>x.period===id)?.rows||[],route:'m05'};
 if(kind==='arrival')return {title:'按入库月份归集的批次',rows:m.arrival.find(x=>x.period===id)?.rows||[],route:'m06'};
 if(kind==='abc')return {title:`${id} 类物料与批次`,rows:m.byMat.filter(x=>x.abc===id),route:'m06'};
 if(kind==='material')return {title:`物料 ${id} · 关联批次与 PO`,rows:[...m.lotScope.filter(x=>x.material_id===id),...m.po.filter(x=>x.material_id===id)],route:'m06'};
 if(kind==='ppv')return {title:'物料价格差异',rows:m.po.filter(x=>x.material_id===id),route:'m05'};
 if(kind==='age')return {title:'库龄区间 '+id,rows:m.ageBins.find(x=>x.label===id)?.rows||[],route:'m06'};
 if(kind==='annualCategory')return {title:'年度预算品类占比 · '+decodeURIComponent(id),rows:m.byMat.filter(r=>r.category===decodeURIComponent(id)),route:'m05'};
 if(kind==='scenario')return {title:'年度采购预算编制 · 场景 '+id,rows:m.po,route:'m05',note:'预算是根据演示 PO 与本地可编辑假设计算，不是正式获批预算。'};
 if(kind==='approval')return {title:'正式审批暂未接入',rows:[],note:'此演示站没有审批服务器或电子签名服务。请导出预算报告并在正式流程内审核，页面不会宣称审批成功。'};
 if(kind==='compareBudget')return {title:'本地预算版本对比',rows:S.savedVersions.slice(-8),note:S.savedVersions.length>1?'以下版本仅为本浏览器保存的演示预算草稿；正式对比应从 ERP 预算台账核验。':'尚不足两个本地预算版本可对比；请先保存多个版本。'};
 if(kind==='saving')return {title:'Savings 台账 · 登记月份 '+id,rows:m.ledger.filter(x=>String(x.start||'').slice(0,7)===id),route:'m02'};
 if(kind==='budgetMonth'||kind==='month')return {title:'月度采购与预算参考 · '+id,rows:m.po.filter(x=>String(x.created_date||'').slice(0,7)===id),route:'m05'};
 if(kind==='lot')return {title:'批次 '+id,rows:m.lotScope.filter(x=>x.lot_id===id),route:'m06'};
 return {title:'关联来源记录',rows:[]};
}
function drawer(m){let info=detailData(m,S.detail);let rows=info.rows||[];const allKeys=uniq(rows.flatMap(r=>Object.keys(r))).filter(k=>typeof rows[0]?.[k]!=='object').slice(0,12);return `<div class="sp-overlay" data-sp-act="close"><div class="sp-drawer" role="dialog" aria-modal="true" aria-label="${H(info.title)}"><header><h2>${H(info.title)}</h2><button data-sp-act="close">×</button></header><p>${H(info.note||`共 ${rows.length} 条来源记录；点击下方关联入口进入原业务页面。`)}</p>${rows.length?dataTable(allKeys.map(k=>[k,k]),rows,'none'):empty('此项尚无可核验的业务记录')}<div class="sp-drawer-actions">${link('导出本明细 CSV','exportDetail')}${info.route?link('进入来源业务页 ↗','goto:'+info.route,'primary'):''}</div></div></div>`}
function exportRows(name,rows){if(!rows.length){window.showToast?.('当前无记录可导出');return}const cols=uniq(rows.flatMap(x=>Object.keys(x)));const val=x=>'"'+String(x??'').replaceAll('"','""')+'"';const out='\ufeff'+[cols.join(','),...rows.map(r=>cols.map(k=>val(typeof r[k]==='object'?JSON.stringify(r[k]):r[k])).join(','))].join('\r\n');save(name,out,'text/csv;charset=utf-8')}
function save(filename,text,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000)}
function action(act){const m=model(D());if(!m)return;
 if(act==='close'){S.detail=null;window.render?.();return}
 if(act.startsWith('jump:')){S.tab=act.slice(5);window.render?.();const target=S.tab==='budget'?'annual':S.tab;document.getElementById('sp-'+target)?.scrollIntoView({behavior:'smooth',block:'start'});return}
 if(act==='reset'){E().state.filters={};S.abc='all';S.month='all';E().load();return}
 if(act.startsWith('goto:')){location.hash=act.slice(5);S.detail=null;return}
 if(act==='approval'||act==='compareBudget'){S.detail=act;window.render?.();return}
 if(act==='save'){
  S.saved=true;S.persisted=false;
  const a=annualBudgetNumbers(m),snapshot={version:S.budgetVersion,saved_at:new Date().toISOString(),base_budget:a.a,inflation_budget:a.b,dual_source_budget:a.c,reference_budget:m.budget,scope:m.eng.category||'全部品类'};
  S.savedVersions=[...S.savedVersions,snapshot].slice(-15);
  try{localStorage.setItem('pharma.v25.spend.scenario',JSON.stringify({budget:m.budget,...S.assumptions}));localStorage.setItem('pharma.v27.annual.params',JSON.stringify(S.annualParams));localStorage.setItem('pharma.v27.annual.versions',JSON.stringify(S.savedVersions));S.persisted=true}catch{}
  window.render?.();return
 }
 if(act==='report'){
  const a=annualBudgetNumbers(m);
  const th=(headers,rows)=>`<table><thead><tr>${headers.map(k=>`<th>${H(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${H(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const allRows=m.budgetAccuracyRows.map(x=>[x.period,x.budget==null?'待录入':usd(x.budget),x.actual==null?'无来源':usd(x.actual),x.accuracy==null?'未计算':f(x.accuracy,1)+'%']);
  const assumptionRows=Object.entries(S.annualParams).map(([key,val])=>[key,val==null?'未录入':String(val)]);
  const catRows=a.byCategory.map(x=>[x.name,usd(x.value),m.total?f(x.value/m.total*100,1)+'%':'—']);
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>03 支出与品类策略 · 年度采购预算报告</title><style>body{font:14px/1.55 Arial,'Microsoft Yahei',sans-serif;max-width:1150px;margin:32px auto;padding:20px;color:#254561}h1,h2{color:#164774}table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:24px}th,td{border:1px solid #d3e3ed;padding:9px;text-align:left}th{background:#e9f4ff}.note{padding:13px;background:#fff4e5;border-left:4px solid #e7a347}</style><h1>年度采购预算编制 | Annual Procurement Budget Planning</h1><p>03 支出与品类策略 · 数据截至 ${H(m.asOf)} · 本地预算方案</p><div class="note">演示数据 / Non-GxP：正式下年度排产计划、获批预算和企业审批流程未接入；此报告不能代替 ERP 或财务审批。</div><h2>采购来源概览</h2><p>${m.po.length} 条 PO；实际采购 ${usd(m.total)}；批次库存估值 ${usd(m.lotsValue)}。</p><h2>多场景测算对比</h2>${th(['情景','年度预算','相对基准差额'],[['A 基准情景',usd(a.a),'—'],['B API 涨价'+f(S.annualParams.priceRise,1)+'%',usd(a.b),usd(a.b-a.a)],['C 二供落地',usd(a.c),usd(a.a-a.c)+' 潜在节约']])}<h2>编制参数控制面板（本地假设）</h2>${th(['参数键','设置值'],assumptionRows)}<h2>月度预算资金分布与准确率</h2>${th(['月份','预算金额（模拟）','实际 PO','预算准确率'],allRows)}<h2>品类预算占比</h2>${th(['品类','采购金额','占比'],catRows)}<h2>预算编制说明</h2><p><b>编制依据：</b>生产工单标准耗用、PO 价格、供应商交期、库存与质量状态。</p><p><b>假设条件：</b>价格涨幅 ${f(S.annualParams.priceRise,1)}%，双源切换比例 ${f(S.annualParams.dualSourceReserve,1)}%，安全库存系数 ${f(S.annualParams.safetyFactor,1)} 倍。</p><p><b>风险提示：</b>目前没有正式下一年度生产计划/审批预算，情景 B 增加金额 ${usd(a.b-a.a)}；不属于确认成本。</p></html>`;
  save('Spend_Annual_Procurement_Budget_V27.html',html,'text/html;charset=utf-8');return;
 }
 if(act==='csvBudget'){exportRows('Spend_Budget_Monthly_V26.csv',m.budgetAccuracyRows.map(r=>({period:r.period,scenario_budget:r.budget,actual_po_spend:r.actual,reference_accuracy:r.accuracy,deviation:r.delta,basis:r.budgetKind})));return}
 if(act==='exportDetail'){exportRows('Spend_Source_Detail_V25.csv',detailData(m,S.detail).rows||[]);return}
}
function persistSpendMonths(){try{localStorage.setItem('pharma.v26.spend.months',JSON.stringify({budgetMonths:S.budgetMonths,openingPlan:S.openingPlan}))}catch{}}
function init(){document.addEventListener('click',e=>{if(!e.target.closest('.sp-root'))return;let el=e.target.closest('[data-sp-act]');if(el){e.preventDefault();if(el.classList.contains('sp-overlay')&&el!==e.target)return;action(el.dataset.spAct);return}el=e.target.closest('[data-sp-open]');if(el){e.preventDefault();S.detail=el.dataset.spOpen;window.render?.();return}});
 document.addEventListener('change',e=>{if(!e.target.closest('.sp-root'))return;let f=e.target.dataset.spFilter;if(f){if(f==='budgetScope'){E().state.filters.category=e.target.value==='all'?'':e.target.value;E().load();return}if(['supplier','material','category','supplier_class','month'].includes(f)){E().state.filters[f]=f==='month'&&e.target.value==='all'?'':e.target.value;S.month='all';E().load()}else{S[f]=e.target.value;S.detail=null;window.render?.()}return}if(e.target.dataset.spMonthBudget){let k=e.target.dataset.spMonthBudget;S.budgetMonths[k]=e.target.value;S.saved=false;persistSpendMonths();window.render?.();return}
 if(e.target.dataset.spOpenBudget){let k=e.target.dataset.spOpenBudget;S.openingPlan[k]=e.target.value;S.saved=false;persistSpendMonths();window.render?.();return}
 let ap=e.target.dataset.spAnnual;if(ap&&Object.hasOwn(S.annualParams,ap)){S.annualParams[ap]=e.target.value===''?null:Math.max(0,N(e.target.value));S.saved=false;try{localStorage.setItem('pharma.v27.annual.params',JSON.stringify(S.annualParams))}catch{}window.render?.();return}
 let inp=e.target.dataset.spInput;if(inp){let value=N(e.target.value);if(inp==='budget')S.localBudget=Math.max(0,value);else S.assumptions[inp]=value;S.saved=false;window.render?.()}});
 document.addEventListener('keydown',e=>{if(!e.target.closest('.sp-root'))return;if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-sp-open]')){e.preventDefault();e.target.click()}if(e.key==='Escape'&&S.detail){S.detail=null;window.render?.()}});
}
window.PharmaSpendV25={render,model,state:S,init,annualBudgetNumbers};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
