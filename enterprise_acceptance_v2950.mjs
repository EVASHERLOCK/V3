/**
 * V2.9.50 formal business acceptance: evidence verification only.
 * Never generates approvals or labels synthetic data as an ERP/QMS export.
 * Trusted public keys must be controlled by the enterprise outside this source bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const REQUIRED_FIELDS=['click_formula','formula_variables','calculation_conditions','source_row_identity','source_row_count','full_source_pagination','cell_formula_web','cell_formula_xlsx','excel_numeric_match','narrative_steps','browser_e2e','business_signoff'];
export const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
export const fileHash=file=>sha256(fs.readFileSync(file));
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function safeRef(root,ref){
 if(typeof ref!=='string'||!ref||path.isAbsolute(ref)||ref.includes('\\'))throw Error('invalid evidence path');
 const full=path.resolve(root,ref),base=path.resolve(root);
 if(!full.startsWith(base+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile())throw Error('missing/outside evidence path: '+ref);
 const real=fs.realpathSync(full),realBase=fs.realpathSync(base);
 if(!real.startsWith(realBase+path.sep))throw Error('symlink escapes evidence root: '+ref);
 return full;
}
export function verifyFileRef(root,item){
 if(!item||typeof item.sha256!=='string'||!/^[0-9a-f]{64}$/.test(item.sha256))return false;
 try{return fileHash(safeRef(root,item.path))===item.sha256}catch{return false}
}
export function verifySignature(trusted,entry,payload){
 const signer=trusted?.signers?.find(x=>x.key_id===entry?.key_id&&x.active===true);
 if(!signer||!['DATA_STEWARD','BUSINESS_OWNER'].includes(signer.role)||typeof entry.signature!=='string')return {ok:false,reason:'untrusted signer'};
 if(entry.role!==signer.role||entry.payload_sha256!==sha256(canonical(payload)))return {ok:false,reason:'signed role or payload mismatch'};
 try{return {ok:crypto.verify(null,Buffer.from(canonical(payload)),crypto.createPublicKey(signer.public_key_pem),Buffer.from(entry.signature,'base64')),role:signer.role,key_id:entry.key_id}}catch(e){return {ok:false,reason:e.message}}
}
export function enterpriseBrowserReport(result,inventory){
 const ids=new Set(inventory.map(x=>x.id));const found=new Map();let duplicate=0,verified=0;
 for(const row of result?.components||[]){
  if(!ids.has(row.id)||found.has(row.id)){duplicate++;continue}
  found.set(row.id,row);if(row.status==='CLICK_TESTED'&&row.formula?.ok&&row.sources?.ok&&row.excel?.ok&&row.excel?.formula_cells>0)verified++;
 }
 const missing=inventory.filter(x=>!found.has(x.id)).map(x=>x.id);
 const local=!!result?.url&&/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(result.url+'/');
 const production=result?.test_type==='LIVE_CHROMIUM_HTTP_BROWSER'&&result?.environment==='ENTERPRISE_DEPLOYMENT'&&/^https:\/\//.test(result.url||'')&&!local;
 return {production,verified,registered:inventory.length,missing:missing.length,duplicates:duplicate,all_clicked:production&&verified===inventory.length&&missing.length===0&&duplicate===0,first_missing:missing.slice(0,15)};
}
export function auditComponentEvidence(records,inventory,base){
 const provided=records?.components||[];const by=new Map(provided.map(x=>[x.id,x]));const duplicate_ids=provided.length-by.size;let complete=0,files_checked=0,failed=0;const gaps=[];
 for(const item of inventory){
  const entry=by.get(item.id),miss=[];
  for(const key of REQUIRED_FIELDS){
   const proof=entry?.evidence?.[key];
   if(proof?.verified!==true||!verifyFileRef(base,proof)){miss.push(key);continue}
   // Every component/field must have its own evidence record; a shared screenshot or a dummy file is insufficient.
   try{const r=JSON.parse(fs.readFileSync(safeRef(base,proof.path),'utf8'));
    if(r.component_id!==item.id||r.field!==key||r.verified!==true||!r.method||!r.provenance||!r.recorded_at)miss.push(key);else files_checked++;
   }catch{miss.push(key)}
  }
  if(!miss.length)complete++;else{failed++;gaps.push({id:item.id,missing:miss});}
 }
 return {total:inventory.length,complete,not_complete:failed,duplicate_ids,verified_evidence_files:files_checked,unknown_records:[...by.keys()].filter(k=>!inventory.some(i=>i.id===k)),first_gaps:gaps.slice(0,30),gaps};
}
