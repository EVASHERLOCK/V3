"""Optional real-browser smoke test; requires Python playwright and Chromium.
Uses about:blank with local JS/CSS injected so no local-network browser permission is needed.
Does not claim GxP validation or production hosting success.
"""
from pathlib import Path
import json, subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
raw=json.loads(subprocess.check_output(['node','--input-type=module','-e',
  "import {enterpriseAnalysis} from './enterprise_v08.mjs'; console.log(JSON.stringify(enterpriseAnalysis({})))"], cwd=str(ROOT),text=True))
base='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><div id="mount"></div></body></html>'
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for route,name in [('ss-cost','cost'),('ss-project','project'),('ss-performance','performance')]:
    pg=browser.new_page(viewport={'width':1440,'height':900})
    errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('about:blank');pg.set_content(base)
    pg.add_style_tag(content='body{margin:0;background:#eef5fe;font-family:Arial,"Microsoft YaHei",sans-serif;}*{box-sizing:border-box;}')
    pg.add_style_tag(content=(ROOT/'static'/f'strategic_sourcing_{name}.css').read_text())
    pg.add_script_tag(content=(ROOT/'static'/'strategic_sourcing_universe.js').read_text())
    pg.add_script_tag(content=(ROOT/'static'/f'strategic_sourcing_{name}.js').read_text())
    pg.evaluate('r=>window.__raw=r',raw)
    pg.evaluate('x=>{location.hash="#"+x.route;window[x.api].hydrate(window.__raw);window.render=()=>{document.getElementById("mount").innerHTML=window[x.api].render()};window.render()}',
      {'route':route,'api':{'cost':'PharmaCostBaseline','project':'PharmaSourcingProject','performance':'PharmaSupplierPerformance'}[name]})
    if name=='cost':
      assert pg.get_by_text('BOM 成本拆解瀑布图').count()>=1
      assert pg.locator('.cb-wf-grid .rowh').count()==2
      assert pg.locator('.cb-more summary').count()>=1
      pg.locator('.cb-page [data-cb-open^="supplier:"]').first.click()
      assert pg.locator('#cb-detail').count()==1
      pg.locator('#cb-detail [data-cb-action="close-detail"]').click()
      assert pg.locator('#cb-detail').count()==0
      pg.select_option('.cb-page [data-cb-filter="supplier"]','SUP-001')
      assert pg.locator('.cb-page .cb-bar-row').count()<=1
      pg.select_option('.cb-page [data-cb-filter="supplier"]','all')
    elif name=='project':
      assert pg.locator('svg.sp-svg').count()==1
      assert pg.locator('svg.sp-svg rect').count()>=16
      assert pg.locator('.sp-capacity-track').count()>=10
      pg.locator('.sp-page [data-sp-open^="supplier:"]').first.click()
      assert pg.locator('#sp-detail').count()==1
      pg.locator('#sp-detail [data-sp-action="close-detail"]').click()
      pg.select_option('.sp-page [data-sp-project]','API-002')
      assert pg.locator('.sp-page').inner_text().find('API-002')>=0
    else:
      before=pg.locator('.spf-score-card strong').all_text_contents()
      assert len(before)==4
      pg.locator('.spf-score-card').first.click()
      assert pg.locator('#spf-detail .spf-detail-bars').count()==1
      assert pg.locator('#spf-detail .spf-more').count()==1
      pg.locator('#spf-detail [data-spf-action="close-detail"]').click()
      pg.get_by_role('button',name='量产交付绩效').click()
      after=pg.locator('.spf-score-card strong').all_text_contents()
      assert before!=after
      assert pg.locator('.spf-chart-row.two>.card').count()==8
      pg.locator('.spf-matrix-links [data-spf-detail^="risk:"]').first.click()
      assert pg.locator('#spf-detail .spf-detail-bars').count()==1
      pg.locator('#spf-detail [data-spf-action="close-detail"]').click()
      pg.select_option('.spf-page [data-spf-filter="region"]','Europe')
      assert pg.locator('.spf-page').count()==1
    assert not errs,(name,errs)
    print('PASS browser',name,'interaction, source visibility, Top10 fold, no JS errors')
    pg.close()
  browser.close()
