/* V2.9.11: shared in-memory source model. Cached only in the active page; refresh invalidates. */
(()=>{'use strict';let snapshot=null,inflight=null,readCount=0;const load=async()=>{
 if(snapshot)return snapshot;
 if(inflight)return inflight;
 inflight=(async()=>{const r=await fetch('/api/v08');if(!r.ok)throw Error('API '+r.status);const raw=await r.json();snapshot=raw;window.PharmaSourcingUniverse?.hydrate?.(raw);readCount++;
 // Fetch published data from Node as a separate read-only channel. An offline
 // official service must never prevent the whole procurement dashboard loading.
 try{if(!/^https?:$/.test(String(location.protocol||'')))return raw;const pub=await fetch('/api/sourcing/registry/public/published',{cache:'no-store'});if(pub.ok){const info=await pub.json();window.PharmaSourcingUniverse?.ingestPublished?.(info.items||[]);}}catch(e){console.warn('已发布官方线索暂不可用；继续仅展示来源明确的内置演示数据',e?.message||e)}
 return raw;})();
 try{return await inflight}finally{inflight=null}
};
window.PharmaSourcingData={load,peek:()=>snapshot,prime:raw=>{if(raw&&raw.master){snapshot=raw;window.PharmaSourcingUniverse?.hydrate?.(raw)}},invalidate:()=>{snapshot=null;inflight=null},stats:()=>({hasCache:!!snapshot,inflight:!!inflight,readCount})};
})();
