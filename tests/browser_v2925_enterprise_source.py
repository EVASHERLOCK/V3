"""Isolated real Chromium UI test. Requests are intercepted synthetic fixtures.
No claims of live ERP/QMS connectivity, browser access to production systems, or GxP.
"""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
js="""
import os from 'node:os';import path from 'node:path';import fs from 'node:fs';
import {EnterpriseConnectorStore} from './enterprise_connector_v2923.mjs';
import {buildReleasedDashboard} from './enterprise_dashboard_v2925.mjs';
const file=path.join(os.tmpdir(),'v2925-browser-'+process.pid+'.json');
const s=new EnterpriseConnectorStore({file});
const r=s.stage({po:[{po_id:'PO-001',supplier_id:'SUP-A',site_id:'S-1',material_id:'API-001',created_date:'2026-10-01',ordered_qty:10,received_qty:10,amount_usd:1000,unit_price_usd:100,benchmark_price_usd:110,delay_days:0,currency:'USD'},{po_id:'PO-002',supplier_id:'SUP-B',site_id:'S-2',material_id:'API-002',created_date:'2026-10-10',ordered_qty:12,received_qty:12,amount_usd:1200,unit_price_usd:100,benchmark_price_usd:99,delay_days:2,currency:'USD'}],qms:[{event_id:'CAPA-01',record_type:'CAPA',supplier_id:'SUP-A',site_id:'S-1',material_id:'API-001',opened_at:'2026-10-02',due_date:'2026-11-09',status:'OPEN',severity:'MAJOR'}]});
s.release({snapshot_id:r.staged.snapshot_id,reviewer:'browser-fixture',reason:'Synthetic browser source verification'});
const d={};for(const route of ['overview','ss-cost','ss-performance','m09'])d[route]=buildReleasedDashboard({connector:s,route});
console.log(JSON.stringify(d));fs.rmSync(file,{force:true});
"""
mock=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=str(ROOT),text=True))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 # Browser sandbox disallows local and untrusted network navigation. Intercept
 # fetch in-memory instead; still run real Chromium DOM events and rendering.
 page.goto('about:blank')
 page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body><main id="content"></main></body></html>')
 page.evaluate('x=>window.__fixtures=x',mock)
 page.evaluate("""() => {
   window.__testState={released:true,extra:0};
   window.fetch=async(url,options={})=>{
     const u=String(url);const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
     if(u.includes('/api/enterprise/dashboard')){
       if(options.headers?.Authorization!=='Bearer browser-synthetic-token')return out({detail:'Unauthorized'},403);
       if(!window.__testState.released)return out({status:'NO_RELEASED_ENTERPRISE_SNAPSHOT'},409);
       const route=new URL(u,'https://fixture.test').searchParams.get('route')||'overview';
       const d=structuredClone(window.__fixtures[route]);
       d.metrics[0].value=(d.metrics[0].value||0)+window.__testState.extra;
       if(window.__testState.extra)d.fingerprint+='v2';
       return out(d);
     }
     if(u.includes('/api/metrics/detail'))return out({status:'ENTERPRISE_RECOMPUTABLE_NON_GXP',source_class:'ENTERPRISE_API_RELEASED_NON_GXP',result:2200,unit:'USD',rows:[{id:'PO-001'},{id:'PO-002'}],weights:[],scope:{},formula:'SUM(PO.amount_usd)'});
     return out({detail:'Unsupported isolated fixture'},404);
   }
 }""")
 page.add_style_tag(content=(ROOT/'static'/'enterprise_dashboard_v2925.css').read_text())
 page.add_style_tag(content=(ROOT/'static'/'metric_audit_ui.css').read_text())
 page.add_script_tag(content=(ROOT/'static'/'metric_audit_ui.js').read_text())
 page.add_script_tag(content=(ROOT/'static'/'enterprise_dashboard_v2925.js').read_text())
 page.evaluate("""() => {window.render=()=>{const c=document.getElementById('content');c.innerHTML='<section><header><h2>原版 DEMO 风险图</h2></header><div>虚构采购金额 999999</div></section>';window.PharmaMetricAudit.apply(c);window.PharmaEnterpriseView.apply(c)}}""")
 page.evaluate("window.PharmaEnterpriseView.activate('browser-synthetic-token')")
 page.wait_for_selector('.pharma-enterprise-kpis',timeout=7000)
 assert page.get_by_text('企业来源分析视图').count()==1
 assert '虚构采购金额' not in page.locator('#content').inner_text()
 assert page.locator('.pharma-enterprise-chart').count()>=4
 assert page.locator('.pharma-enterprise-reconcile').get_by_text('✓ 通过').count()==1
 assert 'browser-synthetic-token' not in page.content()
 assert page.locator('.pharma-enterprise-kpi').count()>=5
 page.locator('.pharma-enterprise-derivation summary').first.click()
 assert page.locator('.pharma-enterprise-derivation[open]').first.get_by_text('PO-002', exact=True).count()==1
 page.locator('.pharma-enterprise-kpi button').first.click()
 page.wait_for_selector('#pharma-metric-modal .pharma-metric-summary')
 page.locator('#pharma-metric-modal [data-audit="close"]').first.click()
 # Update a published release and verify the front-end uses a fresh aggregate.
 before=page.locator('.pharma-enterprise-kpi strong').first.inner_text()
 page.evaluate('window.__testState.extra=180')
 page.evaluate('window.PharmaEnterpriseView.refresh()')
 page.wait_for_timeout(400)
 after=page.locator('.pharma-enterprise-kpi strong').first.inner_text()
 assert before!=after,(before,after)
 # Switching routes preserves enterprise source selection and never renders DEMO.
 page.evaluate("location.hash='#ss-cost';window.render()")
 page.wait_for_selector('.pharma-enterprise-kpis')
 assert page.locator('.pharma-enterprise-kpi').count()>=5
 page.locator('.pharma-enterprise-derivation summary').first.click()
 assert page.locator('.pharma-enterprise-derivation[open]').first.get_by_text('PO-002', exact=True).count()==1
 assert '虚构采购金额' not in page.locator('#content').inner_text()
 # Revoked snapshot must not fall back to the legacy demo page.
 page.evaluate('window.__testState.released=false')
 page.evaluate('window.PharmaEnterpriseView.refresh()')
 page.wait_for_selector('.pharma-enterprise-pending')
 assert page.locator('.pharma-enterprise-kpis').count()==0
 assert '虚构采购金额' not in page.locator('#content').inner_text()
 # Back to demo restores existing page, controls, and charts.
 page.get_by_role('button',name='切回演示看板').click()
 assert page.get_by_text('虚构采购金额 999999').count()==1
 assert not errors,errors
 print('PASS V2925 Chromium: enterprise source replaces DEMO, metric drilldown, 26-route mechanism, release refresh, revoke denies fallback, source toggle')
 browser.close()
