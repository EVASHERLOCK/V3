from playwright.sync_api import sync_playwright
from pathlib import Path
html=Path('/mnt/data/pharma_v2928_work/dist/index.html').read_text()
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=b.new_page(viewport={'width':1400,'height':900})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded',timeout=45000)
  page.wait_for_timeout(950)
  print('INIT:',page.evaluate("[document.querySelector('#content')?.children.length,document.querySelector('#content')?.innerText.slice(0,80),window.PharmaModuleTrace?.version]"),'ERRORS:',errors[:3])
  for route in ['overview','m01','m02','m03','m10','ss-overview','ss-market','ss-kraljic','ss-ai','ss-cost','ss-project','ss-performance','ss-compliance','ss-technical']:
    page.evaluate('(r)=>{location.hash="#"+r}',route)
    page.wait_for_timeout(280)
    try:
      q=page.evaluate("({count:document.querySelectorAll('#content .pharma-module-ready').length,tools:document.querySelectorAll('#content .pharma-module-tools').length,txt:document.querySelector('#content')?.innerText.slice(0,40)})")
      print(route,q)
    except Exception as e:print('route error',route,str(e)[:150])
  print('errors:',len(errors),errors[:8])
  b.close()
