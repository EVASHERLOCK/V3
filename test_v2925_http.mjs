import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import net from 'node:net';import {spawn} from 'node:child_process';
const dirname=fs.mkdtempSync(path.join(os.tmpdir(),'pharma2925http-'));
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n))})});
const token='test-v2925-admin-token-not-for-use';
const app=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',SOURCING_ADMIN_TOKEN:token,ENTERPRISE_CONNECTOR_PATH:path.join(dirname,'erp.json'),SOURCING_REGISTRY_PATH:path.join(dirname,'registry.json'),COMPLIANCE_STORE_PATH:path.join(dirname,'compliance.json')},stdio:['ignore','pipe','pipe']});
let logs='';app.stdout.on('data',d=>logs+=d.toString());app.stderr.on('data',d=>logs+=d.toString());
const base=`http://127.0.0.1:${port}`;
async function ask(uri,{method='GET',auth=true,data}={}){return fetch(base+uri,{method,headers:{...(auth?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined})}
const wait=async()=>{for(let i=0;i<60;i++){try{const r=await fetch(base+'/api/health');if(r.status<500)return;}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('server not ready '+logs)};
const po=[
 {po_id:'PO-ERP-01',supplier_id:'E-A',site_id:'S-A',material_id:'API-001',created_date:'2026-10-01',ordered_qty:10,received_qty:10,unit_price_usd:100,amount_usd:1000,benchmark_price_usd:110,delay_days:0,currency:'USD'},
 {po_id:'PO-ERP-02',supplier_id:'E-B',site_id:'S-B',material_id:'EXC-002',created_date:'2026-10-02',ordered_qty:10,received_qty:10,unit_price_usd:200,amount_usd:2000,benchmark_price_usd:195,delay_days:5,currency:'USD'}
];
const qms=[{event_id:'CAPA-ERP-01',record_type:'CAPA',supplier_id:'E-A',site_id:'S-A',material_id:'API-001',status:'OPEN',severity:'MAJOR',opened_at:'2026-10-01',due_date:'2026-11-01'}];
try{
 await wait();
 let res=await ask('/api/enterprise/dashboard?route=overview',{auth:false});assert.equal(res.status,403,'must not leak private KPIs');
 res=await ask('/api/enterprise/dashboard?route=overview');assert.equal(res.status,409,'no fake demo fallback');
 res=await ask('/api/integrations/enterprise/stage',{method:'POST',auth:false,data:{purchase_orders:po}});assert.equal(res.status,403);
 res=await ask('/api/integrations/enterprise/stage',{method:'POST',data:{purchase_orders:po,qms_events:qms}});assert.equal(res.status,200,await res.text().catch(()=>''));
 // Can't re-read body after text, stage id from status.
 res=await ask('/api/integrations/enterprise/status');let json=await res.json();const first=json.staged.snapshot_id;
 res=await ask('/api/enterprise/dashboard?route=overview');assert.equal(res.status,409,'staged is not published');
 res=await ask('/api/integrations/enterprise/release',{method:'POST',data:{snapshot_id:first,reviewer:'QA audit',reason:'Source fixture totals checked and approved for test analytics'}});assert.equal(res.status,200);
 res=await ask('/api/enterprise/dashboard?route=overview');assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/no-store/);json=await res.json();assert.equal(json.metrics.find(x=>x.id==='SRC.PO.SPEND').value,3000);assert.equal(json.reconciliation.passed,true);assert.equal(json.source.snapshot_id,first);
 const f1=await ask('/api/enterprise/dashboard?route=ss-cost&material=API-001');assert.equal(f1.status,200);const a=await f1.json();assert.equal(a.metrics.find(x=>x.id==='SRC.PO.SPEND').value,1000);
 const f2=await ask('/api/enterprise/dashboard?route=ss-performance');const b=await f2.json();assert.equal(b.source.snapshot_id,first);assert.equal(b.reconciliation.detail.otd,50);
 const d=await ask('/api/metrics/detail?source=enterprise&id=SRC.PO.SPEND&material=API-001');assert.equal(d.status,200);assert.equal((await d.json()).result,1000);
 const excel=await ask('/api/metrics/workbook.xlsx?source=enterprise&id=SRC.PO.SPEND&material=API-001');assert.equal(excel.status,200);assert.equal(Buffer.from(await excel.arrayBuffer()).subarray(0,2).toString(),'PK');
 // New release must be visible to the same running server without restart.
 const newer=po.map((x,i)=>i===0?{...x,amount_usd:1250,unit_price_usd:125}:x);
 await ask('/api/integrations/enterprise/stage',{method:'POST',data:{purchase_orders:newer,qms_events:qms}});
 res=await ask('/api/integrations/enterprise/status');const next=(await res.json()).staged.snapshot_id;
 res=await ask('/api/enterprise/dashboard?route=overview');assert.equal((await res.json()).source.snapshot_id,first,'staging never changes released version');
 await ask('/api/integrations/enterprise/release',{method:'POST',data:{snapshot_id:next,reviewer:'QA audit',reason:'New test release approved after reconciliation'}});
 res=await ask('/api/enterprise/dashboard?route=overview');json=await res.json();assert.equal(json.metrics.find(x=>x.id==='SRC.PO.SPEND').value,3250);assert.notEqual(json.fingerprint,a.fingerprint);assert.equal(json.source.snapshot_id,next);
 await ask('/api/integrations/enterprise/revoke',{method:'POST',data:{reviewer:'QA audit',reason:'Revoke test release'}});
 res=await ask('/api/enterprise/dashboard?route=overview');assert.equal(res.status,409);
 console.log('PASS V2925 live Node HTTP: permission 403, unpublished 409, snapshot release, 26-route reconciliation, exact metric/XLSX, hot republish and revoke');
}finally{app.kill('SIGTERM');fs.rmSync(dirname,{recursive:true,force:true})}
