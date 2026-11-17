/* V2.2 · Product portfolio procurement strategy; source-only aggregation.
 * This view shares EnterpriseV08.state.data with the rest of the website.
 * Product-revenue/budget data are intentionally NOT inferred from purchase orders.
 */
(function(){'use strict';
const state={range:'top10',period:'year',risk:'all',market:'all',supplierClass:'all',selected:'',detail:null};
const X=()=>window.EnterpriseV08, DATA=()=>X()?.state?.data;
const n=x=>Number.isFinite(Number(x))?Number(x):0;
const sum=(a,f)=>a.reduce((t,r)=>t+n(typeof f==='function'?f(r):r[f]),0);
const esc=x=>String(x??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const fmt=(x,d=0)=>x==null?'—':Number(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const money=x=>x==null?'—':fmt(x)+' USD';
const pct=(a,b,d=1)=>b?fmt(a/b*100,d)+'%':'—';
const uniq=a=>[...new Set(a.filter(Boolean))];
const monthDiff=(a,b)=>{const x=new Date(a),y=new Date(b);return (x.getFullYear()-y.getFullYear())*12+x.getMonth()-y.getMonth()};
const safeISO=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''));
const riskOrder={HIGH:3,MEDIUM:2,LOW:1};
const status=x=>x==='HIGH'?'高风险':x==='MEDIUM'?'中风险':'低风险';
const severity=(x)=>`<span class="cp-badge ${String(x||'LOW').toLowerCase()}">${status(x)}</span>`;
const areaMarket={all:'全球',US:'美国',EU:'欧盟',CN:'中国',UK:'英国',JP:'日本',CA:'加拿大'};
const kinds={contract:['合同到期','orange'],doc:['受控文件到期','yellow'],audit:['GMP 审计','purple'],change:['变更评估','blue']};
function dateWithin(s,a,b){return safeISO(s)&&s>=a&&s<=b}
function keysOf(r){return [r.po_id,r.material_id,r.supplier_id,r.production_order,r.lot_id,r.change_id,r.contract_id,r.doc_id,r.audit_id,r.id].filter(Boolean)}
function makeModel(d){
  if(!d)return null;
  const asOf=d.meta?.as_of||'2026-11-01',year=asOf.slice(0,4),yrStart=year+'-01-01';
  const start=state.period==='rolling'?new Date(new Date(asOf+'T00:00:00Z').getTime()-365*864e5).toISOString().slice(0,10):yrStart;
  const productsAll=d.master.products||[], poAll=(d.purchasing.orders||[]).filter(p=>dateWithin(p.created_date||p.approved_date,start,asOf));
  const materials=d.master.materials||[], sCards=d.supplier.scorecards||[], docs=d.qualification.documents||[], sources=d.supplier.sources||[], lots=d.material.lots||[];
  const gaps=d.planning.gaps||[], prod=d.planning.production||[], changes=d.change.changes||[], audits=d.qualification.audits||[];
  const contracts=d.purchasing.contracts||[], quality=d.supplier.quality_events||[], tasks=d.actions.tasks||[];
  const supplierNames=Object.fromEntries((d.master.suppliers||[]).map(s=>[s.supplier_id,s.supplier_name]));
  const allSpends=productsAll.map(p=>({p,value:sum(poAll.filter(o=>o.material_id===p.material_id),'amount')})).sort((a,b)=>b.value-a.value||a.p.product_id.localeCompare(b.p.product_id));
  const limit=state.range==='top10'?10:state.range==='top30'?30:Infinity;
  const shortlist=allSpends.slice(0,limit).map(x=>x.p);
  const supplierTotals=new Map();for(const o of poAll)supplierTotals.set(o.supplier_id,(supplierTotals.get(o.supplier_id)||0)+n(o.amount));
  const classified=[...supplierTotals].sort((a,b)=>b[1]-a[1]);let run=0,total=sum(classified,x=>x[1]);const abcBySupplier={};classified.forEach(([id,val])=>{let before=total?run/total:0;abcBySupplier[id]=before<.8?'A':before<.95?'B':'C';run+=val});
  const visibleProducts=[];
  for(const p of shortlist){
    if(state.market!=='all'&&!(p.markets||[]).includes(state.market))continue;
    let orders=poAll.filter(o=>o.material_id===p.material_id);
    if(state.supplierClass!=='all')orders=orders.filter(o=>abcBySupplier[o.supplier_id]===state.supplierClass);
    if(!orders.length && state.supplierClass!=='all')continue;
    const relatedSupplierIds=uniq(orders.map(o=>o.supplier_id));
    const psources=sources.filter(x=>x.material_id===p.material_id),approved=uniq(psources.filter(s=>s.approved_for_use).map(x=>x.supplier_id));
    const pgaps=gaps.filter(g=>g.material_id===p.material_id),pchanges=changes.filter(c=>c.material_id===p.material_id&&c.status!=='Closed');
    const linkedDocs=docs.filter(z=>z.material_id===p.material_id),qualGaps=psources.filter(s=>!s.approved_for_use);
    const pscore=pgaps.some(g=>g.priority==='HIGH')||pchanges.some(c=>c.severity==='HIGH')||approved.length===0||linkedDocs.some(x=>x.days_to_expiry<0)?'HIGH':approved.length<=1||pgaps.length||qualGaps.length?'MEDIUM':'LOW';
    if(state.risk!=='all'&&pscore!==state.risk)continue;
    const amount=sum(orders,'amount'),count=orders.length,onTime=orders.filter(o=>n(o.delay_days)<=0).length;
    const pl=lots.filter(x=>x.material_id===p.material_id),prd=prod.filter(x=>x.material_id===p.material_id),qevents=quality.filter(x=>x.material_id===p.material_id),cs=contracts.filter(x=>x.material_id===p.material_id);
    const supplierNamesList=relatedSupplierIds.slice().sort((a,b)=>sum(orders.filter(x=>x.supplier_id===b),'amount')-sum(orders.filter(x=>x.supplier_id===a),'amount')).map(id=>supplierNames[id]||id);
    visibleProducts.push({id:p.product_id,product:p,material:p.material_id,orders,spend:amount,onTime,count,otd:count?onTime/count*100:null,sourceCount:approved.length,approved,relatedSupplierIds,supplierNamesList,risk:pscore,gaps:pgaps,changes:pchanges,documents:linkedDocs,lots:pl,production:prd,quality:qevents,contracts:cs,sources:psources});
  }
  visibleProducts.sort((a,b)=>b.spend-a.spend||a.id.localeCompare(b.id));
  const current=state.selected?visibleProducts.filter(p=>p.id===state.selected):visibleProducts;
  if(state.selected&&!current.length)state.selected='';
  const selectedProducts=state.selected&&current.length?current:visibleProducts;
  const mats=uniq(selectedProducts.map(p=>p.material)),supplierIds=uniq(selectedProducts.flatMap(p=>p.relatedSupplierIds));
  const allOrders=selectedProducts.flatMap(p=>p.orders),totalSpend=sum(allOrders,'amount'),otd=allOrders.length?100*allOrders.filter(x=>n(x.delay_days)<=0).length/allOrders.length:null;
  const selectedLots=lots.filter(x=>mats.includes(x.material_id)&&(!state.supplierClass||state.supplierClass==='all'||supplierIds.includes(x.supplier_id)));
  const selectedSources=sources.filter(x=>mats.includes(x.material_id)&&(!state.supplierClass||state.supplierClass==='all'||supplierIds.includes(x.supplier_id)));
  const selectedQuality=quality.filter(x=>mats.includes(x.material_id)&&(!state.supplierClass||state.supplierClass==='all'||supplierIds.includes(x.supplier_id)));
  const oneSource=selectedProducts.filter(p=>p.sourceCount===1);
  const noSource=selectedProducts.filter(p=>p.sourceCount===0);
  const affected=selectedProducts.filter(p=>p.gaps.length>0);
  const supRows=supplierIds.map(id=>{const o=allOrders.filter(x=>x.supplier_id===id),sc=sCards.find(x=>x.supplier_id===id),supplyMaterials=uniq(o.map(x=>x.material_id)),scs=selectedSources.filter(x=>x.supplier_id===id&&supplyMaterials.includes(x.material_id)),dcs=docs.filter(x=>x.supplier_id===id&&supplyMaterials.includes(x.material_id));const qe=selectedQuality.filter(x=>x.supplier_id===id);
    const valid=scs.some(x=>x.approved_for_use&&x.gmp_audit_status==='Passed'),pending=scs.some(x=>x.gmp_audit_status==='In review');
    const risk=(sc?.risk==='High'||dcs.some(x=>x.days_to_expiry<0)||scs.some(x=>x.risk==='HIGH')||!valid)?'HIGH':(qe.length||sc?.risk==='Medium')?'MEDIUM':'LOW';
    const riskScore=risk==='HIGH'?81:risk==='MEDIUM'?52:22;
    return {id,name:supplierNames[id]||id,orders:o,spend:sum(o,'amount'),otd:o.length?100*o.filter(x=>n(x.delay_days)<=0).length/o.length:null,qualityEvents:qe.length,qualification:valid?'gmp':pending?'review':'unknown',risk,riskScore,abc:abcBySupplier[id]||'—',scorecard:sc,sourceRows:scs,docs:dcs};
  });
  // Traceable milestones only: audited target dates, qualification documents and contract expiry.
  const addMonths=(str,n)=>{let d=new Date(str+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)};
  const end=addMonths(asOf,24), events=[];
  const addEvent=(p,type,date,title,row,route)=>{if(dateWithin(date,asOf,end))events.push({id:type+'-'+(row.doc_id||row.contract_id||row.audit_id||row.change_id),product:p.id,material:p.material,date,type,title,row,route,month:Math.max(0,monthDiff(date,asOf))})};
  for(const p of selectedProducts){
    p.documents.forEach(r=>addEvent(p,'doc',r.expiry,`${r.type} · ${r.supplier_id}`,r,'documents'));
    p.contracts.forEach(r=>{if(p.relatedSupplierIds.includes(r.supplier_id))addEvent(p,'contract',r.expiry,`合同到期 · ${r.supplier_id}`,r,'m05')});
    p.changes.forEach(r=>addEvent(p,'change',r.target_date,`变更评估 · ${r.change_id}`,r,'m09'));
    audits.filter(r=>p.relatedSupplierIds.includes(r.supplier_id)).forEach(r=>addEvent(p,'audit',r.planned,`GMP 审计 · ${r.supplier_id}`,r,'m04'));
  }
  events.sort((a,b)=>a.date.localeCompare(b.date));
  const perMaterial=selectedProducts.map(p=>({id:p.material,name:materials.find(m=>m.material_id===p.material)?.name||p.material,spend:p.spend,sourceCount:p.sourceCount,orders:p.orders})).sort((a,b)=>b.spend-a.spend);
  let cumulative=0;perMaterial.forEach(x=>{let before=totalSpend?cumulative/totalSpend:0;x.abc=before<.8?'A':before<.95?'B':'C';x.pct=totalSpend?x.spend/totalSpend*100:0;cumulative+=x.spend});
  const totalLots=sum(selectedLots,'amount'),atRiskLots=selectedLots.filter(x=>x.stale||x.expiring||x.days_to_control<=90||x.status!=='Released');
  const atRiskValue=sum(atRiskLots,'amount'),singleStock=sum(selectedLots.filter(l=>oneSource.some(p=>p.material===l.material_id)),'amount');
  const coverageRows=selectedProducts.map(p=>{const req=sum(p.production,'required_qty');const dates=p.production.map(r=>Date.parse(r.required_date)).filter(Number.isFinite);const windowDays=dates.length>1?Math.max(30,(Math.max(...dates)-Math.min(...dates))/86400000+1):30;const released=sum(p.lots.filter(x=>x.status==='Released'),'quantity');let cover=req?released/(req/windowDays):null;return {id:p.material,days:cover,required:req,released,standard:n(materials.find(m=>m.material_id===p.material)?.safety_days)||null};});
  const avgCover=coverageRows.filter(x=>x.days!==null).length?coverageRows.filter(x=>x.days!==null).reduce((a,x)=>a+x.days,0)/coverageRows.filter(x=>x.days!==null).length:null;
  const safetyCount=coverageRows.filter(x=>x.days!==null&&x.standard!==null),safeCount=safetyCount.filter(x=>x.days>=x.standard).length;
  // Actions are actual task records linked through PO, lot, material, supplier, production and document evidence.
  const allowedIds=new Set([...mats,...supplierIds,...allOrders.map(x=>x.po_id),...selectedLots.map(x=>x.lot_id),...prod.filter(x=>mats.includes(x.material_id)).map(x=>x.production_order),...docs.filter(x=>mats.includes(x.material_id)).map(x=>x.doc_id),...changes.filter(x=>mats.includes(x.material_id)).map(x=>x.change_id)]);
  const actionRows=tasks.filter(t=>(t.evidence||[]).some(id=>allowedIds.has(id))||mats.some(id=>String(t.title||'').includes(id))).map(t=>{let matches=selectedProducts.filter(p=>{let ids=new Set([p.material,...p.relatedSupplierIds,...p.orders.map(x=>x.po_id),...p.lots.map(x=>x.lot_id),...p.production.map(x=>x.production_order),...p.documents.map(x=>x.doc_id),...p.changes.map(x=>x.change_id)]);return (t.evidence||[]).some(id=>ids.has(id))});return {...t,productLines:matches.map(p=>p.id),relatedMaterials:matches.map(p=>p.material)}}).sort((a,b)=>(riskOrder[b.severity]||0)-(riskOrder[a.severity]||0));
  return {d,asOf,start,end,visibleProducts,selectedProducts,allOrders,spend:totalSpend,otd,oneSource,noSource,affected,selectedLots,selectedQuality,suppliers:supRows,events,materials:perMaterial,totalLots,atRiskLots,atRiskValue,singleStock,coverageRows,avgCover,safetyCount,safeCount,actionRows,abcBySupplier};
}
function option(value,label,current){return `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`}
function filter(name,title,options,selected){return `<label class="cp-filter">${esc(title)} <select data-cp-filter="${name}">${options.map(([value,label])=>option(value,label,selected)).join('')}</select></label>`}
function btn(txt,action,style=''){return `<button type="button" class="cp-btn ${style}" data-cp-action="${esc(action)}">${txt}</button>`}
function panel(title,inside,extra=''){return `<section class="cp-panel"><div class="cp-panel-h"><b>${title}</b>${extra?`<span>${extra}</span>`:''}</div>${inside}</section>`}
function chip(text,tone='blue'){return `<span class="cp-chip cp-${tone}">${esc(text)}</span>`}
function kpi(label,value,note,tone,kind,icon){return `<button class="cp-kpi" data-cp-open="${esc(kind)}"><span class="cp-kpi-title"><span class="cp-kpi-icon ${tone}">${icon}</span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></button>`}
function createData(m){const products=m.visibleProducts,prod=m.selectedProducts,all=prod.length;
  const countRisk=m.suppliers.filter(s=>s.risk==='HIGH').length;
  return `<div class="cp-kpi-grid">
  ${kpi('年度采购预算执行率','未接入','未提供经批准产品线预算','yellow','budget','▤')}
  ${kpi('累计采购金额',money(m.spend),`${m.allOrders.length} 条 PO · 与采购执行共享`,'blue','spend','▥')}
  ${kpi('整体交付 OTD',m.otd==null?'—':fmt(m.otd,1)+'%',`按 ${m.allOrders.length} 笔 PO 收货交期核算`,'green','otd','↗')}
  ${kpi('缺料风险产品线',fmt(m.affected.length)+' 条',`${all} 条当前范围产品线`,'red','shortage','⚠')}
  ${kpi('来料质量合格率','未接入','没有可验证的来料合格率分母','yellow','quality','✓')}
  ${kpi('质量异常批次',fmt(m.selectedQuality.length)+' 项','供应商质量事件；非批次合格率','orange','qualityEvents','▦')}
  ${kpi('单一批准来源物料',fmt(m.oneSource.length)+' 种',`另有 ${m.noSource.length} 种没有可核验批准来源`,'red','sole','⌁')}
  ${kpi('高风险供应商',fmt(countRisk)+' 家',`实际关联供应商 ${m.suppliers.length} 家`,'red','highSuppliers','⚑')}
  </div>`;
}
function productMatrix(m){const rows=m.visibleProducts;return `<div class="cp-tablewrap"><table class="cp-table cp-product-table"><thead><tr><th>产品线</th><th>营收等级</th><th>核心原料</th><th>主力供应商</th><th>第二批准来源</th><th>年度采购金额</th><th>预算执行率</th><th>综合风险</th></tr></thead><tbody>${rows.length?rows.map(p=>`<tr class="cp-product-row ${state.selected===p.id?'is-selected':''}" data-cp-select="${esc(p.id)}" tabindex="0" title="选择产品线，联动所有分析图表"><td><b>${esc(p.id)}</b></td><td><span class="cp-muted">未接入</span></td><td>${esc(p.material)}</td><td>${esc(p.supplierNamesList[0]||'无 PO 来源')}</td><td>${p.sourceCount>1?chip('有 · '+p.sourceCount,'green'):p.sourceCount===1?chip('暂无二供','orange'):chip('无可验证批准来源','red')}</td><td>${money(p.spend)}</td><td>—</td><td>${severity(p.risk)}</td></tr>`).join(''):`<tr><td colspan="8" class="cp-empt">当前条件没有可核验的产品线记录</td></tr>`}</tbody></table></div><div class="cp-panel-foot">当前数据仅有 ${m.visibleProducts.length} 条产品线；点击任一产品线可联动下方风险、库存与行动清单。营收贡献与预算尚未接入。</div>`}
function timeline(m){
 const bands=[0,3,6,9,12,18,24], months=['当前','3月','6月','9月','12月','18月','24月'];
 const phrases=['招标启动','合同到期','二供验证','Change Control','GMP审计','比价','价格重谈','证书临期','复评估','寻源启动','注册获批','新供应商导入'];
 const tone={contract:'orange',doc:'peach',audit:'purple',change:'blue'};
 const listed=m.selectedProducts.map((p,i)=>{const ev=m.events.filter(x=>x.product===p.id);return {p,ev};});
 return `<div class="cp-ref-calendar"><div class="cp-ref-calendar-top"><div class="cp-ref-calendar-brand">全球采购战略日历</div><div class="cp-ref-calendar-tabs"><span>干系</span><i></i><span>关注</span></div></div><div class="cp-cal-scroll"><div class="cp-ref-grid"><div class="cp-ref-head linehead">产品线</div><div class="cp-ref-head">原料</div>${months.map(t=>`<div class="cp-ref-head">${t}</div>`).join('')}${listed.map(({p,ev})=>`<div class="cp-ref-line">${esc(p.id)}</div><div class="cp-ref-code">${esc(p.material)}</div>${bands.map((b,i)=>{const lo=i===0?0:Math.floor((bands[i-1]+b)/2)+1,hi=i===bands.length-1?24:Math.floor((b+bands[i+1])/2);const group=ev.filter(x=>x.month>=lo&&x.month<=hi);const first=group[0];return `<div class="cp-ref-cell">${first?`<button type="button" data-cp-event="${esc(first.id)}" class="cp-ref-pill ${tone[first.type]||'blue'}" title="${esc(first.title)} · ${esc(first.date)} · 查看源记录">${esc(kinds[first.type]?.[0]||first.title)}${group.length>1?' +'+(group.length-1):''}</button>`:'<span class="cp-noevent" title="当前没有已记录节点">—</span>'}</div>`}).join('')}`).join('')||`<div class="cp-empty-calendar">当前没有可追溯的产品线</div>`}</div></div><div class="cp-ref-legend">${[['招标/寻源','blue'],['合同到期','orange'],['二供验证','green'],['GMP审计','purple'],['证书临期','peach'],['Change Control','plain']].map(([label,tone])=>`<span><i class="${tone}"></i>${label}</span>`).join('')}</div><div class="cp-reference-phrases"><b>参考图行动词条（未记录计划日期的不作为已安排事项）：</b>${phrases.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div><div class="cp-panel-foot">基准日期 ${esc(m.asOf)}；已排布 ${m.events.length} 条有效期内的合同、文件、GMP 审计和变更事件，点击节点查看来源。尚无 PO / 供应商开发计划，不虚构招标启动、二供验证、注册获批等计划日期。</div>`
}
function bubble(m){const suppliers=m.suppliers,max=Math.max(1,...suppliers.map(x=>x.spend));return `<div class="cp-bubble-wrap"><div class="cp-axis-label-y">供应风险 ↑</div><div class="cp-bubble-area"><div class="cp-grid-line left"></div><div class="cp-grid-line bottom"></div><span class="cp-quad q1">整改 / 开发替代</span><span class="cp-quad q2">重点监控</span><span class="cp-quad q3">简化管理</span><span class="cp-quad q4">保持合作</span>${suppliers.map(s=>{let size=14+Math.sqrt(s.spend/max)*24;let x=5+(s.otd==null?0:s.otd/100)*88,y=94-s.riskScore*.84;let tone=s.qualification==='gmp'?'green':s.qualification==='review'?'orange':'red';return `<button class="cp-bubble ${tone}" data-cp-open="supplier:${esc(s.id)}" style="left:${x}%;top:${y}%;width:${size}px;height:${size}px" title="${esc(s.name)} · ${fmt(s.otd,1)}% OTD · ${money(s.spend)} · ${status(s.risk)}"><span class="sr-only">${esc(s.name)}</span></button>`}).join('')}</div><div class="cp-axis-label-x">交付绩效 / OTD →</div></div><div class="cp-panel-foot">大小代表采购金额；纵向风险基于来源资质、文件、质量事件派生；颜色为 GMP 审核状态（绿=通过，橙=审核中，红=未确认），不是 GMP 正式批准。</div>`}
function stock(m){const data=[['平均库存覆盖天数',m.avgCover===null?'—':fmt(m.avgCover)+' 天','生产需求与 Released 数量估算'],['安全库存覆盖达标率',pct(m.safeCount,m.safetyCount.length),'按物料 safety_days 对比'],['临期 / 受控库存金额占比',pct(m.atRiskValue,m.totalLots),'使用模拟库存估值'],['单一批准来源库存估值',money(m.singleStock),'批次库存估值，非财务账面']];return `<div class="cp-stock-grid">${data.map(([name,val,sub])=>`<button data-cp-open="stock" class="cp-stock-stat"><span>${esc(name)}</span><strong>${esc(val)}</strong><small>${esc(sub)}</small></button>`).join('')}</div>`}
function spendRank(m){
 const rows=(m.materials||[]).filter(x=>n(x.spend)>0).slice(0,10);
 const allTotal=sum(m.materials||[],'spend');const aCount=(m.materials||[]).filter(x=>x.abc==='A').length;const aSpend=sum((m.materials||[]).filter(x=>x.abc==='A'),'spend');
 const max=Math.max(1,...rows.map(x=>n(x.spend)));const aShare=allTotal?aSpend/allTotal*100:0;
 return `<div class="cp-rank-ref"><div class="cp-rank-ref-note">${aCount} 种 A 类原料贡献 ${fmt(aShare,1)}% 采购额，为核心管控对象 · 依据当前筛选 PO 排名</div><div class="cp-rank-ref-list">${rows.length?rows.map(r=>{const share=allTotal?n(r.spend)/allTotal*100:0;const width=100*n(r.spend)/max;return `<button class="cp-rank-ref-row" data-cp-open="material:${esc(r.id)}"><div class="cp-rank-ref-name"><span>${esc(r.id)}</span><i class="cp-abc abc-${r.abc}">${r.abc}</i></div><div class="cp-rank-ref-bar"><i class="seg main abc-${r.abc}" style="width:${width.toFixed(2)}%"></i></div><div class="cp-rank-ref-value"><b>${money(r.spend)}</b><small>${fmt(share,1)}%</small></div><div class="cp-rank-ref-flag">${r.sourceCount>1?'有二供':r.sourceCount===1?'单一批准来源':'无批准来源'}</div></button>`}).join(''):'<div class="cp-empt">当前筛选范围无可核对采购金额</div>'}</div><div class="cp-rank-ref-side"><span class="a-dual">A 类｜重点</span><span class="a-single">B 类｜重要</span><span class="single">C 类｜常规</span></div></div>`;
}
function actionTable(m){
 return `<div class="cp-tablewrap cp-actions-ref"><table class="cp-table cp-actions-table ref"><thead><tr><th>优先级</th><th>产品线</th><th>对应原料/供应商</th><th>问题描述</th><th>战略行动建议</th><th>责任部门</th><th>计划完成时间</th><th>预期效果</th><th>状态</th></tr></thead><tbody>${m.actionRows.length?m.actionRows.map(t=>{const lev=t.severity==='HIGH'?'高':t.severity==='MEDIUM'?'中':'低';const mats=t.relatedMaterials.join('、')||'待关联';return `<tr data-cp-actionrow="${esc(t.id)}" tabindex="0" title="查看行动任务源记录"><td><span class="cp-priority-dot ${lev==='高'?'high':lev==='中'?'mid':'low'}"></span>${lev}</td><td>${esc(t.productLines.join('、')||'跨产品线')}</td><td>${esc(mats)}</td><td>${esc(t.title)}</td><td>${esc(t.strategy||'待人工评估')}</td><td>${esc(t.owner||'待分配')}</td><td>${esc(t.deadline||'待确认')}</td><td>${esc(t.expected_impact??'待量化')}</td><td>${esc(t.status||'待处理')}</td></tr>`}).join(''):'<tr><td colspan="9">当前筛选没有已关联的行动任务</td></tr>'}</tbody></table></div><div class="cp-reference-phrases cp-action-examples"><b>参考图战略行动建议文字（未连接真实任务的仅作为模板）：</b>${['启动第二供应商开发','供应商质量整改','资质复评估+价格谈判','调整补货策略','启动比价','断供风险降低70%','异常率下降50%','避免停供，年降本约80万','资金占用下降15%','年降本约60万'].map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="cp-panel-foot">点击任一任务行查看来源。状态、日期、预期收益只使用行动台账字段；参考图文字仅保留为模板，没有被记作已落实的行动或业绩。</div>`
}
function render(){const d=DATA();if(!d){if(X()?.state&&!X().state.loading)setTimeout(()=>X().load(),0);return `<div class="cp-root"><div class="cp-loading">正在从全站采购分析模型加载产品线战略数据…</div></div>`}const m=makeModel(d), markets=uniq((d.master.products||[]).flatMap(p=>p.markets||[]));
  return `<main class="cp-root">
   <header class="cp-hero"><div><h1>核心产品线采购战略 <span>Core Portfolio Procurement Strategy</span></h1><p>管理层战略聚焦 · 采购金额、交付绩效、供应风险与行动闭环 · Top30 为筛选上限（当前真实映射 ${d.master.products.length} 条产品线）</p></div><div class="cp-hero-actions">${btn('▤ 导出战略报告','report')}${btn('☑ 生成行动清单','actions','primary')}</div></header>
   <div class="cp-filters">${filter('range','产品线范围',[['top30','Top30'],['top10','Top10'],['all','全部有据产品线']],state.range)}${filter('period','时间范围',[['year','本年'],['rolling','滚动 12 个月']],state.period)}${filter('risk','风险等级',[['all','全部'],['HIGH','高风险'],['MEDIUM','中风险'],['LOW','低风险']],state.risk)}${filter('market','地区 / 市场',[['all','全球'],...markets.map(x=>[x,areaMarket[x]||x])],state.market)}${filter('supplierClass','供应商分类',[['all','全部'],['A','A · 金额主力'],['B','B · 次重点'],['C','C · 常规']],state.supplierClass)}${btn('↻ 重置筛选','reset','light')}</div>
   ${state.selected?`<div class="cp-scope">正在聚焦：<b>${esc(state.selected)}</b> · 所有分析卡片均按选中产品线过滤。 ${btn('清除产品线聚焦','clear-selection','light')}</div>`:''}
   ${createData(m)}
   <div class="cp-row cp-upper">${panel('Top30 产品线采购结构矩阵',productMatrix(m),`当前 ${m.visibleProducts.length} / ${d.master.products.length} 条可追溯产品线`)}${panel('全球采购战略日历 · 未来 24 个月',timeline(m),`${m.events.length} 条已记录节点`)}</div>
   <div class="cp-row cp-mid">${panel('供应商风险矩阵',bubble(m),`关联 ${m.suppliers.length} 家供应商`)}${panel('原料库存与消耗健康度',stock(m),'基于批次与生产需求')}${panel('Top10 原料采购金额排行｜ABC 分类',spendRank(m),'按当前范围采购金额')}</div>
   <div class="cp-row cp-actions-row">${panel('战略行动清单',actionTable(m),`${m.actionRows.length} 条源任务 · 点击可追溯`)}</div>
   <footer class="cp-footer">数据来源：原采购管理系统同一套 DEMO / Non-GxP 数据 · 基准日 ${esc(m.asOf)} · 采购金额单位：USD · 市场筛选只限定适用产品线，不代表市场级支出拆分；预算/营收/来料合格率未接入，不复制示例金额与未来计划。</footer>
   ${state.detail?drawer(state.detail):''}
   </main>`;
}
function rowsFor(type,m){const rows=(kind,id)=>{switch(kind){case 'budget':return {title:'年度批准预算缺失',rows:[],route:'m02',note:'预算执行率需要产品线、年度、预算版本和批准人，目前没有这些字段。'};
 case 'spend':return {title:'采购金额对应 PO',rows:m.allOrders,route:'m05'};
 case 'otd':return {title:'交付记录 / OTD 核对',rows:m.allOrders,route:'m07'};
 case 'shortage':return {title:'缺料风险产品线的生产需求',rows:m.selectedProducts.flatMap(p=>p.gaps),route:'m01'};
 case 'quality':return {title:'来料合格率尚未接入',rows:[],route:'m04',note:'缺少可用于同口径计算的已检/合格总批次。'};
 case 'qualityEvents':return {title:'供应商质量异常来源',rows:m.selectedQuality,route:'m04'};
 case 'sole':return {title:'批准供应来源关联',rows:m.selectedProducts.flatMap(p=>p.sources),route:'m04'};
 case 'highSuppliers':return {title:'高风险供应商 / 资质',rows:m.suppliers.filter(x=>x.risk==='HIGH').flatMap(x=>[x.scorecard||{supplier_id:x.id},...x.sourceRows]),route:'m07'};
 case 'stock':return {title:'批次库存与受控状态',rows:m.selectedLots,route:'m06'};
 case 'supplier':return {title:`供应商 ${id} · PO / 资质 / 文件`,rows:[...m.allOrders.filter(x=>x.supplier_id===id),...m.suppliers.find(x=>x.id===id)?.sourceRows||[],...m.suppliers.find(x=>x.id===id)?.docs||[]],route:'m07',supplier:id};
 case 'material':return {title:`物料 ${id} · PO / 批次库存`,rows:[...m.allOrders.filter(x=>x.material_id===id),...m.selectedLots.filter(x=>x.material_id===id)],route:'m06',material:id};
 default:return {title:'当前范围来源明细',rows:m.allOrders,route:'m02'};}};
 const [kind,...parts]=type.split(':');return rows(kind,parts.join(':'))}
function open(type){const d=DATA();if(!d)return;const m=makeModel(d);if(type.startsWith('event:')){const item=m.events.find(e=>e.id===type.slice(6));if(!item)return;state.detail={title:item.title+' · '+item.date,rows:[item.row],route:item.route,material:item.material};}else if(type.startsWith('action:')){const task=m.actionRows.find(t=>t.id===type.slice(7));if(!task)return;state.detail={title:task.title,rows:[task],route:'m10',material:task.relatedMaterials[0]};}else state.detail=rowsFor(type,m);if(state.selected && m.selectedProducts.length===1 && !state.detail.material)state.detail.material=m.selectedProducts[0].material;window.render?.()}
function drawer(detail){let rs=detail.rows||[];return `<div class="cp-drawer-overlay" data-cp-action="close"></div><aside class="cp-drawer" role="dialog" aria-modal="true"><div class="cp-drawer-head"><div><h2>${esc(detail.title)}</h2><p>${rs.length} 条来源记录 · 当前产品线筛选</p></div>${btn('✕','close','light')}</div><div class="cp-drawer-body">${detail.note?`<p class="cp-no-source">${esc(detail.note)}</p>`:''}${rs.length?rs.slice(0,80).map((r,i)=>`<details class="cp-evidence" ${i===0?'open':''}><summary>${esc(r.po_id||r.doc_id||r.contract_id||r.supplier_id||r.change_id||r.audit_id||r.production_order||r.id||'记录 '+(i+1))}</summary><dl>${Object.entries(r).filter(([key])=>!key.startsWith('_')).map(([key,v])=>`<div><dt>${esc(key)}</dt><dd>${esc(typeof v==='object'?JSON.stringify(v):v)}</dd></div>`).join('')}</dl></details>`).join(''):'<div class="cp-empt">没有能核验的源记录，因此不展示演示数字。</div>'}</div><footer>${btn('↓ 下载来源 CSV','evidence-csv')}${btn('打开对应业务页 →','jump','primary')}</footer></aside>`}
function download(name,txt,mime){const blob=new Blob([txt],{type:mime||'text/csv;charset=utf-8'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2500)}
function csv(rows){if(!rows?.length)return '\ufeff暂无来源记录\r\n';const keys=uniq(rows.flatMap(r=>Object.keys(r||{})));const f=x=>'"'+String(x==null?'':typeof x==='object'?JSON.stringify(x):x).replaceAll('"','""')+'"';return '\ufeff'+[keys.map(f).join(','),...rows.map(r=>keys.map(k=>f(r[k])).join(','))].join('\r\n')}
function report(m){let html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>核心产品线采购战略报告</title><style>body{font:14px/1.5 Arial,'Microsoft YaHei',sans-serif;color:#153767;padding:34px}h1{border-bottom:3px solid #2179d9;padding-bottom:12px}table{border-collapse:collapse;width:100%;margin-bottom:22px}td,th{border:1px solid #d2def3;padding:8px;font-size:12px}th{background:#eaf3ff}small{color:#6b7e9d}</style><h1>核心产品线采购战略 · 来源报告</h1><small>演示数据 · ${esc(m.asOf)} · 当前 ${m.selectedProducts.length} 条产品线 · ${fmt(m.spend)} USD 采购金额</small><h2>产品线采购结构</h2><table><tr><th>产品线</th><th>物料</th><th>采购金额(USD)</th><th>OTD</th><th>批准供应商数</th><th>风险</th></tr>${m.selectedProducts.map(p=>`<tr><td>${esc(p.id)}</td><td>${esc(p.material)}</td><td>${fmt(p.spend)}</td><td>${p.otd==null?'—':fmt(p.otd,1)+'%'}</td><td>${p.sourceCount}</td><td>${status(p.risk)}</td></tr>`).join('')}</table><h2>有来源的战略节点</h2><table><tr><th>产品线</th><th>日期</th><th>节点类型</th><th>来源</th></tr>${m.events.map(e=>`<tr><td>${esc(e.product)}</td><td>${e.date}</td><td>${esc(e.title)}</td><td>${esc(e.id)}</td></tr>`).join('')}</table><h2>风险行动</h2><table><tr><th>行动</th><th>责任部门</th><th>完成时间</th><th>当前状态</th></tr>${m.actionRows.map(t=>`<tr><td>${esc(t.title)}</td><td>${esc(t.owner)}</td><td>${esc(t.deadline||'待确认')}</td><td>${esc(t.status)}</td></tr>`).join('')}</table><p>注：未提供批准年度预算、产品营收贡献及正式来料合格率；本页不以采购额推断这些指标，也不把不存在的未来寻源节点当作已规划计划。</p></html>`;download('portfolio_strategy_report.html',html,'text/html;charset=utf-8')}
function action(name){let d=DATA();if(!d)return;let m=makeModel(d);if(name==='reset'){state.range='top30';state.period='year';state.risk='all';state.market='all';state.supplierClass='all';state.selected='';state.detail=null;X().state.filters={};X().load();return}if(name==='clear-selection'){state.selected='';state.detail=null;window.render?.();return}if(name==='close'){state.detail=null;window.render?.();return}if(name==='report'){report(m);return}if(name==='actions'){download('portfolio_strategy_actions.csv',csv(m.actionRows));return}if(name==='evidence-csv'){download('portfolio_strategy_evidence.csv',csv(state.detail?.rows||[]));return}if(name==='jump'){const o=state.detail||{},target=o.route||'m02';state.detail=null;if(o.material)X().state.filters.material=o.material;if(o.supplier)X().state.filters.supplier=o.supplier;window.location.hash=target;X().load();return}}
function init(){document.addEventListener('click',event=>{if(!event.target.closest('.cp-root'))return;let el=event.target.closest('[data-cp-action]');if(el){event.preventDefault();action(el.dataset.cpAction);return}el=event.target.closest('[data-cp-select]');if(el){state.selected=state.selected===el.dataset.cpSelect?'':el.dataset.cpSelect;window.render?.();return}el=event.target.closest('[data-cp-event]');if(el){open('event:'+el.dataset.cpEvent);return}el=event.target.closest('[data-cp-actionrow]');if(el){open('action:'+el.dataset.cpActionrow);return}el=event.target.closest('[data-cp-open]');if(el){open(el.dataset.cpOpen);return}});document.addEventListener('keydown',ev=>{const el=ev.target.closest('.cp-root [data-cp-select],.cp-root [data-cp-actionrow]');if(el&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();el.click()}});document.addEventListener('change',ev=>{if(!ev.target.closest('.cp-root'))return;let key=ev.target.dataset.cpFilter;if(!key)return;state[key]=ev.target.value;state.selected='';state.detail=null;window.render?.()})}
window.PharmaPortfolio={render,makeModel,state,init,downloadCsv:csv};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
