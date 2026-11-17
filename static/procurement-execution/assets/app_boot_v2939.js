/* V2.9.39: wait for optional remote read-only source before executing original app.js.
 * When backend cannot be reached, keep the bundled DEMO snapshot and label it.
 * Never synthesize transactional records and never attach admin tokens. */
(async()=>{'use strict';
 const parentAPI=window.parent!==window?window.parent.PHARMA_API_ORIGIN:window.PHARMA_API_ORIGIN;
 const remote=typeof parentAPI==='string'&&/^https:\/\//.test(parentAPI)?parentAPI:'';
 if(remote){
  let ok=false;
  try{await Promise.race([new Promise(resolve=>{
   const s=document.createElement('script');s.src=remote+'/api/procurement-execution/site-data.js';
   s.onload=()=>{ok=true;resolve()};s.onerror=resolve;document.head.appendChild(s);
  }),new Promise(r=>setTimeout(r,8500))]);}catch{}
  if(!ok)console.warn('[Pharma V2939] Node read model unreachable; keeping explicit static DEMO snapshot.');
 }
 const s=document.createElement('script');s.src='assets/app.js';s.onerror=()=>{document.getElementById('app').innerHTML='<p role="alert">采购执行业务脚本未加载；请检查发布目录和浏览器网络请求。</p>';};document.body.append(s);
})();
