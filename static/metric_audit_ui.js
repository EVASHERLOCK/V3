/* V2.9.21 strict metric lineage product rule: context unique, source-scoped,
 * no generic formula masquerading as explanations for unrelated KPIs. */
(()=>{'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const route=()=>String(location.hash||'#overview').replace(/^#/,'').split('&')[0]||'overview';
const supported={
 'ss-overview':[ [/候选供应商|供应商目录|统一候选|市场候选|供应商总数/, 'SRC.CANDIDATE.TOTAL'],[/合格.*供应商|合格.*来源|合格.*关联/, 'SRC.QUAL.COMBINATIONS'],[/官方.*线索|官方.*发布/, 'SRC.CANDIDATE.OFFICIAL'],[/降本.*采购|原站采购金额/, 'SRC.PO.SPEND']],
 'ss-market':[[/供应商数量|候选数量/,'SRC.CANDIDATE.TOTAL'],[/原站.*价格|历史.*价格/,'SRC.PO.WEIGHTED_PRICE'],[/供应商.*分布/,'SRC.CANDIDATE.TOTAL']],
 'ss-cost':[[/采购金额|原站PO.*金额|历史.*Spend/,'SRC.PO.SPEND'],[/加权.*基准价|采购基准价|历史.*基线/,'SRC.PO.WEIGHTED_BASELINE'],[/成交.*单价|成交.*均价/,'SRC.PO.WEIGHTED_PRICE'],[/原始.*报价.*数|正式报价.*数/,'SRC.QUOTE.COUNT'],[/最优.*原始报价/,'SRC.QUOTE.BEST_LANDED']],
 'ss-performance':[[/采购金额|Spend/,'SRC.PO.SPEND'],[/供应商.*候选|目录.*供应商/,'SRC.CANDIDATE.TOTAL'],[/准时交付率|OTD/,'SRC.PO.OTD'],[/PPV/,'SRC.PO.PPV'],[/第二来源|单一来源|备选开发|管理建议/,'SRC.ACTION.DEVELOP_SECOND_SOURCE'],[/交付改善|交付风险/,'SRC.ACTION.DELIVERY_REVIEW']],
 'ss-project':[[/候选供应商/,'SRC.CANDIDATE.TOTAL'],[/资格.*数量|资格.*组合/,'SRC.QUAL.COMBINATIONS'],[/报价数/,'SRC.QUOTE.COUNT'],[/第二来源/,'SRC.ACTION.DEVELOP_SECOND_SOURCE']],
 'ss-compliance':[[/合格.*准入|准入.*组合/,'SRC.QUAL.COMBINATIONS'],[/文件.*有效率|文件完整率/,'SRC.DOC.VALID_RATE']],
 'ss-ai':[[/报价数|报价.*数量/,'SRC.QUOTE.COUNT'],[/候选供应商/,'SRC.CANDIDATE.TOTAL'],[/采购金额/,'SRC.PO.SPEND']],
 'ss-technical':[[/候选供应商|供应商目录/,'SRC.CANDIDATE.TOTAL']],
};
const expandedMappings=[
 [/发票.*匹配率|三单匹配率/i,'SRC.INVOICE.MATCH_RATE'],
 [/发票.*异常|匹配异常发票/i,'SRC.INVOICE.EXCEPTIONS'],
 [/逾期.*发票|发票.*逾期/i,'SRC.INVOICE.OVERDUE'],
 [/发票.*金额|发票总额/i,'SRC.INVOICE.AMOUNT'],
 [/库存.*待放行|待检.*库存/i,'SRC.INVENTORY.QC_HOLD'],
 [/复验.*90天|90天.*复验/i,'SRC.INVENTORY.RETEST_90'],
 [/库存.*批次数|库存批次登记/i,'SRC.INVENTORY.LOTS'],
 [/变更.*未关闭|未关闭.*变更/i,'SRC.CHANGE.OPEN'],
 [/变更控制.*登记/i,'SRC.CHANGE.COUNT'],
 [/工作流.*成功率|任务.*成功率/i,'SRC.WORKFLOW.SUCCESS_RATE'],
 [/工作流.*失败次数/i,'SRC.WORKFLOW.FAILURES'],
 [/演示.*预警.*高风险|高优先级预警/i,'SRC.ALERT.HIGH'],
 [/主数据.*物料.*数/i,'SRC.MASTER.MATERIALS'],
 [/主数据.*供应商.*数/i,'SRC.MASTER.SUPPLIERS'],
 [/^尚未收货数量|未收货数量|收货差额/i,'SRC.PO.UNRECEIVED_QTY'],
 [/^已收货数量|累计收货数量/i,'SRC.PO.RECEIVED_QTY'],
 [/未完全收货|未完成收货.*订单/i,'SRC.PO.INCOMPLETE_RECEIPTS'],
 [/延期.*采购金额|延期.*Spend/i,'SRC.PO.LATE_SPEND'],
 [/延期.*采购数量/i,'SRC.PO.LATE_QUANTITY'],
 [/CR3|前三大.*集中度/i,'SRC.PO.CR3_SHARE'],
 [/CR5|前五大.*集中度/i,'SRC.PO.CR5_SHARE'],
 [/^有效合同.*数|当前有效合同/i,'SRC.CONTRACT.ACTIVE'],
 [/^合同.*数量|^合同.*份数|合同登记/i,'SRC.CONTRACT.COUNT'],
 [/合同.*90天.*到期|90天.*到期合同/i,'SRC.CONTRACT.DUE90'],
 [/审计.*发现项|审计.*整改.*数/i,'SRC.AUDIT.OPEN_FINDINGS'],
 [/审计.*登记.*数|供应商.*审计.*数/i,'SRC.AUDIT.COUNT'],
 [/计划降本金额|降本.*目标金额/i,'SRC.SAVINGS.PLANNED'],
 [/已实现降本|实际降本金额/i,'SRC.SAVINGS.REALIZED'],
 [/降本.*达成率/i,'SRC.SAVINGS.ATTAINMENT'],
 [/演示质量事件|来料质量事件.*登记/i,'SRC.QEVENT.COUNT'],
 [/演示.*未关闭.*质量事件/i,'SRC.QEVENT.OPEN'],[/30\s*天.*到期|30\s*天.*临期/i,'SRC.DOC.DUE_30'],[/90\s*天.*到期|90\s*天.*临期/i,'SRC.DOC.DUE_90'],[/文件.*过期.*数/i,'SRC.DOC.EXPIRED_COUNT'],[/文件.*总数|受控文件数|文件登记数/i,'SRC.DOC.COUNT'],[/平均延期.*天/i,'SRC.PO.AVG_LATE_DAYS'],[/延期订单.*数|延期PO.*数/i,'SRC.PO.LATE_COUNT'],[/准时订单.*数/i,'SRC.PO.ON_TIME_COUNT'],[/收货完成率|采购收货数量完成率/i,'SRC.PO.RECEIPT_RATE'],[/平均.*落地.*单价/i,'SRC.QUOTE.AVG_LANDED'],[/Site.*Material.*记录数|资格登记数/i,'SRC.QUAL.RECORDED']];
const globalMappings=[[/^采购总额|采购金额\s*\(|Spend \(USD\)|原站.*Spend/i,'SRC.PO.SPEND'],[/^订单数量|PO.*数量|订单行数/,'SRC.PO.COUNT'],[/^OTD|准时交付率/,'SRC.PO.OTD'],[/^PPV|采购价格偏差率/,'SRC.PO.PPV'],[/^供应商总数|共享供应商目录|候选数/,'SRC.CANDIDATE.TOTAL']];
function identify(name,path=route()){
 const label=String(name||'').replace(/∑\s*(?:公式依据|公式)/g,'').trim();
 const found=[...expandedMappings,...(supported[path]||[]),...globalMappings].find(([re])=>re.test(label));if(found)return found[1];
 // A stable, item-specific UNREGISTERED identifier. No pretending two widgets
 // share an actual formula merely because they are on the same page.
 let h=2166136261;for(const ch of path+'|'+label){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
 return 'UNREGISTERED.'+path.replace(/[^\w-]/g,'_')+'.'+(h>>>0).toString(16);
}
function analysisIdentify(name,path=route()){
 const title=String(name||'').trim();
 if(/发票.*(匹配|三单)|三单.*异常/.test(title))return 'ACT.INVOICE.MATCH_EXCEPTION';
 if(/逾期.*发票|发票.*逾期/.test(title))return 'ACT.INVOICE.OVERDUE_REVIEW';
 if(/库存.*(复验|到期)|复验.*预警/.test(title))return 'ACT.INVENTORY.RETEST_REVIEW';
 if(/变更.*(控制|评估|整改)|变更.*未关闭/.test(title))return 'ACT.CHANGE.CONTROL_REVIEW';
 if(/工作流.*(失败|成功|异常)|任务.*重试/.test(title))return 'ACT.WORKFLOW.RELIABILITY';
 if(/高风险.*预警|预警.*核查/.test(title))return 'ACT.ALERT.HIGH_REVIEW';
 if(/合同.*(到期|续签)|合同续签/.test(title))return 'ACT.CONTRACT.RENEWAL';
 if(/降本.*(达成|复盘|兑现)|降本计划/.test(title))return 'ACT.SAVINGS.ATTAINMENT';
 if(/供应商.*审计.*(发现|整改)|审计发现项/.test(title))return 'ACT.AUDIT.FINDINGS';
 if(/收货.*(差额|缺口)|未收货数量/.test(title))return 'ACT.RECEIPT.GAP';
 if(/第二来源|单一来源|备选开发|供应结构风险/.test(title))return 'ACT.SOURCE.SECOND';
 if(/OTD|交付改善|交付风险|交付绩效/.test(title))return 'ACT.DELIVERY.INVESTIGATE';
 if(/成本.*偏差|采购价差|价格异常|价格复盘/.test(title))return 'ACT.COST.PPV';
 if(/文件.*(完整|缺口|整改)|补件|证据.*(有效|完整)/.test(title))return 'ACT.DOC.RECHECK';
 if(/集中度|依赖风险/.test(title))return 'ACT.RISK.SUPPLIER_CONCENTRATION';
 if(/CAPA.*(逾期|整改)|整改.*逾期/.test(title))return 'ACT.QMS.CAPA_ESCALATE';
 if(/重大质量事件|严重质量偏差/.test(title))return 'ACT.QMS.CRITICAL_REVIEW';
 if(/市场.*风险|官方.*情报|官方.*同步/.test(title))return 'ACT.MARKET.SUPPLY_SIGNAL';
 let h=2166136261;for(const c of path+'|analysis|'+title){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}
 return 'UNREGISTERED_ANALYSIS.'+path.replace(/[^\w-]/g,'_')+'.'+(h>>>0).toString(16);
}
function selection(){if(window.PharmaEnterpriseView?.isActive?.())return window.PharmaEnterpriseView.scope();let v={};try{v=JSON.parse(sessionStorage.getItem('pharma.sourcing.shared.selection')||'{}')}catch{}
 const cm=window.PharmaCostBaseline?.model?.(),am=window.PharmaAISourcing?.model?.(),pm=window.PharmaSourcingProject?.model?.();
 if(route()==='ss-cost'&&cm?.filters)v={...v,...cm.filters};
 else if(route()==='ss-ai'&&am?.filters)v={...v,...am.filters};
 else if(route()==='ss-project'&&pm?.material)v={...v,material:pm.material};
 return {material:String(v.material||'all'),supplier:String(v.supplier||'all'),year:String(v.year||'all')};}
const scopeParams=(obj,id)=>new URLSearchParams({...selection(),...(id?{id}:{}),...obj}).toString();
let current={id:null,label:null,visible:null,scope:null,result:null};
let enterpriseToken='',metricSource='demo';
const sourceHeaders=()=>metricSource==='enterprise'?{Authorization:'Bearer '+enterpriseToken}:{};
const sourceQuery=()=>metricSource==='enterprise'?'&source=enterprise':'';
const statusText=s=>({DEMO_RECOMPUTABLE:'可复算 · V08 演示原始记录',DEMO_RULE_ANALYSIS:'可复核的确定性规则（不是 AI 内部推理）',MISSING_LINEAGE:'尚未登记公式 · 不可判定',REQUIRES_SCOPE:'缺少必要筛选条件',INSUFFICIENT_SOURCE:'原始数据不足，禁止按零计算',ENTERPRISE_RECOMPUTABLE_NON_GXP:'已复核发布的企业API分析快照（未完成GxP验证）'})[s]||s;
const opts=(items)=>items.map(x=>`<span class="metric-scope-pill">${esc(x)}</span>`).join('');
function rowTable(rows){const keys=[...new Set(rows.flatMap(r=>Object.keys(r||{})))].filter(k=>!['erp_supplier','erp_documents','raw'].includes(k)).slice(0,22);const n=rows.length;
 const html=xs=>`<div class="pharma-metric-scroll"><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${xs.map(r=>`<tr>${keys.map(k=>`<td>${esc(r[k]&&typeof r[k]==='object'?JSON.stringify(r[k]):r[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 return `${html(rows.slice(0,10))}${n>10?`<details class="pharma-metric-more"><summary>展开其他 ${n-10} 条输入记录（按需查看）</summary>${html(rows.slice(10))}</details>`:''}`;
}
function showShell(title,id,visible){document.getElementById('pharma-metric-modal')?.remove();const overlay=document.createElement('div');overlay.id='pharma-metric-modal';overlay.className='pharma-metric-modal-layer';overlay.innerHTML=`<div class="pharma-metric-dialog" role="dialog" aria-modal="true" aria-label="逐指标计算依据"><header><div><h2>∑ ${esc(title)} · 计算与分析依据</h2><small>唯一指标 ID：${esc(id)} · ${esc(route())}</small></div><button type="button" data-audit="close" aria-label="关闭">×</button></header><div class="pharma-metric-body"><p>正在从统一服务端读取该指标的专属输入与规则…</p></div><footer><button type="button" data-audit="download">↓ 下载当前指标的 Excel 公式</button><button type="button" data-audit="close">关闭</button></footer></div>`;document.body.appendChild(overlay);}
function fill(r){const area=document.querySelector('#pharma-metric-modal .pharma-metric-body');if(!area)return;current.result=r;
 const obs=String(current.visible||'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);const display=obs?Number(obs[0]):null;
 const comparison=display!=null&&typeof r.result==='number'&&['DEMO_RECOMPUTABLE'].includes(r.status)&&Math.abs(display-r.result)>Math.max(.05,Math.abs(r.result)*.005)
  ?`<div class="pharma-metric-warning">⚠ 看板显示 ${esc(current.visible)}，但服务端按 ${esc(r.source_class)} 在同一范围重算为 ${esc(r.result)} ${esc(r.unit||'')}。<b>口径或数据层不一致，不能将这两者作为同一已核验指标。</b></div>`:'';
 const warn=r.status==='MISSING_LINEAGE'||r.status==='INSUFFICIENT_SOURCE'||r.status==='REQUIRES_SCOPE';
 const details=(r.rows||[]).length?rowTable(r.rows):`<p>本范围没有可用于重算的输入行。${esc((r.missing||[]).join('；'))}</p>`;
 const inputs=(r.inputs||[]).length?`<h3>分析输入与阈值</h3>${rowTable(r.inputs)}${(r.thresholds||[]).map(t=>`<p>${esc(t.field)} ${esc(t.operator)} ${esc(t.value)}</p>`).join('')}`:'';
 area.innerHTML=`<p class="${warn?'pharma-metric-warning':'pharma-metric-state'}"><b>${esc(statusText(r.status))}</b> · ${esc(r.source_class||'未登记来源')} · ${esc(r.source_release||'')}</p>${comparison}<div class="pharma-metric-summary"><div><small>重算结果</small><strong>${r.result==null?'不可计算':esc(r.result)} ${esc(r.unit||'')}</strong></div><div><small>分子</small><strong>${r.numerator==null?'—':esc(r.numerator)}</strong></div><div><small>分母</small><strong>${r.denominator==null?'—':esc(r.denominator)}</strong></div><div><small>权重</small><strong>${r.weights?.length?r.weights.map(w=>`${esc(w.name)} ${esc(w.weight)}%`).join('、'):'无加权／待登记'}</strong></div></div><h3>精确定义与计算公式</h3><code class="pharma-metric-formula">${esc(r.formula||'此指标尚未登记可核验公式')}</code><p>${esc(r.explanation||'')}</p><p>筛选范围：${opts(Object.entries(r.scope||{}).map(([k,v])=>`${k} = ${v}`))}</p>${inputs}<h3>计算的原始记录（Top 10，余下可展开）</h3>${details}<p class="pharma-metric-warning">数据源：${metricSource==='enterprise'?'已审核发布的企业分析快照（非GxP验证；全站企业模式禁止显示DEMO图表）':'内置 V08 DEMO'}。未登记和未知值不得当成0，未经批准的官方线索不代表准入。</p>`;
}
async function open(label, explicitId=null,visible=null){const id=explicitId||identify(label);current={id,label:String(label||id),visible,scope:selection(),result:null};showShell(current.label,id,visible);
 try{const resp=await fetch('/api/metrics/detail?'+scopeParams({},id)+sourceQuery(),{cache:'no-store',headers:sourceHeaders()});if(!resp.ok)throw Error('HTTP '+resp.status);const data=await resp.json();if(current.id===id)fill(data);}
 catch(err){const a=document.querySelector('#pharma-metric-modal .pharma-metric-body');if(a)a.innerHTML=`<div class="pharma-metric-warning">无法访问运行中的 Node 指标计算服务：${esc(err.message||err)}。静态预览不能提供经过服务端复算的依据。</div>`;}}
function fillAnalysis(r){const area=document.querySelector('#pharma-metric-modal .pharma-metric-body');if(!area)return;current.result=r;
 const registered=r.status!=='UNREGISTERED_ANALYSIS'&&r.status!=='INSUFFICIENT_EVIDENCE';
 const scopes=Object.entries(r.scope||{}).map(([k,v])=>`${k}=${v}`);
 const inputs=r.inputs||[];const rows=r.rows||[];
 area.innerHTML=`<p class="${registered?'pharma-metric-state':'pharma-metric-warning'}"><b>${esc(r.status)}</b> · ${esc(r.source_boundary||'计算来源待登记')}</p><h3>公开可复核的决策结论</h3><p><b>${esc(r.decision||'不可判定')}</b></p><h3>依据说明（不是AI私密推理或根因证明）</h3><p>${esc(r.rationale||'')}</p><h3>触发条件与指标权重 / 阈值</h3>${(r.conditions||[]).map(x=>`<p>${esc(x)}</p>`).join('')}${(r.thresholds||[]).length?rowTable(r.thresholds):'<p>尚未定义门槛。</p>'}<h3>参与判断的指标与计算公式</h3>${inputs.length?rowTable(inputs):'<p>缺少来源指标；请进行公式登记和业务验收。</p>'}<h3>原始输入证据 Top10（其他可展开）</h3>${rows.length?rowTable(rows):'<p>没有证据明细，不能宣称结论已通过核查。</p>'}<p>筛选条件：${opts(scopes)}</p><p class="pharma-metric-warning">业务根因必须通过审计、质量记录和采购调查确认。此窗口展示规则触发过程，不编造事故根因，也不把 DEMO 记录当成企业真实证据。</p>`;
}
async function openAnalysis(title,id=null){const aid=id||analysisIdentify(title);current={id:aid,label:title||aid,visible:null,scope:selection(),result:null};showShell(current.label,aid,null);
 try{const response=await fetch('/api/analysis/detail?'+scopeParams({},aid)+sourceQuery(),{cache:'no-store',headers:sourceHeaders()});if(!response.ok)throw Error('HTTP '+response.status);const result=await response.json();if(current.id===aid)fillAnalysis(result)}catch(e){const area=document.querySelector('#pharma-metric-modal .pharma-metric-body');if(area)area.innerHTML='<div class="pharma-metric-warning">规则说明服务不可用：'+esc(e.message||String(e))+'。必须连接 Node 服务。</div>'}
}
async function download(){const id=current.id||null,query=scopeParams({},id&&/^(UNREGISTERED|ACT\.)/.test(id)?null:id);
 try{const r=await fetch('/api/metrics/workbook.xlsx?'+query+sourceQuery(),{cache:'no-store',headers:sourceHeaders()});if(!r.ok||!String(r.headers.get('content-type')||'').includes('spreadsheetml.sheet'))throw Error('需要启动 Node 服务并安装依赖');const b=await r.blob();const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='Pharma_Metric_Lineage_'+route()+'_V2925.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
 catch(e){window.alert?.('下载失败：'+(e.message||String(e)));}}
let componentRecords=[];
function componentScan(root){
 componentRecords=[];const items=[...root.querySelectorAll('table,svg,canvas,[data-chart]')].filter(node=>{
  if(node.closest('#pharma-metric-modal,.pharma-metric-toolbar,.sidebar'))return false;
  if(node.tagName==='SVG'){
    const vb=String(node.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);
    if(vb.length<4||vb[2]<220||vb[3]<110)return false; // exclude decorative icons
  }
  if(node.tagName==='TABLE'&&(node.querySelectorAll('tr').length<2))return false;
  return true;
 }).slice(0,180);
 items.forEach((node,index)=>{
  if(node.dataset.lineageComponent)return;
  const section=node.closest('section,[class*="section"],[class*="panel"]');
  const title=section?.querySelector('header h2,header h3,h2,h3,strong')?.textContent?.trim()||'未命名图表或表格';
  const kind=node.tagName==='TABLE'?'表格':node.tagName==='SVG'||node.tagName==='CANVAS'?'图表':'数据可视化';
  const metricId=node.dataset.metricId||node.closest('[data-metric-id]')?.dataset.metricId||null;
  let hash=2166136261;for(const ch of route()+'|'+title+'|'+kind+'|'+index){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619)}
  const id=metricId||'UNREGISTERED_COMPONENT.'+route().replace(/[^\w-]/g,'_')+'.'+(hash>>>0).toString(16);
  const record={component_id:route()+'.'+kind+'.'+(index+1),context:title,kind,metric_id:id,status:metricId?'已显式绑定':'尚无精确绑定'};
  componentRecords.push(record);node.dataset.lineageComponent=record.component_id;
  if(node.closest('button,a')||node.parentElement?.querySelector(':scope > .pharma-component-trace'))return;
  const b=document.createElement('button');b.type='button';b.className='pharma-component-trace';b.dataset.audit='open';b.dataset.metricId=id;b.dataset.auditContext=title+' / '+kind;b.textContent=metricId?'∑ '+kind+'计算明细':'∑ '+kind+'血缘待登记';
  node.insertAdjacentElement('afterend',b);
 });
}
function componentIndex(){showShell('逐组件计算血缘覆盖检查','COMPONENTS.'+route(),null);const area=document.querySelector('#pharma-metric-modal .pharma-metric-body');if(!area)return;
 const ok=componentRecords.filter(x=>x.status==='已显式绑定').length;
 area.innerHTML=`<p class="pharma-metric-warning">当前页面检出 ${componentRecords.length} 个图表/表格组成元素，其中 ${ok} 个具有组件级显式指标 ID。这个检测只表示是否有绑定，<b>不表示自动确认业务计算正确</b>；其他需逐项补齐数据血缘和业务验收。</p>`+rowTable(componentRecords);
}
function apply(root){if(!root?.querySelectorAll)return;
 // V2.9.31 reference-faithful Change Control page owns its five indicator/source
 // panels and workbooks; do not layer duplicate generic toolbar/empty buttons.
 if(route()==='m09'&&root.querySelector('.cc31'))return;
 if(!root.querySelector('.pharma-metric-toolbar')){const bar=document.createElement('div');bar.className='pharma-metric-toolbar';bar.innerHTML='<span>∑ 指标血缘：按唯一ID复算。未登记会显式提示；企业数据与DEMO不合并。</span><button type="button" data-audit="page">本页已登记的指标</button><button type="button" data-audit="components">逐组件缺口核查</button><button type="button" data-audit="enterprise">选择企业来源（受控）</button><button type="button" data-audit="demo">切回演示来源</button><button type="button" data-audit="download">导出当前来源 Excel</button>';root.insertBefore(bar,root.querySelector('.top10-site-rule')?.nextSibling||root.firstChild)}
 // V2.9.28: module-specific formula and source tables are mandatory. Do not
 // attach empty UNREGISTERED placeholder buttons from the previous router.
 if(window.PharmaModuleTrace){window.PharmaModuleTrace.apply();return;}
 const sections=[...root.querySelectorAll('section')].slice(0,100);
 for(const section of sections){const head=section.querySelector(':scope > header');if(!head||head.querySelector('.pharma-metric-trigger'))continue;const title=head.querySelector('h2,h3,h4,strong,b')?.textContent?.trim()||'未命名业务模块';const id=identify(title);const b=document.createElement('button');b.type='button';b.className='pharma-metric-trigger';b.textContent=id.startsWith('UNREGISTERED.')?'∑ 血缘待登记':'∑ 公式/依据';b.dataset.audit='open';b.dataset.metricId=id;b.dataset.auditContext=title;head.appendChild(b);
 if(/结论|分析|建议|行动|整改|风险|诊断|复盘|依赖|供应商分级|官方情报/.test(title)&&!head.querySelector('.pharma-action-trace')){
  const actionId=analysisIdentify(title);const button=document.createElement('button');button.type='button';button.className='pharma-metric-trigger pharma-action-trace';button.dataset.audit='analysis';button.dataset.actionId=actionId;button.dataset.auditContext=title;
  button.textContent=actionId.startsWith('UNREGISTERED_ANALYSIS.')?'∑ 分析规则待登记':'∑ 结论依据';head.appendChild(button)
 }
 }
 const cards=[...root.querySelectorAll('.cb-kpi,.spf-score-card,.ss2-kpi,.sp-summary>div,.ai-kpi,.v16-kpi,.exec-kpi,.m02-kpi,.som-kpi,.kpi-card,.stat-card,.sso-kpi')].slice(0,140);
 for(const card of cards){if(card.matches('button,a')||card.querySelector(':scope > .pharma-metric-kpi-trigger'))continue;const val=card.querySelector('strong,.value,.kpi-value,.number');if(!val||!/[0-9]/.test(val.textContent||''))continue;const title=card.querySelector('b,h2,h3,h4,label')?.textContent?.trim()||'未命名指标';const id=identify(title);const b=document.createElement('button');b.type='button';b.className='pharma-metric-kpi-trigger';b.dataset.audit='open';b.dataset.metricId=id;b.dataset.auditContext=title;b.dataset.visibleValue=val.textContent.trim().slice(0,50);b.textContent='∑ 公式';card.style.position='relative';card.appendChild(b)}
 componentScan(root);
}
async function pageIndex(){const path=route();showShell('页面指标口径目录','PAGE.'+path,null);try{const r=await fetch('/api/metrics/page?route='+encodeURIComponent(path),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();const body=document.querySelector('#pharma-metric-modal .pharma-metric-body');if(!body)return;body.innerHTML=`<p class="pharma-metric-warning">本页登记 ${d.registered_count||0} 个精确公式；其余卡片、文字建议及无来源指标仍需逐个验收，绝不把目录视为 100% 覆盖。</p><div class="pharma-metric-scroll"><table><thead><tr><th>指标 ID</th><th>指标名称</th><th>口径</th><th>操作</th></tr></thead><tbody>${(d.metric_ids||[]).map(x=>`<tr><td>${esc(x.metric_id)}</td><td>${esc(x.label)}</td><td>${esc(x.formula)}</td><td><button data-audit="open" data-metric-id="${esc(x.metric_id)}" data-audit-context="${esc(x.label)}">查看输入与公式</button></td></tr>`).join('')}</tbody></table></div>`;}catch(e){const area=document.querySelector('#pharma-metric-modal .pharma-metric-body');if(area)area.textContent='页面指标目录读取失败：'+String(e.message||e)}}
document.addEventListener('click',e=>{const t=e.target.closest('[data-audit]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();if(t.dataset.audit==='page')void pageIndex();if(t.dataset.audit==='components')componentIndex();if(t.dataset.audit==='enterprise'){const entered=window.prompt?.('请输入服务端 SOURCING_ADMIN_TOKEN（仅保存在当前页面内存）','');if(entered){enterpriseToken=entered;metricSource='enterprise';window.PharmaEnterpriseView?.activate?.(entered)}}if(t.dataset.audit==='demo'){metricSource='demo';enterpriseToken='';window.PharmaEnterpriseView?.activate?.(null)}if(t.dataset.audit==='open')void open(t.dataset.auditContext||'未命名指标',t.dataset.metricId||null,t.dataset.visibleValue||null);if(t.dataset.audit==='analysis')void openAnalysis(t.dataset.auditContext||'未命名分析',t.dataset.actionId||null);if(t.dataset.audit==='download')void download();if(t.dataset.audit==='close')document.getElementById('pharma-metric-modal')?.remove()},true);
window.PharmaMetricAudit={apply,open,openAnalysis,download,identify,analysisIdentify,selection,componentCoverage:()=>componentRecords.slice(),STATUS:()=>({state:'按指标唯一ID计算，不完整则标记MISSING_LINEAGE'}),COVERAGE:'V2925_ALL_26_ROUTES_ENTERPRISE_REPLACEMENT;77_EXACT_METRICS_PARTIAL_COMPONENT_BINDING'};
})();
