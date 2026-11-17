/** V2.9.23: private ERP/QMS ingest, staged/released snapshots and evidence.
 * A downloaded JSON snapshot is never presented as GxP-approved and cannot
 * grant supplier qualification or order permissions. No synthetic amounts.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import {isIP} from 'node:net';
import {mapEnterpriseDomains,domainsForScope,emptyEnterpriseDomains} from './enterprise_evidence_v2926.mjs';
const iso=()=>new Date().toISOString();
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const nonEmpty=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.length>120)throw Error(`${label} invalid`);return value.trim()};
const num=(x,label,{positive=false,zero=true}={})=>{if(x===null||x===undefined||x==='')throw Error(`${label} missing`);const v=Number(x);if(!Number.isFinite(v)||(positive?v<=0:v<0)||(!zero&&v===0))throw Error(`${label} invalid`);return v};
const date=(x,label)=>{const s=nonEmpty(x,label);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z')))throw Error(`${label} must be YYYY-MM-DD`);return s};
const id=(x,k)=>{const s=nonEmpty(String(x??''),k);if(!/^[A-Za-z0-9_.:/-]{1,120}$/.test(s))throw Error(`${k} invalid characters`);return s};
function mapPO(x,i){const r={id:id(x.po_id??x.PO_ID,'po_id'),supplier_id:id(x.supplier_id??x.LIFNR,'supplier_id'),site_id:id(x.site_id??x.WERKS,'site_id'),material_id:id(x.material_id??x.MATNR,'material_id'),created_date:date(x.created_date??x.BEDAT,'created_date'),qty:num(x.ordered_qty??x.MENGE,'qty',{positive:true}),received:x.received_qty==null?null:num(x.received_qty,'received_qty'),amount_usd:null,price_usd:null,baseline_usd:null,delay_days:null};
 const currency=String(x.currency??x.WAERS??'').toUpperCase();if(!currency)throw Error(`row ${i+1}: currency is mandatory`);if(currency!=='USD')throw Error(`row ${i+1}: currency ${currency} requires explicit auditable FX normalization upstream`);
 r.amount_usd=num(x.amount_usd??x.amount,'amount_usd');r.price_usd=num(x.unit_price_usd??x.unit_price??(r.amount_usd/r.qty),'unit_price');
 if(Math.abs(r.amount_usd-r.price_usd*r.qty)>Math.max(.02,r.amount_usd*.001))throw Error(`row ${i+1}: amount != quantity * unit price`);
 if(x.benchmark_price_usd!=null||x.benchmark_price!=null)r.baseline_usd=num(x.benchmark_price_usd??x.benchmark_price,'benchmark');
 if(x.delay_days!==null&&x.delay_days!==undefined&&x.delay_days!==''){const delay=Number(x.delay_days);if(!Number.isFinite(delay)||delay< -365||delay>3650)throw Error(`row ${i+1}: delay invalid`);r.delay_days=delay}
 if(x.due_date&&x.received_date){r.due_date=date(x.due_date,'due_date');r.received_date=date(x.received_date,'received_date');const d=Math.round((Date.parse(r.received_date)-Date.parse(r.due_date))/86400000);if(r.delay_days!==null&&r.delay_days!==d)throw Error(`row ${i+1}: delay and dates disagree`);r.delay_days=d}
 return {...r,source:'ERP_API_RELEASED_NON_GXP',source_row:`ERP.purchase_orders[${i}]`,scope_key:`${r.supplier_id}|${r.site_id}|${r.material_id}`,currency:'USD'};
}
function mapQMS(x,i){const kind=String(x.record_type??x.kind??'').toUpperCase();if(!['DEVIATION','CAPA','AUDIT_FINDING'].includes(kind))throw Error(`QMS row ${i+1}: invalid record_type`);
 const status=String(x.status??'').toUpperCase();if(!['OPEN','IN_PROGRESS','CLOSED','REJECTED','PENDING_VERIFICATION'].includes(status))throw Error(`QMS row ${i+1}: invalid status`);
 const risk=String(x.severity??'UNKNOWN').toUpperCase();if(!['CRITICAL','MAJOR','MINOR','UNKNOWN'].includes(risk))throw Error(`QMS row ${i+1}: invalid severity`);
 return {id:id(x.event_id??x.id,'event_id'),kind,status,severity:risk,supplier_id:id(x.supplier_id,'supplier_id'),site_id:id(x.site_id,'site_id'),material_id:id(x.material_id,'material_id'),opened_at:date(x.opened_at,'opened_at'),due_date:x.due_date?date(x.due_date,'due_date'):null,closed_at:x.closed_at?date(x.closed_at,'closed_at'):null,description:String(x.description||'').slice(0,500),source:'QMS_API_RELEASED_NON_GXP',source_row:`QMS.events[${i}]`};
}
const RFC1918=/^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.0\.0\.|198\.18\.)/;
const safeHost=x=>!isIP(x)&&x!=='localhost'&&x.includes('.')&&x.length<=253;
export async function secureEndpoint(raw,{allowHosts=process.env.ENTERPRISE_ALLOWED_HOSTS||'',dnsLookup=async host=>dns.lookup(host,{all:true})}={}){
 const url=new URL(String(raw||'').trim());if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash||url.search||!safeHost(url.hostname))throw Error('Enterprise endpoint requires public HTTPS host');
 const approved=allowHosts.split(',').map(x=>x.toLowerCase().trim()).filter(Boolean);
 if(!approved.includes(url.hostname.toLowerCase()))throw Error('Enterprise endpoint is not in ENTERPRISE_ALLOWED_HOSTS');
 const answers=await dnsLookup(url.hostname);if(!answers?.length||answers.some(x=>RFC1918.test(x.address)||x.address.includes(':')||isIP(x.address)!==4))throw Error('Endpoint resolves to a private/unapproved address');
 return url.toString();
}
export class EnterpriseConnectorStore{
 constructor({file=process.env.ENTERPRISE_CONNECTOR_PATH||'.runtime/enterprise_sources_v2923.json',fetchImpl=globalThis.fetch,lookup}={}){this.file=path.resolve(file);this.fetch=fetchImpl;this.lookup=lookup;this.data=this.read()}
 read(){try{const d=JSON.parse(fs.readFileSync(this.file,'utf8'));return {...{schema_version:1,staged:null,released:null,history:[]},...d}}catch{return {schema_version:1,staged:null,released:null,history:[]}}}
 save(){fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});const p=this.file+'.tmp-'+crypto.randomBytes(4).toString('hex');fs.writeFileSync(p,JSON.stringify(this.data,null,2),{mode:0o600});fs.renameSync(p,this.file)}
 audit(action,snapshot_id,details={}){const at=iso(),previous_hash=this.data.history.at(-1)?.entry_hash||'GENESIS',entry={at,action,snapshot_id,previous_hash,details};this.data.history.push({...entry,entry_hash:sha(entry)});}
 verifyAudit(){let previous='GENESIS';for(const e of this.data.history){const {entry_hash,...row}=e;if(row.previous_hash!==previous||sha(row)!==entry_hash)return false;previous=entry_hash;}return true}
 verifyRelease(){const r=this.data.released;if(!r)return false;return this.verifyAudit()&&sha(r.domains?{po:r.po,qms:r.qms,domains:r.domains}:{po:r.po,qms:r.qms})===r.sha256}
 summary(){const scrub=s=>s?{snapshot_id:s.snapshot_id,origin:s.origin,created_at:s.created_at,released_at:s.released_at||null,po_count:s.po.length,qms_count:s.qms.length,domain_counts:Object.fromEntries(Object.entries(s.domains||{}).map(([k,v])=>[k,v.length])),sha256:s.sha256,status:s.status}:null;return {configured:{erp:!!process.env.ERP_PO_API_URL,qms:!!process.env.QMS_EVENTS_API_URL,evidence:!!process.env.ENTERPRISE_EVIDENCE_API_URL,allowed_hosts:!!process.env.ENTERPRISE_ALLOWED_HOSTS},staged:scrub(this.data.staged),released:scrub(this.data.released),audit_chain_valid:this.verifyAudit(),history:this.data.history.slice(-10).map(x=>({at:x.at,action:x.action,snapshot_id:x.snapshot_id}))}}
 stage({po=[],qms=[],domains={},origin='MANUAL_CONTROLLED_UPLOAD'}={}){
  if(!Array.isArray(po)||!Array.isArray(qms)||po.length>10000||qms.length>20000)throw Error('Missing rows or limit exceeded');
  const extra=mapEnterpriseDomains(domains);const hasDomains=Object.values(extra).some(x=>x.length);
  if(!po.length&&!qms.length&&!hasDomains)throw Error('Missing rows or limit exceeded');
  const mappedPO=po.map(mapPO),mappedQMS=qms.map(mapQMS);
  const sourceLabel=origin==='CONFIGURED_HTTPS_ENTERPRISE_API'?'ERP_API_INGESTED_NON_GXP':'ADMIN_IMPORT_NON_GXP';
  for(const r of mappedPO)r.source=sourceLabel;
  for(const r of mappedQMS)r.source=origin==='CONFIGURED_HTTPS_ENTERPRISE_API'?'QMS_API_INGESTED_NON_GXP':'ADMIN_IMPORT_NON_GXP';
  for(const [type,rows] of [['PO',mappedPO],['QMS',mappedQMS]]){const ids=new Set();for(const r of rows){if(ids.has(r.id))throw Error(`Duplicate ${type} identifier: ${r.id}`);ids.add(r.id)}}
  const created_at=iso(),digest=sha(hasDomains?{po:mappedPO,qms:mappedQMS,domains:extra}:{po:mappedPO,qms:mappedQMS});const snapshot_id='INT-'+digest.slice(0,20);
  this.data.staged={snapshot_id,origin:origin.slice(0,90),created_at,sha256:digest,po:mappedPO,qms:mappedQMS,...(hasDomains?{domains:extra}:{}),status:'STAGED_NOT_APPROVED_FOR_ANALYTICS'};
  this.audit('STAGED',snapshot_id,{origin,count_po:mappedPO.length,count_qms:mappedQMS.length,domain_counts:Object.fromEntries(Object.entries(extra).map(([k,v])=>[k,v.length]))});this.save();return this.summary();
 }
 async pull(){const get=async(url,tokenName)=>{if(!url)return [];const safe=await secureEndpoint(url,{dnsLookup:this.lookup});const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);try{const res=await this.fetch(safe,{headers:{Accept:'application/json',...(process.env[tokenName]?{Authorization:'Bearer '+process.env[tokenName]}:{})},redirect:'manual',signal:abort.signal});if(!res.ok||res.status>=300)throw Error(`Enterprise API HTTP ${res.status}`);const length=Number(res.headers?.get?.('content-length')||0);if(length>5_000_000)throw Error('Enterprise response size limit exceeded');const raw=await res.text();if(Buffer.byteLength(raw)>5_000_000)throw Error('Enterprise response size limit exceeded');const data=JSON.parse(raw);const rows=Array.isArray(data)?data:data.value??data.results??data.items;if(!Array.isArray(rows))throw Error('Enterprise API must return JSON array');return rows}finally{clearTimeout(timer)}};
  const po=await get(process.env.ERP_PO_API_URL,'ERP_API_TOKEN');const qms=await get(process.env.QMS_EVENTS_API_URL,'QMS_API_TOKEN');
  let domains={};if(process.env.ENTERPRISE_EVIDENCE_API_URL){const url=await secureEndpoint(process.env.ENTERPRISE_EVIDENCE_API_URL,{dnsLookup:this.lookup});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{const response=await this.fetch(url,{headers:{Accept:'application/json',...(process.env.ENTERPRISE_EVIDENCE_API_TOKEN?{Authorization:'Bearer '+process.env.ENTERPRISE_EVIDENCE_API_TOKEN}:{})},redirect:'manual',signal:controller.signal});if(!response.ok||response.status>=300)throw Error('Evidence API HTTP '+response.status);const text=await response.text();if(Buffer.byteLength(text)>5_000_000)throw Error('Evidence API response too large');const json=JSON.parse(text);domains=json.domains??json;}finally{clearTimeout(timer)}}
  return this.stage({po,qms,domains,origin:'CONFIGURED_HTTPS_ENTERPRISE_API'});
 }
 release({snapshot_id,reviewer,reason}={}){if(!this.data.staged||this.data.staged.snapshot_id!==snapshot_id)throw Error('Staged snapshot not found');if(!reviewer||!reason||String(reason).trim().length<8)throw Error('Review actor and release justification are required');const copy={...this.data.staged,status:'RELEASED_FOR_ANALYTICS_NON_GXP',released_at:iso(),reviewed_by:String(reviewer).slice(0,120),review_reason:String(reason).slice(0,500)};this.data.released=copy;this.data.staged=null;this.audit('RELEASED',snapshot_id,{reviewer:String(reviewer).slice(0,120),reason:String(reason).slice(0,500)});this.save();return this.summary()}
 revoke({reviewer,reason}={}){if(!this.data.released)throw Error('No active released snapshot');const s=this.data.released.snapshot_id;this.data.released=null;this.audit('REVOKED',s,{reviewer:String(reviewer||''),reason:String(reason||'')});this.save();return this.summary()}
 facts(scope={}){const s=this.data.released;if(!s)return null;const allowed=r=>(!scope.material||scope.material==='all'||r.material_id===scope.material)&&(!scope.supplier||scope.supplier==='all'||r.supplier_id===scope.supplier)&&(!scope.year||scope.year==='all'||String(r.created_date||r.opened_at||'').startsWith(scope.year));const po=s.po.filter(allowed),qms=s.qms.filter(allowed),domains=domainsForScope(s,scope);const sup=[...new Set(s.po.map(x=>x.supplier_id).concat(s.qms.map(x=>x.supplier_id)))];const catalogue=sup.map(supplier_id=>({supplier_id,supplier_name:supplier_id,source_class:'ERP_QMS_RELEASED_NON_GXP',is_scenario:false,qualified_for_purchase:false}));return {scope:{...scope,source_boundary:s.origin==='CONFIGURED_HTTPS_ENTERPRISE_API'?'ENTERPRISE_API_RELEASED_NON_GXP':'ADMIN_IMPORTED_RELEASED_NON_GXP',source_release:s.released_at,snapshot_id:s.snapshot_id,sha256:s.sha256},purchaseOrders:po,rawPurchaseOrders:s.po,quotes:[],rawQuotes:[],qualifications:[],rawQualifications:[],documents:[],catalog:catalogue,allCatalog:catalogue,supplierMaster:catalogue,materials:[],sites:[],published:[],qmsEvents:qms,enterprise_domains:domains,raw_enterprise_domains:s.domains||emptyEnterpriseDomains(),has_erp_input:s.po.length>0,has_qms_input:s.qms.length>0};}
}
