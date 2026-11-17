/* V2.9.49 – 5 decision pages use the same three-entry audit widget as the
 * execution pages. Node module endpoints and STATIC SIMULATED module exports
 * share one displayed report contract. Missing business evidence NEVER passes. */
(()=>{'use strict';
 if(!window.PHARMA_AUDIT_UI)throw Error('V2949 shared three-entry component did not load');
 const css=document.createElement('style');css.textContent=`.dc48-audit{display:flex;flex-wrap:wrap;gap:4px;padding:5px 0 2px}.dc48-audit button,.dc48-audit a{font-size:10px!important;line-height:1.4;padding:4px 6px;border:1px solid #aac9eb;border-radius:5px;background:#eff7ff;color:#1557a0;cursor:pointer;text-decoration:none}.dc48-audit a{background:#e4f4e9;color:#167145}.dc48-wrapper{min-width:0;display:flex;flex-direction:column;border:1px solid #d3e6f6;border-radius:8px;padding:3px}.dc48-wrapper>.metric{flex:1;width:100%;border:0}.dc48-details{max-height:67vh;overflow:auto}.dc48-details table{width:100%;border-collapse:collapse;font-size:11px}.dc48-details td,.dc48-details th{border:1px solid #dbe5ee;padding:5px;text-align:left;vertical-align:top}.dc48-details code{overflow-wrap:anywhere;white-space:pre-wrap}.dc49-pages{display:flex;align-items:center;gap:8px;margin:7px 0}.dc49-pages button{padding:3px 8px;border:1px solid #aac9eb;border-radius:4px;background:#eef5ff;cursor:pointer}.dc49-warning{color:#9a4c1a}`;document.head.append(css);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safe=v=>typeof v==='object'?JSON.stringify(v):String(v??'');
 const params=()=>{const u=new URLSearchParams(location.search),q=new URLSearchParams();for(const k of ['month','supplier','material','project'])q.set(k,u.get(k)||'all');if(u.get('source'))q.set('source',u.get('source'));return q};
 const query=(kind,id)=>{const q=params();q.set('kind',kind);q.set('id',id);return q};
 const moduleUrl=(kind,id)=>'/api/decision-center/module?'+query(kind,id).toString();
 const workbookUrl=(kind,id)=>'/api/decision-center/workbook.xlsx?'+query(kind,id).toString();
 const selection=new Map();let reportSeq=0;
 function controls(kind,id){const el=document.createElement('div');el.className='dc48-audit';el.dataset.kind=kind;el.dataset.id=id;el.innerHTML=window.PHARMA_AUDIT_UI.decisionControls();el.querySelector('a').href=workbookUrl(kind,id);return el;}
 function tablePage(tableNo,pageno){const entry=selection.get(tableNo);if(!entry)return;const {rows,keys}=entry,pageSize=100,totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),current=Math.max(0,Math.min(pageno,totalPages-1));entry.page=current;
  const host=document.querySelector('[data-source-table="'+tableNo+'"]');if(!host)return;
  const body=host.querySelector('tbody'),summary=host.querySelector('[data-source-progress]');
  body.innerHTML=rows.slice(current*pageSize,(current+1)*pageSize).map(row=>'<tr>'+keys.map(k=>'<td>'+esc(safe(row[k]))+'</td>').join('')+'</tr>').join('');
  summary.textContent='已取得 '+rows.length+' 行；当前展示 '+(rows.length?current*pageSize+1:0)+'–'+Math.min(rows.length,(current+1)*pageSize)+' 行 / 共 '+totalPages+' 页';
  host.querySelector('[data-source-prev]').disabled=current===0;host.querySelector('[data-source-next]').disabled=current===totalPages-1;
 }
 function sourceView(report){let html=`<div class="dc48-details"><p>数据源：${esc(report.source_meta?.source||'未核验')}；筛选范围：<code>${esc(JSON.stringify(report.scope||{}))}</code>。</p><p class="dc49-warning">仅本次来源快照，未经企业数据库全量验收；页面每次展示100行，但可切换查看本次接口返回的全部行。</p>`;
  for(const table of report.tables||[]){const rows=table.rows||[],keys=[...new Set(rows.flatMap(r=>Object.keys(r)))],n=++reportSeq;selection.set(n,{rows,keys,page:0});html+=`<section data-source-table="${n}"><h3>${esc(table.table)} · 接口声明 ${table.count??'未知'} 行 / 本次接收 ${rows.length} 行</h3>`;
   if(table.count!==rows.length||!Number.isInteger(table.count))html+='<p class="dc49-warning" role="alert">接口来源总行数与已返回行数不一致或缺失，禁止声明全量。请检查分页/接口快照。</p>';
   html+=`<div class="dc49-pages"><button data-source-prev="1" data-source-page="${n}" data-step="-1">上一页</button><span data-source-progress>待显示</span><button data-source-next="1" data-source-page="${n}" data-step="1">下一页</button></div><div style="overflow:auto"><table><thead><tr>${keys.map(k=>'<th>'+esc(k)+'</th>').join('')}</tr></thead><tbody></tbody></table></div></section>`;
  }
  html+='<h3>逐步分析与结论</h3><ol>'+(report.analysis_steps||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol><p>'+esc(report.definition||'')+'</p><p>'+esc((report.conclusions||[]).join('；'))+'</p></div>';return html;
 }
 function formulaView(report){const ms=report.metrics||[];let html=`<div class="dc48-details"><p>模块 ${esc(report.title)}；参与指标 ${ms.length}；可计算 ${report.computed??0}；缺口 ${report.missing??0}。本页仅做模拟计算/公式验证，不是正式业务签核。</p>`;
  html+='<table><thead><tr><th>指标/术语</th><th>完整公式</th><th>变量、分子、分母和排除条件</th><th>逐步分析依据</th></tr></thead><tbody>'+ms.map(m=>`<tr><td>${esc(m.id)} ${esc(m.name)}</td><td><code>${esc(m.formula||'未登记')}</code></td><td>依赖：${esc(safe(m.required_fields))}<p>排除：${esc(safe(m.exclusions))}</p><p>分子：${esc(safe(m.numerator))} / 分母：${esc(safe(m.denominator))}</p></td><td>${esc(safe(m.analysis_steps))}</td></tr>`).join('')+'</tbody></table>';
  html+='<h3>模块分析链</h3><ol>'+(report.analysis_steps||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol><p>'+esc(report.definition||'')+'</p></div>';return html;
 }
 function show(title,html){if(typeof showCustom==='function')showCustom(title,'来源完整性仅指当前接口快照；模拟标记不代表正式业务通过');const drawer=document.getElementById('drawer');if(drawer){const old=drawer.querySelector('.dc48-details');if(old)old.remove();const div=document.createElement('div');div.innerHTML=html;drawer.append(div);for(const [id] of selection)if(drawer.querySelector('[data-source-table="'+id+'"]'))tablePage(id,0)}else alert(title+'：本页面无可用明细抽屉');}
 async function getReport(kind,id){let nodeErr=null;
  try{const r=await fetch(moduleUrl(kind,id),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const out=await r.json();if(!out?.metrics||!Array.isArray(out.tables))throw Error('模块接口缺少指标和来源列表');return out;}catch(err){nodeErr=err}
  if(params().get('source')==='enterprise')throw new Error('企业来源接口不可用：'+nodeErr.message+'；禁止回退模拟数据');
  const offline=await import('/static/decision-center/offline_v2942.mjs');const q=Object.fromEntries(params());return offline.decisionModule(kind,id,q);
 }
 async function showModule(kind,id,action){show(action==='formula'?'计算依据 · 加载中':'来源明细 · 加载中','<p>正在核对来源及同一筛选范围…</p>');try{selection.clear();const r=await getReport(kind,id);show(r.title,action==='formula'?formulaView(r):sourceView(r));}catch(err){show('来源未核验','<p class="dc49-warning" role="alert">未能取得完整来源或公式：'+esc(err.message)+'。该项保持待核验，不允许标记通过。</p>')}}
 async function download(kind,id){try{const url=workbookUrl(kind,id),r=await fetch(url,{cache:'no-store'}).catch(()=>null);
   if(r?.ok&&/^application\/(?:vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|octet-stream)/.test(r.headers.get('content-type')||'')){const blob=await r.blob(),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`Pharma_Decision_${kind}_${id}_Formulas.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),4000);return;}
   if(params().get('source')==='enterprise')throw Error('企业数据工作簿接口不可用；禁止生成模拟替代品');
   const offline=await import('/static/decision-center/offline_v2942.mjs');await offline.downloadOfflineWorkbook(Object.fromEntries(params()),`Pharma_Decision_${kind}_${id}_SIMULATED_FORMULAS.xlsx`,{kind,id});
  }catch(err){show('Excel未生成','<p class="dc49-warning" role="alert">'+esc(err.message)+'，未生成虚假的公式文件。</p>')}}
 function ensure(node,kind,id,type='append'){if(!node||node.dataset.auditReady==='1')return;node.dataset.auditReady='1';const e=controls(kind,id);if(type==='wrap'){const wrapper=document.createElement('div');wrapper.className='dc48-wrapper';node.parentElement.insertBefore(wrapper,node);wrapper.append(node,e);}else if(type==='cell'){(node.lastElementChild||node).append(e);}else node.append(e);}
 function decorate(){if(typeof DATA==='undefined')return;
  document.querySelectorAll('.metric:not([data-audit-ready])').forEach(node=>{const name=node.querySelector('.name')?.textContent?.trim(),m=DATA.metrics.find(x=>x.name===name);if(m)ensure(node,'metric',m.id,'wrap')});
  document.querySelectorAll('.analysisCard:not([data-audit-ready])').forEach(node=>{const name=node.querySelector('h3')?.textContent.replace(/^\d+\s*·\s*/, '').trim(),ix=DATA.analysis.findIndex(x=>x[0]===name);if(ix>=0)ensure(node,'analysis',String(ix+1))});
  document.querySelectorAll('.ruleRow:not(.ruleHead):not([data-audit-ready])').forEach(node=>{const name=node.querySelector('b')?.textContent?.trim(),ix=DATA.rules.findIndex(x=>x[1]===name);if(ix>=0)ensure(node,'rule',String(ix+1),'cell')});
  document.querySelectorAll('.alertBox:not([data-audit-ready])').forEach(node=>{const name=node.querySelector('strong')?.textContent?.trim(),ix=DATA.rules.findIndex(x=>x[1]===name);if(ix>=0)ensure(node,'rule',String(ix+1))});
  document.querySelectorAll('.acttable tbody tr:not([data-audit-ready])').forEach(node=>{const name=node.querySelector('td:nth-child(2) b')?.textContent?.trim(),ix=DATA.actions.findIndex(x=>x[1]===name);if(ix>=0)ensure(node,'action',String(ix+1),'cell')});
  document.querySelectorAll('.dictTbl tbody tr:not([data-audit-ready])').forEach(node=>{const id=node.cells?.[0]?.textContent?.trim();if(DATA.metrics.find(x=>x.id===id))ensure(node,'metric',id,'cell')});
 }
 let busy=false;const observer=new MutationObserver(()=>{if(busy)return;busy=true;queueMicrotask(()=>{decorate();busy=false})});const root=document.getElementById('content'),alerts=document.getElementById('signals');if(root)observer.observe(root,{subtree:true,childList:true});if(alerts)observer.observe(alerts,{subtree:true,childList:true});
 document.addEventListener('click',e=>{const page=e.target.closest('[data-source-page]');if(page){e.preventDefault();const id=Number(page.dataset.sourcePage),v=selection.get(id);if(v)tablePage(id,v.page+Number(page.dataset.step));return}
  const c=e.target.closest('[data-audit]');if(!c)return;const wrap=c.closest('.dc48-audit');if(!wrap)return;const {kind,id}=wrap.dataset;const action=c.dataset.audit;e.preventDefault();e.stopImmediatePropagation();if(action==='excel')void download(kind,id);else void showModule(kind,id,action);
 },true);
 decorate();window.__DC_V2949_AUDIT={decorate,metricCount:()=>document.querySelectorAll('.dc48-wrapper').length,entryCount:()=>document.querySelectorAll('.dc48-audit').length,sourcePageCount:()=>selection.size};
})();
