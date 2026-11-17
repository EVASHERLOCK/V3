/** V2.9.52 23-source DEMO pagination regression, never enterprise-data claims. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {ALL_SOURCE_TABLES, AUXILIARY_TABLES, rowsFor, overview} from '../sim_data_center_v2941.mjs';
const root=process.cwd();
const h=x=>crypto.createHash('sha256').update(x).digest('hex');
const server=net.createServer();await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),PHARMA_DATA_MODE:'SIMULATED'},stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
const report={version:'2.9.52',mode:'SIMULATED',method:'ACTUAL_NODE_HTTP_PAGINATION',tested_at:new Date().toISOString(),sources:[],errors:[]};
async function request(endpoint){const r=await fetch(base+endpoint,{signal:AbortSignal.timeout(15000)});let body=await r.json().catch(()=>({}));return {status:r.status,body};}
try{
 for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error('Node server exited before ready');try{if((await request('/api/sim-data/overview')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const ov=(await request('/api/sim-data/overview')).body;
 assert.equal(ALL_SOURCE_TABLES.length,23);assert.deepEqual(ov.all_source_tables,ALL_SOURCE_TABLES);assert.deepEqual(ov.auxiliary_readonly_tables,AUXILIARY_TABLES);
 let count=0;
 for(const table of ALL_SOURCE_TABLES){
  const local=rowsFor(table),ids=new Set();let offset=0,total=null,snapshot='',key='',pages=0;
  do{
   const q=new URLSearchParams({table,offset:String(offset),limit:'137'});if(snapshot)q.set('snapshot',snapshot);
   const {status,body}=await request('/api/sim-data/complete-page?'+q);
   assert.equal(status,200,`Source ${table} offset ${offset} HTTP ${status}`);
   assert.equal(body.source_type,'SIMULATED_LOCAL_CSV_NON_GXP');assert.equal(body.full_source_covered,false);
   assert.equal(body.offset,offset);assert.equal(body.returned,body.rows.length);assert.equal(body.row_ids.length,body.rows.length);
   assert.equal(body.total,local.length);
   if(snapshot){assert.equal(body.source_snapshot,snapshot);assert.equal(body.primary_key,key)}else {snapshot=body.source_snapshot;key=body.primary_key;total=body.total;}
   for(const [i,id] of body.row_ids.entries()){
    assert.ok(id,'Missing primary key '+table);
    assert.ok(!ids.has(id),'Duplicate global source ID '+table+'/'+id);
    assert.equal(id,body.rows[i][key]);ids.add(id);
    assert.deepEqual(body.rows[i],local[offset+i],table+' record value differs');
   }
   pages++;offset+=body.returned;
   assert.equal(body.has_more,offset<total);
   assert.equal(body.next_offset,offset<total?offset:null);
   if(pages>500)throw Error('Too many pages for '+table);
  }while(offset<total);
  assert.equal(offset,local.length);
  const stale=await request('/api/sim-data/complete-page?'+new URLSearchParams({table,snapshot:'stale-snapshot',limit:'1'}));assert.equal(stale.status,409);
  count+=offset;
  report.sources.push({table,kind:AUXILIARY_TABLES.includes(table)?'AUXILIARY_READ_ONLY':'CANONICAL_BUSINESS',rows:offset,pages,primary_key:key,unique_keys:ids.size,snapshot_sha256:snapshot,source_csv_sha256:h(fs.readFileSync(`seed_simulated/${table}.csv`)),status:'PASS'});
 }
 assert.equal(count,Object.values(ov.all_source_counts).reduce((x,y)=>x+y,0));
 const manifest=JSON.parse(fs.readFileSync('seed_simulated/manifest.json','utf8'));
 for(const entry of report.sources)assert.equal(entry.rows,manifest[entry.table]??(entry.table==='monthly_kpi_summary'?12:null));
 report.total_rows=count;report.table_count=report.sources.length;report.auxiliary_count=report.sources.filter(x=>x.kind==='AUXILIARY_READ_ONLY').length;
 report.overall='PASS';
}catch(err){report.overall='BLOCKED';report.errors.push(String(err.stack||err));process.exitCode=1;
}finally{child.kill('SIGTERM');fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/V2952_Demo_23表全量API分页逐行同值.json',JSON.stringify(report,null,2)+'\n');console.log(`V2952 demo full pagination: ${report.overall}; ${report.sources.length}/23 sources; ${report.total_rows??0} rows`);}
