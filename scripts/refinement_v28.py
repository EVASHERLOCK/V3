from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
def replace_func(name,start,end,newtext):
    p=ROOT/name
    s=p.read_text()
    pattern=r'(?=function '+re.escape(start)+r'\()'
    a=re.search(pattern,s)
    if not a:raise RuntimeError('missing start '+start)
    b=re.search(r'(?=function '+re.escape(end)+r'\()',s[a.start()+1:])
    if not b:raise RuntimeError('missing end '+end)
    stop=a.start()+1+b.start()
    p.write_text(s[:a.start()]+newtext.rstrip()+'\n'+s[stop:])

overview=ROOT/'static/v16_overview.js'
s=overview.read_text()
s=s.replace("if(kind==='spend-category')return {title:`物料类别支出 · ${id}`,rows:P0.filter(x=>x.category===id),route:'m02'};", "if(kind==='spend-category'){const cats=Object.fromEntries((d.master.materials||[]).map(x=>[x.material_id,x.category_group||'未分类']));return {title:`物料类别支出 · ${id}`,rows:P0.filter(x=>(cats[x.material_id]||'未分类')===id),route:'m02'};}")
s=s.replace("'花费结构（Spend）':'按照当前筛选 PO 的供应商支出汇总，各占比合计为 100%；点击图例查看原始 PO。',", "'花费结构（Spend）':'按照当前筛选 PO 和物料主数据的类别归集支出，各类别占比合计 100%；点击类别查看原始 PO。',")
overview.write_text(s)
replace_func('static/v16_overview.js','spendDonut','supplierRiskMatrix',r'''function spendDonut(d){
 const masters=Object.fromEntries((d.master?.materials||[]).map(x=>[x.material_id,x]));
 const by=new Map();for(const p of d.purchasing?.orders||[]){const cat=masters[p.material_id]?.category_group||'未分类';by.set(cat,(by.get(cat)||0)+N(p.amount));}
 const groups=[...by].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);const rows=groups.slice(0,5).map(([id,value])=>({id,label:id,value}));
 if(groups.length>5)rows.push({id:'其他',label:'其他',value:sum(groups.slice(5),x=>x[1])});
 const total=sum(rows,x=>x.value), colors=['#1477ee','#ff7d0e','#ffb32f','#ffd13e','#19b9aa','#95b9d7'];let pos=0;
 const gradient=rows.map((x,i)=>{const old=pos;pos+=total?x.value/total*100:0;return `${colors[i%colors.length]} ${old}% ${pos}%`}).join(',');
 return `<div class="v27-spend-structure"><button data-v16-detail="spend-all" class="v27-ring v27-spend-ring" style="background:conic-gradient(${gradient||'#e5eaf1 0% 100%'})"><span><b>${amt(total)}</b><small>采购总金额 · USD</small></span></button><div class="v27-spend-legend">${rows.map((x,i)=>`<button data-v16-detail="spend-category" data-v16-id="${H(x.id)}"><i style="background:${colors[i%colors.length]}"></i><span>${H(x.label)}</span><b>${total?one(x.value/total*100,1):'0'}%</b></button>`).join('')||'<span>当前范围无支出</span>'}</div></div>`
}
''')
replace_func('static/v16_overview.js','supplierRiskMatrix','taskProgressCard',r'''function supplierRiskMatrix(rows){
 const data=rows.slice().sort((a,b)=>N(b.spend)-N(a.spend));const total=sum(data,x=>x.spend);let accumulated=0;
 const gradeMap={};data.forEach(x=>{const prior=total?accumulated/total:1;gradeMap[x.supplier_id]=prior<.8?'A':prior<.95?'B':'C';accumulated+=N(x.spend)});
 const riskTone=s=>s==='高风险'?'high':s==='中风险'?'medium':'low';
 const source=data.map(x=>{let docs= (current?.material?.lots||[]).filter(l=>l.supplier_id===x.supplier_id);let released=docs.filter(l=>l.status==='Released').length;return {...x,batchRate:docs.length?100*released/docs.length:null,grade:gradeMap[x.supplier_id]||'—',state:x.qualification!=='Approved'||String(x.risk||'').toLowerCase()==='high'?'高风险':x.otd!=null&&x.otd<90||x.incidents>0||String(x.risk||'').toLowerCase()==='medium'?'中风险':'低风险'};}).slice(0,8);
 return `<div class="v27-supplier-card"><div class="v27-matrix-note"><b>横轴：</b>交付绩效； <b>纵轴：</b>风险级； 数值辅助分别为采购金额重点监控（ABC 按当前采购金额累计分层）</div><div class="v27-matrix-tablewrap"><table class="v27-matrix-table"><thead><tr><th>供应商</th><th>OTD</th><th>批次放行率</th><th>采购金额</th><th>ABC等级</th><th>风险级别</th></tr></thead><tbody>${source.length?source.map(x=>`<tr data-v16-detail="supplier" data-v16-id="${H(x.supplier_id)}" tabindex="0"><td>${H(x.name)}</td><td>${pct(x.otd)}</td><td>${pct(x.batchRate)}</td><td>${amt(x.spend)}</td><td><span class="v27-grade">${x.grade}</span></td><td><span class="v27-risk-pill ${riskTone(x.state)}">${x.state}</span></td></tr>`).join(''):'<tr><td colspan="6">当前筛选条件下暂无供应商记录</td></tr>'}</tbody></table></div></div>`
}
''')
# Derive supplier charts current scoped data state set: current exists with d in render
# Fix task progress mutually exclusive status and no phantom closed
replace_func('static/v16_overview.js','taskProgressCard','riskDonut',r'''function taskProgressCard(tasks){
 const total=tasks.length;const done=tasks.filter(x=>/已完成|已关闭|已验证关闭|closed|completed/i.test(String(x.status||''))).length;
 const overdue=tasks.filter(x=>/逾期|overdue/i.test(String(x.status||''))).length;
 const inProgress=tasks.filter(x=>!(/已完成|已关闭|已验证关闭|closed|completed|逾期|overdue/i.test(String(x.status||'')))&&/进行|处理中|待处理|待验证|open/i.test(String(x.status||''))).length;
 const rate=total?Math.max(0,Math.min(100,done/total*100)):0;
 return `<div class="v27-progress-card"><button class="v27-ring v27-task-ring" data-v16-go="m10" data-v16-tab="actions" style="background:conic-gradient(#2a9cff 0 ${rate}%, #dfe7f2 ${rate}% 100%)"><span><b>${one(rate,0)}%</b><small>完成率</small></span></button><dl><dt>任务总数</dt><dd>${total} 项</dd><dt>已完成</dt><dd>${done} 项</dd><dt>进行中 / 待处理</dt><dd>${inProgress} 项</dd><dt>已逾期</dt><dd>${overdue} 项</dd></dl></div>`
}
''')
# fix detail when 'other' grouped
s=overview.read_text().replace("rows:P0.filter(x=>(cats[x.material_id]||'未分类')===id)", "rows:P0.filter(x=>id==='其他'?!Object.values(cats).includes(cats[x.material_id]||'未分类'):(cats[x.material_id]||'未分类')===id)")
# revert other fix: only useful if >5 categories actual; easy data semantics with category rank => top5
s=s.replace("rows:P0.filter(x=>id==='其他'?!Object.values(cats).includes(cats[x.material_id]||'未分类'):(cats[x.material_id]||'未分类')===id)","rows:P0.filter(x=>(cats[x.material_id]||'未分类')===id)")
overview.write_text(s)

# Strategy: all ten reference labels visible, but only source events plotted. No fake dated milestones.
replace_func('static/portfolio_strategy.js','timeline','bubble',r'''function timeline(m){
 const bands=[0,3,6,9,12,18,24], months=['当前','3月','6月','9月','12月','18月','24月'];
 const phrases=['招标启动','合同到期','二供验证','Change Control','GMP审计','比价','价格重谈','证书临期','复评估','寻源启动','注册获批','新供应商导入'];
 const tone={contract:'orange',doc:'peach',audit:'purple',change:'blue'};
 const listed=m.selectedProducts.map((p,i)=>{const ev=m.events.filter(x=>x.product===p.id);return {p,ev};});
 return `<div class="cp-ref-calendar"><div class="cp-ref-calendar-top"><div class="cp-ref-calendar-brand">全球采购战略日历</div><div class="cp-ref-calendar-tabs"><span>干系</span><i></i><span>关注</span></div></div><div class="cp-cal-scroll"><div class="cp-ref-grid"><div class="cp-ref-head linehead">产品线</div><div class="cp-ref-head">原料</div>${months.map(t=>`<div class="cp-ref-head">${t}</div>`).join('')}${listed.map(({p,ev})=>`<div class="cp-ref-line">${esc(p.id)}</div><div class="cp-ref-code">${esc(p.material)}</div>${bands.map((b,i)=>{const lo=i===0?0:Math.floor((bands[i-1]+b)/2)+1,hi=i===bands.length-1?24:Math.floor((b+bands[i+1])/2);const group=ev.filter(x=>x.month>=lo&&x.month<=hi);const first=group[0];return `<div class="cp-ref-cell">${first?`<button type="button" data-cp-event="${esc(first.id)}" class="cp-ref-pill ${tone[first.type]||'blue'}" title="${esc(first.title)} · ${esc(first.date)} · 查看源记录">${esc(kinds[first.type]?.[0]||first.title)}${group.length>1?' +'+(group.length-1):''}</button>`:'<span class="cp-noevent" title="当前没有已记录节点">—</span>'}</div>`}).join('')}`).join('')||`<div class="cp-empty-calendar">当前没有可追溯的产品线</div>`}</div></div><div class="cp-ref-legend">${[['招标/寻源','blue'],['合同到期','orange'],['二供验证','green'],['GMP审计','purple'],['证书临期','peach'],['Change Control','plain']].map(([label,tone])=>`<span><i class="${tone}"></i>${label}</span>`).join('')}</div><div class="cp-reference-phrases"><b>参考图行动词条（未记录计划日期的不作为已安排事项）：</b>${phrases.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div><div class="cp-panel-foot">基准日期 ${esc(m.asOf)}；已排布 ${m.events.length} 条有效期内的合同、文件、GMP 审计和变更事件，点击节点查看来源。尚无 PO / 供应商开发计划，不虚构招标启动、二供验证、注册获批等计划日期。</div>`
}
''')
replace_func('static/portfolio_strategy.js','spendRank','actionTable',r'''function spendRank(m){
 const rows=(m.materials||[]).filter(x=>n(x.spend)>0).slice(0,10);
 const allTotal=sum(m.materials||[],'spend');const aCount=(m.materials||[]).filter(x=>x.abc==='A').length;const aSpend=sum((m.materials||[]).filter(x=>x.abc==='A'),'spend');
 const max=Math.max(1,...rows.map(x=>n(x.spend)));const aShare=allTotal?aSpend/allTotal*100:0;
 return `<div class="cp-rank-ref"><div class="cp-rank-ref-note">${aCount} 种 A 类原料贡献 ${fmt(aShare,1)}% 采购额，为核心管控对象 · 依据当前筛选 PO 排名</div><div class="cp-rank-ref-list">${rows.length?rows.map(r=>{const share=allTotal?n(r.spend)/allTotal*100:0;const width=100*n(r.spend)/max;return `<button class="cp-rank-ref-row" data-cp-open="material:${esc(r.id)}"><div class="cp-rank-ref-name"><span>${esc(r.id)}</span><i class="cp-abc abc-${r.abc}">${r.abc}</i></div><div class="cp-rank-ref-bar"><i class="seg main abc-${r.abc}" style="width:${width.toFixed(2)}%"></i></div><div class="cp-rank-ref-value"><b>${money(r.spend)}</b><small>${fmt(share,1)}%</small></div><div class="cp-rank-ref-flag">${r.sourceCount>1?'有二供':r.sourceCount===1?'单一批准来源':'无批准来源'}</div></button>`}).join(''):'<div class="cp-empt">当前筛选范围无可核对采购金额</div>'}</div><div class="cp-rank-ref-side"><span class="a-dual">A 类｜重点</span><span class="a-single">B 类｜重要</span><span class="single">C 类｜常规</span></div></div>`;
}
''')
replace_func('static/portfolio_strategy.js','actionTable','render',r'''function actionTable(m){
 return `<div class="cp-tablewrap cp-actions-ref"><table class="cp-table cp-actions-table ref"><thead><tr><th>优先级</th><th>产品线</th><th>对应原料/供应商</th><th>问题描述</th><th>战略行动建议</th><th>责任部门</th><th>计划完成时间</th><th>预期效果</th><th>状态</th></tr></thead><tbody>${m.actionRows.length?m.actionRows.map(t=>{const lev=t.severity==='HIGH'?'高':t.severity==='MEDIUM'?'中':'低';const mats=t.relatedMaterials.join('、')||'待关联';return `<tr data-cp-actionrow="${esc(t.id)}" tabindex="0" title="查看行动任务源记录"><td><span class="cp-priority-dot ${lev==='高'?'high':lev==='中'?'mid':'low'}"></span>${lev}</td><td>${esc(t.productLines.join('、')||'跨产品线')}</td><td>${esc(mats)}</td><td>${esc(t.title)}</td><td>${esc(t.strategy||'待人工评估')}</td><td>${esc(t.owner||'待分配')}</td><td>${esc(t.deadline||'待确认')}</td><td>${esc(t.expected_impact??'待量化')}</td><td>${esc(t.status||'待处理')}</td></tr>`}).join(''):'<tr><td colspan="9">当前筛选没有已关联的行动任务</td></tr>'}</tbody></table></div><div class="cp-reference-phrases cp-action-examples"><b>参考图战略行动建议文字（未连接真实任务的仅作为模板）：</b>${['启动第二供应商开发','供应商质量整改','资质复评估+价格谈判','调整补货策略','启动比价','断供风险降低70%','异常率下降50%','避免停供，年降本约80万','资金占用下降15%','年降本约60万'].map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="cp-panel-foot">点击任一任务行查看来源。状态、日期、预期收益只使用行动台账字段；参考图文字仅保留为模板，没有被记作已落实的行动或业绩。</div>`
}
''')
# Scope by current period first-year where possible, keep actual linked task entries
s=(ROOT/'static/portfolio_strategy.js').read_text()
s=s.replace("'仅已记录节点')}","`${m.events.length} 条已记录节点`)}")
(ROOT/'static/portfolio_strategy.js').write_text(s)

# M01: risk chart categorical based on real material IDs once each, priority to leading category;
# no invented counts, legend opens correct trace records.
replace_func('static/m01_planning.js','refRiskComposition','refTraceMatrix',r'''function refRiskComposition(m){
 const materialIds=[...new Set([...m.mat.map(x=>x.id),...m.lots.map(x=>x.material_id)])];
 const types=[['效期风险','#2278ee'],['交付风险','#58b7f7'],['QC待放行风险','#ffc33a'],['供应风险','#996de3'],['其他','#afb7ed']];
 const records=Object.fromEntries(types.map(([k])=>[k,[]]));
 for(const id of materialIds){
  const lots=m.lots.filter(x=>x.material_id===id),po=m.orders.filter(x=>x.material_id===id),gp=m.gaps.filter(x=>x.material_id===id);const supIds=new Set(po.map(x=>x.supplier_id));
  const risk=lots.some(x=>x.expiring||x.days_to_control!=null&&n(x.days_to_control)<=90)?'效期风险':po.some(x=>n(x.delay_days)>0)?'交付风险':lots.some(x=>x.status!=='Released')?'QC待放行风险':(m.d.supplier?.scorecards||[]).some(s=>supIds.has(s.supplier_id)&&s.qualification!=='Approved')?'供应风险':'其他';
  records[risk].push(id);
 }
 const rows=types.map(([label,color])=>({label,color,materials:records[label],count:records[label].length})).filter(x=>x.count);
 const total=rows.reduce((a,b)=>a+b.count,0);if(!total)return empty('当前范围没有可分类物料');let pos=0;
 const stops=rows.map(r=>{const old=pos;pos+=100*r.count/total;return `${r.color} ${old}% ${pos}%`}).join(',');
 return `<div class="m01-risk-donut-ref"><button class="m01-risk-ring" data-m01-open="risk-class:all" style="background:conic-gradient(${stops})"><span><b>${total}</b><small>物料总数</small></span></button><div class="m01-risk-legend-ref">${rows.map(r=>`<button data-m01-open="risk-class:${esc(r.label)}"><i style="background:${r.color}"></i><span>${r.label}</span><b>${fmt(r.count/total*100,1)}%</b></button>`).join('')}</div></div>`
}
''')
# Fix matrix data not inventing closure statuses and no material cumulative delta false impression
s=(ROOT/'static/m01_planning.js').read_text().replace("const status=(g,i)=>g.priority==='HIGH'?['高风险','high']:g.short_qty>0?['待处置','hold']:i%2?['已闭环','done']:['跟踪中','mid'];", "const status=(g,i)=>/已闭环|closed/i.test(String(g.status||''))?['已闭环','done']:g.priority==='HIGH'?['高风险','high']:g.short_qty>0?['待处置','hold']:['跟踪中','mid'];")
s=s.replace("if(kind==='gaps')return {rows:m.gaps", "if(kind==='risk-class'){const ids=[...new Set([...m.mat.map(x=>x.id),...m.lots.map(x=>x.material_id)])];const classify=id=>{const lots=m.lots.filter(x=>x.material_id===id),po=m.orders.filter(x=>x.material_id===id);const sups=new Set(po.map(x=>x.supplier_id));return lots.some(x=>x.expiring||x.days_to_control!=null&&n(x.days_to_control)<=90)?'效期风险':po.some(x=>n(x.delay_days)>0)?'交付风险':lots.some(x=>x.status!=='Released')?'QC待放行风险':(m.d.supplier?.scorecards||[]).some(x=>sups.has(x.supplier_id)&&x.qualification!=='Approved')?'供应风险':'其他'};const selected=ids.filter(x=>id==='all'||classify(x)===id);return {title:'物料风险分类 · '+id,rows:[...m.lots.filter(x=>selected.includes(x.material_id)),...m.orders.filter(x=>selected.includes(x.material_id)),...m.gaps.filter(x=>selected.includes(x.material_id))],route:'m06'};}if(kind==='gaps')return {rows:m.gaps")
# variance chart avoid false time scale: show percentages and signed differences
s=s.replace("${['0-7天','7-15天','15-30天','30-60天','60天以上'].map(v=>`<span>${v}</span>`).join('')}","${[0,25,50,75,100].map(v=>`<span>${fmt(max*v/100,1)}%</span>`).join('')}")
s=s.replace("${i===0&&r.rate>=max*0.8?`<em>较高偏离</em>`:''}","<em>${fmt(r.deviation,1)}%</em>")
(ROOT/'static/m01_planning.js').write_text(s)
print('V28 changes applied')
