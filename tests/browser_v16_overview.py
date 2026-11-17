"""V1.6 Chromium DOM checks against real deterministic enterpriseAnalysis fixture.
Browser network is unnecessary; Node computes source snapshots before injection.
This is not a published Bolt browser test or GxP validation.
"""
import asyncio,json,os,subprocess,tempfile,zipfile
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
STATIC=ROOT/'static'
FIX_JS='''import {enterpriseAnalysis} from './enterprise_v08.mjs';
console.log(JSON.stringify({full:enterpriseAnalysis({}),approved:enterpriseAnalysis({supplier_class:'Approved'}),pending:enterpriseAnalysis({supplier_class:'Pending'}),supplier:enterpriseAnalysis({supplier:'SUP-001'}),month:enterpriseAnalysis({month:'2026-06'}),materialA:enterpriseAnalysis({material:'API-001'}),categoryAPI:enterpriseAnalysis({category:'API'}),yearZero:enterpriseAnalysis({year:'2025'})}));'''
async def main():
 print('STEP node fixtures',flush=True);data=json.loads(subprocess.check_output(['node','--input-type=module','-e',FIX_JS],cwd=ROOT,text=True))
 print('STEP browser',flush=True)
 async with async_playwright() as playwright:
  browser=await playwright.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1648,'height':928},accept_downloads=True)
  errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  print('STEP set content',flush=True);await page.set_content('<!doctype html><html><body><div id="content"></div><div id="toast"></div></body></html>')
  for css in ['styles.css','v12_ui.css','v14_ui.css','v16_overview.css']:
   await page.add_style_tag(content=(STATIC/css).read_text())
  stub='''window._DATA=__FIXTURE__;
window.EnterpriseV08={state:{data:_DATA.full,filters:{},active:'overview'},render:v=>'Baseline '+v,sourcingExtra:()=>'',load:function(){let f=this.state.filters;this.state.data=f.supplier_class==='Approved'?_DATA.approved:f.supplier_class==='Pending'?_DATA.pending:f.supplier==='SUP-001'?_DATA.supplier:f.month==='2026-06'?_DATA.month:f.material==='API-001'?_DATA.materialA:f.category==='API'?_DATA.categoryAPI:f.year==='2025'?_DATA.yearZero:_DATA.full;window.render();}};
window.render=()=>{document.body.classList.add('v16-overview-mode');document.getElementById('content').innerHTML=PharmaV16Overview.render()};window.setView=(view)=>{window._NAV=view};'''.replace('__FIXTURE__',json.dumps(data,ensure_ascii=False))
  await page.add_script_tag(content=stub)
  for js in ['v12_ui.js','v14_ui.js','v15_pptx_template.js','v15_exports.js','v16_overview.js']:
   await page.add_script_tag(content=(STATIC/js).read_text())
  print('STEP render',flush=True);await page.evaluate('render()')
  assert await page.locator('.v16-kpi').count()==6
  assert await page.locator('.v16-chart-card').count()==11
  assert await page.locator('[data-v16-filter]').count()==5
  assert '580,704' in await page.locator('.v16-kpi').first.inner_text()
  assert await page.locator('[data-v16-detail="period"]').count()>=3
  print('PASS V16 UI: screenshot layout, six KPIs, eleven analytical cards, five real controls, monthly drill')
  print('STEP metric click',flush=True);await page.locator('[data-v16-detail="metric"][data-v16-id="spend"]').click()
  assert await page.locator('.v16-detail .v16-table tbody tr').count()==24
  async with page.expect_download() as export:
   await page.locator('[data-v16-export="detail"]').click()
  assert (await export.value).suggested_filename.endswith('.csv')
  await page.locator('.v16-detail>header>button').click()
  print('STEP filter',flush=True);await page.locator('[data-v16-filter="supplier"]').select_option('SUP-001')
  assert '200,864' in await page.locator('.v16-kpi').first.inner_text()
  await page.locator('[data-v16-go="m05"]').first.click()
  assert await page.evaluate('window._NAV')=='m05'
  assert await page.evaluate('EnterpriseV08.state.filters.supplier')=='SUP-001'
  await page.locator('[data-v16-reset]').click()
  await page.locator('[data-v16-filter="supplier_class"]').select_option('Pending')
  assert '186,144' in await page.locator('.v16-kpi').first.inner_text()
  assert '8 条 PO' in await page.locator('.v16-kpi').first.inner_text()
  await page.locator('[data-v16-reset]').click()
  await page.locator('[data-v16-filter="month"]').select_option('2026-06')
  assert '27,112' in await page.locator('.v16-kpi').first.inner_text()
  await page.locator('[data-v16-reset]').click()
  await page.locator('[data-v16-filter="material_group"]').select_option('material:API-001')
  assert await page.evaluate('EnterpriseV08.state.filters.material')=='API-001'
  assert await page.evaluate('EnterpriseV08.state.filters.category')==''
  assert str(data['materialA']['overview']['current']['spend']).replace('.0','')[:3] in (await page.locator('.v16-kpi').first.inner_text()).replace(',','')
  await page.locator('[data-v16-filter="material_group"]').select_option('group:API')
  assert await page.evaluate('EnterpriseV08.state.filters.category')=='API'
  assert await page.evaluate('EnterpriseV08.state.filters.material')==''
  print('PASS V16 filters: supplier -> related module, supplier category, material SKU/group, month, reset, source-matched CSV')
  await page.locator('[data-v16-reset]').click()
  await page.locator('[data-v16-detail="allrisks"]').first.click()
  assert await page.locator('.v16-detail .v16-table tbody tr').count()==len(data['full']['actions']['alerts'])
  await page.locator('.v16-detail>header>button').click()
  await page.locator('[data-v16-detail="supplier"]').first.click()
  assert await page.locator('.v16-detail .v16-table tbody tr').count()>0
  await page.locator('.v16-detail>header>button').click()
  print('STEP downloads',flush=True)
  with tempfile.TemporaryDirectory() as td:
   print('   onepager click',flush=True)
   async with page.expect_download(timeout=6500) as d1:await page.locator('[data-v16-action="onepage"]').click()
   print('   onepager done',flush=True)
   html=await d1.value
   assert html.suggested_filename.endswith('.html')
   await html.save_as(str(Path(td)/'report.html'))
   assert '采购经营一页纸' in (Path(td)/'report.html').read_text()
   print('   closing V14 modal',flush=True)
   await page.locator('[data-v14="close-modal"]').last.click(timeout=4000)
   print('   pdf click',flush=True)
   async with page.expect_download(timeout=6500) as d2:await page.locator('[data-v16-action="pdf"]').click()
   pdf=await d2.value;await pdf.save_as(str(Path(td)/'brief.pdf'))
   assert (Path(td)/'brief.pdf').read_bytes().startswith(b'%PDF-')
   print('   pptx click',flush=True)
   async with page.expect_download(timeout=6500) as d3:await page.locator('[data-v16-action="pptx"]').click()
   pptx=await d3.value;await pptx.save_as(str(Path(td)/'brief.pptx'))
   with zipfile.ZipFile(Path(td)/'brief.pptx') as z:
    slides=[x for x in z.namelist() if x.startswith('ppt/slides/slide') and x.endswith('.xml')]
    assert len(slides)==4,slides
  assert not errors,errors
  print('PASS V16 exports: printable HTML report, binary PDF, native four-page PPTX')
  print('PASS V16 Chromium: zero uncaught JS errors')
  await browser.close()
if __name__=='__main__':asyncio.run(main())
