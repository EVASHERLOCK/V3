#!/usr/bin/env python3
"""Source-data integrity audit; does NOT claim visual acceptance of every page."""
import csv,json,pathlib,sqlite3,collections,datetime
root=pathlib.Path(__file__).resolve().parents[1];seed=root/'seed_simulated';tables={p.stem:list(csv.DictReader(p.open(encoding='utf-8-sig',newline=''))) for p in seed.glob('*.csv')}
master={k:set(r[k[:-1]+'_id'] if k!='projects' else r['project_id'] for r in tables[k]) for k in []}
keys={k:set(r[{'suppliers':'supplier_id','materials':'material_id','projects':'project_id'}[k]] for r in tables[k]) for k in ('suppliers','materials','projects')};errors=[]
for name,rows in tables.items():
 for j,row in enumerate(rows,2):
  for field,ref in (('supplier_id','suppliers'),('material_id','materials'),('project_id','projects')):
   if field in row and row[field] not in keys[ref]:errors.append((name,j,field,'ORPHAN'))
  for field,v in row.items():
   if not v.strip():errors.append((name,j,field,'BLANK'))
po={x['po_id']:x for x in tables['purchase_orders']};invoice={x['invoice_id']:x for x in tables['invoices']}; payments=tables['payments']
for p in payments:
 inv=invoice.get(p['invoice_id']);order=po.get(p['po_id']);
 if not inv or not order:errors.append(('payments',p['payment_id'],'invoice_id','UNKNOWN'))
 elif p['supplier_id']!=inv['supplier_id'] or p['project_id']!=order['project_id']:errors.append(('payments',p['payment_id'],'keys','MISMATCH'))
 elif p['payment_status']=='SIMULATED_SETTLED' and abs(float(p['payment_amount_usd'])-float(inv['invoice_amount_usd']))>.01:errors.append(('payments',p['payment_id'],'amount','MISMATCH'))
 elif p['payment_status']=='SIMULATED_SCHEDULED' and float(p['payment_amount_usd'])!=0:errors.append(('payments',p['payment_id'],'amount','FUTURE_PAYMENT_POSTED'))
months=collections.defaultdict(lambda:{'po_count':0,'spend_usd':0.,'on_time_count':0,'full_qty_count':0,'invoiced_usd':0.,'paid_usd':0.})
invby=collections.defaultdict(float)
for inv in tables['invoices']:invby[inv['po_id']]+=float(inv['invoice_amount_usd'])
payby=collections.defaultdict(float)
for pay in payments:payby[pay['po_id']]+=float(pay['payment_amount_usd'])
for x in tables['purchase_orders']:
 m=x['created_date'][:7];z=months[m];z['po_count']+=1;z['spend_usd']+=float(x['ordered_qty'])*float(x['unit_price']);z['on_time_count']+=int(x['receipt_date']<=x['promised_date']);z['full_qty_count']+=int(float(x['received_qty'])>=float(x['ordered_qty']));z['invoiced_usd']+=invby[x['po_id']];z['paid_usd']+=payby[x['po_id']]
with (seed/'monthly_kpi_summary.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.writer(f);w.writerow(['month','po_count','po_spend_usd','otd_percent','infull_percent','invoiced_usd','paid_usd','po_formula','otd_formula','payment_formula','simulated']);
 for m,z in sorted(months.items()):w.writerow([m,z['po_count'],round(z['spend_usd'],2),round(100*z['on_time_count']/z['po_count'],3),round(100*z['full_qty_count']/z['po_count'],3),round(z['invoiced_usd'],2),round(z['paid_usd'],2),'SUM(ordered_qty*unit_price)','100*COUNT(receipt_date<=promised_date)/COUNT(PO)','SUM(payment_amount_usd WHERE status=SIMULATED_SETTLED)','TRUE'])
assert len(months)==12
cx=sqlite3.connect(seed/'pharma_seed_simulated.sqlite');fk=cx.execute('PRAGMA foreign_key_check').fetchall();assert not fk;cx.close()
result={'seed':'V2941-SIMULATED-20261111','table_rows':{k:len(v) for k,v in tables.items()},'months':list(sorted(months)),'months_count':len(months),'missing_source_cells':sum(1 for e in errors if e[-1]=='BLANK'),'source_constraint_errors':len(errors),'sqlite_foreign_key_errors':len(fk),'all_source_cells_populated':not errors,'cross_page_visual_acceptance':'NOT_VERIFIED','decision_center_computed_kpis':15,'decision_center_total_kpis':115,'decision_center_missing_kpis':100,'other_legacy_engines':'SEPARATE_DATA_MODELS_REMAIN','notice':'No claim of full-site 100% coverage; simulated seed only.'}
(seed/'SITE_DATA_AUDIT_V2941.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False,indent=2));assert not errors
