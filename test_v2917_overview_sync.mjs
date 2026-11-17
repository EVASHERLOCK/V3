import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {SourcingRegistry} from './sourcing_registry.mjs';
const raw=enterpriseAnalysis({});
const ctx={window:{},document:{addEventListener(){}},sessionStorage:{getItem:()=>null,setItem:()=>{}},Date,Math,Number,Set,Map,Intl,console};
vm.createContext(ctx);
for(const f of ['static/strategic_sourcing_universe.js','static/strategic_sourcing_overview.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f,timeout:5000});
const hub=ctx.window.PharmaStrategicHub;
hub.hydrate(raw);
const all=hub.model();
assert.equal(all.candidateCount,80,'must show full shared 80-candidate universe');
assert.equal(all.evidenceSupplierCount,3,'only 3 original demo sources have business records');
assert.equal(all.businessQualifiedCount,2,'only 2 original demo qualifying links; never fake 80 approvals');
assert.equal(all.supplierMatrix.length,80);
assert.equal(all.supplierMatrix.filter(x=>x.qualified).length,2);
assert.equal(all.allCandidates.filter(x=>x.is_scenario).length,77);
assert(all.supplierMatrix.filter(x=>x.scenario).every(x=>!x.qualified),'unverified scenario cannot pass Site/Material');
assert(all.kraljicRows.length>=7,'category scatter must not contain just two PO materials');
assert.equal(all.projectFunnel[0].count,80);
assert(all.scenarioCycleDays>0,'cycle must be scenario-labelled not an invented source KPI');
const html=hub.render();
for(const phrase of ['官方供应商发现与同步状态','共享寻源候选供应商数','80','Site × Material 资格状态','商业得分（50–100）','展开其余 70 家供应商','供应链风险预警矩阵','情景风险优先级 Top 10'])assert(html.includes(phrase),`missing ${phrase}`);
assert((html.match(/role="button" tabindex="0" data-ss2-detail="supplier:/g)||[]).length===10,'matrix must render only ten points');
assert(html.includes('ss2-matrix-plot')&&html.includes('ss2-rank-table')&&html.includes('ss2-expand'));
assert.equal((html.match(/class="ss2-funnel-row"/g)||[]).length,5);
for(const filter of [{mode:'npi'},{mode:'stock'},{category:'API'},{region:'Europe'},{compliance:'qualified'}]){
  const m=hub.build(raw,filter);assert(m.candidateCount>0,'non-empty candidate layer for '+JSON.stringify(filter));assert(m.supplierMatrix.length>0);
}
const npi=hub.build(raw,{mode:'npi'});assert(npi.supplierMatrix.every(x=>!x.qualified),'must not claim original approved supplier is NPI-qualified');
// Durable admin enablement and provenance without touching network.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pharma-v2917-'));
try{
 const opts={file:path.join(dir,'official.json'),fetchImpl:async()=>{throw Error('no network expected')}};
 const reg=new SourcingRegistry(opts);
 assert.equal(reg.getConfig().auto_sync_enabled,process.env.SOURCING_AUTO_SYNC==='1');
 assert.equal(reg.setAutoSync(true,{actor:'test-admin'}).auto_sync_enabled,true);
 assert.equal(new SourcingRegistry(opts).getConfig().auto_sync_enabled,true,'saved enablement survives restart');
 assert.equal(reg.setAutoSync(false,{actor:'test-admin'}).auto_sync_enabled,process.env.SOURCING_AUTO_SYNC==='1');
 assert(reg.data.audit.some(x=>x.action==='AUTO_SYNC_CONFIG_CHANGED'));
}finally{fs.rmSync(dir,{recursive:true,force:true})}
const server=fs.readFileSync('server.mjs','utf8');const client=fs.readFileSync('static/sourcing_admin_ui.js','utf8');
assert(server.includes("'/api/sourcing/registry/public/discovery'"));
assert(server.indexOf("'/api/sourcing/registry/public/discovery'")<server.indexOf("p.startsWith('/api/sourcing/registry')"));
assert(server.includes("'/api/sourcing/registry/config/autosync'"));
assert(client.includes("button('切换每日自动采集','toggle-auto')"));
console.log('PASS V2.9.17 overview: 80 source-labelled candidates, 2 demo qualified, full fixed-axis scatter, Top10/rest, non-blank filters, source status, persistent admin auto-sync toggle');
