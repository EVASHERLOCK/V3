/* Pharma Procurement AI V2.9.14 — Cost Baseline & Target Cost Management.
 * Source-aware, Top10-first UI. Formal source facts remain separate from
 * scenario expansion candidates. Scenario rows are deterministic and clearly
 * labelled; they never overwrite ERP/PO/QMS records.
 */
(()=>{'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=x=>Number(x)||0, F=(x,d=0)=>x==null||!Number.isFinite(+x)?'—':new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(+x);
const DEFAULT={year:'2026',category:'all',material:'API-001',supplier:'all',project:'all'};
const TYPES={API:'原料药 API',Intermediate:'关键中间体',Excipient:'药用辅料',Solvent:'工艺溶剂',Biomaterial:'生物工艺原料',Natural:'天然/发酵原料',Reagent:'试剂/催化剂'};
const S={raw:null,loading:false,error:'',filters:{...DEFAULT},detail:null,scenario:{}};
try{S.filters={...DEFAULT,...JSON.parse(sessionStorage.getItem('pharma.v296.cost.filters')||'{}')};S.scenario=JSON.parse(sessionStorage.getItem('pharma.v296.cost.scenario')||'{}')}catch{}
const catalog=()=>window.PharmaSourcingUniverse?.catalog||[];
const uniq=a=>[...new Set(a.filter(Boolean))];
const sum=(a,f)=>a.reduce((s,x)=>s+N(typeof f==='function'?f(x):x[f]),0);
const round=x=>Math.round(N(x)*100)/100;
const hash=str=>{str=String(str||'');let h=0;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;return h||1};
const save=()=>{try{sessionStorage.setItem('pharma.v296.cost.filters',JSON.stringify(S.filters));sessionStorage.setItem('pharma.v296.cost.scenario',JSON.stringify(S.scenario));}catch{}}
const monthKey=x=>String(x||'').slice(0,7);
function materialDefaults(material, baseline, latest, materialName){
  // There is no approved R&D BOM in the bundled demo. Use the PO weighted
  // benchmark as an explicit DEMO PROXY, never a regulatory/engineering fact.
  const target=baseline!=null?round(baseline):latest!=null?round(latest):round(105+hash(material)%40);
  const parts=[
    {key:'raw',label:'原材料',value:round(target*0.15),pct:15},
    {key:'processing',label:'加工费',value:round(target*0.075),pct:7.5},
    {key:'registration',label:'注册合规成本',value:round(target*0.038),pct:3.8},
    {key:'logistics',label:'物流',value:round(target*0.025),pct:2.5},
    {key:'management',label:'管理成本',value:round(target*0.019),pct:1.9}
  ];
  return {name:materialName||material,target,parts,origin:baseline!=null?'PO_BENCHMARK_DEMO_PROXY':'ILLUSTRATIVE_SCENARIO'};
}
function getCandidates(raw,filters,baseline){
  const material=filters.material==='all'?null:filters.material;
  const category=filters.category;
  const catalogRows=catalog().filter(r=>(!material||r.material_id===material)&&(category==='all'||r.material_category===category));
  // Preserve a quoted supplier when its catalog primary material is different.
  const names=raw.master?.suppliers||[];
  const quoteRows=(raw.sourcing?.quotes||[]).filter(q=>(!material||q.material_id===material)&&(!filters.supplier||filters.supplier==='all'||filters.supplier===q.supplier_id));
  for(const q of quoteRows){if(catalogRows.some(r=>r.supplier_id===q.supplier_id&&(!material||r.material_id===q.material_id)))continue;
    const c=catalog().find(r=>r.supplier_id===q.supplier_id),master=names.find(r=>r.supplier_id===q.supplier_id);
    if(category!=='all'&&c?.material_category!==category)continue;
    catalogRows.push({...c,supplier_id:q.supplier_id,supplier_name:master?.supplier_name||c?.supplier_name||q.supplier_id,material_id:q.material_id,is_scenario:!master,data_origin:master?'BASE_DEMO':'LOCAL_UPLOAD',country:master?.country||c?.country||'待核验'});
  }
  const scoped=catalogRows.filter(r=>filters.supplier==='all'||r.supplier_id===filters.supplier);
  return scoped.map(r=>{
    const q=(raw.sourcing?.quotes||[]).find(x=>x.supplier_id===r.supplier_id&&x.material_id===(material||r.material_id));
    const h=hash(r.supplier_id+'|'+(material||r.material_id)), moq=q?N(q.moq):800+(h%9)*100;
    const unit=q?round(N(q.unit_price)*N(q.fx_to_usd||1)):round((baseline||118)*(0.88+(h%27)/100)+((h >>> 3)%5));
    const freight=q?N(q.freight_usd):1800+(h%7)*420,lead=q?N(q.lead_days):32+(h%31);
    // Compare one unit of ordered quantity and never understate the MOQ burden.
    const denominator=Math.max(1000,moq);
    const landed=round((unit*denominator+freight)/1000);
    const quality=78+(h%18),delivery=74+((h >>> 2)%23),commercial=76+((h >>> 5)%20),risk=38+((h >>> 7)%37);
    const rating=round(quality*.3+delivery*.22+commercial*.18+(100-risk)*.18+Math.max(0,Math.min(100,120-landed))*.12);
    return {supplier_id:r.supplier_id,supplier_name:r.supplier_name,material_id:material||r.material_id,country:r.country,data_origin:r.data_origin,is_scenario:!!r.is_scenario,price_origin:q?'V08_DEMO_QUOTE':'GENERATED_DEMO_ONLY',unit,freight,moq,lead,landed,quality,delivery,commercial,risk,rating,qualification:r.is_scenario?'情景候选 · 未准入':'原站DEMO · 须核验',quote:q||null};
  }).sort((a,b)=>a.landed-b.landed||b.rating-a.rating||a.supplier_id.localeCompare(b.supplier_id));
}
function build(raw, filters={}, scenario={}){
  const f={...DEFAULT,...filters};
  const allPO=raw.purchasing?.orders||[], allQuotes=raw.sourcing?.quotes||[], allContracts=raw.purchasing?.contracts||[], allSavings=raw.spend?.ledger||[];
  const materials=raw.master?.materials||[], supplierRows=raw.master?.suppliers||[];
  const materialCategory=new Map([...materials.map(x=>[x.material_id,x.category_group]),...catalog().map(x=>[x.material_id,x.material_category])]);
  const material=f.material==='all'?null:f.material;
  const inScope=(row,dateKey='created_date')=>(!material||row.material_id===material)&&(f.category==='all'||materialCategory.get(row.material_id)===f.category)&&(f.supplier==='all'||row.supplier_id===f.supplier)&&(f.project==='all'||(raw.master?.products||[]).some(p=>p.product_id===f.project&&p.material_id===row.material_id))&&(f.year==='all'||String(row[dateKey]||'').startsWith(f.year));
  const po=allPO.filter(x=>inScope(x));
  const quote=allQuotes.filter(x=>(!material||x.material_id===material)&&(f.supplier==='all'||x.supplier_id===f.supplier)&&(f.category==='all'||materialCategory.get(x.material_id)===f.category));
  const contracts=allContracts.filter(x=>(!material||x.material_id===material)&&(f.supplier==='all'||x.supplier_id===f.supplier));
  const savings=allSavings.filter(x=>(!material||x.material_id===material)&&(f.supplier==='all'||x.supplier_id===f.supplier));
  const qty=sum(po,'ordered_qty'), spend=sum(po,'amount');
  const benchmarkNumerator=po.reduce((s,x)=>s+N(x.benchmark_price)*N(x.ordered_qty),0);
  const baseline=qty?benchmarkNumerator/qty:null;
  const purchase=qty?spend/qty:null;
  const monthsMap=new Map();
  for(const r of po){const m=monthKey(r.created_date);if(!m)continue;const o=monthsMap.get(m)||{month:m,qty:0,spend:0,bench:0,orders:[]};o.qty+=N(r.ordered_qty);o.spend+=N(r.amount);o.bench+=N(r.benchmark_price)*N(r.ordered_qty);o.orders.push(r);monthsMap.set(m,o)}
  const months=[...monthsMap.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(r=>({...r,unit:r.qty?r.spend/r.qty:null,baseline:r.qty?r.bench/r.qty:null}));
  const latest=months.at(-1)?.unit??null;
  const candidates=getCandidates(raw,f,baseline||purchase||118);
  const topSuppliers=candidates.slice(0,10);
  const bestQuote=topSuppliers[0]?.landed??latest??baseline??null;
  const bom=materialDefaults(material||'ALL',baseline,purchase||latest,materials.find(x=>x.material_id===material)?.name||material||'全部物料');
  const target=scenario?.target??bom.target;
  const parts=(scenario?.parts&&scenario.parts.length?scenario.parts:bom.parts).map(p=>({...p,amount:round(p.value??p.amount??0)}));
  const subtotal=parts.reduce((s,x)=>s+x.amount,0);
  const profit=round((bestQuote??0)-(target-subtotal));
  const finalParts=[...parts,{key:'profit',label:'利润',value:profit,pct:round(target?profit/target*100:0)}];
  const waterfall={materialLabel:bom.name,target:round(target),supplierQuote:round(bestQuote),parts:finalParts,finalPct:round(target?bestQuote/target*100:0),origin:bom.origin,reconciled:round(target-subtotal+profit)};
  const targetVsQuote=candidates.map((r,i)=>({...r,rank:i+1,gap:round(r.landed-target),gapPct:round(target?(r.landed-target)/target*100:0)}));
  const supplierCount=candidates.length;
  const formalCount=candidates.filter(x=>!x.is_scenario).length;
  const baseLineHistory=months.map((x,i)=>({month:x.month,baseline:round(x.baseline),成交价:round(x.unit),价差:round((x.unit||0)-(x.baseline||0)),供应商数:uniq(x.orders.map(o=>o.supplier_id)).length}));
  const realized=sum(savings.filter(x=>/signed-off/i.test(String(x.finance_approval||''))),'realized_amount');
  const savingsLedger=[
    {title:'替代材料',savingPct:-6.0,desc:'评估替代供应商的等效原料（杂质谱一致），满足注册与质量要求；同步进行 RA 影响评估与变更控制。',status:'建议待小试验证',owner:'研发 / QA / RA',evidence:'建议筛选 Top 3 开展杂质谱、方法学和小试验证；暂无实际样品签收证据'},
    {title:'工艺优化',savingPct:-3.5,desc:'优化合成路线与精制工艺，降低加工费与溶剂消耗；引入中试批次验证、杂质清除与收率提升跟踪。',status:'建议待工艺评估',owner:'工艺 / 生产 / QC',evidence:'建议设计 3 条技术路径和 DoE 对比；当前无正式工艺评估数据'},
    {title:'长期框架',savingPct:-4.0,desc:'与核心供应商签订 2–3 年框架，锁定价格与产能，获取批量折扣、季度返利和优先排产。',status:'建议待商务评审',owner:'采购 / 法务',evidence:`候选目录 Top 5 情景比价 · 最低落地参考 ${F(bestQuote,2)} USD/kg（未审批）`},
    {title:'物流拼箱与港口优化',savingPct:-1.8,desc:'通过发运窗口协同、拼箱和港口切换，降低国际运输和清关波动。',status:'建议待批准',owner:'供应链 / 物流',evidence:'建议覆盖高运费供应商，节省金额需以实际运费及年量测算'},
    {title:'付款条款与汇率策略',savingPct:-1.2,desc:'优化账期、结算币种与套保窗口，减少财务成本和汇率侵蚀。',status:'建议待财务复核',owner:'采购 / 财务',evidence:'建议使用财务核定结算币种与账期作为取数依据'}
  ];
  const opportunityRows=candidates.map((c,i)=>({
    ...c,prioritySavings:round(Math.max(0,target-c.landed)),priorityPct:round(target?Math.max(0,target-c.landed)/target*100:0),
    suggestedAction:c.lead>52?'先核验交期和产能，再评估第二来源':'优先索取可核验报价、CoA、质量协议及现场审计计划',
    status:c.quote?'原站DEMO报价 · 待资格复核':'演示测算 · 待正式询价'
  })).sort((a,b)=>b.prioritySavings-a.prioritySavings||b.rating-a.rating);
  const varianceRows=[...new Set(po.map(x=>x.supplier_id))].map(id=>{const ps=po.filter(x=>x.supplier_id===id),qty=sum(ps,'ordered_qty'),spend=sum(ps,'amount'),base=ps.reduce((z,x)=>z+N(x.benchmark_price)*N(x.ordered_qty),0);
    return {supplier_id:id,supplier_name:raw.master?.suppliers?.find(x=>x.supplier_id===id)?.supplier_name||id,poCount:ps.length,spend,qty,unit:qty?spend/qty:null,benchmark:qty?base/qty:null,variance:spend-base};
  }).sort((a,b)=>Math.abs(b.variance)-Math.abs(a.variance));
  const targetAchieve=target>0?round(Math.max(0,100-Math.max(0,(bestQuote-target)/target*100))):null;
  const review={target,bestQuote,targetAchieve,targetGapPct:round(target?(bestQuote-target)/target*100:0),realized:round(realized),formalCount,supplierCount,
    highVariance:po.filter(x=>N(x.unit_price)>N(x.benchmark_price)).length,bestSupplier:topSuppliers[0]?.supplier_name||'—'};
  return {raw,filters:f,po,quote,contracts,savings,months,baseline,purchase,latest,target,qty,spend,materialName:(materials.find(x=>x.material_id===material)?.name)||material||'全部物料',allMaterials:uniq([...materials.map(x=>x.material_id),...catalog().map(x=>x.material_id)]),materialCategory,topSuppliers,candidates,targetVsQuote,waterfall,baseLineHistory,savingsLedger,opportunityRows,varianceRows,review,realized,hasFormalBOM:false};
}
function tip(t){return `<button class="cb-help" type="button" data-cb-help="${E(t)}" aria-label="查看${E(t)}说明">?</button>`}
function option(v,n,current){return `<option value="${E(v)}" ${String(v)===String(current)?'selected':''}>${E(n)}</option>`}
function top10Table(rows, headers, rowFn, cls=''){
  const top=rows.slice(0,10), rest=rows.slice(10);
  return `<div class="cb-table-wrap ${cls}"><table class="cb-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${top.map(rowFn).join('')}</tbody></table>${rest.length?`<details class="cb-more"><summary>展开其余 ${rest.length} 条记录（Top10 之外）</summary><table class="cb-table"><tbody>${rest.map(rowFn).join('')}</tbody></table></details>`:''}</div>`;
}
function workflow(){
  const steps=[['需求定义','研发提出目标成本、产量与关键质量属性'],['BOM 建模','形成 BOM 目标价与成本拆解口径'],['寻源比价','统一比较 Top10 供应商报价 / MOQ / 交期 / 风险'],['谈判定点','锁定目标成本、合同条款和交付策略'],['执行监控','跟踪 PO、价差、降本与复盘闭环']];
  return `<div class="cb-workflow-row">${steps.map((s,i)=>`<div class="cb-step"><b>${i+1}. ${E(s[0])}</b><span>${E(s[1])}</span></div>`).join('<div class="cb-arrow">→</div>')}</div>`;
}
function waterfallSvg(m){
  const w=940,h=310,l=66,r=20,t=24,b=88;const chartW=w-l-r;const chartH=h-t-b;const wf=m.waterfall;
  const bars=[{label:'研发BOM\n目标价',type:'start',amount:wf.target,display:wf.target},...wf.parts.slice(0,5).map(x=>({label:x.label.replace('注册合规成本','注册\n合规成本'),type:'down',amount:x.value,display:-x.value})),{label:wf.parts[5].value<0?'利润调整（负）':'利润',type:wf.parts[5].value<0?'down':'up',amount:Math.abs(wf.parts[5].value),display:wf.parts[5].value},{label:'供应商报价\n（最优）',type:'end',amount:wf.supplierQuote,display:wf.supplierQuote}];
  let run=wf.target;const seq=[];for(let i=0;i<bars.length;i++){const b0=bars[i];if(b0.type==='start'){seq.push({...b0,from:0,to:wf.target});run=wf.target}else if(b0.type==='down'){const from=run,to=run-b0.amount;seq.push({...b0,from,to});run=to}else if(b0.type==='up'){const from=run,to=run+b0.amount;seq.push({...b0,from,to});run=to}else seq.push({...b0,from:0,to:wf.supplierQuote});}
  const max=Math.max(wf.target,wf.supplierQuote,...seq.map(x=>Math.max(x.from,x.to)),1)*1.16;const min=Math.min(0,...seq.map(x=>Math.min(x.from,x.to)))*.95;
  const y=v=>t+(max-v)/(max-min)*chartH;const col=chartW/8;const tick=Math.max(1,Math.ceil((max-min)/5/5)*5);const axis=Array.from({length:7},(_,i)=>i*tick).filter(v=>v>=min&&v<=max+2);
  return `<div class="cb-water-head"><div><b>示例物料：${E(wf.materialLabel)}</b> ｜ <span>研发BOM目标参考价（非正式BOM）： <strong>${F(wf.target,2)} USD/kg</strong></span></div></div><svg viewBox="0 0 ${w} ${h}" class="cb-svg">${axis.map(v=>`<g><line x1="${l}" y1="${y(v)}" x2="${w-r}" y2="${y(v)}" stroke="#e8eef8"/><text x="${l-12}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#5f7698">${v}</text></g>`).join('')}<text x="${l}" y="14" font-size="12" fill="#55739b">成本（USD/kg）</text>${seq.map((b0,i)=>{const x=l+i*col+col*0.14, bw=col*0.72;const top=y(Math.max(b0.from,b0.to)),bot=y(Math.min(b0.from,b0.to));const fill=b0.type==='start'||b0.type==='end'?'#2d8af4':b0.type==='down'?'#f6a5a7':'#68d680';const valColor=b0.type==='up'?'#2b9b4a':'#e24e5e';const connector=i<seq.length-1?`<line x1="${x+bw}" y1="${y(b0.to)}" x2="${x+col}" y2="${y(b0.to)}" stroke="#748cae" stroke-dasharray="4 4"/>`:'';const vtxt=(b0.type==='down'?'−':b0.type==='up'?'+':'')+F(Math.abs(b0.display),2);return `<g><rect x="${x}" y="${top}" width="${bw}" height="${Math.max(2,bot-top)}" rx="4" fill="${fill}" opacity="0.95"/><text x="${x+bw/2}" y="${top-8}" text-anchor="middle" font-size="12" font-weight="800" fill="${i===0||i===seq.length-1?'#203d74':valColor}">${vtxt}</text><text x="${x+bw/2}" y="${h-40}" text-anchor="middle" font-size="11" fill="#47678f">${b0.label.split('\n').map((t0,j)=>`<tspan x="${x+bw/2}" dy="${j?13:0}">${E(t0)}</tspan>`).join('')}</text>${connector}</g>`}).join('')}</svg><div class="cb-wf-grid"><div></div>${['研发BOM目标价','原材料','加工费','注册合规成本','物流','管理成本','利润','供应商报价（最优）'].map(h=>`<div class="head">${E(h)}</div>`).join('')}<div class="rowh">金额<br>(USD/kg)</div><div>${F(wf.target,2)}</div>${wf.parts.slice(0,5).map(x=>`<div class="neg">-${F(x.value,2)}</div>`).join('')}<div class="${wf.parts[5].value>=0?'pos':'neg'}">${wf.parts[5].value>=0?'+':''}${F(wf.parts[5].value,2)}</div><div>${F(wf.supplierQuote,2)}</div><div class="rowh">占比</div><div>100%</div>${wf.parts.slice(0,5).map(x=>`<div>${F(x.pct,1)}%</div>`).join('')}<div class="${wf.parts[5].value>=0?'pos':'neg'}">${F(wf.parts[5].pct,1)}%</div><div>${F(wf.finalPct,1)}%</div></div>`;
}
function quoteChart(m){
  const max=Math.max(...m.targetVsQuote.slice(0,10).map(x=>x.landed),m.target,1)*1.08;
  return `<div class="cb-target-legend"><span class="cb-target-sample"></span><b>橙色竖线＝研发 BOM 目标参考价（演示）</b><strong>${F(m.target,2)} USD/kg</strong><button type="button" data-cb-open="review:all">查看目标价计算依据</button></div><div class="cb-quote-chart">${m.targetVsQuote.slice(0,10).map(r=>`<div class="cb-bar-row"><div class="cb-bar-label"><b>${E(r.supplier_name)}</b><small>${E(r.is_scenario?'演示候选':'原站 DEMO')} · LT ${F(r.lead)}d</small></div><div class="cb-bar-box"><span class="target" title="研发 BOM 目标参考价（演示） ${F(m.target,2)} USD/kg" style="left:${m.target/max*100}%"></span><div class="bar ${r.gap<=0?'good':'bad'}" style="width:${r.landed/max*100}%"></div><em>${F(r.landed,2)} USD/kg</em></div></div>`).join('')}</div>`;
}
function historyChart(m){
  const rows=m.baseLineHistory;const max=Math.max(...rows.map(x=>Math.max(x.baseline||0,x['成交价']||0)),1)*1.08;const w=920,h=220,l=48,r=16,t=14,b=36;const chartW=w-l-r,chartH=h-t-b;const x=i=>l+(rows.length<=1?0:i*(chartW/(rows.length-1)));const y=v=>t+(max-v)/max*chartH;const poly=(k,color)=>`<polyline fill="none" stroke="${color}" stroke-width="3" points="${rows.map((r,i)=>`${x(i)},${y(r[k]||0)}`).join(' ')}"/>${rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r[k]||0)}" r="4" fill="${color}"/>`).join('')}`;
  return `<svg viewBox="0 0 ${w} ${h}" class="cb-svg small">${[0,.25,.5,.75,1].map(s=>`<g><line x1="${l}" y1="${t+chartH*s}" x2="${w-r}" y2="${t+chartH*s}" stroke="#e9eff8"/></g>`).join('')}${poly('baseline','#2477ea')}${poly('成交价','#34b276')}${rows.map((r,i)=>`<text x="${x(i)}" y="${h-10}" text-anchor="middle" font-size="10" fill="#5d789b">${r.month.slice(5)}</text>`).join('')}</svg><div class="cb-legend"><span><i class="b"></i>历史基线</span><span><i class="g"></i>成交单价</span></div>`;
}
function render(){
  const m=model();
  if(!m){if(!S.loading&&!S.error)load();return `<div class="cb-page"><div class="cb-empty">${E(S.error||'正在加载成本基线数据…')}</div></div>`}
  const years=uniq((m.raw.purchasing?.orders||[]).map(x=>String(x.created_date||'').slice(0,4)));
  const cats=uniq(catalog().map(x=>x.material_category));
  return `<div class="cb-page"><div class="cb-head"><div><h1>成本基线与目标成本管理</h1><p>所有图表遵循 Top10 优先展示规则；第 11 条及后续记录折叠显示。正式来源与演示候选严格区分。</p></div><div class="cb-actions"><button data-cb-action="formula-excel">↓ 下载带计算公式的 Excel (.xlsx)</button><button data-cb-action="export">↓ 导出页面报告</button></div></div><div class="cb-filters"><label><span>年度</span><select data-cb-filter="year">${[['all','全部年份'],...years.map(x=>[x,x])].map(([v,n])=>option(v,n,m.filters.year)).join('')}</select></label><label><span>物料类别</span><select data-cb-filter="category">${[['all','全部物料'],...cats.map(x=>[x,TYPES[x]||x])].map(([v,n])=>option(v,n,m.filters.category)).join('')}</select></label><label><span>物料 / 品名</span><select data-cb-filter="material">${[['all','全部物料'],...m.allMaterials.map(x=>[x,`${x} · ${m.raw.master?.materials?.find(y=>y.material_id===x)?.name||x}`])].map(([v,n])=>option(v,n,m.filters.material)).join('')}</select></label><label><span>供应商</span><select data-cb-filter="supplier">${[['all','全部供应商'],...uniq(catalog().map(x=>x.supplier_id)).map(id=>[id,catalog().find(x=>x.supplier_id===id)?.supplier_name||id])].map(([v,n])=>option(v,n,m.filters.supplier)).join('')}</select></label><label><span>适应症 / 项目</span><select data-cb-filter="project">${[['all','全部项目'],['DRUG-A','DRUG-A'],['DRUG-B','DRUG-B']].map(([v,n])=>option(v,n,m.filters.project)).join('')}</select></label><button data-cb-action="reset">重置</button></div><div class="cb-kpis"><div class="cb-kpi"><b>研发BOM目标参考价（演示）</b><strong>${F(m.target,2)}<small>USD/kg</small></strong><span>${E(m.waterfall.origin==='PO_BENCHMARK_DEMO_PROXY'?'V08 PO加权基准代理；非正式BOM':'无PO基准，使用情景目标；非正式BOM')}</span></div><div class="cb-kpi"><b>最优供应商报价</b><strong>${F(m.review.bestQuote,2)}<small>USD/kg</small></strong><span>${E(m.review.bestSupplier)} · Top1 落地报价</span></div><div class="cb-kpi"><b>统一候选供应商数</b><strong>${F(m.review.supplierCount)}</strong><span>正式来源 ${F(m.review.formalCount)} 家 / 其余为演示候选</span></div><div class="cb-kpi"><b>目标达成率</b><strong>${F(m.review.targetAchieve,1)}%</strong><span>低于目标视为100%达成；高于目标按超支比例扣减</span></div></div>${section('采购价格闭环流程','◎',workflow(),'full')}${section('BOM 成本拆解瀑布图','▥',`<p class="cb-note"><b>演示核算：</b>原站无批准研发BOM分项，当前以 PO 基准价/情景目标模拟六段拆解；最优候选价格不代表可下单报价。瀑布图按同一算式闭合，底部保留金额与占比。</p>${waterfallSvg(m)}<div class="cb-analysis">${bullet(['BOM 目标价以原料、加工、注册、物流、管理与利润六个分段形成统一口径。','当前页面直接展示 Top10 候选中最优落地价，并将第 11 名以后供应商折叠。','瀑布图使用统一物料模型；若切换物料，图表会同步重算。'])}</div>`,'full')}${section('目标成本 vs 供应商报价','◫',`<p class="cb-note">至少比较 5 家以上供应商，默认显示 Top10，从低到高比较落地单价、MOQ、交期和质量风险。</p>${quoteChart(m)}${top10Table(m.targetVsQuote,['排名','供应商','来源类型','落地单价 USD/kg','MOQ','交期','质量','交付','综合评分','与目标差距'],r=>`<tr data-cb-open="supplier:${E(r.supplier_id)}"><td>${r.rank}</td><td><b>${E(r.supplier_name)}</b><br><small>${E(r.country)}</small></td><td>${E(r.is_scenario?'演示候选':'原站 DEMO')}</td><td>${F(r.landed,2)}</td><td>${F(r.moq)}</td><td>${F(r.lead)} d</td><td>${F(r.quality)}</td><td>${F(r.delivery)}</td><td>${F(r.rating,1)}</td><td class="${r.gap<=0?'good':'bad'}">${r.gap>0?'+':''}${F(r.gap,2)}</td></tr>`)}${bullet([`当前物料共纳入 ${m.candidates.length} 家供应商候选；页面按 Top10 规则优先展示最关键的 10 家。`,`Top1 ${E(m.review.bestSupplier)} 落地情景价 ${F(m.review.bestQuote,2)} USD/kg，目标价差 ${F(m.review.targetGapPct,1)}%，达成率 ${F(m.review.targetAchieve,1)}%。`,`正式来源与演示候选均保留来源字段，避免将扩展情景误当作正式采购数据。`])}`,'full')}${section('物料历史价格基线与采购闭环','≋',`<div class="cb-two"><div>${historyChart(m)}</div><div class="cb-side-note"><h4>结论分析</h4>${bullet([`历史 PO 加权基线价 ${F(m.baseline,2)} USD/kg；最新成交价 ${F(m.latest,2)} USD/kg。`,`月度价差围绕基线波动，适合用于季度复盘和谈判锚点。`,`采购闭环分析必须同时联动 Top10 供应商对比、MOQ、交期、质量评分和风险暴露。`,`建议把高于基线且交期长的供应商纳入下一轮商务与替代寻源计划。`])}</div></div><p class="cb-note">历史价格只统计原站DEM0采购订单；扩展候选没有历史成交记录，不会伪造成历史曲线。</p>${top10Table(m.baseLineHistory,['月份','历史基线','成交单价','价差','供应商数'],r=>`<tr><td>${E(r.month)}</td><td>${F(r.baseline,2)}</td><td>${F(r['成交价'],2)}</td><td class="${r['价差']<=0?'good':'bad'}">${r['价差']>0?'+':''}${F(r['价差'],2)}</td><td>${F(r['供应商数'])}</td></tr>`)}<h4>当前同物料供应商报价/候选对比（非历史成交）</h4>${top10Table(m.candidates,['供应商','来源','落地价','MOQ','交期','风险提示'],r=>`<tr><td>${E(r.supplier_name)}</td><td>${E(r.price_origin==='V08_DEMO_QUOTE'?'原站DEMO报价':'情景测算')}</td><td>${F(r.landed,2)}</td><td>${F(r.moq)}</td><td>${F(r.lead)}天</td><td>${E(r.qualification)}</td></tr>`)} `,'full')}${section('降本机会台账','♙',`<p class="cb-note">此处 −6.0%、−3.5%、−4.0% 等是情景假设，而非已由报价算出的降本结果。点击每张机会卡可以看到假设、参与供应商、原始数字、计算过程；导出 .xlsx 后可在 Excel 公式栏复核。</p><div class="cb-op-grid">${m.savingsLedger.map((x,i)=>`<div class="cb-op-card"><div class="icon i${i%5}">${['⚗','⚙','▤','◈','¤'][i%5]}</div><div class="body"><div class="top"><b>${E(x.title)}</b><span class="save">情景降幅假设 ${x.savingPct.toFixed(1)}%（未验证）</span></div><p>${E(x.desc)}</p><small>进展：<strong>${E(x.status)}</strong> ｜ Owner：${E(x.owner)}</small><em>${E(x.evidence)}</em><button type="button" class="cb-formula-btn" data-cb-open="opportunity:${i}">查看假设、参与供应商、计算步骤及公式 →</button></div></div>`).join('')}</div>${top10Table(m.opportunityRows,['排名','供应商','来源','落地价','对目标潜在节省 USD/kg','潜在节省比例','交期','关键行动','状态'],(r,i)=>`<tr><td>${m.opportunityRows.indexOf(r)+1}</td><td>${E(r.supplier_name)}</td><td>${E(r.price_origin==='V08_DEMO_QUOTE'?'原站DEMO报价':'情景候选')}</td><td>${F(r.landed,2)}</td><td>${F(r.prioritySavings,2)}</td><td>${F(r.priorityPct,1)}%</td><td>${F(r.lead)}天</td><td>${E(r.suggestedAction)}</td><td>${E(r.status)}</td></tr>`)}${bullet([`替代材料、工艺优化、长期框架、物流优化和付款条款是本页面最重要的五类降本杠杆。`,`建议所有降本项目都绑定责任人、验证状态、目标金额和财务确认节拍。`,`若需要查看更多改进动作，应折叠展开第 11 条以后记录，不应压缩 Top10 关键结论。`])}`,'full')}${section('降本监控与复盘（达成率 / 偏差分析）','◔',`<div class="cb-audit-tools"><button type="button" data-cb-open="review:all">∑ 查看达成率、价差及采购明细计算链</button><button type="button" data-cb-action="formula-excel">↓ 导出全部计算公式 Excel</button></div><div class="cb-review-grid"><div><small>目标成本</small><strong>${F(m.review.target,2)} USD/kg</strong></div><div><small>最优报价</small><strong>${F(m.review.bestQuote,2)} USD/kg</strong></div><div><small>目标达成率</small><strong>${F(m.review.targetAchieve,1)}%</strong></div><div><small>已实现降本</small><strong>${F(m.review.realized,0)} USD</strong></div><div><small>偏差 PO 行数</small><strong>${F(m.review.highVariance)}</strong></div></div><h4>原站DEMO采购价差分解（按供应商）</h4>${top10Table(m.varianceRows,['供应商','订单数','实际支出 USD','加权基准 USD/kg','成交 USD/kg','价差 USD'],r=>`<tr><td>${E(r.supplier_name)}</td><td>${F(r.poCount)}</td><td>${F(r.spend,0)}</td><td>${F(r.benchmark,2)}</td><td>${F(r.unit,2)}</td><td class="${r.variance>0?'bad':'good'}">${F(r.variance,0)}</td></tr>`)}${bullet(['复盘时要同时看达成率、偏差来源、正式采购证据和演示候选补充线索，不能只看一个价格数字。','对超目标报价、长期未关闭的降本项目、以及正式供应商数量不足的物料，应列入下一轮重点治理清单。','该模块位于页面最下方，用于承接 BOM、报价、历史基线与机会台账的整体闭环。'])}`,'full')}</div>`;
}
function bullet(rows){return `<ul class="cb-bullets">${rows.map(x=>`<li>${E(x)}</li>`).join('')}</ul>`}
function section(title,icon,body,cls=''){return `<section class="cb-section ${cls}"><header><h2><i>${icon}</i>${E(title)}</h2>${tip(title)}</header><div class="cb-section-body">${body}</div></section>`}
function model(){return S.raw?build(S.raw,S.filters,S.scenario[S.filters.material]||{}):null}
async function load(){if(S.loading)return;S.loading=true;S.error='';try{S.raw=window.PharmaAISourcing?.model?.()?.raw||window.PharmaStrategicHub?.model?.()?.raw||null;if(!S.raw)S.raw=window.PharmaSourcingData?.load?await window.PharmaSourcingData.load():await(await fetch('/api/v08')).json()}catch(ex){S.error=String(ex?.message||ex)}finally{S.loading=false;if(location.hash==='#ss-cost')window.render?.()}}
function detail(key){
 const m=model();if(!m)return;
 const [kind,id]=String(key).split(':');let title='计算与来源追溯',rows=[],steps=[],note='原站 DEMO/Non-GxP · 正式证据与情景假设不得混用';
 const money=x=>F(x,2)+' USD/kg';
 if(kind==='supplier'){
  const r=m.targetVsQuote.find(x=>x.supplier_id===id);
  title=`供应商报价计算 · ${r?.supplier_name||id}`;
  if(r){const purchaseQty=Math.max(1000,Number(r.moq));steps=[
    `报价来源：${r.price_origin==='V08_DEMO_QUOTE'?'原站 V08 DEMO RFQ':'情景生成报价，未取得供应商正式文件'}`,
    `标准比价数量：1000 kg；MOQ：${F(r.moq)} kg；实际需要采购量 = MAX(1000, ${F(r.moq)}) = ${F(purchaseQty)} kg`,
    `USD 换算单价：${money(r.unit)}，运费：${F(r.freight,2)} USD`,
    `落地单位成本 = (换算单价 × MAX(1000,MOQ) + 运费) / 1000 = (${F(r.unit,2)} × ${F(purchaseQty)} + ${F(r.freight,2)}) / 1000 = ${money(r.landed)}`,
    `参考 BOM 目标价：${money(m.target)}；价差 = ${F(r.landed,2)} - ${F(m.target,2)} = ${F(r.gap,2)} USD/kg`,
    `综合分 = 质量×30% + 交付×22% + 商务×18% + (100−风险)×18% + 价格分×12%。原站 DEMO 评分/情景评分均非 GMP 准入判定。`
   ];rows=[{供应商:r.supplier_name,编号:r.supplier_id,来源:r.price_origin,单价_USD:r.unit,MOQ_kg:r.moq,运费_USD:r.freight,落地价:r.landed,BOM_目标价:m.target,价差:r.gap,质量分:r.quality,交付分:r.delivery,商务分:r.commercial,风险分:r.risk,综合分:r.rating,报价凭证:r.quote?'V08 DEMO 报价':'未取得正式报价'}];}
 }else if(kind==='opportunity'){
  const item=m.savingsLedger[Number(id)];if(!item)return;
  const r=item.savingPct/100, after=m.target*(1+r), save=m.target-after;
  title=`降本机会计算与证据 · ${item.title}`;
  note='此处的 '+item.savingPct.toFixed(1)+'% 是预设情景假设，不能从现有资料证明；须上传经核验的成本拆分、合同或样品验证后才能称为可实现降本。';
  steps=[`参考目标成本：${money(m.target)}；来源：${m.waterfall.origin==='PO_BENCHMARK_DEMO_PROXY'?'原站 V08 DEMO PO 的数量加权基准价':'缺乏 PO 时的演示情景假设'}`,
    `假设降幅：${item.savingPct.toFixed(1)}%；是假设输入，不是公式倒推得到。`,
    `情景新成本 = 参考成本 × (1 + 假设降幅) = ${F(m.target,2)} × (1 ${r>=0?'+':'−'} ${F(Math.abs(r)*100,1)}%) = ${money(after)}`,
    `潜在节省 = 参考成本 − 情景新成本 = ${F(m.target,2)} − ${F(after,2)} = ${money(save)}。未扣除验证/切换/停线的全部费用。`,
    `需要的证据：${item.evidence}`,`执行责任人：${item.owner}；进展：${item.status}。`,
    '请在 Excel 的「机会假设」表查看 C 列假设输入、D/E/F/G 列公式；在「报价比较」表核对参加比较的供应商数值。'];
  rows=m.targetVsQuote.slice(0,10).map((x,i)=>({排名:i+1,供应商:x.supplier_name,来源:x.price_origin,正式报价:x.quote?'V08演示报价':'无',单位落地价_USDkg:x.landed,MOQ_kg:x.moq,交期_天:x.lead,与目标价差:x.gap,资格:x.qualification}));
 }else if(kind==='review'){
  title='降本监控与复盘 · 完整计算依据';
  note='PO 原始台账只来自 V08 内置演示，来源可核查，但不代表生产系统的真实采购。';
  const baseAmount=m.po.reduce((n,o)=>n+Number(o.ordered_qty||0)*Number(o.benchmark_price||0),0);
  steps=[`PO 采购金额 = SUM(各订单金额) = ${F(m.spend,2)} USD；订单数量 = SUM(各订单数量) = ${F(m.qty)} kg`,
    `加权采购基准 = SUM(各订单数量 × 对应基准价) / SUM(采购数量) = ${F(baseAmount,2)} / ${F(m.qty)} = ${money(m.baseline)}`,
    `参考目标价 ${money(m.target)}；最优候选落地价 ${money(m.review.bestQuote)}（${m.review.bestSupplier}）。`,
    `目标价差率 = (最优候选落地价 − 目标成本) / 目标成本 × 100% = ${F(m.review.targetGapPct,2)}%`,
    `目标达成率 = MAX(0, 100 − MAX(0,目标价差率)) = ${F(m.review.targetAchieve,1)}%（此定义和一般“目标价÷报价”不同，必须按此口径理解）。`,
    `采购价差 = SUM(订单金额 − 订单数量×基准价) = ${F(m.varianceRows.reduce((n,v)=>n+v.variance,0),2)} USD。`,
    `已实现降本 ${F(m.realized)} USD：仅统计有财务批准标识的演示来源；情景假设 −6% 等不计入已实现金额。`];
  rows=m.po.map(o=>({PO编号:o.po_id,供应商:o.supplier_id,物料:o.material_id,日期:o.created_date,数量_kg:Number(o.ordered_qty),订单金额_USD:Number(o.amount),基准价_USDkg:Number(o.benchmark_price),基准金额_USD:Number(o.ordered_qty)*Number(o.benchmark_price),价差_USD:Number(o.amount)-Number(o.ordered_qty)*Number(o.benchmark_price)}));
 }
 S.detail={title,rows,note,steps};document.getElementById('cb-detail')?.remove();const keys=[...new Set(rows.flatMap(x=>Object.keys(x||{})))];const div=document.createElement('div');div.id='cb-detail';div.className='cb-modal-layer';
 div.innerHTML=`<div class="cb-modal" role="dialog" aria-modal="true" aria-label="计算依据"><header><h3>${E(title)}</h3><button data-cb-action="close-detail" aria-label="关闭">×</button></header><div class="cb-modal-scroll"><p class="cb-evidence-warning">${E(note)}</p>${steps.length?`<h4>计算过程（可核对）</h4><ol class="cb-calc-steps">${steps.map(s=>`<li>${E(s)}</li>`).join('')}</ol>`:''}<h4>参与计算的明细（${rows.length} 条）</h4>${rows.length?`<div class="cb-table-wrap"><table class="cb-table"><thead><tr>${keys.map(k=>`<th>${E(k)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,10).map(r=>`<tr>${keys.map(k=>`<td>${E(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length>10?`<details class="cb-more"><summary>展开其余 ${rows.length-10} 条</summary><table class="cb-table"><tbody>${rows.slice(10).map(r=>`<tr>${keys.map(k=>`<td>${E(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`:''}</div>`:'<div class="cb-empty">没有可追溯来源记录</div>'}</div><footer class="cb-audit-tools"><button data-cb-action="formula-excel">↓ 导出 Excel 公式工作簿（含全部明细）</button><button data-cb-action="close-detail">关闭</button></footer></div>`;document.body.append(div);
}
async function downloadFormulaExcel(){const m=model();if(!m)return;const params=new URLSearchParams({material:m.filters.material,year:m.filters.year});try{
 const r=await fetch('/api/formulas/cost.xlsx?'+params,{cache:'no-store'});
 if(!r.ok||!String(r.headers.get('content-type')||'').includes('spreadsheetml.sheet'))throw Error('带公式的Excel仅支持完整Node服务：请使用 npm run dev，当前预览不能导出有效 .xlsx。');
 const b=await r.blob();if(!b.size)throw Error('服务器返回的工作簿为空');const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download='Pharma_Cost_Formula_Trace_'+m.filters.material+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800);
 }catch(err){window.alert?.(String(err.message||err))}}
function csv(rows){if(!rows.length)return '\ufeff当前无数据';const keys=[...new Set(rows.flatMap(x=>Object.keys(x)))];return '\ufeff'+[keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n')}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function exportReport(){const m=model();if(!m)return;const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>成本基线与目标成本管理 V2.9.14</title><style>body{font:14px/1.6 Arial,'Microsoft YaHei';color:#163c6a;margin:28px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd9ec;padding:8px}th{background:#edf4ff}</style><h1>成本基线与目标成本管理</h1><p>物料：${E(m.materialName)}；Top10 供应商优先显示，其余折叠。正式来源和演示候选严格区分。</p><h2>目标 vs 报价</h2><table><thead><tr><th>排名</th><th>供应商</th><th>来源</th><th>落地单价</th><th>MOQ</th><th>交期</th><th>评分</th></tr></thead><tbody>${m.targetVsQuote.map(x=>`<tr><td>${x.rank}</td><td>${E(x.supplier_name)}</td><td>${E(x.is_scenario?'演示候选':'原站 DEMO')}</td><td>${F(x.landed,2)}</td><td>${F(x.moq)}</td><td>${F(x.lead)}d</td><td>${F(x.rating,1)}</td></tr>`).join('')}</tbody></table></html>`;download('Cost_Baseline_Target_Cost_V296_V2914.html',html,'text/html;charset=utf-8')}
document.addEventListener('click',e=>{const t=e.target;if(t.closest('#cb-detail')){const act=t.closest('[data-cb-action]')?.dataset.cbAction;if(act==='close-detail'||t.id==='cb-detail'){document.getElementById('cb-detail')?.remove();return}if(act==='formula-excel')void downloadFormulaExcel();return}if(!t.closest('.cb-page'))return;const open=t.closest('[data-cb-open]');if(open){detail(open.dataset.cbOpen);return}const help=t.closest('[data-cb-help]');if(help){e.preventDefault();e.stopImmediatePropagation();window.PharmaGlobalHelp?.open?.(help.dataset.cbHelp,'module',help.closest('.cb-section,.cb-kpi,.cb-page'));return}const act=t.closest('[data-cb-action]')?.dataset.cbAction;if(act==='reset'){S.filters={...DEFAULT};save();window.render?.()}else if(act==='export'){exportReport()}else if(act==='formula-excel'){void downloadFormulaExcel()}},true);
document.addEventListener('change',e=>{const el=e.target.closest('.cb-page [data-cb-filter]');if(!el)return;S.filters[el.dataset.cbFilter]=el.value;save();try{sessionStorage.setItem('pharma.sourcing.shared.selection',JSON.stringify({material:S.filters.material,category:S.filters.category,region:'all'}))}catch{}if(location.hash==='#ss-cost')window.render?.()});
window.PharmaCostBaseline={build,render,load,hydrate:r=>{S.raw=r;S.error=''},model,setFilters:x=>{Object.assign(S.filters,x||{});save();if(location.hash==='#ss-cost')window.render?.()},filters:()=>({...S.filters}),report:exportReport,getState:()=>S};
})();
