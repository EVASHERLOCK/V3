#!/usr/bin/env python3
"""Deterministic non-GxP simulation; not actual pharmaceutical company data."""
import csv,sqlite3,random,calendar,datetime,json,pathlib
R=random.Random(2941); root=pathlib.Path(__file__).resolve().parents[1]; out=root/'seed_simulated'; out.mkdir(exist_ok=True)
months=[(2025+(10+i-1)//12,(10+i-1)%12+1) for i in range(1,13)] # Nov 2025 through Oct 2026
assert months[0]==(2025,11) and months[-1]==(2026,10)
rows={}
def add(table, rec):rows.setdefault(table,[]).append(rec)
def date(y,m,d):return datetime.date(y,m,min(d,calendar.monthrange(y,m)[1]))
def iso(d):return d.isoformat()
def later(d,n):return d+datetime.timedelta(days=n)
countries=['Switzerland','Germany','USA','Ireland','Singapore','India','Japan','France','Austria','China','UK','Belgium']
groups=['战略品','杠杆品','瓶颈品','非关键品']; cats=['API','Excipient','Biologic','Packaging','Solvent','Intermediate']
for i in range(1,81):
 sid=f'SUP-{i:03d}'; country=countries[(i-1)%len(countries)];name=f'Simulated Pharma Supplier {i:03d}'
 add('suppliers',dict(supplier_id=sid,supplier_name=name,manufacturer=f'Simulation Manufacturer {i:03d}',site=f'SIM-SITE-{i:03d}',country=country,approved_status='Approved' if i%7 else 'Pending',quality_score=round(78+i%20,1),delivery_score=round(76+(i*3)%23,1),risk_level=['Low','Medium','High'][i%3],simulated='TRUE'))
for i in range(1,121):
 mid=f'MAT-{i:03d}';group=groups[(i-1)//30];cat=cats[(i-1)%6]
 add('materials',dict(material_id=mid,material_name=f'Simulated {cat} Material {i:03d}',category=cat,kraljic_group=group,unit='kg' if i%5 else 'units',standard_price_usd=round(35+i*2.6,2),lead_time_days=20+i%65,safety_stock=40+i%31,simulated='TRUE'))
for i in range(1,25):
 add('projects',dict(project_id=f'PRJ-{i:03d}',project_name=f'Simulated Sourcing Project {i:03d}',product_line_id=f'PL-{(i-1)%30+1:03d}',project_owner=f'Buyer-{i%8+1:02d}',status=['Active','Review','Completed'][i%3],simulated='TRUE'))
for i in range(1,31):add('product_lines',dict(product_line_id=f'PL-{i:03d}',product_name=f'Simulated Drug Family {i:03d}',market=['US','EU','CN','JP'][i%4],simulated='TRUE'))
# Independent, versioned SIMULATED supplier-document events for certification expiry KPIs.
for i in range(1,81):
 sid=f'SUP-{i:03d}'; mid=f'MAT-{(i-1)%120+1:03d}'; pid=f'PRJ-{(i-1)%24+1:03d}'
 expiration=datetime.date(2026,11,11)+datetime.timedelta(days=((i*13)%190)-20)
 add('supplier_documents',dict(document_id=f'DOC-SIM-{i:05d}',document_type='DOC-004',supplier_id=sid,material_id=mid,project_id=pid,issued_date=iso(expiration-datetime.timedelta(days=365)),expiry_date=iso(expiration),review_status='SIMULATED_REVIEWED',simulated='TRUE'))
for i in range(1,1441):
 y,m=months[(i-1)//120]; sid=f'SUP-{(i-1)%80+1:03d}'; mid=f'MAT-{(i-1)%120+1:03d}'; pid=f'PRJ-{(i-1)%24+1:03d}'; po=f'PO-SIM-{i:05d}'; quantity=100+(i*13)%440; unit=round(38+((i*7)%120)*2.6+(i%9)*.75,2); bench=round(unit*(0.93+(i%11)*.012),2)
 created=date(y,m,3+(i*5)%10); prom=later(created,8+i%9); receipt=later(prom,[-6,-3,0,0,2,5,11][i%7]); received=quantity if i%11 else round(quantity*.85); amount=round(quantity*unit,2)
 add('purchase_orders',dict(po_id=po,supplier_id=sid,material_id=mid,project_id=pid,created_date=iso(created),approved_date=iso(later(created,2)),promised_date=iso(prom),receipt_date=iso(receipt),ordered_qty=quantity,received_qty=received,unit_price=unit,benchmark_price=bench,currency='USD',po_amount_usd=amount,simulated='TRUE'))
 add('quotes',dict(quote_id=f'QT-{i:05d}',po_id=po,supplier_id=sid,material_id=mid,project_id=pid,unit_price=unit,currency='USD',fx_to_usd=1,moq=50+(i%10)*10,lead_days=20+i%40,freight_usd=round(190+i%30*9,2),incoterm=['FCA','CIP','DAP'][i%3],payment_terms='Net 60',quoted_date=iso(later(created,-5)),simulated='TRUE'))
 contract=f'CON-{i:05d}';add('contracts',dict(contract_id=contract,po_id=po,supplier_id=sid,material_id=mid,project_id=pid,effective_date=iso(later(created,-30)),expiry_date=iso(later(created,365)),unit_price_usd=unit,currency='USD',status='SIMULATED_ACTIVE',simulated='TRUE'))
 lot=f'LOT-SIM-{i:05d}'; qc_hold=(i%13==0); release=later(receipt,7+i%12); qc_hold=qc_hold or release>datetime.date(2026,11,11)
 add('qc_lots',dict(lot_id=lot,po_id=po,supplier_id=sid,material_id=mid,project_id=pid,gr_date=iso(receipt),release_date=iso(release) if not qc_hold else iso(later(release,12)),status='Quarantined' if qc_hold else 'Released',quantity=received,simulated='TRUE'))
 add('inventory',dict(lot_id=lot,material_id=mid,supplier_id=sid,project_id=pid,quantity=max(0,received-(i*3)%max(1,received)),status='Quarantined' if qc_hold else 'Released',warehouse=f'WH-{i%4+1:02d}',expiry_date=iso(datetime.date(2026,11,11)+datetime.timedelta(days=i%60)) if i%67==0 else iso(later(receipt,700)),retest_date=iso(later(receipt,355)),simulated='TRUE'))
 add('production',dict(production_order=f'WO-SIM-{i:05d}',product_id=f'PL-{(i-1)%30+1:03d}',material_id=mid,project_id=pid,lot_id=lot,required_date=iso(later(receipt,30)),required_qty=max(1,received//2),allocated_qty=max(0,received//2-(10 if qc_hold else 0)),actual_consumed_qty=max(0,received//2-(13 if qc_hold else 2)),standard_qty=max(1,received//2),simulated='TRUE'))
 invoice=f'INV-SIM-{i:05d}'; inv_amt=round(received*unit,2);add('invoices',dict(invoice_id=invoice,po_id=po,supplier_id=sid,material_id=mid,project_id=pid,invoice_date=iso(later(receipt,2)),invoice_amount_usd=inv_amt,invoice_quantity=received,unit_price_usd=unit,status='QC_HOLD_REVIEW' if qc_hold else 'MATCHED',simulated='TRUE'))
 pay_day=later(receipt,32); pay_done=pay_day<=datetime.date(2026,11,11)
 add('payments',dict(payment_id=f'PAY-SIM-{i:05d}',invoice_id=invoice,po_id=po,supplier_id=sid,material_id=mid,project_id=pid,payment_date=iso(pay_day),payment_amount_usd=inv_amt if pay_done else 0,payment_status='SIMULATED_SETTLED' if pay_done else 'SIMULATED_SCHEDULED',simulated='TRUE'))
 # Business-specific, clearly synthetic event ledger for 115 management indicators.
 # Every event inherits the same PO/ supplier/ material/ project/ month primary dimensions.
 spend=round(quantity*unit,2); base_amount=round(quantity*bench,2)
 good_delivery=receipt<=prom; full_delivery=received>=quantity
 saving=max(0,round((bench-unit)*quantity,2)); saving_approved=saving if i%5!=0 else 0
 qc_released=int(not qc_hold); supplier_ok=int(int(sid[-3:])%7!=0)
 flags=lambda k: int(i%k!=0)
 add('metric_events',dict(
  event_id=f'MET-EVT-{i:05d}',po_id=po,supplier_id=sid,material_id=mid,project_id=pid,month=f'{y:04d}-{m:02d}',
  amount_usd=spend,benchmark_amount_usd=base_amount,approved_savings_usd=saving_approved,savings_target_usd=round(spend*.025,2),
  cost_avoidance_usd=round(spend*.008,2) if i%6 else 0,budget_usd=round(spend*1.04,2),old_tco_usd=round(spend*1.13,2),new_tco_usd=round(spend*1.085,2),
  expedite_fee_usd=round(spend*.055,2) if i%9==0 else 0,fx_exposure_usd=0,finance_approved=int(i%5!=0),
  rfq_days=8+i%6,onboard_days=25+i%55,pr_po_days=2+i%4,po_admin_cost_usd=12+i%5,rfq_responded=1,rfq_ontime=flags(11),
  sourcing_project_ontime=flags(7),research_milestone_ontime=flags(8),technical_ready=flags(9),early_procurement=flags(6),milestone_ontime=flags(12),
  po_first_correct=flags(13),contract_covered=1,contract_renewed=flags(17),supplier_ack_ontime=flags(10),match3=1, # Three-way PO/GR/invoice; QA release is a separate four-way gate.
  req_amount=round(spend*.98,2),supply_committed=quantity,quantity_required=quantity,forecast_qty=round(quantity*(1+(i%9-4)*.015),2),actual_qty=received,
  shortage_flag=int(received<quantity or qc_hold),shortage_amount_usd=round(max(0,quantity-received)*unit,2),mitigation_ontime=flags(14),
  usable_inventory_qty=max(0,received-(i*3)%max(1,received)) if not qc_hold else 0,safety_stock_qty=40+i%31,
  daily_consumption_qty=max(1,round(received/42,2)),consumed_qty=max(0,received//2-2),inventory_loss_qty=int(i%38==0)*3,inventory_loss_baseline_qty=max(1,round(max(0,received//2-2)*.003)),
  near_expiry_value_usd=round(max(0,received-(i*3)%max(1,received))*unit,2) if i%67==0 else 0,stock_qualified=int(not qc_hold),
  supplier_score=round((78+int(sid[-3:])%20)*.55+(76+(int(sid[-3:])*3)%23)*.45,2),supplier_research_score=round(80+(i%15),2),
  qc_first_pass=qc_released,quality_incident=int(qc_hold),capa_ontime=flags(7),major_response_ontime=flags(9),quality_recurrence=int(i%55==0),
  audit_valid=flags(16),qaa_valid=flags(15),gmp_valid=flags(11),supplier_approved=supplier_ok,audit_overdue=int(i%43==0),
  audit_finding_overdue=int(i%71==0),change_notice_ontime=flags(6),restricted_source_order=int(not supplier_ok),
  cold_chain_compliant=int(i%40!=0 and i%41!=0),work_package_ontime=flags(9),dossier_ontime=flags(12),validation_sample_ontime=flags(13),
  validation_batch_ontime=flags(8),technical_evidence_ready=flags(14),ra_market_ready=flags(10),ra_blocked=int(i%10==0),
  change_milestone_ontime=flags(9),change_notice_gap=int(i%6==0),post_change_incident=int(i%44==0),
  single_source_material=int(int(mid[-3:])%4==0),second_source_approved=flags(4),strategic_event_ready=flags(11),
  source_switch_ready=flags(12),strategy_issue_open=int(i%22==0),inbound_ontime=int(good_delivery),temperature_excursion=int(i%41==0),
  customs_delayed=int(i%37==0),freight_base_usd=round(190+i%30*9,2),bcp_effective=flags(10),
  financial_risk=int(i%29==0),capacity_committed=round(quantity*1.03,2),transport_compliant=int(i%23!=0 and i%41!=0),
  high_action_overdue=int(i%47==0),action_closed_ontime=flags(9),improvement_verified=flags(8),data_fresh=flags(15),
  kpi_target_valid=flags(19),digitally_processed=flags(6),requester_satisfaction=round(80+i%19,2),training_authorized=flags(14),
  supplier_response_days=1+i%9,delivery_variance_days=abs((receipt-prom).days),simulated='TRUE'))
 if i%17==0:add('claims',dict(claim_id=f'RMA-SIM-{i:05d}',po_id=po,supplier_id=sid,material_id=mid,project_id=pid,claim_type='Delivery damage',claim_amount_usd=round(inv_amt*.04,2),status='SIMULATED_REVIEW',simulated='TRUE'))
 if i%14==0:add('change_controls',dict(change_id=f'CC-SIM-{i:05d}',material_id=mid,supplier_id=sid,project_id=pid,status=['RA Assessment','QA Review','Closed'][i%3],opened_date=iso(later(created,4)),target_date=iso(later(created,120)),markets='US;EU;CN',category='Manufacturing site change',simulated='TRUE'))
 if receipt>prom or qc_hold:
  ex_closed=(i%5==0 and later(receipt,9)<=datetime.date(2026,11,11))
  add('exceptions',dict(exception_id=f'EX-SIM-{i:05d}',po_id=po,supplier_id=sid,material_id=mid,project_id=pid,exception_type='QC hold' if qc_hold else 'Delayed receipt',severity='HIGH' if qc_hold else 'MEDIUM',status='SIMULATED_CLOSED' if ex_closed else 'SIMULATED_OPEN',closed_date=iso(later(receipt,9)) if ex_closed else 'SCHEDULED',simulated='TRUE'))
# V2.9.43 – two sourced alternative bids for every RFQ. Alternatives are not awarded PO contracts.
# The RFQ group is identified by the original PO demand, but the bid supplier is independent.
for i,p in enumerate(rows['purchase_orders'],1):
    awarded_idx=int(p['supplier_id'][-3:])
    for option in (1,2):
        alt_idx=((awarded_idx+option*7-1)%80)+1
        alt='SUP-'+str(alt_idx).zfill(3)
        assert alt!=p['supplier_id']
        price=round(float(p['unit_price'])*(1.0+(.045 if option==1 else -.026)),2)
        add('rfq_alternates',dict(
            quote_id=f'ALT-QT-{i:05d}-{option}',po_id=p['po_id'],supplier_id=alt,
            material_id=p['material_id'],project_id=p['project_id'],unit_price=price,
            currency='USD',fx_to_usd=1,moq=50+(i+option*3)%10*10,
            lead_days=19+(i+option*11)%45,freight_usd=round(200+((i+option*4)%30)*9,2),
            incoterm=['FCA','CIP','DAP'][(i+option)%3],payment_terms='Net 60',
            quoted_date=iso(later(datetime.date.fromisoformat(p['created_date']),-5+option)),
            awarded_flag=0,simulated='TRUE'))
# V2.9.43 – explicit document and authorization facts, all joined by PO and primary dimensions.
contract_by_po={r['po_id']:r for r in rows['contracts']}
quote_by_po={r['po_id']:r for r in rows['quotes']}
qc_by_po={r['po_id']:r for r in rows['qc_lots']}
invoice_by_po={r['po_id']:r for r in rows['invoices']}
payment_by_po={r['po_id']:r for r in rows['payments']}
supplier_names={r['supplier_id']:r['supplier_name'] for r in rows['suppliers']}
events_by_po={r['po_id']:r for r in rows['metric_events']}
for p in rows['purchase_orders']:
    id=p['po_id'];q=quote_by_po[id];c=contract_by_po[id];iv=invoice_by_po[id];pm=payment_by_po[id];lot=qc_by_po[id];ev=events_by_po[id]
    common=dict(po_id=id,supplier_id=p['supplier_id'],material_id=p['material_id'],project_id=p['project_id'],simulated='TRUE')
    add('contract_documents',dict(contract_document_id='DOC-'+c['contract_id'],contract_id=c['contract_id'],**common,
        contract_type=['SIMULATED_FRAMEWORK_SUPPLY','SIMULATED_PURCHASE_AGREEMENT','SIMULATED_QUALITY_APPENDIX'][int(id[-2:])%3],
        contract_version='SIM-REV-01',buyer_legal_entity='SIMULATED PHARMA BUYER LTD',seller_legal_entity=supplier_names[p['supplier_id']],
        signature_date=c['effective_date'],signature_authorized='SIMULATED_AUTHORIZED',nda_term_months=60,
        payment_terms=q['payment_terms'],incoterm_named_place=q['incoterm']+' SIM-Receiving-Site',
        specification_version='SPEC-'+p['material_id']+'-REV-A',qaa_document_id='QAA-SIM-'+p['supplier_id'],
        legal_review_status='SIMULATED_DOCUMENT_REVIEWED',quality_document_status='SIMULATED_DOCS_ATTACHED'))
    sent=datetime.date.fromisoformat(p['receipt_date'])-datetime.timedelta(days=3)
    add('shipment_documents',dict(shipment_document_id='DOC-ASN-'+id,**common,asn_id='ASN-SIM-'+id,waybill_id='WAY-SIM-'+id,
        dispatched_date=iso(sent),arrival_date=p['receipt_date'],lot_id=lot['lot_id'],
        coa_document_id='COA-SIM-'+lot['lot_id'],proof_of_delivery_id='POD-SIM-'+id,
        temperature_record_status='SIMULATED_EXCURSION' if int(ev['temperature_excursion']) else 'SIMULATED_IN_RANGE',
        qa_document_status='SIMULATED_RELEASED' if lot['status']=='Released' else 'SIMULATED_QA_HOLD'))
    paid=pm['payment_status']=='SIMULATED_SETTLED'
    add('payment_authorizations',dict(payment_authorization_id='AUTH-'+pm['payment_id'],**common,
        payment_id=pm['payment_id'],invoice_id=iv['invoice_id'],bank_account_masked='SIM-ACCT-XXXX-'+p['supplier_id'][-3:],
        bank_two_channel_verified='SIMULATED_VERIFIED' if paid else 'SIMULATED_PENDING',
        ap_authorization='SIMULATED_APPROVED' if paid else 'SIMULATED_PENDING',
        payment_batch_id='BATCH-SIM-'+pm['payment_id'] if paid else 'SIMULATED_NOT_EXECUTED',
        bank_receipt_ref='BANK-SIM-'+pm['payment_id'] if paid else 'SIMULATED_NO_RECEIPT',
        payment_execution_date=pm['payment_date'] if paid else 'SIMULATED_NOT_EXECUTED'))
# V2.9.43 – separate simulated claim recovery/credit-note facts; do not infer recovery from claim amount alone.
po_by={r['po_id']:r for r in rows['purchase_orders']}
for c in rows['claims']:
    p=po_by[c['po_id']]
    claim_open=datetime.date.fromisoformat(p['receipt_date'])+datetime.timedelta(days=5)
    settled_day=claim_open+datetime.timedelta(days=21)
    settled=settled_day<=datetime.date(2026,11,11)
    recovered=round(float(c['claim_amount_usd'])*.60,2) if settled else 0
    add('claim_settlements',dict(
      settlement_id='SET-'+c['claim_id'],claim_id=c['claim_id'],po_id=c['po_id'],supplier_id=c['supplier_id'],material_id=c['material_id'],project_id=c['project_id'],
      settlement_amount_usd=recovered,settlement_date=iso(settled_day) if settled else 'SIMULATED_NOT_SETTLED',
      settlement_status='SIMULATED_PARTIAL_SETTLED' if settled else 'SIMULATED_PENDING',
      credit_note_id='CR-'+c['claim_id'] if settled else 'SIMULATED_NOT_ISSUED',
      credit_note_amount_usd=recovered,simulated='TRUE'))
for table,rs in rows.items():
 with (out/(table+'.csv')).open('w',encoding='utf-8-sig',newline='') as f:
  writer=csv.DictWriter(f,fieldnames=list(rs[0]));writer.writeheader();writer.writerows(rs)
db=out/'pharma_seed_simulated.sqlite';db.unlink(missing_ok=True);cx=sqlite3.connect(db);cx.execute('PRAGMA foreign_keys=ON')
cx.execute('CREATE TABLE suppliers (supplier_id TEXT PRIMARY KEY,supplier_name TEXT NOT NULL)')
cx.execute('CREATE TABLE materials (material_id TEXT PRIMARY KEY,material_name TEXT NOT NULL,category TEXT NOT NULL,kraljic_group TEXT NOT NULL)')
cx.execute('CREATE TABLE projects (project_id TEXT PRIMARY KEY,project_name TEXT NOT NULL)')
for r in rows['suppliers']:cx.execute('INSERT INTO suppliers VALUES(?,?)',(r['supplier_id'],r['supplier_name']))
for r in rows['materials']:cx.execute('INSERT INTO materials VALUES(?,?,?,?)',(r['material_id'],r['material_name'],r['category'],r['kraljic_group']))
for r in rows['projects']:cx.execute('INSERT INTO projects VALUES(?,?)',(r['project_id'],r['project_name']))
for table,rs in rows.items():
 if table in ('suppliers','materials','projects'):continue
 cols=list(rs[0])
 primary={'product_lines':'product_line_id','supplier_documents':'document_id','purchase_orders':'po_id','quotes':'quote_id','rfq_alternates':'quote_id','contracts':'contract_id','contract_documents':'contract_document_id','qc_lots':'lot_id','inventory':'lot_id','production':'production_order','invoices':'invoice_id','payments':'payment_id','payment_authorizations':'payment_authorization_id','shipment_documents':'shipment_document_id','metric_events':'event_id','exceptions':'exception_id','change_controls':'change_id','claims':'claim_id','claim_settlements':'settlement_id'}
 pk=primary.get(table)
 defs=','.join('"'+c+'" TEXT NOT NULL'+(' PRIMARY KEY' if c==pk else '') for c in cols)
 for key in ('supplier_id','material_id','project_id'):
  if key in cols:defs+=f',FOREIGN KEY("{key}") REFERENCES {"suppliers" if key=="supplier_id" else "materials" if key=="material_id" else "projects"}({key})'
 for key,ref_table,ref_id in [('po_id','purchase_orders','po_id'),('invoice_id','invoices','invoice_id'),('payment_id','payments','payment_id'),('claim_id','claims','claim_id'),('contract_id','contracts','contract_id'),('lot_id','qc_lots','lot_id')]:
  if key in cols and key!=pk:defs+=f',FOREIGN KEY("{key}") REFERENCES "{ref_table}"("{ref_id}")'
 cx.execute(f'CREATE TABLE "{table}" ({defs})')
 cx.executemany(f'INSERT INTO "{table}" VALUES ({",".join("?" for _ in cols)})',[[str(r[c]) for c in cols] for r in rs])
cx.commit();bad=cx.execute('PRAGMA foreign_key_check').fetchall();assert not bad,bad
assert len(rows['suppliers'])==80 and len(rows['materials'])==120 and len(rows['projects'])==24
po={r['po_id']:r for r in rows['purchase_orders']};invoice={r['invoice_id']:r for r in rows['invoices']};assert all(r['po_id'] in po for r in rows['payments']);assert all((abs(float(r['payment_amount_usd'])-float(invoice[r['invoice_id']]['invoice_amount_usd']))<.001 if r['payment_status']=='SIMULATED_SETTLED' else float(r['payment_amount_usd'])==0) for r in rows['payments'])
summary={k:len(v) for k,v in rows.items()}; summary.update({'date_start':'2025-11-01','date_end':'2026-10-31','seed':'V2941-SIMULATED-20261111','foreign_key_errors':0,'enterprise_data':False,'notice':'STRICTLY SIMULATED. NOT VALID FOR REGULATORY OR FINANCIAL DECISIONS'})
(out/'manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(summary,ensure_ascii=False))
