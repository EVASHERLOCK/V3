/** V2.9.48 explicitly scoped full-row check of SIMULATED_LOCAL_CSV_NON_GXP.
 * Never asserts enterprise database coverage. A failed/unsupported Node API = NOT VERIFIED. */
(()=>{
 'use strict';
 const button=document.getElementById('verify-complete-sim-source');
 const summary=document.getElementById('sim-source-summary');
 const target=document.getElementById('sim-source-table');
 if(!button||!summary||!target)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const request=async path=>{const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw Error(`HTTP ${response.status}: ${path.slice(0,90)}`);
  return response.json();};
 async function fullTable(name){
  let offset=0,total=null,digest='',key='',pages=0;
  const ids=new Set(),windowSize=350;
  for(;;){
   const args=new URLSearchParams({table:name,limit:String(windowSize),offset:String(offset)});
   if(digest)args.set('snapshot',digest);
   const response=await request('/api/sim-data/complete-page?'+args);
   if(response.source_type!=='SIMULATED_LOCAL_CSV_NON_GXP'||response.full_source_covered!==false)throw Error('来源类型/核验声明异常');
   if(total===null){total=response.total;digest=response.source_snapshot;key=response.primary_key;}else if(response.total!==total||response.source_snapshot!==digest)throw Error('快照或总数发生变化');
   if(response.offset!==offset||response.returned!==response.rows?.length||response.returned!==response.row_ids?.length)throw Error('分页偏移/行数不匹配');
   for(const id of response.row_ids){if(!id||ids.has(id))throw Error('主键缺失或重复：'+id);ids.add(id)}
   offset+=response.returned;pages++;
   if(!response.has_more)break;
   if(response.next_offset!==offset||pages>1000||!response.returned)throw Error('分页不能完整继续');
  }
  if(offset!==total||ids.size!==total)throw Error('主键去重行数与来源 total 不一致');
  return {table:name,records:total,pages,primary_key:key,snapshot:digest,status:'SIMULATED_SNAPSHOT_ROWS_VERIFIED',enterprise_verified:false};
 }
 button.addEventListener('click',async()=>{
  button.disabled=true;summary.textContent='正在按快照遍历来源模拟表…';target.textContent='';
  const entries=[],failures=[];
  try{
   const overview=await request('/api/sim-data/overview');
   const names=overview.all_source_tables;
   if(!Array.isArray(names)||names.length!==23||overview.auxiliary_readonly_tables?.length!==2)throw Error('来源目录必须覆盖 21 张业务表及 2 张辅助表');
   for(const name of names){try{entries.push(await fullTable(name))}catch(err){failures.push({table:name,error:err.message});}
    summary.textContent=`模拟来源检查进度 ${entries.length+failures.length}/${names.length} 表；失败 ${failures.length}`;}
   const ok=entries.length===23&&!failures.length;
   summary.textContent=ok?`模拟来源全量快照已核验：23 表 / ${entries.reduce((s,t)=>s+t.records,0).toLocaleString()} 行；仅 Demo 模拟数据，不需要 ERP`:`模拟来源未全部通过：成功 ${entries.length} 表，失败 ${failures.length} 表`;
  }catch(err){failures.push({table:'ALL',error:err.message});summary.textContent='全量来源检查不可用：'+err.message+'；禁止 PASS';}
  target.innerHTML=`<table><thead><tr><th>模拟来源表</th><th>行数</th><th>分页数</th><th>校验状态</th><th>Demo 来源类别</th></tr></thead><tbody>${entries.map(t=>`<tr><td>${esc(t.table)}</td><td>${t.records}</td><td>${t.pages}</td><td style="color:#19724e">SIMULATED_ONLY_VERIFIED</td><td>${t.table==='supplier_documents'||t.table==='monthly_kpi_summary'?'辅助只读 CSV':'业务模拟 CSV'}</td></tr>`).join('')}${failures.map(e=>`<tr><td>${esc(e.table)}</td><td>—</td><td>—</td><td style="color:#b31b33">FAILED: ${esc(e.error)}</td><td>DEMO</td></tr>`).join('')}</tbody></table>`;
  button.disabled=false;
 });
})();
