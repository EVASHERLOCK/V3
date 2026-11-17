from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    for route in ['#ss-cost','#ss-project','#ss-performance','#ss-compliance','#ss-technical','#overview']:
        page.goto('file:///mnt/data/pharma_v2928_work/dist/index.html'+route,wait_until='domcontentloaded')
        page.wait_for_timeout(1800)
        count=page.locator('#content .pharma-module-tools').count()
        placeholders=page.locator('#content .pharma-component-trace:visible').count()
        print(route,'modules',count,'legacy placeholders',placeholders,'errors',errors[-3:])
        if route=='#ss-cost' and count:
            node=page.locator('#content .pharma-module-ready').first
            print('FIRST',node.locator('.pharma-module-tools button').all_text_contents())
            node.locator('button[data-module-action=toggle]').first.click()
            page.wait_for_timeout(950)
            print('TRACE',node.locator('.pharma-module-inline').inner_text()[:540])
            # find populated workbook with BOM/PO source + row table
            try:
                with page.expect_download(timeout=12000) as info:
                    node.locator('[data-module-action=excel]').click()
                dl=info.value
                dl.save_as('/mnt/data/V2928_模块公式源表_浏览器实测.xlsx')
                print('DOWNLOAD',dl.suggested_filename)
            except Exception as e:print('DOWNLOAD ERROR',str(e)[:300])
            page.screenshot(path='/mnt/data/V2928_模块血缘_浏览器验收.png',full_page=False)
    browser.close()
