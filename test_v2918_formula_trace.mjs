import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {getCostTrace,exportCostWorkbook,exportMetricCatalogWorkbook,COST_ASSUMPTIONS} from './formula_workbook.mjs';

function unzip(buffer){const entries=new Map();let p=0;
 while(p+30<buffer.length && buffer.readUInt32LE(p)===0x04034b50){
  const compression=buffer.readUInt16LE(p+8),compressed=buffer.readUInt32LE(p+18),size=buffer.readUInt32LE(p+22),nameLen=buffer.readUInt16LE(p+26),extraLen=buffer.readUInt16LE(p+28);const name=buffer.subarray(p+30,p+30+nameLen).toString('utf8');
  const start=p+30+nameLen+extraLen;const payload=buffer.subarray(start,start+compressed);const raw=compression===8?inflateRawSync(payload):payload;
  assert.equal(raw.length,size,`Invalid xlsx member ${name}`);entries.set(name,raw.toString('utf8'));p=start+compressed;
 }
 return entries;
}
const trace=getCostTrace({material:'API-001',year:'2026'});
assert.equal(trace.material,'API-001');assert(trace.model.po.length>0);assert(trace.model.candidates.length>=10);
assert.throws(()=>getCostTrace({material:'all'}),/单一物料/,'must not silently export other material in all-material mode');
assert.equal(COST_ASSUMPTIONS.length,5);assert.equal(COST_ASSUMPTIONS[0].rate,-.06);
assert.equal(trace.model.waterfall.origin,'PO_BENCHMARK_DEMO_PROXY');
const raw=exportCostWorkbook({material:'API-001',year:'2026'});assert.equal(raw.subarray(0,4).toString('hex'),'504b0304');const files=unzip(raw);
for(const filename of ['[Content_Types].xml','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml','xl/worksheets/sheet4.xml','xl/worksheets/sheet5.xml','xl/worksheets/sheet6.xml','xl/worksheets/sheet7.xml','xl/worksheets/sheet8.xml','xl/worksheets/sheet9.xml'])assert(files.has(filename),`missing ${filename}`);
assert.equal((files.get('xl/workbook.xml').match(/<sheet /g)||[]).length,9,'nine structured sheets');
assert(files.get('xl/workbook.xml').includes('fullCalcOnLoad="1"'));
const summary=files.get('xl/worksheets/sheet1.xml');
assert(summary.includes('<f>IF('),'target price must be a real spreadsheet formula');
assert(summary.includes('SUM(&apos;PO输入&apos;!H4:')||summary.includes('SUM(\'PO输入\'!H4:'),'source PO weighted benchmark must be traceable');
assert(summary.includes('<f>MAX(0,100-MAX(0,(B6-B4)/B4*100))')===false,'formula should be wrapped in error handling');
const quotes=files.get('xl/worksheets/sheet3.xml');assert(quotes.includes('<f>MAX(F4,H4)</f>'));assert(quotes.includes('<f>E4*I4+G4</f>'));assert(quotes.includes('<f>IFERROR(J4/H4,0)</f>'));
const monthly=files.get('xl/worksheets/sheet4.xml');assert(monthly.includes('SUMIF(')&&monthly.includes('COUNTIF('),'monthly PO prices must have formulas');
const assumptions=files.get('xl/worksheets/sheet5.xml');assert(assumptions.includes('<f>D4*(1+C4)</f>'),'opportunity rate must act as editable assumption not a claimed fact');assert(assumptions.includes('未验证'));
const variance=files.get('xl/worksheets/sheet8.xml');assert(variance.includes('SUMIF('),'reconciliation should link to original PO rows');
const overall=unzip(exportMetricCatalogWorkbook());assert(overall.get('xl/worksheets/sheet1.xml').includes('尚未登记完整可重算Excel血缘')||overall.get('xl/worksheets/sheet1.xml').includes('待补'));
const costUI=fs.readFileSync('static/strategic_sourcing_cost.js','utf8');
for(const s of ['橙色竖线＝研发 BOM 目标参考价','情景降幅假设','data-cb-open="opportunity:','data-cb-open="review:all"','downloadFormulaExcel','cb-calc-steps'])assert(costUI.includes(s),`UI missing ${s}`);
assert(fs.readFileSync('static/app.js','utf8').includes('window.PharmaMetricAudit?.apply?.(c)'));
assert(fs.readFileSync('scripts/regenerate-inline.mjs','utf8').includes('metric_audit_ui.js'));
assert(fs.readFileSync('browser_api_boot.js','utf8').includes("startsWith('/api/formulas/')"),'xlsx must bypass JSON fallback');

// Smoke-test the actual Node routes, including MIME and xlsx bytes.
const port=19321;const proc=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),SOURCING_AUTO_SYNC:'0',COMPLIANCE_ESCALATION_SCAN:'0'},stdio:['ignore','pipe','pipe']});let output='';proc.stderr.on('data',b=>output+=b.toString());
try{
 let running=false;for(let i=0;i<45;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){running=true;break}}catch{}await pause(150)}assert(running,'Node server did not start '+output);
 const result=await fetch(`http://127.0.0.1:${port}/api/formulas/cost.xlsx?material=API-001&year=2026`);assert.equal(result.status,200);assert(result.headers.get('content-type').includes('spreadsheetml.sheet'));assert(result.headers.get('content-disposition').includes('.xlsx'));const actual=unzip(Buffer.from(await result.arrayBuffer()));assert(actual.get('xl/worksheets/sheet5.xml').includes('<f>D4*(1+C4)</f>'));
 const catalog=await fetch(`http://127.0.0.1:${port}/api/formulas/catalog.xlsx`);assert.equal(catalog.status,200);assert(unzip(Buffer.from(await catalog.arrayBuffer())).has('xl/worksheets/sheet3.xml'));
 const json=await fetch(`http://127.0.0.1:${port}/api/formulas/cost?material=API-001`).then(r=>r.json());assert.equal(json.quote_count,trace.model.candidates.length);assert.equal(json.assumptions[0].rate,-.06);assert.equal(json.po_count,trace.model.po.length);
}finally{proc.kill('SIGTERM')}
console.log('PASS V2.9.18: real XLSX ZIP/worksheet/formulas/PO/quote/opportunity/review; cost UI and site-wide formula governance; GET routes and MIME');
