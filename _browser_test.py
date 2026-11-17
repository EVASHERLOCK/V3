from playwright.sync_api import sync_playwright
import json,time
url='http://127.0.0.1:33211/'
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
  page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  try:
    print('goto',page.goto(url,wait_until='domcontentloaded',timeout=25000).status)
    for view in ['ss-overview','ss-market','ss-kraljic','ss-ai','overview','m02']:
      page.goto(url+'#'+view,wait_until='domcontentloaded',timeout=25000)
      page.wait_for_timeout(1600)
      print(view,'content_size',len(page.locator('#content').inner_text()),'banner',page.locator('.top10-site-rule').count(),'details',page.locator('details.top10-overflow').count(),'errors',len(errors))
      page.screenshot(path=f'/mnt/data/pharma_v2912_{view}.png',full_page=False)
    print('page errors',errors[-10:])
  except Exception as e: print('BROWSER EXCEPTION',e)
  browser.close()
