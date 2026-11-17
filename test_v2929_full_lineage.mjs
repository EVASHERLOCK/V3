import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveComponentLineage,COMPONENT_CONTRACTS,assessDisplayedTables,auditNarrativeParagraphs} from './component_lineage_v2929.mjs';
import {buildModuleTrace,exportModuleTraceWorkbook,sanitizeModuleInput} from './module_traceability_v2928.mjs';
import {inspectXlsxFormulas} from './scripts/zip_formula_assert.mjs';
const expected=[
 ['OTD × PPV 绩效矩阵',['SRC.PO.OTD','SRC.PO.PPV']],
 ['BOM 成本瀑布',['SRC.BOM.TARGET_TOTAL']],
 ['项目进度甘特图',['SRC.PROJECT.STAGES']],
 ['供应商五维评分矩阵',['SRC.SCORE.WEIGHTED_MEAN']],
 ['高风险风险可视化图表',['SRC.PO.CR3_SHARE']],
 ['CEP 资质文件审批闭环状态',['SRC.DOC.COUNT']],
 ['财务发票三单匹配',['SRC.INVOICE.MATCH_RATE']],
 ['降本机会替代材料情景降幅假设 -6.0%',['SRC.SAVINGS.PLANNED']],
 ['月度滚动预算复盘｜消耗数量与金额',['SRC.PO.SPEND']],
 ['FDA · Inspection Classification',['SRC.REG.FILINGS']],
 ['供应商总数',['SRC.CANDIDATE.TOTAL']],
 ['核心产品线采购策略Top30',['SRC.PO.SPEND']],
];
for(const [title,ids] of expected){const c=resolveComponentLineage({route:'ss-performance',title});assert.equal(c.binding_status,'DOMAIN_RULE_MATCH','no contract for '+title);for(const id of ids)assert(c.metrics.includes(id),`${title}: missing ${id}`)}
const benign=resolveComponentLineage({route:'ss-data',title:'自动发现设置',tables:[],charts:[]});assert(benign.contracts.some(s=>s==='operations')||benign.binding_status==='NO_BUSINESS_CALC_REQUIRED');
const sample={route:'ss-performance',title:'OTD × PPV 绩效矩阵',component_id:'ss-performance.matrix.9',tables:[{title:'汇总',headers:['供应商','数量','单价','评分','权重','实际','目标'],rows:[['Aster',100,10,92,0.3,110,100],['Cedar',80,12,88,0.7,125,115]]}],figures:[{label:'OTD',value:'91.67%'},{label:'PPV',value:'2.53%'},{label:'没有来源的风险率',value:'88%'}],charts:[{title:'OTD × PPV',chart_type:'SVG',source_hint:'坐标仅UI',series:[{label:'Aster',value:'91.67%',element:'text',position:'x100y60'}]}],narratives:['OTD 从 91.67% 的来源得到，但需要分析延误根因再给出整改建议。','PPV 接近 2.53%，尚不能证明供应商有意涨价。']};
const rep=buildModuleTrace(sample,{scope:{supplier:'all',material:'all',year:'all'}});
assert(rep.contract.metrics.includes('SRC.PO.OTD'));
assert(rep.metrics.map(m=>m.metric_id).includes('SRC.PO.PPV'));
// V2.9.30 no longer guesses a metric ID from similar text labels.
// Untagged figures stay UNVERIFIED, even if their values resemble a KPI.
assert(rep.display_reconciliations.every(x=>x.status==='MISSING_EXPLICIT_METRIC_ID'));
assert(rep.reconciliation.summary.display_passed===0);
assert.equal(rep.table_audits[0].calculations.length,3);
assert.equal(rep.narrative_audits.length,2);
assert.equal(rep.charts[0].series.length,1);
const book=inspectXlsxFormulas(exportModuleTraceWorkbook(sample,{scope:{supplier:'all',material:'all',year:'all'}}));
const workbook=book.entries.get('xl/workbook.xml').toString('utf8');
for(const name of ['界面与来源对账','逐段文字分析','组件计算契约','图表数据点','展示数据列核算','模块表1','PO_Inputs','指标_逐项公式'])assert(workbook.includes(name),'missing '+name);
assert(book.formulas>60);
for(const keyword of ['Aster','Cedar','展示数据列核算','91.67%','差额=实际'])assert(book.xml.includes(keyword),keyword);
assert(!book.xml.includes('#REF!'));
// Do not accidentally include DEMO PO on a pure input-free configuration panel.
const ctl={route:'ss-data',title:'安全连接',component_id:'ss-data.config',tables:[],narratives:['管理员配置了远程接口密钥，但是没有企业授权连接记录。']};
const report=buildModuleTrace(ctl);assert.equal(report.metrics.length,0);assert(report.missing.length===0||report.missing.every(x=>!x.includes('缺少正式绑定的指标')));
const op=inspectXlsxFormulas(exportModuleTraceWorkbook(ctl));assert(!op.xml.includes('SRC.PO.SPEND'));
// Raw unregistered user strings must stay inlineStr, not turn into formula injection.
const evil=inspectXlsxFormulas(exportModuleTraceWorkbook({...sample,tables:[{title:'raw',headers:['业务来源'],rows:[['=CMD("malicious")']]}]}));assert(evil.xml.includes('CMD(')&&!evil.xml.includes('<f>CMD('));
// Larger module tables/narratives no longer silently truncate at V2928 8x400/25.
const t=Array.from({length:14},(_,i)=>({title:'明细'+i,headers:['Item','数量','单价'],rows:Array.from({length:420},(_,j)=>['item'+j,j+1,2])}));const large=sanitizeModuleInput({...sample,tables:t,narratives:Array.from({length:42},(_,i)=>`建议复核第${i}条`)});assert.equal(large.tables.length,14);assert.equal(large.tables[0].rows.length,420);assert.equal(large.narratives.length,42);
const inv=JSON.parse(fs.readFileSync('docs/V2929_组件扫描基线.json'));assert.equal(inv.routes.length,26);assert(inv.components.length>=240);assert(COMPONENT_CONTRACTS.length>=60);
const web=fs.readFileSync('static/module_traceability_v2928.js','utf8');assert(web.includes('uiReconcile')&&web.includes('展开全量计算依据和来源表'));
console.log(`PASS V2.9.29: 26路由、${inv.components.length}个扫描模块、${COMPONENT_CONTRACTS.length}类方法契约、12类专项映射、复合指标分别复算、${book.formulas}个公式、全量文字及表格、无凭据隔离`);
