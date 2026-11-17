from pathlib import Path
p=Path('static/strategic_sourcing_ai.js');s=p.read_text();
# 1) unified, consistent unit-economics computation
s=s.replace('const lowest=Math.min(...prices.map(p=>p.unit),Infinity);','const lowest=Math.min(...prices.map(p=>p.unit),Infinity);')
s=s.replace("total:n(s.demo_price_usd)*n(f.quantity)+n(s.demo_freight_usd),unit:n(s.demo_price_usd)+n(s.demo_freight_usd)/Math.max(1,n(f.quantity)),origin:'SCENARIO_ONLY'", "total:n(s.demo_price_usd)*Math.max(n(f.quantity),n(s.quote_moq||100))+n(s.demo_freight_usd),unit:(n(s.demo_price_usd)*Math.max(n(f.quantity),n(s.quote_moq||100))+n(s.demo_freight_usd))/Math.max(1,n(f.quantity)),origin:'SCENARIO_ONLY',currency:'USD',uom:'kg',incoterms:'EXW(情景假设)'")
s=s.replace("const scenarioMin=Math.min(...candidates.filter(c=>n(c.demo_price_usd)>0).map(c=>n(c.demo_price_usd)),Infinity);const referenceMin=Number.isFinite(lowest)?lowest:scenarioMin;", "const scenarioUnits=candidates.filter(c=>n(c.demo_price_usd)>0).map(c=>(n(c.demo_price_usd)*Math.max(n(f.quantity),n(c.quote_moq||100))+n(c.demo_freight_usd))/Math.max(1,n(f.quantity)));const scenarioMin=Math.min(...scenarioUnits,Infinity);const referenceMin=Math.min(lowest,scenarioMin);")
s=s.replace('const riskNum=card?({Low:20,Medium:48,High:78}[card.risk]??55):Math.max(0,Math.min(100,n(s.risk_index_scenario)||55));','const riskNum=card?({Low:20,Medium:48,High:78}[card.risk]??null):(s.risk_index_scenario==null?null:Math.max(0,Math.min(100,Number(s.risk_index_scenario))));')
s=s.replace('const riskScore=calc?Math.max(0,100-riskNum):null;','const riskScore=calc&&riskNum!=null?Math.max(0,100-riskNum):null;')
s=s.replace('const canScore=!!(calc&&q!=null&&d!=null);','const canScore=!!(calc&&Number.isFinite(priceScore)&&q!=null&&d!=null&&riskScore!=null);')
# normalized score must not depend on arbitrary demo selection for one cohort; retained product-score semantics but audit missing fields
s=s.replace('const blocked=!qualified;','const blocked=!qualified;')
# 2) Kraljic category fidelity. Replace one section with data driven 4-quadrant strategy card.
needle='<div class="ai-side-card ai-strategy"><h4>◈ Kraljic 分类结果 <small>/ Category Strategy</small>${tip(\'Kraljic 分类结果\')}</h4><div class="ai-strat-line"><b>${e(m.material)}</b><span>${e(m.materialName)}</span></div><button data-ai-go="ss-kraljic">查看共享品类战略矩阵 →</button><div class="ai-tiny">本页评分与 Kraljic 路由共用 80 家演示/基础候选目录；情景评分不构成正式评标。</div></div>'
replacement='${strategyCard(m)}';assert needle in s;s=s.replace(needle,replacement)
insert='''function strategyCard(m){
 const k=window.PharmaKraljic?.build?.(m.raw,{category:'all',region:'all',mode:'commercial'})?.materials?.find(x=>x.id===m.material);
 const category=k?.category||'unclassified';const defs={strategic:['战略品','Strategic','▱','双来源、强化合规、供应保障、集中评审'],leverage:['杠杆品','Leverage','◈','集中询比价、规模议价、定期对标'],bottleneck:['瓶颈品','Bottleneck','△','安全库存、替代开发、技术降风险'],noncritical:['非关键品','Non-critical','▤','目录化采购、自动化执行、降低事务成本'],unclassified:['未分类','Not classified','◇','待核验价值金额及供应风险后配置寻源策略']};const [zh,en,sym,advice]=defs[category];
 const impact=k?.impact??null,risk=k?.risk??null,level=x=>x==null?'待核验':x>=50?'高':'低';
 const templates=['Template v1','Template v2','合规优先'];const choice=ST.strategyTemplate||templates[0];return `<div class="ai-side-card ai-strategy ai-strategy-v2912"><h4>◈ Kraljic 分类结果 <small>/ Category Strategy</small>${tip('Kraljic 分类结果')}</h4><div class="ai-kraljic-row"><div class="ai-kraljic-badge"><span class="ai-kraljic-symbol">${sym}</span><div><strong>${e(zh)}</strong><small>${e(en)}</small></div></div><div class="ai-kraljic-metric"><span>价值占比</span><b class="ai-level">${level(impact)}</b><small>${impact==null?'缺采购金额':fmt(impact,1)+' / 100'}</small></div><div class="ai-kraljic-metric"><span>供应风险</span><b class="ai-level">${level(risk)}</b><small>${risk==null?'缺风险记录':fmt(risk,1)+' / 100'}</small></div><label class="ai-kraljic-template">匹配模板<select data-ai-strategy-template>${templates.map(x=>`<option ${x===choice?'selected':''}>${e(x)}</option>`).join('')}</select></label></div><div class="ai-kraljic-strategy"><b>◎ 推荐策略：</b> ${e(advice)} · ${choice==='合规优先'?'QA/RA准入核验优先；未批准不下单':choice==='Template v2'?'联合评审、分阶段寻源、合同交付跟踪':'技术评审、风险尽调、商业评分、资格复核'}</div><button data-ai-go="ss-kraljic">查看共享品类战略矩阵 →</button><div class="ai-tiny">来源：共享品类策略计算；物料 ${e(m.material)}，${k?.scenario?'演示分级（请复核）':'原始业务演示分级'}，不构成采购批准。</div></div>`;
}
'''
s=s.replace('function setup(m){',insert+'function setup(m){',1)
s=s.replace('const ST={requirements:',"const ST={strategyTemplate:'Template v1',requirements:",1)
# 3) score matrix top 10 + rest list; axis stays intact
s=s.replace('const plotted=m.ranked.slice(0,18);return', 'const plotted=m.ranked.slice(0,10);const remaining=m.ranked.slice(10);return',1)
s=s.replace('}).join(\'\')}</div><div class="ai-chart-axis">', "}).join('')}</div><div class=\"ai-chart-axis\">", 1) # no actual content change
needle='</div></div><p class="ai-footnote">按参考图：左侧＝正式资格满足'
assert needle in s
s=s.replace(needle,'''</div>${remaining.length?`<details class="top10-overflow"><summary>展开矩阵剩余 ${remaining.length} 家候选（按商业评分降序）</summary><table><thead><tr><th>供应商</th><th>商业评分</th><th>准入状态</th></tr></thead><tbody>${remaining.map(r=>`<tr data-ai-open="supplier:${e(r.supplier_id)}"><td>${e(r.supplier_name)}</td><td>${fmt(r.score,1)}</td><td>${r.qualified?'有来源记录':'未批准'}</td></tr>`).join('')}</tbody></table></details>`:''}</div><p class="ai-footnote">按参考图：左侧＝正式资格满足''',1)
# 4) all 4 weighted contribution segment labels visible and percent semantics
start=s.index('function breakdown(m)');end=s.index('\nfunction costBar(m)',start)
s=s[:start]+'''function breakdown(m){const rows=m.ranked,top=rows.slice(0,10),rest=rows.slice(10),dims=[['价格','priceScore','#2e82ed','price'],['质量','quality','#22b777','quality'],['交付','delivery','#8d72e6','delivery'],['供应风险','riskScore','#ffa946','risk']];if(!top.length)return blank();const line=r=>`<button data-ai-open="supplier:${e(r.supplier_id)}" class="ai-bd-row"><b title="${e(r.supplier_name)}">${e(r.supplier_name)}</b><div class="ai-bd-track">${dims.map(([name,k,c,w])=>{const v=Number(r[k])*m.weights[w];return `<i class="ai-bd-segment" style="width:${v.toFixed(3)}%;background:${c}" title="${e(name)} 加权得分 ${fmt(v,1)}% / 满分100"><span>${fmt(v,1)}%</span></i>`}).join('')}</div><strong>${fmt(r.score,1)}</strong>${r.isDemoCalculation?'<small class="ai-demo-flag">演示</small>':''}</button>`;return `<div class="ai-bd ai-bd-v2912"><div class="ai-chart-legend">${dims.map(x=>`<span><i style="background:${x[2]}"></i>${x[0]}</span>`).join('')}</div><div class="ai-top10-list">${top.map(line).join('')}</div>${rest.length?`<details class="top10-overflow"><summary>展开剩余 ${rest.length} 家评分供应商（按综合评分降序）</summary><div class="ai-bd-extra">${rest.map(line).join('')}</div></details>`:''}</div><p class="ai-footnote">按得分降序 Top 10；每段内部固定展示加权贡献百分比（分母为总分 100），未评分候选不参与榜单。悬停可查看各段依据；演示评分不可用于正式采购审批。</p>`;}
''' +s[end:]
# 5) re-comparable total cost; no arbitrary historical per PO baseline comparison
start=s.index('function costBar(m)');end=s.index('\nfunction compliance(m)',start)
s=s[:start]+'''function costBar(m){
 const eligible=m.rows.filter(x=>x.calc&&Number.isFinite(x.calc.total)&&x.calc.total>0);
 const actual=eligible.filter(x=>!x.isDemoCalculation),demo=eligible.filter(x=>x.isDemoCalculation);
 // Never mix sample quotes with source quotes in one statistical baseline.
 const cohort=actual.length>=10?actual:demo.length>=10?demo:actual.length?actual:demo;
 const ranked=cohort.slice().sort((a,b)=>a.calc.total-b.calc.total),rows=ranked.slice(0,10),rest=ranked.slice(10);
 if(!rows.length)return blank();const count=rows.length,max=Math.max(...rows.map(x=>x.calc.total),1),mean=rows.reduce((s,x)=>s+x.calc.total,0)/count;
 const best=rows[0],delta=mean>0?(best.calc.total/mean-1)*100:null;
 const scenario=cohort===demo,scope=scenario?'情景价格（不可作为正式报价）':'来源报价（原站 DEMO；未核验币种/基准日）';
 const cols=rows.map((r,i)=>`<button data-ai-open="quote:${e(r.supplier_id)}" class="ai-cost-col" title="${e(r.supplier_name)} · ${fmt(r.calc.total,2)} USD · ${scenario?'合成报价':'源站报价'}"><strong>${fmt(r.calc.total/1000,1)}k</strong><span class="bar ${i===0?'q':'u'}" style="height:${Math.max(8,r.calc.total/max*100)}%"></span><small title="${e(r.supplier_name)}">${e(r.supplier_name)}</small>${r.isDemoCalculation?'<em>演示</em>':''}</button>`).join('');
 const line=`<div class="ai-average-line" style="bottom:${Math.min(94,Math.max(8,mean/max*100))}%"><span>均值基准 ${fmt(mean,0)} USD</span></div>`;
 return `<div class="ai-cost ai-cost-v2912"><div class="ai-cost-summary"><b>${delta==null?'暂无同口径成本基准':(delta<0?'↓ ':'↑ +')+fmt(Math.abs(delta),1)+'% · 最优报价相对 Top '+count+' 平均基准'+(delta<0?'下降':'上涨')}</b><span>同物料 ${e(m.material)} · 统一需求 ${fmt(m.filters.quantity)} kg · USD · 落地估算（含运费；MOQ按实际采购量） · ${scope}</span></div><div class="ai-cost-bars">${cols}${line}</div><div class="ai-cost-axis">↑ 总落地成本（USD）；排序为从低成本（更优）到高成本。基准＝同组 Top ${count} 有效成本均值，**不是历史 PO 基准**，真实谈判前仍须核对汇率、税费及 Incoterms。</div>${rest.length?`<details class="top10-overflow"><summary>展开剩余 ${rest.length} 家可比成本（从低至高）</summary><table><thead><tr><th>供应商</th><th>总落地成本 USD</th><th>来源</th></tr></thead><tbody>${rest.map(r=>`<tr data-ai-open="quote:${e(r.supplier_id)}"><td>${e(r.supplier_name)}</td><td>${fmt(r.calc.total,2)}</td><td>${r.isDemoCalculation?'演示':'源站记录'}</td></tr>`).join('')}</tbody></table></details>`:''}</div>`;
}
''' + s[end:]
# 6) move results/compliance full data into globally foldable table
s=s.replace('function results(m){const items=m.rows.slice(0,20);','function results(m){const items=m.rows;')
s=s.replace('function compliance(m){const d=m.rows.slice(0,20);','function compliance(m){const d=m.rows;')
# 7) include data coverage in all modules
s=s.replace('原站演示 PO、3 家基础供应商、77 家明确标记的合成演示候选','原站演示 PO、3 家基础供应商、77 家明确标记的合成演示候选；统一档案不等于真实资质')
# 8) dynamic template selector functional
s=s.replace('key=a.dataset.aiWeight;if(key){','key=a.dataset.aiStrategyTemplate;if(key!==undefined){ST.strategyTemplate=a.value;refresh();return}\n key=a.dataset.aiWeight;if(key){')
# handler for blank dataset attr: property access returned undefined when absent; if present empty value '', works
# 9) source modal table top10
s=s.replace('document.body.appendChild(div)}','document.body.appendChild(div);window.PharmaTopTen?.apply?.(div)}',1)
p.write_text(s)
