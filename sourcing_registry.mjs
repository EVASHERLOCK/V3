/** Pharma Procurement AI V2.9.13: evidence-first official intelligence registry.
 * External records are unverified sourcing *leads*, never supplier qualifications.
 * Only administrator-allowlisted HTTPS company homepages are fetched; no recursive crawl.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import {isIP} from 'node:net';
const VERSION=3;
const MAX_SIGNALS=5000,MAX_AUDIT=5000;
export const SOURCES=Object.freeze({
 FDA_DRUG_SHORTAGES:{url:'https://api.fda.gov/drug/shortages.json?limit=100',info:'https://open.fda.gov/apis/drug/drugshortages/',frequency:'上游每日（按官方接口实际发布）',type:'shortage',label:'FDA 药品短缺'},
 FDA_DRUG_RECALLS:{url:'https://api.fda.gov/drug/enforcement.json?limit=100',info:'https://open.fda.gov/apis/drug/enforcement/',frequency:'上游依 FDA 数据发布',type:'recall',label:'FDA 药品召回'},
 FDA_NDC_LABELERS:{url:'https://api.fda.gov/drug/ndc.json',info:'https://open.fda.gov/apis/drug/ndc/',frequency:'上游每日（需配置检索词）',type:'discovery',label:'FDA NDC 列名企业线索'}
});
export const ERP_MAP=Object.freeze({
 SAP_S4HANA:{supplier_id:'LIFNR',legal_entity_id:'BP_ID',site_id:'WERKS',material_id:'MATNR',quote_unit_price:'NETPR',currency:'WAERS',uom:'MEINS',lead_days:'PLIFZ',valid_from:'DATAB',valid_to:'DATBI'},
 GENERIC:{supplier_id:'supplier_id',legal_entity_id:'legal_entity_id',site_id:'site_id',material_id:'material_id',quote_unit_price:'unit_price',currency:'currency',uom:'uom',lead_days:'lead_days',valid_from:'valid_from',valid_to:'valid_to'}
});
const iso=()=>new Date().toISOString();
const digest=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const clean=(x,n=500)=>String(x??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
const initial=()=>({schema_version:VERSION,last_run:null,sources:{},signals:[],company_sites:[],search_terms:[],auto_sync_enabled:false,auto_sync_explicit:false,erp_staging:[],published_leads:[],audit:[]});
const isPrivateIP=ip=>{
 if(!isIP(ip))return true;
 if(ip.includes(':')){const lower=ip.toLowerCase();return lower==='::1'||lower==='::'||lower.startsWith('fe80:')||lower.startsWith('fc')||lower.startsWith('fd')||lower.startsWith('ff')||lower.startsWith('2001:db8:')||lower.startsWith('::ffff:')}
 const a=ip.split('.').map(Number);return a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===192&&a[1]===0&&a[2]===0;
};
export function validateCompanyUrl(raw,{allowedDomains=process.env.SOURCING_ALLOWED_DOMAINS||''}={}){
 let u;try{u=new URL(String(raw))}catch{throw Error('无效的企业官网 URL')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)throw Error('企业官网仅允许无凭据的 HTTPS 443 URL');
 const host=u.hostname.toLowerCase().replace(/\.$/,'');
 if(isIP(host)||host==='localhost'||!host.includes('.'))throw Error('必须使用公开的企业官网域名');
 const allow=String(allowedDomains).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!allow.some(d=>host===d||host.endsWith('.'+d)))throw Error('域名未列入服务端 SOURCING_ALLOWED_DOMAINS 白名单');
 if(u.pathname.length>200||u.search.length>150)throw Error('企业官网路径过长');
 u.hostname=host;return u.toString();
}
const metadata=(html,key)=>{
 const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const a=new RegExp('<meta\\s+[^>]*(?:name|property)=["\\\']'+escaped+'["\\\'][^>]*content=["\\\']([^"\\\']*)','i').exec(html);
 const b=new RegExp('<meta\\s+[^>]*content=["\\\']([^"\\\']*)["\\\'][^>]*(?:name|property)=["\\\']'+escaped,'i').exec(html);
 return clean((a||b)?.[1]||'',800)
};
export function companyPageFacts(html){
 const text=String(html).slice(0,500_000),title=clean((/<title[^>]*>([^<]*)<\/title>/i.exec(text)||[])[1],250);
 const description=metadata(text,'description')||metadata(text,'og:description');
 const plain=clean(text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot);/gi,' ').replace(/\s+/g,' '),1100);
 return {title,description,excerpt:plain};
}
export class SourcingRegistry{
 constructor({file=process.env.SOURCING_REGISTRY_PATH||'.runtime/sourcing_registry.json',fetchImpl=globalThis.fetch,resolveHost=async host=>dns.lookup(host,{all:true}),allowDomains=process.env.SOURCING_ALLOWED_DOMAINS||''}={}){
  this.file=path.resolve(file);this.fetch=fetchImpl;this.resolveHost=resolveHost;this.allowDomains=allowDomains;this.data=this.read();this.inflight=null;
 }
 read(){try{const d=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(d?.signals))return initial();return {...initial(),...d,schema_version:VERSION,company_sites:Array.isArray(d.company_sites)?d.company_sites:[],published_leads:Array.isArray(d.published_leads)?d.published_leads:[],search_terms:Array.isArray(d.search_terms)?d.search_terms:[],sources:d.sources||{},audit:Array.isArray(d.audit)?d.audit:[]}}catch{return initial()}}
 save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+process.pid+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.data,null,2),{mode:0o600});fs.renameSync(tmp,this.file)}
 audit(action,actor,details={}){this.data.audit.push({id:crypto.randomUUID(),at:iso(),action,actor:clean(actor),details});if(this.data.audit.length>MAX_AUDIT)this.data.audit=this.data.audit.slice(-MAX_AUDIT)}
 rankSignals(){return [...this.data.signals].sort((a,b)=>(b.priority??0)-(a.priority??0)||(b.observed_at||'').localeCompare(a.observed_at||''))}
 allSignals(){return this.rankSignals()}
 getSummary(){const ranked=this.rankSignals();return {schema_version:VERSION,last_run:this.data.last_run,sources:this.data.sources,total_signals:ranked.length,pending_review:ranked.filter(x=>x.review_status==='PENDING'||x.review_status==='NEEDS_MORE_INFO').length,reviewed_count:ranked.filter(x=>x.review_status==='ACCEPT_EVIDENCE').length,published_count:this.publishedCandidates().length,discovery_count:ranked.filter(x=>x.type==='discovery'||x.type==='company_watch').length,company_sites:this.data.company_sites.map(({id,name,url,enabled})=>({id,name,url,enabled})),search_terms:[...this.data.search_terms],erp_staged:this.data.erp_staging.length,top10:ranked.slice(0,10),other_count:Math.max(0,ranked.length-10),notice:'官方来源线索仅供寻源发现/风险提示，FDA NDC列名不是药品/企业批准；未经 QA/RA 验证不可宣称 GMP、CEP、ASL 或采购准入。'}}
 getConfig(){return {search_terms:[...this.data.search_terms],company_sites:this.data.company_sites.map(x=>({...x})),allowlist_required:true,allowed_domains:this.allowDomains.split(',').map(x=>x.trim()).filter(Boolean),auto_sync_enabled:this.data.auto_sync_explicit===true?this.data.auto_sync_enabled===true:(process.env.SOURCING_AUTO_SYNC==='1'||this.data.auto_sync_enabled===true),auto_sync_interval:'24h',data_mode:'PERSISTENT_NODE_ONLY'}}
 setAutoSync(enabled,{actor='sourcing-admin'}={}){if(typeof enabled!=='boolean')throw Error('enabled must be a boolean');this.data.auto_sync_enabled=enabled;this.data.auto_sync_explicit=true;this.audit('AUTO_SYNC_CONFIG_CHANGED',actor,{enabled});this.save();return this.getConfig()}
 setTerms(terms,{actor='sourcing-admin'}={}){if(!Array.isArray(terms)||terms.length>20)throw Error('检索词最多20条');const next=[...new Set(terms.map(x=>clean(x,60)).filter(Boolean))];if(next.some(x=>!/^[\p{L}\p{N}\s.\-()]+$/u.test(x)))throw Error('检索词只能包含字母、数字、空格、点、括号、短横线');this.data.search_terms=next;this.audit('DISCOVERY_TERMS_CHANGED',actor,{count:next.length});this.save();return this.getConfig()}
 async checkPublicHost(host){const answers=await this.resolveHost(host);if(!Array.isArray(answers)||!answers.length||answers.some(x=>isPrivateIP(x.address)))throw Error('目标域名解析到不可访问的网络地址');}
 addCompanySite({name,url,actor='sourcing-admin'}={}){if(this.data.company_sites.length>=30)throw Error('官网监测上限为30条');const safe=validateCompanyUrl(url,{allowedDomains:this.allowDomains});const u=new URL(safe),n=clean(name,120);if(!n)throw Error('请输入企业名称');const id='WEB-'+digest(safe).slice(0,16);if(this.data.company_sites.some(x=>x.id===id))throw Error('此官网已在监测列表');const x={id,name:n,url:safe,enabled:true,added_at:iso()};this.data.company_sites.push(x);this.audit('COMPANY_SITE_ADDED',actor,{id,url:safe});this.save();return x}
 removeCompanySite({id,actor='sourcing-admin'}={}){const i=this.data.company_sites.findIndex(x=>x.id===id);if(i<0)throw Error('官网配置不存在');const [x]=this.data.company_sites.splice(i,1);this.audit('COMPANY_SITE_REMOVED',actor,{id,url:x.url});this.save();return {removed:id}}
 normalize(provider,raw,fetchedAt,{sourceUrl=null,term=null}={}){
  const source=SOURCES[provider];let id='',name='',material='',severity='',reason='',priority=40,sourceUpdated='';
  if(provider==='FDA_NDC_LABELERS'){
   id=clean(raw.product_ndc||raw.product_id||raw.id||digest(raw).slice(0,20));name=clean(raw.labeler_name||'');material=clean((raw.active_ingredients||[]).map(x=>x.name).filter(Boolean).join('、')||raw.generic_name||raw.brand_name||'');severity='NDC 列名企业（非制造资格证明）';priority=45;reason=clean('关键词 '+(term||'未指定')+'；FDA 列名企业可能是制造商、重新包装商或品牌持有人，并非确定的 API 制造厂');sourceUpdated=clean(raw.listing_expiration_date||raw.marketing_start_date||'');
  }else{
   id=clean(provider==='FDA_DRUG_RECALLS'?(raw.recall_number||raw.report_number||raw.event_id||raw.id||digest(raw).slice(0,20)):(raw.shortage_id||raw.package_ndc||raw.id||raw.openfda?.product_ndc?.[0]||digest({name:raw.company_name,product:raw.generic_name}).slice(0,20)));name=clean(raw.recalling_firm||raw.manufacturer_name||raw.company_name||raw.openfda?.manufacturer_name?.[0]||'');material=clean(raw.product_description||raw.generic_name||raw.proprietary_name||'');severity=clean(raw.classification||raw.shortage_status||raw.status||'未分类');reason=clean(raw.reason_for_recall||raw.reason||raw.shortage_reason||'');priority=provider==='FDA_DRUG_RECALLS'?(severity==='Class I'?100:severity==='Class II'?80:60):70;sourceUpdated=clean(raw.report_date||raw.event_date||raw.last_updated||raw.initial_posting_date||'');
  }
  const recordUrl=provider==='FDA_NDC_LABELERS'&&id?`https://api.fda.gov/drug/ndc.json?search=product_ndc%3A%22${encodeURIComponent(id)}%22`:sourceUrl||source.url;
  return {id:`${provider}:${id}`,type:source.type,provider,source_url:recordUrl,source_info:source.info,observed_at:fetchedAt,source_updated_at:sourceUpdated,source_record_id:id,company_unverified:name,material_unverified:material,status_text:severity,reason,priority,review_status:'PENDING',verified_supplier_id:null,verified_site_id:null,verified_material_id:null,approved_for_purchase:false,gmp_approved:false,cep_approved:false,asl_approved:false,source_hash:digest(raw),data_origin:'OFFICIAL_PUBLIC_SIGNAL',evidence_excerpt:clean(JSON.stringify(raw),1200)};
 }
 upsert(r){const idx=this.data.signals.findIndex(x=>x.id===r.id);if(idx<0){if(this.data.signals.length>=MAX_SIGNALS)throw Error(`线索存储上限 ${MAX_SIGNALS} 条；请归档/迁移数据库`);this.data.signals.push(r);return 'added'}
  const prior=this.data.signals[idx];if(prior.source_hash!==r.source_hash){for(const pub of this.data.published_leads){if(pub.signal_id===r.id&&pub.status==='PUBLISHED'){pub.status='REVOKED_ON_SOURCE_CHANGE';pub.revoked_at=iso();}}this.data.signals[idx]={...r,review_notes:'来源记录发生变化，请重新审核'};this.audit('OFFICIAL_CHANGED','scheduled-ingest',{id:r.id,prior_hash:prior.source_hash,new_hash:r.source_hash});return 'changed'}return 'unchanged';
 }
 async fetchBounded(url,{accept='application/json',maxBytes=1000_000,headers={}}={}){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),14000);
  try{const r=await this.fetch(url,{headers:{Accept:accept,'User-Agent':'PharmaProcurementEvidenceMonitor/2.9.13 (read-only)',...headers},signal:c.signal,redirect:'manual'});
   if(r.status>=300&&r.status<400)throw Error('禁止自动跟随跳转：请人工检查源站地址');
   if(r.status===304)return {status:304,headers:r.headers,body:''};
   if(!r.ok)throw Error(`HTTP ${r.status}`);
   const advertised=Number(r.headers?.get?.('content-length')||0);if(advertised>maxBytes)throw Error('响应内容超出安全大小');
   if(!r.body){const raw=await r.text();if(Buffer.byteLength(raw)>maxBytes)throw Error('响应内容超出安全大小');return {status:r.status,headers:r.headers,body:raw}}
   const pieces=[];let size=0;for await(const part of r.body){size+=part.length;if(size>maxBytes){await r.body.cancel?.().catch(()=>{});throw Error('响应内容超出安全大小')}pieces.push(Buffer.from(part))}
   return {status:r.status,headers:r.headers,body:Buffer.concat(pieces).toString('utf8')};
  }finally{clearTimeout(timer)}
 }
 async fetchOfficial(provider,term){
  const src=SOURCES[provider],publicUrl=provider==='FDA_NDC_LABELERS'?src.url+'?'+new URLSearchParams({search:`active_ingredients.name:"${term}"`,limit:'100'}).toString():src.url;
  // API credential is appended only to the outbound server-side request and
  // must NEVER be stored in the source evidence URL or sent back to the browser.
  const requestUrl=new URL(publicUrl),apiKey=String(process.env.OPENFDA_API_KEY||'').trim();
  if(apiKey)requestUrl.searchParams.set('api_key',apiKey);
  const response=await this.fetchBounded(requestUrl.toString());let payload;try{payload=JSON.parse(response.body)}catch{throw Error('官方 API 响应不是有效 JSON')}
  if(!Array.isArray(payload.results))throw Error('官方 API 无 results 数组');return {payload,url:publicUrl};
 }
 async syncOfficial(provider,{force=false}={}){
  const src=SOURCES[provider],previous=this.data.sources[provider]||{},now=Date.now();if(!src)throw Error('Unknown provider');
  if(provider==='FDA_NDC_LABELERS'&&!this.data.search_terms.length){this.data.sources[provider]={status:'NOT_CONFIGURED',description:'请先配置产品/活性成分检索词，避免混入无关企业'};return}
  const throttle=previous.status==='OK'?23*3600_000:60*60_000;
  if(!force&&previous.fetched_at&&now-new Date(previous.fetched_at).getTime()<throttle)return;
  let added=0,changed=0,received=0,lastUpdated=null;const stamp=iso();
  try{const terms=provider==='FDA_NDC_LABELERS'?this.data.search_terms:[null];
   for(const term of terms){const {payload,url}=await this.fetchOfficial(provider,term);lastUpdated=payload.meta?.last_updated||lastUpdated;received+=payload.results.length;
    for(const raw of payload.results.slice(0,100)){const item=this.normalize(provider,raw,stamp,{sourceUrl:url,term});const state=this.upsert(item);if(state==='added')added++;else if(state==='changed')changed++}
   }
   this.data.sources[provider]={status:'OK',fetched_at:stamp,last_success:stamp,upstream_updated:lastUpdated,upstream_cadence:src.frequency,received,added,changed};this.audit('OFFICIAL_SYNC','scheduled-ingest',{provider,added,changed,received});
  }catch(err){this.data.sources[provider]={...previous,status:'ERROR',fetched_at:stamp,error:clean([err?.message,err?.cause?.code&&['ENOTFOUND','EAI_AGAIN','ECONNRESET','ETIMEDOUT','ECONNREFUSED'].includes(err.cause.code)?err.cause.code:null].filter(Boolean).join(' / ')||err),upstream_cadence:src.frequency};this.audit('OFFICIAL_SYNC_FAILED','scheduled-ingest',{provider,error:clean(err?.message||err)})}
 }
 async checkRobots(url){const u=new URL(url),robots=new URL('/robots.txt',u.origin).toString();let reply;try{reply=await this.fetchBounded(robots,{accept:'text/plain',maxBytes:100_000})}catch(err){if(String(err.message)==='HTTP 404'||String(err.message)==='HTTP 410')return;throw err}
  const lines=reply.body.split(/\r?\n/),target=u.pathname||'/';let current=[],blocked=[];
  for(const raw of lines){const x=raw.split('#')[0].trim();if(/^User-agent:/i.test(x)){const agent=x.slice(x.indexOf(':')+1).trim().toLowerCase();current=[agent];continue}if(/^Disallow:/i.test(x)&&current.includes('*')){const pattern=x.slice(x.indexOf(':')+1).trim();if(pattern&&target.startsWith(pattern))blocked.push(pattern)}}
  if(blocked.length)throw Error('源站 robots.txt 不允许采集该页面');
 }
 async syncCompanySite(site,{force=false}={}){const key='COMPANY:'+site.id,previous=this.data.sources[key]||{},stamp=iso(),age=Date.now()-new Date(previous.fetched_at||0).getTime();
  if(!force&&previous.fetched_at&&age<(previous.status==='OK'?23*3600_000:60*60_000))return;
  try{const url=validateCompanyUrl(site.url,{allowedDomains:this.allowDomains});const host=new URL(url).hostname;await this.checkPublicHost(host);await this.checkRobots(url);
   const headers={};if(previous.etag)headers['If-None-Match']=previous.etag;if(previous.last_modified)headers['If-Modified-Since']=previous.last_modified;
   const response=await this.fetchBounded(url,{accept:'text/html',maxBytes:350_000,headers});
   if(response.status===304){this.data.sources[key]={...previous,status:'OK',fetched_at:stamp,changed:0};return}
   const mime=response.headers?.get?.('content-type')||'text/html';if(!/text\/html/i.test(mime))throw Error('官网不是 HTML 页面');
   const facts=companyPageFacts(response.body);if(!facts.title&&!facts.description&&!facts.excerpt)throw Error('官网没有可抽取的静态页面内容');
   const hash=digest({url,facts}),r={id:`COMPANY_WEBSITE:${site.id}`,type:'company_watch',provider:key,source_url:url,source_info:url,observed_at:stamp,source_updated_at:clean(response.headers?.get?.('last-modified')||''),source_record_id:site.id,company_unverified:site.name,material_unverified:'待物料映射',status_text:'企业官网内容变化（待审核）',reason:clean(facts.description||facts.title),priority:35,review_status:'PENDING',verified_supplier_id:null,verified_site_id:null,verified_material_id:null,approved_for_purchase:false,gmp_approved:false,cep_approved:false,asl_approved:false,source_hash:hash,data_origin:'COMPANY_WEBSITE_UNVERIFIED',evidence_excerpt:clean(facts.excerpt,1100),page_title:facts.title};
   const changed=this.upsert(r);this.data.sources[key]={status:'OK',fetched_at:stamp,last_success:stamp,changed:changed==='changed'?1:0,added:changed==='added'?1:0,etag:response.headers?.get?.('etag')||null,last_modified:response.headers?.get?.('last-modified')||null};this.audit('COMPANY_WEBSITE_SYNC','scheduled-ingest',{id:site.id,url,state:changed});
  }catch(err){this.data.sources[key]={...previous,status:'ERROR',fetched_at:stamp,error:clean(err?.message||err)};this.audit('COMPANY_WEBSITE_SYNC_FAILED','scheduled-ingest',{id:site.id,error:clean(err?.message||err)})}
 }
 async _sync({force=false,providers=Object.keys(SOURCES),include_sites=true}={}){
  for(const p of providers){if(!SOURCES[p])throw Error('Unknown source '+p);await this.syncOfficial(p,{force})}
  if(include_sites)for(const site of this.data.company_sites.filter(x=>x.enabled))await this.syncCompanySite(site,{force});
  this.data.last_run=iso();this.save();return this.getSummary();
 }
 async sync(opts={}){if(this.inflight)return this.inflight;this.inflight=this._sync(opts).finally(()=>{this.inflight=null});return this.inflight}
 review({id,decision,reviewer,notes='',supplier_id=null,site_id=null,material_id=null}={}){
  if(!['ACCEPT_EVIDENCE','REJECT','NEEDS_MORE_INFO'].includes(decision))throw Error('Invalid decision');if(!clean(reviewer))throw Error('Reviewer required');
  const r=this.data.signals.find(x=>x.id===id);if(!r)throw Error('Signal not found');
  if(decision==='ACCEPT_EVIDENCE'&&(!supplier_id||!site_id||!material_id))throw Error('Verified supplier/site/material mapping required');
  r.review_status=decision;r.reviewed_by=clean(reviewer);r.reviewed_at=iso();r.review_notes=clean(notes);
  if(decision!=='ACCEPT_EVIDENCE')for(const pub of this.data.published_leads){if(pub.signal_id===id&&pub.status==='PUBLISHED'){pub.status='REVOKED_ON_REVIEW_CHANGE';pub.revoked_at=iso()}}
  if(decision==='ACCEPT_EVIDENCE'){r.verified_supplier_id=clean(supplier_id);r.verified_site_id=clean(site_id);r.verified_material_id=clean(material_id)}else{r.verified_supplier_id=null;r.verified_site_id=null;r.verified_material_id=null}
  r.approved_for_purchase=false;r.gmp_approved=false;r.cep_approved=false;r.asl_approved=false;
  this.audit('HUMAN_REVIEW',reviewer,{id,decision,mapping:decision==='ACCEPT_EVIDENCE'?[supplier_id,site_id,material_id]:null});this.save();return r;
 }
 publishedCandidates(){return this.data.published_leads.filter(x=>x.status==='PUBLISHED'&&x.qualification_status==='UNVERIFIED').filter(pub=>{const r=this.data.signals.find(s=>s.id===pub.signal_id);return r?.review_status==='ACCEPT_EVIDENCE'&&r.source_hash===pub.source_hash}).map(x=>({...x}));}
 publishLead({id,actor='authorized-admin',action='PUBLISH'}={}){
  if(!['PUBLISH','RETRACT'].includes(action))throw Error('Invalid publication action');
  const r=this.data.signals.find(x=>x.id===id);if(!r)throw Error('Signal does not exist');
  if(action==='RETRACT'){
   const item=this.data.published_leads.find(x=>x.signal_id===id&&x.status==='PUBLISHED');if(!item)throw Error('Published record not found');
   item.status='RETRACTED';item.revoked_at=iso();this.audit('OFFICIAL_LEAD_RETRACTED',actor,{signal_id:id,published_id:item.id});this.save();return {status:'RETRACTED',id:item.id};
  }
  if(r.review_status!=='ACCEPT_EVIDENCE'||!r.reviewed_by||!r.reviewed_at||!r.verified_supplier_id||!r.verified_site_id||!r.verified_material_id)throw Error('Publish requires human ACCEPT_EVIDENCE and all three entity links');
  if(!/^[A-Za-z0-9_-]{2,48}$/.test(r.verified_supplier_id)||!/^[A-Za-z0-9_-]{2,48}$/.test(r.verified_site_id)||!/^[A-Za-z0-9_-]{2,48}$/.test(r.verified_material_id))throw Error('Invalid supplier/site/material identity');
  const old=this.data.published_leads.find(x=>x.signal_id===id&&x.status==='PUBLISHED');if(old&&old.source_hash===r.source_hash)return {...old};
  if(old){old.status='SUPERSEDED';old.revoked_at=iso()}
  const pub={id:'PUB-'+digest({signal:id,hash:r.source_hash}).slice(0,18),signal_id:r.id,source_record_id:r.source_record_id,source_url:r.source_url,source_hash:r.source_hash,company_name:r.company_unverified||'待核实企业名称',supplier_id:r.verified_supplier_id,site_id:r.verified_site_id,material_id:r.verified_material_id,observed_at:r.observed_at,reviewed_at:r.reviewed_at,published_at:iso(),published_by:clean(actor),status:'PUBLISHED',qualification_status:'UNVERIFIED',approved_for_purchase:false,asl_status:'NOT_APPROVED',gmp_status:'UNKNOWN',cep_status:'UNKNOWN'};
  this.data.published_leads.push(pub);this.audit('OFFICIAL_LEAD_PUBLISHED',actor,{id:pub.id,signal_id:id,source_hash:r.source_hash,scope_key:[pub.supplier_id,pub.site_id,pub.material_id].join('|')});this.save();return {...pub};
 }
 verifiedLeads(){return this.data.signals.filter(x=>x.review_status==='ACCEPT_EVIDENCE').map(x=>({supplier_id:x.verified_supplier_id,site_id:x.verified_site_id,material_id:x.verified_material_id,company_name:x.company_unverified,source_url:x.source_url,source_hash:x.source_hash,evidence_reviewed_at:x.reviewed_at,data_class:'OFFICIAL_LEAD_VERIFIED_LINK_ONLY',qualified_for_purchase:false,gmp_status:null,cep_status:null,asl_status:null}))}
 stageERP(rows,{adapter='GENERIC',actor='ERP_IMPORT'}={}){
  const map=ERP_MAP[adapter];if(!map)throw Error('Unknown ERP map');if(!Array.isArray(rows)||rows.length>1000)throw Error('Expected <=1000 ERP rows');
  const normalized=rows.map((row,i)=>{const data=Object.fromEntries(Object.entries(map).map(([k,col])=>[k,row?.[col]??null]));
   if(!data.supplier_id||!data.site_id||!data.material_id)throw Error(`row ${i+1}: supplier/site/material identifiers required`);
   const unitPrice=Number(data.quote_unit_price);if(data.quote_unit_price!=null&&(!Number.isFinite(unitPrice)||unitPrice<0))throw Error(`row ${i+1}: invalid price`);
   if(data.currency&&!/^[A-Z]{3}$/.test(String(data.currency)))throw Error(`row ${i+1}: ISO 4217 currency expected`);
   return {data,id:digest({adapter,data}).slice(0,24)};
  });
  let count=0;for(const {data,id} of normalized){if(this.data.erp_staging.some(x=>x.id===id))continue;this.data.erp_staging.push({id,adapter,record:data,ingested_at:iso(),state:'STAGED_UNREVIEWED',approved_for_purchase:false});count++}
  this.audit('ERP_STAGING',actor,{adapter,accepted:count});this.save();return {staged:count,total:this.data.erp_staging.length,notice:'ERP记录仅暂存，不代表资质或采购批准'};
 }
}
