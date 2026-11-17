/** Bolt-native server for the existing V0.5 HTML/CSS/JS client.
 * Runs directly in Node 20+, without Python/FastAPI.
 * Real CSV/XLSX datasets are recalculated; no hardcoded KPI fixture responses.
 * No automated GxP approvals, autonomous supplier orders, real-time ERP data.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import {SourcingRegistry,SOURCES,ERP_MAP} from './sourcing_registry.mjs';
import {EnterpriseConnectorStore} from './enterprise_connector_v2923.mjs';
import {pageMetricCoverage,allPageCoverage} from './page_metric_manifest_v2923.mjs';
import {buildReleasedDashboard} from './enterprise_dashboard_v2925.mjs';
import {DOMAIN_METRICS,DOMAIN_NAMES,exportDomainEvidenceWorkbook} from './enterprise_evidence_v2926.mjs';
import {sourcingFacts} from './sourcing_domain_v2921.mjs';
import {METRICS,metricReport,listMetricDefinitions,exportMetricWorkbook} from './metric_registry_v2921.mjs';
import {buildModuleTrace,exportModuleTraceWorkbook} from './module_traceability_v2928.mjs';
import {auditPublishedDashboard} from './component_reconciliation_v2930.mjs';
import {buildChangeWorkbench,exportChangeWorkbook} from './change_control_v2931.mjs';
import {buildDecisionDataset,buildDecisionEvidence,buildDecisionModule} from './decision_center_v2935.mjs';
import {exportDecisionModuleWorkbook} from './decision_center_workbook_v2935.mjs';
import {ACTIONS,actionReport,listActionDefinitions} from './analysis_rules_v2922.mjs';
import {EdqmCatalog,EDQM_SOURCE} from './edqm_cep_v2922.mjs';
import {ComplianceStore,identifyRole} from './compliance_workflow.mjs';
import {exportComplianceWorkbook} from './compliance_formula_v2920.mjs';
import {overview as simOverview,list as simList,validateAll as simValidate,mutate as simMutate,fileFor as simFileFor,rowsFor as simRowsFor,DATA_DIR as SIM_DATA_DIR,TABLES as SIM_TABLES,ALL_SOURCE_TABLES as SIM_ALL_SOURCE_TABLES,AUXILIARY_KEYS as SIM_AUXILIARY_KEYS} from './sim_data_center_v2941.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {kpiAnalyze,sourcingAnalyze,checklist,regulatory,aiDisabled} from './calculations.mjs';
import {buildExecutionDataset,browserDataSource,exportExecutionWorkbook,PAGE_IDS} from './procurement_execution_v2937.mjs';
import {executiveSummary} from './executive.mjs';
import {suiteAnalysis} from './suite.mjs';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {getCostTrace,exportCostWorkbook,exportMetricCatalogWorkbook,exportProjectWorkbook,exportPerformanceWorkbook} from './formula_workbook.mjs';
import {parseUploadedWorkbook} from './workbook_node.mjs';
import {validateKpiInput} from './v10_validation.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const sourcingRegistry=new SourcingRegistry();
const enterpriseConnector=new EnterpriseConnectorStore();
const edqmCatalog=new EdqmCatalog();
const edqmSignal=(r,importAt)=>{
 const hash=crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex');
 return {id:'EDQM_CEP:'+r.cep_number.replace(/[^\w-]/g,'_').slice(0,80),type:'cep_evidence',provider:'EDQM_CEP_EXPORT',source_url:EDQM_SOURCE,source_info:EDQM_SOURCE,observed_at:importAt,source_updated_at:r.issue_date,source_record_id:r.cep_number,company_unverified:r.holder,material_unverified:r.substance,status_text:r.status,reason:'EDQM 公共导出目录的证书状态；需 QA/RA 核对持证人、厂址及目标市场，不自动批准。',priority:/WITHDRAWN|SUSPENDED|EXPIRED|NOT_FOUND/i.test(r.status)?95:50,review_status:'PENDING',verified_supplier_id:null,verified_site_id:null,verified_material_id:null,approved_for_purchase:false,gmp_approved:false,cep_approved:false,asl_approved:false,source_hash:hash,data_origin:'EDQM_CEP_PUBLIC_RECORD_UNQUALIFIED',evidence_excerpt:JSON.stringify(r).slice(0,1200)};
};
function recheckEdqmPublishedSignals(){
 let updated=0,missing=0;
 for(const old of sourcingRegistry.data.signals.filter(x=>x.provider==='EDQM_CEP_EXPORT')){
  const r=edqmCatalog.get(old.source_record_id)||{cep_number:old.source_record_id,holder:old.company_unverified,substance:old.material_unverified,status:'NOT_FOUND_IN_CURRENT_EXPORT',issue_date:''};
  const next=edqmSignal(r,edqmCatalog.data?.imported_at);
  if(old.source_hash!==next.source_hash){sourcingRegistry.upsert(next);updated++;if(r.status==='NOT_FOUND_IN_CURRENT_EXPORT')missing++}
 }
 if(updated){sourcingRegistry.audit('EDQM_CEP_MONITORED_RECORD_CHANGED','scheduled-ingest',{updated,missing,review_reset:true,published_revoked:true});sourcingRegistry.save()}
 return {updated,missing};
}

const complianceStore=new ComplianceStore();
const secure=(req)=>{const token=process.env.SOURCING_ADMIN_TOKEN;if(!token||token.length<16)return false;const got=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(got.length!==token.length)return false;return crypto.timingSafeEqual(Buffer.from(got),Buffer.from(token))};
async function requestJSON(req,limit=1024*1024){let size=0,chunks=[];for await(const part of req){size+=part.length;if(size>limit)throw Error('JSON exceeds limit');chunks.push(part)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}

const PORT=Number(process.env.PORT||3000), MAX=12*1024*1024;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const reject=(res,code,detail)=>send(res,code,{detail});
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
function parseCSV(text){
 text=text.replace(/^\ufeff/,'');let rows=[],current=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){let ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(!quoted&&ch===','){current.push(cell);cell=''}else if(!quoted&&(ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;current.push(cell);cell='';if(current.some(c=>c.trim()))rows.push(current);current=[]}else cell+=ch}
 if(quoted)throw new Error('CSV 字段引号未闭合');current.push(cell);if(current.some(c=>c.trim()))rows.push(current);
 if(!rows.length)throw new Error('空 CSV 文件');let headers=rows.shift().map(x=>x.trim().toLowerCase().replace(/\s+/g,'_'));
 return rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,(row[i]??'').trim()])));
}
async function readRows(buffer,name){
 if(buffer.length>MAX)throw new Error('单文件超过 12MB 大小限制');let ext=path.extname(name.toLowerCase());
 if(ext==='.csv')return parseCSV(buffer.toString('utf8'));
 if(ext==='.xlsx'||ext==='.xlsm'){
  const ExcelJS=(await import('exceljs')).default;
  const w=new ExcelJS.Workbook();await w.xlsx.load(buffer);let sheet=w.worksheets[0];if(!sheet)throw new Error('Excel 没有工作表');
  const cellText=v=>v instanceof Date?v.toISOString().slice(0,10):String(v?.text??v?.result??v??'').trim();
  const headers=sheet.getRow(1).values.slice(1).map(x=>cellText(x).toLowerCase().replace(/\s+/g,'_'));let rows=[];
  sheet.eachRow((row,n)=>{if(n===1)return;let vals=row.values.slice(1);if(!vals.some(x=>x!==null&&x!==undefined&&x!==''))return;
   rows.push(Object.fromEntries(headers.map((h,i)=>[h,cellText(vals[i])]))) });return rows;
 }
 throw new Error('仅支持 CSV、XLSX、XLSM 文件');
}
const sample=async name=>{const sim=path.join(SIM_DATA_DIR,name);const file=process.env.PHARMA_DATA_MODE==='SIMULATED'&&fs.existsSync(sim)?sim:path.join(ROOT,'samples',name);return readRows(fs.readFileSync(file),name);};
async function requestForm(req){let bytes=0;const parts=[];for await(let part of req){bytes+=part.length;if(bytes>MAX*5)throw new Error('上传文件总大小超过限制');parts.push(part)}
 let buf=Buffer.concat(parts);const r=new Request('http://localhost/upload',{method:'POST',headers:{'content-type':req.headers['content-type']||'application/octet-stream'},body:buf});return r.formData()}
async function uploaded(form,field,sampleName){let f=form.get(field);if(f&&typeof f==='object'&&typeof f.arrayBuffer==='function'&&f.name){let b=Buffer.from(await f.arrayBuffer());return {rows:await readRows(b,f.name),source:f.name}}
 return {rows:await sample(sampleName),source:'内置示例数据'} }
async function maybeAI(obj,kind,form){const wants=['1','true','on'].includes(String(form.get('use_ai')||'').toLowerCase());
 if(!wants)return aiDisabled;if(!process.env.OPENAI_API_KEY)return {mode:'rules',text:null,notice:'未配置服务端 OPENAI_API_KEY；保留确定性分析，不发送用户数据。'};
 try{const payload={model:process.env.OPENAI_MODEL||'gpt-4.1-mini',input:[{role:'system',content:[{type:'input_text',text:'你是药企采购分析助手。严格基于传入结构化事实输出简短中文报告。区分事实/假设/证据缺口，不声称 QA 放行、注册批准或真实因果；不造数字。'}]},{role:'user',content:[{type:'input_text',text:kind+'\n'+JSON.stringify(obj).slice(0,11000)}]}],max_output_tokens:650};
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),18000);
  let r;try{r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},body:JSON.stringify(payload),signal:ctrl.signal})}finally{clearTimeout(timer)}
  if(!r.ok)throw new Error('API response '+r.status);const out=await r.json();let s=(out.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();if(!s)throw new Error('Empty LLM output');return {mode:'llm',text:s,notice:'AI 仅提供解释性摘要；KPI 由规则计算。'}
 }catch(e){return {mode:'rules',text:null,notice:'AI 不可用，已退回规则分析（'+String(e.message||e)+'）。'}}
}
async function inspectPDF(form){let file=form.get('pdf_file');if(!file||!file.name||!file.name.toLowerCase().endsWith('.pdf'))throw new Error('请上传可提取文字的 PDF 文件');let data=Buffer.from(await file.arrayBuffer());if(data.length>MAX)throw new Error('PDF 超过 12MB');
 const PDF=(await import('pdf-parse')).default;let pdf=await PDF(data,{max:20});const text=(pdf.text||'').trim();if(!text)return {filename:file.name,pages:pdf.numpages,extractable:false,excerpt:'',keywords:[],date_candidates:[],note:'无法提取文字，可能是扫描件；未提供 OCR。'};
 let words=['certificate of analysis','coa','gmp','manufacturing site','specification','retest','expiry','expiry date','dmf','asmf','cep','quality agreement','nitrosamine'];
 return {filename:file.name,pages:pdf.numpages,extractable:true,excerpt:text.slice(0,2500),keywords:words.filter(x=>text.toLowerCase().includes(x)),date_candidates:[...new Set(text.match(/\b(?:20\d{2}[-/][01]?\d[-/][0-3]?\d|[0-3]?\d[-/][01]?\d[-/]20\d{2})\b/g)||[])].slice(0,12),note:'仅为文本、日期和关键词初步提取，不验证证书真实性、批准状态或法规充分性。'};
}
function serveFile(res,file){if(!fs.existsSync(file)||!fs.statSync(file).isFile())return reject(res,404,'File not found');let ext=path.extname(file).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store, max-age=0','Pragma':'no-cache'});fs.createReadStream(file).pipe(res)}
// Explicit CORS allowlist for a separate production Node API; admin routes still require their own token.
const corsOrigins=new Set(String(process.env.PHARMA_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean));
async function route(req,res){try{
 const origin=req.headers.origin;
 if(origin&&corsOrigins.has(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age','600');
 }
 if(req.method==='OPTIONS'){
  if(!origin||!corsOrigins.has(origin))return res.writeHead(403).end('Origin not allowed');
  return res.writeHead(204).end();
 }
 const u=new URL(req.url,'http://localhost'),p=u.pathname;
 // V2.9.41: simulation data center endpoints; mutations require admin Bearer secret and explicit mode.
 if(p==='/api/sim-data/overview'&&req.method==='GET')return send(res,200,simOverview());
 if(p==='/api/sim-data/audit'&&req.method==='GET')return send(res,200,simValidate());
 // V2.9.48 complete-source pagination: snapshot-pinned, no 800-row DOM substitution.
 // This endpoint only exposes the local synthetic seed, NEVER connected ERP/QA records.
 if(p==='/api/sim-data/complete-page'&&req.method==='GET'){
  if(process.env.PHARMA_DATA_MODE!=='SIMULATED')return reject(res,409,'仅在 SIMULATED 演示数据库模式下开放；非企业全量来源');
  const table=u.searchParams.get('table')||'';
  if(!SIM_ALL_SOURCE_TABLES.includes(table))return reject(res,422,'Unknown simulated source table');
  const scope=Object.fromEntries(['supplier','material','project','month'].map(k=>[k,u.searchParams.get(k)||'']));
  if(Object.values(scope).some(v=>v.length>120||!/^[a-zA-Z0-9._-]*$/.test(v)))return reject(res,422,'Invalid source filter');
  const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||200);
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>500)return reject(res,422,'Invalid page offset/limit');
  const snapshot=crypto.createHash('sha256').update(fs.readFileSync(simFileFor(table))).update(JSON.stringify(scope)).digest('hex');
  const expected=u.searchParams.get('snapshot');
  if(expected&&expected!==snapshot)return reject(res,409,'分页期间源快照发生变化；必须重新从第一页采集');
  const batch=simList(table,{...scope,offset,limit});
  if(offset>batch.total)return reject(res,422,'Offset exceeds source total');
  const primaryKey={suppliers:'supplier_id',materials:'material_id',projects:'project_id',product_lines:'product_line_id',purchase_orders:'po_id',quotes:'quote_id',rfq_alternates:'quote_id',contracts:'contract_id',contract_documents:'contract_document_id',shipment_documents:'shipment_document_id',payment_authorizations:'payment_authorization_id',qc_lots:'lot_id',inventory:'lot_id',production:'production_order',invoices:'invoice_id',payments:'payment_id',claims:'claim_id',claim_settlements:'settlement_id',change_controls:'change_id',exceptions:'exception_id',metric_events:'event_id'}[table]||SIM_AUXILIARY_KEYS[table];
  const ids=batch.rows.map(r=>r[primaryKey]);
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length)return reject(res,409,'源页主键缺失或重复，禁止全量通过');
  const nextOffset=offset+batch.rows.length;
  return send(res,200,{table,source_type:'SIMULATED_LOCAL_CSV_NON_GXP',source_snapshot:snapshot,primary_key:primaryKey,scope,offset,limit,total:batch.total,returned:batch.rows.length,rows:batch.rows,row_ids:ids,has_more:nextOffset<batch.total,next_offset:nextOffset<batch.total?nextOffset:null,full_source_covered:false,coverage_rule:'客户端必须采完所有页、核验源快照相同、行数等于total且主键全局去重后才能声明模拟源全量覆盖'});
 }
 if(p==='/api/sim-data/table'&&req.method==='GET')return send(res,200,simList(u.searchParams.get('table')||'suppliers',Object.fromEntries(u.searchParams.entries())));
 if(p==='/api/sim-data/mutate'&&req.method==='POST'){
  if(!secure(req))return reject(res,403,'修改模拟数据需要SOURCING_ADMIN_TOKEN管理权限');
  return send(res,200,simMutate(await requestJSON(req,3*1024*1024)));
 }
 // V2.9.21: per-metric deterministic lineage, not a generic route-level table.
 const metricScope=()=>({...Object.fromEntries(['supplier','material','year'].map(k=>[k,u.searchParams.get(k)||'all'])),as_of:/^20\d{2}-\d{2}-\d{2}$/.test(u.searchParams.get('as_of')||'')?u.searchParams.get('as_of'):new Date().toISOString().slice(0,10)});
 const enterpriseMode=u.searchParams.get('source')==='enterprise';
 const enterpriseInputs=()=>{if(!secure(req))return {error:403,detail:'企业来源数据需要管理员授权'};if(!enterpriseConnector.data.released)return {error:409,detail:'尚无审核发布的企业数据快照，不能代替真实 ERP/QMS'};if(!enterpriseConnector.verifyRelease())return {error:409,detail:'已发布快照哈希或审计链校验失败，拒绝提供指标或导出'};const d=enterpriseConnector.facts(metricScope());return d?{facts:d}:{error:409,detail:'尚无有效企业来源快照'};};
 // Mandatory V2.9.29 per-module formula, source table and narrative lineage.
 // DOM rows supplied by the browser are labelled UI display, never trusted as
 // original PO/QMS facts. Enterprise source requires valid released snapshot.
 if(req.method==='POST'&&(p==='/api/lineage/module'||p==='/api/lineage/module/workbook.xlsx')){
   const int=enterpriseMode?enterpriseInputs():null;
   if(int?.error)return reject(res,int.error,int.detail);
   const body=await requestJSON(req,6000000);
   try{
     const options={scope:metricScope(),factsOverride:int?.facts||null,published:sourcingRegistry.publishedCandidates()};
     if(p==='/api/lineage/module'){
       const report=buildModuleTrace(body,options);
       // Full source details are visible in the module, not just a generic
       // per-page button. Keep result bounded for browser responsiveness.
       return send(res,200,{...report,metrics:report.metrics.map(m=>({...m,rows:(m.rows||[])}))});
     }
     const bytes=exportModuleTraceWorkbook(body,options);
     res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Module_Lineage_V2929.xlsx"','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
     return res.end(bytes);
   }catch(e){return reject(res,422,'模块计算请求不符合字段或来源约束：'+String(e.message||e).slice(0,300));}
 }
 if(req.method==='GET'&&p==='/api/analysis/definitions')return send(res,200,{version:'2.9.22',actions:listActionDefinitions(),note:'公开的规则分析依据，非内部AI隐含推理或真实事故根因'});
 if(req.method==='GET'&&p==='/api/analysis/detail'){
   const id=String(u.searchParams.get('id')||'');if(id.length>120||!/^[A-Za-z0-9._-]+$/.test(id))return reject(res,422,'Invalid action identifier');
   const int=enterpriseMode?enterpriseInputs():null;if(int?.error)return reject(res,int.error,int.detail);
   const result=actionReport(id,{scope:metricScope(),published:sourcingRegistry.publishedCandidates(),factsOverride:int?.facts});return send(res,200,{...result,rows:result.rows.slice(0,300),total_rows:result.rows.length});
 }
 // Bulk EDQM CEP dataset: administrator uploads a manually downloaded official
 // text export. No speculative EDQM API, no bypass of site access controls.
 if(p==='/api/sourcing/edqm/public'&&req.method==='GET')return send(res,200,{...edqmCatalog.summary(),auto_sync_enabled:process.env.SOURCING_EDQM_AUTO_SYNC==='1'});
 if(p.startsWith('/api/sourcing/edqm/')&&!secure(req))return reject(res,403,'EDQM证据导入/查询要求SOURCING_ADMIN_TOKEN');
 if(p==='/api/sourcing/edqm/sync'&&req.method==='POST'){
   try{const result=await edqmCatalog.syncOfficial({force:true});const rechecked=recheckEdqmPublishedSignals();
    sourcingRegistry.data.sources.EDQM_CEP_EXPORT={status:'OK_HTTPS_EXPORT',fetched_at:result.last_import_at,last_success:result.last_import_at,received:result.record_count,source_url:EDQM_SOURCE,file_sha256:result.file_sha256};
    sourcingRegistry.audit('EDQM_CEP_OFFICIAL_FETCH_SUCCESS','authorized-admin',{count:result.record_count,hash:result.file_sha256,changes:result.latest_changes});sourcingRegistry.save();return send(res,200,{...result,rechecked});
   }catch(e){sourcingRegistry.data.sources.EDQM_CEP_EXPORT={...(sourcingRegistry.data.sources.EDQM_CEP_EXPORT||{}),status:'ERROR',fetched_at:new Date().toISOString(),error:String(e.message||e).slice(0,240)};
    sourcingRegistry.audit('EDQM_CEP_OFFICIAL_FETCH_FAILED','authorized-admin',{error:String(e.message||e).slice(0,240)});sourcingRegistry.save();return reject(res,502,'EDQM 官方文件联网失败：'+String(e.message||e));}
 }
 if(p==='/api/sourcing/edqm/search'&&req.method==='GET')return send(res,200,edqmCatalog.search(u.searchParams.get('q')||'',{offset:u.searchParams.get('offset'),limit:u.searchParams.get('limit')}));
 if(p==='/api/sourcing/edqm/import'&&req.method==='POST'){
   const form=await requestForm(req),f=form.get('file');if(!f||typeof f.arrayBuffer!=='function')return reject(res,422,'请上传 EDQM 导出的 TXT/CSV 文件');
   if(!/\.(txt|csv|tsv)$/i.test(f.name||''))return reject(res,422,'仅接受TXT/CSV/TSV格式');
   if(f.size>30*1024*1024)return reject(res,413,'文件超过30MB上限');
   const result=edqmCatalog.importText(Buffer.from(await f.arrayBuffer()).toString('utf8'),{actor:'authorized-admin',filename:f.name});const rechecked=recheckEdqmPublishedSignals();
   sourcingRegistry.data.sources.EDQM_CEP_EXPORT={status:'IMPORTED_NEEDS_SOURCE_VERIFICATION',fetched_at:result.last_import_at,last_success:null,received:result.record_count,source_url:EDQM_SOURCE,file_sha256:result.file_sha256};
   sourcingRegistry.audit('EDQM_CEP_FILE_IMPORTED','authorized-admin',{count:result.record_count,sha256:result.file_sha256,changes:result.latest_changes});sourcingRegistry.save();return send(res,200,{...result,rechecked});
 }
 if(p==='/api/sourcing/edqm/to-review'&&req.method==='POST'){
   const d=await requestJSON(req),r=edqmCatalog.get(d.cep_number);if(!r)return reject(res,404,'该证书在导入记录中不存在');
   const item=edqmSignal(r,edqmCatalog.data.imported_at);
   const hash=item.source_hash;
   const change=sourcingRegistry.upsert(item);sourcingRegistry.audit('EDQM_CEP_STAGED_REVIEW','authorized-admin',{number:r.cep_number,change,record_hash:hash});sourcingRegistry.save();return send(res,200,{id:item.id,status:'PENDING',change,notice:'已进入审核队列，未授予任何准入资格'});
 }
 // V2.9.25: one versioned, protected aggregate for all 26 pages.
 // A missing/revoked snapshot is an explicit 409, NEVER a DEMO fallback.
 if(req.method==='GET'&&p==='/api/enterprise/dashboard'){
   if(!secure(req))return reject(res,403,'企业看板要求已授权的服务端访问令牌');
   const view=String(u.searchParams.get('route')||'overview');
   if(!/^[a-z0-9-]{1,35}$/.test(view))return reject(res,422,'非法页面路由');
   try{
     const result=buildReleasedDashboard({connector:enterpriseConnector,route:view,scope:metricScope()});
     if(result.status==='NO_RELEASED_ENTERPRISE_SNAPSHOT')return send(res,409,result);
     if(result.status==='RECONCILIATION_FAILED'||result.status==='SNAPSHOT_INTEGRITY_FAILED')return send(res,409,result);
     // Independently recompute chart points from the released PO/QMS rows.
     // A source-chart mismatch fails closed; unbound specialist diagrams remain
     // visible as explicitly unverified, never labelled fully reconciled.
     const strict=auditPublishedDashboard(result,enterpriseConnector.facts(result.scope));
     if(strict.status==='FAILED')return send(res,409,{status:'STRICT_CHART_SOURCE_MISMATCH',strict_reconciliation:strict});
     result.strict_reconciliation=strict;
     res.setHeader('Cache-Control','private, no-store');return send(res,200,result);
   }catch(e){if(String(e.message||'').includes('Unknown dashboard route'))return reject(res,404,'未登记的企业看板页面');throw e}
 }
 // V2.9.26: dedicated, evidence-only source contract and source workbook.
 if(req.method==='GET'&&p==='/api/enterprise/evidence/schema'){
   if(!secure(req))return reject(res,403,'企业证据域定义须经授权查看');
   return send(res,200,{version:'2.9.26',domain_names:DOMAIN_NAMES,metric_definitions:DOMAIN_METRICS,requires:'Stable ID, supplier_id, material_id, site_id, evidence_ref, source date, USD normalized price with upstream FX evidence',notice:'This is a private analytical non-GxP contract. No official qualifications or purchase permissions are conferred.'});
 }
 if(req.method==='GET'&&p==='/api/enterprise/evidence/workbook.xlsx'){
   const int=enterpriseInputs();if(int.error)return reject(res,int.error,int.detail);
   const bytes=exportDomainEvidenceWorkbook(int.facts,metricScope());
   res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Enterprise_Domain_Evidence_V2926.xlsx"','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
 }
 if(req.method==='GET'&&p==='/api/enterprise/reconciliation/strict'){
   const int=enterpriseInputs();if(int.error)return reject(res,int.error,int.detail);
   const {PAGE_METRIC_INDEX}=await import('./page_metric_manifest_v2923.mjs');
   const scope=metricScope(),pages=[];
   for(const route of Object.keys(PAGE_METRIC_INDEX)){
     const view=buildReleasedDashboard({connector:enterpriseConnector,route,scope});
     if(view.status!=='ENTERPRISE_RECONCILED_NON_GXP')return send(res,409,{status:view.status,route});
     const audit=auditPublishedDashboard(view,enterpriseConnector.facts(view.scope));
     pages.push({route,status:audit.status,summary:audit.summary,unverified: audit.metrics.filter(x=>x.status!=='CONTROLLED_SOURCE_RECOMPUTED_NON_GXP').map(x=>x.metric_id),snapshot_id:audit.snapshot_id});
   }
   return send(res,200,{schema:'SITE_WIDE_STRICT_SOURCE_RECON_V2930',snapshot_id:enterpriseConnector.data.released?.snapshot_id,source:'PUBLISHED_CONTROLLED_ENTERPRISE_NON_GXP',pages,failed:pages.filter(x=>x.status==='FAILED').length,partial:pages.filter(x=>x.status==='PARTIAL'||x.summary.metric_unverified).length,complete:false,note:'仅原始受控证据可复核；不把只有规则ID的图表判为完整验收，未纳入企业证据的旧图表仍未覆盖。'});
 }
 if(req.method==='GET'&&p==='/api/enterprise/reconciliation'){
   if(!secure(req))return reject(res,403,'企业来源对账仅向管理员开放');
   const report=[];for(const page of Object.keys((await import('./page_metric_manifest_v2923.mjs')).PAGE_METRIC_INDEX)){
     const d=buildReleasedDashboard({connector:enterpriseConnector,route:page,scope:metricScope()});
     if(d.status!=='ENTERPRISE_RECONCILED_NON_GXP')return send(res,409,{status:d.status,route:page,detail:d.error||'来源不可用或对账失败'});
     report.push({route:page,snapshot_id:d.source.snapshot_id,passed:d.reconciliation.passed,metrics:d.metrics.length,specialist_charts:d.specialist.panels.length,missing_domains:d.specialist.missing.map(x=>x.domain),spend:d.reconciliation.checks.find(x=>x.id==='SPEND_METRIC_RECON')?.actual??null});
   }
   return send(res,200,{status:report.every(x=>x.passed)?'PASS':'FAIL',snapshot_id:enterpriseConnector.data.released?.snapshot_id,pages:report,passed_pages:report.filter(x=>x.passed).length,notes:'All routes use the same released snapshot; missing business domain evidence is marked missing, not assumed zero.'});
 }
 if(req.method==='GET'&&p==='/api/metrics/definitions')return send(res,200,{version:'2.9.31',metrics:listMetricDefinitions(),boundary:'默认V08_DEMO_SAMPLE；source=enterprise要求授权，必须存在审核发布的企业快照'});
 if(req.method==='GET'&&p==='/api/metrics/page'){const page=String(u.searchParams.get('route')||'');return send(res,200,page? pageMetricCoverage(page):{pages:allPageCoverage(),complete:false,note:'逐页已登记映射；不代表每张图都完成审计'});}
 if(req.method==='GET'&&p==='/api/metrics/detail'){
   const id=String(u.searchParams.get('id')||'');if(id.length>120||!/^[A-Za-z0-9._-]+$/.test(id))return reject(res,422,'Invalid metric identifier');
   const scope=metricScope(),int=enterpriseMode?enterpriseInputs():null;if(int?.error)return reject(res,int.error,int.detail);
   const result=metricReport(id,{scope,published:sourcingRegistry.publishedCandidates(),factsOverride:int?.facts});
   // Large lists are sliced in the UI; the full Excel contains all filtered inputs.
   return send(res,200,{...result,rows:result.rows.slice(0,300),total_rows:result.rows.length});
 }
 if(req.method==='GET'&&p==='/api/metrics/workbook.xlsx'){
   const metricIds=u.searchParams.get('id')?[String(u.searchParams.get('id'))]:null;
   if(metricIds&&metricIds[0].length>120)return reject(res,422,'Invalid metric identifier');
   const int=enterpriseMode?enterpriseInputs():null;if(int?.error)return reject(res,int.error,int.detail);
   const bytes=exportMetricWorkbook({scope:metricScope(),metricIds,published:sourcingRegistry.publishedCandidates(),factsOverride:int?.facts});
   res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Metric_Lineage_V2925.xlsx"','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
 }
 if(req.method==='GET'&&p==='/api/sourcing/contract'){
   const int=enterpriseMode?enterpriseInputs():null;if(int?.error)return reject(res,int.error,int.detail);
   const facts=int?.facts||sourcingFacts(enterpriseAnalysis({}),{filters:metricScope(),published:sourcingRegistry.publishedCandidates()});
   return send(res,200,{version:'2.9.22',scope:facts.scope,counts:{candidate_suppliers:new Set(facts.catalog.map(r=>r.supplier_id)).size,po_rows:facts.purchaseOrders.length,quote_rows:facts.quotes.length,qualification_rows:facts.qualifications.length,official_published:facts.published.length},purchaseOrders:facts.purchaseOrders,quotes:facts.quotes,qualifications:facts.qualifications,notes:'Contains V08 DEMO records + clearly separated unqualified published official leads. Scenario has no PO or official approvals.'});
 }
 // Transparent, demo-only calculation lineage. The workbook is generated
 // from the same bundled data and model as the cost UI, never from untrusted
 // client-posted figures. Real Excel formulas, never a CSV renamed .xlsx.
 if(req.method==='GET'&&(p==='/api/formulas/project.xlsx'||p==='/api/formulas/performance.xlsx')){
   const bytes=p.includes('project')?exportProjectWorkbook({material:u.searchParams.get('material')||'API-001'}):exportPerformanceWorkbook({view:u.searchParams.get('view')||'rd'});
   res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Sourcing_Traceability_V2919.xlsx"','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
 }
 if(req.method==='GET'&&p==='/api/formulas/cost.xlsx'){
   const bytes=exportCostWorkbook({material:u.searchParams.get('material')||'API-001',year:u.searchParams.get('year')||'2026'});
   res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Cost_Formula_Trace_V2918.xlsx"','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
 }
 if(req.method==='GET'&&p==='/api/formulas/catalog.xlsx'){
   const bytes=exportMetricCatalogWorkbook();res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Metric_Formula_Catalog_V2918.xlsx"','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
 }
 if(req.method==='GET'&&p==='/api/formulas/cost'){
   const {material,year,model,computed,opportunities}=getCostTrace({material:u.searchParams.get('material')||'API-001',year:u.searchParams.get('year')||'2026'});
   return send(res,200,{material,year,computed,assumptions:opportunities,source:'V08_DEMO / GENERATED_DEMO_ONLY',quote_count:model.candidates.length,po_count:model.po.length,notice:'目标价若无正式BOM为PO加权基准代理；降本百分比为尚未验证的情景假设，Excel 公式允许逐项核查。'});
 }

 if(req.method==='GET'&&p==='/api/formulas/compliance.xlsx'){
   const user=identifyRole(req.headers.authorization);
   if(req.headers.authorization&&!user)return reject(res,403,'无效的合规导出授权');
   if(user)complianceStore.logExport({action:'export',target:'compliance-formula-workbook',note:'受控指标工作簿导出'},user);
   // Unauthenticated report intentionally contains DEMO only, never private server records.
   const bytes=exportComplianceWorkbook({managedDocuments:user?complianceStore.listDocuments():[],managedTasks:user?complianceStore.listTasks():[]});
   res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Compliance_Formula_V2920.xlsx"','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
 }
 // Enterprise API connector: private, controlled staging -> review -> analytical release.
 if(p.startsWith('/api/integrations/enterprise/')){
  if(!secure(req))return reject(res,403,'企业来源接口要求管理员授权和独立的企业API密钥');
  if(req.method==='GET'&&p==='/api/integrations/enterprise/status')return send(res,200,{...enterpriseConnector.summary(),boundary:'分析快照发布并不构成GxP验证、QA放行或ERP订单冻结'});
  if(req.method==='POST'&&p==='/api/integrations/enterprise/pull'){
   try{return send(res,200,await enterpriseConnector.pull())}catch(err){return reject(res,502,'企业API同步未成功：'+String(err.message||err))}
  }
  if(req.method==='POST'&&p==='/api/integrations/enterprise/stage'){
   const data=await requestJSON(req,4*1024*1024);return send(res,200,enterpriseConnector.stage({po:data.purchase_orders||[],qms:data.qms_events||[],domains:data.enterprise_domains||data.domains||{},origin:'CONTROLLED_ADMIN_SUBMISSION'}));
  }
  if(req.method==='POST'&&p==='/api/integrations/enterprise/release'){const data=await requestJSON(req);return send(res,200,enterpriseConnector.release({snapshot_id:data.snapshot_id,reviewer:data.reviewer,reason:data.reason}));}
  if(req.method==='POST'&&p==='/api/integrations/enterprise/revoke'){const data=await requestJSON(req);return send(res,200,enterpriseConnector.revoke(data));}
 }
 if(req.method==='POST'&&p==='/api/integrations/official/probe'){
  if(!secure(req))return reject(res,403,'官方网络探测需管理员授权');
  const data=await requestJSON(req);const selected=Array.isArray(data.providers)&&data.providers.length?data.providers:['FDA_DRUG_RECALLS','FDA_DRUG_SHORTAGES'];
  if(selected.length>3||selected.some(x=>!SOURCES[x]))return reject(res,422,'只允许指定的FDA官方接口');
  const start=new Date().toISOString();const result=await sourcingRegistry.sync({force:true,providers:selected,include_sites:false});
  const tested=Object.fromEntries(selected.map(x=>[x,result.sources[x]||{status:'NOT_ATTEMPTED'}]));
  return send(res,200,{tested_at:start,results:tested,live_success:selected.some(x=>tested[x]?.status==='OK'),note:'以真实HTTPS请求结果为准；任何ERROR都不可标记为在线采集成功'});
 }
 // Role-bound prototype compliance API; no automatic GMP signatures or ERP/ASL write.
 if(p==='/api/compliance/public'&&req.method==='GET')return send(res,200,{available:true,version:'2.9.16',role_auth_required:true,notice:'需要服务端配置 COMPLIANCE_ROLE_TOKENS_JSON；未验证的静态预览为只读。'});
 if(p.startsWith('/api/compliance/')){
   const user=identifyRole(req.headers.authorization);if(!user)return reject(res,403,'合规操作需要已配置的服务端角色令牌。未授权不能读写审计和供应商档案。');
   const reply=(data)=>send(res,200,data);
   try{
     if(p==='/api/compliance/workflow'&&req.method==='GET')return reply({summary:complianceStore.overview(),documents:complianceStore.listDocuments(),tasks:complianceStore.listTasks(),role:user.role,actor:user.actor});
     if(p==='/api/compliance/workflow/documents'&&req.method==='POST')return reply(complianceStore.createDocument(await requestJSON(req),user));
     const actDoc=p.match(/^\/api\/compliance\/workflow\/documents\/([\w-]{36})\/action$/);
     if(actDoc&&req.method==='POST'){const d=await requestJSON(req);return reply(complianceStore.actDocument(actDoc[1],String(d.action||''),d,user));}
     const up=p.match(/^\/api\/compliance\/workflow\/documents\/([\w-]{36})\/attachment$/);
     if(up&&req.method==='POST'){const form=await requestForm(req);const f=form.get('attachment');if(!f||typeof f.arrayBuffer!=='function')return reject(res,400,'请提供附件');const data=Buffer.from(await f.arrayBuffer());return reply(complianceStore.saveAttachment(up[1],f.name||'attachment.pdf',data,user));}
     const down=p.match(/^\/api\/compliance\/workflow\/attachments\/([\w-]{36})$/);
     if(down&&req.method==='GET'){const file=complianceStore.getAttachment(down[1],user);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="evidence-${down[1]}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(file.bytes);}
     if(p==='/api/compliance/workflow/tasks'&&req.method==='POST')return reply(complianceStore.createTask(await requestJSON(req),user));
     const at=p.match(/^\/api\/compliance\/workflow\/tasks\/([\w-]{36})\/action$/);if(at&&req.method==='POST'){const d=await requestJSON(req);return reply(complianceStore.actTask(at[1],String(d.action||''),d,user));}
     if(p==='/api/compliance/workflow/dossiers'&&req.method==='GET')return reply({items:complianceStore.data.dossiers});
     const doUp=p.match(/^\/api\/compliance\/workflow\/dossiers\/([\w-]{2,50})$/);if(doUp&&req.method==='PUT')return reply(complianceStore.putDossier(doUp[1],await requestJSON(req),user));
     if(p==='/api/compliance/workflow/audit'&&req.method==='GET')return reply(complianceStore.listAudit(Object.fromEntries(u.searchParams.entries())));
     if(p==='/api/compliance/workflow/precheck'&&req.method==='POST')return reply(complianceStore.precheck(await requestJSON(req)));
     if(p==='/api/compliance/workflow/export'&&req.method==='POST')return reply(complianceStore.logExport(await requestJSON(req),user));
     if(p==='/api/compliance/workflow/regulatory'&&req.method==='GET'){const signals=sourcingRegistry.allSignals().filter(x=>/FDA|EMA|EDQM|NMPA/i.test(String(x.provider||x.source||''))).slice(0,100);return reply({items:signals,coverage_note:'仅已连接的官方来源线索；短缺、召回线索不能视为法规公告，EMA/EDQM/NMPA法规公告尚未联网。'});}
     if(p==='/api/compliance/workflow/escalations'&&req.method==='GET')return reply({notifications:Object.values(complianceStore.data.notifications||{})});
     if(p==='/api/compliance/workflow/escalations/scan'&&req.method==='POST'){if(user.role!=='admin')return reject(res,403,'仅管理员可执行风险升级扫描');return reply(complianceStore.scanEscalations());}
     if(p==='/api/compliance/workflow/market-rules'&&req.method==='GET')return reply(complianceStore.overview().rules);
     return reject(res,404,'Unknown compliance API');
   }catch(e){return reject(res,400,String(e.message||e))}
 }
 if(p==='/api/sourcing/registry/schema'&&req.method==='GET')return send(res,200,{sources:SOURCES,erp_maps:ERP_MAP,approval_policy:'manual QA/RA review; evidence ingestion never grants ASL/GMP/CEP',top10_policy:'Top 10 by importance; rest expandable',official_discovery:'FDA NDC is labeler-submitted, not API manufacturer or FDA approval; website watchers require server HTTPS allowlist'});
 if(p==='/api/sourcing/registry/public'&&req.method==='GET'){const summary=sourcingRegistry.getSummary();return send(res,200,{last_run:summary.last_run,sources:summary.sources,total_signals:summary.total_signals,pending_review:summary.pending_review,discovery_count:summary.discovery_count,company_site_count:summary.company_sites.length,search_terms_count:summary.search_terms.length,auto_sync_enabled:sourcingRegistry.getConfig().auto_sync_enabled,notice:summary.notice})}
 // Public, read-only OFFICIAL discovery preview. Never expose internal supplier links,
 // audit notes, ERP staging or a sensitive supplier master ID via this endpoint.
 if(p==='/api/sourcing/registry/public/discovery'&&req.method==='GET'){
  const all=sourcingRegistry.allSignals().filter(x=>x.type==='discovery'||x.type==='company_watch');
  const items=all.slice(0,10).map(x=>({provider:x.provider||x.type,company:String(x.company_unverified||'').slice(0,120),material:String(x.material_unverified||'').slice(0,120),status:String(x.status_text||'未核验').slice(0,100),source_url:/^https:\/\/[^\s]+$/.test(String(x.source_url||''))?x.source_url:null,observed_at:x.observed_at||null}));
  return send(res,200,{total:all.length,items,remaining:Math.max(0,all.length-items.length),notice:'PUBLIC_UNVERIFIED_DISCOVERY_ONLY; never used as GMP/CEP/ASL or purchase approval'});
 }
 if(p==='/api/sourcing/registry/public/published'&&req.method==='GET'){const items=sourcingRegistry.publishedCandidates();return send(res,200,{version:'2.9.22',total:items.length,items,notice:'Reviewed company/site/material linkage, NOT GMP/CEP/ASL approval; no purchase authorization'});}
 if(p.startsWith('/api/sourcing/registry')&& !secure(req))return reject(res,403,'未授权：需配置服务端 SOURCING_ADMIN_TOKEN（至少16位），并使用 Bearer 令牌。');
 if(p==='/api/sourcing/registry'&&req.method==='GET')return send(res,200,sourcingRegistry.getSummary());
 if(p==='/api/sourcing/registry/all'&&req.method==='GET')return send(res,200,{signals:sourcingRegistry.allSignals(),erp_staging:sourcingRegistry.data.erp_staging,audit:sourcingRegistry.data.audit});
 if(p==='/api/sourcing/registry/config'&&req.method==='GET')return send(res,200,sourcingRegistry.getConfig());
 if(p==='/api/sourcing/registry/config/autosync'&&req.method==='POST'){
  const d=await requestJSON(req),result=sourcingRegistry.setAutoSync(d.enabled,{actor:'authorized-admin'});
  if(result.auto_sync_enabled)void sourcingRegistry.sync().catch(e=>console.error('[Official sync]',e.message));
  return send(res,200,{...result,notice:result.auto_sync_enabled?'后台同步已启动；官网/检索词为空时相应数据源仍显示未配置':'后台自动采集已关闭'});
 }
 if(p==='/api/sourcing/registry/config/terms'&&req.method==='POST'){const d=await requestJSON(req);return send(res,200,sourcingRegistry.setTerms(d.terms,{actor:d.actor||'authorized-admin'}))}
 if(p==='/api/sourcing/registry/config/sites'&&req.method==='POST'){const d=await requestJSON(req);return send(res,200,sourcingRegistry.addCompanySite({name:d.name,url:d.url,actor:d.actor||'authorized-admin'}))}
 if(p==='/api/sourcing/registry/config/sites'&&req.method==='DELETE'){const d=await requestJSON(req);return send(res,200,sourcingRegistry.removeCompanySite({id:d.id,actor:d.actor||'authorized-admin'}))}
 if(p==='/api/sourcing/registry/leads'&&req.method==='GET')return send(res,200,{items:sourcingRegistry.verifiedLeads(),qualification_notice:'Only source/entity linkage reviewed. Never grants purchase/GMP/CEP/ASL approval.'});
 if(p==='/api/sourcing/registry/audit'&&req.method==='GET'){const offset=Math.max(0,Number(u.searchParams.get('offset')||0)||0),limit=Math.min(100,Math.max(1,Number(u.searchParams.get('limit')||10)||10));const rows=[...sourcingRegistry.data.audit].reverse();return send(res,200,{total:rows.length,items:rows.slice(offset,offset+limit),offset,limit})}
 if(p==='/api/sourcing/registry/signals'&&req.method==='GET'){
  const offset=Math.min(100000,Math.max(0,Number(u.searchParams.get('offset')||0)||0)),limit=Math.min(100,Math.max(1,Number(u.searchParams.get('limit')||10)||10));
  const filter=u.searchParams.get('review_status')||'',provider=u.searchParams.get('provider')||'',query=(u.searchParams.get('q')||'').toLowerCase().slice(0,100);
  const all=sourcingRegistry.allSignals().filter(x=>(!filter||x.review_status===filter)&&(!provider||x.provider===provider)&&(!query||[x.company_unverified,x.material_unverified,x.source_record_id].some(v=>String(v||'').toLowerCase().includes(query))));
  return send(res,200,{total:all.length,offset,limit,items:all.slice(offset,offset+limit),remaining:Math.max(0,all.length-offset-limit),sort:'priority DESC, observed_at DESC',qualification_notice:'未审核的官方信息仅为线索，不可直接参与正式采购准入或GMP/CEP/ASL判定'});
 }

 if(p==='/api/sourcing/registry/sync'&&req.method==='POST')return send(res,200,await sourcingRegistry.sync(await requestJSON(req)));
 if(p==='/api/sourcing/registry/review'&&req.method==='POST')return send(res,200,sourcingRegistry.review(await requestJSON(req)));
 if(p==='/api/sourcing/registry/publish'&&req.method==='POST'){const d=await requestJSON(req);return send(res,200,sourcingRegistry.publishLead({id:d.id,action:d.action,actor:'authorized-admin'}));}
 if(p==='/api/sourcing/registry/erp'&&req.method==='POST'){const data=await requestJSON(req);return send(res,200,sourcingRegistry.stageERP(data.rows,{adapter:data.adapter,actor:data.actor}))}
 // V2.9.37: nine procurement-execution prototype pages, sourced from the
 // SAME built-in PO/quote/QC/change fixtures as the rest of this website.
 // This read-model does NOT turn prototype transactions into real ERP records.
 if(req.method==='GET'&&p.startsWith('/api/procurement-execution/')){
   if(p==='/api/procurement-execution/site-data.js'){
     const payload=JSON.stringify(browserDataSource()).replace(/</g,'\\u003c');
     res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
     return res.end('window.APP_DATA = '+payload+';');
   }
   const page=u.searchParams.get('page')||'orders';if(!PAGE_IDS.includes(page))return reject(res,422,'Unknown execution page');
   const q={page};for(const key of ['supplier','material','month','project','module']){
     const v=u.searchParams.get(key)||'all';if(v.length>120||!/^[a-zA-Z0-9._-]+$/.test(v))return reject(res,422,'Invalid execution query');q[key]=v;
   }
   if(p==='/api/procurement-execution/dataset'){
     const data=buildExecutionDataset(q);return send(res,200,{page:data.page,scope:data.scope,rows:data.rows,row_count:data.row_count,options:data.options,source:data.source,available_metrics:data.available_metrics,metric_definitions:data.pages.find(x=>x.id===data.page)?.metrics});
   }
   if(p==='/api/procurement-execution/workbook.xlsx'){
     const bytes=await exportExecutionWorkbook(q);
     res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':`attachment; filename="Pharma_Execution_${page}_${q.module}_Formula_V2937.xlsx"`,'Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
     return res.end(bytes);
   }
   return reject(res,404,'Unknown procurement execution endpoint');
 }
 // V2.9.31: dedicated, source-bound change-control workbench and recalculable Excel.
 // No fabricated QMS electronic approvals or official market authorization.
 // V2.9.35: five-page decision center, recalculated against the site's shared
 // current source. Enterprise source requires a valid released snapshot and token.
 if(req.method==='GET'&&p.startsWith('/api/decision-center/')){
   const allowed=new Set(['/api/decision-center/dataset','/api/decision-center/evidence','/api/decision-center/module','/api/decision-center/workbook.xlsx','/api/decision-center/report.csv']);
   if(!allowed.has(p))return reject(res,404,'Unknown decision endpoint');
   const q=Object.fromEntries(['month','supplier','material','project','source','as_of','metric','kind','id'].map(k=>[k,u.searchParams.get(k)||(['month','supplier','material','project'].includes(k)?'all':'')]));
   if(['month','supplier','material','project','source','as_of','metric','kind','id'].some(k=>q[k].length>120))return reject(res,422,'筛选字段过长');
   if(q.source&&q.source!=='demo'&&q.source!=='enterprise')return reject(res,422,'Unknown source');
   let options={};
   if(q.source==='enterprise'){
     if(!secure(req))return reject(res,403,'企业指标须通过管理员Bearer Token授权访问');
     if(!enterpriseConnector.verifyRelease())return reject(res,409,'企业受控数据未发布或审计链不完整；不得回退 DEMO');
     const facts=enterpriseConnector.facts({supplier:q.supplier,material:q.material});
     if(!facts)return reject(res,409,'没有受控企业来源数据');
     options={enterpriseFacts:facts};
   }
   try{
     if(p==='/api/decision-center/dataset')return send(res,200,buildDecisionDataset(q,options));
     if(p==='/api/decision-center/evidence'){
       const evidence=buildDecisionEvidence(q,options);
       return evidence?send(res,200,evidence):reject(res,404,'No KPI definition');
     }
     if(p==='/api/decision-center/module'){
       const report=buildDecisionModule(q,options);
       return report?send(res,200,report):reject(res,404,'Unknown decision module');
     }
     if(p==='/api/decision-center/workbook.xlsx'){
       const kind=q.kind||'page',id=q.id||'01';
       if(!['metric','group','analysis','rule','action','source','dictionary','page','signal'].includes(kind)||!(/^[a-zA-Z0-9-]{1,42}$/.test(id)))return reject(res,422,'Invalid module or ID');
       const bytes=await exportDecisionModuleWorkbook({...q,kind,id},options);
       res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Decision_Center_Formula_Source_V2935.xlsx"','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
       return res.end(bytes);
     }
     if(p==='/api/decision-center/report.csv'){
       const report=buildDecisionDataset(q,options);const cols=['id','group','name','value','unit','source','owner','status','formula','required_fields','missing_reason','analysis_steps'];
       const e=v=>'"'+String(v??'').replaceAll('"','""')+'"';
       const csv='\uFEFF'+[cols.map(e).join(','),...report.metrics.map(m=>cols.map(k=>e(m[k])).join(','))].join('\r\n');
       res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Procurement_Decision_Center_KPI_Formula_V2935.csv"','Cache-Control':'no-store'});return res.end(csv);
     }
   }catch(e){return reject(res,422,'决策中心计算或导出失败：'+String(e.message||e).slice(0,260));}
 }
 if(req.method==='GET'&&(p==='/api/change-control/workbench'||p==='/api/change-control/workbench.xlsx')){
   const report=buildChangeWorkbench(Object.fromEntries(['supplier','material','month','change_type','status','scope','role'].map(k=>[k,u.searchParams.get(k)||'all'])));
   if(p.endsWith('.xlsx')){
     const bytes=Buffer.from(await exportChangeWorkbook(report,{poOnly:u.searchParams.get('po_only')==='1',module:u.searchParams.get('module')||''}));
     res.writeHead(200,{'Content-Type':MIME['.xlsx'],'Content-Disposition':'attachment; filename="Pharma_Change_Control_RA_Formula_V2931.xlsx"','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
     return res.end(bytes);
   }
   return send(res,200,report);
 }
 if(p==='/api/v08'&&req.method==='GET')return send(res,200,enterpriseAnalysis(Object.fromEntries(['month','supplier','material','site'].map(k=>[k,u.searchParams.get(k)||'']))));
 if(p==='/api/suite'&&req.method==='GET')return send(res,200,suiteAnalysis(Object.fromEntries(['month','supplier','material','site'].map(k=>[k,u.searchParams.get(k)||'']))));
 if(p==='/api/health'&&req.method==='GET')return send(res,200,{ok:true,engine:process.env.OPENAI_API_KEY?'Node rules + optional AI':'Node.js rules-based analysis',version:'2.9.31',gxp_validated:false});
 if(p==='/api/home/summary'&&req.method==='GET'){
  const [po,qc,production,inventory,changes,suppliers]=await Promise.all(['purchase_orders.csv','qc_lots.csv','production.csv','inventory.csv','change_controls.csv','suppliers.csv'].map(sample));
  return send(res,200,executiveSummary({po,qc,production,inventory,changes,suppliers},{month:u.searchParams.get('month'),supplier:u.searchParams.get('supplier'),material:u.searchParams.get('material')}));
 }
 if(p==='/api/catalog'&&req.method==='GET')return send(res,200,{rules:regulatory.rules,markets:regulatory.markets,note:'候选文件要求，不代表已完成特定产品的法规适用性评估。'});
 if(p==='/api/kpi/demo'&&req.method==='GET'){
  const [po,qc,production,inventory,changes]=await Promise.all(['purchase_orders.csv','qc_lots.csv','production.csv','inventory.csv','change_controls.csv'].map(sample));
  return send(res,200,kpiAnalyze({po,qc,production,inventory,changes},{sources:{po:'内置示例数据',qc:'内置示例数据',production:'内置示例数据',inventory:'内置示例数据',change_control:'内置示例数据'}}));
 }
 if(req.method==='POST'&&['/api/kpi/analyze','/api/sourcing/analyze','/api/checklist','/api/documents/inspect'].includes(p)){
  const form=await requestForm(req);
  if(p==='/api/documents/inspect')return send(res,200,await inspectPDF(form));
  if(p==='/api/checklist'){
   let docs=await uploaded(form,'docs_file','supplier_documents.csv'),result=checklist({material_type:String(form.get('material_type')||'chemical'),markets:String(form.get('markets')||'US,EU'),scenario:String(form.get('scenario')||'new'),supplier_id:String(form.get('supplier_id')||'SUP-001'),docs:docs.rows});
   return send(res,200,{rows:result,source:docs.source,summary:{total:result.length,missing:result.filter(x=>x.status==='Missing').length,review:result.filter(x=>x.status==='Under review').length,expired:result.filter(x=>x.status==='Expired').length},note:'Demo 候选要求须由 QA/RA 验证。'});
  }
  if(p==='/api/sourcing/analyze'){
   let sourcingWorkbook=await parseUploadedWorkbook(form.get('sourcing_workbook_file'),'sourcing');let [sup,q,docs]=sourcingWorkbook?.files||await Promise.all([uploaded(form,'suppliers_file','suppliers.csv'),uploaded(form,'quotes_file','quotes.csv'),uploaded(form,'docs_file','supplier_documents.csv')]);
   let result=sourcingAnalyze({suppliers:sup.rows,quotes:q.rows,documents:docs.rows},{material_id:String(form.get('material_id')||'API-001'),quantity:String(form.get('quantity')||'1000'),markets:String(form.get('markets')||'US,EU'),material_type:String(form.get('material_type')||'chemical'),scenario:String(form.get('scenario')||'new'),weights:String(form.get('weights')||'{"price":35,"quality":30,"delivery":20,"risk":15}'),sources:{suppliers:sup.source,quotes:q.source,documents:docs.source}});
   result.validation=sourcingWorkbook?{mode:'complete_sourcing_workbook',diagnostics:sourcingWorkbook.diagnostics}:null;result.ai=await maybeAI({ranking:result.results,recommendations:result.recommendations},'寻源分析',form);return send(res,200,result);
  }
  if(p==='/api/kpi/analyze'){
   let workbook=await parseUploadedWorkbook(form.get('workbook_file'));let files=workbook?.files||await Promise.all([uploaded(form,'po_file','purchase_orders.csv'),uploaded(form,'qc_file','qc_lots.csv'),uploaded(form,'production_file','production.csv'),uploaded(form,'inventory_file','inventory.csv'),uploaded(form,'change_file','change_controls.csv')]);
   let [po,qc,production,inventory,changes]=files.map(x=>x.rows),sources=Object.fromEntries(['po','qc','production','inventory','change_control'].map((k,i)=>[k,files[i].source]));
   let quality=validateKpiInput({po,qc,production,inventory,changes});if(!quality.ok)throw Error('数据校验失败：'+quality.errors.slice(0,5).join('；'));let result=kpiAnalyze({po,qc,production,inventory,changes},{sources});result.data_quality=quality;result.validation={mode:workbook?'complete_workbook':'individual_files',diagnostics:workbook?.diagnostics||[],source_count:Object.values(sources).filter(x=>!x.includes('内置示例')).length};result.ai=await maybeAI({metrics:result.metrics,insights:result.insights},'采购绩效',form);return send(res,200,result);
  }
 }
 // Only publish build-generated browser-safe engines; Node source files are never exposed.
 if(req.method==='GET'&&p.startsWith('/engine/')){
  const name=p.slice('/engine/'.length);
  if(!/^[a-zA-Z0-9_.-]+\.mjs$/.test(name))return reject(res,403,'Invalid browser module path');
  return serveFile(res,path.join(ROOT,'dist','engine',name));
 }
 if(req.method==='GET'&&(p==='/'||p.startsWith('/static/')||p.startsWith('/samples/')||p==='/seed_simulated/manifest.json')){if(p==='/')return serveFile(res,path.join(ROOT,'static','index.html'));let file=path.resolve(ROOT,'.'+decodeURI(p));if(p.startsWith('/seed_simulated/')){const base=p.slice('/seed_simulated/'.length);if(base!=='manifest.json'&&!SIM_TABLES.some(t=>base===t+'.csv'))return reject(res,403,'Not a public simulated dataset');return serveFile(res,path.join(SIM_DATA_DIR,base));}if(!file.startsWith(path.resolve(ROOT,p.startsWith('/static/')?'static':'samples')+path.sep))return reject(res,403,'Forbidden');return serveFile(res,file)}
 return reject(res,404,'Not found');
 }catch(e){const msg=String(e.message||e);const bad=/missing|缺少|invalid|无效|空|文件|报价|CSV|Excel|PDF|上传|仅支持|超出|超过/i.test(msg);console.error('[Server]',msg);return reject(res,bad?422:500,msg)} }
const server=http.createServer(route);server.listen(PORT,'0.0.0.0',()=>console.log(`Pharma Procurement AI V2.9.31 Node server running on ${PORT}`));
// Explicit opt-in: a long-running Node host schedules daily retries. Static pages cannot do this.
// Queue reminders without claiming that an external notification was delivered.
if(process.env.COMPLIANCE_ESCALATION_SCAN==='1'){const scan=()=>{try{complianceStore.scanEscalations()}catch(e){console.error('[Compliance scan]',e.message)}};scan();const timer=setInterval(scan,24*60*60*1000);timer.unref?.();}
// The administrator can enable automatic collection from the dashboard;
// the persistent setting survives restarts. A periodic wakeup observes it even
// when the server was booted with SOURCING_AUTO_SYNC=0. Per-provider throttling
// in SourcingRegistry avoids unnecessary requests (normally one per day).
const officialCheck=()=>{
 if(!sourcingRegistry.getConfig().auto_sync_enabled)return;
 return sourcingRegistry.sync().then(r=>{if(Object.values(r.sources).some(x=>x.status==='ERROR'))console.error('[Official sync] provider failure; retained previous records')}).catch(e=>console.error('[Official sync]',e.message));
};
void officialCheck();const officialTimer=setInterval(officialCheck,60*60*1000);officialTimer.unref?.();
// EDQM official download is a separate opt-in. Never infer "live" from a URL
// alone: only record a successful HTTPS response + valid parsed TXT snapshot.
const edqmCheck=async()=>{
 if(process.env.SOURCING_EDQM_AUTO_SYNC!=='1')return;
 try{const r=await edqmCatalog.syncOfficial();if(r.skipped)return;const rechecked=recheckEdqmPublishedSignals();
  sourcingRegistry.data.sources.EDQM_CEP_EXPORT={status:'OK_HTTPS_EXPORT',fetched_at:r.last_import_at,last_success:r.last_import_at,received:r.record_count,source_url:EDQM_SOURCE,file_sha256:r.file_sha256};
  sourcingRegistry.audit('EDQM_CEP_OFFICIAL_FETCH_SUCCESS','scheduled-ingest',{count:r.record_count,sha256:r.file_sha256,changes:r.latest_changes,rechecked});sourcingRegistry.save();
 }catch(e){const err=String(e.message||e).slice(0,240);sourcingRegistry.data.sources.EDQM_CEP_EXPORT={...(sourcingRegistry.data.sources.EDQM_CEP_EXPORT||{}),status:'ERROR',fetched_at:new Date().toISOString(),error:err};
  sourcingRegistry.audit('EDQM_CEP_OFFICIAL_FETCH_FAILED','scheduled-ingest',{error:err});sourcingRegistry.save();console.error('[EDQM CEP sync]',err)}
};
void edqmCheck();const edqmTimer=setInterval(edqmCheck,60*60*1000);edqmTimer.unref?.();

