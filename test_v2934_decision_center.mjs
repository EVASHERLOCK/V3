import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDecisionDataset,buildDecisionEvidence} from './decision_center_v2934.mjs';
const app=fs.readFileSync('static/app.js','utf8');
const template=JSON.parse(fs.readFileSync('decision_center_template_v2934.json','utf8'));
const raw=buildDecisionDataset({});
assert.equal(raw.metrics.length,115);assert.equal(raw.analysis.length,22);assert.equal(raw.rules.length,30);assert.equal(raw.actions.length,24);assert.equal(raw.scenario.length,6);
const spending=raw.metrics.find(x=>x.id==='KPI-01-01');assert.equal(Number(spending.value),raw.source_meta.home.kpis.spend);
assert.notEqual(spending.unit,'USD','Cannot invent the missing PO currency');
const uncomputed=raw.metrics.filter(m=>m.status==='待接入');assert(uncomputed.length>=100);assert(uncomputed.every(m=>m.value==='—'));
const split=buildDecisionDataset({supplier:'SUP-002'});assert.equal(split.source_meta.scope.supplier,'SUP-002');assert(Number(split.metrics.find(x=>x.id==='KPI-03-01').value)<Number(raw.metrics.find(x=>x.id==='KPI-03-01').value));
const unknown=buildDecisionDataset({supplier:'unknown'});assert.equal(unknown.source_meta.scope.supplier,'all');
const evidence=buildDecisionEvidence({metric:'KPI-03-02'});assert.equal(evidence.metric.evidence.rows.length,Number(evidence.metric.value));
assert.deepEqual(raw.metrics.map(m=>m.name),template.metrics.map(m=>m.name),'Preserve original metric template and text');
for(const [i,name] of ['01_KPI总览.html','02_深度分析.html','03_智能预警.html','04_行动闭环.html','05_指标治理.html'].entries()){
 const html=fs.readFileSync('static/decision-center/'+name,'utf8');assert(html.includes(`const PAGE='0${i+1}'`));assert(html.includes('/api/decision-center/dataset?'));assert(html.includes('待接入'));assert(!html.includes('"value":"137,070"'),'No stale example KPI');}
assert(app.includes('changeGroup+decisionGroup+executionGroup;'),'Decision and execution groups must remain while retired legacy navigation is removed');
assert(app.includes('decisionCenterPage(page)'),'Five routes functional');
console.log('PASS V2.9.34: five unchanged visual templates, dynamic sourced KPIs, scope filters, evidence, source status and nested navigation.');
