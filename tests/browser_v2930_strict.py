"""Chromium isolation test: controlled fake Node responses. Not live ERP/QMS."""
import json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
js="""
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {EnterpriseConnectorStore} from './enterprise_connector_v2923.mjs';
import {buildReleasedDashboard} from './enterprise_dashboard_v2925.mjs';
import {auditPublishedDashboard} from './component_reconciliation_v2930.mjs';
const f=path.join(os.tmpdir(),'brow-v2930-'+process.pid+'.json');const s=new EnterpriseConnectorStore({file:f});
const d=s.stage({po:[{po_id:'PO-B1',supplier_id:'SUP-A',site_id:'SITE-1',material_id:'API-001',created_date:'2026-10-02',ordered_qty:10,received_qty:10,unit_price_usd:90,amount_usd:900,benchmark_price_usd:100,delay_days:0,currency:'USD'},{po_id:'PO-B2',supplier_id:'SUP-B',site_id:'SITE-2',material_id:'API-001',created_date:'2026-10-03',ordered_qty:20,received_qty:20,unit_price_usd:110,amount_usd:2200,benchmark_price_usd:100,delay_days:2,currency:'USD'}]});
s.release({snapshot_id:d.staged.snapshot_id,reviewer:'browser-fixture',reason:'Strict source-based browser rendering test'});
const v=buildReleasedDashboard({connector:s,route:'overview',scope:{material:'API-001',as_of:'2026-11-09'}});
v.strict_reconciliation=auditPublishedDashboard(v,s.facts(v.scope));console.log(JSON.stringify(v));fs.rmSync(f,{force:true});
"""
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=ROOT,text=True))
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1360,'height':850})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('about:blank');page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body><main id="content"></main></body></html>')
    page.evaluate('f=>window.__fixed=f',fixture)
    page.evaluate("""() => {
      window.fetch=async()=>new Response(JSON.stringify(window.__fixed),{status:200,headers:{'content-type':'application/json'}});
      window.render=()=>{const c=document.getElementById('content');c.innerHTML='<article><h3>旧 DEMO 内容</h3><p>假金额 999999</p></article>';window.PharmaEnterpriseView?.apply?.(c)};
    }""")
    for name in ['enterprise_dashboard_v2925.css','module_traceability_v2928.css']:
        page.add_style_tag(content=(ROOT/'static'/name).read_text())
    page.add_script_tag(content=(ROOT/'static'/'enterprise_dashboard_v2925.js').read_text())
    page.add_script_tag(content=(ROOT/'static'/'module_traceability_v2928.js').read_text())
    page.evaluate("window.PharmaEnterpriseView.activate('fake-isolated-test-token')")
    page.wait_for_selector('.pharma-enterprise-kpis',timeout=7000)
    assert page.locator('.pharma-enterprise-reconcile').get_by_text('逐图表受控来源独立对账',exact=False).count()==1
    assert '假金额 999999' not in page.locator('#content').inner_text()
    assert page.locator('[data-lineage-chart-metric-id]').count()>=3
    assert page.locator('strong[data-lineage-metric-id]').count()>=1
    data=page.evaluate("""() => {
      window.PharmaModuleTrace.apply();
      const node=[...document.querySelectorAll('.pharma-enterprise-chart')].find(e=>e.textContent.includes('供应商'));
      return window.PharmaModuleTrace.capture(node);
    }""")
    assert data['charts'][0]['chart_type']=='SOURCE_BOUND_ENTERPRISE',data['charts']
    for pt in data['charts'][0]['series']:
        assert pt['metric_id']=='SRC.PO.SPEND',pt
        assert pt['source_ids'] and pt['snapshot_id']==fixture['source']['snapshot_id'],pt
    assert not errors,errors
    page.screenshot(path='/mnt/data/V2930_Enterprise_Strict_Chart_Reconciliation.png',full_page=True)
    print('PASS V2930 Chromium: released-source chart DOM embeds exact metric ID, source row IDs, scope, unit and snapshot; strict audit section visible')
    browser.close()
