#!/usr/bin/env node
/** Read-only deployment readiness and public HTTPS diagnosis.
 * Does not upload data, use credentials, mutate ERP/QMS, or issue sign-offs.
 * Do not commit the generated report if it includes environment details. */
import fs from 'node:fs';
import path from 'node:path';
const iso=()=>new Date().toISOString();
const target=[
 {id:'FDA_SHORTAGES',url:'https://api.fda.gov/drug/shortages.json?limit=1',type:'JSON_API'},
 {id:'FDA_RECALLS',url:'https://api.fda.gov/drug/enforcement.json?limit=1',type:'JSON_API'},
 {id:'EDQM_CEP_PORTAL',url:'https://www.edqm.eu/en/certification',type:'WEBSITE_HEALTH_ONLY'}
];
async function probe(row,timeoutMs){
 const start=Date.now(),ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const response=await fetch(row.url,{signal:ctrl.signal,redirect:'manual',headers:{Accept:row.type==='JSON_API'?'application/json':'text/html'}});
  let classification='FAILED',records=null;
  if(response.status===429)classification='RATE_LIMITED';
  else if(response.status>=300&&response.status<400)classification='REDIRECT_NOT_FOLLOWED';
  else if(response.ok){const text=(await response.text()).slice(0,160000);if(row.type==='JSON_API'){
   try{const j=JSON.parse(text);if(Array.isArray(j.results)){classification='SUCCESS_API_DATA';records=j.results.length}else classification='INVALID_API_SHAPE'}catch{classification='INVALID_JSON'}
  }else classification='SITE_REACHABLE_NOT_DATA_DOWNLOAD';}
  return {source:row.id,kind:row.type,classification,http_status:response.status,records_sample:records,latency_ms:Date.now()-start,checked_at:iso()};
 }catch(err){return {source:row.id,kind:row.type,classification:err?.name==='AbortError'?'TIMEOUT':'NETWORK_FAILURE',error_name:String(err?.cause?.code||err?.code||err?.name||'FetchError').slice(0,60),latency_ms:Date.now()-start,checked_at:iso()};}
 finally{clearTimeout(timer)}
}
export async function integrationReadiness({network=true,timeoutMs=6000}={}){
 const flags={erp_url_configured:Boolean(process.env.ERP_PO_API_URL),qms_url_configured:Boolean(process.env.QMS_EVENTS_API_URL),erp_token_configured:Boolean(process.env.ERP_API_TOKEN),qms_token_configured:Boolean(process.env.QMS_API_TOKEN),enterprise_allowed_hosts_configured:Boolean(process.env.ENTERPRISE_ALLOWED_HOSTS),admin_token_configured:Boolean(process.env.SOURCING_ADMIN_TOKEN),official_auto_sync_enabled:process.env.SOURCING_AUTO_SYNC==='1',edqm_auto_sync_enabled:process.env.SOURCING_EDQM_AUTO_SYNC==='1'};
 const dataPath=path.resolve(process.env.ENTERPRISE_CONNECTOR_PATH||'.runtime/enterprise_sources_v2923.json');
 let storageParentWritable=false;try{const dir=path.dirname(dataPath);storageParentWritable=fs.existsSync(dir)&&Boolean((fs.statSync(dir).mode&0o200))}catch{}
 const sources=network?await Promise.all(target.map(x=>probe(x,timeoutMs))):target.map(x=>({source:x.id,classification:'SKIPPED_OFFLINE'}));
 const trueOfficialData=sources.some(x=>x.classification==='SUCCESS_API_DATA');
 return {version:'2.9.24',at:iso(),environment:{node:process.version,persistent_store_configured:Boolean(process.env.ENTERPRISE_CONNECTOR_PATH),data_parent_writable:storageParentWritable,bolt_preview_is_not_production_validation:true},configuration:flags,official:sources,live_official_api_success:trueOfficialData,enterprise_production_connected:false,reason:'Only configuration flags and public endpoint probes were checked. ERP/QMS credentials and full enterprise payloads were not fetched in this diagnostic.',requires:['部署长期Node进程','配置持久化卷/数据库并备份','配置只读企业ERP/QMS访问和允许的主机名','验证授权身份/审计权限与质量审核流程','实际同步源记录并核对SHA256/时间/行数','人工审核发布后跨页对账','对正式GxP系统另行开展CSV验证']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const args=process.argv.slice(2),offline=args.includes('--offline'),idx=args.indexOf('--output');
 const report=await integrationReadiness({network:!offline});
 if(idx>=0&&args[idx+1]){const f=path.resolve(args[idx+1]);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(report,null,2)+'\n',{mode:0o600});}
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
