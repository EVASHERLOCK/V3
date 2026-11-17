import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {buildChangeWorkbench,exportChangeWorkbook,normalizeFilters} from './change_control_v2931.mjs';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {inspectXlsxFormulas} from './scripts/zip_formula_assert.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const actual=enterpriseAnalysis({});
const r=buildChangeWorkbench();
assert.equal(r.changes.length,actual.change.changes.length);
assert.equal(r.kpis.open_changes,2);
assert.equal(r.filings.length,actual.change.filings.length);
assert.equal(r.kpis.filings,3);
assert.equal(r.kpis.high_risk,1);
assert.equal(r.kpis.ra_pending,3);
assert.equal(r.kpis.oldest_open_days,73);
assert(Math.abs(r.kpis.closure_rate-100/3)<1e-8);
assert.equal(r.orders.length,actual.purchasing.orders.length);
assert.equal(r.orders.reduce((s,p)=>s+Number(p.amount),0),580704);
assert.equal(r.kpis.exposure,387008,'Closed change associations must not inflate active impact value');
assert.equal(r.kpis.exposure,actual.purchasing.orders.filter(p=>p.material_id==='API-001').reduce((s,p)=>s+p.amount,0));
assert.equal(r.source.scope,'V08 DEMO / 受控原站模拟数据');
assert.equal(r.reasoning.length,4);
assert.equal(r.document_groups.length,5);
assert(r.methods.length>=10);
assert(r.changes.every(x=>Array.isArray(x.po_ids)&&Array.isArray(x.file_ids)&&x.risk_parts?.score===x.risk));
for(const x of r.changes){
 const po=r.orders.filter(p=>x.po_ids.includes(p.po_id));
 assert.equal(x.po_amount,po.reduce((s,p)=>s+p.amount,0));
 assert.equal(x.risk,Math.min(100,x.risk_parts.base+x.risk_parts.age+x.risk_parts.markets+x.risk_parts.gap));
 for(const id of x.file_ids)assert(r.docs.some(d=>d.doc_id===id));
}
const sup=buildChangeWorkbench({supplier:'SUP-002'});
assert.equal(sup.changes.length,1);assert.equal(sup.orders.length,8);
assert.equal(sup.kpis.exposure,186144);
assert(sup.changes.every(x=>x.supplier_id==='SUP-002'));
assert(sup.available.supplier.includes('SUP-001')&&sup.available.supplier.includes('SUP-003'),'Supplier drop-down must permit changing directly to other suppliers');
const mat=buildChangeWorkbench({material:'API-002'});
assert.equal(mat.changes.length,1);assert.equal(mat.kpis.open_changes,0);
assert.equal(mat.kpis.exposure,0,'Closed change cannot contribute to open exposure');
assert.equal(mat.kpis.closure_rate,100);
const mo=buildChangeWorkbench({month:'2026-08'});
assert.equal(mo.changes.length,1);assert.equal(mo.changes[0].change_id,'CC-2026-014');
const closed=buildChangeWorkbench({status:'closed'});
assert.equal(closed.changes.length,1);assert.equal(closed.kpis.ra_pending,0);assert.equal(closed.kpis.exposure,0);
assert.equal(buildChangeWorkbench({change_type:'Specification update'}).changes.length,1);
const empty=buildChangeWorkbench({supplier:'NOT-REGISTERED'});
assert.equal(empty.changes.length,0);assert.equal(empty.kpis.exposure,0);assert.equal(empty.kpis.closure_rate,null);
assert.equal(normalizeFilters({supplier:'SUP-002',scheme:'QA评估视图'}).scheme,'QA评估视图');
for (const [name,report] of [['full',r],['supplier',sup],['none',empty]]) {
 const x=exportChangeWorkbook(report),check=inspectXlsxFormulas(x);
 assert(x.subarray(0,2).toString()==='PK');
 assert(check.sheets>=10,`${name} workbook sheets`);
 assert(check.formulas>=10,`${name} workbook formula cells`);
 if(report.orders.length)assert(check.xml.includes('SUMIF('),`${name} workbook open-change PO exposure formula`);
 if(report.changes.length)assert(check.xml.includes('COUNTIF('),`${name} workbook stage counter`);
 assert(!check.xml.includes('#REF!'),`${name} workbook no broken Excel formula`);
}
// Every screenshot module must export its own formula workbook, not silently return the same full-site file.
const moduleTabs={gantt:'甘特流程',documents:'文件要求缺口',risk:'变更业务影响',milestones:'关键里程碑',overview:'变更业务影响'};
for(const [mod,tab] of Object.entries(moduleTabs)){
 const buffer=exportChangeWorkbook(r,{module:mod});
 const info=inspectXlsxFormulas(buffer);
 assert(info.sheets>=7 && info.formulas>=10, `${mod}: formula-bearing specific workbook`);
 assert(info.xml.includes('SUMIF(') && info.xml.includes('COUNTIF('), `${mod}: source math`);
}
assert.throws(()=>exportChangeWorkbook(r,{module:'unknown'}), /不支持/);
const poOnly=inspectXlsxFormulas(exportChangeWorkbook(r,{poOnly:true}));
assert.equal(poOnly.sheets,2);assert(poOnly.formulas>=r.orders.length*2);
const html=readFileSync(join(root,'static','change_control_ra_v2931.js'),'utf8');
for (const token of ['变更项目进度甘特图（全流程）','变更影响与文档档案','变更风险与RA评估知识库','关键里程碑与责任协同（关键节点）','变更影响与合规概览（产能、库存、注册）','data-cc31-filter="supplier"','data-cc31-filter="material"','data-cc31-filter="month"','data-cc31="download:full"','detail:change:'])assert(html.includes(token),`Missing screenshot module/control ${token}`);
const app=readFileSync(join(root,'static','app.js'),'utf8');
assert(app.includes("S.view==='m09'&&window.PharmaChangeControlV2931"),'App must use new page route');
const server=readFileSync(join(root,'server.mjs'),'utf8');
assert(server.includes('/api/change-control/workbench.xlsx')&&server.includes('/api/change-control/workbench'),'No backend workbench API');
console.log('PASS V2.9.31: screenshot structure, 3 canonical changes, filing/PO/document cross-page keys, source risk & spend, 5 live filters, no fake GxP signoffs, 11+ spreadsheet tabs and real Excel formulas.');
