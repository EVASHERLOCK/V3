/** Static-publication fallback for the V2.9.42 115-KPI SIMULATED seed.
 * Uses the exact deterministic mapping module the Node server uses; independently
 * fetches its CSV sources. Never presents simulation as real approvals.
 */
import {simulateKPIs} from '/engine/simulation_kpi_v2942.mjs';
let cache;
function parseCSV(text){const out=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q;}else if(!q&&c===','){row.push(cell);cell='';}else if(!q&&(c==='\r'||c==='\n')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(Boolean))out.push(row);row=[];}else cell+=c;}row.push(cell);if(row.some(Boolean))out.push(row);const keys=(out.shift()||[]).map(x=>x.replace(/^\uFEFF/,''));return out.map(a=>Object.fromEntries(keys.map((k,i)=>[k,a[i]||''])))}
const files={po:'purchase_orders',qc:'qc_lots',inventory:'inventory',production:'production',changes:'change_controls',suppliers:'suppliers',docs:'supplier_documents',simEvents:'metric_events',projects:'projects',materials:'materials',product_lines:'product_lines'};
async function load(){if(cache)return cache;const names=Object.keys(files);const [meta,tpl,...data]=await Promise.all([fetch('/static/decision-center/snapshot_v2942.json').then(r=>{if(!r.ok)throw Error('snapshot unavailable');return r.json()}),fetch('/static/decision-center/template_v2942.json').then(r=>r.json()),...names.map(k=>fetch('/seed_simulated/'+files[k]+'.csv').then(r=>{if(!r.ok)throw Error(files[k]+' source unavailable');return r.text()}).then(parseCSV))]);cache={meta,tpl,raw:Object.fromEntries(names.map((k,i)=>[k,data[i]]))};return cache;}
const opts=raw=>({months:[...new Set(raw.po.map(r=>r.created_date.slice(0,7)))].sort(),suppliers:[...new Set(raw.po.map(r=>r.supplier_id))].sort(),materials:[...new Set(raw.po.map(r=>r.material_id))].sort(),projects:[...new Set(raw.simEvents.map(r=>r.project_id))].sort()});
const group=(rows,key)=>[...rows.reduce((acc,r)=>acc.set(String(r[key]||'未分类'),(acc.get(String(r[key]||'未分类'))||0)+1),new Map()).entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
function datasetFor(scope,c){const {raw,tpl,meta}=c,sim=simulateKPIs(tpl,raw,scope),poIDs=new Set(sim.rows.map(r=>r.po_id)),lotIDs=new Set(sim.rows.map(r=>r.lot_id));
 const po=raw.po.filter(r=>poIDs.has(r.po_id)),qc=raw.qc.filter(r=>poIDs.has(r.po_id)),inv=raw.inventory.filter(r=>lotIDs.has(r.lot_id)),changes=sim.sourceTables.changes;
 const snapshot=structuredClone(meta),mIndex=new Map();snapshot.metrics=snapshot.metrics.map(m=>{const p=sim.metrics.get(m.id);if(!p)return {...m,status:'无匹配模拟记录',value:'—',missing_reason:'该筛选范围没有模拟关联事件',evidence:{...m.evidence,rows:[],count:0}};const x={...m,value:String(p.value),unit:p.unit,status:'已计算',source:p.source,formula:p.formula,numerator:p.numerator,denominator:p.denominator,missing_reason:'',evidence:{source_table:p.source_table,rows:[],count:p.count,scope,source:p.source,route:p.route,availability:'SIMULATED_EVENT_RECOMPUTED',reason:p.reason,formula:p.formula,simulation_contract:p.simulation_contract}};mIndex.set(m.id,x);return x});
 for(const [i,r] of snapshot.rules.entries()){const ids=snapshot.source_meta.rule_kpis?.[i+1]||[];r[3]='本筛选模拟数值：'+ids.map(id=>{const m=mIndex.get(id);return m?m.name+' '+m.value+m.unit:'未列入当前范围'}).join('；');r[6]='模拟数据已核对；实际触发待批准';}
 for(const [i,r] of snapshot.actions.entries()){const ids=snapshot.source_meta.action_kpis?.[i+1]||[];r[5]='本筛选模拟依据：'+ids.map(id=>{const m=mIndex.get(id);return m?m.name+' '+m.value+m.unit:'无关联记录'}).join('；')+'。需要真实业务签核才能创建任务。'}
 snapshot.source_meta={...snapshot.source_meta,scope,options:opts(raw),coverage:{computed:mIndex.size,total:115,missing:115-mIndex.size},source:'SIMULATED / V2.9.42 静态同源CSV计算',warning:'本页面采用离线模拟事件重算；没有企业ERP/QMS/RA批准或实时事实。',source_boundary:'SIMULATED_115_KPIS_NON_GXP'};
 const charts=[{name:'按月PO行数',key:'po',rows:group(po.map(x=>({...x,month:x.created_date.slice(0,7)})),'month')},{name:'供应商PO行数',key:'po',rows:group(po,'supplier_id')},{name:'物料PO行数',key:'po',rows:group(po,'material_id')},{name:'QC状态',key:'qc',rows:group(qc,'status')},{name:'库存状态',key:'inventory',rows:group(inv,'status')},{name:'变更状态',key:'changes',rows:group(changes,'status')}];
 snapshot.source_profile={...snapshot.source_profile,charts,tables:snapshot.source_profile.tables.map(t=>({...t,count:({po,qc,inventory:inv,changes,simEvents:sim.rows})[t.key]?.length??t.count}))};
 return {dataset:snapshot,sim,po,qc,inv,changes};}
export async function scopedDecision(q={}){const c=await load(),options=opts(c.raw),scope={month:q.month||'all',supplier:q.supplier||'all',material:q.material||'all',project:q.project||'all',as_of:q.as_of||new Date().toISOString().slice(0,10)};
 for(const [k,values] of Object.entries({month:options.months,supplier:options.suppliers,material:options.materials,project:options.projects}))if(scope[k]!=='all'&&!values.includes(scope[k]))scope[k]='all';return {...datasetFor(scope,c),raw:c.raw};}
export async function decisionModule(kind,id,q={}){const x=await scopedDecision(q),{dataset,sim,raw}=x;let metrics=dataset.metrics,selected=[];
 if(kind==='metric')selected=metrics.filter(m=>m.id===id);
 else if(kind==='group')selected=metrics.filter(m=>m.gid===id);
 else if(kind==='dictionary'||kind==='page')selected=metrics;
 else if(kind==='analysis'){const names=dataset.analysis[Number(id)-1]?.[2]||[];selected=metrics.filter(m=>names.includes(m.name));}
 else if(kind==='rule'){const ids=dataset.source_meta.rule_kpis?.[Number(id)]||[];selected=metrics.filter(m=>ids.includes(m.id));}
 else if(kind==='action'){const ids=dataset.source_meta.action_kpis?.[Number(id)]||[];selected=metrics.filter(m=>ids.includes(m.id));}
 else if(kind==='signal'||kind==='source')selected=metrics.filter(m=>m.evidence?.source_table===id);
 if(!selected.length&&kind!=='signal'&&kind!=='source')throw Error('No matching KPI for requested module');
 const sourceNames=[...new Set(selected.map(m=>m.evidence?.source_table).filter(Boolean))];if(kind==='source')sourceNames.push(id);
 const sources={simEvents:sim.rows,po:x.po,qc:x.qc,inventory:x.inv,changes:x.changes,docs:sim.sourceTables.docs,production:raw.production.filter(r=>sim.rows.some(x=>x.lot_id===r.lot_id)),suppliers:raw.suppliers};
 const tables=[...new Set(sourceNames)].filter(k=>sources[k]).map(k=>({table:k,route:k==='simEvents'?'sim-center':'overview',count:sources[k].length,rows:sources[k]}));
 return {kind,id,title:kind==='metric'?selected[0]?.name:kind==='group'?(dataset.groups.find(g=>g.id===id)?.name||id):'模拟来源和公式明细',scope:dataset.source_meta.scope,source_meta:dataset.source_meta,metrics:selected,tables,source_tables:dataset.source_profile.tables,computed:selected.filter(x=>x.status==='已计算').length,missing:selected.filter(x=>x.status!=='已计算').length,analysis_steps:['1. 选用统一SIMULATED事件与对应PO、供应商、物料、项目主键。','2. 根据筛选范围逐事件计算分子、分母及唯一业务ID。',...selected.map(m=>m.id+'：'+m.formula+'；分子='+m.numerator+'，分母='+m.denominator),'3. 模拟质量、注册和财务事件不等于真实审批，业务结论需独立复核。'],conclusions:selected.map(m=>m.name+'：'+m.value+' '+m.unit).slice(0,115)};
}
/** XLSX in a static Bolt publication – includes 115 *recalculating* formulas, not CSV copies. */
export async function downloadOfflineWorkbook(q={},name='Pharma_115_KPI_SIMULATED_Formula.xlsx',selection={kind:'page',id:'01'}){
 const [{sim,dataset},xlsx]=await Promise.all([scopedDecision(q),import('/engine/browser_xlsx_v2939.mjs')]);
 const selected=await decisionModule(selection.kind||'page',selection.id||'01',q);
 const selectedIds=new Set(selected.metrics.map(m=>m.id));
 const rows=sim.rows,keys=Object.keys(rows[0]||{}),letter=n=>{let x='';while(n){x=String.fromCharCode(65+(n-1)%26)+x;n=Math.floor((n-1)/26)}return x};
 const idx=k=>letter(keys.indexOf(k)+1),R=k=>`'模拟指标事件'!${idx(k)}2:${idx(k)}${rows.length+1}`;
 const simRows=[keys,...rows.map(r=>keys.map(k=>r[k]!==''&&Number.isFinite(Number(r[k]))&&!/^20\d\d-\d\d-\d\d$/.test(String(r[k]))?Number(r[k]):r[k]??''))];
 const suppliers=[...new Set(rows.map(x=>x.supplier_id))].sort(),countries=[...new Set(rows.map(x=>x.supplier_country))].sort();
 const supRows=[['供应商','采购总金额','金额更大的供应商数','同额先出现数','TOP5入选','TOP5金额'],...suppliers.map((v,i)=>[v,xlsx.xlFormula(`SUMIF(${R('supplier_id')},A${i+2},${R('amount_usd')})`),xlsx.xlFormula(`COUNTIF(B$2:B$${suppliers.length+1},">"&B${i+2})`),xlsx.xlFormula(`COUNTIF(B$2:B${i+2},B${i+2})-1`),xlsx.xlFormula(`IF(C${i+2}+D${i+2}<5,1,0)`),xlsx.xlFormula(`B${i+2}*E${i+2}`)])];
 const countryRows=[['来源国','采购总金额'],...countries.map((v,i)=>[v,xlsx.xlFormula(`SUMIF(${R('supplier_country')},A${i+2},${R('amount_usd')})`)])];
 const changes=sim.sourceTables.changes,docs=sim.sourceTables.docs;
 const changeRows=[['变更编号','状态','风险等级','未关闭','高风险未关闭'],...changes.map((r,i)=>[r.change_id,r.status,r.risk_level,xlsx.xlFormula(`IF(OR(B${i+2}="Closed",B${i+2}="Completed",B${i+2}="Complete"),0,1)`),xlsx.xlFormula(`IF(AND(D${i+2}=1,C${i+2}="High"),1,0)`)])];
 const docRows=[['文件编号','类型','到期日期','在未来90天内到期'],...docs.map((r,i)=>[r.document_id,r.document_type,r.expiry_date,xlsx.xlFormula(`IF(AND(B${i+2}="DOC-004",C${i+2}>='范围'!$B$3,C${i+2}<=TEXT(DATEVALUE('范围'!$B$3)+90,"yyyy-mm-dd")),1,0)`)])];
 const regs=await import('/engine/simulation_kpi_v2942.mjs');
 // Normalized per-source-row helper formulas, not Excel array COUNTIF(range,range)
 // tricks. Each unique key/flag is explicitly counted once under the current
 // filter; columns reference the same raw event rows exported above.
 const helperSpecs=new Map();
 function ukey(key,flag=''){const tag=key+(flag?' | '+flag+'=1':'');if(!helperSpecs.has(tag))helperSpecs.set(tag,{key,flag,col:letter(helperSpecs.size+2)});return helperSpecs.get(tag)}
 for(const m of dataset.metrics.filter(m=>selectedIds.has(m.id))){const spec=regs.SIM_KPI_REGISTRY.get(m.id);
  if(spec.type==='distinct'||spec.type==='pct_distinct'){ukey(spec.fields[0],spec.fields[1]||'');if(spec.type==='pct_distinct')ukey(spec.fields[0]);}
  if(spec.type==='po_per_fte')ukey('buyer_owner');
 }
 const distinctRows=[['来源事件ID',...[...helperSpecs.keys()]]];
 for(let i=0;i<rows.length;i++){const rowNum=i+2,one=[rows[i].event_id];for(const entry of helperSpecs.values()){
  const main=idx(entry.key),ref=`'模拟指标事件'!${main}${rowNum}`;
  if(!entry.flag)one.push(xlsx.xlFormula(`IF(AND(${ref}<>"",COUNTIF('模拟指标事件'!${main}$2:${main}${rowNum},${ref})=1),1,0)`));
  else{const flag=idx(entry.flag),flagref=`'模拟指标事件'!${flag}${rowNum}`;
   one.push(xlsx.xlFormula(`IF(AND(${ref}<>"",${flagref}=1,COUNTIFS('模拟指标事件'!${main}$2:${main}${rowNum},${ref},'模拟指标事件'!${flag}$2:${flag}${rowNum},1)=1),1,0)`));
  }
 }distinctRows.push(one)}
 const totalU=(key,flag='')=>{const {col}=ukey(key,flag);return `SUM('逐行唯一计数'!${col}2:${col}${rows.length+1})`};
 const forecastRows=[['事件ID','绝对预测误差'],...rows.map((r,i)=>[r.event_id,xlsx.xlFormula(`ABS('模拟指标事件'!${idx('forecast_qty')}${i+2}-'模拟指标事件'!${idx('actual_qty')}${i+2})`)])];
 const summary=[['KPI-ID','Excel真实公式结果','独立JS计算基线','单位','指标名','分子','分母','计算口径']];
 for(const m of dataset.metrics.filter(m=>selectedIds.has(m.id))){const spec=regs.SIM_KPI_REGISTRY.get(m.id);let f=regs.simulatedExcelFormula(m.id,keys,rows.length,dataset.source_meta.scope);
  if(spec.type==='open_changes')f=`SUM('模拟变更'!D2:D${Math.max(2,changeRows.length)})`;
  if(spec.type==='high_risk_changes')f=`SUM('模拟变更'!E2:E${Math.max(2,changeRows.length)})`;
  if(spec.type==='cert_90_days')f=`SUM('模拟文件'!D2:D${Math.max(2,docRows.length)})`;
  if(spec.type==='top_country')f=`IFERROR(100*MAX('国家采购额'!B2:B${countryRows.length})/SUM('国家采购额'!B2:B${countryRows.length}),0)`;
  if(spec.type==='top_suppliers')f=`IFERROR(100*SUM('供应商采购额'!F2:F${supRows.length})/SUM('供应商采购额'!B2:B${supRows.length}),0)`;
  if(spec.type==='po_per_fte')f=`IFERROR(COUNTA(${R('event_id')})/${totalU('buyer_owner')},0)`;
  if(spec.type==='distinct')f=totalU(spec.fields[0],spec.fields[1]||'');
  if(spec.type==='pct_distinct')f=`IFERROR(100*${totalU(spec.fields[0],spec.fields[1])}/${totalU(spec.fields[0])},0)`;
  if(spec.type==='forecast_accuracy')f=`IFERROR(100*(1-SUM('逐行预测误差'!B2:B${forecastRows.length})/SUM(${R('actual_qty')})),0)`;
  if(!f)throw Error('Offline Excel missing KPI formula: '+m.id);
  // The JS KPI contract rounds to two decimal places. Match that contract
  // explicitly in Excel, rather than comparing raw unrounded intermediate values.
  summary.push([m.id,xlsx.xlFormula(`ROUND(${f},2)`),Number(m.value),m.unit,m.name,m.numerator,m.denominator,m.formula]);
 }
 const dictionary=[['KPI-ID','专业术语','变量键','字段含义/运算条件','来源定位'],...selected.metrics.flatMap(m=>{
  const spec=regs.SIM_KPI_REGISTRY.get(m.id);return (spec?.fields?.length?spec.fields:['event_id']).map(field=>[m.id,spec?.type||'unknown',field,m.required_fields||'来源字段须经业务Owner核验',m.evidence?.source_table||'simEvents']);
 })];
 const comparison=[['KPI-ID','网页JS重算值','Excel公式结果（引用KPI公式表）','逐格同值（可重算）','原始指标公式']];
 for(let i=1;i<summary.length;i++)comparison.push([summary[i][0],summary[i][2],xlsx.xlFormula(`'KPI公式'!B${i+1}`),xlsx.xlFormula(`IF(OR(NOT(ISNUMBER(B${i+1})),NOT(ISNUMBER(C${i+1}))),"MISSING",IF(ABS(B${i+1}-C${i+1})<0.000001,"MATCH","DIFF"))`),summary[i][7]]);
 const sourceSheets=selected.tables.map(t=>({name:('模块来源_'+t.table).slice(0,31),rows:(()=>{
  const keys=[...new Set(t.rows.flatMap(r=>Object.keys(r)))];return [keys,...t.rows.map(row=>keys.map(k=>typeof row[k]==='object'?JSON.stringify(row[k]):row[k]??''))];
 })()}));
 xlsx.downloadXlsx([{name:'模块分析',rows:[['模块/核验维度','说明'],['模块类型',selection.kind],['模块编号',selection.id],['指标数',selected.metrics.length],['原始来源行数',selected.tables.map(t=>t.table+': '+t.count).join('; ')],['变量与公式',selected.metrics.map(m=>m.id+' '+m.formula).join('\n')],['逐步文字分析',selected.analysis_steps.join('\n')],['风险说明','SIMULATED / Non-GxP，未接企业审批与数据库全量'],['企业签核','PENDING']]},{name:'范围',rows:[['筛选属性','值'],['数据来源','SIMULATED / 非真实企业系统'],['检查日',dataset.source_meta.scope.as_of],['月份',dataset.source_meta.scope.month],['供应商',dataset.source_meta.scope.supplier],['物料',dataset.source_meta.scope.material],['项目',dataset.source_meta.scope.project]]},{name:'KPI公式',rows:summary},{name:'网页Excel逐格对账',rows:comparison},{name:'术语及变量',rows:dictionary},...sourceSheets,{name:'模拟指标事件',rows:simRows},{name:'逐行唯一计数',rows:distinctRows},{name:'逐行预测误差',rows:forecastRows},{name:'模拟变更',rows:changeRows},{name:'模拟文件',rows:docRows},{name:'供应商采购额',rows:supRows},{name:'国家采购额',rows:countryRows}],name);
}
