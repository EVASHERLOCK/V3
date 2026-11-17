"""Offline Chromium DOM tests. NOT a live-HTTP browser end-to-end acceptance."""
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'static/procurement-execution'
obj=json.loads((SRC/'site-data.js').read_text().split('=',1)[1].strip().removesuffix(';'))
APP=(SRC/'assets/app.js').read_text()
BIZ=(SRC/'assets/biz_data.js').read_text()
SITE=(SRC/'assets/site_integration_v2937.js').read_text()
DEC=(ROOT/'static/decision-center/lineage_entry_v2948.js').read_text()
REPORT={'test_type':'CHROMIUM_OFFLINE_DOM_INJECTED_NOT_HTTP_E2E','execution':[],'decision':[],'failures':[],'verified_live_http_pages':0}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for page_id in ['rfq','contracts','orders','shipments','invoices','payments','claims','closing','exceptions']:
  pg=b.new_page();pg.on('pageerror',lambda e:None)
  try:
   db={**obj,'pages':[{**pm,'rows':pm['rows'][:20] if pm['id']!='exceptions' else pm['rows'][:10]} for pm in obj['pages']]}
   pg.set_content(f'<html><head></head><body data-page="{page_id}"><div id="app"></div></body></html>')
   pg.add_script_tag(content='window.APP_DATA='+json.dumps(db,ensure_ascii=False)+';')
   pg.add_script_tag(content=BIZ)
   pg.add_script_tag(content=SITE)
   pg.add_script_tag(content=APP)
   panels=pg.locator('section.panel')
   n=panels.count();assert n>=6,(page_id,n)
   passed=[]
   for panel in panels.all():
    key=panel.get_attribute('id')
    f=panel.locator('[data-action="lineage"]').first
    f.click(); assert pg.locator('#drawer-cover').get_attribute('class').find('show')>=0,(page_id,key,'formula click');passed.append('formula')
    pg.locator('[data-action="close-drawer"]').first.click()
    help=panel.locator('[data-action="help"]').first
    help.click();assert pg.locator('#drawer-cover').get_attribute('class').find('show')>=0,(page_id,key,'variable click')
    pg.locator('[data-action="close-drawer"]').first.click()
    fold=panel.locator('[data-action="fold"]').first
    fold.click();assert not panel.locator('.sourceFold').is_hidden(),(page_id,key,'fold click')
    assert panel.locator('a[href^="workbooks/"]').count()>0,(page_id,key,'xlsx link')
   REPORT['execution'].append({'page':page_id,'panels':n,'entry_clicks_formula':n,'variable_clicks':n,'source_clicks':n,'xlsx_links':n,'status':'OFFLINE_DOM_INTERACTION_OK'})
   print('Execution DOM',page_id,n)
  except Exception as e:REPORT['failures'].append({'page':page_id,'type':'execution','message':str(e)});print('FAIL',page_id,str(e)[:200])
  finally:pg.close()
 for i,name in enumerate(['KPI总览','深度分析','智能预警','行动闭环','指标治理'],1):
  pg=b.new_page()
  try:
   html=(ROOT/f'static/decision-center/0{i}_{name}.html').read_text()
   html=re.sub(r'<script\s+src="[^"]+"\s*></script>','',html)
   # Make inline static bridge's network fetch deterministic (unavailable in offline browser).
   html=html.replace('</head>',"<script>window.fetch=async()=>{throw Error('OFFLINE_INJECTION_NO_BACKEND')};</script></head>")
   pg.set_content(html,wait_until='load')
   pg.add_script_tag(content=DEC)
   pg.wait_for_timeout(200)
   audits=pg.locator('.dc48-audit')
   count=audits.count()
   assert count>0,('no audits',i)
   first=audits.first
   first.locator('[data-audit="formula"]').click()
   assert pg.locator('#shade').evaluate("el=>getComputedStyle(el).display")=='flex'
   assert '未能取得模块公式' in pg.locator('#drawer').inner_text(timeout=2000) or '加载中' in pg.locator('#drawer').inner_text()
   assert first.locator('[data-audit="excel"]').get_attribute('href').startswith('/api/decision-center/workbook.xlsx?')
   REPORT['decision'].append({'page':f'0{i}','entry_groups':count,'formula_click_behavior':'graceful_API_unavailable_error','status':'OFFLINE_DOM_INTERACTION_ONLY'})
   print('Decision DOM',i,count)
  except Exception as e:REPORT['failures'].append({'page':f'0{i}','type':'decision','message':str(e)});print('DEC FAIL',i,str(e)[:200])
  finally:pg.close()
 b.close()
(ROOT/'docs/V2948_离线浏览器交互测试.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n')
print('DONE',len(REPORT['execution']),'execution',len(REPORT['decision']),'decision','failures',len(REPORT['failures']))
if REPORT['failures']:raise SystemExit(1)
