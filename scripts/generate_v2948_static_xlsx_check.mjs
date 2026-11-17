/** Generate nine REAL static-publish Excel exports via the production browser
 * generator's buildExecutionFormulaTabs; inject only the package import path
 * for testing in Node. This test does not assert that a user clicked on URL. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url))+'/..';
const js=fs.readFileSync(path.join(root,'static/procurement-execution/site-data.js'),'utf8');
const db=JSON.parse(js.slice(js.indexOf('=')+1).trim().replace(/;$/,''));
let src=fs.readFileSync(path.join(root,'static/procurement-execution/assets/full_formula_xlsx_v2948.mjs'),'utf8');
const original="import {downloadXlsx} from '/engine/browser_xlsx_v2939.mjs';";
if(!src.includes(original))throw Error('Browser XLSX import path changed, test must adapt');
const url=pathToFileURL(path.join(root,'browser_xlsx_v2939.mjs')).href;
src=src.replace(original,`import {downloadXlsx,createXlsx} from '${url}';`);
src+='\nexport {createXlsx as testCreateXlsx};\n';
const {buildExecutionFormulaTabs,testCreateXlsx}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const folder=process.env.PHARMA_STATIC_XLSX_OUT||'/mnt/data/v2948_static_checks';
fs.mkdirSync(folder,{recursive:true});
for(const p of db.pages){
 const records=p.rows.filter(r=>r.supplier==='SUP-001');
 const sheets=buildExecutionFormulaTabs(p,records,{supplier:'SUP-001',material:'all',month:'all',project:'all'},db.asof,'kpis');
 fs.writeFileSync(path.join(folder,p.id+'.xlsx'),testCreateXlsx(sheets));
 console.log(p.id,records.length,sheets.length,db.asof);
}
