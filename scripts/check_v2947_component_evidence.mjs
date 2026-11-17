/** V2.9.47: audit evidence gate. Never infer business acceptance from static text or passing data models. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source='docs/V2947_逐组件验收证据登记.json';
const inventory=JSON.parse(fs.readFileSync(source,'utf8'));
const old=JSON.parse(fs.readFileSync('docs/V2929_组件扫描基线.json','utf8'));
const active=old.components.filter(c=>!new Set(['m05','m08','m10']).has(c.route));
assert.equal(active.length,217,'历史活动组件基线变化，请重新登记');
const knownIds=new Set(active.map(c=>c.id));
const registeredIds=new Set();
const critical=['click_formula','formula_variables','calculation_conditions','source_row_identity','source_row_count','full_source_pagination','cell_formula_web','cell_formula_xlsx','excel_numeric_match','narrative_steps','browser_e2e','business_signoff'];
const completed=[];const pending=[];
for(const item of inventory.components){
 assert.ok(item.id&&item.route&&item.kind,'组件缺标识');
 assert.ok(!registeredIds.has(item.id),'重复组件ID: '+item.id);
 registeredIds.add(item.id);
 assert.ok(item.evidence&&typeof item.evidence==='object','证据结构缺失: '+item.id);
 assert.ok(['PENDING','BLOCKED','PASS'].includes(item.status),'不允许的业务状态: '+item.id);
 const gaps=critical.filter(k=>!item.evidence[k]?.verified);
 // A pass needs independently verifiable, non-empty evidence identifiers, not just checked boxes.
 if(item.status==='PASS'){
  assert.equal(gaps.length,0,`禁止假通过 ${item.id}: ${gaps.join(',')}`);
  for(const key of critical){const e=item.evidence[key];assert.ok(typeof e.artifact==='string'&&e.artifact.length>3,`缺验证记录 ${item.id}/${key}`);assert.ok(fs.existsSync(e.artifact),`验证材料不存在 ${item.id}/${key}: ${e.artifact}`)}
  completed.push(item.id);
 }else pending.push({id:item.id,gaps});
}
for(const c of active)assert.ok([...registeredIds].some(id=>id===c.id||id.startsWith(c.id+'__baseline_duplicate_')),'历史组件未登记 '+c.id);
const iframeRoutes=[...Array.from({length:5},(_,i)=>`decision-0${i+1}`),...Array.from({length:9},(_,i)=>`exec-0${i}`)];
for(const route of iframeRoutes){
 const group=inventory.components.filter(x=>x.route===route);
 assert.ok(group.length>0,'独立iframe页面必须至少登记子模块: '+route);
 assert.ok(group.every(x=>x.kind==='iframe_submodule'),'独立页面登记类型错误 '+route);
}
const summary={version:'2.9.47',registered:inventory.components.length,legacy_active:active.length,iframe_routes:iframeRoutes.length,verified:completed.length,pending:pending.length,release:pending.length?'BLOCKED':'EVIDENCE_REVIEW_REQUIRED',pending_details:pending};
fs.writeFileSync('docs/V2947_严格验收待办.json',JSON.stringify(summary,null,2)+'\n');
console.log(`V2.9.47 逐组件证据检查: ${summary.registered} 登记，${summary.verified} 具备完整证据，${summary.pending} 未完成；放行=${summary.release}`);
if(process.argv.includes('--strict')&&summary.release!=='PASS')process.exitCode=2;
