from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path('/mnt/data/pharma_v2928_work')
html='''<!doctype html><html><head><style>body{font-family:Arial}.card{padding:12px;border:1px solid #ddd;margin:10px}.panel{padding:12px;border:1px solid #ddd;margin:10px}.page{width:100%}</style></head><body><div id="content"><section class="panel"><header><h3>OTD × PPV 绩效矩阵</h3></header><p>OTD 低于90%需要检查，但该结论必须依据源PO记录。</p><table><thead><tr><th>供应商</th><th>数量</th><th>单价</th></tr></thead><tbody><tr><td>Aster</td><td>100</td><td>10</td></tr><tr><td>Cedar</td><td>80</td><td>9</td></tr></tbody></table><svg viewBox="0 0 360 200"><text x="30" y="20">OTD 95%</text></svg></section><article class="card"><header><h3>降本监控与复盘</h3></header><strong>23%</strong><p>项目降本达成率是按计划节省和实际节省复盘。</p><table><thead><tr><th>项目</th><th>计划</th><th>实际</th></tr></thead><tbody><tr><td>API-001</td><td>1000</td><td>230</td></tr></tbody></table></article></div></body></html>'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1200,'height':850})
 errs=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html)
 page.add_script_tag(content="window.PharmaMetricAudit={identify:(s)=>/OTD/.test(s)?'SRC.PO.OTD':/PPV/.test(s)?'SRC.PO.PPV':/降本/.test(s)?'SRC.SAVINGS.ATTAINMENT':'UNREGISTERED',analysisIdentify:(s)=>/降本/.test(s)?'ACT.SAVINGS.ATTAINMENT':'UNREGISTERED_ANALYSIS',selection:()=>({material:'all',supplier:'all',year:'all'})};")
 page.add_style_tag(content=(root/'static/module_traceability_v2928.css').read_text())
 page.add_script_tag(content=(root/'static/module_traceability_v2928.js').read_text())
 page.wait_for_timeout(350)
 print('modules',page.locator('.pharma-module-ready').count())
 print('buttons',page.locator('[data-module-action]').count())
 print('metrics',page.evaluate('window.PharmaModuleTrace.capture(document.querySelector("section")).metrics'))
 print('captured',page.evaluate('window.PharmaModuleTrace.capture(document.querySelector("section")).tables[0]'))
 assert page.locator('.pharma-module-ready').count()==2
 assert page.locator('.pharma-module-top').count()==2
 assert page.locator('.pharma-module-bottom').count()==2
 assert 'SRC.PO.PPV' in page.evaluate('window.PharmaModuleTrace.capture(document.querySelector("section")).metrics')
 assert 'SRC.PO.OTD' in page.evaluate('window.PharmaModuleTrace.capture(document.querySelector("section")).metrics')
 page.screenshot(path='/mnt/data/V2928_模块公式与来源入口_隔离预览.png',full_page=True)
 print('ERRORS',errs)
 assert not errs
 browser.close()
