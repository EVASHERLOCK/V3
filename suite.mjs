/* V0.7 unified pharmaceutical procurement analytical model.
 * Pure, deterministic calculations over one explicitly fictional demo dataset.
 * No QA release, regulatory approval or external search performed here.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export function loadMaster(){return JSON.parse(fs.readFileSync(path.join(ROOT,'demo_master.json'),'utf8'))}
const num=x=>Number(x)||0;
const round=(x,p=1)=>Number.isFinite(x)?Number(x.toFixed(p)):null;
const pct=(x,y)=>y?round(x/y*100,1):null;
const sum=(a,f=x=>x)=>a.reduce((s,x)=>s+num(f(x)),0);
const group=(list,fn)=>list.reduce((o,r)=>{const k=fn(r)||'Unspecified';(o[k]??=[]).push(r);return o},{});
const ms=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?Date.parse(d+'T00:00:00Z'):NaN;
const diff=(a,b)=>Number.isFinite(ms(a))&&Number.isFinite(ms(b))?Math.round((ms(a)-ms(b))/86400000):null;
const amount=p=>num(p.ordered_qty)*num(p.unit_price);
const obj=(a,key)=>Object.fromEntries(a.map(x=>[x[key],x]));
let BASE=loadMaster();
let byPO=obj(BASE.po,'po_id'),byQC=obj(BASE.qc,'lot_id'),bySUP=obj(BASE.suppliers,'supplier_id'),byMat=obj(BASE.materials,'material_id');
const status=x=>String(x||'').trim().toLowerCase();
let dims={materials:BASE.materials.map(m=>({id:m.material_id,label:m.material_id+' · '+m.name})),suppliers:BASE.suppliers.map(s=>({id:s.supplier_id,label:s.supplier_name})),months:[...new Set(BASE.po.map(p=>p.created_date?.slice(0,7)).filter(Boolean))].sort(),sites:BASE.sites.map(s=>({id:s.site_id,label:s.site_name}))};
export function setSuiteScenario(next){
 BASE=next?structuredClone(next):loadMaster();
 byPO=obj(BASE.po,'po_id');byQC=obj(BASE.qc,'lot_id');
 bySUP=obj(BASE.suppliers,'supplier_id');byMat=obj(BASE.materials,'material_id');
 dims={materials:BASE.materials.map(m=>({id:m.material_id,label:m.material_id+' · '+m.name})),suppliers:BASE.suppliers.map(s=>({id:s.supplier_id,label:s.supplier_name})),months:[...new Set(BASE.po.map(p=>p.created_date?.slice(0,7)).filter(Boolean))].sort(),sites:BASE.sites.map(s=>({id:s.site_id,label:s.site_name}))};
 return BASE;
}
export function suiteAnalysis({month='',supplier='',material='',site='',year='',category='',supplier_class=''}={}){
 const originPO=BASE.po.filter(p=>(!month||p.created_date?.startsWith(month))&&(!year||p.created_date?.startsWith(String(year)))&&(!category||byMat[p.material_id]?.category_group===category)&&(!supplier_class||bySUP[p.supplier_id]?.approved_status===supplier_class)&&(!supplier||p.supplier_id===supplier)&&(!material||p.material_id===material)&&(!site||'SITE-'+p.supplier_id.split('-')[1]===site));
 const ids=new Set(originPO.map(p=>p.po_id)),sids=new Set(originPO.map(p=>p.supplier_id)),mids=new Set(originPO.map(p=>p.material_id));
 const filterLinked=a=>a.filter(x=>ids.has(x.po_id)||(!x.po_id&&((x.supplier_id&&sids.has(x.supplier_id))||(x.material_id&&mids.has(x.material_id)))));
 const receipts=filterLinked(BASE.receipts),qc=filterLinked(BASE.qc),invoices=filterLinked(BASE.invoices);
 const relatedLot=new Set(qc.map(x=>x.lot_id));
 const production=BASE.production.filter(x=>relatedLot.has(x.lot_id));
 const inventory=BASE.inventory.filter(x=>relatedLot.has(x.lot_id));
 const changes=BASE.changes.filter(x=>mids.has(x.material_id)&&(!supplier||x.supplier_id===supplier));
 const scopedSources=!!(month||supplier||material||site||year||category||supplier_class);const supplierSources=BASE.approved_sources.filter(x=>(!material||x.material_id===material)&&(!supplier||x.supplier_id===supplier)&&(!scopedSources||(sids.has(x.supplier_id)&&mids.has(x.material_id))));
 const spend=sum(originPO,amount), qty=sum(originPO,x=>x.ordered_qty),baseline=sum(originPO,x=>num(x.benchmark_price)*num(x.ordered_qty));
 const ppv=baseline?round((spend-baseline)/baseline*100,2):null;
 const valid=originPO.filter(p=>diff(p.receipt_date,p.promised_date)!==null),ontime=valid.filter(p=>diff(p.receipt_date,p.promised_date)<=0),late=valid.filter(p=>diff(p.receipt_date,p.promised_date)>0),early=valid.filter(p=>diff(p.receipt_date,p.promised_date)<0);
 const latePO=late.map(p=>({po_id:p.po_id,supplier_id:p.supplier_id,material_id:p.material_id,days_late:diff(p.receipt_date,p.promised_date),amount:amount(p),evidence:[p.po_id,'GR-'+p.po_id]})).sort((a,b)=>b.days_late-a.days_late);
 const bySupplier=Object.entries(group(originPO,x=>x.supplier_id)).map(([id,rows])=>{
  let due=rows.filter(x=>diff(x.receipt_date,x.promised_date)!==null),on=due.filter(x=>diff(x.receipt_date,x.promised_date)<=0),base=sum(rows,x=>num(x.ordered_qty)*num(x.benchmark_price)),sp=sum(rows,amount),quality=BASE.quality_events.filter(x=>x.supplier_id===id&&relatedLot.has(x.lot_id));
  return {supplier_id:id,name:bySUP[id]?.supplier_name||id,spend:round(sp,2),po_lines:rows.length,otd:pct(on.length,due.length),otd_n:due.length,ppv:base?pct(sp-base,base):null,price_gap:round(sp-base,2),quality_events:quality.length,quality_acceptance:null,qualification:bySUP[id]?.approved_status||'Unknown',risk:bySUP[id]?.risk_level||'Unknown',site_id:'SITE-'+id.split('-')[1],materials:[...new Set(rows.map(x=>x.material_id))]};
 }).sort((a,b)=>b.spend-a.spend);
 const byMaterial=Object.entries(group(originPO,x=>x.material_id)).map(([id,rows])=>{
  let sp=sum(rows,amount),base=sum(rows,x=>num(x.ordered_qty)*num(x.benchmark_price));return {material_id:id,category:byMat[id]?.category_group||'Unknown',spend:round(sp,2),qty:sum(rows,x=>x.ordered_qty),po_lines:rows.length,ppv:base?pct(sp-base,base):null,price_gap:round(sp-base,2),supplier_count:new Set(rows.map(x=>x.supplier_id)).size}
 }).sort((a,b)=>b.spend-a.spend);
 const timeline=Object.entries(group(originPO,x=>x.created_date?.slice(0,7))).sort(([a],[b])=>a.localeCompare(b)).map(([period,rows])=>({period,spend:round(sum(rows,amount),2),po_lines:rows.length}));
 const currentLot=Object.fromEntries(qc.map(l=>[l.lot_id,l]));
 let ready=0, gaps=[];
 for(const p of production){const q=currentLot[p.lot_id];const can=q&&status(q.status)==='released'&&diff(q.release_date,p.required_date)!==null&&diff(q.release_date,p.required_date)<=0&&num(p.allocated_qty)>=num(p.required_qty);
  if(can){ready++;continue};let cause=!q?'MISSING_LOT':num(p.allocated_qty)<num(p.required_qty)?'ALLOC_SHORT':status(q.status)!=='released'?'QC_HOLD':'QC_CYCLE_LONG';
  let poRow=byPO[q?.po_id]||{};
  gaps.push({production_order:p.production_order,material_id:p.material_id,lot_id:p.lot_id,supplier_id:q?.supplier_id||poRow.supplier_id||'',po_id:q?.po_id||'',required_date:p.required_date,required_qty:num(p.required_qty),allocated_qty:num(p.allocated_qty),cause,owner:cause==='ALLOC_SHORT'?'Warehouse / Planning':'QA/QC',evidence:[p.production_order,p.lot_id,q?.po_id].filter(Boolean)});
 }
 const qcDays=qc.filter(x=>status(x.status)==='released'&&diff(x.release_date,x.gr_date)!==null).map(x=>({lot_id:x.lot_id,po_id:x.po_id,material_id:x.material_id,supplier_id:x.supplier_id,days:diff(x.release_date,x.gr_date)}));
 const qcMean=qcDays.length?round(sum(qcDays,x=>x.days)/qcDays.length,1):null;
 const qcBins=[{label:'0–5 天',count:qcDays.filter(x=>x.days<=5).length},{label:'6–10 天',count:qcDays.filter(x=>x.days>5&&x.days<=10).length},{label:'11–15 天',count:qcDays.filter(x=>x.days>10&&x.days<=15).length},{label:'超过 15 天',count:qcDays.filter(x=>x.days>15).length}];
 const today=BASE.as_of, inventoryLots=inventory.map(x=>{
  const dayCandidates=[diff(x.retest_date,today),diff(x.expiry_date,today)].filter(x=>x!==null);let until=dayCandidates.length?Math.min(...dayCandidates):null,poRef=byQC[x.lot_id]?.po_id,unit_price=num(byPO[poRef]?.unit_price)||null;
  return {...x,quantity:num(x.quantity),days_to_control:until,amount:unit_price!==null?round(unit_price*num(x.quantity),2):null,estimated_valuation:unit_price!==null,linked_po:poRef||'',q_status:byQC[x.lot_id]?.status||'Unknown'}
 });
 const invAmount=sum(inventoryLots,x=>x.amount),holdLots=inventoryLots.filter(x=>status(x.status)!=='released'),expired=inventoryLots.filter(x=>x.days_to_control!==null&&x.days_to_control<=90),releasedLots=inventoryLots.filter(x=>status(x.status)==='released');
 const invByState=Object.entries(group(inventoryLots,x=>x.status)).map(([status,rows])=>({status,lots:rows.length,amount:round(sum(rows,x=>x.amount),2)}));
 const invoicesMatched=invoices.map(i=>{
  const p=byPO[i.po_id],r=receipts.find(x=>x.po_id===i.po_id),price_ok=Math.abs(num(i.unit_price)-num(p?.unit_price))<0.001,qty_ok=num(i.invoiced_qty)<=num(r?.received_qty),supplier_ok=i.supplier_id===p?.supplier_id;
  return {...i,invoice_amount:round(num(i.invoiced_qty)*num(i.unit_price)+num(i.tax_amount),2),match_status:price_ok&&qty_ok&&supplier_ok?'Matched':!supplier_ok?'Supplier mismatch':!price_ok?'Price mismatch':'Quantity mismatch',evidence:[i.invoice_id,i.po_id,r?.gr_id].filter(Boolean)};
 });
 const supplierRisk=bySupplier.map(x=>({...x,concentration:pct(x.spend,spend),classification:x.otd!==null&&x.otd<85?'Delivery concern':x.qualification!=='Approved'?'Qualification gap':'Monitor',qualification_scope:BASE.approved_sources.filter(s=>s.supplier_id===x.supplier_id&&s.approved_for_use).map(s=>s.material_id)}));
 const activeCC=changes.filter(c=>status(c.status)!=='closed');
 const filings=BASE.filings.filter(f=>activeCC.some(c=>c.change_id===f.change_id));
 const risks=[
  ...(gaps.length?[{id:'AL-DELIVERY',type:'Material readiness gap',severity:'HIGH',owner:'Planning + QA/QC + Procurement',title:`${gaps.length} 条生产需求缺料风险`,detail:`按期到货与可投产日期存在差距；${gaps.filter(g=>g.cause.startsWith('QC')).length} 条需要质量状态复核。`,evidence:gaps.flatMap(g=>g.evidence).slice(0,18),root_cause:'QC_CYCLE_LONG / QC_HOLD / ALLOC_SHORT',strategy:'QC 优先排程申请 / 合格备选询价 / PO 前置',impact:gaps.length}]:[]),
  ...(latePO.length?[{id:'AL-PO',type:'Supplier delivery',severity:'MEDIUM',owner:'Procurement',title:`${latePO.length} 条 PO 超过承诺日期`,detail:'按承诺日与仓库收货日比对，需确认供应商原因。',evidence:latePO.map(x=>x.po_id),root_cause:'SUP_DELAY',strategy:'生成催交草稿 / 更新预计交期',impact:latePO.length}]:[]),
  ...(holdLots.length?[{id:'AL-QC',type:'Quality-controlled inventory',severity:'MEDIUM',owner:'QA/QC',title:`${holdLots.length} 批在检或受控库存`,detail:'不得把未放行库存作为可用于生产数量。',evidence:holdLots.map(x=>x.lot_id),root_cause:'QC_HOLD',strategy:'提交检验优先排程请求',impact:holdLots.length}]:[]),
  ...(activeCC.length?[{id:'AL-CHANGE',type:'Regulatory / Change',severity:'HIGH',owner:'RA / QA',title:`${activeCC.length} 项开放变更待评估`,detail:'跨市场实施条件按受影响产品与国家分别审核。',evidence:activeCC.map(x=>x.change_id),root_cause:'CHANGE_FREEZE',strategy:'发起 RA 评估任务',impact:activeCC.length}]:[]),
  ...(invoicesMatched.some(x=>x.match_status!=='Matched')?[{id:'AL-P2P',type:'Invoice exceptions',severity:'LOW',owner:'Procurement / AP',title:`${invoicesMatched.filter(x=>x.match_status!=='Matched').length} 张发票存在匹配异常`,detail:'价格/数量差异需要匹配和财务复核。',evidence:invoicesMatched.filter(x=>x.match_status!=='Matched').map(x=>x.invoice_id),root_cause:'INVOICE_MISMATCH',strategy:'建立对账任务',impact:invoicesMatched.filter(x=>x.match_status!=='Matched').length}]:[])
 ];
 // This is a financial OPPORTUNITY view, not an assertion of realized savings.
 const savingsOp=BASE.savings_opportunities.filter(x=>ids.has(x.po_id)).map(x=>({...x,opportunity_amount:round(Math.max(0,(num(x.baseline_unit_price)-num(x.actual_unit_price))*num(x.quantity)),2),realized:false}));
 const trend=BASE.po.length===originPO.length?BASE.po.map(x=>x.created_date?.slice(0,7)):originPO.map(x=>x.created_date?.slice(0,7));
 return {metadata:{version:'v0.7',demo:true,as_of:BASE.as_of,currency:'DEMO-USD',scope:'24 PO line-level simulated baseline',filtered_po:originPO.length,filters:{month,supplier,material,site},source:'V0.5 source PO, QC, inventory, production and changes + explicitly fictional supplementary linked records',disclaimer:'NOT LIVE / NOT GxP VALIDATED. Savings ledger is opportunity only; pending QC does not imply supplier quality failure.'},dimensions:dims,
  metrics:{spend:round(spend,2),po_lines:originPO.length,supplier_count:bySupplier.length,otd:pct(ontime.length,valid.length),otd_num:ontime.length,otd_den:valid.length,ready:pct(ready,production.length),ready_num:ready,ready_den:production.length,late_po:latePO.length,ppv,ppv_amount:round(spend-baseline,2),ppv_base:round(baseline,2),qc_lead:qcMean,qc_n:qcDays.length,hold_lots:holdLots.length,hold_amount:round(sum(holdLots,x=>x.amount),2),released_amount:round(sum(releasedLots,x=>x.amount),2),inventory_amount:round(invAmount,2),risk_lots:expired.length,risk_amount:round(sum(expired,x=>x.amount),2),open_changes:activeCC.length,invoice_exceptions:invoicesMatched.filter(x=>x.match_status!=='Matched').length,invoice_match_rate:pct(invoicesMatched.filter(x=>x.match_status==='Matched').length,invoicesMatched.length),realized_savings:null,annual_budget:null,budget_note:'未接入经过批准的预算与财务确认 Savings Ledger'},
  home:{timeline,top_suppliers:bySupplier,by_material:byMaterial,delivery_mix:{early:early.length,ontime:valid.filter(x=>diff(x.receipt_date,x.promised_date)===0).length,late:late.length},late_po:latePO.slice(0,10),priority:risks.slice(0,3)},
  delivery:{late_po:latePO,by_supplier:bySupplier,ready_gaps:gaps,readiness_n:production.length,readiness_ok:ready,qc_bins:qcBins,valid_po:valid.length,po_line_evidence:originPO.map(x=>({...x,amount:round(amount(x),2),days_variance:diff(x.receipt_date,x.promised_date)}))},
  spend:{by_material:byMaterial,by_supplier:bySupplier,trend:timeline,price_exceptions:byMaterial.filter(x=>x.ppv!==null&&x.ppv>0),saving_opportunities:savingsOp,cost_note:'PPV ≠ realized savings; only comparable if benchmark and PO currency/unit align. All legacy PO rows are labelled DEMO-USD.',budget:BASE.budget[0]},
  supplier:{scorecards:supplierRisk,qualification:supplierSources,quality_events:BASE.quality_events.filter(x=>relatedLot.has(x.lot_id)),approved_sources:supplierSources,quality_kpi_note:'Pending QC / quarantine is not supplier defect. Quality rate needs conclusive supplier-attributable disposition.'},
  material:{lots:inventoryLots,by_status:invByState,production,readiness_gaps:gaps,qc:qc.map(x=>({...x,qc_days:diff(x.release_date,x.gr_date)})),qc_bins:qcBins,qa_control:'QC status and batch disposition controlled by authorised QA/QC, never this demo.'},
  purchasing:{orders:originPO.map(x=>({...x,amount:round(amount(x),2),days_late:Math.max(0,diff(x.receipt_date,x.promised_date)||0),site_id:'SITE-'+x.supplier_id.split('-')[1]})),late_po:latePO,contracts:BASE.contracts.filter(x=>mids.has(x.material_id)&&sids.has(x.supplier_id)),receipts},
  p2p:{invoices:invoicesMatched,exceptions:invoicesMatched.filter(x=>x.match_status!=='Matched'),matched:invoicesMatched.filter(x=>x.match_status==='Matched').length},
  regulatory:{changes,filings,products:BASE.products.filter(x=>mids.has(x.material_id)),note:'Market-specific classification and implementation are UNVERIFIED placeholders. Not a legal or registration decision.'},
  planning:{production,gaps,forecast_note:'No planning forecast master, future MRP proposals are illustrative, not computed forecasts.'},
  risk:{alerts:risks,root_causes:Object.entries(group(gaps,g=>g.cause)).map(([code,rows])=>({code,count:rows.length})),sources:supplierRisk},
  trace:{material_to_supplier:byMaterial.map(m=>({material_id:m.material_id,suppliers:bySupplier.filter(s=>s.materials.includes(m.material_id)).map(s=>s.supplier_id)})),lot_to_batch:production.map(p=>({lot_id:p.lot_id,production_order:p.production_order,material_id:p.material_id,po_id:byQC[p.lot_id]?.po_id||''}))},
  integration:[{system:'SAP / ERP',data:'PR / PO / contract / invoice',frequency:'Daily (planned)'},{system:'QMS / LIMS',data:'QC lot / release / deviation / CAPA',frequency:'Daily (planned)'},{system:'WMS / MES / Planning',data:'Lots / production / allocation',frequency:'Daily (planned)'},{system:'Supplier master / RA',data:'ASL / sites / CMC / MA status',frequency:'Change-triggered (planned)'}]
 }
}
