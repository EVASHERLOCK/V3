import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildModuleTrace,exportModuleTraceWorkbook,sanitizeModuleInput} from './module_traceability_v2928.mjs';
import {inspectXlsxFormulas} from './scripts/zip_formula_assert.mjs';
import {PAGE_METRIC_INDEX} from './page_metric_manifest_v2923.mjs';

const sample={route:'ss-performance',title:'OTD × PPV 绩效矩阵',component_id:'ss-performance.perf.matrix',
 metrics:['SRC.PO.OTD','SRC.PO.PPV'],actions:['ACT.DELIVERY.INVESTIGATE'],
 tables:[{title:'供应商交付与价格示例',headers:['供应商','数量','单价'],rows:[['Aster',100,10],['Cedar',80,9]]}],
 figures:[{label:'OTD',value:'90%'}],narratives:['交付率偏低，需要先分析全部PO的交付记录，再判断是否需要启动供应商改进。']};
const report=buildModuleTrace(sample,{scope:{supplier:'all',material:'all',year:'all'}});
assert.equal(report.schema,'MODULE_TRACE_V2928');
assert.deepEqual(report.metrics.map(x=>x.metric_id),['SRC.PO.OTD','SRC.PO.PPV']);
assert.equal(report.tables[0].rows.length,2);
assert(report.steps.some(x=>x.includes('交叉矩阵说明')));
assert(report.steps.some(x=>x.includes('分子')));
assert(report.actions.some(x=>x.status==='DEMO_RULE_EXPLANATION'));
assert(report.source_class.includes('DEMO'));
const bytes=exportModuleTraceWorkbook(sample,{scope:{supplier:'all',material:'all',year:'all'}});
const xlsx=inspectXlsxFormulas(bytes);
assert(bytes.subarray(0,4).toString()==='PK\x03\x04');
assert(xlsx.formulas>=40,'real formulas, not renamed CSV');
const workbook=xlsx.entries.get('xl/workbook.xml')?.toString('utf8')||'';
for(const sheet of ['模块概览','模块指标字典','文字分析依据','界面数值','模块表1','PO_Inputs','指标_逐项公式'])assert(workbook.includes(sheet),`Missing ${sheet}`);
for(const text of ['Aster','Cedar','100','交叉矩阵说明'])assert(xlsx.xml.includes(text),`missing module-specific value ${text}`);
assert(!xlsx.xml.includes('#REF!'));

// An orphan/unmapped component must export a nonempty explanation, not an
// invented operational KPI formula or blank workbook.
const unknown={route:'ss-performance',title:'未登记的非常规行业趋势图',component_id:'ss-performance.unknown',metrics:[],actions:[],tables:[],figures:[{label:'尚无来源',value:'--'}],narratives:['经分析证实由于供货中断导致增长。']};
const missing=buildModuleTrace(unknown);
assert.equal(missing.status,'PARTIAL_EVIDENCE');
assert.equal(missing.metrics.length,0);
assert(missing.missing.some(x=>x.includes('专属已验证规则')));
const mb=inspectXlsxFormulas(exportModuleTraceWorkbook(unknown));
assert(mb.formulas>=1,'unregistered module has a transparent structural Excel formula');
assert(!mb.xml.includes('SRC.PO.SPEND'),'unregistered narrative must not import unrelated PO indicators');
assert(mb.xml.includes('NOT_REGISTERED'));

// Scope filtering must be part of per-module answers, not a static page formula.
const restricted=buildModuleTrace(sample,{scope:{supplier:'DEMO-NONEXISTENT',material:'all',year:'all'}});
assert(restricted.metrics.every(x=>x.result===null),'Missing filtered rows must not be cast to 0');

// Provenance/validation and malicious formula-input protection.
assert.throws(()=>sanitizeModuleInput({...sample,route:'../exploit'}));
const hostile=exportModuleTraceWorkbook({...sample,tables:[{title:'检测',headers:['Supplier','数量','单价'],rows:[['=HYPERLINK("https://evil.example")',2,3]]}]});
const entries=inspectXlsxFormulas(hostile);
assert(entries.xml.includes('HYPERLINK')&& !entries.xml.includes('<f>HYPERLINK'),'UI strings cannot become formulas');
assert(Object.keys(PAGE_METRIC_INDEX).length===26,'all 26 route manifest preserved');
const html=fs.readFileSync('static/index.html','utf8');
for(const mark of ['module_traceability_v2928.css','PharmaModuleTrace','本模块公式 / 分析依据','展开全量计算依据和来源表'])assert(html.includes(mark),'new inline bundle missing '+mark);
const audit=fs.readFileSync('static/metric_audit_ui.js','utf8');assert(audit.includes('window.PharmaModuleTrace.apply()'),'legacy empty placeholder bypass');
console.log(`PASS V2.9.28 per-module lineage: 26 routes, 2 exact OTD/PPV formulas, narrative rule, ${xlsx.formulas} real Excel formulas, nonempty missing-data workbook and input safety`);
