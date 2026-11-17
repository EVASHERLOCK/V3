#!/usr/bin/env python3
"""Offline rendered-site Chromium interaction + REAL local Node demo API.

This is reproducible executable DEMO evidence when Chromium is prevented from
visiting HTTP origins. The browser runs the bundled site scripts in an injected
page, and requests are forwarded via Python to a locally started Node server.
It is NOT a browser-native HTTP navigation/E2E test, and no component is
certified for all-formula/all-source/wording correctness by clicking buttons.
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_v2950_live import formula_cells

ROOT=Path(__file__).resolve().parent.parent
INVENTORY=json.loads((ROOT/'docs/V2948_逐实际控件验收清单.json').read_text())['components']
LEGACY=[x for x in INVENTORY if x['kind']=='legacy_module']
NOW=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
SHA=lambda v:hashlib.sha256(v).hexdigest()

def write_json(path,report):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp')
    tmp.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    tmp.replace(path)

def make_html(port):
    html=(ROOT/'static/index.html').read_text()
    # Browser would normally have location.href. about:blank does not, so this
    # temporary test-only replacement resolves relative endpoints against the
    # local Node server address. Production code remains untouched.
    old='new URL(value,location.href)'
    if html.count(old)!=1:raise RuntimeError('Unexpected browser API boot code, review bridge')
    html=html.replace(old,f"new URL(value,'http://127.0.0.1:{port}')")
    # Avoid blocked external stylesheet requests: load the EXACT published CSS
    # from the source tree, retaining visible/hidden states and realistic UI.
    def replace_css(m):
        path=m.group(1).lstrip('/')
        file=ROOT/path
        if not file.is_file():raise RuntimeError('Missing stylesheet '+path)
        css=file.read_text().replace('</style','<\\/style')
        return '<style data-test-inlined="'+path+'">'+css+'</style>'
    html=re.sub(r'<link\s+rel="stylesheet"\s+href="(/static/[^\"]+\.css)"\s*/?>',replace_css,html)
    # Must be installed before bundled browser_api_boot and the app load.
    bridge='''<script id="v2952-test-only-fetch-bridge">
    window.fetch=(input,options={})=>window.__pythonDemoApi({
      url:typeof input==='string'?input:input.url,
      method:options.method||'GET',headers:options.headers||{},body:options.body||null
    }).then(r=>new Response(Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0)),
      {status:r.status,headers:{'content-type':r.contentType}}));
    </script>'''
    return html.replace('</head>',bridge+'</head>',1)

def new_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1',0))
        return s.getsockname()[1]

def navigate_route(page,route,expected):
    page.evaluate("r=>{location.hash='#'+r}",route)
    # A few older modules wait for the simulated API data to load before render.
    for pause in (250,300,450,700):
        page.wait_for_timeout(pause)
        ids=page.locator('#content [data-module-trace-id]').evaluate_all('(nodes)=>nodes.map(x=>x.dataset.moduleTraceId)')
        if any(x in ids for x in expected):break
    return ids

def click_module(page,item,timeout,api_responses):
    ident=item['id']
    node=page.locator(f'[data-module-trace-id="{ident}"]')
    if node.count()!=1:
        return {'status':'NO_EXACT_DOM_NODE','found':node.count()}
    out={'status':'CLICK_BLOCKED','clicked':[],'formula':{'ok':False},'sources':{'ok':False},'excel':{'ok':False}}
    def physical_click(locator,label):
        try:
            locator.click(timeout=min(timeout,1600))
            return 'NORMAL_POINTER'
        except Exception:
            # A force-click still generates browser pointer events, but it is
            # NOT evidence that a normal user can reach this control.
            locator.click(force=True,timeout=min(timeout,1800))
            out.setdefault('forced_pointer_controls',[]).append(label)
            return 'FORCED_POINTER'
    try:
        # Some legacy panels were intentionally placed in native <details>.
        # Open them through actual summary clicks, just as a user would.
        # Never unhide authorization-gated nodes by altering the DOM.
        for _ in range(4):
            summary=node.locator('xpath=ancestor::details[not(@open)]/summary')
            if not summary.count():break
            summary.last.click(timeout=min(timeout,2000))
            out.setdefault('opened_disclosures',[]).append('NATIVE_DETAILS_SUMMARY_CLICK')
        physical_click(node.locator(':scope > [data-module-action="explain"]'),'formula')
        out['clicked'].append('formula')
        region=node.locator(':scope > .pharma-module-inline')
        page.wait_for_function('id=>{const x=document.querySelector(`[data-module-trace-id="${id}"]>.pharma-module-inline`);return x&&(x.dataset.loaded==="yes"||x.innerText.includes("暂时无法加载计算服务"))}',arg=ident,timeout=timeout)
        txt=region.inner_text(timeout=timeout)
        out['formula']={'ok':region.get_attribute('data-loaded')=='yes' and len(txt)>125 and '暂时无法加载计算服务' not in txt,
                        'text_length':len(txt),'sha256':SHA(txt.encode())}
        if not out['formula']['ok']:out['error']='formula service response unavailable or empty';return out
        physical_click(node.locator(':scope > .pharma-module-tools [data-module-action="toggle"]'),'sources')
        out['clicked'].append('sources')
        page.wait_for_function('id=>{const x=document.querySelector(`[data-module-trace-id="${id}"]>.pharma-module-inline`);return x&&x.dataset.loaded==="yes"&&x.dataset.view==="full"&&!x.hidden}',arg=ident,timeout=timeout)
        text=region.inner_text(timeout=timeout)
        out['sources']={'ok':len(text)>125 and '来源' in text,'text_length':len(text),'sha256':SHA(text.encode())}
        with page.expect_download(timeout=timeout) as download_event:
            physical_click(node.locator(':scope > .pharma-module-tools [data-module-action="excel"]'),'excel')
        out['clicked'].append('excel')
        out['excel']=formula_cells(download_event.value)
        export_dir=os.environ.get('PHARMA_BROWSER_XLSX_DIR')
        if export_dir:
            folder=Path(export_dir).resolve();folder.mkdir(parents=True,exist_ok=True)
            destination=folder/(re.sub(r'[^a-zA-Z0-9_.-]','_',ident)+'.xlsx')
            download_event.value.save_as(destination)
            out['excel']['saved_test_workbook']=str(destination.relative_to(ROOT) if destination.is_relative_to(ROOT) else destination)
        # Collapse after each module; otherwise 30 expanded 10K-row evidence
        # panels accumulate and make later controls mechanically inaccessible.
        region.evaluate('el=>{el.hidden=true;}')
        if not out['sources']['ok'] or not out['excel']['ok']:
            out['status']='CLICK_BLOCKED'
        else:
            out['status']='OFFLINE_BRIDGED_FORCED_POINTER_ONLY' if out.get('forced_pointer_controls') else 'OFFLINE_BRIDGED_CLICK_OK'
    except Exception as exc:
        out['error']=str(exc).split('Call log:')[0].strip()[:450]
        try:
            out['inline_diagnostic']=node.locator(':scope > .pharma-module-inline').evaluate('el=>({loaded:el.dataset.loaded,view:el.dataset.view,hidden:el.hidden,text:el.innerText.slice(0,300)})',timeout=1500)
        except Exception:pass
        try:
            out['visibility_diagnostic']=node.locator(':scope > [data-module-action="explain"]').evaluate('''el=>{
              let out=[],n=el;for(let i=0;n&&i<7;i++,n=n.parentElement){let r=n.getBoundingClientRect(),c=getComputedStyle(n);
              out.push({tag:n.tagName,cls:typeof n.className==='string'?n.className.slice(0,80):'',
              display:c.display,visibility:c.visibility,overflow:c.overflow,rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]});}
              return out;}''',timeout=1600)
        except Exception:pass
    finally:
        trace=api_responses.get(ident)
        if trace:
            out['api_trace']=trace
            out['business_calculation_complete']=bool(trace.get('status') in ('SOURCE_METRICS_RECOMPUTABLE','NO_CALCULATION_REQUIRED') and trace.get('reconciliation_status')=='PASS' and not trace.get('missing_count'))
        else:
            out['api_trace']={'status':'MISSING_API_TRACE'}
    return out

def run(args):
    out=Path(args.out).resolve()
    port=new_port()
    server_log=out.parent/'V2952_Node_Demo_API.log'
    server_log.parent.mkdir(parents=True,exist_ok=True)
    log=server_log.open('w')
    proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port),'PHARMA_DATA_MODE':'SIMULATED'},stdout=log,stderr=subprocess.STDOUT)
    report={'version':'2.9.52','test_type':'CHROMIUM_OFFLINE_BUNDLED_SITE_WITH_REAL_NODE_API_BRIDGE',
            'is_real_browser_native_http_navigation':False,'source_mode':'SIMULATED',
            'browser_url':'about:blank (set_content of original static/index.html)',
            'backend_transport':'Python urllib forwards fetch() to local Node HTTP server',
            'started_utc':NOW(),'registered_legacy':len(LEGACY),'routes':[],
            'components':[],'script_errors':[],
            'limit':'Browser clicks, API responses and formula-bearing XLSX tested; NOT independent webpage-vs-XLSX every-cell recalculation, NOT full source row parity, NOT narrative semantic acceptance.'}
    write_json(out,report)
    try:
        for _ in range(80):
            if proc.poll() is not None:raise RuntimeError('Node API terminated early; see '+str(server_log))
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/sim-data/overview',timeout=.6) as response:
                    if response.status==200:break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('Node API not ready in time')
        responses={}
        def backend(binding,req):
            value=req.get('url') or ''
            url=f'http://127.0.0.1:{port}'+value if value.startswith('/') else value
            if not url.startswith(f'http://127.0.0.1:{port}/'):
                return {'status':404,'contentType':'text/plain','base64':base64.b64encode(b'UNSUPPORTED_FETCH_ORIGIN').decode()}
            body=req.get('body')
            if isinstance(body,str):body=body.encode()
            try:
                request=urllib.request.Request(url,data=body,method=req.get('method','GET'),headers=req.get('headers',{}))
                with urllib.request.urlopen(request,timeout=35) as r:status=r.status;data=r.read();ctype=r.headers.get('content-type','application/octet-stream')
            except urllib.error.HTTPError as e:status=e.code;data=e.read();ctype=e.headers.get('content-type','application/json')
            except Exception as e:status=503;data=str(e).encode();ctype='text/plain'
            if '/api/lineage/module' in url and not url.endswith('workbook.xlsx') and status==200:
                try:
                    obj=json.loads(data)
                    if isinstance(obj,dict) and obj.get('component_id'):
                        responses[obj['component_id']]={
                            'status':obj.get('status'),'reconciliation_status':obj.get('reconciliation',{}).get('status'),
                            'matched_metrics':obj.get('summary',{}).get('matched_metrics',0),
                            'computed_metrics':obj.get('summary',{}).get('computed_metrics',0),
                            'visible_dom_rows':obj.get('summary',{}).get('displayed_rows',0),
                            'displayed_figures':len(obj.get('figures',[])),
                            'source_metrics_recomputed':obj.get('reconciliation',{}).get('summary',{}).get('source_metrics_recomputed',0),
                            'display_passed':obj.get('reconciliation',{}).get('summary',{}).get('display_passed',0),
                            'display_unverified':obj.get('reconciliation',{}).get('summary',{}).get('display_unverified',0),
                            'charts_unverified':obj.get('reconciliation',{}).get('summary',{}).get('charts_unverified',0),
                            'narrative_paragraphs':len(obj.get('narrative_audits',[])),
                            'narrative_unverified':sum(x.get('status') not in ('VERIFIED','PASS','MATCH') for x in obj.get('narrative_audits',[])),
                            'missing_count':len(obj.get('missing',[])),
                            'metric_source_key_evidence':[
                              {'metric_id':m.get('metric_id'), 'formula':m.get('formula'),
                               'row_count_returned':len(m.get('rows') or []),
                               'source_key_sample':[
                                 {k:v for k,v in row.items() if k in ('id','source_row','source_id','supplier_id','material_id','po_id','change_id','event_id','invoice_id','document_id','source_file')}
                                 for row in (m.get('rows') or [])[:20] if isinstance(row,dict)]}
                              for m in obj.get('metrics',[])[:40]],
                            'strict_metric_audit':[
                              {'metric_id':m.get('metric_id'), 'status':m.get('status'),
                               'source_row_count':m.get('source_row_count'),
                               'source_id_count_returned':len(m.get('source_ids') or []),
                               'reason':str(m.get('reason') or '')[:200]}
                              for m in obj.get('reconciliation',{}).get('source_metrics',[])[:40]],
                            'narrative_audit_statuses':[{'status':m.get('status'),'rule_id':m.get('rule_id')}
                              for m in obj.get('narrative_audits',[])[:48]],
                            'response_sha256':SHA(data)}
                except Exception:pass
            return {'status':status,'contentType':ctype,'base64':base64.b64encode(data).decode()}
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            page=browser.new_page(viewport={'width':1440,'height':960},accept_downloads=True)
            page.set_default_timeout(args.timeout_ms)
            page.on('pageerror',lambda e:report['script_errors'].append(str(e)[:240]))
            page.expose_binding('__pythonDemoApi',backend)
            page.set_content(make_html(port),wait_until='domcontentloaded',timeout=55000)
            page.wait_for_timeout(500)
            routes=list(dict.fromkeys(x['route'] for x in LEGACY))
            if args.route:routes=[x for x in routes if x in args.route]
            for ri,route in enumerate(routes):
                if ri:
                    page.close()
                    page=browser.new_page(viewport={'width':1440,'height':960},accept_downloads=True)
                    page.set_default_timeout(args.timeout_ms)
                    page.on('pageerror',lambda e:report['script_errors'].append(str(e)[:240]))
                    page.expose_binding('__pythonDemoApi',backend)
                    page.set_content(make_html(port),wait_until='domcontentloaded',timeout=55000)
                    page.wait_for_timeout(400)
                items=[x for x in LEGACY if x['route']==route]
                if args.id:items=[x for x in items if x['id'] in args.id]
                if args.limit:items=items[:args.limit]
                seen=navigate_route(page,route,[x['id'] for x in items])
                report['routes'].append({'route':route,'expected':len(items),'exact_ids_found':sum(x['id'] in seen for x in items),
                                         'rendered_module_count':len(seen),'unmatched_ids':[x['id'] for x in items if x['id'] not in seen]})
                for item in items:
                    if item['id'] in seen:
                        result={'status':'DOM_PRESENT_UNCLICKED'} if args.inventory_only else click_module(page,item,args.timeout_ms,responses)
                    else:result={'status':'NO_EXACT_DOM_NODE','error':'Not found in rendered route after waiting for simulated data'}
                    report['components'].append({'id':item['id'],'route':route,'title':item['title'],**result})
                write_json(out,report)
                print(f'V2952 offline-bridge: route {ri+1}/{len(routes)} {route}; exact {sum(x["id"] in seen for x in items)}/{len(items)}; clicks {sum(x["status"]=="OFFLINE_BRIDGED_CLICK_OK" for x in report["components"])}',flush=True)
            browser.close()
    finally:
        proc.terminate()
        try:proc.wait(timeout=5)
        except subprocess.TimeoutExpired:proc.kill()
        log.close()
    report['finished_utc']=NOW()
    report['exact_rendered']=sum(x['status']!='NO_EXACT_DOM_NODE' for x in report['components'])
    report['three_entry_click_verified']=sum(x['status']=='OFFLINE_BRIDGED_CLICK_OK' for x in report['components'])
    report['forced_pointer_clicks']=sum(x['status']=='OFFLINE_BRIDGED_FORCED_POINTER_ONLY' for x in report['components'])
    report['formula_workbooks_checked']=sum(x.get('excel',{}).get('ok',False) for x in report['components'])
    report['api_trace_received']=sum(x.get('api_trace',{}).get('status','MISSING_API_TRACE')!='MISSING_API_TRACE' for x in report['components'])
    report['api_business_calculation_complete']=sum(bool(x.get('business_calculation_complete')) for x in report['components'])
    report['full_browser_http_e2e_verified']=0
    write_json(out,report)
    print('V2952 complete: exact DOM',report['exact_rendered'],'/',len(LEGACY),'; offline three-entry clicks',report['three_entry_click_verified'],'/',len(LEGACY),'; API traces',report['api_trace_received'],'/',len(LEGACY),flush=True)
    if args.strict and report['three_entry_click_verified']!=len(LEGACY):return 2
    return 0

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--out',default='docs/V2952_Demo_217历史组件离线浏览器与真实API桥接.json')
    ap.add_argument('--timeout-ms',type=int,default=6500)
    ap.add_argument('--chromium',default=os.environ.get('PHARMA_CHROMIUM_PATH','/usr/bin/chromium'))
    ap.add_argument('--strict',action='store_true')
    ap.add_argument('--route',action='append')
    ap.add_argument('--id',action='append',help='Run a targeted registered component ID')
    ap.add_argument('--limit',type=int,default=0)
    ap.add_argument('--inventory-only',action='store_true')
    sys.exit(run(ap.parse_args()))
