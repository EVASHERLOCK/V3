/* V2.9.39: Bolt preview / static hosting parity.
 * Put the externally hosted Node API origin in the HTML meta tag; never put a token here.
 * Without a remote API, browser fallback supplies explicitly labelled DEMO read-only reports.
 */
(()=>{const originFetch=window.fetch.bind(window);window.__PHARMA_NATIVE_FETCH=originFetch;
 const raw=document.querySelector('meta[name="pharma-api-origin"]')?.content?.trim()||'';
 let remote='';try{if(raw){const x=new URL(raw);if(x.protocol==='https:'||x.hostname==='localhost')remote=x.origin}}catch{}
 window.PHARMA_API_ORIGIN=remote;
 const engine=(url,init)=>import('/engine/browser_api.mjs').then(m=>m.handleApi(url,init||{},originFetch)).catch(e=>new Response(JSON.stringify({detail:'本地DEMO分析备用引擎不可用: '+String(e.message||e)}),{status:503,headers:{'content-type':'application/json'}}));
 window.fetch=(input,init)=>{const value=typeof input==='string'?input:input?.url;if(!value)return originFetch(input,init);
  const url=new URL(value,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return originFetch(input,init);
  if(remote){const target=remote+url.pathname+url.search;return originFetch(target,init);}
  const exclude=['/api/compliance/','/api/sourcing/registry','/api/formulas/','/api/metrics/','/api/enterprise/','/api/integrations/enterprise/','/api/analysis/','/api/sourcing/contract'];
  if(url.pathname.startsWith('/api/formulas/')||exclude.some(p=>url.pathname.startsWith(p)))return originFetch(input,init);
  return originFetch(input,init).then(r=>{const type=r.headers.get('content-type')||'';
   if(r.ok&&(type.includes('application/json')||type.includes('application/vnd.openxmlformats')))return r;
   return engine(url,init);
  },()=>engine(url,init));
 };
 // Static-host links to API binary reports cannot be intercepted by fetch.
 // Move them to a configured real Node host when one is available.
 document.addEventListener('click',e=>{if(!remote)return;const a=e.target.closest('a[href]');if(!a)return;
  const h=a.getAttribute('href')||'';if(!h.startsWith('/api/'))return;a.href=remote+h;
 },true);
})();
