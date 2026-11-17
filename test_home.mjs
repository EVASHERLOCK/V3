import fs from 'node:fs';
import assert from 'node:assert/strict';
import {executiveSummary} from './executive.mjs';
function csv(name){const lines=fs.readFileSync(`./samples/${name}`,'utf8').replace(/^\ufeff/,'').trim().split(/\r?\n/);const names=lines.shift().split(',');return lines.map(s=>Object.fromEntries(s.split(',').map((v,i)=>[names[i],v])))}
const data={po:csv('purchase_orders.csv'),qc:csv('qc_lots.csv'),production:csv('production.csv'),inventory:csv('inventory.csv'),changes:csv('change_controls.csv'),suppliers:csv('suppliers.csv')};
const all=executiveSummary(data),july=executiveSummary(data,{month:'2026-07'}),s1=executiveSummary(data,{supplier:'SUP-001'});
assert.equal(all.kpis.po_lines,24);assert.equal(all.kpis.spend,580704);assert.equal(all.kpis.otd,91.7);assert.equal(all.kpis.ppv,2.53);assert.equal(all.kpis.open_changes,2);assert.equal(all.kpis.readiness,41.7);
assert.equal(july.kpis.po_lines,15);assert.equal(july.kpis.spend,326392);assert.equal(july.kpis.readiness,null,'filtered PO slice must not imply filtered production readiness');
assert.equal(s1.kpis.po_lines,8);assert.equal(all.charts.suppliers.reduce((s,x)=>s+x.value,0),all.kpis.spend);
assert.equal(all.kpis.savings,null);assert.equal(all.kpis.budget,null);assert.ok(all.period_note.includes('并非连续'));
console.log('PASS HOME: 24 PO rows, 580704 spend, OTD 91.7, PPV 2.53, readiness 41.7; July 15 / 326392; no fabricated budget/savings');
