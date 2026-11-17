"""Real running HTTP endpoint smoke, NOT a Chromium end-to-end click test."""
import json,os,urllib.request,urllib.error,urllib.parse
from pathlib import Path
BASE=os.environ.get('PHARMA_TEST_URL','http://127.0.0.1:39549')
ROOT=Path(__file__).resolve().parent.parent
PATHS=[f'/static/decision-center/0{i}_{label}.html' for i,label in enumerate(['KPI总览','深度分析','智能预警','行动闭环','指标治理'],1)]
PATHS += [f'/static/procurement-execution/0{i}_{label}.html' for i,label in enumerate(['询价与报价比对','合同核查','PO创建与比对','发运与到货','发票核对','付款与应付','退货与索赔','订单关闭与绩效','异常处理中心'])]
PATHS += ['/static/audit/audit_ui_v2949.js','/static/audit/metric_catalog_v2949.json','/static/decision-center/offline_v2942.mjs','/engine/simulation_kpi_v2942.mjs','/engine/browser_xlsx_v2939.mjs','/api/decision-center/module?kind=metric&id=KPI-01-01&supplier=SUP-001','/api/decision-center/workbook.xlsx?kind=metric&id=KPI-01-01&supplier=SUP-001','/api/procurement-execution/workbook.xlsx?page=orders&supplier=SUP-001']
report={'version':'2.9.49','scope':'REAL_NODE_HTTP_ENDPOINTS_NOT_BROWSER_E2E','checks':[],'errors':[],'enterprise_db_verified':False,'business_acceptance':'BLOCKED'}
for url in PATHS:
 try:
  with urllib.request.urlopen(BASE+urllib.parse.quote(url,safe="/?=&"),timeout=12) as r:
   content=r.read();item={'path':url,'status':r.status,'bytes':len(content),'content_type':r.headers.get('Content-Type')};assert r.status==200 and content,item
   if '.html' in url:assert b'audit_ui_v2949.js' in content,'Missing shared control include'
   if url.endswith('.json'): assert json.loads(content)['metric_count']==171
   if url.startswith('/api/decision-center/module?'):
    data=json.loads(content);assert data['computed']==1 and all(t['count']==len(t['rows']) for t in data['tables'])
   if '.xlsx' in url: assert content[:2]==b'PK','Invalid XLSX signature'
   report['checks'].append(item)
 except Exception as e:report['errors'].append({'path':url,'error':str(e)[:300]})
(ROOT/'docs/V2949_HTTP接口冒烟.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('V2949 HTTP',len(report['checks']),'passed',len(report['errors']),'failed')
if report['errors']:print(json.dumps(report['errors'],ensure_ascii=False,indent=2));raise SystemExit(1)
