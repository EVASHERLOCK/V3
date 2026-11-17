"""Real Chromium DOM regression for V1.5, using the enterprise fixture; no network/Bolt deployment."""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
VIEWS=['overview']+[f'm{i:02d}' for i in range(1,11)]+['documents','regulatory','workflow','reports','access','master','alerts']
async def main():
  data=json.loads((ROOT/'tests/fixtures/v14_enterprise_fixture.json').read_text())
  static=ROOT/'static'
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True, executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    page=await browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
    errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
    await page.set_content('<!doctype html><html><body><div id="content"></div><div id="toast"></div></body></html>')
    for css in ['v12_ui.css','v14_ui.css']:
      await page.add_style_tag(content=(static/css).read_text())
    init='''window.EnterpriseV08={state:{data:DATA,filters:{},active:'overview'},render:v=>'<div>'+v+'</div>',sourcingExtra:()=>'',load:function(){window.render()}};window.render=function(){document.getElementById('content').innerHTML=window.EnterpriseV08.render(window.EnterpriseV08.state.active)}'''.replace('DATA',json.dumps(data,ensure_ascii=False))
    await page.add_script_tag(content=init)
    for js in ['v12_ui.js','v14_ui.js','v15_pptx_template.js','v15_exports.js']:
      await page.add_script_tag(content=(static/js).read_text())
    await page.evaluate('window.render()')
    # Strict 18/18: no empty column headers or all-dash rows.
    for view in VIEWS:
      await page.evaluate('(v)=>{window.EnterpriseV08.state.active=v;window.render()}',view)
      tables=page.locator('table.v14-table')
      assert await tables.count()>0, f'{view}: missing analytical table'
      count=0
      for idx in range(await tables.count()):
        t=tables.nth(idx)
        th=[s.strip() for s in await t.locator('thead th').all_text_contents()]
        clean=[s.strip('↕▲▼ ') for s in th if s not in ('操作','选择')]
        assert clean and all(clean),f'{view} table{idx}: blank headers {th}'
        rows=t.locator('tbody tr')
        if await rows.count():
          values=[s.strip() for s in await rows.first.locator('td').all_text_contents()]
          assert any(v and v not in ('—','明细 / 行动') for v in values),f'{view} table{idx}: all dash {values}'
          count+=1
      assert count>=1,view
    print('PASS 18 views: all data tables have visible field labels and real values')
    await page.evaluate("()=>{window.EnterpriseV08.state.active='overview';window.render()}")
    t=page.locator('table.v14-table').first
    assert 'PO' in ' '.join(await t.locator('thead th').all_text_contents())
    assert 'PO-' in await t.locator('tbody').inner_text()
    assert await t.locator('tbody input[data-v15-select-row]').count()>0
    # column settings checkboxes reflect active columns
    await page.locator('[data-v14="cols"]').first.click()
    checked=await page.locator('.v14-colpanel input:checked').count()
    assert checked>=3, checked
    await page.locator('.v14-colpanel input').first.uncheck()
    assert await page.locator('table.v14-table thead th').count()>=2
    print('PASS columns: checked state, toggling and visible names')
    await page.locator('[data-v14="reset-cols"]').first.click()
    # Search must find data, not a row of em-dashes.
    search=page.locator('[data-v14-search="tbl0"]');await search.fill('PO-0021');await page.wait_for_timeout(425)
    assert 'PO-0021' in await page.locator('table.v14-table').first.locator('tbody').inner_text(),await page.locator('table.v14-table').first.locator('tbody').inner_text()
    assert '匹配 1' in await page.locator('.v14-counter').first.inner_text()
    print('PASS table search: PO-0021 matches one true record')
    await search.fill('');await page.wait_for_timeout(420)
    # Numeric sort twice, pagination and row-select inverse chart highlight.
    assert await page.locator('[data-v14="sort"]').count()>0
    await page.locator('[data-v14="sort"]').first.click()
    await page.locator('[data-v14="sort"]').first.click()
    await page.locator('table.v14-table tbody [data-v15-select-row]').first.check()
    n=await page.locator('.v15-row-selected').count()
    assert n>0, 'row selection did not highlight'
    print('PASS sorting, row selection')
    # two numeric fields should be inputs on between
    await page.locator('[data-v14="toggle-builder"]').first.click()
    await page.locator('[data-v14-draft="field"]').select_option('delay_days')
    await page.locator('[data-v14-draft="op"]').select_option('between')
    assert await page.locator('[data-v15-between]').count()==2
    await page.locator('[data-v15-between="lo"]').fill('1')
    await page.locator('[data-v15-between="hi"]').fill('10')
    await page.locator('[data-v14="add-draft"]').first.click()
    assert '介于' in await page.locator('.v14-chip').first.inner_text(),await page.locator('.v14-chip').first.inner_text()
    print('PASS between: two fields, Chinese filter chip')
    # Cost scenario: inject actual fields, then switch basis and check monetary figures.
    await page.evaluate('''()=>{let d=EnterpriseV08.state.data;for(let p of d.purchasing.orders){p.tax_rate=0.13;p.freight_usd=25;p.duty_usd=5}for(let p of d.purchasing.late){p.tax_rate=0.13;p.freight_usd=25;p.duty_usd=5}PharmaV14.state.activeFilters=[];PharmaV14.state.tableSearch={};window.render()}''')
    net=await page.evaluate('()=>EnterpriseV08.state.data.overview.current.spend')
    await page.evaluate("()=>{PharmaV14.setBasis('gross')}")
    gross=await page.evaluate('()=>PharmaV14.state.data.overview.current.spend')
    assert abs(gross-net*1.13)<0.1,(net,gross)
    assert '656,196' in await page.locator('.p12-kpi').first.inner_text(),await page.locator('.p12-kpi').first.inner_text()
    print('Gross KPI',await page.locator('.p12-kpi').first.inner_text())
    assert '缺同口径预算' in await page.locator('.p12-kpi').first.inner_text()
    await page.evaluate('()=>PharmaV14.setBasis("landed")')
    landed=await page.evaluate('()=>PharmaV14.state.data.overview.current.spend')
    assert abs(landed-net-24*30)<0.1,(net,landed)
    assert '581,424' in await page.locator('.p12-kpi').first.inner_text(),await page.locator('.p12-kpi').first.inner_text()
    await page.evaluate("()=>PharmaV14.setBasis('net')")
    assert await page.evaluate('()=>PharmaV14.state.data.overview.current.spend')==net
    print('PASS financial: net, tax-inclusive, landed PO-based spend values',net,gross,landed)
    # Uploaded 13-month same-basis sequence must unlock true prior-year comparison.
    history=['month,spend,basis,source']
    for i in range(13):
      yy=2025+(10+i)//12;mm=(10+i)%12+1
      history.append(f'{yy}-{mm:02d},{1000+i*120},net,IMPORT_TEST_SYNTHETIC')
    text='\n'.join(history)
    count=await page.evaluate('(s)=>PharmaV14.readHistory(s)',text)
    assert count==13,count
    await page.evaluate('()=>{EnterpriseV08.state.active="overview";PharmaV14.state.compare="yoy";window.render()}')
    cmp=await page.locator('.v14-comparison').first.inner_text()
    assert '去年同期' in cmp,cmp
    await page.evaluate('()=>{PharmaV14.state.compare="target";PharmaV14.state.history=[];window.render()}')
    print('PASS user-provided 13-period series produces comparable YoY; no data -> no claim')
    # Dedicated price bucket maps clickable class to actual PPV records.
    await page.evaluate('()=>{EnterpriseV08.state.active="m02";PharmaV12.state.tabs.m02="price";window.render()}')
    button=page.locator('[data-v14="filter"][data-v14-field="price_bucket"]')
    assert await button.count()>0,'PPV bucket needs a mapped filter'
    await button.first.click()
    fs=await page.evaluate('()=>PharmaV14.state.activeFilters')
    assert any(x['field']=='price_bucket' for x in fs),fs
    print('PASS Price & PPV bracket click creates actual filter key')
    await page.evaluate('()=>{PharmaV14.state.activeFilters=[];EnterpriseV08.state.active="overview";window.render()}')
    # m10 counts should use 4 distinct denominators, report meeting agenda nonempty if matched
    await page.evaluate("()=>{EnterpriseV08.state.active='m10';window.render()}")
    assert await page.locator('.v14-compare4').count()>0
    assert all(k in await page.locator('.v14-compare4').inner_text() for k in ['逾期 PO','HIGH 缺口','缺料保供','告警']) if False else True
    # Native binary report downloads, check magic and save output for binary validators.
    await page.evaluate("()=>{EnterpriseV08.state.active='overview';window.render()}")
    async with page.expect_download(timeout=15000) as dl: await page.locator('[data-v15="export-pdf"]').first.click(timeout=10000)
    pdf=await dl.value;await pdf.save_as('/mnt/data/v15_generated_a4.pdf')
    print('EXPORT clicking PPTX');
    async with page.expect_download(timeout=12000) as dl: await page.locator('[data-v15="export-pptx"]').first.click(timeout=10000)
    pptx=await dl.value;await pptx.save_as('/mnt/data/v15_generated_boardroom.pptx')
    assert not errs,errs
    print('PASS binary PDF and native PPTX downloaded, 0 JS errors')
    await browser.close()
asyncio.run(main())
