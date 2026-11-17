/** Shared, versioned sourcing facts for every module. Never mix scenario values
 * into trade/OTD/risk metrics; V08 is explicitly sample evidence, not ERP. */
import fs from 'node:fs';
const SOURCE='V08_DEMO_SAMPLE';
const rawCatalog=JSON.parse(fs.readFileSync(new URL('./static/data/canonical_supplier_directory_v2921.json',import.meta.url),'utf8'));
const seeds=rawCatalog.filter(x=>x.is_scenario);
for(let k=0;k<30;k++){const src=seeds[(k*7+3)%seeds.length],api=k<18;rawCatalog.push({...src,supplier_id:'DEMO-'+String(k+51).padStart(3,'0'),supplier_name:'演示寻源候选 '+String(k+51).padStart(3,'0'),material_id:api?(k<14?'API-001':'API-002'):src.material_id,material_category:api?'API':src.material_category,category_name:api?'API原料药':src.category_name,data_origin:'SYNTHETIC_DEMO',is_scenario:true,evidence_status:'合成演示候选 · 非真实企业 / 未核验',qualified_for_purchase:'NO',risk_origin:'SYNTHETIC_SCENARIO',risk_index_scenario:21+(k*13)%69});}
const asArray=x=>Array.isArray(x)?x:[];
const number=x=>{if(x==null||x==='')return null;const n=Number(x);return Number.isFinite(n)?n:null};
const key=(supplier,site,material)=>[supplier||'UNKNOWN_SUPPLIER',site||'UNKNOWN_SITE',material||'UNKNOWN_MATERIAL'].join('|');
const only=(record,filters={})=>(!filters.supplier||filters.supplier==='all'||record.supplier_id===filters.supplier)&&(!filters.material||filters.material==='all'||record.material_id===filters.material)&&(!filters.year||filters.year==='all'||String(record.created_date||record.date||'').startsWith(filters.year));
export function sourcingFacts(raw,{filters={},published=[]}={}){
 const core=raw||{};
 const materials=asArray(core.master?.materials),sites=asArray(core.master?.sites),suppliers=asArray(core.master?.suppliers);
 const siteBySupplier=new Map(sites.map(s=>[s.supplier_id,s.site_id]));
 const rawPO=asArray(core.purchasing?.orders).map((po,i)=>({
   id:String(po.po_id||`ROW-${i+1}`),supplier_id:String(po.supplier_id),site_id:siteBySupplier.get(po.supplier_id)||null,material_id:String(po.material_id),created_date:String(po.created_date||''),qty:number(po.ordered_qty),received:number(po.received_qty),amount_usd:number(po.amount),price_usd:number(po.unit_price),baseline_usd:number(po.benchmark_price),delay_days:number(po.delay_days),source:SOURCE,source_row:`purchasing.orders[${i}]`,scope_key:key(po.supplier_id,siteBySupplier.get(po.supplier_id),po.material_id)
 }));
 const purchaseOrders=rawPO.filter(po=>only(po,filters));
 const rawQuotes=asArray(core.sourcing?.quotes).map((q,i)=>({...q,id:`DEMO-RFQ-${i+1}`,unit_usd:number(q.unit_price)*(number(q.fx_to_usd)??1),source:SOURCE,source_row:`sourcing.quotes[${i}]`,scope_key:key(q.supplier_id,siteBySupplier.get(q.supplier_id),q.material_id)}));
 const quotes=rawQuotes.filter(q=>(!filters.material||filters.material==='all'||q.material_id===filters.material)&&(!filters.supplier||filters.supplier==='all'||q.supplier_id===filters.supplier));
 const rawSources=asArray(core.qualification?.sources).map((s,i)=>({...s,id:`DEMO-QUAL-${i+1}`,source:SOURCE,source_row:`qualification.sources[${i}]`,scope_key:key(s.supplier_id,s.site_id,s.material_id),sample_qualification:!!s.prequalified&&!!s.approved_for_use&&!s.critical_expired&&!!s.in_asl_for_site}));
 const qualifications=rawSources.filter(s=>(!filters.material||filters.material==='all'||s.material_id===filters.material)&&(!filters.supplier||filters.supplier==='all'||s.supplier_id===filters.supplier));
 const documents=asArray(core.qualification?.documents).filter(d=>(!filters.material||filters.material==='all'||d.material_id===filters.material)&&(!filters.supplier||filters.supplier==='all'||d.supplier_id===filters.supplier)).map((d,i)=>({...d,source:SOURCE,source_row:`qualification.documents[${i}]`}));
 const catalog=rawCatalog.map((c,i)=>({...c,source_class:i<3?'V08_DEMO_SAMPLE':'SCENARIO',source:c.data_origin,scenario_only:i>=3,qualified_for_purchase:false,spend_usd:null,valid_quote:false}));
 const existing=new Map(catalog.map(c=>[c.supplier_id+'|'+c.material_id,c]));
 for(const p of asArray(published)){
   if(p.status!=='PUBLISHED'||p.qualification_status!=='UNVERIFIED')continue;
   const record={supplier_id:p.supplier_id,site_id:p.site_id||null,material_id:p.material_id, supplier_name:p.company_name||p.supplier_id,country:'待核验',material_category:'UNVERIFIED',source_class:'OFFICIAL_REVIEWED_LEAD',data_origin:'OFFICIAL_REVIEWED_LEAD',source_record_id:p.source_record_id,source_url:p.source_url,source_hash:p.source_hash,source_observed_at:p.observed_at,qualification_status:'UNVERIFIED',qualified_for_purchase:false,spend_usd:null,valid_quote:false,scenario_only:false,is_scenario:false};
   const k=p.supplier_id+'|'+p.material_id;
   if(existing.has(k)){const previous=existing.get(k);previous.official_lead={source_url:p.source_url,source_hash:p.source_hash,reviewed_at:p.reviewed_at,status:'PUBLISHED_UNQUALIFIED'};continue}
   catalog.push(record);existing.set(k,record);
 }
 const scopedCatalog=catalog.filter(c=>(!filters.material||filters.material==='all'||c.material_id===filters.material)&&(!filters.supplier||filters.supplier==='all'||c.supplier_id===filters.supplier));
 return {scope:{...filters,source_boundary:SOURCE,source_release:core.meta?.as_of||null},supplierMaster:suppliers,materials,sites,purchaseOrders,rawPurchaseOrders:rawPO,quotes,rawQuotes,qualifications,rawQualifications:rawSources,documents,catalog:scopedCatalog,allCatalog:catalog,published:scopedCatalog.filter(c=>c.source_class==='OFFICIAL_REVIEWED_LEAD')};
}
export const sourcingKey=key;
export const isSourcePO=r=>r?.source===SOURCE&&r.amount_usd!=null;
