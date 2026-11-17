/* V0.8 Enterprise read model. All V0.8 extension fixtures are SIMULATED.
 * Only original 24 PO / 12 production lines form the V0.5 deterministic KPI baseline.
 * No live regulatory data, GMP approval, payment or automated external notification.
 */
import fs from 'node:fs';
import {loadMaster,suiteAnalysis,setSuiteScenario} from './suite.mjs';
const EXT=JSON.parse(fs.readFileSync(new URL('./v08_demo.json',import.meta.url),'utf8'));
let M=loadMaster();
const dateDiff=(a,b)=>a&&b?Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000):null;
const num=v=>Number(v)||0;
const sum=(a,fn=x=>x)=>a.reduce((s,x)=>s+num(fn(x)),0);
const percent=(a,b)=>b?Math.round(a/b*1000)/10:null;
const rnd=(a,n=1)=>Number.isFinite(a)?Number(a.toFixed(n)):null;
const group=(a,fn)=>a.reduce((o,x)=>{let k=fn(x)||'Unspecified';(o[k]??=[]).push(x);return o},{});
const pq=p=>num(p.ordered_qty)*num(p.unit_price);
let POMAP=Object.fromEntries(M.po.map(x=>[x.po_id,x]));
let QCMAP=Object.fromEntries(M.qc.map(x=>[x.lot_id,x]));
let MATS=Object.fromEntries(M.materials.map(x=>[x.material_id,x]));
let SUPS=Object.fromEntries(M.suppliers.map(x=>[x.supplier_id,x]));
function topRows(rows,k,field='amount'){return Object.entries(group(rows,x=>x[k])).map(([id,a])=>({id,value:sum(a,x=>x[field]),count:a.length})).sort((a,b)=>b.value-a.value)}
const unique=a=>[...new Set(a)];
function scope(rows,filters={}){return rows.filter(x=>(!filters.supplier||x.supplier_id===filters.supplier)&&(!filters.material||x.material_id===filters.material)&&(!filters.site||x.site_id===filters.site)&&(!filters._supplier_ids||!x.supplier_id||filters._supplier_ids.includes(x.supplier_id))&&(!filters._material_ids||!x.material_id||filters._material_ids.includes(x.material_id)))}
function monthlyComparisons(po,filters){let a=Object.entries(group(po,x=>x.created_date?.slice(0,7))).sort(([a],[b])=>a.localeCompare(b));return a.map(([period,rows],i)=>({period,spend:rnd(sum(rows,pq),2),po_lines:rows.length,previous_period:i?a[i-1][0]:null,prior_month_percent:i?percent(sum(rows,pq)-sum(a[i-1][1],pq),sum(a[i-1][1],pq)):null,year_on_year:null}));}
export function setEnterpriseScenario(next){
 M=setSuiteScenario(next);POMAP=Object.fromEntries(M.po.map(x=>[x.po_id,x]));
 QCMAP=Object.fromEntries(M.qc.map(x=>[x.lot_id,x]));
 MATS=Object.fromEntries(M.materials.map(x=>[x.material_id,x]));
 SUPS=Object.fromEntries(M.suppliers.map(x=>[x.supplier_id,x]));
}
export function enterpriseAnalysis(filters={}){
 const b=suiteAnalysis(filters), today=M.as_of;
 const po=M.po.filter(p=>(!filters.month||p.created_date?.startsWith(filters.month))&&(!filters.year||p.created_date?.startsWith(String(filters.year)))&&(!filters.category||MATS[p.material_id]?.category_group===filters.category)&&(!filters.supplier_class||SUPS[p.supplier_id]?.approved_status===filters.supplier_class)&&(!filters.supplier||p.supplier_id===filters.supplier)&&(!filters.material||p.material_id===filters.material)&&(!filters.site||`SITE-${p.supplier_id.split('-')[1]}`===filters.site));
 const ids=new Set(po.map(p=>p.po_id)), months=monthlyComparisons(po,filters);
 const hasLinkedScope=!!(filters.year||filters.month||filters.supplier_class||filters.category||filters.supplier||filters.material||filters.site);
 const scopedFilters=hasLinkedScope?{...filters,_supplier_ids:unique(po.map(p=>p.supplier_id)),_material_ids:unique(po.map(p=>p.material_id))}:filters;
 const last=months.at(-1),prev=months.at(-2);
 const spend=b.metrics.spend;
 const supplierSpend=topRows(po,'supplier_id','_amount'); // recompute below, as PO _amount does not exist
 const sp=Object.entries(group(po,x=>x.supplier_id)).map(([id,a])=>({id,name:SUPS[id]?.supplier_name||id,value:sum(a,pq),count:a.length})).sort((a,b)=>b.value-a.value);
 const byCategory=Object.entries(group(po,x=>MATS[x.material_id]?.category_group)).map(([id,a])=>({id,value:sum(a,pq),count:a.length}));
 const cr=n=>percent(sum(sp.slice(0,n),x=>x.value),spend);
 const yrSpendHistory=EXT.monthly_history;
 const priceLines=b.spend.by_material.map(x=>({material_id:x.material_id,category:x.category,spend:x.spend,ppv:x.ppv,variance_amount:rnd(sum(po.filter(p=>p.material_id===x.material_id),p=>(num(p.unit_price)-num(p.benchmark_price))*num(p.ordered_qty)),2),supplier_ids:unique(po.filter(p=>p.material_id===x.material_id).map(p=>p.supplier_id)).join(', '),benchmark_price:rnd(sum(po.filter(p=>p.material_id===x.material_id),p=>num(p.benchmark_price)*num(p.ordered_qty))/Math.max(1,sum(po.filter(p=>p.material_id===x.material_id),p=>p.ordered_qty)),2),actual_price:rnd(sum(po.filter(p=>p.material_id===x.material_id),pq)/Math.max(1,sum(po.filter(p=>p.material_id===x.material_id),p=>p.ordered_qty)),2)}));
 const goodSavings=EXT.savings_ledger.filter(x=>(!filters.material||x.material_id===filters.material)&&(!filters.supplier||x.supplier_id===filters.supplier)&&(!filters.supplier_class||SUPS[x.supplier_id]?.approved_status===filters.supplier_class)&&(!filters.category||MATS[x.material_id]?.category_group===filters.category)&&(!filters.year||String(x.start||'').startsWith(String(filters.year)))&&(!filters.month||String(x.start||'').startsWith(filters.month)));
 const realized=sum(goodSavings.filter(x=>x.finance_approval==='Simulated signed-off'),x=>x.realized_amount), planned=sum(goodSavings,x=>x.planned_amount);
 const gaps=b.delivery.ready_gaps.map(g=>({...g,short_qty:Math.max(0,num(g.required_qty)-num(g.allocated_qty)),impact_amount:rnd(num(g.required_qty)*num(POMAP[g.po_id]?.unit_price),2),priority:Math.abs(dateDiff(g.required_date,today)||0)<=7?'HIGH':g.cause==='QC_HOLD'?'HIGH':'MEDIUM',proposed_action:g.cause==='ALLOC_SHORT'?'核实可分配 Released Stock / 制定补料计划':g.cause.startsWith('QC')?'向 QA/QC 发起检验排程协调':'向供应商核实 ETA',estimated_resolve:'需责任部门确认',status:'待处理（示例）'}));
 const qcCovers=gaps.filter(x=>x.cause.startsWith('QC')).map(x=>({production_order:x.production_order,lot_id:x.lot_id,material_id:x.material_id,required_date:x.required_date,estimated_release:QCMAP[x.lot_id]?.release_date||'待 QA 预计',status:QCMAP[x.lot_id]?.status||'—'}));
 const docRegister=scope(EXT.document_register,scopedFilters).map(x=>({...x,days_to_expiry:dateDiff(x.expiry,today),is_current:x.status==='Valid'&&dateDiff(x.expiry,today)>0}));
 const docExpired=docRegister.filter(x=>x.days_to_expiry<=0),doc30=docRegister.filter(x=>x.days_to_expiry>0&&x.days_to_expiry<=30),doc90=docRegister.filter(x=>x.days_to_expiry>30&&x.days_to_expiry<=90);
 const sourceRows=scope(M.approved_sources,scopedFilters).map(x=>{const matching=docRegister.filter(d=>d.supplier_id===x.supplier_id&&d.site_id===x.site_id&&d.material_id===x.material_id);
 const criticalExpired=matching.some(d=>d.type==='GMP Certificate'&&d.days_to_expiry<=0);
 const prequalified=x.approved_for_use===true&&x.in_asl_for_site===true&&x.gmp_audit_status==='Passed'&&x.process_validation==='Complete'&&!criticalExpired;
 return {...x,critical_expired:criticalExpired,prequalified,status:prequalified?'Qualified demo scope':'Not qualified for use',risk:criticalExpired?'HIGH':x.approved_for_use?'LOW':'HIGH'};});
 const audit=scope(EXT.audits,scopedFilters);const quality=M.quality_events.filter(x=>(!filters.supplier||x.supplier_id===filters.supplier)&&(!filters.material||x.material_id===filters.material)&&(!hasLinkedScope||po.some(p=>p.supplier_id===x.supplier_id&&p.material_id===x.material_id)));
 const lots=b.material.lots.map(x=>({...x,days_to_expiry:dateDiff(x.expiry_date,today),days_to_retest:dateDiff(x.retest_date,today),age_days:Math.max(0,dateDiff(today,QCMAP[x.lot_id]?.gr_date)||0),stale:dateDiff(today,QCMAP[x.lot_id]?.gr_date)>90,expiring:dateDiff(x.retest_date,today)<=90||dateDiff(x.expiry_date,today)<=90}));
 const inQC=lots.filter(l=>l.status!=='Released');const invAtRisk=lots.filter(l=>l.expiring||l.stale);
 const poStatus=po.map(p=>{const delay=dateDiff(p.receipt_date,p.promised_date);return {...p,amount:pq(p),delay_days:delay??0,state:!p.receipt_date?'In transit':delay>0?'Late delivered':'Received',supplier_name:SUPS[p.supplier_id]?.supplier_name||p.supplier_id,quality_document:'Verify CoA',priority:delay>7?'HIGH':delay>0?'MEDIUM':'LOW'};});
 const contracts=scope(M.contracts,scopedFilters).map(x=>({...x,days_to_expiry:dateDiff(x.expiry,today),po_spend:sum(po.filter(p=>p.supplier_id===x.supplier_id&&p.material_id===x.material_id),pq),drawdown:null}));
 const invoices=b.p2p.invoices.map(x=>{let due=EXT.invoice_due.find(y=>y.invoice_id===x.invoice_id),age=dateDiff(today,x.invoice_date);return {...x,due_date:due?.due_date,days_overdue:dateDiff(today,due?.due_date),age_days:age,owner:due?.owner,days_to_pay:due?.paid_date?dateDiff(due.paid_date,x.invoice_date):null};});
 const changes=b.regulatory.changes.map(x=>({...x,remaining_days:dateDiff(x.target_date,today),elapsed_days:dateDiff(today,x.opened_date),severity:x.status==='Closed'?'LOW':x.category.toLowerCase().includes('site')?'HIGH':'MEDIUM',owner:'QA/RA',affected_value:null,linked_filings:b.regulatory.filings.filter(y=>y.change_id===x.change_id).length}));
 const reg=scope(EXT.regulatory_rules,scopedFilters).filter(x=>!filters.month||x.effective.startsWith(filters.month));
 const documentsGaps=scope(EXT.document_gaps,scopedFilters);
 let topAlerts=[...b.risk.alerts,...docExpired.map(x=>({id:'AL-DOC-'+x.doc_id,severity:'HIGH',title:'受控文件已到期 · '+x.supplier_id,detail:x.doc_id+' / '+x.type,owner:'QA',root_cause:'DOCUMENT_EXPIRED',evidence:[x.doc_id],strategy:'阻止在演示规则中用于新准入，提交 QA 复核'})),...reg.filter(x=>x.severity==='HIGH'&&x.gap_status!=='Closed').map(x=>({id:'AL-REG-'+x.rule_id,severity:'HIGH',title:'法规差距评估（模拟） · '+x.market,detail:x.title,owner:'RA',root_cause:'REG_GAP',evidence:[x.rule_id],strategy:'创建 RA 影响评估任务'}))];
 topAlerts=topAlerts.sort((a,b)=>(a.severity==='HIGH'?0:1)-(b.severity==='HIGH'?0:1));
 const tasks=[...topAlerts.map((x,i)=>({id:'ACT-'+String(i+1).padStart(3,'0'),alert_id:x.id,title:x.title,category:x.type||'Compliance',severity:x.severity,owner:x.owner,status:'待处理',strategy:x.strategy,root_cause:x.root_cause,evidence:x.evidence,expected_impact:null,deadline:'待确认'}))];
 const docBins=['已到期','0–30 天','31–90 天','91–180 天','>180 天'].map((label,i)=>({label,count:docRegister.filter(x=>i===0?x.days_to_expiry<=0:i===1?x.days_to_expiry>0&&x.days_to_expiry<=30:i===2?x.days_to_expiry>30&&x.days_to_expiry<=90:i===3?x.days_to_expiry>90&&x.days_to_expiry<=180:x.days_to_expiry>180).length}));
 return {meta:{...EXT.metadata,currency:M.currency,filters,data_scope:M.scenario_source?'UPLOADED WORKBOOK '+M.scenario_source+' · UNPROVIDED EXTENSIONS SIMULATED':'24 baseline PO + explicitly simulated V0.8 extensions',history_note:'所有长期趋势均为模拟情景，不代表现有 PO 实际历史',owner_boundary:'QC / RA / Planning 指标为协同结果，非采购独立绩效'},base:b,
   overview:{current:{spend,po_lines:po.length,suppliers:sp.length,otd:b.metrics.otd,ppv:b.metrics.ppv,ppv_amount:b.metrics.ppv_amount,open_changes:b.metrics.open_changes,ready:b.metrics.ready,budget:M.budget[0]?.budget??null,budget_execution:percent(spend,num(M.budget[0]?.budget)),realized_savings:realized},monthly:months,sim_history:yrSpendHistory,category:byCategory,supplier:sp,cr3:cr(3),cr5:cr(5),cr10:cr(10),late:poStatus.filter(x=>x.delay_days>0),alerts:topAlerts.slice(0,3),variance:priceLines},
   planning:{gaps,production:b.planning.production,forecast:EXT.demand_forecast,weekly:EXT.weekly_history,qc_soon:qcCovers,root_causes:b.risk.root_causes,readiness:b.metrics.ready,owner:'Planning + QA/QC + Procurement'},
   spend:{by_category:byCategory,suppliers:sp,price_lines:priceLines,price_sim_history:yrSpendHistory,ledger:goodSavings,realized_savings:realized,planned_savings:planned,savings_attainment:percent(realized,planned),opportunities:b.spend.saving_opportunities,price_positive:sum(priceLines.filter(x=>x.variance_amount>0),x=>x.variance_amount),price_negative:-sum(priceLines.filter(x=>x.variance_amount<0),x=>x.variance_amount),cr3:cr(3),cr5:cr(5),cr10:cr(10)},
   sourcing:{qualified_sources:sourceRows,supplier_comparison:b.supplier.scorecards,quotes:scope(M.quotes,scopedFilters),documents:docRegister},
   qualification:{sources:sourceRows,documents:docRegister,audits:audit,quality_events:quality,expiring_90:docRegister.filter(x=>x.days_to_expiry<=90).length},
   purchasing:{orders:poStatus,contracts,late:poStatus.filter(x=>x.delay_days>0).sort((a,b)=>b.delay_days-a.delay_days),status_counts:Object.entries(group(poStatus,x=>x.state)).map(([label,rows])=>({label,count:rows.length})),trend:yrSpendHistory},
   material:{lots,qc:b.material.qc,production:b.material.production,inQC,age_bins:['0–90','91–180','181–365','>365'].map((label,i)=>({label,count:lots.filter(x=>i===0?x.age_days<=90:i===1?x.age_days<=180:i===2?x.age_days<=365:x.age_days>365).length})),expiry_bins:['<=90 天','91–180 天','181–365 天','>365 天'].map((label,i)=>({label,count:lots.filter(x=>{let d=Math.min(x.days_to_expiry??9999,x.days_to_retest??9999);return i===0?d<=90:i===1?d<=180:i===2?d<=365:d>365}).length})),value:sum(lots,x=>x.amount),released_amount:sum(lots.filter(x=>x.status==='Released'),x=>x.amount),hold_amount:sum(inQC,x=>x.amount),at_risk_amount:sum(invAtRisk,x=>x.amount),avg_inventory_days:null,turnover_days:null,stockout_cost:null,trace:b.trace,scenarios:yrSpendHistory},
   supplier:{scorecards:b.supplier.scorecards,sources:sourceRows,dependency:b.supplier.scorecards.map(x=>({id:x.supplier_id,name:x.name,spend:x.spend,concentration:percent(x.spend,spend),otd:x.otd,ppv:x.ppv,qualification:x.qualification,quality_events:x.quality_events,alternates:sourceRows.filter(y=>y.supplier_id!==x.supplier_id&&y.prequalified).length})),quality_events:quality,cr3:cr(3),cr5:cr(5)},
   p2p:{invoices,exceptions:invoices.filter(x=>x.match_status!=='Matched'),matched:invoices.filter(x=>x.match_status==='Matched').length,unpaid:invoices.filter(x=>!x.paid).length,aging:['0–30','31–60','61–90','>90'].map((label,i)=>({label,count:invoices.filter(x=>i===0?x.age_days<=30:i===1?x.age_days<=60:i===2?x.age_days<=90:x.age_days>90).length})),paid_cycle:invoices.filter(x=>x.days_to_pay!==null).map(x=>x.days_to_pay)},
   change:{changes,filings:b.regulatory.filings,markets:Object.entries(group(b.regulatory.filings,x=>x.market)).map(([label,rows])=>({label,count:rows.length})),types:Object.entries(group(changes,x=>x.category)).map(([label,rows])=>({label,count:rows.length}))},
   actions:{alerts:topAlerts,tasks,by_type:Object.entries(group(topAlerts,x=>x.type||'Compliance')).map(([label,rows])=>({label,count:rows.length})),sim_history:yrSpendHistory},
   documents:{register:docRegister,gaps:documentsGaps,bins:docBins,expired:docExpired.length,within30:doc30.length,within90:doc90.length,awaiting:docRegister.filter(x=>x.status==='Under review').length,by_type:Object.entries(group(docRegister,x=>x.type)).map(([label,rows])=>({label,count:rows.length}))},
   regulatory:{rules:reg,affected_materials:unique(reg.map(x=>x.material_id)).length,open_gaps:reg.filter(x=>x.gap_status!=='Closed').length,high:reg.filter(x=>x.severity==='HIGH').length,by_market:Object.entries(group(reg,x=>x.market)).map(([label,rows])=>({label,count:rows.length}))},
   workflow:{runs:EXT.workflow_demo,success_rate:percent(EXT.workflow_demo.filter(x=>x.status==='Completed').length,EXT.workflow_demo.length),average_ms:rnd(sum(EXT.workflow_demo,x=>x.duration_ms)/Math.max(1,EXT.workflow_demo.length)),failures:EXT.workflow_demo.filter(x=>x.status==='Failed')},
   reports:{templates:EXT.report_templates},access:{users:EXT.users,roles:EXT.role_matrix,history:EXT.site_audit_trail},master:{materials:M.materials,suppliers:M.suppliers,sites:M.sites,issues:[],products:M.products},
   notifications:{alerts:topAlerts}}
}
