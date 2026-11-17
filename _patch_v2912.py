from pathlib import Path
p=Path('static/index.html');s=p.read_text();s=s.replace('<link rel="stylesheet" href="/static/strategic_sourcing_technical.css"/>','<link rel="stylesheet" href="/static/strategic_sourcing_technical.css"/>\n<link rel="stylesheet" href="/static/top10_governance.css"/>');s=s.replace('v2.9.9 · Non-GxP','v2.9.12 · Non-GxP');p.write_text(s)
p=Path('scripts/regenerate-inline.mjs');s=p.read_text().replace("fs.readFileSync(path.join(root,'static','strategic_sourcing_runtime.js'),'utf8')+", "fs.readFileSync(path.join(root,'static','top10_governance.js'),'utf8')+'\\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_runtime.js'),'utf8')+");p.write_text(s)
p=Path('static/app.js');s=p.read_text();needle='wireOnRender();if(S.view';assert needle in s;s=s.replace(needle,'wireOnRender();window.PharmaTopTen?.apply?.(c);if(S.view',1);p.write_text(s)
# canonical schema for existing 80 records, never converting a lead into a qualified supplier
p=Path('static/strategic_sourcing_universe.js');s=p.read_text();needle=' // Optional customer-uploaded candidates are local discovery leads, never regulatory approvals.';assert needle in s
s=s.replace(needle,''' // V2.9.12 normalized canonical supplier/site/material dossier. Null denotes missing evidence;
 // demo comparisons are deliberately distinct from validated quote/qualification evidence.
 const normalizeProfile=s=>{
   const demo=!!s.is_scenario || s.data_origin==='BASE_DEMO';
   const sample=!!s.is_scenario && s.data_origin!=='FDA_DEVICE_REGISTRATION'&&s.data_origin!=='OFFICIAL_PUBLIC_LEAD';
   const sourceKind=s.data_origin==='FDA_DEVICE_REGISTRATION'||s.data_origin==='OFFICIAL_PUBLIC_LEAD'?'OFFICIAL_LEAD':s.data_origin==='LOCAL_UPLOAD'?'MANUAL_UNVERIFIED':'DEMO';
   return {...s,profile_key:[s.supplier_id,s.site||'UNKNOWN_SITE',s.material_id].join('|'),
     data_class:sourceKind,legal_entity_id:s.legal_entity_id||null,site_id:s.site_id||null,
     document_status:s.document_status||'待核验',
     quote_status:sample?'SYNTHETIC_PRICE':s.quote_status||'NO_VERIFIED_QUOTE',
     quote_unit_price_usd:sample?Number(s.demo_price_usd):null,
     quote_currency:sample?'USD':null,quote_uom:sample?'kg':null,
     quote_moq:sample?Math.max(100,Number(s.demo_moq||100)):null,
     quote_lead_days:sample?Number(s.demo_lead_days):null,
     quote_freight_usd:sample?Number(s.demo_freight_usd):null,
     quote_incoterms:sample?'EXW(演示假设)':null,
     gmp_status:sample?'UNKNOWN':null,cep_status:sample?'UNKNOWN':null,
     asl_status:sample?'UNAPPROVED':null,site_material_status:sample?'UNAPPROVED':null,
     risk_score:s.risk_index_scenario??null,
     evidence_url:s.evidence_url||null,evidence_checked_at:s.evidence_checked_at||null,
     reviewed_at:s.reviewed_at||null,reviewed_by:s.reviewed_by||null,
     purchase_authorized:false,verified_supplier:false,
     scenario_flag:demo,price_is_demo:sample,
     provenance:{origin:s.data_origin,mode:sourceKind,verified:false,source_url:s.evidence_url||null,fetched_at:s.evidence_checked_at||null}
   };
 };
 BASE=BASE.map(normalizeProfile);
 // Attaches existing validated business evidence to canonical records without approving demo-only leads.
 function hydrate(raw){const suppliers=raw?.master?.suppliers||[],quotes=raw?.sourcing?.quotes||[],sources=raw?.qualification?.sources||[],docs=raw?.qualification?.documents||[];
  for(const s of BASE){const base=surp=>surp.supplier_id===s.supplier_id;const material=r=>r.material_id===s.material_id;
   s.erp_quote=quotes.find(q=>base(q)&&material(q))||null;
   s.erp_supplier=suppliers.find(base)||null;
   s.erp_qualification=sources.find(q=>base(q)&&material(q))||null;
   s.erp_documents=docs.filter(d=>base(d)&&material(d));
   if(s.erp_quote && !s.is_scenario){s.quote_status='BASE_DEMO_QUOTE';s.quote_unit_price_usd=Number(s.erp_quote.unit_price)*Number(s.erp_quote.fx_to_usd||1);s.quote_currency=s.erp_quote.currency;s.quote_moq=Number(s.erp_quote.moq)||null;s.quote_lead_days=Number(s.erp_quote.lead_days)||null;s.quote_freight_usd=Number(s.erp_quote.freight_usd)||0;}
   const q=s.erp_qualification;
   if(q && !s.is_scenario){s.gmp_status=q.gmp_audit_status||'UNKNOWN';s.asl_status=q.in_asl_for_site?'DEMO_ASL_LISTED':'UNAPPROVED';s.site_material_status=q.prequalified&&q.approved_for_use&&!q.critical_expired&&q.in_asl_for_site?'DEMO_SOURCE_APPROVED':'UNAPPROVED';
    s.cep_status=s.erp_documents.some(d=>/\\bCEP\\b/i.test(d.type||'')&&d.status==='Valid'&&Number(d.days_to_expiry)>0)?'DEMO_VALID':'UNKNOWN';}
  }
  return BASE;
 }
'''+needle)
# in ingestOfficial and ingestLocal all new additions go through normalizer
s=s.replace("BASE.push({...s,qualified_for_purchase:'NO',is_scenario:true,evidence_status:'FDA 器械登记线索 · 非合规准入证据'});", "BASE.push(normalizeProfile({...s,qualified_for_purchase:'NO',is_scenario:true,evidence_status:'FDA 器械登记线索 · 非合规准入证据'}));")
s=s.replace('  BASE.push({supplier_id:id,supplier_name:', '  BASE.push(normalizeProfile({supplier_id:id,supplier_name:')
s=s.replace("risk_index_scenario:null});added++", "risk_index_scenario:null}));added++") # verify replacement
s=s.replace('const universe={catalog:BASE,categoryDefs,regionDefs,riskKinds,worldPaths:WORLD,build,ingestOfficial,ingestLocal,DATA_ORIGIN:', 'const universe={catalog:BASE,categoryDefs,regionDefs,riskKinds,worldPaths:WORLD,build,hydrate,normalizeProfile,ingestOfficial,ingestLocal,DATA_ORIGIN:')
p.write_text(s)
p=Path('static/strategic_sourcing_runtime.js');s=p.read_text().replace('snapshot=raw;readCount++','snapshot=raw;window.PharmaSourcingUniverse?.hydrate?.(raw);readCount++').replace('if(raw&&raw.master)snapshot=raw','if(raw&&raw.master){snapshot=raw;window.PharmaSourcingUniverse?.hydrate?.(raw)}');p.write_text(s)
