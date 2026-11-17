/** Public static read-only DEMO evidence fallback. Never claims ERP/GxP authorization.
 * Complete server-side recalculation requires PHARMA_API_ORIGIN configuration. */
import {createXlsx,sourceSheets,xlFormula} from './browser_xlsx_v2939.mjs';
import {executiveModule} from './executive_module_v2944.mjs';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
let cache;
async function catalog(rawFetch){if(cache)return cache;const r=await rawFetch('/static/demo-metric-catalog-v2939.json');if(!r.ok||!(r.headers.get('content-type')||'').includes('json'))throw Error('静态公式目录未发布，请重新构建后发布');return cache=await r.json();}
const norm=s=>String(s??'').trim();
function metricIds(body,cat){const found=[...new Set((body.metrics||[]).filter(id=>cat[id]))];
 const full=[body.title,body.group_title,...(body.figures||[]).map(f=>f.label)].join(' ');
 const rules=[[/\bOTD\b|准时交付率|延迟订单/i,'SRC.PO.OTD'],[/\bPPV\b|采购价差/i,'SRC.PO.PPV'],[/采购总金额|采购支出金额|采购金额|Spend/i,'SRC.PO.SPEND'],[/供应商数量|供应商数|供应商总数/i,'SRC.SUPPLIER.RECORDED'],[/订单数量|PO 记录|采购订单数/i,'SRC.PO.COUNT']];
 for(const [re,k] of rules)if(re.test(full)&&cat[k]&&!found.includes(k))found.push(k);
 return found.slice(0,20);}
const tbl=t=>({title:norm(t.title||'来源表'),headers:(t.headers||[]).slice(0,24),rows:(t.rows||[]),row_count:t.row_count??(t.rows||[]).length});
function subset(rows,scope){return rows.filter(r=>{
  const supplier=r.supplier_id||r.supplier||r.supplierId,mat=r.material_id||r.material||r.materialId,dt=r.created_date||r.date||r.order_date||'';
  if(scope.supplier&&scope.supplier!=='all'&&supplier&&supplier!==scope.supplier)return false;
  if(scope.material&&scope.material!=='all'&&mat&&mat!==scope.material)return false;
  if(scope.year&&scope.year!=='all'&&/^20\d\d/.test(dt)&&!dt.startsWith(scope.year))return false;
  return true;});}
async function report(body,url,rawFetch){const cat=await catalog(rawFetch);const scope=Object.fromEntries(url.searchParams),ids=metricIds(body,cat),filtered=Object.entries(scope).some(([k,v])=>['supplier','material','year','month'].includes(k)&&v&&v!=='all');
 const metrics=ids.map(id=>{const original=cat[id],rows=subset(original.rows||[],scope);return {...original,rows,original_result:original.result,result:filtered?null:original.result,status:filtered?'FILTERED_SCOPE_REQUIRES_NODE_RECALCULATION':original.status,source_class:'BUILT_FROM_V2938_DEMO',missing:[...(original.missing||[]),...(filtered?['已改变筛选条件。当前静态发布仅支持展示匹配的来源行及公式；必须配置 Node API 才能重算分子、分母和结果。']:[])]};});
 const tables=(body.tables||[]).map(tbl),steps=[`当前模块：${norm(body.title)}，来源为 V2.9.38 构建时 DEMO 快照，非企业 ERP/QMS。`,`页面可见表 ${tables.length} 张；页面快照必须与独立来源记录分开。`,...metrics.map(m=>`${m.label}: ${m.formula}; 来源记录 ${m.rows.length} 行；结果 ${m.result??'待同范围复算'}`), '正式上线：需配置独立 Node API，提供相同筛选范围的数据版本、可复算公式及受控来源。'];
 const trace={status:'STATIC_DEMO_PARTIAL_EVIDENCE',boundary:'当前仅静态演示。可核对源快照与公式定义，但不能声明真实企业批准、实时数据或已通过跨模块来源对账。',scope,summary:{computed_metrics:metrics.filter(m=>m.result!=null).length},route:body.route,title:body.title,metrics,actions:[],steps,tables,figures:body.figures||[],charts:body.charts||[],narratives:body.narratives||[],contract:{contracts:[],methods:['使用固定版本的 V2.9.38 演示原始记录；有完整 Node 后端时执行跨来源验证']},table_audits:[],display_reconciliations:[],narrative_audits:[],reconciliation:{status:'STATIC_SNAPSHOT_UNVERIFIED',summary:{source_metrics_recomputed:0,display_passed:0,display_unverified:(body.figures||[]).length,charts_unverified:(body.charts||[]).length},source_metrics:[],charts:[]},missing:['未连接正式企业授权 Node API。此页面的静态 DEMO 不能替代后端公式与完整独立来源对账。',...(filtered?['筛选范围已变化，未重算 KPI 聚合结果']:[])],contextual_metrics:[]};
 trace.executive=executiveModule(trace);return trace;
}
export async function handleStaticLineage(p,body,url,rawFetch){
 if(url.searchParams.get('source')==='enterprise')return response({detail:'发布版静态 DEMO 引擎没有企业授权快照；必须配置独立 Node API 才能查看企业数据、受控审批和导出。'},409);
 try{const r=await report(body,url,rawFetch);
 if(!p.endsWith('.xlsx'))return response(r);
 const info=[['模块计算公式 / 静态数据边界'],['仅 V2.9.38 DEMO 构建快照；正式企业源需要 Node API'],['指标ID','指标名称','计算表达式','结果（默认范围）','核验状态','源行数'],...r.metrics.map(m=>[m.metric_id,m.label,m.formula,m.result??'待后端复算',m.status,m.rows?.length||0])];
 const x=r.executive;
 const managerSteps={name:'管理层逐步文字解析',rows:[['步骤','解释'],...x.steps.map((step,i)=>[i+1,step])]};
 const managerGlossary={name:'变量术语解释',rows:[['变量','业务定义'],...x.terms]};
 const cellIndex={name:'逐格公式索引',rows:[['来源表','计算单元格','计算名称','完整Excel公式文本','当前展示输入计算值','解释'],...x.tables.flatMap(t=>t.rows.flatMap(row=>row.derived.map(d=>[t.sheet,d.cell,d.name,d.formula,d.result??'输入不足',d.explanation])))]};
 const paragraphs={name:'原文逐段解释',rows:[['段落','显示分析原文','相关变量','分析步骤','结论边界'],...x.narrativeAnalysis.map(a=>[a.number,a.text,a.inputs.join('；'),a.method,a.conclusion])]};
 const tabs=[{name:'指标定义与分析',rows:info},managerSteps,managerGlossary,cellIndex,paragraphs,...sourceSheets(r.title,r.metrics.flatMap(m=>m.rows||[]),{source:'V2.9.38 DEMO 公式目录；仅匹配指标原始行，可能重复',scope:r.scope}),{name:'分析方法与边界',rows:[['类型','描述'],...r.steps.map(s=>['步骤',s]),...r.missing.map(s=>['缺口',s])]}];
 for(const [i,t] of x.tables.slice(0,10).entries()){
 const names=[...t.headers,...t.modes.map(m=>m.name)];
 tabs.push({name:`模块表${i+1}`,rows:[[t.title],['来源=静态模拟快照；原始字段非公式'],names,...t.rows.map(row=>[...row.values,...row.derived.map(d=>xlFormula(d.formula.slice(1)))]) ]});
 }
 const bytes=createXlsx(tabs);
 return new Response(bytes,{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','cache-control':'no-store'}});
 }catch(e){return response({detail:'静态来源包未就绪：'+String(e.message||e)+ '；可配置 PHARMA_API_ORIGIN 连接正式计算服务'},503)}}
