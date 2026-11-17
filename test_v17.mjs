import assert from 'node:assert/strict';
import fs from 'node:fs';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
const JS=fs.readFileSync('static/v16_overview.js','utf8');
const CSS=fs.readFileSync('static/v16_overview.css','utf8');
for(const marker of ['采购总概览','v17-topbar','v17-health','v17-risk-card','v17-kpi-delivery','v17-kpi-cost','v17-kpi-compliance','v17-analytics','v17-supplier','v17-improvement','v17-issues','v17-nav-items','spendDonut','overviewScore','data-v16-filter','data-v16-detail'])assert.ok(JS.includes(marker),marker);
for(const marker of ['.v17-topbar','.v17-gauge-box','.v17-kpi-layout','.v17-four-grid','.v17-two-zones','.v17-issues','.v17-quick'])assert.ok(CSS.includes(marker),marker);
const a=enterpriseAnalysis({});
const amt=rs=>rs.reduce((z,r)=>z+Number(r.amount),0);
const total=amt(a.purchasing.orders);
assert.equal(total,580704);
assert.equal(a.overview.current.spend,total);
assert.equal(a.supplier.scorecards.reduce((z,r)=>z+r.spend,0),total);
assert.equal(a.overview.supplier.reduce((z,r)=>z+r.value,0),total);
assert.equal(amt(a.purchasing.late),51512);
assert.equal(a.actions.alerts.filter(r=>r.severity==='HIGH').length,6);
assert.equal(a.actions.tasks.filter(r=>r.status==='已完成').length,0);
for(const f of [{supplier:'SUP-001'},{supplier_class:'Pending'},{month:'2026-06'},{material:'API-001'},{year:'2025'}]){
 const d=enterpriseAnalysis(f);assert.equal(amt(d.purchasing.orders),d.overview.current.spend);assert.equal(d.overview.supplier.reduce((z,r)=>z+r.value,0),d.overview.current.spend);
}
console.log('PASS V1.7 overview design + canonical cross-page supplier spend, late PO, risk, filter and no phantom historical tasks');
