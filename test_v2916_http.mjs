import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pharma-compliance-http-'));
const port=35000+Math.floor(Math.random()*1000);
const tokens={procurement:'procurement-role-token-abcdefgh',sqm:'sqm-role-token-abcdefghijk',ra:'ra-role-token-abcdefghijk',qa:'qa-role-token-abcdefghijk',admin:'admin-role-token-abcdefghijk'};
const env={...process.env,PORT:String(port),COMPLIANCE_ROLE_TOKENS_JSON:JSON.stringify(tokens),COMPLIANCE_WORKFLOW_PATH:path.join(dir,'workflow.json'),SOURCING_REGISTRY_PATH:path.join(dir,'registry.json'),SOURCING_AUTO_SYNC:'0'};
const child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env,stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
const req=async(url,role=null,method='GET',data=null)=>{const h={};if(role)h.Authorization='Bearer '+tokens[role];if(data!==null&&!(data instanceof FormData))h['Content-Type']='application/json';const response=await fetch(base+url,{method,headers:h,...(data!==null?{body:data instanceof FormData?data:JSON.stringify(data)}:{})});let json;try{json=await response.json()}catch{json=null}return {status:response.status,json}};
try{
 let alive=false;for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error('server exited');try{const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});if(response.ok){alive=true;break}}catch{}await new Promise(r=>setTimeout(r,75))}assert.equal(alive,true,'Node full server failed to start');
 assert.equal((await req('/api/compliance/workflow')).status,403);
 const overview=await req('/api/compliance/workflow','procurement');assert.equal(overview.status,200);
 const created=await req('/api/compliance/workflow/documents','procurement','POST',{supplier_id:'SUP-001',site_id:'SITE-001',material_id:'API-001',type:'CEP',category:'API',certificate_no:'SMOKE-001',market:'EU',expiry:'2027-12-31'});assert.equal(created.status,200,JSON.stringify(created.json));const docId=created.json.id;
 const submitted=await req(`/api/compliance/workflow/documents/${docId}/action`,'procurement','POST',{action:'submit'});assert.equal(submitted.status,200);
 const forbidden=await req(`/api/compliance/workflow/documents/${docId}/action`,'qa','POST',{action:'approve'});assert.equal(forbidden.status,400);
 const approved=await req(`/api/compliance/workflow/documents/${docId}/action`,'procurement','POST',{action:'approve',comment:'Initial procurement review'});assert.equal(approved.status,200);
 const dossier=await req('/api/compliance/workflow/dossiers/SUP-001','procurement','PUT',{fields:{legal_name:'Aster (DEMO, not officially verified)'}});assert.equal(dossier.status,200);
 const check=await req('/api/compliance/workflow/precheck','procurement','POST',{supplier_id:'SUP-001',site_id:'SITE-001',material_id:'API-001',market:'EU'});assert.equal(check.status,200);assert.equal(check.json.authorized_for_po,false);
 const up=new FormData();up.append('attachment',new File([new TextEncoder().encode('demo evidence, not valid GxP')],'test-evidence.txt',{type:'text/plain'}));const attachment=await req(`/api/compliance/workflow/documents/${docId}/attachment`,'sqm','POST',up);assert.equal(attachment.status,200,JSON.stringify(attachment.json));assert.equal(attachment.json.size>0,true);
 const audit=await req('/api/compliance/workflow/audit','qa');assert.equal(audit.status,200);assert.equal(audit.json.chain_ok,true);assert.ok(audit.json.total>=4);
 const publicPage=await fetch(base+'/');assert.equal(publicPage.status,200);const html=await publicPage.text();assert.ok(html.includes('PharmaSupplierDatabase'));
 console.log('PASS V2.9.16 HTTP: Node server startup, unauthenticated 403, role-scoped approval, forbidden cross-role signing, document registration, private attachment, dossier write, precheck deny, append-only audit and built site.');
}finally{child.kill('SIGTERM');fs.rmSync(dir,{recursive:true,force:true});}
