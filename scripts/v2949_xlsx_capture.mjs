/* Test harness captures workbook tabs and writes an actual XLSX sample; it is not a browser download test. */
import fs from 'node:fs';
import {createXlsx,xlFormula} from '../browser_xlsx_v2939.mjs';
export {xlFormula};
export function downloadXlsx(tabs,name){
 globalThis.__v2949Xlsx={tabs,name};
 if(name==='V2949_page_01.xlsx'){
  const target=process.env.PHARMA_DECISION_DEMO_XLSX||'/mnt/data/Pharma_Decision_V2949_115_KPI_Formula_Reconciliation_DEMO.xlsx';
  fs.writeFileSync(target,createXlsx(tabs));
  globalThis.__v2949SampleFile=target;
 }
 return {tabs:tabs.length};
}
