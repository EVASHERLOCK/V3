/** V2.9.34 decision center: read-only computed snapshot from canonical sample inputs.
 * No fabricated ERP approvals, currencies, budgets, targets or trend series. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {executiveSummary} from './executive.mjs';
import {buildChangeWorkbench} from './change_control_v2931.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const prototype=JSON.parse(fs.readFileSync(path.join(ROOT,'decision_center_template_v2934.json'),'utf8'));
const filenames={po:'purchase_orders.csv',qc:'qc_lots.csv',production:'production.csv',inventory:'inventory.csv',changes:'change_controls.csv',suppliers:'suppliers.csv'};
function parseCSV(t){let rows=[],cells=[],cur='',inQuote=false;for(let i=0;i<t.length;i++){const x=t[i];if(x==='"'){if(inQuote&&t[i+1]==='"'){cur+='"';i++}else inQuote=!inQuote}else if(x===','&&!inQuote){cells.push(cur);cur=''}else if((x==='\r'||x==='\n')&&!inQuote){if(x==='\r'&&t[i+1]==='\n')i++;cells.push(cur);cur='';if(cells.some(Boolean))rows.push(cells);cells=[]}else cur+=x}cells.push(cur);if(cells.some(Boolean))rows.push(cells);const keys=rows.shift().map(x=>x.trim().replace(/^\uFEFF/,''));return rows.map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]||''])))}
const load=()=>Object.fromEntries(Object.entries(filenames).map(([k,f])=>[k,parseCSV(fs.readFileSync(path.join(ROOT,'samples',f),'utf8'))]));
const numeric=x=>Number(x)||0, sum=(rows,fn)=>rows.reduce((a,x)=>a+fn(x),0),round=(n,p=1)=>Math.round(n*10**p)/10**p;
const dates=(a,b)=>a&&b?Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000):null;
export function buildDecisionDataset(query={}){
 const src=load(), selections={month:String(query.month||'all'),supplier:String(query.supplier||'all'),material:String(query.material||'all')};
 const options={months:[...new Set(src.po.map(x=>x.created_date.slice(0,7)))].sort(),suppliers:[...new Set(src.po.map(x=>x.supplier_id))].sort(),materials:[...new Set(src.po.map(x=>x.material_id))].sort()};
 for(const [key,arr] of [['month','months'],['supplier','suppliers'],['material','materials']])if(!options[arr].includes(selections[key]))selections[key]='all';
 const match=x=>(selections.supplier==='all'||x.supplier_id===selections.supplier)&&(selections.material==='all'||x.material_id===selections.material);
 const po=src.po.filter(x=>match(x)&&(selections.month==='all'||x.created_date.slice(0,7)===selections.month));
 const inv=src.inventory.filter(match),production=src.production.filter(x=>(selections.material==='all'||x.material_id===selections.material)),qc=src.qc.filter(match);
 const changes=src.changes.filter(x=>match(x)&&(selections.month==='all'||x.opened_date.slice(0,7)===selections.month));
 const home=executiveSummary({po:src.po,qc:src.qc,production:src.production,inventory:src.inventory,changes:src.changes,suppliers:src.suppliers},selections);
 const cc=buildChangeWorkbench({supplier:selections.supplier,material:selections.material,month:selections.month});
 // All inputs in this package are DEMO and PO has no authenticated currency field.
 const amount=home.kpis.spend, released=inv.filter(x=>x.status==='Released'), validDelivery=po.filter(x=>x.promised_date&&x.receipt_date), late=validDelivery.filter(x=>dates(x.receipt_date,x.promised_date)>0);
 const base=sum(po,x=>numeric(x.benchmark_price)*numeric(x.ordered_qty));
 const currency='账面单位';
 const map={};
 function set(id,value,unit,source,formula,rows,route){if(value===null||value===undefined||!Number.isFinite(Number(value)))return;map[id]={value:String(round(Number(value),unit==='%'?2:0)),unit,source,status:'已展示',formula,evidence:{route,source,rows:rows.slice(0,100),count:rows.length,scope:selections}}}
 set('KPI-01-01',amount,currency,'合同与采购执行 / PO','SUM(PO.ordered_qty × PO.unit_price)，原始样例无币种字段',po,'m05');
 set('KPI-01-03',home.kpis.ppv,'%','采购总概览 / PO','SUM((unit_price−benchmark_price)×ordered_qty)/SUM(benchmark_price×ordered_qty)×100',po,'m02');
 set('KPI-03-01',po.length,'行','合同与采购执行 / PO','COUNT(PO 行；筛选 created_date 月份)',po,'m05');
 set('KPI-03-02',late.length,'条','合同与采购执行 / PO','COUNT(实际收货日期 > 承诺日期)',late,'m05');
 set('KPI-03-03',sum(late,x=>numeric(x.unit_price)*numeric(x.ordered_qty)),currency,'合同与采购执行 / PO','SUM(逾期 PO ordered_qty×unit_price)，币种未核',late,'m05');
 set('KPI-04-01',home.kpis.readiness,'%','采购总概览 / 生产','原站 kpiAnalyze().availability 既有口径，仅全局范围可计算',production,'m01');
 if(selections.month==='all'){ // Sample inventory has no as-of/month history; never repeat full inventory totals under a monthly filter.
   set('KPI-05-01',inv.length,'批','原材料生命周期 / 库存','COUNT(库存 lot_id)，非月份快照',inv,'m06');
   set('KPI-05-02',sum(released,x=>numeric(x.quantity)),'原始库存数量','原材料生命周期 / 库存','SUM(quantity WHERE status=Released)，原始示例未定义通用单位，非月份快照',released,'m06');
 }
 set('KPI-06-01',home.kpis.otd,'%','采购总概览 / 供应商交付','同源PO到货准时率；并非供应商绩效考核批准值',validDelivery,'ss-performance');
 const metrics=prototype.metrics.map(m=>{const replacement=map[m.id];return {...m,value:'—',unit:m.unit,status:'待接入',...replacement,source:replacement?.source||m.source,formula:replacement?.formula||m.formula,evidence:replacement?.evidence||null}});
 const rules=prototype.rules.map(r=>[...r.slice(0,6),'待接入']); // No formal alert thresholds, never infer trigger or approved action from an unapproved draft rule.
 // The 24 unchanged action templates remain planning suggestions, not issued tickets.
 // Their evidence fields are recalculated or explicitly marked unavailable to avoid prototype data becoming false business facts.
 const actions=prototype.actions.map((old,i)=>{
   const a=[...old];
   if(i===2){a[1]=late.length?'逐单核查'+late.length+'条逾期 PO 的实际延误':'复核当前筛选范围内 PO 交付延误口径';a[5]='当前 PO 范围已收货迟交记录 '+late.length+' 条；未签核实际未履约余额';}
   else if(i===3){a[5]='统一范围齐套率 '+(home.kpis.readiness===null?'待接入':home.kpis.readiness+'%')+'；以原采购总概览计算为准';}
   else if(i===5){a[5]='实际同源 PO OTD '+(home.kpis.otd===null?'待接入':home.kpis.otd+'%')+'；OTIF 缺少完整数量/按期双条件数据';}
   else if(i===0||i===1||i===4||i===6){a[5]='现有网站无经核验的该专题源数据/口径；原型截图数字不得作为当前事实';}
   return a;
 });
 const matched=Object.keys(map);
 const facts={source:'V2.9.33 网站现有 DEMO CSV / 变更控制同源分析',snapshot:'sample-files-current',currency:'原始采购订单没有币种字段；不标 USD',scope:selections,options,coverage:{computed:matched.length,total:metrics.length,missing:metrics.length-matched.length},home:{kpis:home.kpis,late_po:home.late_po},change:{kpis:cc.kpis,changes:cc.changes},generated_at:new Date().toISOString(),warning:'未接入企业ERP/QMS/RA的已授权快照；预警、行动不代表真实派单或GxP批准'};
 return {...prototype,metrics,rules,actions,source_meta:facts};
}
export function buildDecisionEvidence(query){const data=buildDecisionDataset(query),m=data.metrics.find(m=>m.id===query.metric);return m?{metric:m,scope:data.source_meta.scope,warning:data.source_meta.warning}:null}
