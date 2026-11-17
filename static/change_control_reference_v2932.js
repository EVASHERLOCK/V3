/* V2.9.32 - exact original infographic as presentation layer, actionable
 * semantic hotspots and live, provenance-aware drilldowns from the SAME
 * /api/change-control/workbench business contract used by the V2.9.31 page.
 * No image-derived data is represented as a company approval or KPI. */
(()=>{'use strict';
const STATE={filters:null,report:null,loadedKey:'',pendingKey:'',error:'',errorKey:'',selected:null,view:'changes',changeId:'',filterOpen:true};
const ROUTE='m09-reference';
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f=n=>n==null||!Number.isFinite(Number(n))?'证据不足':Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
const P=(value,total)=>total?Math.round(value/total*100):0;
const defaults={supplier:'all',material:'all',month:'all',change_type:'all',status:'all',scope:'采购变更（供应商/物料）',scheme:'全球RA · 标准设置',role:'Category Manager'};
const stages=[
 {n:'01',title:'变更触发与受理',y:145,h:89,source:'changes',desc:'依据变更主记录、供应商与物料关联核对申请受理；是否签核须由QMS确认'},
 {n:'02',title:'初始风险与全球范围评估',y:246,h:93,source:'filings',desc:'根据各市场注册关联、风险等级和变更范围进行逐项核对'},
 {n:'03',title:'供应商尽调与文件收集',y:400,h:100,source:'docs',desc:'按供应商、物料和资料类型查阅实际文件登记及缺口'},
 {n:'04',title:'多部门影响评估',y:514,h:99,source:'changes',desc:'对已登记变更的供应、质量、技术与法规影响进行联合查看'},
 {n:'05',title:'实施计划与验证方案批准',y:626,h:103,source:'docs',desc:'验证及实施必须按实际签核文件核验，不将计划日期当作获批日期'},
 {n:'06',title:'多轮送样/检验/技术转移',y:793,h:106,source:'quality',desc:'以网站检验批次与样品类记录为依据，不用截图中的参考周期推算验收'},
 {n:'07',title:'批次验证与稳定性研究',y:924,h:102,source:'quality',desc:'验证完成和稳定性结论须有受控报告，缺证据则显示待核验'},
 {n:'08',title:'全球RA文件准备/申报与补件',y:1075,h:138,source:'filings',desc:'逐市场浏览真实已登记注册关联及实施条件，不把待评估视为获批'},
 {n:'09',title:'分市场放行与供应切换',y:1217,h:57,source:'filings',desc:'逐市场放行不能凭单一市场审批推断；采购切换以关联PO核查'},
 {n:'10',title:'效果跟踪/持续监控与关闭',y:1320,h:80,source:'changes',desc:'依据变更台账关闭状态与关联来源追溯，不能代替正式关闭审批'}
];
const gates=[['G1','分级与范围批准（QA）',347,'changes'],['G2','实施与验证计划批准（QA/变更委员会）',739,'docs'],['G3','技术证据审核与确认（QA）',1024,'quality'],['G4','分市场实施 Go / No-Go（QA / RA）',1274,'filings'],['G5','变更关闭批准（QA）',1390,'changes']];
const principles=[['01','QA批准 + 市场RA许可',143,90,'filings'],['02','多市场独立实施',236,86,'filings'],['03','验证批数科学确定',327,98,'quality'],['04','缺失文件 / 失败可循环',426,99,'docs']];
const lanes=[['供应商 / SQM 资料线',570,60,'docs'],['QC / MSAT 分析线',639,59,'quality'],['QA / 验证线',697,58,'quality'],['Global / Local RA 注册线',758,60,'filings'],['SCM 供应切换线',821,57,'orders']];
const others=[['关键输出物（全流程）',900,180,'docs'],['主要部门简称',1085,240,'changes']];
function position(x,y,w,h){return `left:${(x/1064*100).toFixed(3)}%;top:${(y/1478*100).toFixed(3)}%;width:${(w/1064*100).toFixed(3)}%;height:${(h/1478*100).toFixed(3)}%`}
function hotspot(id,title,x,y,w,h,view){return `<button type="button" class="ccref-hotspot" style="${position(x,y,w,h)}" data-ccref-open="${e(id)}" data-ccref-view="${e(view)}" title="${e(title)}：点击查看本站统一来源记录与报表" aria-label="${e(title)}，打开数据报表"></button>`}
function opts(arr,v,allText='全部'){return ['all',...new Set(arr||[])].map(x=>`<option value="${e(x)}" ${x===v?'selected':''}>${e(x==='all'?allText:x)}</option>`).join('')}
function csvFilter(){return new URLSearchParams(STATE.filters||defaults).toString()}
function fetchKey(){return csvFilter()}
function isHere(){return location.hash.slice(1).split('&')[0]===ROUTE}
function fetchData(){if(!STATE.filters)STATE.filters={...defaults,...(window.PharmaChangeControlV2931?.filters?.()||{})};const k=fetchKey();if(STATE.loadedKey===k||STATE.pendingKey===k||STATE.errorKey===k)return;STATE.pendingKey=k;STATE.error='';fetch('/api/change-control/workbench?'+k,{cache:'no-store'}).then(async r=>{const result=await r.json();if(!r.ok)throw Error(result.detail||`HTTP ${r.status}`);if(STATE.pendingKey!==k)return;STATE.report=result;STATE.loadedKey=k;STATE.errorKey='';STATE.pendingKey='';if(isHere())window.render?.()}).catch(err=>{if(STATE.pendingKey!==k)return;STATE.pendingKey='';STATE.error=String(err?.message||err);STATE.errorKey=k;if(isHere())window.render?.()});}
function chart(r){const counts={open:0,ra:0,qa:0,closed:0};for(const c of r.changes||[])counts[c.stage]=(counts[c.stage]||0)+1;const total=(r.changes||[]).length;return `<div class="ccref-chart" role="img" aria-label="筛选结果变更状态分布，共${total}条">${[['open','受理/进行中'],['ra','RA评估'],['qa','QA审核'],['closed','台账已关闭']].map(([id,name])=>`<button class="ccref-chartrow" type="button" data-ccref-status="${id}"><span>${name}</span><span class="ccref-charttrack"><span style="width:${P(counts[id],total)}%" class="ccref-bar ccref-bar-${id}"></span></span><b>${counts[id]}</b></button>`).join('')}</div>`}
function summary(r){return `<div class="ccref-kpi" role="group" aria-label="与变更控制工作台同源的实时筛选摘要">
 ${[['开放变更',r.kpis.open_changes,'changes'],['注册关联',r.kpis.filings,'filings'],['高风险变更',r.kpis.high_risk,'changes'],['关联PO金额',`${f(r.kpis.exposure)} ${e(r.source.currency)}`,'orders']].map(([t,v,key])=>`<button data-ccref-open="overview" data-ccref-view="${key}" class="ccref-kpiitem"><span>${t}</span><strong>${v}</strong><small>点开查看原始来源</small></button>`).join('')}</div>`}
function field(name,label,values){return `<label>${label}<select data-ccref-filter="${name}">${opts(values,STATE.filters[name],name==='change_type'?'全部变更类型':'全部')}</select></label>`}
function filters(r){return `<div class="ccref-filters">${field('supplier','供应商',r.available?.supplier)}${field('material','物料',r.available?.material)}${field('month','申请月份',r.available?.month)}${field('change_type','变更类型',r.available?.change_type)}<label>变更台账状态<select data-ccref-filter="status">${opts(['open','ra','qa','closed'],STATE.filters.status)}</select></label><button type="button" data-ccref-reset>重置筛选</button></div>`}
function table(headers,rows){return `<div class="ccref-tableouter"><table class="ccref-table"><thead><tr>${headers.map(x=>`<th>${e(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="ccref-empty">当前条件下没有匹配的已登记记录；不会构造虚拟数据。</td></tr>`}</tbody></table></div>`}
function row(values,id){return `<tr ${id?`class="ccref-clickrow" data-ccref-change="${e(id)}" title="点击展开来源字段和相关PO"`:''}>${values.map(x=>`<td>${e(x)}</td>`).join('')}</tr>`}
function records(r,view){if(view==='filings')return table(['变更编号','市场','产品','RA关联状态','实施条件'],r.filings.map(x=>row([x.change_id,x.market,x.product_id,x.status,x.implementation],x.change_id)));
if(view==='orders')return table(['PO','供应商','物料','数量','单价','原站金额'],r.orders.map(x=>row([x.po_id,x.supplier_id,x.material_id,x.ordered_qty,x.unit_price,x.amount])));
if(view==='docs')return `<p class="ccref-small">下列文件要求来自现有工作台同一文件类型映射；只有能匹配到有效来源台账才计为已登记，不等于QA/RA签核。</p>${table(['资料分类','文件要求','匹配编号','有效证据数','状态'],r.document_groups.flatMap(g=>g.items.map(x=>row([g.name,x.title,x.documents.join('、')||'无',x.valid,x.status]))))}`;
if(view==='quality')return `<p class="ccref-small">检验及批次是共享来源记录；无法从来源证明完成的工艺验证、稳定性研究不会填充完成率。</p>${table(['批次号','物料','质量状态','来源类型'],[...r.quality.map(x=>row([x.lot_id||x.qc_lot_id||x.batch_id||'待核验',x.material_id,x.status||x.release_status||'未登记','QC'])),...r.lots.map(x=>row([x.lot_id||x.batch_id||'待核验',x.material_id,x.status||'未登记','库存批次']))])}`;
return table(['变更ID','供应商','物料','变更类型','来源状态','优先级风险分','关联PO数'],r.changes.map(x=>row([x.change_id,x.supplier_id,x.material_id,x.category,x.status,x.risk,x.po_ids.length],x.change_id)));}
function detail(r,id){const c=r.changes.find(x=>x.change_id===id);if(!c)return '';const reg=r.filings.filter(x=>x.change_id===id);const orders=r.orders.filter(x=>c.po_ids.includes(x.po_id));return `<div class="ccref-record"><div class="ccref-recordhead"><strong>${e(id)} · 原始关联核对</strong><button data-ccref-clear>关闭记录</button></div><p>供应商 <b>${e(c.supplier_id)}</b>　物料 <b>${e(c.material_id)}</b>　风险分 <b>${f(c.risk)}</b>　原台账状态 <b>${e(c.status)}</b></p><p>申请日 ${e(c.opened_date)} · 计划日 ${e(c.target_date)} · 关联 PO ${c.po_ids.length} 项 · 关联市场 ${reg.length} 项</p><p>证据编号：${e(c.file_ids.join('、')||'尚无充分登记文件')}</p><div class="ccref-minititle">逐市场注册行</div>${table(['市场','申报路径','来源状态','实施条件'],reg.map(x=>row([x.market,x.regulatory_route,x.status,x.implementation])))}<div class="ccref-minititle">关联PO行</div>${table(['PO编号','采购金额','供应商','物料'],orders.map(x=>row([x.po_id,x.amount,x.supplier_id,x.material_id])))}<small>状态是源台账文本；不代表QMS电子签名、验证放行或正式市场批准。</small></div>`}
function tabs(){return [['changes','变更台账'],['filings','逐市场RA'],['orders','采购PO'],['docs','文件缺口'],['quality','QC/批次']].map(([id,text])=>`<button class="${STATE.view===id?'active':''}" type="button" data-ccref-tab="${id}">${text}</button>`).join('')}
function drawer(){const r=STATE.report,current=STATE.selected||{title:'Change Control 全流程参考',desc:'点击图中任意阶段、审批节点、工作线，即可查看网站统一数据'};
return `<div class="ccref-shade" data-ccref-close></div><aside class="ccref-drawer" role="dialog" aria-modal="true" aria-label="${e(current.title)} 数据与报表"><div class="ccref-drawerhead"><div><span>GLOBAL CHANGE CONTROL / SOURCE-BOUND</span><h2>${e(current.title)}</h2><p>${e(current.desc||'按照原站的业务主键核对数据，不用图片示例代替实际记录')}</p></div><button data-ccref-close class="ccref-x" aria-label="关闭数据抽屉">×</button></div>
 ${r?`<div class="ccref-drawerscroll"><div class="ccref-sourcechip">来源：${e(r.source.scope)} · 基准日 ${e(r.source.as_of)} · 非正式GxP电子批准</div>${filters(r)}${summary(r)}<div class="ccref-plotheading">当前筛选：变更状态分布（实际记录统计）</div>${chart(r)}<div class="ccref-tabs" role="tablist" aria-label="切换数据报表">${tabs()}</div>${records(r,STATE.view)}${STATE.changeId?detail(r,STATE.changeId):''}<div class="ccref-links"><a href="#m09">打开变更控制与全球RA工作台</a><a href="#regulatory">全球法规信息</a><a href="#documents">合规文档中心</a><a href="#m05">采购执行</a><a href="#m06">原材料生命周期</a><a href="#ss-compliance">供应商合规管理</a></div><div class="ccref-draweractions"><button data-ccref-export="full">下载全部来源及公式 Excel</button><button data-ccref-export="po">下载筛选PO Excel</button></div><p class="ccref-small">数据联动规则：供应商 / 物料 / 月份 / 变更类型使用原站 /api/change-control/workbench；所有统计、风险分及导出工作簿使用同一筛选参数。未接入正式QMS/ERP审批记录的结论一律标注为待核验。</p></div>`:`<p class="ccref-drawerloading">${STATE.error?'数据服务未连接：'+e(STATE.error):'正在读取本网站统一业务来源数据……'}</p><button data-ccref-retry>重新连接</button>`}</aside>`;
}
function render(){if(!STATE.filters)STATE.filters={...defaults,...(window.PharmaChangeControlV2931?.filters?.()||{})};fetchData();let hotspots=[];
for(let i=0;i<stages.length;i++){const s=stages[i];hotspots.push(hotspot('step:'+i,`${s.n} ${s.title}`,8,s.y,802,s.h,s.source));}
for(let i=0;i<gates.length;i++){const [n,title,y,view]=gates[i];hotspots.push(hotspot('gate:'+i,`${n} ${title}`,8,y,802,42,view));}
for(let i=0;i<principles.length;i++){const [n,title,y,h,view]=principles[i];hotspots.push(hotspot('principle:'+i,`核心控制原则 ${n} ${title}`,816,y,243,h,view));}
for(let i=0;i<lanes.length;i++){const [title,y,h,view]=lanes[i];hotspots.push(hotspot('lane:'+i,title,816,y,243,h,view));}
for(let i=0;i<others.length;i++){const [title,y,h,view]=others[i];hotspots.push(hotspot('other:'+i,title,816,y,243,h,view));}
// Header columns and reference periods are clickable semantic filters, not decorative dead controls.
for(let i=0;i<5;i++){hotspots.push(hotspot('column:'+i,['阶段与目标','牵头与协作部门','关键活动 / 主要工作','主要文件 / 交付物','参考周期'][i],[10,202,345,535,706][i],96,[191,141,187,169,98][i],40,['changes','changes','changes','docs','changes'][i]));}
return `<div class="ccref-page"><div class="ccref-pagebar"><span><b>Change Control 全流程参考</b> · 原图保真 / 网站来源联动</span><span class="ccref-pageactions"><button data-ccref-open="overview" data-ccref-view="changes">筛选与实时报告</button><button data-nav="m09">返回变更控制与全球RA工作台</button></span></div><div class="ccref-canvas"><img src="/static/assets/change-control-full-process-reference.png" alt="全球药企 Change Control 复杂变更全流程参考：10个流程阶段、5个批准门、右侧核心控制原则、工作线、交付物与部门" width="1064" height="1478" loading="eager" decoding="async" draggable="false"/>${hotspots.join('')}</div><div class="ccref-below"><p><b>统一数据与法规边界：</b>本图内阶段编号、G1–G5与参考周期是原始流程模板，不是企业实际审评周期或已批准状态。点击每个区域查看本站同源的变更、RA、PO、文件和批次记录；真实缺失的签核、稳定性和验证数据不虚构。</p>${STATE.report?`<div class="ccref-provenance">当前统计来源：<b>${e(STATE.report.source.scope)}</b> · 基准日 ${e(STATE.report.source.as_of)} · 版本 ${e(STATE.report.source.version)}。图像本身的参考周数不参与统计。</div>${window.PharmaEnterpriseView?.isActive?.()?'<p class="ccref-enterprise-warning">注意：全站当前选择企业来源，但原 V2.9.31 变更控制接口仍是 DEMO 台账；下列数字不是企业QMS实际变更记录。正式企业模式需接入变更控制源后再对账。</p>':''}${summary(STATE.report)}`:`<span>${STATE.error?'数据获取失败：'+e(STATE.error):'正在核对网站统一数据……'}</span>`}<div class="ccref-below-actions"><button data-ccref-open="overview" data-ccref-view="changes">查看筛选及完整数据分析</button><button data-ccref-export="full" ${!STATE.report?'disabled':''}>导出当前公式工作簿</button></div></div>${STATE.selected?drawer():''}</div>`}
function descriptor(id){if(id==='overview')return {title:'全流程数据总览',desc:'在同一筛选下查看变更控制、全球RA、PO、文件与QC批次来源'};
const [kind,indexString]=id.split(':'),i=Number(indexString);if(kind==='step')return {...stages[i]};if(kind==='gate')return {title:gates[i][0]+' · '+gates[i][1],desc:'变更批准门：仅有台账状态不能证明正式审核通过'};if(kind==='principle')return {title:'核心控制原则 '+principles[i][0]+' · '+principles[i][1],desc:'逐市场法规与质量审核必须由授权人员按正式证据确认'};if(kind==='lane')return {title:lanes[i][0],desc:'跨职能工作线的共同来源记录与文件追溯'};if(kind==='other')return {title:others[i][0],desc:'点击各记录查看真实可用的文件和审批证据'};if(kind==='column')return {title:['阶段与目标','牵头与协作部门','关键活动 / 主要工作','主要文件 / 交付物','参考周期'][i],desc:'原图列为流程模板。实际完成情况需要关联源记录，不以示意周期作结论'};return {title:'变更控制全流程',desc:'原站统一来源'};}
function applyFilter(k,v){STATE.filters[k]=v;STATE.report=null;STATE.loadedKey='';STATE.error='';STATE.errorKey='';STATE.changeId='';window.PharmaChangeControlV2931?.applyFilters?.({[k]:v});if((k==='supplier'||k==='material')&&window.EnterpriseV08?.state){const st=window.EnterpriseV08.state;if(st.filters){st.filters[k]=v==='all'?'':v;void window.EnterpriseV08.load?.();}}
 window.render?.();}
function exportWorkbook(type){if(!STATE.report)return;const q=csvFilter();const a=document.createElement('a');a.href='/api/change-control/workbench.xlsx?'+q+(type==='po'?'&po_only=1':'');a.download=type==='po'?'Change_Control_Reference_PO_Formula.xlsx':'Change_Control_Reference_Analysis_Formula.xlsx';document.body.appendChild(a);a.click();a.remove();}
function init(){document.addEventListener('click',ev=>{const root=ev.target.closest('.ccref-page');if(!root)return;const button=ev.target.closest('[data-ccref-open],[data-ccref-tab],[data-ccref-status],[data-ccref-change],[data-ccref-clear],[data-ccref-close],[data-ccref-export],[data-ccref-reset],[data-ccref-retry]');if(!button)return;
const d=button.dataset;if(d.ccrefOpen){STATE.selected=descriptor(d.ccrefOpen);STATE.view=d.ccrefView||'changes';STATE.changeId='';window.render?.()}
else if('ccrefClose' in d){STATE.selected=null;STATE.changeId='';window.render?.()}
else if(d.ccrefTab){STATE.view=d.ccrefTab;STATE.changeId='';window.render?.()}
else if(d.ccrefStatus){applyFilter('status',d.ccrefStatus)}
else if(d.ccrefChange){STATE.changeId=d.ccrefChange;window.render?.()}
else if('ccrefClear' in d){STATE.changeId='';window.render?.()}
else if('ccrefReset' in d){STATE.filters={...defaults};window.PharmaChangeControlV2931?.applyFilters?.({...defaults});STATE.loadedKey='';STATE.report=null;STATE.changeId='';window.render?.()}
else if('ccrefRetry' in d){STATE.pendingKey='';STATE.loadedKey='';STATE.errorKey='';fetchData()}
else if(d.ccrefExport)exportWorkbook(d.ccrefExport);
},true);
document.addEventListener('change',ev=>{const control=ev.target.closest('[data-ccref-filter]');if(!control||!ev.target.closest('.ccref-page'))return;applyFilter(control.dataset.ccrefFilter,control.value);});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&STATE.selected&&isHere()){STATE.selected=null;STATE.changeId='';window.render?.();}});
}
window.PharmaChangeReference={render,init,filters:()=>({...STATE.filters}),reset:()=>{STATE.filters={...defaults};STATE.report=null;STATE.loadedKey='';STATE.selected=null;window.render?.()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
