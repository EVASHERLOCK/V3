"""Offline Chromium checks of the exact V1.7 overview with Node's canonical enterpriseAnalysis fixtures.
Not a Bolt cloud production/ERP/GxP acceptance test."""
import asyncio,json,os,subprocess,tempfile,zipfile
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
STATIC=ROOT/'static'
DATA_SCRIPT='''import {enterpriseAnalysis} from './enterprise_v08.mjs';console.log(JSON.stringify({full:enterpriseAnalysis({}),approved:enterpriseAnalysis({supplier_class:'Approved'}),pending:enterpriseAnalysis({supplier_class:'Pending'}),supplier:enterpriseAnalysis({supplier:'SUP-001'}),month:enterpriseAnalysis({month:'2026-06'}),materialA:enterpriseAnalysis({material:'API-001'}),categoryAPI:enterpriseAnalysis({category:'API'}),yearZero:enterpriseAnalysis({year:'2025'})}));'''
async def main():
 fixtures=json.loads(subprocess.check_output(['node','--input-type=module','-e',DATA_SCRIPT],cwd=ROOT,text=True))
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1680,'height':1060},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content('<!doctype html><html lang="zh-CN"><body><div id="content"></div><div id="toast"></div></body></html>')
  for css in ['styles.css','v12_ui.css','v14_ui.css','v16_overview.css']:
   await page.add_style_tag(content=(STATIC/css).read_text())
  stub='''window._DATA=__FIXTURE__;window.EnterpriseV08={state:{data:_DATA.full,filters:{},active:'overview'},render:v=>'Baseline '+v,sourcingExtra:()=>'',load:function(){const f=this.state.filters;this.state.data=f.supplier_class==='Approved'?_DATA.approved:f.supplier_class==='Pending'?_DATA.pending:f.supplier==='SUP-001'?_DATA.supplier:f.month==='2026-06'?_DATA.month:f.material==='API-001'?_DATA.materialA:f.category==='API'?_DATA.categoryAPI:f.year==='2025'?_DATA.yearZero:_DATA.full;window.render()}};window.render=()=>{document.body.classList.add('v16-overview-mode');document.getElementById('content').innerHTML=PharmaV16Overview.render()};window.setView=view=>{window._NAV=view;window.render()};'''.replace('__FIXTURE__',json.dumps(fixtures,ensure_ascii=False))
  await page.add_script_tag(content=stub)
  for js in ['v12_ui.js','v14_ui.js','v15_pptx_template.js','v15_exports.js','v16_overview.js']:
   await page.add_script_tag(content=(STATIC/js).read_text())
  await page.evaluate('render()')
  assert await page.locator('h1').first.inner_text()=='采购总概览'
  assert await page.locator('[data-v16-filter]').count()==5
  assert await page.locator('.v17-kpi').count()==6
  assert await page.locator('.v17-panel').count()==12
  assert await page.locator('.v17-nav-items button').count()==7
  assert '580,704' in await page.locator('.v17-kpi-cost').inner_text()
  assert '51,512' in await page.locator('.v17-health').inner_text()
  assert '共 6 条 HIGH' in await page.locator('.v17-risk-card').inner_text()
  assert await page.locator('.v17-dashboard [data-v16-detail="period"]').count()>=3
  dims=await page.evaluate('({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})')
  print('BROWSER full layout dimensions',dims)
  await page.screenshot(path='/mnt/data/V17_Overview_Actual_Browser.png',full_page=True)
  await page.locator('.v17-kpi-cost [data-v16-id="spend"]').click()
  assert await page.locator('.v16-detail .v16-table tbody tr').count()==24
  async with page.expect_download() as dl:await page.locator('[data-v16-export="detail"]').click()
  assert (await dl.value).suggested_filename.endswith('.csv')
  await page.locator('.v16-detail>header>button').click()
  await page.locator('[data-v16-detail="spend-supplier"]').first.click()
  assert await page.locator('.v16-detail .v16-table tbody tr').count()==8
  await page.locator('.v16-detail>header>button').click()
  await page.locator('[data-v16-detail="score"]').first.click()
  assert await page.locator('.v16-detail .v16-table tbody tr').count()==4
  await page.locator('.v16-detail>header>button').click()
  await page.locator('[data-v16-filter="supplier"]').select_option('SUP-001')
  assert '200,864' in await page.locator('.v17-kpi-cost').inner_text()
  assert await page.evaluate('PharmaV16Overview.getCurrent().purchasing.orders.length')==8
  await page.locator('.v17-kpi-delivery [data-v16-id="otd"]').click()
  assert await page.locator('.v16-detail .v16-table tbody tr').count()==8
  await page.locator('.v16-detail [data-v16-go="m05"]').click()
  assert await page.evaluate('window._NAV')=='m05'
  assert await page.evaluate('EnterpriseV08.state.filters.supplier')=='SUP-001'
  await page.locator('[data-v16-reset]').click()
  await page.locator('[data-v16-filter="supplier_class"]').select_option('Pending')
  assert '186,144' in await page.locator('.v17-kpi-cost').inner_text()
  await page.locator('[data-v16-reset]').click()
  await page.locator('[data-v16-filter="month"]').select_option('2026-06')
  assert '27,112' in await page.locator('.v17-kpi-cost').inner_text()
  await page.locator('[data-v16-reset]').click()
  await page.locator('[data-v16-filter="material_group"]').select_option('material:API-001')
  assert await page.evaluate('EnterpriseV08.state.filters.material')=='API-001'
  await page.locator('[data-v16-reset]').click()
  await page.locator('[data-v16-detail="allrisks"]').first.click()
  assert await page.locator('.v16-detail .v16-table tbody tr').count()==len(fixtures['full']['actions']['alerts'])
  await page.locator('.v16-detail>header>button').click()
  with tempfile.TemporaryDirectory() as t:
   async with page.expect_download(timeout=9000) as a:await page.locator('[data-v16-action="onepage"]').click()
   await (await a.value).save_as(str(Path(t)/'report.html'))
   await page.locator('[data-v14="close-modal"]').last.click()
   async with page.expect_download(timeout=9000) as a:await page.locator('[data-v16-action="pdf"]').click()
   await (await a.value).save_as(str(Path(t)/'report.pdf'))
   assert (Path(t)/'report.pdf').read_bytes().startswith(b'%PDF-')
   async with page.expect_download(timeout=9000) as a:await page.locator('[data-v16-action="pptx"]').click()
   await (await a.value).save_as(str(Path(t)/'report.pptx'))
   with zipfile.ZipFile(Path(t)/'report.pptx') as z:assert len([n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')])==4
  assert not errors,errors
  print('PASS V1.7 Chromium: 5 filters, 6 linked KPIs, 12 panels, 7 navigation modules, real scoped drilldown + CSV/HTML/PDF/PPTX, no JS errors')
  await browser.close()
if __name__=='__main__':asyncio.run(main())
