/** 585 current tangible component audit slots; reject missing and fabricated pass.
 * ALSO checks the actual UI definition instead of trusting self-declared JSON. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const path='docs/V2948_逐实际控件验收清单.json';
const prior=fs.readFileSync(path,'utf8');
const generate=spawnSync(process.execPath,['scripts/generate_v2948_component_inventory.mjs'],{encoding:'utf8'});
if(generate.status!==0)throw Error('Inventory generator failed: '+generate.stderr);
const actual=fs.readFileSync(path,'utf8');
if(actual!==prior){fs.writeFileSync(path,prior);throw Error('实际 UI 定义与验收清单不一致：先更新清单并核对新增组件，禁止自动静默放行');}
const list=JSON.parse(actual),critical=list.evidence_fields;
const seen=new Set(),pending=[];
for(const x of list.components){
 assert.ok(x.id&&x.route&&x.title&&x.kind);
 assert.ok(!seen.has(x.id),'重复验收ID '+x.id);seen.add(x.id);
 assert.ok(['PASS','PENDING','BLOCKED'].includes(x.status));
 const gaps=critical.filter(k=>!x.evidence?.[k]?.verified);
 if(x.status==='PASS'){
  assert.equal(gaps.length,0,`禁止假通过 ${x.id}: ${gaps.join(',')}`);
  for(const k of critical){const ref=x.evidence[k]?.artifact;assert.ok(typeof ref==='string'&&ref.length>3&&fs.existsSync(ref),`证据缺失 ${x.id}/${k}`);}
 }else pending.push({id:x.id,route:x.route,gaps});
}
assert.equal(seen.size,585,'实际组件数与基线不同，先检查 UI 扫描结果');
const summary={version:'2.9.48',registered:list.components.length,legacy:217,iframe:368,verified:list.components.length-pending.length,pending:pending.length,status:pending.length?'BLOCKED':'EVIDENCE_REVIEW_REQUIRED',browser_e2e_verified:0,enterprise_db_coverage_verified:false,note:'只有全部12项具有独立证据，且真实企业数据/浏览器环境业务Owner复核，才可提交签核；当前不准 PASS。'};
fs.writeFileSync('docs/V2948_严格验收门禁报告.json',JSON.stringify(summary,null,2)+'\n');
console.log('V2.9.48 actual UI gate:',summary.registered,'registered;',summary.verified,'fully evidenced;',summary.pending,'pending; release',summary.status);
if(process.argv.includes('--strict')&&summary.status!=='PASS')process.exitCode=2;
