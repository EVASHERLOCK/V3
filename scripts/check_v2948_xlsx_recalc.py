#!/usr/bin/env python3
"""Recalculate actual generated XLSX using artifact_tool, fail closed on differences.
CLI takes a directory of nine XLSX samples, default /mnt/data/v2948_xlsx_checks.
This is a FILTERED SIMULATED SAMPLE, not enterprise data full-site acceptance.
"""
import json, sys, datetime
from collections import Counter
from pathlib import Path
from artifact_tool import Blob, SpreadsheetFile

ROOT=Path(__file__).resolve().parent.parent
DIR=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/v2948_xlsx_checks')
PAGES=['rfq','contracts','orders','shipments','invoices','payments','claims','closing','exceptions']
REPORT={'version':'2.9.48','tested_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'method':'Import real Excel XLSX; artifact_tool.recalculate(); inspect all web-vs-Excel per-cell formula comparison rows and KPI aggregation rows.',
 'scope':'SIMULATED_FILTER_SUP_001_ONLY_NOT_FULL_DATASET_NOT_LIVE_BROWSER',
 'pages':[], 'failures':[]}
for page in PAGES:
 fn=DIR/(page+'.xlsx')
 try:
  wb=SpreadsheetFile.import_xlsx(Blob.load(str(fn)))
  wb.recalculate()
  ws=wb.worksheets.get_item('网页Excel逐格对账')
  used=ws.get_used_range().address
  end=int(''.join(c for c in used.split(':')[-1] if c.isdigit()))
  rows=ws.get_range(f'A2:F{end}').values if end>=2 else []
  formulas=ws.get_range(f'E2:F{end}').formulas if end>=2 else []
  statuses=Counter(str(row[5]) for row in rows)
  if not rows:raise AssertionError('Reconciliation rows empty')
  if set(statuses)!={'MATCH'}:raise AssertionError('Comparison status: '+str(statuses))
  if len(rows)!=len(formulas) or any(not v[0].startswith('=') or not v[1].startswith('=') for v in formulas):raise AssertionError('Missing formula cells')
  if any(not isinstance(r[3],(int,float)) or not isinstance(r[4],(int,float)) or abs(r[3]-r[4])>1e-6 for r in rows):raise AssertionError('Web snapshot vs Excel values different')
  metric=wb.worksheets.get_item('指标计算')
  metricUsed=metric.get_used_range().address
  last=int(''.join(c for c in metricUsed.split(':')[-1] if c.isdigit()))
  metr=metric.get_range(f'A2:F{last}').values if last>=2 else []
  aggregator=0;metricMissing=0
  for k in metr:
   if not k[0]:continue
   if isinstance(k[2],(int,float)) and isinstance(k[3],(int,float)):
    aggregator+=1
    if abs(k[2]-k[3])>1e-6:raise AssertionError(f'KPI difference {k[0]}: {k[2]} != {k[3]}')
   else:metricMissing+=1
  REPORT['pages'].append({'page':page,'filtered_source_ids':len(set(str(r[0]) for r in rows)), 'cell_compare_rows':len(rows), 'match':statuses['MATCH'],'diff':0,'missing':0,'numeric_kpi_reconciled':aggregator,'non_numeric_kpi_unverified':metricMissing,'source':'SIMULATED'})
 except Exception as exc:REPORT['failures'].append({'page':page,'error':str(exc)})
REPORT['summary']={'pages_recalculated':len(REPORT['pages']),'derived_cell_matches':sum(p['match'] for p in REPORT['pages']), 'kpi_aggregations_reconciled':sum(p['numeric_kpi_reconciled'] for p in REPORT['pages']), 'unverified_aggregations':sum(p['non_numeric_kpi_unverified'] for p in REPORT['pages']), 'business_full_acceptance':'NOT_PASSED', 'enterprise_database_full_coverage':False,'deployed_http_browser_coverage':False,'failures':len(REPORT['failures'])}
(ROOT/('docs/V2948_静态Excel重算逐格对账.json' if 'static' in DIR.name.lower() else 'docs/V2948_Excel重算逐格对账.json')).write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(REPORT['summary'],ensure_ascii=False))
if REPORT['failures']:
 print(json.dumps(REPORT['failures'],ensure_ascii=False,indent=2))
 sys.exit(1)
