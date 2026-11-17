/* Executive Procurement Overview · V0.6, browser view only.
   Figures are retrieved from the same deterministic PO/KPI sample engine as Module 10.
*/
const HOME={month:'all',supplier:'all',material:'all',requestId:0,data:null};
const eh=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(v,d=0)=>v==null?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});
const intMoney=v=>v==null?'—':nf(v,0);
const palette=['#476d80','#719c9c','#a5b6a4','#b8a68a','#91a6ba','#d0a588'];
function homeOverview(){return `<div class="exec-home" id="exec-home">
  <div class="exec-heading"><div><div class="exec-eyebrow">PHARMA PROCUREMENT / EXECUTIVE OVERVIEW</div>
  <h1>采购经营总览 <small>Executive Procurement Overview</small></h1>
  <p>快速识别支出集中、交付偏差与采购风险，从经营指标直接进入专项分析。</p></div>
  <div class="exec-controls"><button class="exec-softbtn" data-home="reload">${icon('refresh',15)} 刷新样例数据</button><button class="exec-mainbtn" data-nav="m10">进入 KPI 决策驾驶舱 ${icon('arrow',14)}</button></div></div>
  <div class="exec-demo"><div><span class="exec-data-dot"></span> 演示数据 · 同源 PO / QC / Production <span class="exec-dot-sep">·</span> 非 GxP 系统</div><span>计算结果可下钻，缺失的预算和 Savings 不进行虚构</span></div>
  <section class="exec-filters" aria-label="经营总览筛选"><div class="exec-filter-title">业务范围 <span>Business scope</span></div>
   <label>采购月份<select id="exec-month"><option value="all">所有样例月份</option></select></label>
   <label>供应商<select id="exec-supplier"><option value="all">全部供应商</option></select></label>
   <label>物料<select id="exec-material"><option value="all">全部物料</option></select></label>
   <button class="exec-reset" data-home="reset">重置筛选</button></section>
  <div id="exec-results" class="exec-loading"><span class="exec-spin"></span> 正在读取经营样例与计算指标…</div>
</div>`}
function homeBars(items,{key='value',name='name',desc='',action='m02',color=false}={}){
 const mx=Math.max(1,...items.map(x=>x[key]||0));
 return items.length?items.map((r,i)=>`<button class="exec-barrow" data-nav="${action}" title="查看相关业务模块"><span class="exec-bar-name" title="${eh(r[name])}">${eh(r[name])}</span><span class="exec-track"><span class="exec-fill" style="width:${Math.max(.5,(r[key]||0)/mx*100)}%;background:${color?palette[i%palette.length]:'#789ca2'}"></span></span><strong>${intMoney(r[key])}</strong></button>`).join(''):`<p class="exec-empty">筛选范围无相应数据</p>`
}
function homeSpark(items,width=500,height=175){
 const max=Math.max(1,...items.map(x=>x.spend)),l=42,r=width-16,top=15,bottom=height-35,bar=(r-l)/Math.max(1,items.length);
 return `<svg class="exec-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="按周采购金额柱状趋势"><line x1="${l}" x2="${r}" y1="${bottom}" y2="${bottom}" stroke="#d9e1e0"/>${[0,.5,1].map(t=>`<line x1="${l}" x2="${r}" y1="${bottom-(bottom-top)*t}" y2="${bottom-(bottom-top)*t}" stroke="#edf0ef"/> <text x="${l-8}" y="${bottom-(bottom-top)*t+4}" font-size="9" text-anchor="end" fill="#87969a">${Math.round(max*t/1000)}k</text>`).join('')}${items.map((p,i)=>{const x=l+i*bar+bar*.18,w=bar*.64,h=(p.spend/max)*(bottom-top);return `<rect x="${x}" y="${bottom-h}" width="${w}" height="${h}" fill="${i===items.length-1?'#436c77':'#9cb3b4'}" rx="3"><title>${eh(p.week)} : ${intMoney(p.spend)}</title></rect><text x="${l+i*bar+bar*.5}" y="${bottom+14}" text-anchor="middle" font-size="9" fill="#71818a">${p.week.slice(5)}</text>`}).join('')}</svg>`
}
function donut(items){let current=0;const conic=items.length?items.map((x,i)=>{let start=current;current+=x.share;return `${palette[i%palette.length]} ${start.toFixed(1)}% ${current.toFixed(1)}%`}).join(','):'#e5ecea 0 100%';
return `<div class="exec-donut-layout"><div class="exec-donut" style="background:conic-gradient(${conic})"><div class="exec-donut-hole"><small>物料</small><strong>${items.length}</strong><small>种</small></div></div><div class="exec-donut-legend">${items.map((x,i)=>`<div class="exec-legend-line"><span class="exec-color" style="background:${palette[i%palette.length]}"></span><span>${eh(x.name)}</span><strong>${nf(x.share,1)}%</strong></div>`).join('')}</div></div>`
}
function homeMetric(label,value,meta,tag,route='m10',type='neutral'){
return `<button class="exec-metric" data-nav="${route}" title="打开相关业务模块"><div class="exec-metric-top"><span>${label}</span><span class="exec-mini-arrow">↗</span></div><div class="exec-metric-number">${value}</div><div class="exec-metric-bottom"><span class="exec-metric-tag ${type}">${tag}</span><span>${meta}</span></div></button>`
}
function homePanel(label,sub,body,route,caption='查看详情'){
 return `<section class="exec-panel"><div class="exec-panel-header"><div><h3>${label}</h3><p>${sub}</p></div><button data-nav="${route}" class="exec-icon-go" aria-label="${caption}" title="${caption}">↗</button></div><div class="exec-panel-body">${body}</div></section>`
}
function renderExecutive(d){const k=d.kpis,scope=d.scope;const fullScope=d.filters.month==='all'&&d.filters.supplier==='all'&&d.filters.material==='all';
 const filterOptions=(id,data,active)=>{let s=document.getElementById(id);if(!s)return;const desc=s.options[0].text; s.innerHTML=`<option value="all">${eh(desc)}</option>`+data.map(x=>`<option value="${eh(x.id??x)}" ${String(x.id??x)===active?'selected':''}>${eh(x.name??x)}</option>`).join('')};
 filterOptions('exec-month',d.options.months,d.filters.month);filterOptions('exec-supplier',d.options.suppliers,d.filters.supplier);filterOptions('exec-material',d.options.materials,d.filters.material);
 const concentration=d.charts.suppliers.slice(0,3).reduce((s,x)=>s+x.share,0);
 const poRows=d.late_po.length?d.late_po.slice(0,4).map(x=>`<tr><td><strong>${eh(x.po_id)}</strong><small>${eh(x.material_id)}</small></td><td>${eh(x.supplier_id)}</td><td class="exec-risk-num">+${x.days_late} 天</td><td>${intMoney(x.amount)}</td></tr>`).join(''):`<tr><td colspan="4" class="exec-no-risk">当前筛选范围无逾期 PO</td></tr>`;
 const mainGap=d.insight?`<strong>${nf(d.insight.otd,1)}%</strong> 交货 OTD <span class="exec-split">/</span> <strong>${nf(d.insight.ready,1)}%</strong> 生产齐套率 <span class="exec-split">·</span> ${d.insight.affected} 条需求受影响`:`当前为部分 PO 筛选 · 交付指标已按范围重算，生产齐套率需要全数据关联`;
 const lateMix=d.charts.delivery,deliveryCount=lateMix.early+lateMix.ontime+lateMix.late||1;
 const colors=['#8db4ad','#567e8d','#c18378'];
 const delLegend=[['提前',lateMix.early],['准时',lateMix.ontime],['延迟',lateMix.late]].map(([label,n],i)=>`<span><i style="background:${colors[i]}"></i>${label} ${n}</span>`).join('');
 const latest=d.charts.weekly.slice(-8);
 const risks=d.price_risks.slice(0,3);
 return `<div class="exec-summary" role="status"><div><span class="exec-summary-level">${d.insight?'跨部门关注':'已筛选范围'} / ${d.insight?'供应保障差距':'采购经营视图'}</span><p>${mainGap}</p><small>${d.insight?eh(d.insight.note):'筛选不会错误地把不同分母的 KPI 混为同一个转化率。'}</small></div><button data-nav="m10">查看关联证据 ${icon('arrow',14)}</button></div>
 <div class="exec-section-title"><div><h2>经营关键指标</h2><p>Source-to-Pay · 采购主责优先，跨部门指标单独标明</p></div><span>PO 样本 ${scope.po_rows} 行 / 有效 OTD ${scope.valid_otd_rows} 行</span></div>
 <div class="exec-metrics">${homeMetric('采购金额 / Spend',intMoney(k.spend),`样例金额 · 币种未标明`,'采购经营','m02')}
 ${homeMetric('采购订单 / PO lines',nf(k.po_lines),`有效样例订单行`,'执行规模','m05')}
 ${homeMetric('活跃供应商 / Suppliers',nf(k.supplier_count),`本筛选范围有 PO 的供应商`,'供应结构','m07')}
 ${homeMetric('供应商交付 / OTD',k.otd==null?'—':`${nf(k.otd,1)}%`,`${k.otd_numerator}/${k.otd_denominator} PO 行`,'采购主责','m10',k.otd!=null&&k.otd<90?'bad':'good')}
 ${homeMetric('采购价差 / PPV',k.ppv==null?'—':`${k.ppv>0?'+':''}${nf(k.ppv,2)}%`,'与基准价比较 · 同币种假设','价格风险','m10',k.ppv>0?'warn':'good')}
 ${homeMetric('未关闭变更 / Changes',nf(k.open_changes),'全部样例变更，未随 PO 筛选','QA / RA 协同','m09',k.open_changes?'warn':'good')}</div>
 <div class="exec-section-title secondary"><div><h2>经营结构与趋势</h2><p>每张图表可跳转到对应的专业分析模块</p></div><span>${eh(d.period_note)}</span></div>
 <div class="exec-charts">
 ${homePanel('采购金额趋势','PO Created Date · 按周汇总（样例计价单位）',homeSpark(latest), 'm02','进入支出分析')}
 ${homePanel('物料支出结构','基于 Material ID · 当前样例均为 API',donut(d.charts.materials), 'm02','进入品类分析')}
 ${homePanel('供应商集中度','按采购金额，Top 10 候选集中度（已关联记录可能不足 10 家）· Top 3 占比 '+nf(concentration,1)+'%',homeBars(d.charts.suppliers,{action:'m07'}),'m07','进入供应商绩效')}
 ${homePanel('交付表现','到货日相对承诺交期 · PO 行口径',`<div class="exec-delivery-value"><strong>${k.otd==null?'—':nf(k.otd,1)+'%'}</strong><span>供应商交付 OTD<br/>目标参考 90%（演示阈值）</span></div><div class="exec-delivery-stack">${[lateMix.early,lateMix.ontime,lateMix.late].map((n,i)=>`<div style="width:${n/deliveryCount*100}%;background:${colors[i]}"></div>`).join('')}</div><div class="exec-delivery-legend">${delLegend}</div>${d.insight?`<div class="exec-gap-note">跨部门参照：生产齐套率 <strong>${nf(d.insight.ready,1)}%</strong> · ${d.insight.affected} 行缺口</div>`:''}`,'m10','查看交付诊断')}
 ${homePanel('材料价格偏差','PPV 按物料拆解 · 正值表示高于基准',`<div class="exec-ppv-list">${d.charts.price_risks.map(r=>`<button data-nav="m02"><span>${eh(r.name)}</span><div class="exec-ppv-meter"><div style="width:${Math.min(100,Math.abs(r.ppv||0)*15)}%" class="${r.ppv>0?'up':''}"></div></div><strong class="${r.ppv>0?'up':''}">${r.ppv>0?'+':''}${nf(r.ppv,2)}%</strong></button>`).join('')}</div><div class="exec-panel-foot">价格偏差 ≠ 已实现 Savings</div>`,'m02','进入价格分析')}
 ${homePanel('逾期采购订单 · TOP','按延迟天数排序 · 同时展示订单金额',`<div class="exec-table-wrap"><table class="exec-table"><thead><tr><th>订单 / 物料</th><th>供应商</th><th>延迟</th><th>金额*</th></tr></thead><tbody>${poRows}</tbody></table></div>`,'m05','进入 PO 管理')}
 </div>
 <div class="exec-under-grid"><section class="exec-decision"><div class="exec-panel-header"><div><h3>管理行动入口</h3><p>从经营异常进入可验证的采购决策</p></div><span class="exec-status">2 LIVE WORKFLOWS</span></div>
 <div class="exec-action-grid"><button data-nav="m03"><span>${icon('search',19)}</span><strong>Supplier Intelligence</strong><small>供应商报价 · TCO · API 文件差距</small><em>进入 Demo 01 ↗</em></button>
 <button data-nav="m10"><span>${icon('chart',19)}</span><strong>Procurement KPI & Strategy</strong><small>OTD / 齐套诊断 · 策略权衡 · 行动台账</small><em>进入 Demo 02 ↗</em></button>
 <button data-nav="documents"><span>${icon('shield',19)}</span><strong>Regulatory Document Control</strong><small>GMP · API 清单 · QA/RA 文件审核</small><em>查看文件中心 ↗</em></button></div></section>
 <section class="exec-data-gaps"><div class="exec-panel-header"><div><h3>数据覆盖说明</h3><p>真实性优先：不编造预算、货币或降本</p></div></div><ul>${d.missing.map(x=>`<li>${eh(x)}</li>`).join('')}</ul><p>当前首页为 ${d.scope.po_rows} 条 PO 样例的经营快照；上传新数据后的详细 KPI 分析请进入模块 10。</p></section></div>
 <details class="exec-modules"><summary>查看完整的 10 个药企采购模块 <span>展开业务架构 ↓</span></summary><div class="exec-module-grid">${modules.map(m=>`<button data-nav="${m.id}"><small>MODULE ${m.num}</small><strong>${eh(m.cn)}</strong><span>${eh(m.name)}</span></button>`).join('')}</div></details>
 <p class="exec-source-notes">* 样例缺少币种、预算和 Savings Ledger；金额仅用于说明分析计算。采购交付和生产齐套属于不同分母，必须保留数据口径与责任边界。 ${eh(d.provenance)}</p>`;
}
async function homeRefresh(){const seq=++HOME.requestId,content=document.getElementById('exec-results');if(!content)return;
 content.classList.add('exec-loading');content.innerHTML='<span class="exec-spin"></span> 正在更新采购经营指标…';
 const params=new URLSearchParams({month:HOME.month,supplier:HOME.supplier,material:HOME.material});
 try{let response=await fetch('/api/home/summary?'+params);if(!response.ok)throw Error('无法读取经营分析：'+response.status);
 const payload=await response.json();if(seq!==HOME.requestId||S.view!=='overview')return;HOME.data=payload;content.classList.remove('exec-loading');content.innerHTML=renderExecutive(payload)}
 catch(e){if(seq!==HOME.requestId)return;content.classList.remove('exec-loading');content.innerHTML=`<div class="exec-fetch-error">无法加载首页经营数据：${eh(e.message)}。<button data-home="reload">重新加载</button></div>`}}
function wireHomeOverview(){homeRefresh()}
document.addEventListener('change',event=>{const field={ 'exec-month':'month','exec-supplier':'supplier','exec-material':'material' }[event.target?.id];if(field){HOME[field]=event.target.value;homeRefresh()}});
document.addEventListener('click',event=>{const b=event.target.closest('[data-home]');if(!b)return;if(b.dataset.home==='reset'){HOME.month='all';HOME.supplier='all';HOME.material='all'}homeRefresh()});
