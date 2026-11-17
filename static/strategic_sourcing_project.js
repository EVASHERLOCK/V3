/* Pharma Procurement AI V2.9.14 — Sourcing Project Lifecycle Workbench.
 * Full-width critical modules. Complex pharmaceutical onboarding scenario with
 * change control, QA/QC, RA and supply constraints explicitly modelled.
 */
(()=>{'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=x=>Number(x)||0, F=(x,d=0)=>x==null||!Number.isFinite(+x)?'—':new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(+x);
const ST={raw:null,loading:false,error:'',material:'API-001',selectedSupplier:'',detail:null};
const SCORE_WEIGHTS={quality:.24,delivery:.18,technical:.22,compliance:.22,commercial:.14};
try{const x=JSON.parse(sessionStorage.getItem('pharma.sourcing.shared.selection')||'{}');if(x.material)ST.material=x.material;if(x.supplier)ST.selectedSupplier=x.supplier}catch{}
const catalog=()=>window.PharmaSourcingUniverse?.catalog||[];
const hash=str=>{str=String(str||'');let h=0;for(let i=0;i<str.length;i++)h=(h*33+str.charCodeAt(i))>>>0;return h||1};
const addDays=(base,days)=>{const d=new Date(base+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const diff=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/86400000);
const MATERIAL_DOCS=['供应商主档/问卷','营业执照/法人信息','GMP 证书','ISO 证书','Site Master File','质量协议','保密协议 NDA','报价单 / RFQ 回复','工艺路线概述','关键杂质谱/方法学资料','CoA 模板','稳定性/留样方案','TSE/BSE / allergen 声明','残留溶剂/元素杂质评估','变更通知协议','运输/包装验证','环境/ESG 问卷','审计报告与 CAPA','注册支持文件（DMF/CEP/LoA）','上市声明/市场适配声明','首批供货放行资料','供应连续性与业务恢复计划'];
function getSuppliers(raw,material){
  const category=catalog().find(r=>r.material_id===material)?.material_category;
  const rows=catalog().filter(r=>r.material_id===material);
  const quotes=(raw.sourcing?.quotes||[]).filter(q=>q.material_id===material),masters=raw.master?.suppliers||[];
  for(const q of quotes)if(!rows.some(r=>r.supplier_id===q.supplier_id)){
    const c=catalog().find(r=>r.supplier_id===q.supplier_id),sm=masters.find(r=>r.supplier_id===q.supplier_id);
    rows.push({...c,supplier_id:q.supplier_id,supplier_name:sm?.supplier_name||c?.supplier_name||q.supplier_id,material_id:material,is_scenario:!sm,country:sm?.country||c?.country||'未知',data_origin:sm?'BASE_DEMO':'LOCAL_UPLOAD'});
  }
  // A short material-specific pool is supplemented only with clearly marked
  // same-category cross-material prospects, never as approved material sources.
  if(rows.length<10)for(const c of catalog()){
    if(rows.length>=10)break;
    if(c.material_id!==material&&c.material_category===category&&!rows.some(x=>x.supplier_id===c.supplier_id))
      rows.push({...c,is_scenario:true,cross_material_lead:true});
  }
  const src=raw.qualification?.sources||[],cards=raw.supplier?.scorecards||[];
  return rows.map(r=>{
    const h=hash(r.supplier_id+'|'+material),q=quotes.find(x=>x.supplier_id===r.supplier_id);
    const master=masters.find(x=>x.supplier_id===r.supplier_id),card=cards.find(x=>x.supplier_id===r.supplier_id);
    const quality=master?.quality_score!=null?Number(master.quality_score):80+(h%16);
    const delivery=card?.otd!=null?Number(card.otd):76+((h >>> 2)%20);
    const technical=79+((h >>> 3)%18),compliance=74+((h >>> 4)%22),commercial=77+((h >>> 5)%19);
    const score=quality*.24+delivery*.18+technical*.22+compliance*.22+commercial*.14;
    const source=src.find(x=>x.supplier_id===r.supplier_id&&x.material_id===material);
    return {supplier_id:r.supplier_id,supplier_name:r.supplier_name,is_scenario:!!r.is_scenario,cross_material_lead:!!r.cross_material_lead,country:r.country,
      quality,delivery,technical,compliance,commercial,score:Math.round(score*10)/10,
      quote:q?Number(q.unit_price)*Number(q.fx_to_usd||1):Math.round((108+(h%28)+(h%5)*.25)*100)/100,
      quote_origin:q?'V08_DEMO_QUOTE':'SCENARIO_ONLY',score_origin:'COMPOSITE_DEMO_MODEL',
      stage:r.cross_material_lead?'跨物料候选 · 需适配':source?.approved_for_use?'原站DEMO准入关系（需正式核验）':'线索 / 资料待核验',
      lead:q?Number(q.lead_days):34+(h%34),docsReady:null,sampleLots:null,risk:['低','中低','中','中高'][h%4]
    };
  }).sort((a,b)=>b.score-a.score).map((r,i)=>({...r,rank:i+1}));
}
function schedule(asof){
  const start=addDays(asof,-25);
  const defs=[
    ['需求定义与立项澄清',6,'采购 / 研发','确认需求、预估年量、目标市场与立项目标'],
    ['品类策略与寻源方案',7,'采购 / 战略寻源','明确单一来源风险、目标国家和备选策略'],
    ['RFI / NDA / 基础资料收集',10,'采购 / 法务','收集供应商基础信息、签署 NDA、首轮问卷'],
    ['RFQ / 商务条款询价',9,'采购','报价、MOQ、Incoterms、账期和产能窗口'],
    ['样品申请与发运',8,'采购 / 供应商','锁定样品批次、运输条件和报关资料'],
    ['样品接收与静置检查',7,'仓储 / QC','收样、标签核对、外观检查、静置观察'],
    ['化学检测 / 分析方法学',12,'QC / 研发','鉴别、含量、杂质、残留溶剂、元素杂质'],
    ['物理 / 机械性实验',9,'QC / 工艺','粒径、流动性、堆密度、压片/灌装适配'],
    ['中试 / 工艺适配验证',14,'研发 / 工艺 / 生产','小试、中试、收率和放大风险确认'],
    ['QA 质量体系审计 / A&Q',12,'QA / A&Q','质量体系审计、数据完整性和 CAPA 核查'],
    ['RA / 合规文件与市场适配',11,'RA / QA','DMF/CEP/LoA、上市声明、目标市场限制核查'],
    ['Change Control / 准入评审',10,'QA / CMC / 采购','变更影响评估、跨部门准入评审'],
    ['商务谈判 / 合同 / 质量协议',8,'采购 / 法务 / QA','框架合同、质量协议、供货保障条款'],
    ['首批商业订单与排产锁定',7,'采购 / 计划','首单排产、产能预留和交付窗口确认'],
    ['到货检验 / QA 放行',9,'QC / QA / 仓储','来料检验、偏差处理和最终放行'],
    ['上市支持与项目关闭',6,'RA / 研发 / 采购','归档、上市声明和项目复盘']
  ];
  let cursor=start;return defs.map(([name,days,owner,scope],i)=>{const from=cursor,to=addDays(from,days-1);cursor=addDays(to,1);const status=to<asof?'情景已结束 · 未签核':from<=asof?'情景进行中 · 未签核':'尚未开始 · 未签核';return {id:'STG-'+String(i+1).padStart(2,'0'),name,days,owner,scope,from,to,status,scenario:true}})
}
function milestoneRows(stages){
  const mapping=[
    ['需求冻结','采购 / 研发','年量、目标成本、关键质量属性确认'],['候选供应商长名单完成','采购','至少 10 家候选资料收齐'],['样品到厂并通过收样检查','仓储 / QC','完成静置和外观检查'],['化学分析通过','QC','关键质量指标通过'],['中试验证通过','工艺 / 研发','工艺适配和收率接受'],['QA 审计关闭','QA / A&Q','关键观察项关闭'],['RA 文件齐套','RA','DMF/CEP/LoA/市场声明齐全'],['Change Control 批准','QA / CMC','变更控制批准'],['质量协议和合同签署','采购 / 法务 / QA','正式签署'],['首批排产锁定','计划 / 采购','产能和交期确认'],['首批到货 QA 放行','QC / QA','检验放行'],['项目复盘关闭','采购 / 研发 / QA','绩效与经验复盘']
  ];
  return mapping.map((m,i)=>({name:m[0],owner:m[1],requirement:m[2],target:stages[Math.min(stages.length-1,i+1)].to,status:'计划情景 · 待签核',evidenceCount:0}));
}
function build(raw, material='API-001'){
  const materials=raw.master?.materials||[];const mat=materials.find(x=>x.material_id===material);
  const suppliers=getSuppliers(raw,material);
  const stages=schedule(raw.meta?.as_of||'2026-11-01');
  const milestones=milestoneRows(stages);
  const quotes=(raw.sourcing?.quotes||[]).filter(x=>x.material_id===material);
  const orders=(raw.purchasing?.orders||[]).filter(x=>x.material_id===material);
  const present=raw.qualification?.documents?.filter(x=>x.material_id===material)||[];
  const docPattern=[null,null,/GMP/i,/ISO/i,/Site Master/i,/Quality Agreement/i,/NDA/i,/Quote/i,/Process/i,/Impurity|Method/i,/CoA|Analysis/i,/Stability/i,/TSE|BSE|Allergen/i,/Solvent|Element/i,/Change/i,/Transport|Packaging/i,/ESG/i,/Audit|CAPA/i,/Regulatory|DMF|CEP/i,/Market|Listing/i,/Release/i,/Continuity/i];
  const docs=MATERIAL_DOCS.map((name,i)=>{
    const matched=docPattern[i]?present.filter(x=>docPattern[i].test(x.type||'')):[];
    return {doc_id:'REQ-'+String(i+1).padStart(3,'0'),name,owner:['采购','QA','QC','RA','法务','研发','仓储 / 计划'][i%7],mandatory:i<18?'需核对':'视产品/市场',
      status:matched.length?'源站DEMO登记 '+matched.length+' 份（需核验）':'无已关联证据 · 待收集',supplierCoverage:new Set(matched.map(x=>x.supplier_id)).size, matchedSuppliers:[...new Set(matched.map(x=>x.supplier_id))], sourceIds:matched.map(x=>x.doc_id||x.id||'登记待核验'),
      remarks:i===17?'需关联审计报告和正式CAPA关闭证明':i===18?'按目标市场核实注册适用性':'不可据此认定已正式提交/批准'};
  });
  const docGroups=[
    {name:'基础准入文件',count:6,rows:docs.slice(0,6)},
    {name:'商务与合同文件',count:3,rows:docs.slice(6,9)},
    {name:'技术 / 质量文件',count:6,rows:docs.slice(9,15)},
    {name:'合规 / 注册文件',count:4,rows:docs.slice(15,19)},
    {name:'首批供货 / 收尾文件',count:3,rows:docs.slice(19)}
  ];
  const constraints={
    capacity:suppliers.slice(0,10).map((s,i)=>({supplier:s.supplier_name,capacity:280+i*36,load:65+((i*7)%28)})),
    inventory:[['研发样品库存',12],['中试库存',24],['商业安全库存',38],['在途库存',18]],
    schedule:[['11/05','样品到厂'],['11/12','分析检测完成'],['11/19','中试完成'],['11/27','审计关闭'],['12/05','CC 评审'],['12/16','首单放行']],
    quality:[['QC 检测周期',10],['偏差/CAPA 关闭周期',24],['QA 审计资源负荷',78],['放行及时率',93]],
    regulatory:[['DMF/CEP 收集',86],['上市声明准备',68],['目标市场适配确认',72],['变更影响评估',81]],
    logistics:[['供应商产能锁定',74],['排产锁定',69],['运输窗口可用性',77],['仓储/到货准备',88]]
  };
  const evidenceBySupplier=Object.fromEntries(suppliers.map(s=>[s.supplier_id,docs.map(d=>({...d,hasEvidence:d.matchedSuppliers.includes(s.supplier_id)}))]));
  const metrics={supplierCount:suppliers.length, formalQuotes:quotes.length, docCount:docs.length, milestoneCount:milestones.length, stageCount:stages.length, ordered:orders.reduce((s,x)=>s+N(x.ordered_qty),0), hasFormalProject:false, planDone:0};
  return {raw,material,materialName:mat?.name||material,suppliers,stages,milestones,documents:docs,docGroups,evidenceBySupplier,constraints,quotes,orders,metrics,materialList:[...new Set([...(materials.map(x=>x.material_id)),...catalog().map(x=>x.material_id)])],hasFormalProject:false};
}
function table(rows, headers, rowFn){const top=rows.slice(0,10), rest=rows.slice(10);return `<div class="sp-table-wrap"><table class="sp-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${top.map(rowFn).join('')}</tbody></table>${rest.length?`<details class="sp-more"><summary>展开其余 ${rest.length} 条记录（Top10 之外）</summary><table class="sp-table"><tbody>${rest.map(rowFn).join('')}</tbody></table></details>`:''}</div>`}
function section(t,icon,b){return `<section class="sp-panel"><header><h2><i>${icon}</i>${E(t)}</h2><button class="sp-help" data-sp-help="${E(t)}">?</button></header><div class="sp-panel-body">${b}</div></section>`}
function header(m){return `<div class="sp-head"><div><h1>寻源项目全流程管理工作台</h1><p>复杂药企原材料 / 新供应商准入模板，覆盖 change control、QC/QA/RA 及首批放行；日期、进度及非源数据均为规划情景，绝非已批准项目。</p></div><div class="sp-toolbar"><label>项目物料<select data-sp-project>${m.materialList.map(id=>`<option value="${E(id)}" ${id===m.material?'selected':''}>${E(id)} · ${E(m.raw.master?.materials?.find(x=>x.material_id===id)?.name||id)}</option>`).join('')}</select></label><button type="button" data-audit="download">∑ 下载计算公式 Excel</button><button data-sp-action="export">↓ 导出项目报表</button></div></div><div class="sp-summary">${[['统一候选供应商',m.metrics.supplierCount],['原站DEMO报价',m.metrics.formalQuotes],['项目阶段数',m.metrics.stageCount],['关键里程碑',m.metrics.milestoneCount],['文档清单',m.metrics.docCount]].map(x=>`<div><small>${x[0]}</small><strong>${F(x[1])}</strong></div>`).join('')}</div>`}
function gantt(m){
 const rows=m.stages,start=rows[0].from,end=rows.at(-1).to,total=diff(start,end)+1,asof=m.raw.meta?.as_of||'2026-11-01';
 const w=1280,l=405,r=20,t=69,rowH=33,h=t+rows.length*rowH+18,cw=w-l-r;
 const monthStart=new Date(start+'T00:00:00Z');monthStart.setUTCDate(1);const months=[];
 for(let d=new Date(monthStart);d<=new Date(end+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1)){
   const first=d.toISOString().slice(0,10),next=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)).toISOString().slice(0,10);
   const left=Math.max(0,diff(start,first))/total*cw,right=Math.min(total,diff(start,next))/total*cw;
   months.push({label:first.slice(0,7),x:l+left,width:Math.max(0,right-left)});
 }
 const x=date=>l+Math.max(0,diff(start,date))/total*cw;
 const clamp=v=>Math.min(100,Math.max(0,v));
 const todayX=x(asof),showToday=asof>=start&&asof<=end;
 const progress=rows.map(r=>r.status.includes('情景已结束')?100:r.status.includes('情景进行中')?clamp((diff(r.from,asof)+1)/r.days*100):0);
 const overall=Math.round(progress.reduce((a,b)=>a+b,0)/rows.length);
 const svg=`<div class="sp-gantt-title"><div>项目周期：<b>${E(start)} — ${E(end)}</b>（${total} 天）</div><div>排程情景进度：<b>${overall}%</b><span class="sp-gantt-progress"><i style="width:${overall}%"></i></span></div></div><div class="sp-gantt-scroll"><svg viewBox="0 0 ${w} ${h}" class="sp-gantt-svg" role="img" aria-label="全流程项目甘特图，包括任务、计划区间、情景进度和月份刻度"><defs><linearGradient id="spDone" x1="0" x2="1"><stop stop-color="#64d68a"/><stop offset="1" stop-color="#25a760"/></linearGradient><linearGradient id="spDoing" x1="0" x2="1"><stop stop-color="#65b5ff"/><stop offset="1" stop-color="#2176eb"/></linearGradient></defs>
 <rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>${months.map((v,i)=>`<rect x="${v.x}" y="35" width="${v.width}" height="${h-35}" fill="${i%2?'#f7faff':'#edf5ff'}"/><line x1="${v.x}" y1="35" x2="${v.x}" y2="${h}" stroke="#cfdded"/><text x="${v.x+v.width/2}" y="24" text-anchor="middle" font-size="15" font-weight="700" fill="#27518a">${v.label}</text>`).join('')}
 <text x="18" y="26" font-size="15" font-weight="700" fill="#30547e">阶段 / 责任部门</text><text x="232" y="26" font-size="15" font-weight="700" fill="#30547e">计划周期</text><text x="345" y="26" font-size="15" font-weight="700" fill="#30547e">进度</text>
 ${rows.map((v,i)=>{const y=t+i*rowH,bx=x(v.from),width=Math.max(10,x(v.to)-bx+cw/total);const color=v.status.includes('情景已结束')?'url(#spDone)':v.status.includes('情景进行中')?'url(#spDoing)':'#b7c7dc';const bg=i%2?'#fafdff':'#ffffff';const mark=v.status.includes('情景已结束')?'✓':v.status.includes('情景进行中')?'◌':'·';return `<g data-sp-open="stage:${i}" style="cursor:pointer"><rect x="0" y="${y-15}" width="${w}" height="${rowH}" fill="${bg}" opacity=".64"/><line x1="0" y1="${y+17}" x2="${w}" y2="${y+17}" stroke="#dfe9f5"/><circle cx="25" cy="${y+1}" r="6" fill="${v.status.includes('情景已结束')?'#35bb76':v.status.includes('情景进行中')?'#3286f5':'#9cb0ca'}"/><text x="40" y="${y+6}" font-size="12" font-weight="700" fill="#264d80">${E(v.name)}</text><text x="232" y="${y+6}" font-size="10.6" fill="#49688f">${v.from.slice(5)} ~ ${v.to.slice(5)}</text><rect x="343" y="${y-10}" width="56" height="19" rx="9.5" fill="${v.status.includes('情景已结束')?'#ddf7e5':v.status.includes('情景进行中')?'#e2f0ff':'#edf1f6'}"/><text x="371" y="${y+3}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${v.status.includes('情景已结束')?'#238e57':v.status.includes('情景进行中')?'#2075d6':'#637d9e'}">${mark} ${Math.round(progress[i])}%</text><rect x="${bx}" y="${y-11}" width="${width}" height="22" rx="6" fill="${color}"/><title>${E(v.name)}：${v.from} 至 ${v.to}，情景完成${Math.round(progress[i])}%｜${E(v.scope)}</title></g>`}).join('')}
 ${showToday?`<line x1="${todayX}" y1="35" x2="${todayX}" y2="${h}" stroke="#1976ed" stroke-width="2" stroke-dasharray="5 4"/><rect x="${todayX-40}" y="38" width="80" height="22" rx="5" fill="#2c7def"/><text x="${todayX}" y="53" text-anchor="middle" fill="#fff" font-size="11">模拟截至 ${asof.slice(5)}</text>`:''}</svg></div><div class="sp-gantt-legend"><span><i class="done"></i>情景已结束</span><span><i class="doing"></i>情景进行中</span><span><i class="later"></i>尚未开始</span><span>点击阶段查看起止时间、时长与判断依据；不等于真实 QA 放行</span></div>`;
 return svg;
}
function docsPanel(m){
 const selected=m.suppliers.find(x=>x.supplier_id===ST.selectedSupplier)||m.suppliers[0];const rows=m.evidenceBySupplier[selected?.supplier_id]||m.documents;
 const groupSummaries=m.docGroups.map(group=>{const groupRows=rows.filter(r=>group.rows.some(x=>x.doc_id===r.doc_id));return {...group,available:groupRows.filter(r=>r.hasEvidence).length,missing:groupRows.filter(r=>!r.hasEvidence).length}});
 const sel=`<div class="sp-doc-select"><label>选择供应商查看该厂址 / 物料的文件核对结果 <select data-sp-supplier>${m.suppliers.map(x=>`<option value="${E(x.supplier_id)}" ${x.supplier_id===selected?.supplier_id?'selected':''}>${E(x.supplier_name)} · ${x.is_scenario?'情景线索':'原站DEMO'}</option>`).join('')}</select></label><p>仅 <b>✓ 已登记</b> 代表原始 DEMO 中存在该供应商、当前物料的文件元数据；不代表正式有效或QA批准。<b>✕ 未登记</b> 表示仍需补件核验。</p></div>`;
 return `${sel}<div class="sp-doc-grid">${groupSummaries.map(g=>`<div class="sp-doc-card"><b>${E(g.name)}</b><span class="sp-doc-count">✓ ${g.available} 已登记 &nbsp; ✕ ${g.missing} 待补</span><ul>${rows.filter(x=>g.rows.some(d=>d.doc_id===x.doc_id)).map(r=>`<li class="${r.hasEvidence?'has':'missing'}"><b>${r.hasEvidence?'✓':'✕'}</b> ${E(r.name)}</li>`).join('')}</ul></div>`).join('')}</div><div class="sp-doc-summary"><strong>该供应商文件核查汇总：</strong>共 ${rows.length} 项，<b class="yes">${rows.filter(x=>x.hasEvidence).length} 项有登记</b>，<b class="no">${rows.filter(x=>!x.hasEvidence).length} 项缺少登记</b>；具体可用性须按证书版本、生产站点、市场和质量体系审核。</div>${table(rows,['登记核查','文件名称','Owner','必需','当前状态','覆盖供应商数','证据记录','备注'],r=>`<tr data-sp-open="document:${E(r.doc_id)}"><td><span class="sp-doc-mark ${r.hasEvidence?'has':'missing'}">${r.hasEvidence?'✓':'✕'}</span></td><td>${E(r.name)}</td><td>${E(r.owner)}</td><td>${E(r.mandatory)}</td><td>${r.hasEvidence?'有源站登记 · 待验证':'缺少当前供应商/物料证据'}</td><td>${F(r.supplierCoverage)}</td><td>${E(r.sourceIds.join('、')||'—')}</td><td>${E(r.remarks)}</td></tr>`)}`;
}
function supplierMatrix(m){const ws=SCORE_WEIGHTS;return `<div class="sp-formula-banner"><b>计算公式：</b>综合评分 = 质量×24% + 交付×18% + 技术×22% + 合规×22% + 商务×14%；数据来源为原站 DEMO 档案和可识别的情景分项。<button data-sp-open="scoring:all">查看分项公式和原始表</button></div>${table(m.suppliers,['排名','供应商','国家','综合得分','质量 (24%)','交付 (18%)','技术 (22%)','合规 (22%)','商务 (14%)','报价 USD/kg','状态','计算依据'],r=>`<tr data-sp-open="supplier:${E(r.supplier_id)}"><td>${r.rank}</td><td><b>${E(r.supplier_name)}</b><br><small>${E(r.cross_material_lead?'跨物料情景线索':r.is_scenario?'扩展情景候选':'原站DEMO')}</small></td><td>${E(r.country)}</td><td><strong>${F(r.score,1)}</strong></td>${['quality','delivery','technical','compliance','commercial'].map(k=>`<td><b>${F(r[k],1)}</b><small class="sp-contribution"> ×${F(ws[k]*100)}% = ${F(r[k]*ws[k],2)}</small></td>`).join('')}<td>${F(r.quote,2)}</td><td>${E(r.stage)}</td><td><button type="button" class="sp-evidence-btn" data-sp-open="supplier:${E(r.supplier_id)}">∑ 公式与来源</button></td></tr>`)}`}
function milestonePanel(m){return table(m.milestones,['里程碑','责任部门','关键要求','目标日期','状态','佐证数量'],r=>`<tr><td>${E(r.name)}</td><td>${E(r.owner)}</td><td>${E(r.requirement)}</td><td>${E(r.target)}</td><td>${E(r.status)}</td><td>${r.evidenceCount>0?F(r.evidenceCount):'未签核'}</td></tr>`) }
function capacityBars(rows){
  const top=rows.slice(0,8),max=100;
  return `<div class="sp-capacity-bars">${top.map(r=>`<div class="sp-capacity-row"><span>${E(r.supplier)}</span><div class="sp-capacity-track"><i style="width:${Math.min(max,r.load)}%"></i></div><b>${F(r.load,0)}%</b><small>${F(r.capacity,0)} t/y</small></div>`).join('')}</div>`;
}
function constraintsPanel(m){
  const metrics=[...m.constraints.quality.map(x=>({domain:'质量 / QC / QA',metric:x[0],value:x[1],unit:x[0].includes('周期')?'天':'%'})),
    ...m.constraints.regulatory.map(x=>({domain:'RA / 合规',metric:x[0],value:x[1],unit:'%'})),
    ...m.constraints.logistics.map(x=>({domain:'计划 / 物流 / 仓储',metric:x[0],value:x[1],unit:'%'}))];
  const kpis=[['情景产能平均负荷',F(m.constraints.capacity.length?m.constraints.capacity.reduce((a,x)=>a+x.load,0)/m.constraints.capacity.length:null,1)+'%'],
    ['样品 / 中试 / 商业库存','待 ERP 导入'],['QA / QC 资源负荷','78% · 情景'],['RA 文件准备度','77% · 情景'],['首单排产确定性','69% · 情景'],['首批放行及时率','93% · 情景']];
  return `<div class="sp-constraints"><div class="sp-cards">${kpis.map(x=>`<div><small>${E(x[0])}</small><strong>${E(x[1])}</strong></div>`).join('')}</div>
  <div class="sp-two"><div><h4>供应商产能与排产负荷（情景）</h4>${capacityBars(m.constraints.capacity)}${table(m.constraints.capacity,['供应商','产能情景 t/y','负荷率'],r=>`<tr><td>${E(r.supplier)}</td><td>${F(r.capacity)}</td><td>${F(r.load)}%</td></tr>`)}</div>
  <div><h4>QC / QA / RA / 生产及仓储约束图</h4>${metrics.filter(x=>x.unit==='%').map(r=>`<div class="sp-capacity-row"><span>${E(r.metric)}</span><div class="sp-capacity-track"><i style="width:${N(r.value)}%"></i></div><b>${F(r.value)}%</b></div>`).join('')}${table(metrics,['参与部门','指标','情景值'],r=>`<tr><td>${E(r.domain)}</td><td>${E(r.metric)}</td><td>${F(r.value)} ${r.unit}</td></tr>`)}</div></div>
  <div class="sp-schedule-flow">${m.constraints.schedule.map(x=>`<div><b>${E(x[0])}</b><span>${E(x[1])}</span></div>`).join('')}</div></div>`;
}
function render(){const m=model();if(!m){if(!ST.loading&&!ST.error)load();return `<div class="sp-page"><div class="sp-empty">${E(ST.error||'正在加载项目数据…')}</div></div>`}return `<div class="sp-page">${header(m)}${section('项目进度甘特图（全流程）','▦',`<p class="sp-note">16 步甘特排程 · 蓝绿状态仅依据计划日期推演，不代表真实签核。16 步规划情景：含 change control、样品接收静置、化学检测/机械实验、QA审计、RA核验与QC放行。未提供已签核的项目进度记录，颜色只表示规划阶段，不表示实际完成。</p>${gantt(m)}`)}${section('项目文档档案','◫',`<p class="sp-note">按供应商逐项检查 ✓ 有登记 / ✕ 未登记。22 类文件为准入检查清单，源站DEMO仅有登记元数据，没有可视为已提交/已批准的正式附件；Top10之外可展开。</p>${docsPanel(m)}`)}${section('多供应商评分对比矩阵','◎',`<p class="sp-note">排序使用明确标记的五维情景评分；真实来源质量与交付使用原站DEMO字段，其他模拟分项不构成正式评估或准入结论。</p>${supplierMatrix(m)}`)}${section('准入里程碑跟踪（关键节点）','◉',`<p class="sp-note">12 个候选里程碑；全部为待人工签核的情景排期，不得由文件存在推断里程碑通过。</p>${milestonePanel(m)}`)}${section('后端产约束视图（产能、库存、排期）','▤',`<p class="sp-note">以下为非生产情景图表，QA/QC/RA/仓储/排产数值并非正式 ERP 或 QMS 记录；实际投产前必须映射业务字段。</p>${constraintsPanel(m)}`)}</div>`}
function model(){return ST.raw?build(ST.raw,ST.material):null}
async function load(){if(ST.loading)return;ST.loading=true;ST.error='';try{ST.raw=window.PharmaCostBaseline?.model?.()?.raw||window.PharmaAISourcing?.model?.()?.raw||null;if(!ST.raw)ST.raw=window.PharmaSourcingData?.load?await window.PharmaSourcingData.load():await(await fetch('/api/v08')).json()}catch(ex){ST.error=String(ex?.message||ex)}finally{ST.loading=false;if(location.hash==='#ss-project')window.render?.()}}
function exportReport(){const m=model();if(!m)return;const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>寻源项目全流程管理工作台 V2.9.14</title><style>body{font:14px/1.6 Arial,'Microsoft YaHei';color:#163a6a;margin:28px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd9ec;padding:8px}th{background:#edf4ff}</style><h1>寻源项目全流程管理工作台</h1><p>物料：${E(m.materialName)}；项目阶段 ${m.metrics.stageCount}；里程碑 ${m.metrics.milestoneCount}；文档 ${m.metrics.docCount}。</p><h2>供应商评分矩阵</h2><table><thead><tr><th>排名</th><th>供应商</th><th>分数</th><th>质量</th><th>交付</th><th>技术</th><th>合规</th><th>报价</th></tr></thead><tbody>${m.suppliers.map((x,i)=>`<tr><td>${i+1}</td><td>${E(x.supplier_name)}</td><td>${F(x.score,1)}</td><td>${F(x.quality)}</td><td>${F(x.delivery)}</td><td>${F(x.technical)}</td><td>${F(x.compliance)}</td><td>${F(x.quote,2)}</td></tr>`).join('')}</tbody></table></html>`;const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Sourcing_Project_Workbench_V297_V2914.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function detail(key){
 const m=model();if(!m)return;const [kind,id]=String(key).split(':');let title='计算或证据明细',rows=[],note='本页为 DEMO/Non-GxP；没有批准记录的不得视为已经完成。';
 if(kind==='supplier'||kind==='scoring'){
  const selected=kind==='supplier'?m.suppliers.filter(x=>x.supplier_id===id):m.suppliers;
  title=kind==='supplier'?`评分贡献 / 来源 · ${selected[0]?.supplier_name||id}`:'完整供应商评分输入与加权计算';
  note='公式：综合分 = 质量×0.24 + 交付×0.18 + 技术×0.22 + 合规×0.22 + 商务×0.14。质量、交付有时取原站DEMO，其他按情景规则。';
  rows=selected.map(r=>({供应商:r.supplier_name,来源:r.score_origin,质量:r.quality,'质量权重':.24,'质量贡献':+(r.quality*.24).toFixed(3),交付:r.delivery,'交付权重':.18,'交付贡献':+(r.delivery*.18).toFixed(3),技术:r.technical,'技术权重':.22,'技术贡献':+(r.technical*.22).toFixed(3),合规:r.compliance,'合规权重':.22,'合规贡献':+(r.compliance*.22).toFixed(3),商务:r.commercial,'商务权重':.14,'商务贡献':+(r.commercial*.14).toFixed(3),综合分:r.score,报价来源:r.quote_origin}));
 }else if(kind==='stage'){
  const r=m.stages[+id];title=`甘特计划阶段 · ${r?.name||''}`;note='依据项目起止日期与计划阶段天数推导情景状态；没有任何 QA/RA 签核记录。';
  rows=r?[{阶段:r.name,开始:r.from,结束:r.to,天数:r.days,负责部门:r.owner,验收条件:r.scope,展示状态:r.status,来源:'本地情景排程；非项目实绩'}]:[];
 }else if(kind==='document'){
  const r=m.evidenceBySupplier[ST.selectedSupplier]?.find(x=>x.doc_id===id)||m.documents.find(x=>x.doc_id===id);
  title=`文件证据核对 · ${r?.name||id}`;note='有源站登记 ≠ 已批准有效；应核验物料、站点、版本、适用市场及批准日期。';
  rows=r?[{供应商:ST.selectedSupplier||'当前首选',文件:r.name,有登记:!!r.hasEvidence,原站文件记录:r.sourceIds.join('、')||'无',覆盖供应商数:r.supplierCoverage,备注:r.remarks}]:[];
 }
 ST.detail={title,rows};document.getElementById('sp-detail')?.remove();const keys=[...new Set(rows.flatMap(x=>Object.keys(x||{})))];const div=document.createElement('div');div.id='sp-detail';div.className='sp-modal-layer';div.innerHTML=`<div class="sp-modal" role="dialog" aria-modal="true"><header><h3>${E(title)}</h3><button data-sp-action="close-detail">×</button></header><div class="sp-modal-scroll"><p class="sp-note">${E(note)}</p>${rows.length?`<div class="sp-table-wrap"><table class="sp-table"><thead><tr>${keys.map(k=>`<th>${E(k)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,10).map(r=>`<tr>${keys.map(k=>`<td>${E(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length>10?`<details class="sp-more"><summary>展开其余 ${rows.length-10} 条</summary><table class="sp-table"><tbody>${rows.slice(10).map(r=>`<tr>${keys.map(k=>`<td>${E(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`:''}</div>`:'<div class="sp-empty">没有可核查数据</div>'}</div></div>`;document.body.append(div)
}
document.addEventListener('click',e=>{const t=e.target;if(t.closest('#sp-detail')){if(t.dataset.spAction==='close-detail'||t.id==='sp-detail')document.getElementById('sp-detail')?.remove();return}if(!t.closest('.sp-page'))return;const h=t.closest('[data-sp-help]');if(h){e.preventDefault();e.stopImmediatePropagation();window.PharmaGlobalHelp?.open?.(h.dataset.spHelp,'module',h.closest('.sp-panel,.sp-page'));return}const o=t.closest('[data-sp-open]');if(o){detail(o.dataset.spOpen);return}const act=t.closest('[data-sp-action]')?.dataset.spAction;if(act==='export')exportReport()},true);
document.addEventListener('change',e=>{const d=e.target.closest('.sp-page [data-sp-supplier]');if(d){ST.selectedSupplier=d.value;if(location.hash==='#ss-project')window.render?.();return}const s=e.target.closest('.sp-page [data-sp-project]');if(!s)return;ST.material=s.value;ST.selectedSupplier='';try{sessionStorage.setItem('pharma.sourcing.shared.selection',JSON.stringify({material:ST.material,category:catalog().find(x=>x.material_id===ST.material)?.material_category||'API'}))}catch{}if(location.hash==='#ss-project')window.render?.()});
window.PharmaSourcingProject={build,render,load,hydrate:r=>{ST.raw=r;ST.error=''},model,report:exportReport,getState:()=>ST};
})();
