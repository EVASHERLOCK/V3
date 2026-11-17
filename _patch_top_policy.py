from pathlib import Path
p=Path('static/top10_governance.js');s=p.read_text();start=s.index(' function apply(root){');s=s[:start]+''' function rankChartRows(container,selector,direction='desc'){
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
  const panel=document.createElement('div');panel.className='top10-source-status';panel.innerHTML='<b>官方采购情报 / Official data:</b> <span>检查独立服务端同步状态…</span> <small>官方风险线索≠GMP/CEP/ASL/采购批准；<a href="https://open.fda.gov/apis/drug/drugshortages/" target="_blank" rel="noopener">FDA药品短缺</a> · <a href="https://open.fda.gov/apis/drug/enforcement/" target="_blank" rel="noopener">FDA召回</a></small>';
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
'''
p.write_text(s)
p=Path('static/v16_overview.js');s=p.read_text().replace('.slice(0,6)} function riskTable', '.slice(0,10)} function riskTable').replace("'高风险事项 TOP6'","'高风险事项 TOP10'").replace("panel('高风险事项 TOP6'", "panel('高风险事项 TOP10'").replace('tasks).slice(0,3);  const taskTable','tasks).slice(0,10);  const taskTable').replace("'优先改善任务 TOP3'","'优先改善任务 TOP10'");p.write_text(s)
p=Path('static/home_dashboard.js');s=p.read_text().replace('Top 3 占比','Top 10 候选集中度（已关联记录可能不足 10 家）· Top 3 占比');p.write_text(s)
