import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
R=Path(__file__).resolve().parent.parent
views=['overview']+[f'm{i:02d}' for i in range(1,11)]+['documents','regulatory','workflow','reports','access','master','alerts']
async def main():
 d=json.load(open(R/'tests/fixtures/v14_enterprise_fixture.json'))
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=await b.new_page()
  await page.set_content('<div id="content"></div><div id="toast"></div>')
  await page.add_script_tag(content='''window.EnterpriseV08={state:{data:DATA,filters:{},active:'overview'},render:v=>'<div>'+v+'</div>',sourcingExtra:()=>'',load:function(){window.render()}};window.render=function(){document.getElementById('content').innerHTML=window.EnterpriseV08.render(window.EnterpriseV08.state.active)}'''.replace('DATA',json.dumps(d,ensure_ascii=False)))
  for js in ['v12_ui.js','v14_ui.js']:
   await page.add_script_tag(content=(R/'static'/js).read_text())
  for v in views:
   await page.evaluate('(v)=>{EnterpriseV08.state.active=v;window.render()}',v)
   vals=await page.locator('[data-v14="explain-filter"]').evaluate_all('(els)=>els.map(x=>x.dataset.v14Label)')
   if vals:print(v,len(vals),vals[:25])
  await b.close()
asyncio.run(main())
