#!/usr/bin/env python3
"""Recalculate shipped static 115 KPI workbook. One supplier-filtered SIMULATED
snapshot only. Never constitutes live ERP, full database, or browser acceptance.
"""
import json, datetime, sys
from pathlib import Path
from collections import Counter
from artifact_tool import Blob, SpreadsheetFile
from openpyxl import load_workbook
ROOT=Path(__file__).resolve().parent.parent
PATH=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/Pharma_Decision_V2949_115_KPI_Formula_Reconciliation_DEMO.xlsx')
REPORT={'version':'2.9.49','scope':'115_KPIS_SIMULATED_SUP_001_FILTERED_STATIC_XLSX_INDEPENDENT_RECALC','tested_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'file':str(PATH),'formula_rows':0,'match':0,'diff':0,'missing':0,'failures':[],'enterprise_verified':False,'full_business_acceptance':'BLOCKED'}
try:
 raw=load_workbook(PATH,read_only=True,data_only=False)
 assert '逐行唯一计数' in raw.sheetnames and '逐行预测误差' in raw.sheetnames
 assert '网页Excel逐格对账' in raw.sheetnames and 'KPI公式' in raw.sheetnames
 rows=list(raw['KPI公式'].iter_rows(min_row=2,max_col=2,values_only=True))
 assert len(rows)==115,('KPI count',len(rows))
 assert all(isinstance(r[1],str) and r[1].startswith('=') for r in rows)
 check=list(raw['网页Excel逐格对账'].iter_rows(min_row=2,max_col=4,values_only=True))
 assert len(check)==115 and all(isinstance(r[3],str) and r[3].startswith('=') for r in check)
 wb=SpreadsheetFile.import_xlsx(Blob.load(str(PATH)))
 wb.recalculate()
 compared=wb.worksheets.get_item('网页Excel逐格对账').get_range('A2:D116').values
 statuses=Counter(str(r[3]) for r in compared)
 REPORT.update(formula_rows=len(rows),match=statuses['MATCH'],diff=statuses['DIFF'],missing=sum(v for k,v in statuses.items() if k not in ('MATCH','DIFF')),statuses=dict(statuses),sheets=len(raw.sheetnames))
 for r in compared:
  if r[3]!='MATCH' or not isinstance(r[1],(int,float)) or not isinstance(r[2],(int,float)) or abs(r[1]-r[2])>1e-6:
   REPORT['failures'].append({'metric':r[0],'web_value':r[1],'excel_value':r[2],'status':r[3]})
 assert not REPORT['failures'] and REPORT['match']==115, 'KPI mismatch, see report'
except Exception as e:
 REPORT['failures'].append({'error':str(e)})
(ROOT/'docs/V2949_绩效115KPI逐格重算.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n')
print('V2949 KPI actual XLSX independent recalculation:',REPORT['match'],'MATCH /',REPORT['formula_rows'],'metrics;',len(REPORT['failures']),'failures')
if REPORT['failures']:
 print(json.dumps(REPORT['failures'][:10],ensure_ascii=False,indent=2))
 raise SystemExit(1)
