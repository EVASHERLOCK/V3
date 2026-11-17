// V0.5 Python -> JavaScript deterministic analytical migration.
// Non-GxP educational prototype. No supplier approval, quality release or regulatory decision.
import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.dirname(new URL(import.meta.url).pathname);
export const regulatory=JSON.parse(fs.readFileSync(path.join(ROOT,'rules.json'),'utf8'));
export const number=(v,d=0)=>{let s=String(v??'').replace(/,/g,'').replace(/[$%]/g,'').trim();if(!s)return d;let n=Number(s);return Number.isFinite(n)?n:d};
export const round=(v,d=1)=>Number.isFinite(v)?Math.round((v+Number.EPSILON)*10**d)/10**d:null;
export const pct=(a,b)=>b?round(a/b*100,1):null;
export const date=(v)=>{let s=String(v??'').trim();if(!/^\d{4}-\d\d-\d\d/.test(s))return null;let t=Date.parse(s.slice(0,10)+'T00:00:00Z');return Number.isNaN(t)?null:t};
export const days=(a,b)=>(a-b)/86400000;
export const status=v=>String(v??'').trim().toLowerCase();
const group=(rows,key)=>{let m=new Map();for(const r of rows){const k=key(r);let a=m.get(k);if(!a){a=[];m.set(k,a)}a.push(r)}return m};
const counts=rows=>Object.entries(rows.reduce((o,x)=>(o[x]=(o[x]||0)+1,o),{})).map(([k,n])=>[k,n]).sort((a,b)=>b[1]-a[1]);
const mean=arr=>arr.length?arr.reduce((s,n)=>s+n,0)/arr.length:null;
const stddev=arr=>arr.length>=2?Math.sqrt(arr.reduce((a,b)=>a+(b-mean(arr))**2,0)/arr.length):null;
const required=(rows,columns,name)=>{if(!rows.length)throw new Error(name+' 数据为空');let missing=columns.filter(c=>!(c in rows[0]));if(missing.length)throw new Error(name+' 缺少必要列：'+missing.join(', '));};
export function checklist({material_type='chemical',markets='US,EU',scenario='new',supplier_id='SUP-001',docs}){
 docs ||= [];required(docs,['supplier_id','document_type','status'],'supplier_documents');
 const selected=Array.isArray(markets)?markets:markets.split(',').map(x=>x.trim().toUpperCase());
 const idx=new Map(docs.map(x=>[String(x.supplier_id).trim()+'|'+String(x.document_type).trim().toUpperCase(),x]));
 return regulatory.rules.filter(x=>!(x.scope==='chemical'&&material_type!=='chemical')&&!(x.scope==='change'&&scenario==='new')&&(['all','chemical','change'].includes(x.scope)||selected.includes(x.scope))).map(rule=>{
  const record=idx.get(supplier_id.trim()+'|'+rule.id);let state=status(record?.status),expiry=date(record?.expiry_date),now=new Date();let today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  let docstatus=!record?'Missing':expiry&&expiry<today?'Expired':['accepted','verified','approved'].includes(state)?'Received / marked accepted':['received','under review','pending'].includes(state)?'Under review':['rejected','mismatch'].includes(state)?'Needs correction':'Under review';
  return {...rule,status:docstatus,filename:record?.filename||'',expiry_date:record?.expiry_date||'',market:regulatory.markets[rule.scope]?rule.scope:'Common'};
 });
}
export const aiDisabled = {mode:'rules',text:null,notice:'Bolt 原生运行版：KPI/寻源由可复算规则计算；当前未启用外部 AI。真实 LLM 与供应商检索需要单独配置安全 API。'};
export function sourcingAnalyze(data,opts={}){
 const {suppliers,quotes,documents}=data;
 required(suppliers,['supplier_id','supplier_name','manufacturer','site','approved_status','quality_score','delivery_score','risk_level'],'suppliers');
 required(quotes,['supplier_id','material_id','unit_price','currency','fx_to_usd','moq','lead_days','freight_usd','incoterm'],'quotes');
 required(documents,['supplier_id','document_type','status'],'supplier_documents');
 const material_id=opts.material_id||'API-001', quantity=number(opts.quantity,1000),markets=opts.markets||'US,EU',material_type=opts.material_type||'chemical',scenario=opts.scenario||'new';
 if(quantity<=0)throw new Error('采购量必须大于 0');
 let w=opts.weights||{price:35,quality:30,delivery:20,risk:15};if(typeof w==='string')w=JSON.parse(w);
 w=Object.fromEntries(['price','quality','delivery','risk'].map(k=>[k,Math.max(0,number(w[k]))]));let sw=Object.values(w).reduce((a,b)=>a+b,0);for(let k in w)w[k]=sw?w[k]/sw:0.25;
 const bySupplier=new Map(suppliers.map(x=>[x.supplier_id,x]));let out=[],warnings=[];
 for(const q of quotes.filter(x=>status(x.material_id)===status(material_id))){
  const sup=bySupplier.get(q.supplier_id);if(!sup){warnings.push(`报价 ${q.supplier_id} 无匹配 Supplier Master`);continue}
  const price=number(q.unit_price,-1),fx=number(q.fx_to_usd,-1),moq=number(q.moq),freight=number(q.freight_usd);
  if(price<0||fx<=0){warnings.push(`${sup.supplier_name} 存在无效报价或汇率，未纳入排序`);continue}
  const billable=Math.max(quantity,moq),landed=round(price*fx*billable+freight,2);
  const gaps=checklist({material_type,markets,scenario,supplier_id:q.supplier_id,docs:documents}).filter(x=>['Missing','Expired','Needs correction'].includes(x.status)).map(x=>x.name);
  const approved=status(sup.approved_status)==='approved',riskScore={low:95,medium:65,high:30}[status(sup.risk_level)]??50;
  out.push({supplier_id:q.supplier_id,supplier_name:sup.supplier_name,manufacturer:sup.manufacturer,site:sup.site,country:sup.country||'',qualification_status:sup.approved_status,
   quality_score:round(number(sup.quality_score),1),delivery_score:round(number(sup.delivery_score),1),risk_level:sup.risk_level,risk_score:riskScore,lead_days:number(q.lead_days),unit_price:price,currency:q.currency,fx_to_usd:fx,moq,incoterm:q.incoterm,payment_terms:q.payment_terms||'',billable_qty:billable,landed_cost_usd:landed,doc_gap_count:gaps.length,doc_gaps:gaps,qualification_gate:approved?'Approved source in sample master':'Qualification required — NOT approved for use',freight_usd:freight});
 }
 if(!out.length)throw new Error('未找到有效报价，请检查 Material ID、价格与汇率');
 const lowest=Math.min(...out.map(x=>x.landed_cost_usd));for(const x of out){const ps=x.landed_cost_usd?100*lowest/x.landed_cost_usd:0;x.price_score=round(ps,1);x.score=round(w.price*ps+w.quality*x.quality_score+w.delivery*x.delivery_score+w.risk*x.risk_score,1)}
 out.sort((a,b)=>b.score-a.score);let preferred=out[0];let recommendations=[`基于所上传报价与配置权重，${preferred.supplier_name} 的综合评分最高（${preferred.score}/100）；不等于质量或采购批准。`];
 if(preferred.doc_gap_count)recommendations.push(`该供应商有 ${preferred.doc_gap_count} 项候选文件缺口，应向 SQM/QA/RA 提交核验并向供应商追索。`);
 if(preferred.qualification_gate.includes('NOT approved'))recommendations.push('该来源在示例主数据中尚未批准，不能直接用于受控物料生产使用。');
 if(out.some(x=>x.moq>quantity))recommendations.push('部分 MOQ 超过需求量；TCO 采用 max(需求量, MOQ)，需考虑库存风险。');
 if(new Set(out.map(x=>x.incoterm)).size>1)recommendations.push('贸易条件不同；未提供的关税和保险无法保证 TCO 完全可比。');
 return {results:out,recommendations,warnings,material_id,quantity,weights:Object.fromEntries(Object.entries(w).map(([k,v])=>[k,round(v*100,1)])),sources:opts.sources||{},ai:aiDisabled,note:'规则评分仅用于演示；GMP/注册与批准状态必须人工核查。'};
}
export function kpiAnalyze({po,qc,production,inventory,changes},opts={}){
 required(po,['po_id','supplier_id','material_id','promised_date','receipt_date','ordered_qty','unit_price','benchmark_price'],'purchase_orders');
 required(qc,['lot_id','po_id','material_id','gr_date','release_date','status'],'qc_lots');
 required(production,['production_order','material_id','required_date','required_qty','lot_id','allocated_qty'],'production');
 required(inventory,['lot_id','material_id','quantity','status','expiry_date','retest_date'],'inventory');
 required(changes,['change_id','material_id','status','opened_date'],'change_controls');
 let warnings=[], late_orders=[],validPO=0, onTime=0, ppvAmount=0,ppvBase=0;
 let supplierMap=new Map(),materialSupplier=new Map(),delivery_mix={early:0,on_time:0,late:0},leadTimes=new Map(),priceMap=new Map();
 for(const row of po){
  const sid=row.supplier_id,mid=row.material_id, promised=date(row.promised_date),receipt=date(row.receipt_date),created=date(row.created_date);
  let s=supplierMap.get(sid);if(!s){s={supplier_id:sid,total_po:0,valid:0,early:0,on_time:0,late:0,quantity:0,materials:new Set(),po_ids:[],delays:[]};supplierMap.set(sid,s)}
  s.total_po++;s.quantity+=number(row.ordered_qty);s.materials.add(mid);if(row.po_id)s.po_ids.push(row.po_id);
  if(!materialSupplier.has(mid))materialSupplier.set(mid,{});materialSupplier.get(mid)[sid]=(materialSupplier.get(mid)[sid]||0)+1;
  if(promised!==null&&receipt!==null){validPO++;s.valid++;const delta=days(receipt,promised);if(delta<=0)onTime++;
   if(delta<0){s.early++;delivery_mix.early++}else if(delta===0){s.on_time++;delivery_mix.on_time++}else{s.late++;delivery_mix.late++;s.delays.push(delta);late_orders.push({po_id:row.po_id,supplier_id:sid,days_late:delta,material_id:mid})}}
  if(created!==null&&receipt!==null&&receipt>=created){if(!leadTimes.has(sid))leadTimes.set(sid,[]);leadTimes.get(sid).push(days(receipt,created))}
  let q=number(row.ordered_qty), p=number(row.unit_price), b=number(row.benchmark_price);
  ppvAmount+=(p-b)*q;ppvBase+=b*q;
  if(!priceMap.has(mid))priceMap.set(mid,{material_id:mid,ppv_amount:0,base:0,po_ids:[]});let item=priceMap.get(mid);
  item.ppv_amount+=(p-b)*q;item.base+=b*q;item.po_ids.push(row.po_id||'');
 }
 if(validPO<po.length)warnings.push(`${po.length-validPO} 条 PO 缺少有效日期，不计入 OTD 分母`);
 const byPO=new Map(po.map(x=>[x.po_id,x])),byLOT=new Map(qc.map(x=>[x.lot_id,x]));
 const releaseDays=[],qc_overdue_lots=[],qc_status_distribution={},qcBuckets={'0–5d':0,'6–10d':0,'11–15d':0,'>15d':0};
 for(const row of qc){let st=status(row.status);qc_status_distribution[st]=(qc_status_distribution[st]||0)+1;
  let gr=date(row.gr_date),rel=date(row.release_date);if(st==='released'&&gr!==null&&rel!==null&&rel>=gr){let delta=days(rel,gr);releaseDays.push(delta);
   qcBuckets[delta<=5?'0–5d':delta<=10?'6–10d':delta<=15?'11–15d':'>15d']++;
   if(delta>10){let por=byPO.get(row.po_id)||{};qc_overdue_lots.push({lot_id:row.lot_id,material_id:row.material_id,supplier_id:row.supplier_id||por.supplier_id||'—',qc_days:delta,po_id:row.po_id,status:row.status})}}
 }
 let availability=0,unavailable=[],gap_lines=[],causeMap={},affectedOrders=new Set();
 for(const req of production){const lot=byLOT.get(req.lot_id),need=date(req.required_date),rel=lot?date(lot.release_date):null,qtyEnough=number(req.allocated_qty)>=number(req.required_qty);
  const ok=!!(lot&&status(lot.status)==='released'&&need!==null&&rel!==null&&rel<=need&&qtyEnough);
  if(ok){availability++;continue}
  const reason=!lot?'QC lot missing':!qtyEnough?'Quantity allocation below requirement':'Not released by required date';
  unavailable.push({production_order:req.production_order,material_id:req.material_id,lot_id:req.lot_id,required_date:req.required_date,reason});
  let cause=!lot?'Missing QC lot link':!qtyEnough?'Allocation shortage':status(lot.status)!=='released'?'Quality hold / not released':rel!==null&&need!==null&&rel>need?'QC release after need date':'Release / date not verifiable';
  let mid=req.material_id, por=lot?byPO.get(lot.po_id)||{}:{};
  let ranked=Object.entries(materialSupplier.get(mid)||{}).sort((a,b)=>b[1]-a[1]);let sid=lot?.supplier_id||por.supplier_id||ranked[0]?.[0]||'Unknown';
  let g={production_order:String(req.production_order),material_id:mid,lot_id:req.lot_id,supplier_id:sid,po_id:lot?.po_id||'',required_date:String(req.required_date),required_qty:number(req.required_qty),allocated_qty:number(req.allocated_qty),short_qty:Math.max(0,number(req.required_qty)-number(req.allocated_qty)),qc_release_date:lot?.release_date||'',cause,owner:cause.includes('QC')||cause.includes('Quality')?'QA/QC':cause.includes('Allocation')?'Warehouse / Planning':'Data Steward'};
  gap_lines.push(g);causeMap[cause]=(causeMap[cause]||0)+1;affectedOrders.add(req.production_order);
 }
 let now=new Date(),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 const risk_lots=[];
 for(const row of inventory){let dt=[date(row.expiry_date),date(row.retest_date)].filter(x=>x!==null).sort((a,b)=>a-b)[0];let dif=dt===undefined?null:days(dt,today);
  if(dif!==null&&dif<=90&&number(row.quantity)>0)risk_lots.push({lot_id:row.lot_id,material_id:row.material_id,quantity:number(row.quantity),days_until_limit:dif,status:row.status})}
 const open_changes=changes.filter(x=>!['closed','complete','completed'].includes(status(x.status))).map(x=>({change_id:x.change_id,material_id:x.material_id,status:x.status,aging_days:date(x.opened_date)===null?null:days(today,date(x.opened_date)),markets:x.markets||''}));
 const otdRate=pct(onTime,validPO),readyRate=pct(availability,production.length),qcLead=releaseDays.length?round(mean(releaseDays),1):null,ppv=ppvBase?round(100*ppvAmount/ppvBase,2):null;
 const metrics=[
  {key:'otd',label:'Supplier OTD',value:otdRate,unit:'%',numerator:onTime,denominator:validPO,definition:'receipt_date ≤ promised_date；仅统计两日期有效的 PO 行'},
  {key:'availability',label:'On-Time Material Availability',value:readyRate,unit:'%',numerator:availability,denominator:production.length,definition:'关联 QC 批次已于需求日前放行，且 allocated_qty ≥ required_qty 的生产需求行'},
  {key:'qc_lead',label:'QC Release Lead Time',value:qcLead,unit:'days',numerator:releaseDays.length,denominator:qc.length,definition:'已放行批次 release_date − gr_date 的算术平均天数'},
  {key:'ppv',label:'Purchase Price Variance',value:ppv,unit:'%',numerator:round(ppvAmount,2),denominator:round(ppvBase,2),definition:'Σ(实际单价−基准价)×采购量 / Σ(基准价×采购量)；须同币种'},
  {key:'inventory_risk',label:'Inventory Lots at Risk',value:risk_lots.length,unit:'lots',numerator:risk_lots.length,denominator:inventory.length,definition:'距最近复验/有效期 ≤90 天的非零库存批次'},
  {key:'open_changes',label:'Open Change Controls',value:open_changes.length,unit:'cases',numerator:open_changes.length,denominator:changes.length,definition:'状态不是 Closed / Complete / Completed 的变更记录'},
 ];
 const supplier_chart=[...supplierMap.values()].map(x=>({supplier:x.supplier_id,otd:pct(x.early+x.on_time,x.valid),late:x.late,po_ids:x.po_ids.filter(id=>late_orders.some(y=>y.po_id===id))})).sort((a,b)=>(a.otd??101)-(b.otd??101));
 const m=Object.fromEntries(metrics.map(x=>[x.key,x.value]));
 const supplier_delivery=[...supplierMap.values()].map(g=>{let leads=leadTimes.get(g.supplier_id)||[];return {supplier_id:g.supplier_id,otd:pct(g.early+g.on_time,g.valid),valid_po:g.valid,total_po:g.total_po,early:g.early,on_time:g.on_time,late:g.late,ordered_qty:round(g.quantity,2),materials:[...g.materials].sort(),max_late_days:g.delays.length?Math.max(...g.delays):0,lead_time_avg_days:leads.length?round(mean(leads),1):null,lead_time_stdev_days:leads.length>=2?round(stddev(leads),1):null,po_ids:g.po_ids,risk_label:g.valid&&g.late/g.valid>0.15?'Below OTD target':'Monitor'}}).sort((a,b)=>a.otd===null?1:b.otd===null?-1:a.otd-b.otd||b.total_po-a.total_po);
 const materialGapsMap=new Map();for(let g of gap_lines){let x=materialGapsMap.get(g.material_id);if(!x){x={material_id:g.material_id,unavailable_lines:0,production_orders:new Set(),lots:new Set(),suppliers:new Set(),short_qty:0,causes:[]};materialGapsMap.set(g.material_id,x)}x.unavailable_lines++;x.production_orders.add(g.production_order);x.lots.add(g.lot_id);x.suppliers.add(g.supplier_id);x.short_qty+=g.short_qty;x.causes.push(g.cause)}
 const material_gaps=[...materialGapsMap.values()].map(x=>({material_id:x.material_id,unavailable_lines:x.unavailable_lines,production_orders:[...x.production_orders].sort(),lots:[...x.lots].sort(),suppliers:[...x.suppliers].sort(),short_qty:round(x.short_qty,2),primary_cause:counts(x.causes)[0]?.[0]})).sort((a,b)=>b.unavailable_lines-a.unavailable_lines||b.short_qty-a.short_qty);
 const price_variances=[...priceMap.values()].map(x=>({material_id:x.material_id,ppv_amount:round(x.ppv_amount,2),ppv_pct:x.base?round(x.ppv_amount/x.base*100,2):null,po_ids:x.po_ids})).sort((a,b)=>Math.abs(b.ppv_amount)-Math.abs(a.ppv_amount));
 const rejected=['rejected','reject','failed','oos'].reduce((a,x)=>a+(qc_status_distribution[x]||0),0);
 const secondary={overdue_po:late_orders.length,supplier_count:supplier_delivery.length,qc_over10_lots:qc_overdue_lots.length,qc_release_after_need:gap_lines.filter(x=>x.cause==='QC release after need date').length,qc_rejected_lot_rate:pct(rejected,qc.length),qc_rejected_lots:rejected,lots_at_risk:risk_lots.length,open_changes:open_changes.length,annual_realized_savings:null,cost_saving_achievement:null,quality_ppm:null,risk_inventory_value:null,high_risk_supplier_share:null,single_source_materials:null};
 const act=(id,title,owner,horizon,effort,detail,email_subject,email_body)=>({id,title,owner,horizon,effort,detail,email_subject,email_body});
 const alerts=[];const add=(id,severity,title,finding,owner,evidence,actions,evidence_summary='')=>alerts.push({id,severity,title,finding,owner,evidence,root_cause_status:'Preliminary rule-based attribution; not verified',evidence_summary,actions});
 if(otdRate!==null&&readyRate!==null&&otdRate-readyRate>=12){let mats=[...new Set(gap_lines.map(x=>x.material_id))].sort(),suppliers=[...new Set(gap_lines.map(x=>x.supplier_id).filter(x=>x!=='Unknown'))].sort();let root=counts(gap_lines.map(x=>x.cause)).slice(0,3).map(([c,n])=>`${c}: ${n}`).join(', ');
  let finding=`Supplier OTD ${otdRate}% vs. material readiness ${readyRate}% — gap ${round(otdRate-readyRate,1)}pp. ${affectedOrders.size} affected work orders, ${gap_lines.length} demand lines. `;
  let subject=`Material availability coordination | ${affectedOrders.size} work orders`;
  let body=`Team,\n\nSupplier OTD: ${otdRate}% | On-time material availability: ${readyRate}%.\nAffected materials: ${mats.join(', ')}.\nAffected suppliers: ${suppliers.join(', ')}.\nRecord categories: ${root}.\n\nPlease review QC release planning and material allocation without bypassing quality requirements.`;
  add('material-gap','high','交货及时，但生产物料齐套存在缺口',finding,'Procurement coordinates · QA/QC & Planning accountable for their process',gap_lines.slice(0,12).map(x=>`${x.production_order} / ${x.material_id} / ${x.lot_id}`),[
   act('coordinate-qa','生成 QC 优先检验/放行计划协调请求','Procurement → QA/QC','0–3 days','Low','请求 QA/QC 评估排期与资源，不要求跳过放行程序',subject,body),
   act('alternative-sourcing','向已批准备选来源发起紧急 RFQ','Procurement / SQM','0–3 days','Medium','仅限已确认 ASL/制造地点适用来源；未知则先核验资格','Urgent RFQ qualification check',`Please verify approved alternatives for ${mats.join(', ')}; do not place controlled orders without qualification.`),
   act('replan','向 Planning 发送生产需求优先级协调','Planning · Procurement supports','0–3 days','Medium','核实工单顺序及分配，不擅自更改生产计划','Replan review','Please review impacted work orders and approved scheduling adjustments.'),
   act('update-lead','联合更新采购/QC 计划提前期假设','Procurement + Planning + QC','Monthly','Medium','基于历史周期调整受控计划参数','Material lead-time review','Please review QC and procurement buffer assumptions.'),
   act('supplier-document-sla','建立供应商检验资料到货同步提交约定','Category Manager + SQM','1–4 weeks','Low','明确 CoA 和必要文件到货提交时间，不减低检验标准','Documentation SLA review','Please agree on timely CoA submission.'),
   act('qualified-second-source','启动第二来源开发可行性评估','Sourcing + SQM / QA / RA','3–6 months','High','核实制造地/市场注册与合规资格，未经批准不可切换','Second source feasibility','Please assess qualification and regulatory impact before a source switch.')],`由记录分类：${root}。不是已验证的根因概率。`);
 }
 if(otdRate!==null&&otdRate<85)add('supplier-otd','high','供应商整体 OTD 低于演示阈值',`OTD ${otdRate}% (limit 85%)`,'Procurement',late_orders.slice(0,12).map(x=>x.po_id),[act('expedite','生成逾期订单催交草稿','Buyer','Today','Low','确认订单明细后发送到货承诺请求','Late PO followup','Please confirm revised delivery dates.')]);
 if(qcLead!==null&&qcLead>10)add('qc-lead','medium','QC 周期超过协同监控阈值',`已放行批次平均 QC ${qcLead} 天；高于 10 天阈值。`,'QA/QC owns · Procurement monitors dependencies',qc_overdue_lots.slice(0,12).map(x=>x.lot_id),[act('qc-queue','生成 QC 排期信息请求','QA/QC','0–3 days','Low','仅请求排期，不能触发 GMP 放行','QC queue review','Please review the queue and expected release dates.')]);
 if(ppv!==null&&ppv>3)add('price-variance','medium','采购价差高于演示成本阈值',`整体 PPV +${ppv}% (target ≤3%).`,'Procurement / Finance',price_variances.slice(0,7).map(x=>x.material_id),[act('negotiate','准备合同价格复核与谈判清单','Category Manager','7 days','Medium','核对币种及基准价一致性后谈判','PPV review','Please verify comparable commercial terms.')]);
 if(risk_lots.length)add('stock-risk','medium','存在复验/有效期临界库存',`${risk_lots.length} 个批次处于 90 天内复验/有效期窗口。`,'Warehouse & QA own · Procurement supports',risk_lots.slice(0,12).map(x=>x.lot_id),[act('stock-review','创建库存风险协同任务','Warehouse / QA / Planning','7 days','Medium','复核库存处置和采购调整，不擅自更改质量状态','Inventory risk','Please review impacted lots.')]);
 if(open_changes.length)add('change-control','medium','存在未关闭的供应商/物料变更',`${open_changes.length} 项 Change Control 未关闭。`,'QA/RA own · Procurement follows',open_changes.slice(0,12).map(x=>x.change_id),[act('change-review','生成 QA/RA 变更状态确认','Procurement → QA/RA','7 days','Low','核实各市场实施条件','Change inquiry','Please confirm market implementation status.')]);
 const domain_cards=[{key:'delivery',label:'交付 Delivery',owner:'采购主责 + Planning 协同',measures:['OTD','Late PO','Lead-time variance','Readiness (shared)'],status:readyRate!==null&&readyRate<70?'watch':'normal'},{key:'cost',label:'成本 Cost',owner:'采购主责 · Finance 口径确认',measures:['PPV','Savings (not available)','Emergency premium (not available)'],status:ppv!==null&&ppv>3?'watch':'normal'},{key:'quality',label:'质量 Quality',owner:'QA/QC 主责 · 采购跟进供应商',measures:['QC lead','Lot reject rate','Quality holds'],status:qcLead!==null&&qcLead>10?'watch':'normal'},{key:'risk',label:'风险 Risk',owner:'采购/SQM + QA/RA/仓储协同',measures:['At-risk lots','Open changes','Approved source risk'],status:risk_lots.length||open_changes.length?'watch':'normal'}];
 const intelligence={domain_cards,supplier_delivery,delivery_mix,material_gaps,gap_lines,cause_counts:counts(gap_lines.map(x=>x.cause)).map(([name,count])=>({name,count})),affected_production_orders:affectedOrders.size,qc_distribution:['0–5d','6–10d','11–15d','>15d'].map(bucket=>({bucket,count:qcBuckets[bucket]})),qc_overdue_lots,qc_status_distribution,price_variances,secondary,alerts,drill_records:{po:po.slice(0,500),qc:qc.slice(0,500),production:production.slice(0,500),inventory:inventory.slice(0,500),change:changes.slice(0,500)},data_coverage:{po_lines:po.length,qc_lots:qc.length,production_demands:production.length,inventory_lots:inventory.length,change_records:changes.length},notes:['Readiness is cross-functional, not individual procurement target.','QC lead time owned by QA/QC.','History comparisons require same scope.','Savings/PPM/inventory risk value unavailable without additional data.','Alerts do not authorize GMP quality decisions.']};
 const v5=buildV5({po,qc,production,inventory,changes,metrics,intelligence});
 const insights=alerts.map(x=>({severity:x.severity,title:x.title,finding:x.finding,hypothesis:x.evidence_summary,action:x.actions[0]?.detail||'',evidence:x.evidence}));
 if(!insights.length)insights.push({severity:'low',title:'当前数据未触发高优先级规则',finding:'已完成主要 KPI 计算。',hypothesis:'不代表不存在其他风险。',action:'检查指标口径和阈值。',evidence:[]});
 return {v5,intelligence,metrics,insights,supplier_chart,late_orders,unavailable,risk_lots,open_changes,warnings,sources:opts.sources||{},ai:aiDisabled,note:'所有分析为非 GxP 面试原型，质量与法规状态不作自动决定。'};
}
function buildV5({po,qc,production,inventory,changes,metrics,intelligence}){
 const m=Object.fromEntries(metrics.map(x=>[x.key,x]));let reqPO=po.filter(x=>date(x.required_delivery_date)!==null&&date(x.receipt_date)!==null),pass=reqPO.filter(x=>date(x.receipt_date)<=date(x.required_delivery_date)).length;
 const po_need_otd={value:pct(pass,reqPO.length),numerator:pass,denominator:reqPO.length,missing:!reqPO.length};
 const metric_dictionary={};for(const [key,def] of Object.entries(regulatory.kpi_dictionary)){
  let value=key==='po_need_otd'?po_need_otd.value:key==='spend'?round(po.reduce((s,x)=>s+number(x.unit_price)*number(x.ordered_qty),0),2):key==='savings'?null:key==='at_risk_inventory'?m.inventory_risk?.value:m[key]?.value??null;
  let numerator=key==='po_need_otd'?pass:m[key]?.numerator??null,denominator=key==='po_need_otd'?reqPO.length:m[key]?.denominator??null;
  metric_dictionary[key]={...def,value,numerator,denominator,sample_size:key==='spend'?po.length:key==='savings'?0:key==='po_need_otd'?reqPO.length:denominator};
 }
 let qcBy=new Map(qc.map(x=>[x.lot_id,x])),poBy=new Map(po.map(x=>[x.po_id,x]));let stages=[{key:'demand',name:'生产需求',count:production.length},{key:'po',name:'关联 PO',count:0},{key:'receipt',name:'需求日前到货',count:0},{key:'qc',name:'需求日前放行',count:0},{key:'available',name:'按期齐套',count:0}],records=[];
 for(const p of production){let q=qcBy.get(p.lot_id),order=q?poBy.get(q.po_id):null,need=date(p.required_date);let has=!!order,arrived=!!(has&&need!==null&&date(order.receipt_date)!==null&&date(order.receipt_date)<=need),released=!!(arrived&&q&&status(q.status)==='released'&&date(q.release_date)!==null&&date(q.release_date)<=need),ready=!!(released&&number(p.allocated_qty)>=number(p.required_qty));if(has)stages[1].count++;if(arrived)stages[2].count++;if(released)stages[3].count++;if(ready)stages[4].count++;records.push({production_order:p.production_order,material_id:p.material_id,lot_id:p.lot_id,po_id:q?.po_id||null,po_linked:has,arrived_by_need:arrived,released_by_need:released,allocated_and_ready:ready})}
 const comparable_funnel={denominator:production.length,unit:'生产需求行',stages:stages.map(s=>({...s,pct:pct(s.count,production.length)})),records,notice:'全部阶段采用相同的生产需求行分母，不能直接用 PO 行 OTD 作漏斗的到货率。'};
 const cause_breakdown=[];let groups=new Map();for(let g of intelligence.gap_lines){let [code,name,owner,grade]=regulatory.causes[g.cause]||['DATA_MISSING','待核实','业务数据维护','低'];g.root_cause_code=code;g.evidence_grade=grade;let key=[code,name,owner,grade].join('|');groups.set(key,(groups.get(key)||0)+1)}
 for(let [k,count] of [...groups].sort((a,b)=>b[1]-a[1])){let [code,name,owner,evidence_level]=k.split('|');cause_breakdown.push({code,name,owner,evidence_level,count,share:pct(count,intelligence.gap_lines.length)})}
 const qcCount=cause_breakdown.filter(x=>['QC_HOLD','QC_CYCLE_LONG'].includes(x.code)).reduce((s,x)=>s+x.count,0);
 const diagnostics={confirmed:`${intelligence.gap_lines.length} 条缺口需求行中，${qcCount} 条与检验状态/放行日期有关（规则分类，不代表已证明因果）。`,hypotheses:[{claim:'物料计划提前期可能未覆盖 QC 检验周期',validation:'核对 MRP lead time / safety time 参数和 QC 计划',needed:'material_planning_parameters.csv'},{claim:'原料检验队列可能存在资源瓶颈',validation:'比对批次取样、检验及放行事件记录',needed:'LIMS events and QC capacity'}],insufficient:['备选供应商注册市场适用性待 RA 确认','缺少年度 Savings Ledger','缺少完整 QC 分阶段日志，不能给出可信根因概率']};
 const byMaterial=new Map();for(let i of inventory){let x=byMaterial.get(i.material_id)||{total:0,inspection:0};x.total+=number(i.quantity);if(!['released','approved'].includes(status(i.status)))x.inspection+=number(i.quantity);byMaterial.set(i.material_id,x)}
 const total=[...byMaterial.values()].reduce((s,x)=>s+x.total,0),under=[...byMaterial.values()].reduce((s,x)=>s+x.inspection,0);
 const inventory_finance={quantity_total:round(total,1),quantity_under_inspection:round(under,1),quantity_under_inspection_pct:pct(under,total),value_under_inspection:null,inventory_turn_days:null,safety_stock_coverage_days:null,aging_value:null,reason:'缺少单位成本、日均消耗及受控计价信息；不同物料数量不能当作同一币种价值相加。',material_breakdown:[...byMaterial].map(([material_id,x])=>({material_id,quantity_total:round(x.total,1),quantity_inspection:round(x.inspection,1),inspection_pct:pct(x.inspection,x.total)}))};
 return {po_need_otd,metric_dictionary,comparable_funnel,cause_breakdown,diagnostics,alt_sources:regulatory.alt_sources,inventory_finance};
}
