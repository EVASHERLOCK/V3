from pathlib import Path
p=Path('server.mjs');s=p.read_text();s=s.replace("import http from 'node:http';","import http from 'node:http';\nimport crypto from 'node:crypto';\nimport {SourcingRegistry,SOURCES,ERP_MAP} from './sourcing_registry.mjs';")
s=s.replace('const ROOT=path.dirname(fileURLToPath(import.meta.url));','''const ROOT=path.dirname(fileURLToPath(import.meta.url));
const sourcingRegistry=new SourcingRegistry();
const secure=(req)=>{const token=process.env.SOURCING_ADMIN_TOKEN;if(!token||token.length<16)return false;const got=(req.headers.authorization||'').replace(/^Bearer\\s+/i,'');if(got.length!==token.length)return false;return crypto.timingSafeEqual(Buffer.from(got),Buffer.from(token))};
async function requestJSON(req,limit=1024*1024){let size=0,chunks=[];for await(const part of req){size+=part.length;if(size>limit)throw Error('JSON exceeds limit');chunks.push(part)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
''')
s=s.replace("if(p==='/api/v08'&&req.method==='GET')", """if(p==='/api/sourcing/registry/schema'&&req.method==='GET')return send(res,200,{sources:SOURCES,erp_maps:ERP_MAP,approval_policy:'manual QA/RA review; evidence ingestion never grants ASL/GMP/CEP',top10_policy:'Top 10 by importance; rest in full view'});
 if(p==='/api/sourcing/registry/public'&&req.method==='GET'){const summary=sourcingRegistry.getSummary();return send(res,200,{last_run:summary.last_run,sources:summary.sources,total_signals:summary.total_signals,pending_review:summary.pending_review,notice:summary.notice})}
 if(p.startsWith('/api/sourcing/registry')&& !secure(req))return reject(res,403,'未授权：需配置服务端 SOURCING_ADMIN_TOKEN（至少16位），并使用 Bearer 令牌。');
 if(p==='/api/sourcing/registry'&&req.method==='GET')return send(res,200,sourcingRegistry.getSummary());
 if(p==='/api/sourcing/registry/all'&&req.method==='GET')return send(res,200,{signals:sourcingRegistry.allSignals(),erp_staging:sourcingRegistry.data.erp_staging,audit:sourcingRegistry.data.audit});
 if(p==='/api/sourcing/registry/sync'&&req.method==='POST')return send(res,200,await sourcingRegistry.sync(await requestJSON(req)));
 if(p==='/api/sourcing/registry/review'&&req.method==='POST')return send(res,200,sourcingRegistry.review(await requestJSON(req)));
 if(p==='/api/sourcing/registry/erp'&&req.method==='POST'){const data=await requestJSON(req);return send(res,200,sourcingRegistry.stageERP(data.rows,{adapter:data.adapter,actor:data.actor}))}
 if(p==='/api/v08'&&req.method==='GET')""",1)
s=s.replace("const server=http.createServer(route);server.listen(PORT,'0.0.0.0',()=>console.log(`Pharma Procurement AI V0.7 · Bolt native Node server running on ${PORT}`));", """const server=http.createServer(route);server.listen(PORT,'0.0.0.0',()=>console.log(`Pharma Procurement AI V2.9.12 Node server running on ${PORT}`));
// Explicit opt-in: a long-running Node host schedules daily retries. Static pages cannot do this.
if(process.env.SOURCING_AUTO_SYNC==='1'){
 const check=()=>sourcingRegistry.sync().then(r=>{if(Object.values(r.sources).some(x=>x.status==='ERROR'))console.error('[Official sync] one or more provider requests failed')}).catch(e=>console.error('[Official sync]',e.message));
 void check();const timer=setInterval(check,24*60*60*1000);timer.unref?.();
}
""")
p.write_text(s)
