/** V2.9.25: a single, explicit released-snapshot contract for all 26 routes.
 * NO fallback to V08, no qualifications inferred from ERP/QMS, no mock values.
 * Aggregates and KPI detail use the identical filtered source facts.
 */
import crypto from 'node:crypto';
import {PAGE_METRIC_INDEX} from './page_metric_manifest_v2923.mjs';
import {metricReport} from './metric_registry_v2921.mjs';
import {buildDomainVisuals,DOMAIN_METRICS} from './enterprise_evidence_v2926.mjs';
const round=(n,d=4)=>Math.round(n*10**d)/10**d;
const sum=(a,f)=>a.reduce((s,r)=>s+f(r),0);
const group=(arr,key)=>[...arr.reduce((m,r)=>{const k=String(key(r)||'UNSPECIFIED');const v=m.get(k)||[];v.push(r);m.set(k,v);return m},new Map())].map(([label,rows])=>({label,rows}));
const statusOk=s=>s==='ENTERPRISE_RECOMPUTABLE_NON_GXP';
const scopeNorm=s=>({supplier:String(s?.supplier||'all'),material:String(s?.material||'all'),year:String(s?.year||'all'),as_of:String(s?.as_of||new Date().toISOString().slice(0,10))});
const checksum=obj=>crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const PAGE_CHARTS={overview:['spend_supplier','spend_material','spend_month','otd_ppv','qms'],portfolio:['spend_material','spend_supplier'],m01:['spend_material','spend_month'],m06:['spend_material'],m02:['spend_material','spend_supplier'],
 'ss-overview':['spend_material','otd_ppv'], 'ss-market':['spend_month','spend_material'],'ss-kraljic':['spend_supplier','spend_material'], 'ss-ai':['spend_supplier'], 'ss-cost':['spend_supplier','spend_month'], 'ss-project':['spend_material'], 'ss-performance':['otd_ppv','spend_supplier','qms'], 'ss-compliance':['qms'], 'ss-technical':['spend_supplier'], 'ss-data':[],m05:['spend_month','otd_ppv'],m08:['spend_supplier','spend_month'],m09:['qms'],m10:['otd_ppv','qms','spend_supplier'],documents:['qms'],regulatory:[],workflow:['qms'],reports:['spend_supplier','spend_material','spend_month','otd_ppv','qms'],access:[],master:['spend_supplier'],alerts:['qms','otd_ppv']};
const metric=(id,facts,scope)=>metricReport(id,{scope,factsOverride:facts});
function chart(name,kind,points,metricId,formula,sourceIds){return {id:kind,title:name,metric_id:metricId,formula,source_rows:sourceIds,points};}
export function buildReleasedDashboard({connector,route='overview',scope={}}={}){
 if(!Object.hasOwn(PAGE_METRIC_INDEX,route))throw Error('Unknown dashboard route');
 const filter=scopeNorm(scope),facts=connector.facts(filter),released=connector.data?.released;
 if(!facts||!released)return {status:'NO_RELEASED_ENTERPRISE_SNAPSHOT',route,scope:filter,metrics:[],charts:[],reconciliation:null};
 // An immutable analytical release must still match its published content hash
 // after process restart/file restoration; audit history alone is insufficient.
 if(checksum(released.domains?{po:released.po,qms:released.qms,domains:released.domains}:{po:released.po,qms:released.qms})!==released.sha256||!connector.verifyAudit())
   return {status:'SNAPSHOT_INTEGRITY_FAILED',route,scope:filter,metrics:[],charts:[],reconciliation:{passed:false},error:'发布快照内容哈希或审计链校验失败；禁止展示可能被篡改的来源分析。'};
 const source={mode:'ENTERPRISE_RELEASED_NON_GXP',snapshot_id:released.snapshot_id,sha256:released.sha256,origin:released.origin,created_at:released.created_at,released_at:released.released_at,po_rows_total:released.po.length,qms_rows_total:released.qms.length,domain_counts:Object.fromEntries(Object.entries(released.domains||{}).map(([k,v])=>[k,v.length])),audit_chain_valid:connector.verifyAudit()};
 const ids=PAGE_METRIC_INDEX[route];
 const extendedRows=Object.values(released.domains||{}).flat();
 const available_suppliers=[...new Set(released.po.concat(released.qms,extendedRows).map(r=>r.supplier_id).filter(Boolean))].sort();
 const available_materials=[...new Set(released.po.concat(released.qms,extendedRows).map(r=>r.material_id).filter(Boolean))].sort();
 const available_years=[...new Set(released.po.map(r=>r.created_date?.slice(0,4)).concat(released.qms.map(r=>r.opened_at?.slice(0,4)),extendedRows.map(r=>String(r.as_of||r.start_date||r.quote_date||'').slice(0,4))))].filter(x=>/^20\d{2}$/.test(x)).sort().reverse();
 const metrics=ids.map(id=>{const r=metric(id,facts,filter);return {id,label:r.label,formula:r.formula,unit:r.unit,status:r.status,value:statusOk(r.status)?r.result:null,numerator:r.numerator,denominator:r.denominator,missing:r.missing||[],source_class:r.source_class,source_release:r.source_release,source_rows:r.rows?.length||0};});
 const p=facts.purchaseOrders,q=facts.qmsEvents;
 const spendReport=metric('SRC.PO.SPEND',facts,filter),otdReport=metric('SRC.PO.OTD',facts,filter),ppvReport=metric('SRC.PO.PPV',facts,filter);
 const hasERP=facts.has_erp_input,hasQMS=facts.has_qms_input;
 const mkSpend=(which,title,key)=>{
  if(!hasERP)return null;
  const groups=group(p,which);
  return chart(title,key,groups.map(g=>({label:g.label,value:round(sum(g.rows,r=>r.amount_usd),2),order_count:g.rows.length,source_ids:g.rows.map(r=>r.id),source_breakdown:g.rows.map(r=>({id:r.id,supplier_id:r.supplier_id,material_id:r.material_id,created_date:r.created_date,ordered_qty:r.qty,unit_price_usd:r.price_usd,amount_usd:r.amount_usd,delay_days:r.delay_days}))})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label)), 'SRC.PO.SPEND','SUM(PO.amount_usd) 按'+which+'分组',p.map(x=>x.id));
 };
 const charts=[mkSpend(r=>r.supplier_id,'企业来源采购金额 / 供应商','spend_supplier'),mkSpend(r=>r.material_id,'企业来源采购金额 / 物料','spend_material'),mkSpend(r=>r.created_date?.slice(0,7),'企业来源采购金额 / 月份','spend_month')].filter(Boolean);
 if(hasERP){
  const pts=group(p,r=>r.supplier_id).map(g=>{const sScope={...filter,supplier:g.label},o=metric('SRC.PO.OTD',factsForGroup(facts,g.rows),sScope),v=metric('SRC.PO.PPV',factsForGroup(facts,g.rows),sScope);return {label:g.label,otd:statusOk(o.status)?o.result:null,ppv:statusOk(v.status)?v.result:null,order_count:g.rows.length,source_ids:g.rows.map(r=>r.id),source_breakdown:g.rows.map(r=>({id:r.id,supplier_id:r.supplier_id,material_id:r.material_id,created_date:r.created_date,ordered_qty:r.qty,unit_price_usd:r.price_usd,amount_usd:r.amount_usd,baseline_usd:r.baseline_usd,delay_days:r.delay_days}))};});
  charts.push(chart('OTD × PPV / 供应商','otd_ppv',pts,'SRC.PO.OTD','OTD=100×准时订单/有交期订单；PPV=100×价差/基准金额',p.map(x=>x.id)));
 }
 if(hasQMS){
  const groups=group(q,r=>r.kind+':'+r.status);
  charts.push(chart('QMS 质量事件 / 类型和状态','qms',groups.map(g=>({label:g.label,value:g.rows.length,source_ids:g.rows.map(r=>r.id),source_breakdown:g.rows.map(r=>({id:r.id,supplier_id:r.supplier_id,material_id:r.material_id,kind:r.kind,status:r.status,severity:r.severity,opened_at:r.opened_at,due_date:r.due_date}))})), 'SRC.QMS.EVENT_COUNT','COUNT(QMS.event_id) 按类型与状态分组',q.map(x=>x.id)));
 }
 const specialist=buildDomainVisuals(facts,route,filter);
 const shownCharts=charts.filter(c=>(PAGE_CHARTS[route]||[]).includes(c.id));
 const total=round(sum(p,x=>x.amount_usd),2);
 const numericTotal=hasERP&&p.length?total:null;
 const suppliers=group(p,r=>r.supplier_id).map(g=>round(sum(g.rows,r=>r.amount_usd),2));
 const materials=group(p,r=>r.material_id).map(g=>round(sum(g.rows,r=>r.amount_usd),2));
 const months=group(p,r=>r.created_date?.slice(0,7)).map(g=>round(sum(g.rows,r=>r.amount_usd),2));
 const checks=[
  {id:'SPEND_SUPPLIER_RECON',label:'供应商分组金额 = 原始 PO 金额',expected:numericTotal,actual:numericTotal==null?null:round(sum(suppliers,x=>x),2)},
  {id:'SPEND_MATERIAL_RECON',label:'物料分组金额 = 原始 PO 金额',expected:numericTotal,actual:numericTotal==null?null:round(sum(materials,x=>x),2)},
  {id:'SPEND_MONTH_RECON',label:'月份分组金额 = 原始 PO 金额',expected:numericTotal,actual:numericTotal==null?null:round(sum(months,x=>x),2)},
  {id:'SPEND_METRIC_RECON',label:'当前指标来源 = 同一 PO 原始表',expected:numericTotal,actual:statusOk(spendReport.status)?spendReport.result:null},
  {id:'PO_ROW_UNIQUENESS',label:'当前 PO 主键不重复',expected:p.length,actual:new Set(p.map(x=>x.id)).size},
  {id:'QMS_ROW_UNIQUENESS',label:'当前 QMS 事件主键不重复',expected:q.length,actual:new Set(q.map(x=>x.id)).size},
 ];
 const domains=facts.enterprise_domains||{};
 for(const [name,rows] of Object.entries(domains)){
  if(name==='bom'&&rows.length)checks.push({id:'BOM_TOTAL_RECON',label:'BOM分项目标+差额 = 报价总额',expected:round(sum(rows,x=>x.target_total_usd+x.variance_usd),2),actual:round(sum(rows,x=>x.quoted_total_usd),2)});
  if(name==='scores'&&rows.length)checks.push({id:'SCORE_WEIGHT_RECON',label:'五维评分权重均合计100%',expected:rows.length*100,actual:round(sum(rows,x=>Object.values(x.weights).reduce((a,v)=>a+v,0)),2)});
  if(rows.length)checks.push({id:'DOMAIN_'+name.toUpperCase()+'_UNIQUE',label:name+'来源ID不重复',expected:rows.length,actual:new Set(rows.map(x=>x.id)).size});
 }
 const traceForCheck=id=>id.startsWith('SPEND_')?'SRC.PO.SPEND':id==='PO_ROW_UNIQUENESS'?'SRC.PO.COUNT':id==='QMS_ROW_UNIQUENESS'?'SRC.QMS.EVENT_COUNT':id==='BOM_TOTAL_RECON'?'SRC.BOM.VARIANCE':id==='SCORE_WEIGHT_RECON'?'SRC.SCORE.WEIGHTED_MEAN':id.includes('BOM')?'SRC.BOM.LINE_COUNT':id.includes('STAGES')?'SRC.PROJECT.STAGES':id.includes('SCORES')?'SRC.SCORE.REVIEWS':id.includes('DOCUMENTS')?'SRC.EVIDENCE.DOCUMENTS':'SRC.RFQ.RECORDS';
 const reconciled=checks.map(c=>({...c,metric_id:traceForCheck(c.id),pass:c.expected==null&&c.actual==null?null:c.expected!=null&&c.actual!=null&&Math.abs(c.expected-c.actual)<=.01}));
 const components=[...metrics.map(m=>({kind:'KPI',id:m.id,formula:m.formula,status:m.status})),...shownCharts.map(c=>({kind:'CHART',id:c.metric_id,formula:c.formula,status:'EVIDENCE_BOUND'})),...specialist.panels.map(x=>({kind:'SPECIALIST',id:x.metric_id,formula:x.formula,status:'EVIDENCE_BOUND'})),...reconciled.map(x=>({kind:'RECONCILIATION',id:x.metric_id,formula:x.label,status:x.pass===false?'FAILED':'EVIDENCE_BOUND'}))];
 const component_binding={total:components.length,explicit:components.filter(x=>x.id&&x.formula).length,unbound:components.filter(x=>!x.id||!x.formula),complete:components.every(x=>x.id&&x.formula),scope:'ENTERPRISE_RELEASED_COMPONENTS_ONLY_NOT_LEGACY_DEMO',records:components};
 const detail={po_rows:p.length,qms_rows:q.length,distinct_po_suppliers:new Set(p.map(r=>r.supplier_id)).size,otd:statusOk(otdReport.status)?otdReport.result:null,ppv:statusOk(ppvReport.status)?ppvReport.result:null};
 return {version:'2.9.26',status:reconciled.some(c=>c.pass===false)?'RECONCILIATION_FAILED':'ENTERPRISE_RECONCILED_NON_GXP',route,scope:filter,source,metrics,charts:shownCharts,specialist,component_binding,available_suppliers,available_materials,available_years,
  reconciliation:{passed:reconciled.every(c=>c.pass!==false)&&source.audit_chain_valid,checks:reconciled,detail,origin_note:'该图表仅依据当前发布的企业来源 PO/QMS 快照。当前快照缺少的 GMP、CEP、资质、合同、报价或其他表不会被 V08 DEMO 填补。'},
  fingerprint:checksum({snapshot:source.snapshot_id,scope:filter,metrics:metrics.map(m=>[m.id,m.status,m.value]),total,p:q.length}),
  not_migrated:'企业来源的 BOM/项目/评分/文件/报价组件仅使用经过审核发布的同域证据；未提供的旧版专用图表列为证据缺口，不用 DEMO 代替。'};
}
function factsForGroup(facts,rows){return {...facts,purchaseOrders:rows}}
