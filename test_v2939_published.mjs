import assert from 'node:assert/strict';import fs from 'node:fs';
import {handleStaticLineage} from './browser_module_trace_v2939.mjs';
import {createXlsx,xlFormula} from './browser_xlsx_v2939.mjs';
const root='dist';assert.ok(fs.existsSync(root+'/index.html'));
assert.match(fs.readFileSync(root+'/index.html','utf8'),/pharma-api-origin/);
const js=fs.readFileSync(root+'/static/procurement-execution/site-data.js','utf8');
assert.match(js,/window.APP_DATA/);assert.match(js,/"id":"orders"/);
for(let i=0;i<9;i++){let f=fs.readdirSync(root+'/static/procurement-execution').find(n=>n.startsWith(String(i).padStart(2,'0')+'_'));assert.ok(f,'missing page '+i);const s=fs.readFileSync(root+'/static/procurement-execution/'+f,'utf8');assert.match(s,/src="site-data\.js"/);assert.match(s,/app_boot_v2939\.js/)}
for(const p of ['engine/browser_api.mjs','engine/browser_xlsx_v2939.mjs','engine/browser_module_trace_v2939.mjs','static/demo-metric-catalog-v2939.json'])assert.ok(fs.existsSync(root+'/'+p),p);
const raw=async p=>new Response(fs.readFileSync(root+p),{headers:{'content-type':'application/json'}});
const body={route:'overview',title:'采购支出金额 / OTD / PPV',metrics:['SRC.PO.SPEND','SRC.PO.OTD','SRC.PO.PPV'],tables:[{title:'PO',headers:['ID','金额'],rows:[['PO-1',120]]}],narratives:[]};
const src=await handleStaticLineage('/api/lineage/module',body,new URL('https://example.test/api/lineage/module'),raw);assert.equal(src.status,200);const a=await src.json();assert.equal(a.metrics.length,3);assert.ok(a.metrics.every(m=>m.rows.length>0&&m.formula&&m.result!==null));
const scoped=await handleStaticLineage('/api/lineage/module',body,new URL('https://example.test/api/lineage/module?supplier=SUP-002'),raw);assert.ok((await scoped.json()).metrics.every(m=>m.result===null),'static catalog must never claim recalculated filtered results');
const wb=await handleStaticLineage('/api/lineage/module/workbook.xlsx',body,new URL('https://example.test/api/lineage/module/workbook.xlsx'),raw);assert.equal(wb.status,200);const bytes=new Uint8Array(await wb.arrayBuffer());assert.ok(bytes.length>2000);assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
assert.ok(createXlsx([{name:'可计算',rows:[['指标','数值'],['SUM',xlFormula('SUM(B3:B4)')]]}]).length>1000);
const pkg=JSON.parse(fs.readFileSync('package.json'));assert.ok(pkg.version.localeCompare('2.9.39',undefined,{numeric:true})>=0,'must retain V2.9.39 published compatibility');
console.log('PASS V2.9.39: nine static page bootstraps, same-sample source, JSON POST lineage fallback, real formula XLSX, filtered scope guard, external backend configuration');
