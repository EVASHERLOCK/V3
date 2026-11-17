"""Optional Chromium smoke test. Browser page is in-memory to avoid network dependence.
Requires pip install playwright and a local Chromium. Not a live Bolt deployment test.
Run: python tests/browser_v14_mock.py
"""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
async def main():
 data=json.loads((ROOT/'tests/fixtures/v14_enterprise_fixture.json').read_text())
 static=ROOT/'static'
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  await page.set_content('<!doctype html><html><body><div id="content"></div><div id="toast"></div></body></html>')
  for css in ['v12_ui.css','v14_ui.css']:await page.add_style_tag(content=(static/css).read_text())
  init='''window.EnterpriseV08={state:{data:DATA,filters:{},active:'overview'},render:v=>'<div>'+v+'</div>',sourcingExtra:()=>'',load:function(){window.render()}};window.render=function(){document.getElementById('content').innerHTML=window.EnterpriseV08.render(window.EnterpriseV08.state.active)}'''.replace('DATA',json.dumps(data,ensure_ascii=False))
  await page.add_script_tag(content=init)
  for js in ['v12_ui.js','v14_ui.js']:await page.add_script_tag(content=(static/js).read_text())
  await page.evaluate('window.render()')
  assert await page.locator('.p12-kpi').count()==6
  buttons=page.locator('[data-p12^="drill:po:"]')
  if await buttons.count()>1:
   await buttons.nth(1).click()
   drawer=await page.locator('.p12-drawer').first.inner_text()
   assert 'PO-0008' in drawer,drawer[:300]
   await page.locator('[data-p12="close-drawer"]').last.click()
  await page.locator('[data-v14="toggle-builder"]').first.click()
  await page.locator('[data-v14-draft="value"]').fill('SUP-001')
  await page.locator('[data-v14="add-draft"]').first.click()
  assert await page.locator('.v14-chip').count()>=1
  assert any(z['value']=='SUP-001' for z in await page.evaluate('window.PharmaV14.state.activeFilters'))
  async with page.expect_download() as info:await page.locator('[data-v14="onepager"]').first.click()
  dl=await info.value
  assert dl.suggested_filename.endswith('.html')
  await page.locator('[data-v14="close-modal"]').last.click()
  for view in ['overview','m01','m02','m03','m04','m05','m06','m07','m08','m09','m10','documents','regulatory','workflow','reports','access','master','alerts']:
   await page.evaluate('(v)=>{window.EnterpriseV08.state.active=v;window.render()}',view)
   assert await page.locator('.p12-kpi').count()==6,view
  assert not errors,errors
  print('PASS V1.4 Chromium mocked-data smoke: 18 views, KPI cards, PO identity, filter chip, downloadable printable report, 0 script errors')
  await browser.close()
asyncio.run(main())
