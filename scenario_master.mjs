/** Pharmaceutical scenario import: preserve the 5 source tables, derive joins, and
 * explicitly tag baseline-only extensions. No fabricated supplier approvals. */
import {loadMaster} from './suite.mjs';
const uniq=a=>[...new Set(a.filter(Boolean))];
const copy=x=>structuredClone(x);
export function makeScenario(input,meta={}){
 const baseline=loadMaster();
 for(const k of ['po','qc','production','inventory','changes'])if(!Array.isArray(input[k])||!input[k].length)throw Error('缺少数据表 '+k);
 const r=copy(baseline);
 for(const k of ['po','qc','production','inventory','changes'])r[k]=copy(input[k]);
 r.as_of=meta.as_of||baseline.as_of;
 for(const c of r.changes){c.category??='Unspecified';c.target_date??='';c.markets??='';}
 const uploadedPO=new Map(r.po.map(x=>[x.po_id,x]));
 for(const l of r.qc){l.supplier_id??=uploadedPO.get(l.po_id)?.supplier_id||'';}
 const uploadedLot=new Map(r.qc.map(x=>[x.lot_id,x]));
 for(const x of r.inventory){x.supplier_id??=uploadedLot.get(x.lot_id)?.supplier_id||'';}
 r.scenario_source=String(meta.source||'User uploaded workbook');
 r.data_version='v1.1-user-scenario';r.demo=false;
 r.note='五张用户数据表实时计算；未上传的合同、财务预算、供应商质量/注册/审批为演示扩展。勿作为正式企业决策。';
 const supplierIds=uniq(r.po.map(x=>x.supplier_id));
 const materialIds=uniq([...r.po,...r.qc,...r.production,...r.inventory,...r.changes].map(x=>x.material_id));
 const originalSup=new Map(baseline.suppliers.map(x=>[x.supplier_id,x]));
 const originalMat=new Map(baseline.materials.map(x=>[x.material_id,x]));
 r.suppliers=supplierIds.map(id=>originalSup.get(id)||{supplier_id:id,supplier_name:id,manufacturer:'UNVERIFIED',site:'Unknown',approved_status:'Unverified',risk_level:'Unknown'});
 r.materials=materialIds.map(id=>originalMat.get(id)||{material_id:id,name:id,category_group:'Unmapped',category:'Unmapped',qc_target_days:null,safety_days:null});
 r.sites=supplierIds.map(id=>baseline.sites.find(s=>s.site_id==='SITE-'+id.split('-').at(-1))||{site_id:'SITE-'+id.split('-').at(-1),site_name:'Site not verified',supplier_id:id});
 r.receipts=r.po.filter(x=>x.receipt_date).map(p=>({gr_id:'GR-'+p.po_id,po_id:p.po_id,material_id:p.material_id,supplier_id:p.supplier_id,lot_id:r.qc.find(l=>l.po_id===p.po_id)?.lot_id||'',received_qty:p.received_qty||p.ordered_qty,receipt_date:p.receipt_date,receipt_status:'Derived from user PO (not independent WMS evidence)'}));
 // An unrelated historic invoice must never be joined to a new PO. Keep only matching references.
 const poSet=new Set(r.po.map(x=>x.po_id)),matSet=new Set(materialIds),supSet=new Set(supplierIds);
 r.invoices=baseline.invoices.filter(x=>poSet.has(x.po_id));
 r.contracts=baseline.contracts.filter(x=>matSet.has(x.material_id)&&supSet.has(x.supplier_id));
 r.approved_sources=baseline.approved_sources.filter(x=>matSet.has(x.material_id)&&supSet.has(x.supplier_id));
 r.quotes=baseline.quotes.filter(x=>matSet.has(x.material_id)&&supSet.has(x.supplier_id));
 r.documents=baseline.documents.filter(x=>matSet.has(x.material_id)&&supSet.has(x.supplier_id));
 r.quality_events=baseline.quality_events.filter(x=>r.qc.some(l=>l.lot_id===x.lot_id));
 r.filings=baseline.filings.filter(x=>r.changes.some(c=>c.change_id===x.change_id));
 r.products=baseline.products.filter(x=>matSet.has(x.material_id));
 // Budget is not derivable from PO lines. Do not display a baseline budget as uploaded evidence.
 r.budget=[];r.savings_opportunities=[];
 return r;
}
