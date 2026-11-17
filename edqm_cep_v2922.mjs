/** EDQM CEP bulk dataset adapter (V2.9.22).
 * Accepts a TXT/CSV/TSV exported by an authorized user from the EDQM public
 * certificate database. No website scraping or unverified background fetch.
 * A data-file import is NOT a GMP/CEP holder/site/market approval in this app.
 * Reference: https://extranet.edqm.eu/publications/recherches_CEP.shtml
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const EDQM_SOURCE='https://extranet.edqm.eu/publications/recherches_CEP.shtml';
// Verified Download CEP data file link on the official public search page.
export const EDQM_DOWNLOAD_URL='https://extranet.edqm.eu/4DLink1/4DCGI/EXPORT_WEB_CEP.txt';
const sha256=v=>crypto.createHash('sha256').update(v).digest('hex');
const maxEntries=120000;
const clean=(x,n=240)=>String(x??'').trim().slice(0,n);
const aliases={
 cep_number:['cep number','cep no','cep reference','reference number','certificate number','cep','cep number latest'],
 holder:['holder name','cep holder','holder','certificate holder','holder/organisation','organisation name','organization name'],
 substance:['substance name','substance','name of substance','monograph name','substance/monograph name'],
 status:['status','status of cep','cep status','certificate status','status of certificate'],
 monograph:['monograph number','ph eur monograph number','ph eur monograph','monograph no','monograph'],
 issue_date:['issue date of cep','issue date','certificate issue date','date of issue'],
 renewal_date:['renewal due date','renewal date'],
 end_date:['end date of cep','end date','expiration date'],
 spor_org:['spor org id','spor org-id','org id'],
 spor_loc:['spor loc id','spor loc-id','loc id']
};
const normalizeKey=v=>String(v??'').replace(/^\uFEFF/,'').toLowerCase().replace(/[_\t/\-().:]+/g,' ').replace(/\s+/g,' ').trim();
function splitCSVLine(line,separator){let out=[],item='',quoted=false;for(let i=0;i<line.length;i++){
 const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){item+='"';i++}else quoted=!quoted}
 else if(c===separator&&!quoted){out.push(item.trim());item=''}else item+=c;
}if(quoted)throw Error('EDQM 文本行引号不完整');out.push(item.trim());return out}
function sepGuess(s){let scored=['\t',';','|',','].map(sep=>({sep,n:splitCSVLine(s,sep).length}));return scored.sort((a,b)=>b.n-a.n)[0].sep}
export function parseCepExport(text){
 if(typeof text!=='string'||!text.trim())throw Error('CEP 文件不能为空');
 const lines=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n').filter(x=>x.trim());
 if(lines.length<2)throw Error('CEP 文件没有可读取的数据行');
 const candidateHeaders=lines.slice(0,20);let headerIndex=-1,separator='\t',headers=null,keys=null;
 for(let i=0;i<candidateHeaders.length;i++){
  const sep=sepGuess(candidateHeaders[i]);const names=splitCSVLine(candidateHeaders[i],sep).map(normalizeKey);
  const mapping=Object.fromEntries(Object.entries(aliases).map(([field,synonyms])=>[field,names.findIndex(n=>synonyms.includes(n))]));
  if(['cep_number','holder','status','substance'].every(k=>mapping[k]>=0)){headerIndex=i;separator=sep;headers=names;keys=mapping;break}
 }
 if(headerIndex<0)throw Error('CEP 文件表头不匹配：必须含 CEP number / Holder name / Status / Substance name；请检查 EDQM 导出版本');
 const results=[],existing=new Set();let duplicates=0,invalid=0;
 for(let i=headerIndex+1;i<lines.length;i++){
  if(results.length>=maxEntries)throw Error('CEP 文件超过 120000 行上限');
  const cols=splitCSVLine(lines[i],separator);
  const pick=k=>keys[k]>=0?clean(cols[keys[k]],200):'';
  const cep_number=pick('cep_number'), holder=pick('holder'),status=pick('status'),substance=pick('substance');
  if(!cep_number||!holder||!status||!substance){invalid++;continue}
  if(!/\bCEP\b/i.test(cep_number)){invalid++;continue}
  const dedupe=cep_number.toUpperCase().replace(/\s+/g,' ').trim();if(existing.has(dedupe)){duplicates++;continue}existing.add(dedupe);
  results.push({cep_number,holder,substance,status,monograph:pick('monograph'),issue_date:pick('issue_date'),renewal_date:pick('renewal_date'),end_date:pick('end_date'),spor_org:pick('spor_org'),spor_loc:pick('spor_loc')});
 }
 if(!results.length)throw Error('CEP 文件中未找到有效证书行');
 return {records:results,headers,separator,invalid,duplicates,source:EDQM_SOURCE};
}
export class EdqmCatalog{
 constructor({file=process.env.SOURCING_EDQM_PATH||'.runtime/edqm_cep_catalog.json'}={}){this.file=file;this.data=this.read()}
 read(){try{const x=JSON.parse(fs.readFileSync(this.file,'utf8'));return x&&Array.isArray(x.records)?x:null}catch{return null}}
 summary(){return {source:EDQM_SOURCE,imported:this.data!==null,record_count:this.data?.records.length||0,last_import_at:this.data?.imported_at||null,file_sha256:this.data?.file_sha256||null,latest_changes:this.data?.changes||null,source_class:this.data?.origin_label||'NO_UPSTREAM_DATA',notice:'由管理员导入 EDQM 公共数据库导出文件。导入本身不能证明文件真实性，也不能使供应商获得 GMP/CEP/ASL/采购准入；需要对照官网及持证人/厂址/物料人工核验。'}}
 importText(text,{actor='authorized-admin',filename='CEP_export.txt',origin='ADMIN_UPLOADED_EXPORT_NEEDS_SOURCE_CONFIRMATION'}={}){
  if(Buffer.byteLength(text,'utf8')>30*1024*1024)throw Error('CEP 导出文件不能超过30MB');
  const parsed=parseCepExport(text),old=new Map((this.data?.records||[]).map(x=>[x.cep_number.toUpperCase(),x]));
  const changes={added:0,changed:0,removed:0,status_changed:0};const next=new Set();const statusChanges=[];
  for(const r of parsed.records){const k=r.cep_number.toUpperCase();next.add(k);const prev=old.get(k);if(!prev){changes.added++;continue}
   if(JSON.stringify(prev)!==JSON.stringify(r)){changes.changed++;if(prev.status!==r.status){changes.status_changed++;if(statusChanges.length<100)statusChanges.push({cep_number:r.cep_number,holder:r.holder,from:prev.status,to:r.status})}}
  }
  for(const k of old.keys())if(!next.has(k))changes.removed++;
  const val={schema_version:'v2922',source_url:EDQM_SOURCE,origin_label:origin,filename:clean(filename,150),imported_at:new Date().toISOString(),actor:clean(actor,80),file_sha256:sha256(text),headers:parsed.headers,invalid:parsed.invalid,duplicates:parsed.duplicates,records:parsed.records,changes,status_changes:statusChanges};
  fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify(val),{mode:0o600});fs.renameSync(tmp,this.file);this.data=val;
  return {...this.summary(),duplicates:parsed.duplicates,invalid:parsed.invalid,status_changes:statusChanges};
 }
 /** One bounded GET to the EDQM public export, not a crawler. Uses exactly the
  * published .TXT endpoint, without following redirects or providing cookies.
  * The source is checked at most once per 23h unless an admin forces a retry.
  * On network/format failure the previous verified import snapshot remains.
  */
 async syncOfficial({fetchImpl=globalThis.fetch,force=false}={}){
  if(!force&&this.data?.origin_label==='HTTPS_EDQM_OFFICIAL_EXPORT'&&this.data.imported_at&&Date.now()-new Date(this.data.imported_at).getTime()<23*3600_000)return {...this.summary(),skipped:true,reason:'less_than_23h_since_import'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
   const res=await fetchImpl(EDQM_DOWNLOAD_URL,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'text/plain,text/tab-separated-values,application/download;q=0.9'}});
   if(!res.ok||res.status>=300&&res.status<400)throw Error('EDQM 下载失败 HTTP '+res.status+'；保留上次成功数据');
   const advertised=Number(res.headers?.get?.('content-length')||0);if(advertised>30*1024*1024)throw Error('EDQM 数据文件超出 30MB');
   const chunks=[];let bytes=0;
   if(!res.body){const b=Buffer.from(await res.arrayBuffer());bytes=b.length;chunks.push(b)}
   else for await(const part of res.body){const b=Buffer.from(part);bytes+=b.length;if(bytes>30*1024*1024)throw Error('EDQM 数据文件超出 30MB');chunks.push(b)}
   if(bytes===0||bytes>30*1024*1024)throw Error('EDQM 数据文件大小无效');
   const data=Buffer.concat(chunks);let decoded=data.toString('utf8');
   // The public TXT may be delivered in a legacy Western European encoding.
   if(decoded.includes('�'))decoded=new TextDecoder('windows-1252').decode(data);
   const result=this.importText(decoded,{actor:'edqm-official-scheduled-fetch',filename:'EXPORT_WEB_CEP.txt',origin:'HTTPS_EDQM_OFFICIAL_EXPORT'});
   return {...result,download_url:EDQM_DOWNLOAD_URL,transport_verified:'HTTPS_OFFICIAL_HOST_ONLY',skipped:false};
  }finally{clearTimeout(timer)}
 }
 search(q='',{offset=0,limit=10}={}){
  const query=clean(q,150).toLowerCase();offset=Math.max(0,Math.min(100000,Number(offset)||0));limit=Math.max(1,Math.min(100,Number(limit)||10));
  const rows=(this.data?.records||[]).filter(x=>!query||[x.cep_number,x.holder,x.substance,x.status,x.monograph].some(v=>String(v||'').toLowerCase().includes(query)));
  return {total:rows.length,offset,limit,items:rows.slice(offset,offset+limit),source_url:EDQM_SOURCE,imported_at:this.data?.imported_at||null,notice:'CEP 导入记录仅供官方信息核对。未独立验证来源、厂址、物料/上市市场及内部 ASL 准入。'};
 }
 get(cep){return (this.data?.records||[]).find(x=>x.cep_number.toUpperCase()===String(cep||'').toUpperCase())||null}
}
