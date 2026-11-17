/** V2.9.35 decision-center reconciled read-model.
 * DEMO reads the same canonical samples and core KPI algorithms used by the existing
 * procurement pages. Enterprise is opt-in, strictly private and NEVER falls back to DEMO.
 * Unsupported KPIs remain visibly unverified with their full data contract and gaps.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {kpiAnalyze} from './calculations.mjs';
import {explainMetric} from './decision_center_definitions_v2935.mjs';
import {simulateKPIs} from './simulation_kpi_v2942.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE=JSON.parse(fs.readFileSync(path.join(ROOT,'decision_center_template_v2934.json'),'utf8'));
const FILES={po:'purchase_orders.csv',qc:'qc_lots.csv',production:'production.csv',inventory:'inventory.csv',changes:'change_controls.csv',suppliers:'suppliers.csv',docs:'supplier_documents.csv'};
function parseCSV(t){const lines=[],cols=[];let field='',q=false,row=[];for(let i=0;i<t.length;i++){const c=t[i];if(c==='"'){if(q&&t[i+1]==='"'){field+='"';i++}else q=!q}else if(c===','&&!q){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&t[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x!==''))lines.push(row);row=[]}else field+=c}row.push(field);if(row.some(x=>x!==''))lines.push(row);const keys=(lines.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,''));return lines.map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]??'']))) }
const demoSource=()=>{const simulated=process.env.PHARMA_DATA_MODE==='SIMULATED';const result=Object.fromEntries(Object.entries(FILES).map(([k,f])=>[k,parseCSV(fs.readFileSync(path.join(ROOT,simulated&&fs.existsSync(path.join(ROOT,'seed_simulated',f))?'seed_simulated':'samples',f),'utf8'))]));
 if(simulated){for(const [name,table] of Object.entries({simEvents:'metric_events',materials:'materials',projects:'projects',product_lines:'product_lines',invoices:'invoices',payments:'payments',claims:'claims'})){const f=path.join(ROOT,'seed_simulated',table+'.csv');if(!fs.existsSync(f))throw Error('SIMULATED source missing '+f);result[name]=parseCSV(fs.readFileSync(f,'utf8'));}}
 return result;};
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const n=x=>finite(x)?Number(x):0;
const sum=(a,f)=>a.reduce((t,r)=>t+n(f(r)),0);
const round=(v,p=2)=>Number(Number(v).toFixed(p));
const unique=(a)=>[...new Set(a.filter(x=>x!==undefined&&x!==null&&x!==''))].sort();
const date=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))?Date.parse(x+'T00:00:00Z'):null;
const validDates=(a,b)=>date(a)!==null&&date(b)!==null;
const isClosed=s=>['closed','completed','complete'].includes(String(s||'').toLowerCase());
const days=(a,b)=>validDates(a,b)?Math.round((date(a)-date(b))/86400000):null;
const stableScope=(q,source)=>{const all={month:String(q.month||'all'),supplier:String(q.supplier||'all'),material:String(q.material||'all'),project:String(q.project||'all'),source:q.source==='enterprise'?'enterprise':'demo',as_of:/^20\d\d-\d\d-\d\d$/.test(String(q.as_of||''))?String(q.as_of):new Date().toISOString().slice(0,10)};const months=unique(source.po.map(x=>x.created_date?.slice(0,7))),suppliers=unique([...source.po.map(x=>x.supplier_id),...source.changes.map(x=>x.supplier_id)]),materials=unique([...source.po.map(x=>x.material_id),...source.production.map(x=>x.material_id),...source.changes.map(x=>x.material_id)]),projects=unique((source.simEvents||[]).map(x=>x.project_id));if(all.month!=='all'&&!months.includes(all.month))all.month='all';if(all.supplier!=='all'&&!suppliers.includes(all.supplier))all.supplier='all';if(all.material!=='all'&&!materials.includes(all.material))all.material='all';if(all.project!=='all'&&!projects.includes(all.project))all.project='all';return {scope:all,options:{months,suppliers,materials,projects}};};
function normalizedEnterprise(facts){
 const po=(facts.purchaseOrders||[]).map(r=>({po_id:r.id,supplier_id:r.supplier_id,material_id:r.material_id,created_date:r.created_date,approved_date:'',promised_date:r.due_date||'',receipt_date:r.received_date||'',ordered_qty:r.qty,received_qty:r.received,unit_price:r.price_usd,benchmark_price:r.baseline_usd,currency:r.currency,source_row:r.source_row}));
 const qms=(facts.qmsEvents||[]).map(r=>({...r,source_row:r.source_row}));
 const suppliers=unique(po.map(r=>r.supplier_id)).map(supplier_id=>({supplier_id,supplier_name:supplier_id,approved_status:'未验证',risk_level:'Unknown'}));
 return {po,qc:[],production:[],inventory:[],changes:[],suppliers,docs:[],qms};
}
function scopeTables(raw,s){
 const isScope=r=>(s.supplier==='all'||r.supplier_id===s.supplier)&&(s.material==='all'||r.material_id===s.material);
 const month=(r,col)=>s.month==='all'||String(r[col]||'').slice(0,7)===s.month;
 const projectScope=r=>s.project==='all'||r.project_id===s.project;const po=raw.po.filter(r=>isScope(r)&&projectScope(r)&&month(r,'created_date'));
 const qc=raw.qc.filter(r=>isScope(r)&&projectScope(r)&&month(r,'gr_date'));
 const inv=raw.inventory.filter(r=>isScope(r)&&projectScope(r)),changes=raw.changes.filter(r=>isScope(r)&&projectScope(r)&&month(r,'opened_date'));
 const qcByLot=new Map(raw.qc.map(r=>[r.lot_id,r]));
 const invByLot=new Map(raw.inventory.map(r=>[r.lot_id,r]));
 const production=raw.production.filter(r=>projectScope(r)&&(s.material==='all'||r.material_id===s.material)&&month(r,'required_date')&&(s.supplier==='all'||(qcByLot.get(r.lot_id)?.supplier_id||invByLot.get(r.lot_id)?.supplier_id)===s.supplier));
 const suppliers=raw.suppliers.filter(r=>s.supplier==='all'||r.supplier_id===s.supplier);
 const docs=raw.docs.filter(r=>s.supplier==='all'||r.supplier_id===s.supplier);
 const qms=(raw.qms||[]).filter(r=>isScope(r)&&month(r,'opened_at'));
 return {po,qc,production,inventory:inv,changes,suppliers,docs,qms,simEvents:(raw.simEvents||[]).filter(r=>isScope(r)&&projectScope(r)&&month(r,'month')),full:raw};
}
function sourceProfile(src,scope){
 const counter=(a,key)=>Object.entries(a.reduce((m,r)=>{const k=String(r[key]||'未分类');m[k]=(m[k]||0)+1;return m},{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
 const num=(rows)=>rows.length;
 const tables=[...(src.simEvents?.length?[{key:'simEvents',name:'模拟业务指标事件（完整115项）',count:src.simEvents.length,route:'sim-center',freshness:'按PO创建月份及统一主键筛选'}]:[]),{key:'po',name:'采购订单（PO）',count:num(src.po),route:'m05',freshness:'按创建日期筛选'},{key:'qc',name:'QC来料批次',count:num(src.qc),route:'m01',freshness:'按GR日期筛选'},{key:'production',name:'生产需求与齐套',count:num(src.production),route:'m01',freshness:'按需求日期筛选'},{key:'inventory',name:'库存批次',count:scope.month==='all'?num(src.inventory):null,route:'m06',freshness:scope.month==='all'?'库存当前清单，无历史时点':'缺少按月库存快照'},{key:'changes',name:'Change Control',count:num(src.changes),route:'m09',freshness:'按变更创建日筛选'},{key:'suppliers',name:'供应商主数据',count:num(src.suppliers),route:'ss-technical',freshness:'当前主数据'},{key:'docs',name:'供应商文件',count:num(src.docs),route:'ss-compliance',freshness:'当前文件主数据'},{key:'qms',name:'QMS事件',count:num(src.qms),route:'ss-compliance',freshness:'已发布QMS事件（如有）'}];
 const validPo=src.po.filter(p=>validDates(p.promised_date,p.receipt_date));
 return {tables,charts:[{name:'按月PO行数',key:'po',rows:counter(src.po.map(r=>({...r,period:r.created_date?.slice(0,7)})),'period')},{name:'供应商PO行数',key:'po',rows:counter(src.po,'supplier_id')},{name:'物料PO行数',key:'po',rows:counter(src.po,'material_id')},{name:'QC状态',key:'qc',rows:counter(src.qc,'status')},{name:'库存状态',key:'inventory',rows:scope.month==='all'?counter(src.inventory,'status'):[]},{name:'变更状态',key:'changes',rows:counter(src.changes,'status')}],facts:{po_lines:src.po.length,valid_delivery_lines:validPo.length,late_delivery_lines:validPo.filter(p=>date(p.receipt_date)>date(p.promised_date)).length,qc_lots:src.qc.length,production_lines:src.production.length,changes:src.changes.length},note:'图中显示的来源记录量不是未有完整口径的KPI结果。点击可查逐行明细。'};
}
function rulesAndActions(metrics,alerts){
 const mt=Object.fromEntries(metrics.map(x=>[x.id,x]));
 const idx=(ids)=>ids.map(id=>mt[id]).filter(Boolean),result=ids=>idx(ids).map(m=>m.status==='已计算'?`${m.name} ${m.value}${m.unit}`:`${m.name} 待接入`).join('；');
 const ruleRefs={4:['KPI-04-01'],5:['KPI-03-02'],6:['KPI-03-03'],7:['KPI-06-01','KPI-03-04'],13:['KPI-05-01'],14:['KPI-05-10'],21:['KPI-07-09'],25:['KPI-08-01'],30:['KPI-11-06']};
 const extendedRuleRefs={1:['KPI-04-06'],2:['KPI-09-04'],3:['KPI-09-03'],8:['KPI-01-05'],9:['KPI-01-07'],10:['KPI-03-08'],11:['KPI-03-05'],12:['KPI-03-06'],15:['KPI-05-09'],16:['KPI-06-05'],17:['KPI-06-09'],18:['KPI-07-08'],19:['KPI-07-02'],20:['KPI-07-03','KPI-06-06'],22:['KPI-08-11'],23:['KPI-08-05'],24:['KPI-08-09'],26:['KPI-09-06'],27:['KPI-09-08'],28:['KPI-10-02'],29:['KPI-10-06','KPI-10-08']};
 const effectiveRefs={...extendedRuleRefs,...ruleRefs};
 const simulation=metrics.every(m=>m.status==='已计算'&&m.evidence?.availability==='SIMULATED_EVENT_RECOMPUTED');
 const rules=TEMPLATE.rules.map((r,i)=>{const x=[...r],ids=effectiveRefs[i+1]||[];
  x[3]=ids.length?'本次模拟数据核对：'+result(ids):'规则阈值和事件触发需要另外的业务批准';
  x[6]=ids.some(id=>mt[id]?.status==='已计算')?(simulation?'模拟数据已核对；实际触发待批准':'待配置'):'待接入';return x});
 const actionRefs={1:['KPI-04-01'],2:['KPI-08-02'],3:['KPI-03-02','KPI-03-03'],4:['KPI-04-01'],5:['KPI-05-10'],6:['KPI-06-01','KPI-03-04'],7:['KPI-05-01'],8:['KPI-01-03'],9:['KPI-03-01'],10:['KPI-11-06'],11:['KPI-08-01'],12:['KPI-11-06'],13:['KPI-07-09'],14:['KPI-07-09'],15:['KPI-11-06'],16:['KPI-03-01'],17:['KPI-01-01'],18:['KPI-05-01'],19:['KPI-08-02'],20:['KPI-05-10'],21:['KPI-08-01'],22:['KPI-04-01'],23:['KPI-08-01'],24:['KPI-03-01']};
 const actions=TEMPLATE.actions.map((a,i)=>{let b=[...a],ids=actionRefs[i+1]||[];b[5]='当前可核对：'+(ids.length?result(ids):'缺少当前源表')+'。该建议尚未生成业务工单；请先核验证据与责任归属。';if(i===0)b[1]=b[1].replace('两条','待核实的');if(i===1)b[1]=b[1].replace('两种','待核实的');if(i===2)b[1]=b[1].replace('两条',String(mt['KPI-03-02']?.value||'待核实')+'条');if(i===6)b[1]=b[1].replace('33 天与 28.7 天','不同来源');return b});
 const byName=Object.fromEntries(metrics.map(m=>[m.name,m]));
 const analysis=TEMPLATE.analysis.map((a,i)=>({id:String(i+1).padStart(2,'0'),title:a[0],domain:a[1],metric_ids:a[2].map(name=>byName[name]?.id).filter(Boolean),description:a[3],chain:a[4],owner:a[5]}));
 return {rules,actions,analysis,actionRefs,ruleRefs:effectiveRefs};
}
function constructMetrics(src,scope,meta){
 const map=new Map(),sources={simEvents:src.simEvents||[],po:src.po,qc:src.qc,production:src.production,inventory:src.inventory,changes:src.changes,suppliers:src.suppliers,docs:src.docs,qms:src.qms};
 const periodInventory=scope.month==='all';
 const rowScope=scope.supplier==='all'&&scope.material==='all'&&scope.month==='all';
 const add=(id,number,unit,source,formula,table,rows,{numerator=null,denominator=null,reason='',route='',excel_key=''}={})=>{
   if(!Number.isFinite(Number(number)))return;
   map.set(id,{value:String(round(Number(number),unit==='%'?2:2)),unit,status:'已计算',source,formula,source_table:table,numerator,denominator,route,reason,excel_key,rows:(rows||sources[table]||[]).map(r=>({...r})),count:(rows||sources[table]||[]).length});
 };
 const amount=p=>n(p.ordered_qty)*n(p.unit_price),base=p=>n(p.ordered_qty)*n(p.benchmark_price);
 const validPrice=src.po.filter(p=>finite(p.ordered_qty)&&finite(p.unit_price)&&(!meta.enterprise||p.currency==='USD'));
 const validBase=validPrice.filter(p=>finite(p.benchmark_price)&&n(p.benchmark_price)>0);
 const purchased=src.po.filter(p=>String(p.po_id||'').trim());
 const onTime=p=>validDates(p.promised_date,p.receipt_date)&&date(p.receipt_date)<=date(p.promised_date);
 const delivered=src.po.filter(p=>validDates(p.promised_date,p.receipt_date));
 const late=delivered.filter(p=>!onTime(p));
 const amountUnit=meta.enterprise?'USD':'账面金额（币种未核）';
 if(validPrice.length===src.po.length&&validPrice.length){add('KPI-01-01',sum(validPrice,amount),amountUnit,'采购总概览 → PO统一明细','SUM(ordered_qty×unit_price)', 'po',validPrice,{numerator:sum(validPrice,amount),denominator:null,route:'m02',excel_key:'spend'});}
 if(validBase.length===src.po.length&&validBase.length){const ppv=sum(validBase,p=>(n(p.unit_price)-n(p.benchmark_price))*n(p.ordered_qty)),b=sum(validBase,base);if(b>0)add('KPI-01-03',100*ppv/b,'%','采购总概览 → PO统一价差','100×SUM((unit_price−benchmark_price)×ordered_qty)/SUM(benchmark_price×ordered_qty)', 'po',validBase,{numerator:ppv,denominator:b,route:'m02',excel_key:'ppv',reason:meta.enterprise?'企业来源已正规化USD':'原始样例未标币种；仅演示同一数据表内部的价差比率，正式使用需校验币种'})}
 add('KPI-03-01',purchased.length,'行','合同与采购执行 → PO统一明细','COUNT(DISTINCT po_id)', 'po',purchased,{numerator:purchased.length,denominator:null,route:'m05',excel_key:'po_lines'});
 add('KPI-03-02',late.length,'条','合同与采购执行 → 到货/承诺日期','COUNT(receipt_date > promised_date)', 'po',late,{numerator:late.length,denominator:delivered.length,route:'m05',excel_key:'late_po',reason:'此处统计已收货迟交的PO行；不能与尚未收货的未履约逾期混淆'});
 if(!meta.enterprise||src.po.every(p=>p.currency==='USD'))add('KPI-03-03',sum(late,amount),amountUnit,'合同与采购执行 → 迟交PO名义敞口','SUM(迟交PO的ordered_qty×unit_price)', 'po',late,{numerator:sum(late,amount),denominator:null,route:'m05',excel_key:'late_value',reason:'此为迟交订单关联名义金额，不是额外损失金额'});
 const validOTIF=delivered.filter(p=>finite(p.ordered_qty)&&finite(p.received_qty));
 if(validOTIF.length){const good=validOTIF.filter(p=>onTime(p)&&n(p.received_qty)>=n(p.ordered_qty));add('KPI-03-04',100*good.length/validOTIF.length,'%','PO执行 → 按时且足量','100×COUNT(到货按时 AND 实收量≥订购量)/COUNT(有效交付数量和日期的PO行)', 'po',validOTIF,{numerator:good.length,denominator:validOTIF.length,route:'m05',excel_key:'otif',reason:'逐PO行一次性收货口径；多批次/拆单需正式收货事件明细补充'});}
 if(src.production.length){const qcByLot=new Map(src.full.qc.map(x=>[x.lot_id,x]));const p=src.production.map(r=>{const qc=qcByLot.get(r.lot_id);const ready=!!(qc&&qc.status==='Released'&&validDates(qc.release_date,r.required_date)&&date(qc.release_date)<=date(r.required_date)&&n(r.allocated_qty)>=n(r.required_qty));return {...r,linked_qc_status:qc?.status||'',linked_qc_release_date:qc?.release_date||'',ready_flag:ready?1:0}});const good=p.filter(r=>r.ready_flag===1);add('KPI-04-01',100*good.length/p.length,'%','需求与物料计划 → 生产需求/QC批次','100×SUM(已于需求日前放行且分配量≥需求量的生产需求行)/COUNT(生产需求行)', 'production',p,{numerator:good.length,denominator:p.length,route:'m01',excel_key:'readiness',reason:'关联本网站同源 QC_lots，QA批次放行并非由绩效中心批准'});}
 if(periodInventory){add('KPI-05-01',unique(src.inventory.map(r=>r.lot_id)).length,'批','原材料生命周期 → inventory.csv','COUNT(DISTINCT lot_id)', 'inventory',src.inventory,{numerator:src.inventory.length,route:'m06',excel_key:'inventory_lots',reason:'当前库存文件无快照时间戳，因此不支持按月历史回溯'});
  const rel=src.inventory.filter(r=>r.status==='Released'&&finite(r.quantity));if(rel.length){add('KPI-05-02',sum(rel,r=>r.quantity),'原始数量（单位待核）','原材料生命周期 → 当前库存清单','SUM(quantity WHERE status=Released)；应按material_id及计量单位分组', 'inventory',rel,{numerator:sum(rel,r=>r.quantity),route:'m06',excel_key:'released_qty',reason:'同一演示源表的数量合计，正式计量需补物料基础单位；不得作为货币或跨单位总量'});}
  if(src.inventory.length){const restricted=src.inventory.filter(r=>r.status!=='Released');add('KPI-05-10',100*restricted.length/src.inventory.length,'%','原材料生命周期 → 库存质量状态','100×COUNT(非Released批次)/COUNT(库存全部批次)', 'inventory',src.inventory,{numerator:restricted.length,denominator:src.inventory.length,route:'m06',excel_key:'hold_lots_ratio',reason:'明确采用批次数占比，不是数量/金额占比；正式KPI口径需确认'});}}
 if(delivered.length)add('KPI-06-01',100*delivered.filter(onTime).length/delivered.length,'%','采购总概览 → 供应商准时交付','100×COUNT(receipt_date≤promised_date)/COUNT(承诺和到货日均有效的PO行)', 'po',delivered,{numerator:delivered.filter(onTime).length,denominator:delivered.length,route:'ss-performance',excel_key:'otd'});
 const open=src.changes.filter(r=>!isClosed(r.status));add('KPI-08-01',open.length,'项','变更控制与全球RA工作台 → Change台账','COUNT(DISTINCT change_id WHERE status NOT IN Closed/Completed)', 'changes',open,{numerator:open.length,route:'m09',excel_key:'open_change'});
 if(src.full.suppliers.length&&src.changes.length){const risks=new Map(src.full.suppliers.map(r=>[r.supplier_id,String(r.risk_level).toLowerCase()]));const high=open.filter(r=>risks.get(r.supplier_id)==='high');add('KPI-08-02',high.length,'项','变更台账 × 供应商风险等级','COUNT(在途且supplier.risk_level=High的ChangeID)', 'changes',open.map(r=>({...r,source_risk_level:risks.get(r.supplier_id)||'未知'})),{numerator:high.length,route:'m09',excel_key:'high_risk_change',reason:'供应商风险来源只是演示主数据标签，并不等于受控Change风险结论'});}
 if(periodInventory&&src.docs.length){const cert=src.docs.filter(r=>r.document_type==='DOC-004'&&date(r.expiry_date)!==null);if(cert.length){const upcoming=cert.filter(r=>date(r.expiry_date)>=date(scope.as_of)&&days(r.expiry_date,scope.as_of)<=90);add('KPI-07-09',upcoming.length,'项','供应商合规 → GMP示例文件到期检查','COUNT(DOC-004有效到期日期落入[检查日,检查日+90天]的文件)', 'docs',cert,{numerator:upcoming.length,denominator:cert.length,route:'ss-compliance',excel_key:'cert_expiry_90',reason:'仅样例DOC-004 GMP证照类型；没有证明涵盖所有适用市场文件，已过期单列风险信号'});}}
 if(meta.enterprise&&src.qms.length){const dev=src.qms.filter(r=>r.kind==='DEVIATION');add('KPI-06-05',dev.length,'项','企业发布QMS快照 → DEVIATION','COUNT(供应商关联且kind=DEVIATION的QMS事件)', 'qms',dev,{numerator:dev.length,route:'ss-compliance',excel_key:'qms_dev'});
   const capa=src.qms.filter(r=>r.kind==='CAPA'&&r.due_date),done=capa.filter(r=>r.status==='CLOSED'&&r.closed_at&&date(r.closed_at)<=date(r.due_date));if(capa.length)add('KPI-06-06',100*done.length/capa.length,'%','企业发布QMS → CAPA履约','100×COUNT(CAPA按期关闭)/COUNT(有到期日的CAPA)', 'qms',capa,{numerator:done.length,denominator:capa.length,route:'ss-compliance',excel_key:'capa_ontime'});}
 if(rowScope&&!meta.enterprise){ // scope-sensitive, explicit candidate linkage contract
  const full=src.full,poSet=new Set(full.po.map(x=>x.po_id)),supSet=new Set(full.suppliers.map(x=>x.supplier_id)),lotSet=new Set(full.qc.map(x=>x.lot_id));const links=[...full.po.map(p=>({from:p.po_id,to:p.supplier_id,link:'PO.supplier_id → Supplier',ok:supSet.has(p.supplier_id)})),...full.qc.map(q=>({from:q.lot_id,to:q.po_id,link:'QC.po_id → PO',ok:poSet.has(q.po_id)})),...full.production.map(p=>({from:p.production_order,to:p.lot_id,link:'Production.lot_id → QC',ok:lotSet.has(p.lot_id)})),...full.changes.map(c=>({from:c.change_id,to:c.supplier_id,link:'Change.supplier_id → Supplier',ok:supSet.has(c.supplier_id)}))];if(links.length)add('KPI-11-06',100*links.filter(x=>x.ok).length/links.length,'%','全站PO/QC/生产/Change主键关联','100×COUNT(关联目标主键存在)/COUNT(纳入验证的主键关联)', 'links',links,{numerator:links.filter(x=>x.ok).length,denominator:links.length,route:'master',excel_key:'link_integrity',reason:'仅对本网站当前演示示例的四类外键进行验证，不等于全部ERP/QMS/MDM链路已验证'});}
 // ONLY simulated mode receives the 115-event mapping; legacy / enterprise retains original strict contract.
 let noSimulatedEvents=false;
 if(process.env.PHARMA_DATA_MODE==='SIMULATED'&&!meta.enterprise){
   const sim=simulateKPIs(TEMPLATE,src.full,scope);
   if(sim.rows.length){for(const [id,m] of sim.metrics)map.set(id,m);sources.simEvents=sim.rows;
      src.simEvents=sim.rows;src.changes=sim.sourceTables.changes;src.docs=sim.sourceTables.docs;}
   else {map.clear();noSimulatedEvents=true;src.simEvents=[];sources.simEvents=[];}
 }
 const groupTable={'d01':'po','d02':'po','d03':'po','d04':'production','d05':'inventory','d06':'qc','d07':'docs','d08':'changes','d09':'po','d10':'suppliers','d11':'po'};
 const metrics=TEMPLATE.metrics.map(m=>{const explain=explainMetric(m),p=map.get(m.id);const base={...m,formula:explain.formula,required_fields:explain.needs,exclusions:explain.exclude,analysis_steps:explain.steps,contract_notice:explain.notice,value:'—',status:noSimulatedEvents?'无匹配模拟记录':'待接入',unit:m.unit,source:m.source,numerator:null,denominator:null,missing_reason:noSimulatedEvents?'当前多条件筛选没有同键关联的模拟PO事件；禁止沿用全站数值':`缺少支撑正式口径的字段/审批：${explain.needs}`,evidence:{source_table:groupTable[m.gid]||'po',rows:[],count:0,source:m.source,scope,route:'',formula:explain.formula,availability:noSimulatedEvents?'SIMULATED_SCOPE_EMPTY':'NOT_VERIFIED'}};
 if(!p)return base;
 return {...base,value:p.value,unit:p.unit,status:p.status,source:p.source,formula:p.formula,numerator:p.numerator,denominator:p.denominator,missing_reason:'',analysis_observation:`本次可核验来源记录 ${p.count} 条；计算结果 ${p.value} ${p.unit}。${p.reason||''}`,evidence:{source_table:p.source_table,rows:p.rows,count:p.count,scope,source:p.source,route:p.route,excel_key:p.excel_key,availability:p.simulation?'SIMULATED_EVENT_RECOMPUTED':'DEMO_SOURCE_RECOMPUTED',reason:p.reason,formula:p.formula,simulation_contract:p.simulation_contract}};
 });
 return {metrics,metricIndex:new Map(metrics.map(x=>[x.id,x])),fullSource:src,counts:{computed:map.size,total:metrics.length,missing:metrics.length-map.size}};
}
function computeAlerts(src,scope,metricIndex){
 const dateNow=date(scope.as_of);
 const qcHold=src.qc.filter(r=>String(r.status).toLowerCase()!=='released');
 const late=src.po.filter(r=>validDates(r.receipt_date,r.promised_date)&&date(r.receipt_date)>date(r.promised_date));
 const short=src.production.filter(r=>finite(r.allocated_qty)&&finite(r.required_qty)&&n(r.allocated_qty)<n(r.required_qty));
 const expired=src.docs.filter(r=>date(r.expiry_date)!==null&&date(r.expiry_date)<dateNow);
 const changeLate=src.changes.filter(r=>!isClosed(r.status)&&date(r.target_date)!==null&&date(r.target_date)<dateNow);
 const invalidSupplier=src.po.filter(r=>{let s=src.full.suppliers.find(x=>x.supplier_id===r.supplier_id);return s&&s.approved_status!=='Approved'});
 return [{id:'delivery',name:'收货日期晚于承诺日期的PO',count:late.length,table:'po',rows:late,formula:'COUNT(PO.receipt_date > PO.promised_date)',metric_ids:['KPI-03-02','KPI-06-01'],source:'合同与采购执行',route:'m05',status:'源记录可核查'},
 {id:'allocation',name:'生产已分配量小于需求量',count:short.length,table:'production',rows:short,formula:'COUNT(allocated_qty < required_qty)',metric_ids:['KPI-04-01'],source:'需求与物料计划',route:'m01',status:'源记录可核查'},
 {id:'qc-hold',name:'QC批次仍非Released状态',count:qcHold.length,table:'qc',rows:qcHold,formula:'COUNT(QC.status <> Released)',metric_ids:['KPI-04-01','KPI-05-10'],source:'QC状态表（非质量判定）',route:'m01',status:'源记录可核查'},
 {id:'cert-expired',name:'供应商文件样例中已超有效期',count:expired.length,table:'docs',rows:expired,formula:'COUNT(expiry_date < 检查日)',metric_ids:['KPI-07-09'],source:'供应商文件台账',route:'ss-compliance',status:'文件日期核查；适用性待QA确认'},
 {id:'change-due',name:'未关闭Change超过目标日期',count:changeLate.length,table:'changes',rows:changeLate,formula:'COUNT(status != Closed AND target_date < 检查日)',metric_ids:['KPI-08-01'],source:'Change Control',route:'m09',status:'源记录可核查'},
 {id:'supplier-pending',name:'样例供应商尚非Approved的PO',count:invalidSupplier.length,table:'po',rows:invalidSupplier,formula:'COUNT(PO.supplier_id关联Sample Supplier.approved_status <> Approved)',metric_ids:['KPI-11-06'],source:'样例供应商主数据；非受控ASL',route:'ss-compliance',status:'仅数据质量核查，非采购权限判定'}].map(a=>({...a,scope,notice:'客观来源核查信号，不表示正式业务预警已批准。触发阈值与处置决策需业务Owner签核。',rows:a.rows}));
}
function makeUniverse(query={},options={}){
 const enterprise=query.source==='enterprise';
 if(enterprise&&!options.enterpriseFacts)throw Object.assign(new Error('受控企业快照未授权或未发布；禁止回退DEMO'),{code:'NO_ENTERPRISE_SOURCE'});
 const raw=enterprise?normalizedEnterprise(options.enterpriseFacts):demoSource();
 if(!raw.qms)raw.qms=[];
 const {scope,options:opts}=stableScope(query,raw);
 const scoped=scopeTables(raw,scope);
 const result=constructMetrics(scoped,scope,{enterprise});
 const alerts=computeAlerts(scoped,scope,result.metricIndex);
 const extra=rulesAndActions(result.metrics,alerts);
 const sources=sourceProfile(scoped,scope);
 const simulation=!enterprise&&process.env.PHARMA_DATA_MODE==='SIMULATED';const source_meta={source:enterprise?'企业受控发布快照（仅分析、非GxP）':simulation?'SIMULATED / 全站统一模拟采购事实与业务事件':'原网站同源 samples/ DEMO 原始记录',snapshot:enterprise?options.enterpriseFacts.scope?.snapshot_id:'site-demo-csv-current',scope,options:opts,coverage:result.counts,source_boundary:enterprise?'CONTROLLED_ENTERPRISE_NON_GXP':simulation?'SIMULATED_115_KPIS_NON_GXP':'DEMO_SAMPLE_NON_GXP',currency:enterprise?'经发布ERP来源正规化为USD':simulation?'SIMULATED / PO数据统一USD；模拟核算非财务账簿':'PO原始样例未提供币种；金额只作演示账面单位',generated_at:new Date().toISOString(),warning:enterprise?'仅经过授权且审计链通过的企业分析快照；不等于QA/RA批准':simulation?'严格模拟：115项指标来自同一PO关联事件模型，审批/资质/市场就绪为模拟旗标，不代表真实QA、RA、财务批准':'当前仍是原网站DEMO数据，未接入真实ERP/QMS/RA；来源不明的指标拒绝伪造',source_tables:sources.tables,rule_kpis:extra.ruleRefs,action_kpis:extra.actionRefs};
 return {groups:TEMPLATE.groups,metrics:result.metrics,analysis:TEMPLATE.analysis,rules:extra.rules,actions:extra.actions,scenario:TEMPLATE.scenario,analyses:extra.analysis,signals:alerts.map(a=>({...a,rows:undefined})),source_profile:sources,source_meta,table_data:scoped,ruleRefs:extra.ruleRefs,actionRefs:extra.actionRefs};
}
export function buildDecisionDataset(query={},options={}){const result=makeUniverse(query,options);const {table_data,ruleRefs,actionRefs,...publicData}=result;
 return {...publicData,metrics:publicData.metrics.map(m=>({...m,evidence:{...m.evidence,rows:[]}}))};}
export function buildDecisionEvidence(query={},options={}){const universe=makeUniverse(query,options),m=universe.metrics.find(x=>x.id===query.metric);return m?{metric:m,scope:universe.source_meta.scope,source_meta:universe.source_meta,calculation_contract:{formula:m.formula,required_fields:m.required_fields,exclusions:m.exclusions,analysis_steps:m.analysis_steps,numerator:m.numerator,denominator:m.denominator,source:m.source,rows:m.evidence.rows,provenance:m.evidence.availability},source_overview:universe.source_profile.tables}:null;}
const routeForSource={simEvents:'sim-center',po:'m05',qc:'m01',production:'m01',inventory:'m06',changes:'m09',suppliers:'ss-technical',docs:'ss-compliance',qms:'ss-compliance',links:'master'};
export function buildDecisionModule(query={},options={}){
 const uni=makeUniverse(query,options),{kind='group',id='d01'}=query;
 let title='',ids=[],signal=null,sourceKey='',method='';
 if(kind==='metric'){const metric=uni.metrics.find(x=>x.id===id);if(!metric)return null;title=metric.name;ids=[metric.id];method='metric'}
 else if(kind==='group'){const grp=uni.groups.find(x=>x.id===id);if(!grp)return null;title=grp.name;ids=grp.metrics;method='group'}
 else if(kind==='analysis'){const item=uni.analyses[Number(id)-1];if(!item)return null;title=item.title;ids=item.metric_ids;method='analysis'}
 else if(kind==='rule'){const idx=Number(id)-1,rule=uni.rules[idx];if(!rule)return null;title=rule[1];ids=uni.ruleRefs[Number(id)]||[];method='rule'}
 else if(kind==='action'){const idx=Number(id)-1,a=uni.actions[idx];if(!a)return null;title=a[1];ids=uni.actionRefs[Number(id)]||[];method='action'}
 else if(kind==='signal'){const alarms=computeAlerts(uni.table_data,uni.source_meta.scope,new Map());signal=alarms.find(x=>x.id===id);if(!signal)return null;title=signal.name;ids=signal.metric_ids;sourceKey=signal.table;method='signal'}
 else if(kind==='source'){if(!(id in routeForSource))return null;title='来源明细 · '+id;sourceKey=id;method='source'}
 else if(kind==='dictionary'){title='全量 KPI 指标字典';ids=uni.metrics.map(x=>x.id);method='dictionary'}
 else if(kind==='page'){if(!/^0[1-5]$/.test(id))return null;title=['全局 KPI 结果总览','KPI 深度分析与归因','自动预警与管理决策','行动建议与责任闭环','指标字典与系统治理'][Number(id)-1];ids=uni.metrics.map(x=>x.id);method='page'}
 else return null;
 const selected=uni.metrics.filter(m=>ids.includes(m.id));
 const checked=selected.filter(x=>x.status==='已计算');
 const candidates=selected.filter(x=>x.status!=='已计算');
 let tables=[];
 if(!sourceKey&&selected.every(m=>m.status!=='已计算')){const sourceByDomain={"供应连续性":'production',"库存与效期":'inventory',"PO与交付":'po',"合同与流程":'po',"供应商质量":'qc',"注册与变更":'changes',"供应商合规":'docs',"数据与治理":'suppliers',"成本与预算":'po',"物流与供应商韧性":'po'};
  if(kind==='rule')sourceKey=sourceByDomain[uni.rules[Number(id)-1]?.[0]]||'po';
  else if(kind==='action')sourceKey=/变更|RA|验证/.test(title)?'changes':/库存|临期/.test(title)?'inventory':/齐套|缺料/.test(title)?'production':'po';
  else if(kind==='analysis')sourceKey=/库存|效期/.test(title)?'inventory':/质量|批次/.test(title)?'qc':/变更|市场|RA/.test(title)?'changes':/寻源|供应商/.test(title)?'suppliers':'po';
 }
 if(sourceKey){const signalRows=sourceKey==='links'?(uni.metrics.find(m=>m.id==='KPI-11-06')?.evidence?.rows||[]):(uni.table_data[sourceKey]||[]);const found=signal?signal.rows:signalRows;tables=[{table:sourceKey,route:routeForSource[sourceKey],count:signal?signal.count:signalRows.length,rows:found}];}
 else{
  const map=new Map();for(const m of checked){const key=m.evidence?.source_table;if(!key)continue;const existing=map.get(key)||{table:key,route:routeForSource[key],rows:new Map()};for(const r of m.evidence.rows||[])existing.rows.set(JSON.stringify(r),r);map.set(key,existing)}
  tables=[...map.values()].map(v=>({table:v.table,route:v.route,count:v.rows.size,rows:[...v.rows.values()]}));
 }
 // All selected metrics have an explicit calculation contract even if their necessary source is absent.
 const observed=checked.map(m=>`${m.name}：${m.value} ${m.unit}（分子 ${m.numerator??'不适用'}；分母 ${m.denominator??'不适用'}；源记录 ${m.evidence.count} 行）`);
 const gaps=candidates.map(m=>`${m.name}：${m.required_fields}`).slice(0,115);
 const analysis_steps=[
  `1. 锁定 ${uni.source_meta.scope.month} / ${uni.source_meta.scope.supplier} / ${uni.source_meta.scope.material} / ${uni.source_meta.scope.project} 的统一筛选范围以及数据来源 ${uni.source_meta.source_boundary}。`,
  '2. 先核对逐行事实、关联主键、时间戳与计量单位；账面金额不能混称USD；同一PO/批次/变更不可重复计数。',
  `3. 按本模块涉及的 ${selected.length} 项KPI逐一取源：当前可核验 ${checked.length} 项；缺源 ${candidates.length} 项。`,
  ...checked.map(m=>`4. ${m.name}：${m.formula}；分子=${m.numerator??'不适用'}，分母=${m.denominator??'不适用'}；若另含 PPV 与 OTD 等组合指标，必须分别核对各自分母与交叉范围。`),
  '5. 对任何偏差，优先比较本次筛选的逐PO/批次/变更明细与同范围对照；本页没有正式对照期或阈值时，不自动归因为供应商原因。',
  '6. 建议行动只生成待核验证据和拟定责任人；企业正式关闭需签核、系统审计轨迹及效果复核。'
 ];
 const conclusions=[`可验证：${observed.length?observed.join('；'):'尚无能够支持本模块正式KPI公式的完整来源记录。'}`,`待核验：${gaps.length?gaps.join('；'):'本模块已计算指标的正式业务准入和目标阈值仍需数据Owner审核。'}`];
 return {kind,id,title,scope:uni.source_meta.scope,source_meta:uni.source_meta,metrics:selected.map(m=>({...m,evidence:{...m.evidence,rows:[]}})),tables,source_tables:uni.source_profile.tables,analysis_steps,conclusions,computed:checked.length,missing:candidates.length,signal:signal?{id:signal.id,count:signal.count,formula:signal.formula,notice:signal.notice}:null,method,definition:'分析报告先列来源数据及运算结果，再解释缺口和建议；不得用模板文字取代证据。没有计算指标时展示的同行来源记录仅为调查背景，不证明该规则已经触发。'};
}
export function buildDecisionExportFacts(query={},options={}){const universe=makeUniverse(query,options);return {tables:universe.table_data,source_meta:universe.source_meta};}
export function getDecisionMetricAssociations(){const r=rulesAndActions([],[]);return {ruleRefs:r.ruleRefs,actionRefs:r.actionRefs};}
export {TEMPLATE as DECISION_TEMPLATE};
