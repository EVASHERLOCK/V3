#!/usr/bin/env python3
"""Node HTTP smoke test. Browser E2E is NOT implied by HTTP 200."""
import json, datetime, os, urllib.request
from pathlib import Path
base=os.environ.get('PHARMA_TEST_URL','http://127.0.0.1:39476')
root=Path(__file__).resolve().parent.parent
entries=[
 ('/static/sim_data_center.html','text/html'),
 ('/static/sim_full_source_v2948.js','text/javascript'),
 ('/static/decision-center/lineage_entry_v2948.js','text/javascript'),
 ('/static/procurement-execution/assets/full_formula_xlsx_v2948.mjs','text/javascript'),
 ('/engine/browser_xlsx_v2939.mjs','text/javascript'),
 ('/api/sim-data/overview','application/json'),
 ('/api/sim-data/complete-page?table=payments&limit=10','application/json'),
 ('/api/decision-center/evidence?metric=KPI-01-01','application/json'),
 ('/api/decision-center/workbook.xlsx?kind=metric&id=KPI-01-01','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
]
out={'scope':'NODE_HTTP_SMOKE_NOT_BROWSER_E2E_NOT_ENTERPRISE','tested_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'endpoints':[],'failures':[]}
for route,mime in entries:
 try:
  with urllib.request.urlopen(base+route,timeout=25) as res:
   head=res.read(512);ctype=res.headers.get('Content-Type','')
   ok=res.status==200 and ctype.startswith(mime)
   if route.startswith('/api/decision-center/workbook.xlsx'):ok=ok and head[:2]==b'PK'
   obj={'route':route,'http':res.status,'content_type':ctype,'verified':ok}
   out['endpoints'].append(obj)
   if not ok:out['failures'].append(obj)
   print('PASS' if ok else 'FAIL',res.status,route.split('?')[0],ctype)
 except Exception as exc:out['failures'].append({'route':route,'error':str(exc)});print('FAIL',route,exc)
(root/'docs/V2948_HTTP接口冒烟.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('HTTP cases',len(out['endpoints']),'failures',len(out['failures']))
if out['failures']:raise SystemExit(1)
