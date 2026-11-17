/** V2.9.26 post-deployment REAL enterprise acceptance, no mocks and no DEMO fallback.
 * Usage: ENTERPRISE_VERIFY_URL=https://your-host.example SOURCING_ADMIN_TOKEN=... npm run check:enterprise:live
 * The token is never printed or sent anywhere except the explicitly supplied host.
 */
const base=process.env.ENTERPRISE_VERIFY_URL;
const secret=process.env.SOURCING_ADMIN_TOKEN||'';
if(!base||secret.length<16){console.error('FAIL: need ENTERPRISE_VERIFY_URL and a server-side SOURCING_ADMIN_TOKEN of >=16 characters. Do not commit secrets.');process.exit(2)}
let origin;
try{const u=new URL(base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('bad URL');if(u.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('External servers require HTTPS');origin=u.origin;}
catch(e){console.error('FAIL: ENTERPRISE_VERIFY_URL must be a secure HTTPS origin, or localhost for development:',e.message);process.exit(2)}
const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),18000);
const fetchJSON=async p=>{const r=await fetch(origin+p,{headers:{Authorization:'Bearer '+secret,Accept:'application/json'},redirect:'error',signal:ctl.signal});const t=await r.text();let j;try{j=JSON.parse(t)}catch{throw Error(`${p} is not valid JSON (HTTP ${r.status})`)}if(!r.ok)throw Error(`${p}: HTTP ${r.status}, status=${j.status||j.error||'unknown'}`);return j;};
try{
 const status=await fetchJSON('/api/integrations/enterprise/status');
 const schema=await fetchJSON('/api/enterprise/evidence/schema');
 const rec=await fetchJSON('/api/enterprise/reconciliation');
 const pages=Array.isArray(rec.pages)?rec.pages:[];
 const ids=new Set(pages.map(x=>x.snapshot_id));
 const ok=status.audit_chain_valid===true&&status.released?.snapshot_id&&rec.status==='PASS'&&rec.passed_pages===26&&pages.length===26&&ids.size===1&&ids.has(status.released.snapshot_id)&&schema.version==='2.9.26'&&Array.isArray(schema.domain_names)&&schema.domain_names.length===5;
 console.log(JSON.stringify({acceptance:ok?'PASS':'FAIL',timestamp:new Date().toISOString(),origin,snapshot_id:status.released?.snapshot_id??null,po_count:status.released?.po_count??0,qms_count:status.released?.qms_count??0,domain_counts:status.released?.domain_counts||{},audit_chain_valid:status.audit_chain_valid,page_count:pages.length,passed_pages:rec.passed_pages,one_snapshot:ids.size===1,domain_schema_version:schema.version,missing_domain_by_page:pages.filter(x=>x.missing_domains?.length).map(x=>({route:x.route,missing:x.missing_domains}))},null,2));
 if(!ok)process.exitCode=1;
}catch(e){console.error(JSON.stringify({acceptance:'FAIL',origin,error:String(e.message||e)},null,2));process.exitCode=1;}
finally{clearTimeout(timer)}
