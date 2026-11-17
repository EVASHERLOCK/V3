#!/usr/bin/env python3
"""V2.9.50 real-URL Playwright click evidence (never an injected DOM test).

Runs in the CUSTOMER's permitted browser environment, against a URL they own.
No API tokens or real business values are written in the JSON report.
This is interaction evidence, NOT per-cell or ERP/QMS evidence and NOT GxP approval.
"""
import argparse, datetime, hashlib, json, os, re, sys, urllib.parse, zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
ROOT=Path(__file__).resolve().parent.parent
INV=json.loads((ROOT/'docs/V2948_逐实际控件验收清单.json').read_text())['components']
DEC=['01_KPI总览','02_深度分析','03_智能预警','04_行动闭环','05_指标治理']
EXE=['00_询价与报价比对','01_合同核查','02_PO创建与比对','03_发运与到货','04_发票核对','05_付款与应付','06_退货与索赔','07_订单关闭与绩效','08_异常处理中心']
ERR='无法加载|未能取得|接口不可用|Excel未生成|HTTP [45]\\d\\d|无法获取|正在核对'
def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(data):return hashlib.sha256(data).hexdigest()
def formula_cells(download):
    data=Path(download.path()).read_bytes()
    with zipfile.ZipFile(download.path()) as z:
        if '[Content_Types].xml' not in z.namelist():raise ValueError('invalid workbook: no OOXML content types')
        count=0
        for name in z.namelist():
            if re.fullmatch(r'xl/worksheets/sheet\d+\.xml',name):count+=len(re.findall(rb'<(?:\w+:)?f(?:\s|>)',z.read(name)))
    return {'ok':count>0,'formula_cells':count,'xlsx_sha256':digest(data),'bytes':len(data),'filename_sha256':digest(download.suggested_filename.encode())}
def output_save(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
def click_legacy(page,item,timeout):
    node=page.locator('[data-module-trace-id="'+item['id']+'"]');node.wait_for(state='attached',timeout=timeout)
    formula={'ok':False};sources={'ok':False};excel={'ok':False}
    node.locator(':scope > [data-module-action="explain"]').click(timeout=timeout)
    region=node.locator(':scope > .pharma-module-inline')
    page.wait_for_function('id => {let el=document.querySelector(`[data-module-trace-id="${id}"] > .pharma-module-inline`);return el && el.dataset.loaded==="yes" && el.dataset.view==="explain"}',arg=item['id'],timeout=timeout)
    t=region.inner_text(timeout=timeout);formula={'ok':len(t)>120 and '暂时无法加载计算服务' not in t,'text_sha256':digest(t.encode()),'text_length':len(t)}
    node.locator(':scope > .pharma-module-tools [data-module-action="toggle"]').click(timeout=timeout)
    page.wait_for_function('id => {let el=document.querySelector(`[data-module-trace-id="${id}"] > .pharma-module-inline`);return el && el.dataset.loaded==="yes" && el.dataset.view==="full" && !el.hidden}',arg=item['id'],timeout=timeout)
    s=region.inner_text(timeout=timeout);sources={'ok':len(s)>120 and ('来源' in s or 'source' in s.lower()),'text_sha256':digest(s.encode()),'text_length':len(s)}
    with page.expect_download(timeout=timeout) as event:node.locator(':scope > .pharma-module-tools [data-module-action="excel"]').click(timeout=timeout)
    excel=formula_cells(event.value)
    return formula,sources,excel

def click_decision(page,item,timeout):
    kindid=item['id'].split('.',2); kind=kindid[1]; raw=kindid[2]
    if kind=='dictionary':kind='metric'
    if kind in ('analysis','rule','action'):raw=str(int(raw))
    node=page.locator(f'.dc48-audit[data-kind="{kind}"][data-id="{raw}"]')
    node.first.wait_for(state='visible',timeout=timeout);node=node.first
    node.locator('[data-audit="formula"]').click(timeout=timeout)
    page.locator('#drawer .dc48-details').wait_for(state='visible',timeout=timeout)
    t=page.locator('#drawer .dc48-details').inner_text(timeout=timeout)
    formula={'ok':'完整公式' in t and '未能取得完整来源' not in t,'text_sha256':digest(t.encode()),'text_length':len(t)}
    node.locator('[data-audit="sources"]').click(timeout=timeout)
    page.locator('#drawer .dc48-details').wait_for(state='visible',timeout=timeout)
    page.wait_for_function("() => document.querySelector('#drawer .dc48-details')?.innerText.includes('数据源：')",timeout=timeout)
    s=page.locator('#drawer .dc48-details').inner_text(timeout=timeout)
    sources={'ok':'数据源：' in s,'text_sha256':digest(s.encode()),'text_length':len(s)}
    with page.expect_download(timeout=timeout) as event:node.locator('[data-audit="excel"]').click(timeout=timeout)
    return formula,sources,formula_cells(event.value)

def click_execution(page,item,timeout):
    key=item['id'].rsplit('.',1)[-1]
    node=page.locator('#module-'+key);node.wait_for(state='visible',timeout=timeout)
    node.locator('[data-action="lineage"]').first.click(timeout=timeout)
    cover=page.locator('#drawer-cover');page.wait_for_function("() => document.querySelector('#drawer-cover')?.classList.contains('show')",timeout=timeout)
    t=page.locator('#drawer').inner_text(timeout=timeout)
    formula={'ok':len(t)>75,'text_sha256':digest(t.encode()),'text_length':len(t)}
    page.locator('[data-action="close-drawer"]').first.click(timeout=timeout)
    fold=node.locator('[data-action="fold"]').first;fold.click(timeout=timeout)
    node.locator('.sourceFold').wait_for(state='visible',timeout=timeout)
    content=node.locator('.sourceFold').inner_text(timeout=timeout)
    sources={'ok':len(content)>50,'text_sha256':digest(content.encode()),'text_length':len(content)}
    with page.expect_download(timeout=timeout) as event:node.locator('a[href^="workbooks/"]').first.click(timeout=timeout)
    return formula,sources,formula_cells(event.value)

def main():
    parser=argparse.ArgumentParser(description='Real deployed-site browser clicks. Cannot run against an injected DOM or count a blocked navigation as verified.')
    parser.add_argument('--url',required=True,help='Explicit HTTP(S) URL; Demo may use localhost; never auto-guessed')
    parser.add_argument('--scope',choices=['legacy','all'],default='all')
    parser.add_argument('--out',default='enterprise_evidence_v2950/browser_report.json')
    parser.add_argument('--storage-state',help='External Playwright auth state; protect it and never zip into source')
    parser.add_argument('--timeout-ms',type=int,default=15000)
    parser.add_argument('--screenshots',action='store_true',help='Includes potentially confidential business data in screenshot artifacts; use secured storage')
    parser.add_argument('--environment',choices=['UNVERIFIED','ENTERPRISE_DEPLOYMENT','DEVELOPMENT'],default='UNVERIFIED')
    args=parser.parse_args();out=Path(args.out).resolve()
    parsed=urllib.parse.urlparse(args.url)
    if parsed.scheme not in ('http','https') or not parsed.netloc or parsed.username or parsed.password:parser.error('invalid URL; must be explicit HTTP(S) without embedded credentials')
    base=args.url.rstrip('/')+'/';inventory=[x for x in INV if args.scope=='all' or x['kind']=='legacy_module']
    report={'version':'2.9.50','test_type':'LIVE_CHROMIUM_HTTP_BROWSER','environment':args.environment,'url':base,'scope':args.scope,'started_utc':stamp(),'registered':len(inventory),'components':[],'errors':[],'browser_executable':'bundled Playwright chromium / installed Chromium','boundaries':['Only direct browser interactions + formula-bearing XLSX download are checked.','Not source-row completeness, formula correctness, business text judgment, or business signoff.','No screenshots unless --screenshots is provided, since the pages may contain business-sensitive data.']}
    output_save(out,report)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PHARMA_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(accept_downloads=True,storage_state=args.storage_state) if args.storage_state else browser.new_context(accept_downloads=True)
        page=context.new_page();page.set_default_timeout(args.timeout_ms)
        active_route=None;navigation_blocked=False
        for i,item in enumerate(inventory):
            route=item['route'];unit={'id':item['id'],'route':route,'kind':item['kind'],'status':'BLOCKED','started_utc':stamp(),'formula':{'ok':False},'sources':{'ok':False},'excel':{'ok':False}}
            target=(base+'#'+route if item['kind']=='legacy_module' else base+('static/decision-center/'+DEC[int(route[-2:])-1]+'.html' if route.startswith('decision-') else 'static/procurement-execution/'+EXE[int(route[-2:])]+'.html'))
            try:
                if active_route!=route:
                    response=page.goto(target,wait_until='domcontentloaded',timeout=args.timeout_ms)
                    if response is not None and response.status!=200:raise RuntimeError('Navigation HTTP status is not 200: '+str(response.status))
                    if response is None and page.url!=target:raise RuntimeError('Hash navigation did not reach expected deployed route')
                    if item['kind']=='legacy_module':page.locator('#content').wait_for(state='attached',timeout=args.timeout_ms);page.wait_for_timeout(450)
                    else:page.wait_for_timeout(250)
                    active_route=route
                if item['kind']=='legacy_module':f,s,x=click_legacy(page,item,args.timeout_ms)
                elif route.startswith('decision-'):f,s,x=click_decision(page,item,args.timeout_ms)
                else:f,s,x=click_execution(page,item,args.timeout_ms)
                unit.update(formula=f,sources=s,excel=x)
                unit['status']='CLICK_TESTED' if f['ok'] and s['ok'] and x['ok'] else 'BLOCKED'
                if args.screenshots:
                    pic=out.parent/'screenshots'/f'{i+1:04d}.png';pic.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(pic));unit['screenshot']={'path':str(pic.relative_to(out.parent)),'sha256':hashlib.sha256(pic.read_bytes()).hexdigest()}
            except Exception as ex:
                unit['error']=str(ex).split('Call log:')[0][:450]
                if 'ERR_BLOCKED_BY_ADMINISTRATOR' in unit['error']:
                    navigation_blocked=True;report['errors'].append({'code':'BROWSER_NETWORK_BLOCKED_BY_ADMINISTRATOR','url_sha256':digest(target.encode()),'message':'Browser policy blocked actual HTTP navigation; no E2E evidence possible in this environment.'})
            report['components'].append(unit)
            if (i+1)%10==0 or unit['status']=='BLOCKED':print('Browser evidence',i+1,'/',len(inventory),route,unit['status'],flush=True)
            output_save(out,report)
            if navigation_blocked:
                # Do not call set_content as a replacement; it is not a real URL visit.
                for rest in inventory[i+1:]:report['components'].append({'id':rest['id'],'route':rest['route'],'kind':rest['kind'],'status':'NOT_ATTEMPTED_BROWSER_POLICY_BLOCK','formula':{'ok':False},'sources':{'ok':False},'excel':{'ok':False}})
                break
        browser.close()
    report['finished_utc']=stamp();report['verified_interaction_count']=sum(x['status']=='CLICK_TESTED' for x in report['components']);report['failed_or_missing']=len(inventory)-report['verified_interaction_count'];output_save(out,report)
    print('LIVE BROWSER:',report['verified_interaction_count'],'/',len(inventory),'interactive controls; results',out)
    return 0 if report['verified_interaction_count']==len(inventory) else 2
if __name__=='__main__':sys.exit(main())
