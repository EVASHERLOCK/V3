/** V2.9.37 nine-page integration / source-contract tests. No external services. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildExecutionDataset,browserDataSource,metricForPage,exportExecutionWorkbook,PAGE_IDS} from './procurement_execution_v2937.mjs';
import {inspectXlsxFormulas} from './scripts/zip_formula_assert.mjs';
const root='static/procurement-execution';
const expected=['00_询价与报价比对.html','01_合同核查.html','02_PO创建与比对.html','03_发运与到货.html','04_发票核对.html','05_付款与应付.html','06_退货与索赔.html','07_订单关闭与绩效.html','08_异常处理中心.html'];
assert.equal(PAGE_IDS.length,9);
for(const [i,p] of expected.entries()){
 const source=fs.readFileSync(path.join(root,p),'utf8');
 assert.match(source,/site_integration_v2937\.css/);
 assert.match(source,/src="site-data\.js"/);
 assert.match(source,/assets\/app_boot_v2939\.js/);
 assert.match(source,/site_integration_v2937\.js/);
 const data=buildExecutionDataset({page:PAGE_IDS[i]});
 assert.equal(data.page,PAGE_IDS[i]);assert.equal(data.pages.length,9);
 assert.equal(data.rows.length,data.row_count);
 for(const r of data.rows)assert.ok(typeof r.source_file==='string'&&r.source_file.length>0);
}
assert.equal(fs.readdirSync(path.join(root,'workbooks')).filter(x=>x.endsWith('.xlsx')).length,65);
const source=browserDataSource();assert.equal(source.pages.length,9);
assert.ok(source.pages.every(p=>Array.isArray(p.metrics)&&Array.isArray(p.rows)&&Array.isArray(p.site_contract.supported_metrics)));
const pos=buildExecutionDataset({page:'orders'});
const csv=fs.readFileSync('samples/purchase_orders.csv','utf8');
assert.ok(pos.row_count>0);
for(const r of pos.rows)assert.ok(csv.includes(r.po));
assert.equal(metricForPage('orders','orders',pos.rows).value,pos.row_count);
const shipped=buildExecutionDataset({page:'shipments'});
const otif=metricForPage('shipments','otif',shipped.rows);assert.ok(otif.value>=0&&otif.value<=1);
assert.equal(metricForPage('shipments','late',shipped.rows).status,'SITE_DEMO_RECALCULATED');
assert.ok(buildExecutionDataset({page:'shipments',supplier:'SUP-002'}).rows.every(x=>x.supplier==='SUP-002'));
assert.ok(buildExecutionDataset({page:'shipments',material:'API-001'}).rows.every(x=>x.material==='API-001'));
for(const name of ['contracts','invoices','payments','claims']){
 const page=buildExecutionDataset({page:name});
 assert.equal(page.row_count,0,`${name} must not invent ERP transactions`);
 assert.equal(page.available_metrics.length,0,`${name} must not falsely verify KPI`);
}
for(const r of buildExecutionDataset({page:'exceptions'}).rows)assert.match(r.status,/候选信号/);
for(const r of buildExecutionDataset({page:'rfq'}).rows)assert.equal(r.rfq_id,'未登记');
const client=fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
assert.match(client,/__PE_SITE_SYNC/);assert.match(client,/rr\[0\]\.request_qty==null/);
const host=fs.readFileSync('static/index.html','utf8');
assert.match(host,/采购执行管理/);for(let i=0;i<9;i++)assert.ok(host.includes(`exec-0${i}`));
const server=fs.readFileSync('server.mjs','utf8');assert.match(server,/\/api\/procurement-execution\/workbook\.xlsx/);
for(const page of ['rfq','orders','shipments','invoices','payments','exceptions']){const report=inspectXlsxFormulas(await exportExecutionWorkbook({page}));assert.equal(report.sheets,7);assert.ok(report.formulas>=7,`${page} has auditable evidence gate formulas`)}
console.log('PASS V2.9.37: 9 pages, 65 reference formula Excel files, shared PO/QC/quote/change source, filter + KPI audit, no fabricated downstream ERP records');
