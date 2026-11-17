import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v2930-http-'));
const bound=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const token='v2930-private-integration-test-only-token';
const proc=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(bound),HOST:'127.0.0.1',SOURCING_ADMIN_TOKEN:token,ENTERPRISE_CONNECTOR_PATH:path.join(dir,'enterprise.json'),SOURCING_REGISTRY_PATH:path.join(dir,'sources.json'),COMPLIANCE_WORKFLOW_PATH:path.join(dir,'compliance.json')},stdio:['ignore','pipe','pipe']});
let log='';for(const stdio of [proc.stdout,proc.stderr])stdio.on('data',x=>log+=x.toString());
const req=(p,{method='GET',auth=true,data=null}={})=>fetch(`http://127.0.0.1:${bound}${p}`,{method,headers:{...(auth?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
const wait=async()=>{for(let i=0;i<70;i++){try{const x=await req('/api/health');if(x.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error(log)};
const scope={supplier:'all',material:'API-001',year:'all',as_of:'2026-11-09'};
const po=[{po_id:'PO-HTTP1',supplier_id:'SUP-01',site_id:'SITE-01',material_id:'API-001',created_date:'2026-10-03',ordered_qty:10,received_qty:10,unit_price_usd:100,amount_usd:1000,benchmark_price_usd:95,delay_days:0,currency:'USD'},
{po_id:'PO-HTTP2',supplier_id:'SUP-02',site_id:'SITE-02',material_id:'API-001',created_date:'2026-10-04',ordered_qty:10,received_qty:9,unit_price_usd:110,amount_usd:1100,benchmark_price_usd:100,delay_days:3,currency:'USD'}];
const q='?route=ss-performance&material=API-001&supplier=all&year=all&as_of=2026-11-09';
const body=(id,value,snapshot)=>({route:'ss-performance',title:'采购支出审计',metrics:['SRC.PO.SPEND'],figures:[{label:'来源采购金额',metric_id:'SRC.PO.SPEND',value:String(value),unit:'USD',snapshot_id:snapshot,scope}]});
try{
 await wait();
 let r=await req('/api/enterprise/reconciliation/strict',{auth:false});assert.equal(r.status,403);
 r=await req('/api/enterprise/reconciliation/strict');assert.equal(r.status,409);
 r=await req('/api/integrations/enterprise/stage',{method:'POST',data:{purchase_orders:po}});assert.equal(r.status,200);let x=await r.json();const snapshot=x.staged.snapshot_id;
 r=await req('/api/integrations/enterprise/release',{method:'POST',data:{snapshot_id:snapshot,reviewer:'QA integration reviewer',reason:'Strict chart/metric source audit for isolated integration test'}});assert.equal(r.status,200);
 r=await req('/api/enterprise/reconciliation/strict');assert.equal(r.status,200);x=await r.json();assert.equal(x.pages.length,26);assert.equal(x.snapshot_id,snapshot);assert.equal(x.failed,0);
 r=await req('/api/enterprise/dashboard'+q);assert.equal(r.status,200);x=await r.json();assert.equal(x.strict_reconciliation.summary.chart_unverified,0);assert(x.strict_reconciliation.summary.chart_points_verified>=2);
 r=await req('/api/lineage/module?source=enterprise&material=API-001&as_of=2026-11-09',{method:'POST',data:body('',2100,snapshot)});assert.equal(r.status,200);x=await r.json();assert.equal(x.reconciliation.figures[0].status,'CONTROLLED_DISPLAY_RECONCILED_NON_GXP');
 r=await req('/api/lineage/module?source=enterprise&material=API-001&as_of=2026-11-09',{method:'POST',data:body('',2200,snapshot)});assert.equal(r.status,200);x=await r.json();assert.equal(x.reconciliation.status,'FAIL');
 r=await req('/api/lineage/module?source=enterprise&material=API-001&as_of=2026-11-09',{method:'POST',auth:false,data:body('',2100,snapshot)});assert.equal(r.status,403);
 r=await req('/api/lineage/module/workbook.xlsx?source=enterprise&material=API-001&as_of=2026-11-09',{method:'POST',data:body('',2100,snapshot)});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/spreadsheetml/);assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,2).toString(),'PK');
 r=await req('/api/integrations/enterprise/revoke',{method:'POST',data:{reviewer:'QA integration reviewer',reason:'Test completed'}});assert.equal(r.status,200);
 r=await req('/api/enterprise/reconciliation/strict');assert.equal(r.status,409);
 console.log('PASS V2930 Node HTTP: 26-page independent chart audit, precise matching, deliberate mismatch, private workbook, 403, unpublished 409, revoke 409');
}finally{proc.kill('SIGTERM');fs.rmSync(dir,{recursive:true,force:true})}
