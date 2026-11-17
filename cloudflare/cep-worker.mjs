/** Optional Cloudflare Worker for server-to-server EDQM CEP public-data fetch.
 * Deploy to YOUR Cloudflare Worker domain and set PHARMA_CEP_PROXY in static/config.js.
 * It does not approve a supplier. External access may be blocked by EDQM; logs show errors.
 */
const EDQM='https://extranet.edqm.eu/4DLink1/4DCGI/EXPORT_WEB_CEP.txt';
const MAX=20*1024*1024;
const cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'content-type', 'x-content-type-options':'nosniff'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 if(url.pathname==='/api/official/status')return json({provider:'EDQM',type:'CEP full public dataset',source:EDQM,available:'not probed',verification:'Procurement evidence only; QA/SQM to review',version:'v1.1'});
 if(url.pathname!=='/api/official/cep-file')return json({error:'Not found'},404);
 try{
  const cache=await caches.open('pharma-cep-public');
  const key=new Request(request.url.split('?')[0],{method:'GET'});
  let cached=await cache.match(key);if(cached)return cached;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),18000);
  let upstream;try{upstream=await fetch(EDQM,{headers:{'accept':'text/plain,text/tab-separated-values,text/csv,*/*','user-agent':'PharmaProcurementDemo/1.1 regulatory evidence lookup'},signal:controller.signal})}finally{clearTimeout(timer)}
  if(!upstream.ok)return json({error:'EDQM upstream HTTP '+upstream.status,source:EDQM},502);
  const length=+(upstream.headers.get('content-length')||0);
  if(length>MAX)return json({error:'EDQM dataset exceeds 20 MB'},502);
  const raw=await upstream.arrayBuffer();if(raw.byteLength>MAX)return json({error:'EDQM dataset exceeds 20 MB'},502);
  const data=new TextDecoder('utf-8').decode(raw);
  if(/<!doctype html|<html/i.test(data.slice(0,400))||!data.includes('CEP'))return json({error:'EDQM returned HTML / unexpected file; no evidence was imported',source:EDQM},502);
  const response=new Response(raw,{status:200,headers:{...cors,'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=900','x-data-source':'EDQM','x-retrieved-at':new Date().toISOString(),'x-upstream-url':EDQM}});
  ctx.waitUntil(cache.put(key,response.clone()));return response;
 }catch(error){return json({error:'Official dataset unavailable: '+String(error.message||error),source:EDQM},503)}
 }};
