import {kpiAnalyze,sourcingAnalyze,checklist,regulatory,aiDisabled} from './calculations.mjs';
import {executiveSummary} from './executive.mjs';
import {suiteAnalysis} from './suite.mjs';
import {enterpriseAnalysis,setEnterpriseScenario} from './enterprise_v08.mjs';
import {makeScenario} from './scenario_master.mjs';
import {validateKpiInput} from './v10_validation.mjs';
const samples=new Map();
let activeScenario=null,scenarioMeta=null;
export function getScenarioMeta(){return scenarioMeta;}
export function clearScenario(){activeScenario=null;scenarioMeta=null;setEnterpriseScenario(null);}
export function applyScenario(tables,meta={}){
 const master=makeScenario(tables,meta);setEnterpriseScenario(master);activeScenario=tables;scenarioMeta={source:master.scenario_source,at:new Date().toISOString(),counts:Object.fromEntries(['po','qc','production','inventory','changes'].map(k=>[k,tables[k].length]))};return scenarioMeta;
}
function parseCSV(text){
  text=text.replace(/^\ufeff/,'');let rows=[],row=[],cell='',quote=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}
    else if(!quote&&c===','){row.push(cell);cell=''}
    else if(!quote&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>x.trim()))rows.push(row);row=[]}
    else cell+=c;
  }
  if(quote)throw Error('CSV 字段引号未闭合');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  if(!rows.length)throw Error('空 CSV 文件');const headers=rows.shift().map(x=>x.trim().toLowerCase().replace(/\s+/g,'_'));
  return rows.map(cells=>Object.fromEntries(headers.map((h,i)=>[h,(cells[i]??'').trim()])));
}
async function sample(name,rawFetch){if(samples.has(name))return samples.get(name);
 const r=await rawFetch('/samples/'+encodeURIComponent(name));if(!r.ok)throw Error('无法加载内置文件 '+name);
 const out=parseCSV(await r.text());samples.set(name,out);return out;
}
async function uploaded(form,key,defaultFile,rawFetch){let file=form.get(key);if(file&&typeof file==='object'&&typeof file.text==='function'&&file.name){
 if(file.size>18*1024*1024)throw Error('文件大于18MB');
 const excel=globalThis.PharmaExcel;
 if(!excel)throw Error('Excel 读取器尚未加载，请刷新网页');
 const result=await excel.readTable(file);return {rows:result.rows,source:file.name+' / '+result.sheet};
 }return {rows:await sample(defaultFile,rawFetch),source:'内置示例数据'};
}
async function fromWorkbook(form,rawFetch){let file=form.get('workbook_file');if(!file?.name)return null;
 const reader=globalThis.PharmaExcel;if(!reader)throw Error('Excel 解析器未加载');
 const result=reader.detect(await reader.readFile(file));
 const fatal=result.diagnostics.filter(x=>x.type==='missing');if(fatal.length)throw Error('Excel 字段校验失败：'+fatal.map(x=>x.sheet+' 缺 '+x.missing.join(',')).join('；'));
 const needed=['po','qc','production','inventory','changes'];let absent=needed.filter(k=>!result.sheets[k]);if(absent.length)throw Error('工作簿缺少必要 Sheet：'+absent.join('、')+'。请使用下载的5表模板。');
 return {files:needed.map(k=>({rows:result.sheets[k],source:file.name+' / '+result.diagnostics.find(x=>x.mapped===k)?.sheet})),diagnostics:result.diagnostics};
}
async function fromSourcingWorkbook(form){const file=form.get('sourcing_workbook_file');if(!file?.name)return null;const reader=globalThis.PharmaExcel;if(!reader)throw Error('Excel 解析器未加载');const parsed=reader.detect(await reader.readFile(file));const fatal=parsed.diagnostics.filter(x=>x.type==='missing');if(fatal.length)throw Error('寻源工作簿缺少列: '+fatal.map(x=>x.missing.join(',')).join(';'));const req=['suppliers','quotes','documents'];const missing=req.filter(x=>!parsed.sheets[x]);if(missing.length)throw Error('寻源工作簿缺少 '+missing.join(',')+' Sheet');return {files:req.map(k=>({rows:parsed.sheets[k],source:file.name+' / '+parsed.diagnostics.find(x=>x.mapped===k).sheet})),diagnostics:parsed.diagnostics};}
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const formVal=(f,k,d)=>String(f.get(k)||d);
export async function handleApi(url,init={},rawFetch){try{
 const p=url.pathname,method=(init.method||'GET').toUpperCase(),q=url.searchParams;
 if(method==='GET'&&p==='/api/scenario/master')return response(activeScenario?makeScenario(activeScenario,{source:scenarioMeta.source}):null);
 if(method==='GET'&&p==='/api/scenario/status')return response({active:!!activeScenario,scenario:scenarioMeta});
 if(method==='GET'&&p==='/api/v08')return response(enterpriseAnalysis(Object.fromEntries(['month','supplier','material','site','year','category','supplier_class'].map(k=>[k,q.get(k)||'']))));
 if(method==='GET'&&p==='/api/health')return response({ok:true,version:'0.7-public-static',engine:'Browser-based deterministic analytics · no server sleep',gxp_validated:false});
 if(method==='GET'&&p==='/api/suite')return response(suiteAnalysis(Object.fromEntries(['month','supplier','material','site','year','category','supplier_class'].map(k=>[k,q.get(k)||'']))));
 if(method==='GET'&&p==='/api/catalog')return response({rules:regulatory.rules,markets:regulatory.markets,note:'候选文件要求；须由 QA/RA 人工审核。'});
 if(method==='GET'&&p==='/api/home/summary'){
  const [po,qc,production,inventory,changes,suppliers]=await Promise.all(['purchase_orders.csv','qc_lots.csv','production.csv','inventory.csv','change_controls.csv','suppliers.csv'].map(f=>sample(f,rawFetch)));
  return response(executiveSummary(activeScenario?{...activeScenario,suppliers}: {po,qc,production,inventory,changes,suppliers},{month:q.get('month'),supplier:q.get('supplier'),material:q.get('material')}));
 }
 if(method==='GET'&&p==='/api/kpi/demo'&&activeScenario){return response(kpiAnalyze(activeScenario,{sources:Object.fromEntries(['po','qc','production','inventory','change_control'].map(k=>[k,scenarioMeta.source]))}));}
 if(method==='GET'&&p==='/api/kpi/demo'){
  const [po,qc,production,inventory,changes]=await Promise.all(['purchase_orders.csv','qc_lots.csv','production.csv','inventory.csv','change_controls.csv'].map(f=>sample(f,rawFetch)));
  return response(kpiAnalyze({po,qc,production,inventory,changes},{sources:Object.fromEntries(['po','qc','production','inventory','change_control'].map(k=>[k,'内置示例数据']))}));
 }
 if(method==='POST'){
  if(p==='/api/lineage/module'||p==='/api/lineage/module/workbook.xlsx'){
   const body=typeof init.body==='string'?JSON.parse(init.body):{};
   const mod=await import('./browser_module_trace_v2939.mjs');
   return mod.handleStaticLineage(p,body,url,rawFetch);
  }
  if(p==='/api/scenario/reset'){clearScenario();return response({ok:true,active:false});}
  const form=init.body;if(!(form instanceof FormData))throw Error('请求缺少 FormData');
  if(p==='/api/documents/inspect'){let f=form.get('pdf_file');if(!f?.name)throw Error('未选择 PDF');if(!globalThis.PharmaPDF)throw Error('PDF 文本解析器未就绪');const r=await globalThis.PharmaPDF.inspect(f);delete r.text;return response(r);}
  if(p==='/api/checklist'){
   const d=await uploaded(form,'docs_file','supplier_documents.csv',rawFetch),rows=checklist({supplier_id:formVal(form,'supplier_id','SUP-001'),material_type:formVal(form,'material_type','chemical'),scenario:formVal(form,'scenario','new'),markets:formVal(form,'markets','US,EU'),docs:d.rows});
   return response({rows,source:d.source,summary:{total:rows.length,missing:rows.filter(x=>x.status==='Missing').length,review:rows.filter(x=>x.status==='Under review').length,expired:rows.filter(x=>x.status==='Expired').length},note:'Demo 规则；需 QA/RA 审核。'});
  }
  if(p==='/api/kpi/analyze'){
   const workbook=await fromWorkbook(form,rawFetch);const files=workbook?.files||await Promise.all([uploaded(form,'po_file','purchase_orders.csv',rawFetch),uploaded(form,'qc_file','qc_lots.csv',rawFetch),uploaded(form,'production_file','production.csv',rawFetch),uploaded(form,'inventory_file','inventory.csv',rawFetch),uploaded(form,'change_file','change_controls.csv',rawFetch)]);
   const [po,qc,production,inventory,changes]=files.map(x=>x.rows),sources=Object.fromEntries(['po','qc','production','inventory','change_control'].map((k,i)=>[k,files[i].source]));
   const input={po,qc,production,inventory,changes};const quality=validateKpiInput(input);if(!quality.ok)throw Error('数据校验失败：'+quality.errors.slice(0,5).join('；'));const result=kpiAnalyze(input,{sources});result.data_quality=quality;result.ai=aiDisabled;if(workbook){applyScenario(input,{source:form.get('workbook_file').name});result.shared_scenario=getScenarioMeta();}
   result.validation={mode:workbook?'complete_workbook':'individual_files',diagnostics:workbook?.diagnostics||[],source_count:Object.values(sources).filter(x=>!x.includes('内置示例')).length};return response(result);
  }
  if(p==='/api/sourcing/analyze'){
   const sourceWorkbook=await fromSourcingWorkbook(form);const [sup,quotes,docs]=sourceWorkbook?.files||await Promise.all([uploaded(form,'suppliers_file','suppliers.csv',rawFetch),uploaded(form,'quotes_file','quotes.csv',rawFetch),uploaded(form,'docs_file','supplier_documents.csv',rawFetch)]);
   const result=sourcingAnalyze({suppliers:sup.rows,quotes:quotes.rows,documents:docs.rows},{material_id:formVal(form,'material_id','API-001'),quantity:formVal(form,'quantity','1000'),markets:formVal(form,'markets','US,EU'),material_type:formVal(form,'material_type','chemical'),scenario:formVal(form,'scenario','new'),weights:formVal(form,'weights','{"price":35,"quality":30,"delivery":20,"risk":15}'),sources:{suppliers:sup.source,quotes:quotes.source,documents:docs.source}});
   result.ai=aiDisabled;result.validation=sourceWorkbook?{mode:'complete_sourcing_workbook',diagnostics:sourceWorkbook.diagnostics}:null;return response(result);
  }
 }
 return response({detail:'Route not found'},404);
 }catch(e){console.error('Browser analytics:',e);return response({detail:String(e.message||e)},422)}
}
