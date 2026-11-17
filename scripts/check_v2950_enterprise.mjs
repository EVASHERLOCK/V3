/** V2.9.50 enterprise gate. Runs in blocked mode without genuine outside evidence.
 * Source integrity and real browser checks remain distinct from business approval. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileHash,enterpriseBrowserReport,auditComponentEvidence,verifySignature,REQUIRED_FIELDS} from '../enterprise_acceptance_v2950.mjs';
const args=process.argv.slice(2),pick=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:null;
const root=path.resolve(pick('--bundle')||process.env.PHARMA_ENTERPRISE_EVIDENCE_DIR||'enterprise_evidence_v2950');
const output=pick('--out')||'docs/V2950_第三层正式业务验收报告.json';
const registryFile='docs/V2948_逐实际控件验收清单.json';
const inventory=JSON.parse(fs.readFileSync(registryFile,'utf8')).components;
const required=JSON.parse(fs.readFileSync(registryFile,'utf8')).evidence_fields;
if(inventory.length!==585||JSON.stringify(required)!==JSON.stringify(REQUIRED_FIELDS))throw Error('585 inventory or required fields changed; do not silently pass');
const report={version:'2.9.50',tier:'ENTERPRISE_BUSINESS_SIGNED',evaluated_at:new Date().toISOString(),component_total:585,legacy_total:217,iframe_total:368,formal_passed:0,status:'BLOCKED',not_validated_as_enterprise:true,checks:{},blockers:[],notes:[]};
const add=(key,ok,detail)=>{report.checks[key]={ok:!!ok,...detail};if(!ok)report.blockers.push(key)};
const has=name=>fs.existsSync(path.join(root,name));
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const inventoryHash=fileHash(registryFile);
const trustedPath=pick('--trusted-signers')||process.env.PHARMA_TRUSTED_SIGNERS_PATH;
let trusted=null;
if(trustedPath&&fs.existsSync(trustedPath)&&!path.resolve(trustedPath).startsWith(path.resolve('.')+path.sep)){
 try{trusted=JSON.parse(fs.readFileSync(trustedPath,'utf8'))}catch{}
}
add('separately_governed_trusted_signers',!!trusted?.signers?.length&&!!trusted.enterprise_id,{detail:trusted?'Trust registry present; identity governance remains enterprise responsibility':'Trusted Ed25519 signer registry not configured externally'});
let br=null,browser=null;
if(has('browser_report.json')){
 try{br=read('browser_report.json');browser=enterpriseBrowserReport(br,inventory);add('live_browser_585_controls',browser.all_clicked,browser)}catch(e){add('live_browser_585_controls',false,{error:String(e.message||e)})}
}else add('live_browser_585_controls',false,{detail:'No actual HTTPS-deployment Chromium report; requires 585 clicked, downloaded, formula-bearing controls'});
let source=null,manifest=null;
if(has('source_manifest.json')){
 const check=spawnSync(process.execPath,['scripts/check_v2950_source_exports.mjs','--bundle',root,'--out',output+'.source.json'],{encoding:'utf8'});
 try{source=JSON.parse(fs.readFileSync(output+'.source.json','utf8'));manifest=read('source_manifest.json')}catch{}
 const structurallyOK=check.status===0&&source?.status==='STRUCTURAL_MATCH_AWAITING_SIGNED_ORIGIN'&&source?.verified_tables>0;
 add('erp_qms_full_export_count_pk_hash_snapshot',structurallyOK,{table_count:source?.table_count||0,rows:source?.rows_total||0,errors:source?.errors?.slice(0,12)||[check.stderr?.slice(0,200)]});
 const coverage=new Set(source?.covered_component_ids||[]),inventoryIDs=new Set(inventory.map(x=>x.id));
 add('enterprise_source_585_component_coverage',coverage.size===585&&[...coverage].every(x=>inventoryIDs.has(x)),{covered:coverage.size,required:585});
 const unsigned=manifest?{...manifest}:null;if(unsigned)delete unsigned.steward_signature;
 const signature=manifest?.steward_signature;
 const result=trusted&&signature?verifySignature(trusted,signature,unsigned):{ok:false,reason:'No external steward signature or trusted registry'};
 add('real_source_origin_data_steward_signature',result.ok&&result.role==='DATA_STEWARD',{detail:result.ok?'Ed25519 data steward signature checked':result.reason||'No valid data steward signature'});
}else{
 add('erp_qms_full_export_count_pk_hash_snapshot',false,{detail:'No real ERP/QMS exported source manifest'});
 add('enterprise_source_585_component_coverage',false,{covered:0,required:585});
 add('real_source_origin_data_steward_signature',false,{detail:'No signed real source manifest'});
}
let comp=null,componentAudit=null;
if(has('component_evidence.json')){
 try{comp=read('component_evidence.json');componentAudit=auditComponentEvidence(comp,inventory,root);add('component_12_evidence_fields_each',componentAudit.complete===585&&!componentAudit.unknown_records.length&&componentAudit.duplicate_ids===0,{
  complete:componentAudit.complete,total:585,verified_evidence_files:componentAudit.verified_evidence_files,examples:componentAudit.first_gaps.slice(0,8),unknown:componentAudit.unknown_records.slice(0,10)
 })}catch(e){add('component_12_evidence_fields_each',false,{error:String(e.message||e)})}
}else add('component_12_evidence_fields_each',false,{complete:0,total:585,detail:'No 585 rows x 12 evidence artifacts; no implicit pass from test reports'});
let signoffs=null;
if(has('business_signoffs.json')){
 try{
  signoffs=read('business_signoffs.json');const values={inventory_sha256:inventoryHash,browser_report_sha256:br?fileHash(path.join(root,'browser_report.json')):null,source_manifest_sha256:manifest?fileHash(path.join(root,'source_manifest.json')):null,component_evidence_sha256:comp?fileHash(path.join(root,'component_evidence.json')):null,decision:'APPROVE_ENTERPRISE_BUSINESS_ACCEPTANCE',scope:'ALL_585_COMPONENTS',version:'2.9.50',deployment_url:br?.url||null,dataset_version:manifest?.dataset_version||null};
  let valid=[];for(const s of signoffs.signatures||[]){
   if(JSON.stringify(s.payload)!==JSON.stringify(values))continue;
   const verified=trusted?verifySignature(trusted,s,s.payload):{ok:false};if(verified.ok)valid.push(verified)
  }
  const hasSteward=valid.some(v=>v.role==='DATA_STEWARD'),hasBusiness=valid.some(v=>v.role==='BUSINESS_OWNER');
  add('separate_signatures_data_steward_business_owner',hasSteward&&hasBusiness&&new Set(valid.map(v=>v.key_id)).size>=2,{valid_roles:[...new Set(valid.map(v=>v.role))],signer_keys:valid.map(v=>v.key_id)});
 }catch(e){add('separate_signatures_data_steward_business_owner',false,{error:String(e.message||e)})}
}else add('separate_signatures_data_steward_business_owner',false,{detail:'No separately signed and hash-bound business-owner approval'});
const complete=Object.values(report.checks).every(x=>x.ok);
report.status=complete?'PASS':'BLOCKED';report.not_validated_as_enterprise=!complete;
report.formal_passed=complete?585:0; // do not confuse independent partial evidence with formal signoff
report.blocker_count=report.blockers.length;
report.boundary=complete?'All formal evidence and signatures verified; business owner remains accountable for content and scope':'Technical test PASS cannot replace enterprise source authorization and individual business signoff';
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('V2950 ENTERPRISE ACCEPTANCE:',report.status,'formal',report.formal_passed+'/585','blocking gates',report.blocker_count);
for(const key of report.blockers)console.log('  BLOCKED',key);
if(args.includes('--strict')&&!complete)process.exitCode=2;
