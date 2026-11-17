/** V2.9.38: obsolete legacy pages are no longer reachable from the sidebar. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync('static/app.js','utf8');
const built = fs.readFileSync('dist/index.html','utf8');
const compiled = fs.readFileSync('dist/static/app.js','utf8');
const old = [['m05','exec-02','合同与采购执行'],['m08','exec-04','发票与付款智能分析'],['m10','decision-01','采购绩效与智能分析']];
for(const [route,destination] of old){
 assert.ok(app.includes(`${route}:'${destination}'`),`old deep link should redirect: ${route}`);
 assert.ok(compiled.includes(`${route}:'${destination}'`),`compiled redirect missing: ${route}`);
}
const navStart=app.indexOf('function navigation(){');
const navEnd=app.indexOf('function render(){',navStart);
assert.ok(navStart>=0 && navEnd>navStart);
const nav=app.slice(navStart,navEnd);
for (const [route,,label] of old){
 assert.ok(!nav.includes(`moduleNav('${route}')`),`${label} still has a legacy navigation button`);
 assert.ok(!nav.includes(`'${route}'`),`${label} still listed in navigation`);
}
assert.ok(nav.includes('changeGroup+decisionGroup+executionGroup;'),'new navigation hierarchy must stay intact');
assert.ok(nav.includes('EXECUTION_PAGES.map'),'all nine procurement execution pages should remain');
for(let i=0;i<9;i++)assert.ok(built.includes(`exec-0${i}`),`compiled site missing procurement execution page ${i}`);
for(let i=1;i<=5;i++)assert.ok(built.includes(`decision-0${i}`),`compiled site missing performance decision page ${i}`);
assert.ok(built.includes('m09-reference'),'change control reference retained');
console.log('PASS V2.9.38: three old sidebar pages removed, old links redirected, 9 execution + 5 performance + change pages preserved.');
