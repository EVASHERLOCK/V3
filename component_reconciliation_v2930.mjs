/** V2.9.30 — strict, independent per-component reconciliation.
 * Method matching, source calculation and visible-chart reconciliation are
 * three distinct grades. NO real ERP/QMS connection is claimed from DEMO data.
 * All comparisons fail closed on missing scope/identity/version/units.
 */
import crypto from 'node:crypto';

const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const sum=(r,f)=>r.reduce((a,x)=>a+(f(x)??0),0);
const round=(n,p=6)=>Math.round((n+Number.EPSILON)*10**p)/10**p;
const idOf=r=>String(r.id??r.po_id??r.event_id??r.evidence_id??'');
const present=(v)=>typeof v==='number'&&Number.isFinite(v);
const result=(value,rows,explanation,missing=[])=>({value:present(value)?round(value):null,source_rows:rows.map(x=>({id:idOf(x),source_row:x.source_row||null})),explanation,missing});
export const STRICT_METRICS=Object.freeze({
 'SRC.PO.SPEND':r=>result(r.every(x=>present(x.qty)&&present(x.price_usd)&&present(x.amount_usd))?sum(r,x=>x.qty*x.price_usd):null,r,'独立复算 Σ 数量×成交单价；逐笔检验金额字段一致',r.filter(x=>!present(x.qty)||!present(x.price_usd)||!present(x.amount_usd)).map(idOf)),
 'SRC.PO.COUNT':r=>result(r.length,r,'计数唯一 PO 行ID'),
 'SRC.PO.QUANTITY':r=>result(r.every(x=>present(x.qty))?sum(r,x=>x.qty):null,r,'Σ PO 数量'),
 'SRC.PO.OTD':r=>{const known=r.filter(x=>present(x.delay_days));return result(known.length?100*known.filter(x=>x.delay_days<=0).length/known.length:null,known,'100×有效交期且准时行数/有效交期行数',known.length?[]:['没有可判交期的原始行']);},
 'SRC.PO.LATE_RATE':r=>{const known=r.filter(x=>present(x.delay_days));return result(known.length?100*known.filter(x=>x.delay_days>0).length/known.length:null,known,'100×延期行数/有效交期行数');},
 'SRC.PO.LATE_COUNT':r=>result(r.filter(x=>present(x.delay_days)&&x.delay_days>0).length,r,'COUNTIF 延期天数>0'),
 'SRC.PO.ON_TIME_COUNT':r=>result(r.filter(x=>present(x.delay_days)&&x.delay_days<=0).length,r,'COUNTIF 有交期且延期天数<=0'),
 'SRC.PO.AVG_LATE_DAYS':r=>{const d=r.filter(x=>present(x.delay_days)&&x.delay_days>0);return result(d.length?sum(d,x=>x.delay_days)/d.length:null,d,'Σ 正延期天数/延期行数');},
 'SRC.PO.PPV_AMOUNT':r=>result(r.length&&r.every(x=>present(x.qty)&&present(x.price_usd)&&present(x.baseline_usd))?sum(r,x=>x.qty*(x.price_usd-x.baseline_usd)):null,r,'Σ 数量×(采购单价−基准价)'),
 'SRC.PO.BENCHMARK_SPEND':r=>result(r.length&&r.every(x=>present(x.qty)&&present(x.baseline_usd))?sum(r,x=>x.qty*x.baseline_usd):null,r,'Σ 数量×基准价'),
 'SRC.PO.PPV':r=>{if(!r.length||r.some(x=>!present(x.qty)||!present(x.price_usd)||!present(x.baseline_usd)))return result(null,r,'缺少基准价或成交价，拒绝复算');const den=sum(r,x=>x.qty*x.baseline_usd);return result(den?100*sum(r,x=>x.qty*(x.price_usd-x.baseline_usd))/den:null,r,'100×Σ采购价差/Σ基准金额');},
 'SRC.PO.WEIGHTED_PRICE':r=>{const den=sum(r,x=>x.qty);return result(r.length&&r.every(x=>present(x.amount_usd)&&present(x.qty))&&den?sum(r,x=>x.amount_usd)/den:null,r,'Σ 订单金额/Σ采购数量');},
 'SRC.PO.ACTIVE_SUPPLIERS':r=>result(new Set(r.map(x=>x.supplier_id).filter(Boolean)).size,r,'COUNT UNIQUE Supplier ID'),
 'SRC.QMS.EVENT_COUNT':r=>result(r.length,r,'COUNT QMS事件ID'),
 'SRC.QMS.OPEN_CAPA':r=>result(r.filter(x=>x.kind==='CAPA'&&x.status!=='CLOSED').length,r,'COUNT 开放的 CAPA'),
 'SRC.QMS.CRITICAL_COUNT':r=>result(r.filter(x=>x.severity==='CRITICAL').length,r,'COUNT 严重级别CRITICAL'),
 'SRC.QMS.CAPA_CLOSED_RATE':r=>{const c=r.filter(x=>x.kind==='CAPA');return result(c.length?100*c.filter(x=>x.status==='CLOSED').length/c.length:null,c,'100×CLOSED CAPA/总CAPA');},
 'SRC.BOM.LINE_COUNT':r=>result(r.length,r,'COUNT 受控BOM证据行'),
 'SRC.BOM.TARGET_TOTAL':r=>result(r.length&&r.every(x=>present(x.target_total_usd))?sum(r,x=>x.target_total_usd):null,r,'Σ BOM行目标金额'),
 'SRC.BOM.QUOTED_TOTAL':r=>result(r.length&&r.every(x=>present(x.quoted_total_usd))?sum(r,x=>x.quoted_total_usd):null,r,'Σ BOM行报价金额'),
 'SRC.BOM.VARIANCE':r=>result(r.length&&r.every(x=>present(x.target_total_usd)&&present(x.quoted_total_usd))?sum(r,x=>x.quoted_total_usd-x.target_total_usd):null,r,'Σ (报价金额−目标金额)'),
 'SRC.SCORE.REVIEWS':r=>result(r.length,r,'COUNT 有证据的五维评分记录'),
 'SRC.PROJECT.STAGES':r=>result(r.length,r,'COUNT 有计划起止日期的阶段证据'),
 'SRC.EVIDENCE.DOCUMENTS':r=>result(r.length,r,'COUNT 有受控编号的证据登记行')
});
const domainFor=id=>id.startsWith('SRC.PO.')?'po':id.startsWith('SRC.QMS.')?'qms':id.startsWith('SRC.BOM.')?'bom':id.startsWith('SRC.SCORE.')?'scores':id.startsWith('SRC.PROJECT.')?'stages':id.startsWith('SRC.EVIDENCE.')?'documents':null;
function strictSourceRows(metric,facts){const domain=domainFor(metric.metric_id);if(!domain)return null;
 if(domain==='po')return facts?.purchaseOrders||[];
 if(domain==='qms')return facts?.qmsEvents||[];
 return facts?.enterprise_domains?.[domain]??null;
}
export function auditMetricSource(metric,{facts=null,scope={},enterprise=false,snapshot=null}={}){
 const id=metric.metric_id,fn=STRICT_METRICS[id];const rows=strictSourceRows(metric,facts);
 if(!fn)return {metric_id:id,status:'NO_INDEPENDENT_EVALUATOR',reason:'存在指标定义，不代表已实现独立复算器；不可标记PASS',result:null};
 if(!Array.isArray(rows)||!rows.length)return {metric_id:id,status:'SOURCE_ROWS_MISSING',reason:'当前筛选范围缺少完整、受控的源行，空数据不作为零',result:null};
 const duplicates=rows.map(idOf).filter((x,i,a)=>!x||a.indexOf(x)!==i);
 if(duplicates.length)return {metric_id:id,status:'SOURCE_KEY_INVALID',reason:'缺少唯一原始来源ID或出现重复ID',ids:duplicates.slice(0,10),result:null};
 const evaluated=fn(rows);
 if(evaluated.value==null)return {metric_id:id,status:'SOURCE_INPUT_INCOMPLETE',reason:evaluated.explanation,missing:evaluated.missing,result:null};
 if(id==='SRC.PO.SPEND'){
   const wrong=rows.filter(r=>Math.abs(r.amount_usd-r.qty*r.price_usd)>0.02);
   if(wrong.length)return {metric_id:id,status:'SOURCE_ROW_CONFLICT',reason:'数量×成交单价与订单金额字段不一致',ids:wrong.map(idOf).slice(0,20),result:evaluated.value};
 }
 if(!present(metric.result))return {metric_id:id,status:'SOURCE_METRIC_MISSING',reason:'独立复算有值，源指标引擎未能给出数值',result:evaluated.value};
 const tol=['USD','USD/kg'].includes(metric.unit)?0.02:metric.unit==='%'?0.06:0.01;
 const diff=round(metric.result-evaluated.value);
 const ok=Math.abs(diff)<=tol;
 return {metric_id:id,status:ok?(enterprise?'CONTROLLED_SOURCE_RECOMPUTED_NON_GXP':'DEMO_SOURCE_RECOMPUTED'):'SOURCE_METRIC_MISMATCH',
  source_class:enterprise?'PUBLISHED_CONTROLLED_ENTERPRISE':'BUNDLED_V08_DEMO',source_snapshot:enterprise?snapshot:'V08_DEMO',scope,unit:metric.unit,
  engine_result:metric.result,independent_result:evaluated.value,difference:diff,tolerance:tol,source_row_count:rows.length,
  source_ids:evaluated.source_rows.slice(0,1000),formula_validation:evaluated.explanation,
  reason:ok?'来源明细独立复算与指标引擎一致；尚需独立核对页面显示值和同口径元数据':'来源独立复算与源指标结果不一致，不能用于页面宣称'};
}
function parseValue(v){const s=String(v??'').replace(/[,，\s]/g,'').replace(/^\$/,'').replace(/USD\/kg|美元\/kg/gi,'');const m=s.match(/^([+-]?\d+(?:\.\d+)?)(%|USD|美元|家|份|次|条|行|笔|kg)?$/i);return m?{value:Number(m[1]),suffix:m[2]||''}:null}
const SUFFIX={USD:['USD','美元'], '%':['%'], '家':['家'],'行':['行','笔'],'份':['份'],'条':['条'],'kg':['kg']};
const allowedUnit=(suffix,unit)=>!suffix||!unit||(SUFFIX[unit]||[unit]).some(x=>x.toLowerCase()===suffix.toLowerCase());
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** To claim a VERIFIED display, browser must provide stable ID, exact scope,
 * snapshot identity, source class, and unit. Legacy untagged figures never pass. */
export function auditDisplayedFigures(input,metrics,sourceAudits,{scope={},enterprise=false,snapshot=null}={}){
 const reports=[];for(const f of input.figures||[]){const parsed=parseValue(f.value);const id=String(f.metric_id||'');const metric=metrics.find(m=>m.metric_id===id);const src=sourceAudits.find(m=>m.metric_id===id);
  const declaredScope=f.scope&&typeof f.scope==='object'?f.scope:null;
  const sameScope=declaredScope&&['supplier','material','year','as_of'].every(k=>String(declaredScope[k]??scope[k]??'all')===String(scope[k]??'all'));
  const sameSnapshot=String(f.snapshot_id||'')===(enterprise?String(snapshot||''):'V08_DEMO');
  const sameUnit=parsed&&metric&&allowedUnit(parsed.suffix,metric.unit)&&(!f.unit||f.unit===metric.unit);
  const sourceValid=src&&/^(CONTROLLED_SOURCE_RECOMPUTED_NON_GXP|DEMO_SOURCE_RECOMPUTED)$/.test(src.status);
  const compatible=!!(metric&&sourceValid&&parsed&&sameUnit);
  const delta=compatible?round(parsed.value-src.independent_result):null;
  const sameNumber=compatible&&Math.abs(delta)<=src.tolerance;
  let status='UNBOUND_DISPLAY';
  if(!id)status='MISSING_EXPLICIT_METRIC_ID';
  else if(!metric)status='UNREGISTERED_DISPLAY_METRIC';
  else if(!sourceValid)status='SOURCE_NOT_RECOMPUTED';
  else if(!sameUnit)status='UNIT_UNVERIFIED';
  else if(!sameScope||!sameSnapshot)status=sameNumber?'VALUE_MATCH_SCOPE_OR_RELEASE_UNVERIFIED':'DISPLAY_DIFFERENCE_SCOPE_UNVERIFIED';
  else status=sameNumber?(enterprise?'CONTROLLED_DISPLAY_RECONCILED_NON_GXP':'DEMO_DISPLAY_RECONCILED'):'DISPLAY_VALUE_MISMATCH';
  reports.push({label:f.label,value:f.value,metric_id:id,display_number:parsed?.value??null,source_result:compatible?src.independent_result:null,delta,status,scope_verified:!!sameScope,release_verified:sameSnapshot,
   source_row_ids:sourceValid?src.source_ids.map(x=>x.id).slice(0,200):[],boundary:'必须同时核对源主键、期间、Supplier/Site/Material、单位、快照版本和展示值；仅数值相同不等于对账成功。'});
 }
 return reports;
}
/** Re-evaluate every tagged chart point from the released raw records, not its SVG
 * label, screen position or server-aggregated chart value. Historical CSS/SVG
 * without source IDs remains UNVERIFIED. */
export function auditDisplayedChartSeries(input,{facts=null,scope={},enterprise=false,snapshot=null}={}){
 const po=facts?.purchaseOrders||[],qms=facts?.qmsEvents||[];
 return (input.charts||[]).map((c,i)=>{
  const checks=(c.series||[]).map(pt=>{
   const id=String(pt.metric_id||'');
   const dimension=String(pt.group_dimension||''),key=String(pt.group_key||'');
   const full= id.startsWith('SRC.QMS.')?qms:po;
   const group=dimension==='supplier_id'?full.filter(r=>r.supplier_id===key)
     :dimension==='material_id'?po.filter(r=>r.material_id===key)
     :dimension==='month'?po.filter(r=>String(r.created_date||'').slice(0,7)===key)
     :dimension==='qms_group'?qms.filter(r=>r.kind+':'+r.status===key):null;
   if(!group||!id||!key)return {label:key,metric_id:id,status:'SERIES_SOURCE_KEYS_MISSING'};
   const expected=group.map(idOf).sort(),provided=(pt.source_ids||[]).slice().sort();
   if(!expected.length||expected.length!==provided.length||expected.some((x,j)=>x!==provided[j]))return {label:key,metric_id:id,status:'SOURCE_ROW_IDS_INCOMPLETE',expected_count:expected.length,provided_count:provided.length};
   const selected=STRICT_METRICS[id],computed=selected?selected(group):null,parsed=parseValue(pt.value);
   if(!computed||computed.value==null||!parsed||!allowedUnit(parsed.suffix,pt.unit))return {label:key,metric_id:id,status:'CHART_POINT_CANNOT_RECOMPUTE'};
   const declared=pt.scope&&['supplier','material','year','as_of'].every(k=>String(pt.scope[k]||'')===String(scope[k]||'all'));
   const release=String(pt.snapshot_id||'')===(enterprise?String(snapshot||''):'V08_DEMO');
   const delta=round(parsed.value-computed.value);
   const tol=pt.unit==='%'?.06:pt.unit==='USD'?.02:.01;
   if(!declared||!release)return {label:key,metric_id:id,status:'CHART_POINT_SCOPE_OR_RELEASE_UNVERIFIED',computed:computed.value,delta};
   return {label:key,metric_id:id,status:Math.abs(delta)<=tol?(enterprise?'CONTROLLED_CHART_POINT_RECONCILED_NON_GXP':'DEMO_CHART_POINT_RECONCILED'):'CHART_POINT_MISMATCH',computed:computed.value,displayed:parsed.value,delta,source_rows:expected.length,source_ids:expected.slice(0,150)};
  });
  const point_passed=checks.filter(x=>x.status?.includes('CHART_POINT_RECONCILED')).length;
  const point_failed=checks.filter(x=>x.status==='CHART_POINT_MISMATCH').length;
  return {chart_index:i+1,title:c.title,point_count:c.series.length,point_passed,point_failed,
   source_ids_declared:c.series.filter(x=>Array.isArray(x.source_ids)&&x.source_ids.length).length,
   status:point_failed?'CHART_RECONCILIATION_FAILED':point_passed&&point_passed===checks.length?'CHART_SOURCE_RECONCILED':'RAW_SERIES_NOT_FULLY_RECONCILED',
   reason:point_passed===checks.length?'每个图表点均已核对来源ID、独立公式、期间、单位、发布版本及显示值':'部分或全部图表点缺少受控来源主键/原始数组/范围/版本，旧SVG文字不能代替业务记录',points:checks,
   source_snapshot:enterprise?snapshot:'V08_DEMO'};
 });
}

export function reconcileModule(report,input,{facts=null,scope={},enterprise=false,snapshot=null}={}){
 const metrics=report.metrics||[],sourceAudits=metrics.map(m=>auditMetricSource(m,{facts,scope,enterprise,snapshot}));
 const figures=auditDisplayedFigures(input,metrics,sourceAudits,{scope,enterprise,snapshot}),charts=auditDisplayedChartSeries(input,{facts,scope,enterprise,snapshot});
 const passed=figures.filter(f=>/DISPLAY_RECONCILED/.test(f.status)).length;
 const failed=figures.filter(f=>f.status==='DISPLAY_VALUE_MISMATCH').length;
 const sourcePassed=sourceAudits.filter(a=>/SOURCE_RECOMPUTED/.test(a.status)).length;
 const unverifiedCharts=charts.filter(c=>c.status!=='CHART_SOURCE_RECONCILED').length;
 const chartFailures=charts.reduce((n,c)=>n+(c.point_failed||0),0);
 const unresolved=figures.length-passed-failed+unverifiedCharts;
 return {version:'V2930_STRICT',component_id:report.component_id,mode:enterprise?'CONTROLLED_ENTERPRISE_NON_GXP':'V08_DEMO',snapshot_id:enterprise?snapshot:'V08_DEMO',scope,
  status:failed||chartFailures||sourceAudits.some(a=>a.status==='SOURCE_METRIC_MISMATCH'||a.status==='SOURCE_ROW_CONFLICT')?'FAIL':unresolved?'NOT_FULLY_RECONCILED':passed?'PASS':sourcePassed?'SOURCE_ONLY_RECOMPUTED':'INSUFFICIENT_SOURCE',
  summary:{figures:figures.length,display_passed:passed,display_failed:failed,display_unverified:figures.length-passed-failed,charts_unverified:unverifiedCharts,charts_reconciled:charts.length-unverifiedCharts,chart_points_reconciled:charts.reduce((n,c)=>n+c.point_passed,0),source_metrics_recomputed:sourcePassed,source_metrics_total:metrics.length},
  source_metrics:sourceAudits,figures,charts,boundary:'仅有合法范围、单位、来源行ID和发布快照版本的同口径对比才可通过；DEMO通过不代表企业ERP/QMS已接入。',report_digest:sha({component_id:report.component_id,sourceAudits,figures,charts}).slice(0,20)};
}

/** Server-produced enterprise charts: reconcile all points from raw released
 * PO/QMS before making them available to the browser. The client does not get
 * to provide trusted source arrays or choose the numbers under test. */
export function auditPublishedDashboard(view,facts){
 const inputCharts=[];
 for(const c of view.charts||[]){
  const pts=[];for(const p of c.points||[]){
   const base={group_dimension:c.id==='spend_supplier'?'supplier_id':c.id==='spend_material'?'material_id':c.id==='spend_month'?'month':c.id==='qms'?'qms_group':'supplier_id',group_key:p.label,snapshot_id:view.source?.snapshot_id,scope:view.scope,source_ids:p.source_ids||[]};
   if(c.id==='otd_ppv')for(const [id,key] of [['SRC.PO.OTD','otd'],['SRC.PO.PPV','ppv']])pts.push({...base,metric_id:id,value:String(p[key]??''),unit:'%'});
   else pts.push({...base,metric_id:c.metric_id,value:String(p.value??''),unit:c.id==='qms'?'条':'USD'});
  }
  inputCharts.push({title:c.title,series:pts});
 }
 const charts=auditDisplayedChartSeries({charts:inputCharts},{facts,scope:view.scope,enterprise:true,snapshot:view.source?.snapshot_id});
 const metrics=(view.metrics||[]).map(m=>auditMetricSource({metric_id:m.id,result:m.value,unit:m.unit},{facts,scope:view.scope,enterprise:true,snapshot:view.source?.snapshot_id}));
 const failed=charts.filter(c=>c.status==='CHART_RECONCILIATION_FAILED').length+metrics.filter(m=>m.status==='SOURCE_METRIC_MISMATCH'||m.status==='SOURCE_ROW_CONFLICT').length;
 const verifiedCharts=charts.filter(c=>c.status==='CHART_SOURCE_RECONCILED').length;
 return {schema:'RELEASED_DASHBOARD_SOURCE_AUDIT_V2930',status:failed?'FAILED':charts.length!==verifiedCharts?'PARTIAL':'PASSED_SOURCE_CHARTS',snapshot_id:view.source?.snapshot_id,route:view.route,scope:view.scope,
  summary:{chart_count:charts.length,chart_verified:verifiedCharts,chart_unverified:charts.length-verifiedCharts,chart_points_verified:charts.reduce((s,c)=>s+c.point_passed,0),metric_count:metrics.length,source_metric_verified:metrics.filter(m=>m.status==='CONTROLLED_SOURCE_RECOMPUTED_NON_GXP').length,metric_unverified:metrics.filter(m=>m.status!=='CONTROLLED_SOURCE_RECOMPUTED_NON_GXP').length,failed},
  charts,metrics,boundary:'仅已标记原始行并可独立复算的图表/指标满足该范围验收；专业域未登记点级契约、非企业正式QMS验证等仍属未完成。'};
}
