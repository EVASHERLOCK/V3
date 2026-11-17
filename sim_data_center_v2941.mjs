/** Simulated-data management only. This does not modify real ERP/QMS/RA systems. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR=path.join(ROOT,'seed_simulated');
export const TABLES=Object.freeze(['suppliers','materials','projects','product_lines','purchase_orders','quotes','rfq_alternates','contracts','contract_documents','shipment_documents','payment_authorizations','qc_lots','inventory','production','invoices','payments','claims','claim_settlements','change_controls','exceptions','metric_events']);
// V2.9.52: two read-only supporting files were previously omitted from the
// paginated Demo provenance API. Keep the canonical 21 tables unchanged for
// backward-compatible business validation, but expose ALL 23 CSV files for
// source-only enumeration and snapshot-pinned pagination.
export const AUXILIARY_TABLES=Object.freeze(['supplier_documents','monthly_kpi_summary']);
export const ALL_SOURCE_TABLES=Object.freeze([...TABLES,...AUXILIARY_TABLES]);
export const AUXILIARY_KEYS=Object.freeze({supplier_documents:'document_id',monthly_kpi_summary:'month'});
const IDS={suppliers:'supplier_id',materials:'material_id',projects:'project_id',product_lines:'product_line_id',purchase_orders:'po_id',quotes:'quote_id',rfq_alternates:'quote_id',contracts:'contract_id',contract_documents:'contract_document_id',shipment_documents:'shipment_document_id',payment_authorizations:'payment_authorization_id',qc_lots:'lot_id',inventory:'lot_id',production:'production_order',invoices:'invoice_id',payments:'payment_id',claims:'claim_id',claim_settlements:'settlement_id',change_controls:'change_id',exceptions:'exception_id',metric_events:'event_id'};
const RELATIONS={supplier_id:'suppliers',material_id:'materials',project_id:'projects',po_id:'purchase_orders',invoice_id:'invoices',product_line_id:'product_lines',lot_id:'qc_lots',claim_id:'claims'};
export function parseCSV(s){let rows=[],cells=[],cell='',quoted=false;for(let i=0;i<s.length;i++){let c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\n'||c==='\r')){cells.push(cell);cell='';if(c!==','){if(c==='\r'&&s[i+1]==='\n')i++;if(cells.some(x=>x))rows.push(cells);cells=[]}}else cell+=c}cells.push(cell);if(cells.some(x=>x))rows.push(cells);if(quoted)throw Error('CSV 引号不完整');const header=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/,'').trim());if(new Set(header).size!==header.length)throw Error('CSV 列名重复');return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])))}
export function fileFor(table){if(!ALL_SOURCE_TABLES.includes(table))throw Error('Invalid source table');return path.join(DATA_DIR,table+'.csv')}
export function rowsFor(table){return parseCSV(fs.readFileSync(fileFor(table),'utf8'))}
const csvCell=v=>{let s=String(v??'');if(/^[=+@\-]/.test(s)&&!/^-[0-9.]+$/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};
function save(table,rows){const cols=Object.keys(rowsFor(table)[0]||{});if(!cols.length)throw Error('Cannot infer schema');const contents=[cols.join(','),...rows.map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\r\n')+'\r\n';const dest=fileFor(table),temp=dest+'.tmp';fs.writeFileSync(temp,contents);fs.renameSync(temp,dest)}
export function overview(){const man=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'manifest.json'),'utf8'));const audit=fs.existsSync(path.join(DATA_DIR,'SITE_DATA_AUDIT_V2941.json'))?JSON.parse(fs.readFileSync(path.join(DATA_DIR,'SITE_DATA_AUDIT_V2941.json'),'utf8')):{};return {audit_summary:{source_constraint_errors:audit.source_constraint_errors??null,decision_center_computed_kpis:115,decision_center_total_kpis:115,legacy_modules_unified:false},mode:process.env.PHARMA_DATA_MODE==='SIMULATED'?'SIMULATED_ACTIVE':'SIMULATED_STANDBY',notice:'虚构的非 GxP 演示数据；静态发布只读；动态修改需要有持久化磁盘的 Node 服务。',seed:man.seed,table_counts:Object.fromEntries(TABLES.map(t=>[t,rowsFor(t).length])),tables:TABLES,all_source_tables:ALL_SOURCE_TABLES,all_source_counts:Object.fromEntries(ALL_SOURCE_TABLES.map(t=>[t,rowsFor(t).length])),auxiliary_readonly_tables:AUXILIARY_TABLES,keys:{...IDS,...AUXILIARY_KEYS}};}
export function list(table,{supplier='',material='',project='',month='',limit=100,offset=0}={}){let rs=rowsFor(table);let matching=rs.filter(r=>(!supplier||r.supplier_id===supplier)&&(!material||r.material_id===material)&&(!project||r.project_id===project)&&(!month||Object.values(r).some(x=>/^20\d\d-\d\d/.test(x)&&x.startsWith(month))));const total=matching.length;return {table,total,rows:matching.slice(Math.max(0,Number(offset)||0),Math.max(0,Number(offset)||0)+Math.min(500,Math.max(1,Number(limit)||100))),columns:Object.keys(rs[0]||{}),simulated:true};}
export function validateAll(overrideTable=null,overrideRows=null){const datasets=Object.fromEntries(TABLES.map(t=>[t,t===overrideTable?overrideRows:rowsFor(t)]));let violations=[];const lookups=Object.fromEntries(TABLES.map(t=>[t,new Set(datasets[t].map(r=>r[IDS[t]]))]));for(const [table,records] of Object.entries(datasets)){
 const id=IDS[table],seen=new Set();for(const [idx,r] of records.entries()){
  if(!r[id]||seen.has(r[id]))violations.push({table,row:idx+2,type:'INVALID_OR_DUPLICATE_KEY',field:id});seen.add(r[id]);
  for(const [key,ref] of Object.entries(RELATIONS))if(key!==id&&r[key]!==undefined&&r[key]!==''&&!lookups[ref].has(r[key]))violations.push({table,row:idx+2,type:'ORPHAN_REFERENCE',field:key,value:r[key]});
  for(const [field,value] of Object.entries(r))if(value===undefined||value===null||value==='')violations.push({table,row:idx+2,type:'EMPTY_SOURCE_FIELD',field});
 }
}
// Cross-table quantity, pricing and event chronology reconciliation (simulated facts).
const poBy=new Map(datasets.purchase_orders.map(r=>[r.po_id,r]));
const qcBy=new Map(datasets.qc_lots.map(r=>[r.lot_id,r]));
const contractBy=new Map(datasets.contracts.map(r=>[r.contract_id,r]));
const paymentBy=new Map(datasets.payments.map(r=>[r.payment_id,r]));
for(const [table,records] of Object.entries(datasets)){
 for(const r of records){if(!r.po_id||table==='purchase_orders')continue;const p=poBy.get(r.po_id);
  if(!p){violations.push({table,type:'UNKNOWN_PO',value:r.po_id});continue;}
  if(r.material_id&&r.material_id!==p.material_id)violations.push({table,type:'DIMENSION_MISMATCH',field:'material_id',value:r.po_id});
  if(r.project_id&&r.project_id!==p.project_id)violations.push({table,type:'DIMENSION_MISMATCH',field:'project_id',value:r.po_id});
  if(table!=='rfq_alternates'&&r.supplier_id&&r.supplier_id!==p.supplier_id)violations.push({table,type:'DIMENSION_MISMATCH',field:'supplier_id',value:r.po_id});
  if(table==='rfq_alternates'&&r.supplier_id===p.supplier_id)violations.push({table,type:'ALTERNATIVE_BID_IS_AWARDED_SUPPLIER',value:r.quote_id});
 }
}
for(const d of datasets.contract_documents){if(contractBy.get(d.contract_id)?.po_id!==d.po_id)violations.push({table:'contract_documents',type:'CONTRACT_DOCUMENT_ORPHAN',value:d.contract_document_id})}
for(const d of datasets.payment_authorizations){if(paymentBy.get(d.payment_id)?.invoice_id!==d.invoice_id||paymentBy.get(d.payment_id)?.po_id!==d.po_id)violations.push({table:'payment_authorizations',type:'PAYMENT_AUTH_MISMATCH',value:d.payment_authorization_id})}

const invoiceBy=new Map(datasets.invoices.map(r=>[r.invoice_id,r]));
const val=x=>Number(x);
for(const inv of datasets.invoices){const p=poBy.get(inv.po_id);if(!p)continue;
 if(inv.supplier_id!==p.supplier_id||inv.material_id!==p.material_id||inv.project_id!==p.project_id)violations.push({table:'invoices',field:'po_id',value:inv.po_id,type:'DIMENSION_MISMATCH'});
 if(Math.abs(val(inv.invoice_amount_usd)-val(inv.invoice_quantity)*val(inv.unit_price_usd))>.025)violations.push({table:'invoices',field:'invoice_amount_usd',value:inv.invoice_id,type:'AMOUNT_MISMATCH'});
 if(val(inv.invoice_quantity)>val(p.received_qty))violations.push({table:'invoices',field:'invoice_quantity',value:inv.invoice_id,type:'EXCEEDS_RECEIPT'});
 if(inv.invoice_date<p.receipt_date)violations.push({table:'invoices',field:'invoice_date',value:inv.invoice_id,type:'EARLY_INVOICE'});
}
for(const payment of datasets.payments){const inv=invoiceBy.get(payment.invoice_id);if(!inv)continue;
 if(payment.po_id!==inv.po_id||payment.supplier_id!==inv.supplier_id||payment.material_id!==inv.material_id||payment.project_id!==inv.project_id)violations.push({table:'payments',field:'invoice_id',value:payment.invoice_id,type:'DIMENSION_MISMATCH'});
 const amount=val(payment.payment_amount_usd);
 if(amount<0||amount>val(inv.invoice_amount_usd)+.001)violations.push({table:'payments',field:'payment_amount_usd',value:payment.payment_id,type:'OVERPAID'});
 if(payment.payment_status==='SIMULATED_SETTLED'&&Math.abs(amount-val(inv.invoice_amount_usd))>.025)violations.push({table:'payments',field:'payment_amount_usd',value:payment.payment_id,type:'NOT_RECONCILED'});
 if(payment.payment_status==='SIMULATED_SCHEDULED'&&amount!==0)violations.push({table:'payments',field:'payment_amount_usd',value:payment.payment_id,type:'UNREALIZED_PAYMENT'});
 if(payment.payment_date<inv.invoice_date)violations.push({table:'payments',field:'payment_date',value:payment.payment_id,type:'EARLY_PAYMENT'});
}
const claimsBy=new Map(datasets.claims.map(x=>[x.claim_id,x]));
for(const settlement of datasets.claim_settlements){
 const c=claimsBy.get(settlement.claim_id);
 if(!c){violations.push({table:'claim_settlements',type:'UNKNOWN_CLAIM',value:settlement.claim_id});continue;}
 for(const key of ['po_id','supplier_id','material_id','project_id'])if(settlement[key]!==c[key])violations.push({table:'claim_settlements',type:'DIMENSION_MISMATCH',field:key,value:settlement.settlement_id});
 const amount=Number(settlement.settlement_amount_usd),credit=Number(settlement.credit_note_amount_usd);
 if(amount<0||amount>Number(c.claim_amount_usd)+.001||Math.abs(credit-amount)>.01)violations.push({table:'claim_settlements',type:'RECOVERY_AMOUNT_MISMATCH',value:settlement.settlement_id});
 if(settlement.settlement_status==='SIMULATED_PENDING'&&amount!==0)violations.push({table:'claim_settlements',type:'UNREALIZED_CLAIM_CREDIT',value:settlement.settlement_id});
}
for(const ev of datasets.metric_events){const p=poBy.get(ev.po_id);if(!p)continue;
 if(ev.supplier_id!==p.supplier_id||ev.material_id!==p.material_id||ev.project_id!==p.project_id||ev.month!==p.created_date.slice(0,7))violations.push({table:'metric_events',field:'po_id',value:ev.po_id,type:'DIMENSION_MISMATCH'});
 if(Math.abs(val(ev.amount_usd)-val(p.ordered_qty)*val(p.unit_price))>.025)violations.push({table:'metric_events',field:'amount_usd',value:ev.event_id,type:'PO_AMOUNT_MISMATCH'});
}
for(const lot of datasets.inventory){const q=qcBy.get(lot.lot_id);if(!q){violations.push({table:'inventory',field:'lot_id',value:lot.lot_id,type:'UNKNOWN_QC_LOT'});continue;}
 if(lot.supplier_id!==q.supplier_id||lot.material_id!==q.material_id||lot.project_id!==q.project_id)violations.push({table:'inventory',field:'lot_id',value:lot.lot_id,type:'DIMENSION_MISMATCH'});
 if(val(lot.quantity)<0||val(lot.quantity)>val(q.quantity))violations.push({table:'inventory',field:'quantity',value:lot.lot_id,type:'INVENTORY_OVER_RECEIPT'});
}
return {ok:!violations.length,violations:violations.slice(0,150),violation_count:violations.length,table_counts:Object.fromEntries(TABLES.map(t=>[t,datasets[t].length]))};}
function audit(action,table,id){const file=path.join(DATA_DIR,'_edit_audit.jsonl');fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),action,table,id,mode:'SIMULATED_NON_GXP'})+'\n')}
export function mutate({action,table,row,id,rows}){
 if(process.env.PHARMA_DATA_MODE!=='SIMULATED')throw Error('PHARMA_DATA_MODE=SIMULATED is required for edits');
 const idField=IDS[table];if(!idField)throw Error('Table not allowed');const current=rowsFor(table),columns=Object.keys(current[0]);let next=current.map(r=>({...r}));
 if(action==='upsert'){
  if(!row||typeof row!=='object'||!row[idField])throw Error('缺少唯一主键');if(Object.keys(row).some(k=>!columns.includes(k)))throw Error('非法列名');const ix=next.findIndex(r=>r[idField]===row[idField]);if(ix>=0)next[ix]={...next[ix],...row};else {if(columns.some(c=>row[c]===undefined||row[c]===null||row[c]===''))throw Error('新记录缺少必需字段');next.push(Object.fromEntries(columns.map(k=>[k,String(row[k])])))}
 }else if(action==='delete'){
  if(!id||!next.some(r=>r[idField]===id))throw Error('记录不存在');next=next.filter(r=>r[idField]!==id);
 }else if(action==='import'){
  if(!Array.isArray(rows)||rows.length>2000)throw Error('单次导入最多2000行');if(!rows.length||rows.some(r=>columns.some(c=>r[c]===undefined||r[c]===null||r[c]==='')))throw Error('导入字段必须完整');next=rows.map(r=>Object.fromEntries(columns.map(c=>[c,String(r[c])])))
 }else throw Error('Unsupported action');
 const auditResult=validateAll(table,next);if(!auditResult.ok)throw Error('拒绝更改：唯一键、引用或空字段校验失败 '+JSON.stringify(auditResult.violations.slice(0,3)));
 save(table,next);audit(action,table,id||row?.[idField]||'BATCH');return {ok:true,action,table,total:next.length,validation:auditResult};
}
