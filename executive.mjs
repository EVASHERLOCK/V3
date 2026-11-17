/** Executive homepage: computed from the SAME demonstrator PO/QC/production sources as KPI module.
 * No invented budgets, savings, prices, currencies, or historical baseline.
 */
import {kpiAnalyze, number, round} from './calculations.mjs';
const sum=(items,fn)=>items.reduce((t,x)=>t+fn(x),0);
const keyMonth=s=>String(s||'').slice(0,7);
const variance=(r)=>(number(r.unit_price)-number(r.benchmark_price))*number(r.ordered_qty);
const cost=(r)=>number(r.unit_price)*number(r.ordered_qty);
const when=(s)=>Date.parse(`${s}T00:00:00Z`);
const deltaDays=(a,b)=>Math.round((when(a)-when(b))/86400000);
const distinct=(xs)=>[...new Set(xs)];
export function executiveSummary({po,qc,production,inventory,changes,suppliers},filters={}){
 const full=kpiAnalyze({po,qc,production,inventory,changes});
 const originalMetrics=Object.fromEntries(full.metrics.map(x=>[x.key,x]));
 const months=distinct(po.map(r=>keyMonth(r.created_date)).filter(Boolean)).sort();
 const selectedMonth=months.includes(filters.month)?filters.month:'all';
 const availableSupplier=distinct(po.map(r=>r.supplier_id)).sort();
 const selectedSupplier=availableSupplier.includes(filters.supplier)?filters.supplier:'all';
 const selectedMaterial=distinct(po.map(r=>r.material_id)).includes(filters.material)?filters.material:'all';
 const filtered=po.filter(r=>(selectedMonth==='all'||keyMonth(r.created_date)===selectedMonth)&&
   (selectedSupplier==='all'||r.supplier_id===selectedSupplier)&&(selectedMaterial==='all'||r.material_id===selectedMaterial));
 const amount=sum(filtered,cost),base=sum(filtered,r=>number(r.benchmark_price)*number(r.ordered_qty));
 const ppvAmount=sum(filtered,variance);
 const validPO=filtered.filter(r=>r.promised_date&&r.receipt_date&&Number.isFinite(when(r.promised_date))&&Number.isFinite(when(r.receipt_date)));
 const ontime=validPO.filter(r=>when(r.receipt_date)<=when(r.promised_date)).length;
 const allValid=selectedMonth==='all'&&selectedSupplier==='all'&&selectedMaterial==='all';
 const supplierNames=Object.fromEntries(suppliers.map(s=>[s.supplier_id,s.supplier_name]));
 const by=(field)=>Object.entries(filtered.reduce((o,r)=>{const k=r[field]||'未标明';o[k]=(o[k]||0)+cost(r);return o},{}))
   .map(([id,value])=>({id,name:field==='supplier_id'?supplierNames[id]||id:id,value:round(value,2),share:amount?round(value/amount*100,1):0}))
   .sort((a,b)=>b.value-a.value);
 const bySupplier=by('supplier_id'),byMaterial=by('material_id');
 const weekly=Object.entries(filtered.reduce((o,r)=>{const d=when(r.created_date);if(!Number.isFinite(d))return o;let day=new Date(d),weekDay=day.getUTCDay();day.setUTCDate(day.getUTCDate()-(weekDay+6)%7);let wk=day.toISOString().slice(0,10);o[wk]=(o[wk]||0)+cost(r);return o},{}))
  .sort(([a],[b])=>a.localeCompare(b)).map(([week,spend])=>({week,spend:round(spend,2)}));
 const timeline=Object.entries(filtered.reduce((o,r)=>{let m=keyMonth(r.created_date);o[m]=(o[m]||0)+cost(r);return o},{}))
  .sort(([a],[b])=>a.localeCompare(b)).map(([month,spend])=>({month,spend:round(spend,2)}));
 const late=validPO.filter(r=>when(r.receipt_date)>when(r.promised_date)).map(r=>({po_id:r.po_id,supplier_id:r.supplier_id,supplier:supplierNames[r.supplier_id]||r.supplier_id,material_id:r.material_id,
   days_late:deltaDays(r.receipt_date,r.promised_date),amount:round(cost(r),2),reason:'供应商交付超出承诺日期',type:'delivery'}));
 const price=filtered.filter(r=>variance(r)>0).map(r=>({po_id:r.po_id,supplier_id:r.supplier_id,supplier:supplierNames[r.supplier_id]||r.supplier_id,material_id:r.material_id,
   variance_amount:round(variance(r),2),variance_pct:number(r.benchmark_price)?round((number(r.unit_price)-number(r.benchmark_price))/number(r.benchmark_price)*100,1):null,
   amount:round(cost(r),2),reason:'实际采购单价高于基准价（非已核实异常）',type:'price'})).sort((a,b)=>b.variance_amount-a.variance_amount);
 const totalLots=qc.length;
 const openChanges=changes.filter(x=>!['closed','complete','completed'].includes(String(x.status||'').toLowerCase())).length;
 return {
   demo:true, provenance:'与 KPI 模块共用 PO/QC/生产模拟数据；数据为演示用途，非真实采购经营成果。',
   period_note:'当前 PO 示例覆盖 '+months.join('、')+'，并非连续 12 个月；未伪造同期趋势。',
   currency_note:'PO 样例无币种字段：以下金额仅表示样例账面数值，不标为人民币或美元。',
   filters:{month:selectedMonth,supplier:selectedSupplier,material:selectedMaterial},options:{months,suppliers:availableSupplier.map(id=>({id,name:supplierNames[id]||id})),materials:distinct(po.map(r=>r.material_id)).sort()},
   scope:{po_rows:filtered.length,valid_otd_rows:validPO.length,material_types:byMaterial.length,unique_suppliers:distinct(filtered.map(r=>r.supplier_id)).length},
   kpis:{spend:round(amount,2),po_lines:filtered.length,supplier_count:distinct(filtered.map(r=>r.supplier_id)).length,otd:validPO.length?round(100*ontime/validPO.length,1):null,
     otd_numerator:ontime,otd_denominator:validPO.length,ppv:base?round(ppvAmount/base*100,2):null,ppv_amount:round(ppvAmount,2),open_changes:openChanges,
     readiness:allValid?originalMetrics.availability.value:null,readiness_n:allValid?originalMetrics.availability.denominator:null,
     budget:null,savings:null},
   charts:{weekly,monthly:timeline,suppliers:bySupplier,materials:byMaterial,delivery:{early:validPO.filter(r=>when(r.receipt_date)<when(r.promised_date)).length,
     ontime:validPO.filter(r=>when(r.receipt_date)===when(r.promised_date)).length,late:late.length},
     price_risks:byMaterial.map(x=>{let rows=filtered.filter(r=>r.material_id===x.id),b=sum(rows,r=>number(r.benchmark_price)*number(r.ordered_qty));return {...x,ppv:b?round(sum(rows,variance)/b*100,2):null}})},
   late_po:late.sort((a,b)=>b.days_late-a.days_late),price_risks:price.slice(0,5),
   insight:allValid?{otd:originalMetrics.otd.value,ready:originalMetrics.availability.value,affected:full.unavailable.length,
     note:'供应商到仓交付与生产可用性分母不同，差异用于发现跨部门问题，不视为同一漏斗转化率。'}:null,
   missing:['预算执行率 — 无预算台账','年度降本达成 — 无 Savings Ledger','同比/环比 — 当前示例没有可比历史期间','货币汇总 — 样例未提供币种'],
   links:[{label:'供应商寻源与报价',id:'m03'},{label:'采购与合同执行',id:'m05'},{label:'采购策略与 KPI',id:'m10'},{label:'供应商资质/文件',id:'documents'}]
 }
}
