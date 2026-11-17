/* V2.9.12 highest-priority product invariant: every categorical ranked view
   shows 10 decisions first, with the rest explicitly accessible. Do NOT
   truncate time series, cohort funnel stages, geographic maps or X/Y axes.
   Preserve original full data for downloads, filtering and drilldown. */
(()=>{'use strict';
 const LIMIT=10;
 const number=v=>{const s=String(v??'').replace(/[,，\s$¥%]/g,'');const m=s.match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
 const rankPriority=v=>{const raw=String(v??'').trim().toUpperCase();if(!raw)return null;if(/(?:^|\b)(P0|CRITICAL|HIGH)(?:\b|$)|重大|极高|高危|高风险/.test(raw))return 100;if(/(?:^|\b)(P1|MEDIUM)(?:\b|$)|中风险|预警|中危/.test(raw))return 70;if(/(?:^|\b)(P2|LOW)(?:\b|$)|低风险|关注/.test(raw))return 40;if(/(?:^|\b)P3(?:\b|$)/.test(raw))return 10;return number(v)};
 const compare=(a,b,accessor,direction='desc')=>{const av=accessor(a),bv=accessor(b),valid=x=>Number.isFinite(x);if(!valid(av))return valid(bv)?1:0;if(!valid(bv))return -1;return (direction==='asc'?av-bv:bv-av)};
 const ranked=(items,{score=(x)=>x?.priority??x?.score??x?.impact??null,direction='desc'}={})=>[...items].map((value,index)=>({value,index})).sort((a,b)=>compare(a.value,b.value,score,direction)||a.index-b.index).map(x=>x.value);
 const split=(items,options={})=>{const sorted=ranked(items,options);return {top:sorted.slice(0,LIMIT),rest:sorted.slice(LIMIT),total:sorted.length,limit:LIMIT}};
 function tablePolicy(table){if(table.dataset.top10Applied)return;const body=table.tBodies?.[0];if(!body||body.rows.length<=LIMIT)return;
   const ths=[...(table.tHead?.rows?.[0]?.cells||[])].map(x=>(x.textContent||'').trim());
   const priorityIndex=ths.findIndex(x=>/风险|评分|得分|金额|节省|贡献|权重|score|risk|amount|savings|priority|impact/i.test(x));
   const rows=[...body.rows];const canRank=priorityIndex>=0&&rows.filter(row=>rankPriority(row.cells[priorityIndex]?.textContent)!=null).length>=Math.ceil(rows.length*.7);
   // Explicit priority is mandatory when available. Otherwise keep upstream order;
   // arbitrary lexical re-sorting would destroy business workflow ordering.
   const sorted=canRank?ranked(rows,{score:row=>rankPriority(row.cells[priorityIndex]?.textContent)}):rows;
   const first=sorted.slice(0,LIMIT),remaining=sorted.slice(LIMIT);
   const clone=table.cloneNode(false),head=table.tHead?.cloneNode(true);if(head)clone.appendChild(head);const extraBody=document.createElement('tbody');clone.appendChild(extraBody);
   remaining.forEach(r=>extraBody.appendChild(r));first.forEach(r=>body.appendChild(r));
   const details=document.createElement('details');details.className='top10-overflow';details.innerHTML=`<summary>展开其余 ${remaining.length} 条（完整明细） · 默认展示 Top ${LIMIT}</summary>`;details.appendChild(clone);
   table.insertAdjacentElement('afterend',details);table.dataset.top10Applied='true';
   const note=document.createElement('div');note.className='top10-policy-note';note.textContent=`TOP ${LIMIT} · ${canRank?'按关键指标由高到低排序':'保持业务优先顺序'} · 全量 ${sorted.length} 条可展开`;
   table.insertAdjacentElement('beforebegin',note);
 }
 // Ranked chart-entry policy uses opt-in explicit markers; cannot blindly
 // manipulate SVG bars, X/Y scatter plots or monthly trend paths.
 function chartPolicy(chart){if(chart.dataset.top10Applied)return;const children=[...chart.children].filter(x=>x.matches('[data-rank-item]'));
  if(children.length<=LIMIT)return;const direction=chart.dataset.rankDirection||'desc';
  const sorted=ranked(children,{score:x=>number(x.dataset.rankScore),direction});
  const overflow=document.createElement('details');overflow.className='top10-overflow';const summary=document.createElement('summary');summary.textContent=`查看其余 ${children.length-LIMIT} 项 · Top 10 以外`;overflow.appendChild(summary);
  const rest=document.createElement('div');rest.className=chart.className+' top10-expanded-items';sorted.slice(LIMIT).forEach(x=>rest.appendChild(x));overflow.appendChild(rest);
  sorted.slice(0,LIMIT).forEach(x=>chart.appendChild(x));chart.insertAdjacentElement('afterend',overflow);chart.dataset.top10Applied='true';
 }
 function rankChartRows(container,selector,direction='desc'){
  if(container.dataset.top10Applied)return;
  const rows=[...container.children].filter(x=>x.matches(selector));if(rows.length<=LIMIT)return;
  const score=row=>{const hinted=number(row.dataset.rankScore);if(hinted!=null)return hinted;
    const elements=[...row.querySelectorAll('strong,b')];return number(elements.at(-1)?.textContent)||null};
  const sorted=ranked(rows,{score,direction});
  const rest=document.createElement('details');rest.className='top10-overflow';
  const summary=document.createElement('summary');summary.textContent=`展开其余 ${rows.length-LIMIT} 项 · 首屏 Top 10`;rest.appendChild(summary);
  const more=document.createElement('div');more.className=container.className+' top10-expanded-items';sorted.slice(LIMIT).forEach(x=>more.appendChild(x));rest.appendChild(more);
  sorted.slice(0,LIMIT).forEach(x=>container.appendChild(x));container.insertAdjacentElement('afterend',rest);container.dataset.top10Applied='true';
 }
 let providerStatus=null,providerPromise=null;
 function officialStatus(root){if(!String(location.hash||'').startsWith('#ss'))return;
  if(root.querySelector('.top10-source-status'))return;
  const panel=document.createElement('div');panel.className='top10-source-status';panel.innerHTML='<b>官方采购情报 / Official data:</b> <span>检查独立服务端同步状态…</span> <small>官方风险线索≠GMP/CEP/ASL/采购批准；<a href="https://open.fda.gov/apis/drug/drugshortages/" target="_blank" rel="noopener">FDA药品短缺</a> · <a href="https://open.fda.gov/apis/drug/enforcement/" target="_blank" rel="noopener">FDA召回</a></small><button data-source-action="open">进入官方数据源管理页面</button>';
  root.insertBefore(panel,root.querySelector('.top10-site-rule')?.nextSibling||root.firstChild);
  const show=result=>{if(!panel.isConnected)return;const count=Number(result?.total_signals||0),pending=Number(result?.pending_review||0),last=result?.last_run||'尚未同步';panel.querySelector('span').textContent=result?.unavailable?'尚未连接持久化官方情报服务（当前演示模式）':`线索 ${count} 条 · 待人工核验 ${pending} 条 · 最近采集 ${last}`;};
  if(providerStatus)return show(providerStatus);
  if(!providerPromise){providerPromise=fetch('/api/sourcing/registry/public').then(r=>r.ok?r.json():Promise.reject(Error('offline'))).then(x=>providerStatus=x).catch(()=>providerStatus={unavailable:true}).finally(()=>{providerPromise=null})}
  void providerPromise.then(show);
 }
 function apply(root){if(!root?.querySelectorAll)return;
  root.querySelectorAll('table').forEach(table=>{if(table.closest('.top10-overflow')||table.closest('[data-top10-exempt]'))return;tablePolicy(table)});
  root.querySelectorAll('[data-rank-chart]').forEach(chartPolicy);
  root.querySelectorAll('.v16-bars').forEach(x=>rankChartRows(x,'.v16-bar-row'));
  root.querySelectorAll('.exec-ppv-list').forEach(x=>rankChartRows(x,'button'));
  root.querySelectorAll('.exec-barrow').forEach(x=>rankChartRows(x.parentElement,'.exec-barrow'));
  const content=document.getElementById('content');if(root===content&&!content.querySelector('.top10-site-rule')){
   const banner=document.createElement('div');banner.className='top10-site-rule';banner.setAttribute('role','note');banner.textContent='全站决策展示规则：排名型图表和明细默认 Top 10（按业务重要性排序），其余可展开；趋势、漏斗、地图保留完整坐标与阶段。数据真实性以来源标记为准。';content.prepend(banner)
  }
  if(root===content)officialStatus(content);
 }
 window.PharmaTopTen={LIMIT,ranked,split,apply,INVARIANT:'ALL_PAGES_ALL_CATEGORICAL_CHARTS_TOP10_REST_EXPAND',EXCEPTIONS:'time-series|funnel|map|scatter-axis'};
})();
