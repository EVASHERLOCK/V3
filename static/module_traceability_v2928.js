/* The two highest-priority site rules:
 * (1) every business module discloses its own metrics, formulas, thresholds,
 *     data selection and analysis steps;
 * (2) every module has an accessible full source table and true-formula XLSX.
 * A visible DOM value is only UI evidence, never forged ERP/QMS provenance. */
(()=>{'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=()=>String(location.hash||'#overview').slice(1).split('&')[0]||'overview';
const selectRoot=()=>document.querySelector('#content');
const text=x=>String(x?.textContent||'').replace(/\s+/g,' ').trim();
const isTrace=x=>!!x?.closest?.('.pharma-module-tools,.pharma-module-inline,#pharma-metric-modal,.pharma-metric-toolbar,.pharma-gh-tip');
const metricPatterns=[
 [/OTD|准时交付率|准交率/i,'SRC.PO.OTD'],[/PPV|价格偏差率|采购价差率/i,'SRC.PO.PPV'],
 [/订单总金额|采购总金额|采购支出|Spend|年度支出/i,'SRC.PO.SPEND'],[/合同.*到期/i,'SRC.CONTRACT.DUE90'],[/合格.*来源|准入组合/i,'SRC.QUAL.COMBINATIONS'],
 [/候选供应商|候选资源/i,'SRC.CANDIDATE.TOTAL'],[/降本.*达成率/i,'SRC.SAVINGS.ATTAINMENT'],[/降本.*金额/i,'SRC.SAVINGS.REALIZED'],
 [/文件.*有效率|资质.*有效/i,'SRC.DOC.VALID_RATE'],[/文件.*数量|文件登记/i,'SRC.DOC.COUNT'],[/30天.*到期|到期30天/i,'SRC.DOC.DUE_30'],
 [/90天.*到期|到期90天/i,'SRC.DOC.DUE_90'],[/CAPA.*逾期/i,'SRC.QMS.OVERDUE_CAPA'],[/CAPA.*关闭率/i,'SRC.QMS.CAPA_CLOSED_RATE'],
 [/CAPA|纠正预防/i,'SRC.QMS.OPEN_CAPA'],[/重大质量事件/i,'SRC.QMS.CRITICAL_COUNT'],[/质量事件|质量偏差/i,'SRC.QMS.EVENT_COUNT'],
 [/风险.*集中度|CR5|前五.*采购集中/i,'SRC.PO.CR5_SHARE'],[/CR3|前三.*集中/i,'SRC.PO.CR3_SHARE'],
 [/询价|报价.*数量|RFQ/i,'SRC.QUOTE.COUNT'],[/最优.*报价/i,'SRC.QUOTE.BEST_LANDED'],[/BOM.*目标/i,'SRC.BOM.TARGET_TOTAL'],
 [/BOM.*差额|BOM.*偏差/i,'SRC.BOM.VARIANCE'],[/BOM.*总额/i,'SRC.BOM.QUOTED_TOTAL'],[/甘特|项目阶段/i,'SRC.PROJECT.STAGES'],
 [/项目.*进度/i,'SRC.PROJECT.PROGRESS'],[/评分.*矩阵|加权评分|综合得分/i,'SRC.SCORE.WEIGHTED_MEAN'],
 [/库存.*复验/i,'SRC.INVENTORY.RETEST_90'],[/发票.*匹配/i,'SRC.INVOICE.MATCH_RATE']
];
const selector=[
 '#content section','#content article','#content .panel','#content .card','#content .widget',
 '#content [class*="-panel"]','#content [class*="-card"]','#content [class*="-section"]',
 '#content .cp-panel','#content .c20-panel','#content .c20-kpis','#content .cp-kpis',
 '#content .kpi-card','#content .stat-card','#content .cp-kpi','#content .m01-kpi','#content .spf-score-card','#content .cb-kpi',
 '#content .sp-summary > div','#content .spf-analysis-card','#content .ss2-kpi','#content .sp-kpi',
 '#content .demo-v2953-legacy-module'
].join(',');
const header=node=>{
 const direct=[...node.children].find(x=>x.matches?.('header,.panel-head,.section-head,.sp-cardhead,.cb-card-head,.spf-analysis-head,.m01-card-header'));
 const s=direct?.querySelector('h2,h3,h4,h5,strong,b')||node.querySelector(':scope > h2,:scope > h3,:scope > h4,:scope > .title,:scope > strong,:scope > b')||node.querySelector(':scope > .cp-panel-h > b,:scope > .c20-panel-head b,:scope > .cp-panel-h strong,:scope > .c20-panel-head strong,header h2,header h3,header h4,.panel-title,.card-title,.sp-cardhead strong,.spf-analysis-head h4');
 if(s)return s;
 if(node.classList.contains('c20-kpis'))return {textContent:'合规六项KPI指标 / 六项逐笔计算依据'};
 if(node.classList.contains('cp-kpis'))return {textContent:'产品线预算、采购、交付和供应风险指标'};
 const first=node.querySelector(':scope > [class*="head"] b,:scope > [class*="head"] strong,:scope > [class*="head"] .title,:scope > [class*="title"]');
 if(first)return first;
 // Cards without semantic headings: prefer the first short direct label. Do
 // not invent a measurement from CSS or a chart coordinate.
 const label=[...node.children].slice(0,4).map(c=>c.matches?.('b,strong,h4,label')?c:c.querySelector?.('b,strong,label')).find(x=>x&&text(x).length>=2&&text(x).length<=110);
 return label||null;
};
const isCandidate=node=>{
 // The Change Control RA replacement supplies module-specific lineage and
 // downloads itself. Do not duplicate controls over the screenshot layout.
 if(node.closest('.cc31')&&!node.classList.contains('demo-v2953-legacy-module'))return false;
 if(node.closest('nav,aside,footer,.pharma-module-tools,.pharma-module-inline,.pharma-metric-modal-layer,.pharma-gh-tooltip'))return false;
 if(node.matches('button,a,svg,table')||node.id==='content'||node.classList.contains('pharma-module-tools'))return false;
 const s=header(node);if(!s)return false;
 const label=text(s);if(label.length<2||label.length>150)return false;
 const t=text(node);if(t.length<8||t.length>32000)return false;
 const meaningful=!!node.querySelector('table,svg,canvas,[class*="chart"],[class*="kpi"],strong,[class*="value"],p,li');
 if(!meaningful)return false;
 // Exclude a page-wide layout wrapping many real business modules.
 if(node.querySelectorAll('section').length>8&&t.length>9000)return false;
 return true;
};
function modules(){const root=selectRoot();if(!root)return [];
 return [...new Set([...root.querySelectorAll(selector)])].filter(isCandidate).slice(0,350);
}
function stableId(node){if(node.dataset.moduleTraceId)return node.dataset.moduleTraceId;
 const h=header(node),title=text(h);let hash=2166136261;
 const peers=[...node.parentElement?.children||[]].filter(x=>x.tagName===node.tagName),position=Math.max(0,peers.indexOf(node));
 for(const ch of route()+'|'+title+'|'+position+'|'+(node.className||'')){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619)}
 const base=route()+'.'+(hash>>>0).toString(16);
 // Multiple sibling groups can legitimately share a title/class and produce the
 // same base hash. Never expose duplicate DOM IDs: mirror the audited baseline
 // suffix, so the second real component can be individually clicked and tested.
 const used=[...document.querySelectorAll('#content [data-module-trace-id]')].map(x=>x.dataset.moduleTraceId).filter(x=>x===base||x.startsWith(base+'__baseline_duplicate_'));
 let id=base,ordinal=0;while(used.includes(id))id=base+'__baseline_duplicate_'+(++ordinal);
 node.dataset.moduleTraceId=id;return id;
}
function titleOf(node){const own=text(header(node)), parent=node.parentElement?.closest('.pharma-module-ready');
 if((!own||/^(?:[0-9,.%]+|[◈◉◎◫⚙¤✦▤]|搜索|TOP ?10|每页)/i.test(own))&&parent){const pt=text(header(parent));if(pt&&pt!==own&&pt.length<125)return pt+' / '+(own||'子组件');}
 return own||'业务模块（未提供标题）';}
const narrativeRuleMetrics={
 'ACT.SOURCE.SECOND':['SRC.ACTION.DEVELOP_SECOND_SOURCE','SRC.QUAL.COMBINATIONS','SRC.PO.SPEND'],
 'ACT.DELIVERY.INVESTIGATE':['SRC.ACTION.DELIVERY_REVIEW','SRC.PO.OTD'],
 'ACT.COST.PPV':['SRC.PO.PPV','SRC.PO.WEIGHTED_BASELINE','SRC.PO.SPEND'],
 'ACT.DOC.RECHECK':['SRC.DOC.VALID_RATE'],
 'ACT.RISK.SUPPLIER_CONCENTRATION':['SRC.RISK.CONCENTRATION','SRC.PO.SPEND'],
 'ACT.MARKET.SUPPLY_SIGNAL':['SRC.CANDIDATE.OFFICIAL','SRC.CANDIDATE.TOTAL'],
 'ACT.QMS.CAPA_ESCALATE':['SRC.QMS.OVERDUE_CAPA','SRC.QMS.OPEN_CAPA'],
 'ACT.QMS.CRITICAL_REVIEW':['SRC.QMS.CRITICAL_COUNT','SRC.QMS.EVENT_COUNT'],
 'ACT.CONTRACT.RENEWAL':['SRC.CONTRACT.DUE90','SRC.CONTRACT.ACTIVE'],
 'ACT.SAVINGS.ATTAINMENT':['SRC.SAVINGS.ATTAINMENT','SRC.SAVINGS.REALIZED','SRC.SAVINGS.PLANNED'],
 'ACT.AUDIT.FINDINGS':['SRC.AUDIT.OPEN_FINDINGS','SRC.AUDIT.COUNT'],
 'ACT.RECEIPT.GAP':['SRC.PO.UNRECEIVED_QTY','SRC.PO.RECEIPT_RATE'],
 'ACT.INVOICE.MATCH_EXCEPTION':['SRC.INVOICE.EXCEPTIONS','SRC.INVOICE.MATCH_RATE'],
 'ACT.INVOICE.OVERDUE_REVIEW':['SRC.INVOICE.OVERDUE'],
 'ACT.INVENTORY.RETEST_REVIEW':['SRC.INVENTORY.RETEST_90','SRC.INVENTORY.QC_HOLD'],
 'ACT.CHANGE.CONTROL_REVIEW':['SRC.CHANGE.OPEN','SRC.CHANGE.HIGH'],
 'ACT.WORKFLOW.RELIABILITY':['SRC.WORKFLOW.FAILURES','SRC.WORKFLOW.SUCCESS_RATE'],
 'ACT.ALERT.HIGH_REVIEW':['SRC.ALERT.HIGH']
};
function dynamicActions(node){
 const title=titleOf(node),rule=window.PharmaMetricAudit?.analysisIdentify;
 if(!rule)return [];
 const texts=[title,...[...node.querySelectorAll('h3,h4,p,li,[class*="insight"],[class*="recommendation"],[class*="summary"]')]
    .filter(x=>!isTrace(x)).slice(0,42).map(text).filter(x=>x.length>8)];
 const ids=new Set();
 for(const t of texts){
  // A generic recommendation heading alone is NOT a registered decision.
  const id=rule(t);if(id&&!id.startsWith('UNREGISTERED'))ids.add(id);
  if(ids.size>=10)break;
 }
 return [...ids];
}
function dynamicMetrics(node){
 const title=titleOf(node),labels=[...node.querySelectorAll('thead th,.kpi-label,[class*="kpi"] b,[class*="score"] h4,[class*="metric"] label,h3,h4')]
   .filter(x=>!isTrace(x)).slice(0,60).map(text);
 const s=[title,...labels].join(' '),ids=new Set();
 for(const [re,id] of metricPatterns)if(re.test(s))ids.add(id);
 for(const item of [title,...labels]){
  const id=window.PharmaMetricAudit?.identify?.(item);if(id&&!id.startsWith('UNREGISTERED'))ids.add(id);
 }
 // A narrative rule references ALL of its numeric drivers, not just the
 // text heading. Their actual formulas and evidence rows are computed server-side.
 for(const action of dynamicActions(node))for(const metric of narrativeRuleMetrics[action]||[])ids.add(metric);
 if(/OTD/i.test(s)&&/PPV/i.test(s)){ids.add('SRC.PO.OTD');ids.add('SRC.PO.PPV')}
 return [...ids].slice(0,24);
}
const cellValue=s=>{const v=String(s||'').trim().replace(/,/g,'');if(/^[-+]?\d+(?:\.\d+)?$/.test(v))return Number(v);return String(s||'').slice(0,380)};
function capture(node){const tableNodes=[...node.querySelectorAll('table')].filter(t=>!isTrace(t)).slice(0,16);
 const tables=tableNodes.map((t,i)=>{
  const hs=[...(t.querySelector('thead tr:last-child')||t.querySelector('tr')||t).querySelectorAll('th,td')].slice(0,22).map(text);
  const trs=[...t.querySelectorAll('tbody tr')];const actual=trs.length?trs:[...t.querySelectorAll('tr')].slice(1);
  return {title:`${titleOf(node)} / 表${i+1}`,headers:hs,rows:actual.map(r=>[...r.children].filter(c=>c.matches('td,th')).slice(0,22).map(c=>cellValue(text(c)))),row_count:actual.length,captured_row_count:actual.length,source_scope:"VISIBLE_DOM_ONLY",full_database_verified:false};
 });
 const figs=[];const seen=new Set();
 for(const element of node.querySelectorAll('strong,[class*="value"],[class*="number"],.badge,[class*="rate"],svg text')){
  if(isTrace(element))continue;const v=text(element);if(!/\d/.test(v)||v.length>90||seen.has(v))continue;seen.add(v);
  figs.push({label:text(element.closest('article,div')?.querySelector('b,label,h4')||header(node)).slice(0,60),value:v.slice(0,90),metric_id:element.dataset.lineageMetricId||'',snapshot_id:element.dataset.lineageSnapshotId||'',unit:element.dataset.lineageUnit||'',scope:(()=>{try{return JSON.parse(element.dataset.lineageScope||'null')}catch{return null}})()});if(figs.length>=60)break;
 }
 const narratives=[];
 for(const e of node.querySelectorAll('p,li,[class*="recommendation"],[class*="summary"],[class*="insight"]')){
  if(isTrace(e))continue;const v=text(e);if(v.length>=15&&v.length<=650&&!narratives.includes(v))narratives.push(v);if(narratives.length>=48)break;
 }
 const charts=[];
 const exactPoints=[...node.querySelectorAll('[data-lineage-chart-metric-id]')].filter(x=>!isTrace(x));
 if(exactPoints.length){charts.push({title:titleOf(node),chart_type:'SOURCE_BOUND_ENTERPRISE',source_hint:'企业发布快照原始行、指标和分组标识均来自服务端，须逐组独立核对',series:exactPoints.slice(0,250).map(e=>({element:e.tagName.toLowerCase(),label:e.dataset.lineageGroupKey||'',value:e.dataset.lineageValue||'',metric_id:e.dataset.lineageChartMetricId||'',group_dimension:e.dataset.lineageGroupDimension||'',group_key:e.dataset.lineageGroupKey||'',unit:e.dataset.lineageUnit||'',snapshot_id:e.dataset.lineageSnapshotId||'',scope:(()=>{try{return JSON.parse(e.dataset.lineageScope||'null')}catch{return null}})(),source_ids:(()=>{try{return JSON.parse(e.dataset.lineageSourceIds||'[]')}catch{return []}})(),position:'server-source-bound'}))});}
 for(const svg of (!exactPoints.length?[...node.querySelectorAll('svg')].filter(x=>!isTrace(x)).slice(0,12):[])){
  const title=(svg.getAttribute('aria-label')||svg.querySelector('title')?.textContent||titleOf(node)).slice(0,130);
  const series=[];
  const used=new Set();
  for(const e of [...svg.querySelectorAll('text,title,circle,rect,[data-value],[aria-label]')].slice(0,280)){
   let label=(e.getAttribute('aria-label')||e.getAttribute('data-label')||e.querySelector('title')?.textContent||(e.tagName.toLowerCase()==='text'?text(e):'')).slice(0,130);
   let value=e.getAttribute('data-value')||e.getAttribute('data-score')||'';
   if(!value&&e.tagName.toLowerCase()==='text')value=text(e);
   if(!label&&!value)continue;
   const k=label+'|'+value;if(used.has(k))continue;used.add(k);
   series.push({element:e.tagName.toLowerCase(),label:label||'未标注数据点',value:String(value).slice(0,140),position:['x','y','cx','cy'].filter(k=>e.hasAttribute(k)).map(k=>k+'='+e.getAttribute(k)).join('；')});
   if(series.length>=140)break;
  }
  charts.push({title,chart_type:'SVG',series,source_hint:'页面SVG显示快照；轴刻度及图形坐标不代表受控业务原始值'});
 }
 // Preserve CSS-only chart legends (donut, progress, horizontal bar etc.).
 if(!charts.length){const tags=[...node.querySelectorAll('[class*="donut"],[class*="chart"],[class*="bar"],[class*="matrix"],[class*="plot"]')].filter(e=>!isTrace(e));
  const series=[],seen=new Set();for(const e of tags.slice(0,150)){const t=text(e);if(t.length>100||t.length<2||!/[0-9]/.test(t)||seen.has(t))continue;seen.add(t);series.push({element:e.tagName.toLowerCase(),label:e.getAttribute('aria-label')||e.className?.toString().slice(0,75)||'图表',value:t,position:'CSS-rendered chart'});if(series.length>=80)break;}
  if(series.length)charts.push({title:titleOf(node),chart_type:'CSS/HTML',series,source_hint:'只采集可见标签；无法从条形宽度/扇区角度反推源数据'});
 }
 const scope=window.PharmaMetricAudit?.selection?.()||{};
 return {route:route(),title:titleOf(node),group_title:(()=>{const parent=node.parentElement?.closest('.pharma-module-ready');return parent?text(header(parent)):''})(),component_id:stableId(node),tables,charts,figures:figs,narratives,metrics:dynamicMetrics(node),actions:dynamicActions(node),as_of:scope.as_of||null,context:'当前页面可见记录；隐藏/分页来源通过服务端指标独立获取',source_scope:'VISIBLE_DOM_ONLY',full_database_verified:false};
}
const rowTable=(rows,headers)=>{if(!rows?.length)return '<p>本模块无页面表格行；请检查已匹配服务端指标的原始明细。若仍为空，代表缺少对应来源，不应使用空值决策。</p>';
 return `<div class="pharma-module-scroller"><table><thead><tr>${headers.map(h=>`<th>${E(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map((_,i)=>`<td>${E(r[i]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;};
function executiveView(res,mode){
 const x=res.executive||{},metrics=x.calculations||[],tables=x.tables||[],steps=x.steps||[],terms=x.terms||[],analysis=x.analysis||[],paragraphs=x.narrativeAnalysis||[];
 const isFull=mode==='full';
 const intro=`<div class="pharma-manager-intro"><b>${isFull?'全量计算依据、来源表及逐格公式':'本模块公式、变量与业务解释'}</b><p>模块：${E(res.title)} · 统计条件 ${E(JSON.stringify(res.scope||{}))}。每个数值按所列数据范围解释；原始字段是输入，不会伪装成 Excel 公式。</p></div>`;
 const metricsView=`<h4>① 本模块指标：定义 → 变量 → 公式 → 结果</h4>${metrics.length?rowTable(metrics.map(m=>[m.id,m.name,m.formula||'尚未确定业务公式',m.numerator??'不适用/无记录',m.denominator??'不适用/无记录',m.result??'本范围不可计算',m.unit||'',m.source_rows,m.source||'']),['指标ID','业务名称','计算公式','分子/变量A','分母/变量B','计算结果','单位','源行数','来源类型']):'<p>未识别到与此小模块同范围绑定的正式指标ID；下面仍逐一解释可见字段和可核实的计算过程，不调用无关KPI填充。</p>'}`;
 const glossary=`<h4>② 本模块变量、缩写及术语解释</h4>${rowTable(terms.map(a=>a),['变量/术语','管理层易懂解释'])}`;
 const stepHtml=`<h4>③ 一步一步的分析与计算逻辑</h4><ol class="pharma-manager-steps">${steps.map(s=>`<li>${E(s)}</li>`).join('')}</ol>`;
 const analysisItems=analysis.map(a=>{
  const inputs=(a.inputs||[]).map(i=>(i.label||i.metric_id)+'='+String(i.value??'未计算')+' '+String(i.unit||'')).join('；')||'没有绑定的输入数值';
  const thresholds=(a.thresholds||[]).map(t=>String(t.field)+' '+String(t.operator)+' '+String(t.value)).join('；')||'无已确认阈值';
  return '<section class="pharma-manager-analysis"><b>'+E(a.name)+'</b><p><b>输入：</b>'+E(inputs)+'</p><p><b>判断条件：</b>'+E(thresholds)+'</p><p><b>解释：</b>'+E(a.reason||'尚无可靠根因结论')+'</p><p><b>行动：</b>'+E(a.conclusion||'需业务核查')+'</p></section>';
 }).join('');
 const analysisHtml='<h4>④ 数据→原因判断→行动结论</h4>'+(analysisItems||'<p>'+E(x.explanation||'当前模块无可验证的行动规则，需对照业务目标与阈值人工确认。')+'</p>');
 const paragraphsHtml=paragraphs.length?'<h4>⑤ 已展示文字结论逐段解析</h4>'+paragraphs.map(p=>'<div class="pharma-manager-analysis"><b>第'+p.number+'段原文：</b><p>'+E(p.text)+'</p><p><b>涉及变量：</b>'+E(p.inputs.join('；')||'未匹配定量指标')+'</p><p><b>解释步骤：</b>'+E(p.method)+'</p><p><b>证据边界：</b>'+E(p.conclusion)+'</p></div>').join(''):'';
 const tablesHtml=`<h4>⑥ Excel 式明细：当前页面提交的来源单元格 + 每格计算公式 + 当前重算值</h4><p>每张表的 Excel 行号从 4 开始，A/B/C 等列与下载工作簿中的「模块表1、模块表2…」一致。这里采集当前DOM中所有已渲染的表格行（包括不在视口内的已渲染行），不等于数据库全量；未加载的服务器分页仍需要独立来源核验；服务器独立来源需要单独核验。计算值仅使用本行真实可解析的数字；无法计算保留空白而不是填0。</p>${tables.map(t=>{
  const heads=[...t.headers,...(t.modes||[]).map(m=>'Excel公式｜'+m.name)];
  const trs=(t.rows||[]).map(r=>[...(r.values||[]).map((v,i)=>`<span title="来源单元格 ${E(String.fromCharCode(65+i))}${r.excel_row}">${E(v)}</span>`),...(r.derived||[]).map(d=>`<div class="pharma-cell-formula"><code>${E(d.cell)}: ${E(d.formula)}</code><span>${d.result===null?'输入不足':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:5}).format(d.result)}</span></div>`)]);
  const body=trs.length?`<div class="pharma-module-scroller"><table><thead><tr>${heads.map(h=>`<th>${E(h)}</th>`).join('')}</tr></thead><tbody>${trs.map(r=>`<tr>${r.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p>此模块没有提交可见表格行；请查看下面服务端指标原始来源，不得用无关记录填表。</p>';
  return `<h5>${E(t.title)} · 下载工作表「${E(t.sheet)}」· ${E(t.row_count)} 行（DOM可见行数，非数据库总数）</h5>${body}<p><b>逐列计算核对：</b>${(t.totals||[]).map(v=>`${E(v.name)}：${E(v.formula)}，可见求和 ${E(v.sum)}（仅同列数字核查）`).join('；')||'当前没有可按数值求和的列。'}</p>`;
 }).join('')||'<p>当前模块没有页面表格；如存在已绑定指标，应查看下面的指标源记录。</p>'}`;
 const evidence=`<h4>⑦ 指标背后的独立来源行（当前返回上限；不是界面快照）</h4>${(res.metrics||[]).map(m=>`<h5>${E(m.label)} · ${E(m.metric_id)} · ${E(m.rows?.length||0)} 行</h5>${m.rows?.length?rowTable(m.rows.slice(0,250).map(r=>Object.values(r)),Object.keys(m.rows[0])):'<p>本筛选范围没有可核对的独立来源行。</p>'}`).join('')||'<p>本组件未登记专属服务端指标，无法宣称拥有其独立来源行；请在验收清单登记为未完成，不得标记为管理层可验证。</p>'}`;
 const provenance=`<p class="pharma-manager-boundary">${E(x.source_note||'模拟数据仅用于演示，不是正式企业/GxP记录。')}</p>`;
 if(!isFull)return intro+metricsView+glossary+stepHtml+analysisHtml+paragraphsHtml+provenance;
 return intro+metricsView+glossary+tablesHtml+evidence+stepHtml+analysisHtml+paragraphsHtml+provenance;
}
function renderAudit(res){const fig=res.figures||[],metrics=res.metrics||[],actions=res.actions||[];
 const overview=`<div class="pharma-module-info"><b>证据等级：${E(res.status)}</b> · 指标 ${metrics.length} 项（已复算 ${res.summary?.computed_metrics||0}）· 规则 ${actions.length} 项 · 展示来源表 ${res.tables?.length||0} 张。<br>${E(res.boundary)}</div>`;
 const metricRows=metrics.map(m=>`<tr><td>${E(m.metric_id)}</td><td>${E(m.label)}</td><td>${E(m.formula||'未定义')}</td><td>${E(m.numerator??'缺少来源')}</td><td>${E(m.denominator??'不适用')}</td><td>${E((m.weights||[]).map(w=>typeof w==='object'?`${w.name||w.metric||w.dimension||'权重'}=${w.weight??w.value??'—'}`:w).join('；')||'不适用')}</td><td>${E(m.result??'证据不足')} ${E(m.unit||'')}</td><td>${E(m.source_class||'')}</td></tr>`).join('');
 const met=`<h4>一、各指标独立公式、权重与分子/分母（复合指标分开）</h4><div class="pharma-module-scroller"><table><thead><tr><th>指标 ID</th><th>指标</th><th>精确公式</th><th>分子</th><th>分母</th><th>权重/构成</th><th>本范围结果</th><th>来源</th></tr></thead><tbody>${metricRows||'<tr><td colspan="8">尚无已绑定的服务端公式；以下 UI 表不能代替可复算业务指标。</td></tr>'}</tbody></table></div>`;
 const steps=`<h4>二、计算顺序与数据分析过程</h4><ol>${(res.steps||[]).map(s=>`<li>${E(s)}</li>`).join('')}</ol>`;
 const source=`<h4>三、全部页面来源表（当前显示快照）</h4>${(res.tables||[]).map(t=>`<h5>${E(t.title)} · ${t.row_count??t.rows.length} 行</h5>${rowTable(t.rows||[],t.headers?.length?t.headers:Array.from({length:Math.max(...t.rows.map(r=>r.length),1)},(_,i)=>'列'+(i+1)))}`).join('')||'<p>没有可见表格。若图表的数据点没有对应来源输入，应补充原始记录；不能反推坐标轴。</p>'}`;
 const metricSource=`<h4>四、服务端源记录（不限于页面 Top 10）</h4>${metrics.map(m=>`<h5>${E(m.label)} · ${E(m.metric_id)} · 来源 ${E(m.source_class)}</h5>${m.rows?.length?rowTable(m.rows.slice(0,300).map(r=>Object.values(r)),Object.keys(m.rows[0])):'<p>该指标无可核验的原始来源行。</p>'}`).join('')}`;
 const words=`<h4>五、文字分析：逐项数据→公式→阈值→结论</h4>${actions.length?actions.map(a=>{
  const inputs=a.inputs||[];const inTable=inputs.length?`<div class="pharma-module-scroller"><table><thead><tr><th>输入指标</th><th>数值</th><th>计算公式</th><th>分子</th><th>分母</th><th>来源</th><th>证据状态</th></tr></thead><tbody>${inputs.map(x=>`<tr><td>${E(x.label||x.metric_id)}</td><td>${E(x.value??'证据不足')} ${E(x.unit||'')}</td><td>${E(x.formula||'未登记')}</td><td>${E(x.numerator??'缺少来源')}</td><td>${E(x.denominator??'缺少来源')}</td><td>${E(x.source_class||'')}</td><td>${E(x.status||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p>没有已登记的量化输入；不得断言根因。</p>';
  return `<div class="pharma-module-decision"><b>规则：${E(a.title)}</b><p><b>① 数字与计算依据：</b>先检查以下指标是否拥有有效源行、口径一致的分子分母。</p>${inTable}<p><b>② 触发条件：</b>${E((a.conditions||[]).join('；')||'尚无完整数值条件')}</p><p><b>③ 判断阈值：</b>${E((a.thresholds||[]).map(t=>`${t.field} ${t.operator} ${t.value}`).join('；')||'暂无可验证阈值')}</p><p><b>④ 分析过程：</b>${E(a.rationale)}</p><p><b>⑤ 行动结论：</b>${E(a.decision)}</p></div>`;
 }).join(''):'<p>本模块没有已登记的专属判断阈值。下方原分析文字只是展示性描述，不能当作 AI 已定位因果根因。</p>'}
 ${(res.narratives||[]).length?`<details><summary>查看页面原始分析文字（${res.narratives.length} 条）</summary><ol>${res.narratives.map(t=>`<li>${E(t)}</li>`).join('')}</ol></details>`:''}${(res.missing||[]).length?`<div class="pharma-module-warning"><b>待补证据：</b>${E(res.missing.join('；'))}</div>`:''}`;
 const contract=`<h4>模块级计算与判断契约（和其他模块不同）</h4><div class="pharma-module-info"><b>匹配领域规则：</b>${E((res.contract?.contracts||[]).join('、')||'尚未匹配；不能直接认定已有公式')}<p><b>计算顺序：</b>${E((res.contract?.methods||[]).join(' / ')||'请提供本模块相应的原始数据、量纲和业务审批版本。')}</p><p><b>缺口：</b>${E((res.contextual_metrics||[]).length?'本页其他相关指标仅为候选背景，不能代替当前图表的业务公式。':'已按本模块标题和明细列进行口径识别。')}</p></div>`;
 const tableMath=`<h4>展示表逐字段核算和逐行公式</h4>${(res.table_audits||[]).map((t,i)=>`<h5>${E(t.title)}（可见 ${t.visible_rows} / 已标记 ${t.row_count} 行）</h5><p>${E(t.calculations.map(c=>`${c.expression}［${c.limitation}］`).join('；')||'未检出可确认的金额、差额或权重列；可下载字段核查表，无法直接冒充已核验的业务计算。')}</p>${rowTable(t.columns.map(c=>[c.header,c.type,c.known_count,c.sum??'不适用',c.mean??'不适用']),['原始列','类型','可计算行数','可见列求和','可见列均值'])}`).join('')}`;
 const uiReconcile=`<h4>界面数值与来源计算结果对照</h4>${(res.display_reconciliations||[]).length?rowTable((res.display_reconciliations||[]).map(v=>[v.label,v.value,v.metric_id||'待绑定',v.source_result??'无同口径数值',v.delta??'无法比较',v.status]),['模块显示字段','界面原值','候选指标ID','源重算值','差额','对账限制状态']):'<p>本模块无可读取的独立数值标签；若为图表请按图表原始序列或明细表核验。</p>'}<p class="pharma-module-note">此处数值接近仅用于发现问题，无法证明来源的时间范围、物料、币种或发布版本一致。</p>`;
 const chartData=`<h4>图表逐个可见数据点和来源状态</h4>${(res.charts||[]).map(c=>`<h5>${E(c.title)} · ${E(c.chart_type)}</h5><p>${E(c.source_hint||'页面图表数据')}</p>${c.series.length?rowTable(c.series.map(x=>[x.element,x.label,x.value,x.position]),['显示元素','标签/类别','可见值（不反推）','位置仅供核对']):'<p>缺少可读取的图表数据点；必须补充原始序列才可证明曲线/散点的数值。</p>'}`).join('')||'<p>没有独立图表，按当前模块表格与来源行检查。</p>'}`;
 const textAudit=`<h4>所有文字分析逐段核查：数字→判断条件→建议</h4>${(res.narrative_audits||[]).length?rowTable((res.narrative_audits||[]).map(a=>[a.number,a.paragraph,a.metric_inputs.map(m=>m.metric_id+'='+String(m.value??'证据不足')).join('；'),a.related_action_ids.join('；')||'无已确认规则',a.rule_result||'没有可验证结论',a.status]),['序号','原文','输入数字（原始事实或缺口）','规则ID','计算/规则判断','验证状态']):'<p>本模块无文字结论，不需要伪造管理建议。</p>'}`;
 const strict=res.reconciliation||{};const strictView=`<h4>严格来源与界面对账 / V2.9.30</h4><p><b>综合状态：${E(strict.status||'尚未对账')}</b> · 来源指标独立复算 ${E(strict.summary?.source_metrics_recomputed||0)} 项 · 显示点通过 ${E(strict.summary?.display_passed||0)} · 显示点未核 ${E(strict.summary?.display_unverified||0)} · 图表未核 ${E(strict.summary?.charts_unverified||0)}。<br>只有ID、期间、单位、源行与版本完全相同才能认定通过；DEMO不可冒充企业数据。</p>${rowTable((strict.source_metrics||[]).map(m=>[m.metric_id,m.status,m.engine_result??'缺失',m.independent_result??'缺失',m.difference??'—',m.source_row_count??0,m.reason]),['指标','源行独立校验','引擎值','独立复算值','差异','来源行','说明'])}${rowTable((strict.charts||[]).map(m=>[m.title,m.status,m.point_passed??0,m.point_count,m.reason]),['图表','原始序列校验','点位已验','总点位','缺口'])}`;
 return `<details class="pharma-manager-audit"><summary>技术核验附录：来源审计等级、严格对账及原页面证据（按需展开）</summary>${overview+strictView+contract+met+steps+uiReconcile+tableMath+chartData+source+metricSource+words+textAudit}</details>`;
}
function render(res,mode){return executiveView(res,mode)+(mode==='full'?renderAudit(res):'');}
let active=new Map();let busy=false;
const modalToken=()=>window.PharmaEnterpriseView?.getToken?.()||'';
function session(){if(window.PharmaEnterpriseView?.isActive?.())return {source:'enterprise',token:modalToken()};return {source:'demo',token:''};}
function endpoint(path){const s=session(),sel=window.PharmaMetricAudit?.selection?.()||{};const p=new URLSearchParams({...sel,source:s.source});return path+'?'+p.toString()}
async function request(node,workbook=false){const data=capture(node),s=session();const routePath=workbook?'/api/lineage/module/workbook.xlsx':'/api/lineage/module';
 const rsp=await fetch(endpoint(routePath),{method:'POST',headers:{'content-type':'application/json',...(s.source==='enterprise'?{'Authorization':'Bearer '+s.token}:{})},body:JSON.stringify(data),cache:'no-store'});
 if(!rsp.ok){const msg=await rsp.json().catch(()=>({detail:'HTTP '+rsp.status}));throw Error(msg.detail||msg.error||('HTTP '+rsp.status))}
 return workbook?rsp.blob():rsp.json();
}
async function toggle(node,mode='full'){let region=node.querySelector(':scope > .pharma-module-inline');if(!region)return;
 const scope=JSON.stringify(window.PharmaMetricAudit?.selection?.()||{}),source=session().source;
 if(region.dataset.loaded==='yes'&&region.dataset.scope===scope&&region.dataset.source===source){
  if(region.dataset.view===mode){region.hidden=!region.hidden;return;}
  region.innerHTML=render(active.get(stableId(node)),mode);region.dataset.view=mode;region.hidden=false;return;
 }
 region.hidden=false;region.innerHTML='<p>正在整理本模块的变量、来源明细、单元格公式与文字分析…</p>';
 try{const r=await request(node);active.set(stableId(node),r);region.innerHTML=render(r,mode);region.dataset.loaded='yes';region.dataset.view=mode;region.dataset.scope=scope;region.dataset.source=source;}
 catch(e){region.innerHTML=`<p class="pharma-module-warning">本模块暂时无法加载计算服务：${E(e.message)}。请检查 Node API；不会用虚构公式填充。</p>`;}
}
async function excel(node){try{const blob=await request(node,true),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Pharma_模块计算依据_'+route()+'_'+stableId(node).split('.').pop()+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}catch(e){alert('模块公式 Excel 下载失败：'+e.message)}}
function attach(node){if(node.querySelector(':scope > .pharma-module-tools'))return false;
 const h=header(node),title=titleOf(node);stableId(node);
 const old=[...node.querySelectorAll(':scope > header .pharma-metric-trigger,:scope > header .pharma-action-trace,:scope > .pharma-component-trace')];old.forEach(x=>x.remove());
 const top=document.createElement('button');top.type='button';top.className='pharma-module-top';top.dataset.moduleAction='explain';top.textContent='∑ 本模块公式 / 分析依据';top.title='查看本模块独立指标、权重、来源及文字分析步骤';
 const tools=document.createElement('div');tools.className='pharma-module-tools';tools.innerHTML=`<button class="pharma-module-bottom" type="button" data-module-action="toggle">▤ 展开全量计算依据和来源表</button><button class="pharma-module-xlsx" type="button" data-module-action="excel">↓ Excel 含真实公式</button>`;
 const region=document.createElement('div');region.className='pharma-module-inline';region.hidden=true;
 node.appendChild(top);node.appendChild(tools);node.appendChild(region);node.classList.add('pharma-module-ready');return true;
}
function apply(){if(busy)return 0;busy=true;let total=0;try{for(const n of modules())total+=Number(attach(n));
  // Remove legacy red-flag placeholders inside cards now covered by a real
  // module-level evidence pack, without misrepresenting missing formulas.
  const root=selectRoot();root?.querySelectorAll('.pharma-component-trace').forEach(b=>{if(b.closest('.pharma-module-ready'))b.remove()});
  root?.querySelectorAll('.pharma-metric-trigger,.pharma-action-trace').forEach(b=>{if(b.closest('.pharma-module-ready'))b.remove()});
 }finally{busy=false}return total;}
let refresh=0;
function install(){const root=selectRoot();if(!root)return;apply();
 if(root.dataset.pharmaModuleObserved)return;root.dataset.pharmaModuleObserved='1';
 const observer=new MutationObserver(changes=>{const meaningful=changes.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&!isTrace(n)&&!n.matches?.('.pharma-module-tools,.pharma-module-inline,.pharma-module-top,.pharma-component-trace,.pharma-metric-trigger')));if(!meaningful)return;
  clearTimeout(refresh);refresh=setTimeout(()=>apply(),170)});
 observer.observe(root,{childList:true,subtree:true});
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-module-action]');if(!b)return;
 const n=b.closest('.pharma-module-ready');if(!n)return;e.preventDefault();e.stopImmediatePropagation();
 if(b.dataset.moduleAction==='excel')void excel(n);else void toggle(n,b.dataset.moduleAction==='explain'?'explain':'full');
},true);
window.PharmaModuleTrace={apply,capture,modules,version:'2.9.44',rules:['模块级指标和解释过程','模块级全量来源表及真实Excel公式']};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
