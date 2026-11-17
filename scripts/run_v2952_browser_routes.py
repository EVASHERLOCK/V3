#!/usr/bin/env python3
"""Sharded offline Chromium+real Node Demo API test of 217 legacy components.
Each route gets an independent browser process. A route that fails is recorded
as TEST_INFRASTRUCTURE_BLOCKED, not as success. Never promotes status to PASS.
"""
import argparse
import concurrent.futures
import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
CATALOG=json.loads((ROOT/'docs/V2948_逐实际控件验收清单.json').read_text())['components']
LEGACY=[x for x in CATALOG if x['kind']=='legacy_module']
ROUTES=list(dict.fromkeys(x['route'] for x in LEGACY))
BASENAME=ROOT/'docs/V2952_217历史组件_离线浏览器真实Node接口点击证据.json'
PARTS=ROOT/'docs/V2952_browser_route_parts'

ap=argparse.ArgumentParser()
ap.add_argument('--jobs',type=int,default=2)
ap.add_argument('--route-timeout',type=int,default=240)
ap.add_argument('--timeout-ms',type=int,default=3300)
ap.add_argument('--force',action='store_true')
args=ap.parse_args()
PARTS.mkdir(parents=True,exist_ok=True)

# Safely preserve the completed route fragments in an interrupted run.
if BASENAME.exists():
 try:
  initial=json.loads(BASENAME.read_text())
  for route in ROUTES:
   items=[x for x in LEGACY if x['route']==route]
   present=[x for x in initial.get('components',[]) if x['route']==route]
   if len(present)!=len(items):continue
   f=PARTS/(route+'.json')
   if not f.exists():
    part={k:v for k,v in initial.items() if k!='components'}
    part['components']=present
    part['routes']=[x for x in initial.get('routes',[]) if x['route']==route]
    f.write_text(json.dumps(part,ensure_ascii=False,indent=2)+'\n')
 except Exception:pass

# Preserve previously tested route evidence from a clickable-disclosure probe.
dbg=ROOT/'docs/V2952_debug_disclosure_clicks.json'
if dbg.exists():
 try:
  j=json.loads(dbg.read_text())
  for r in ['documents','ss-technical']:
   subset=[x for x in j.get('components',[]) if x['route']==r]
   if len(subset)==sum(x['route']==r for x in LEGACY):
    f=PARTS/(r+'.json')
    if not f.exists():
     part={k:v for k,v in j.items() if k!='components'}
     part['components']=subset;part['routes']=[x for x in j.get('routes',[]) if x['route']==r]
     f.write_text(json.dumps(part,ensure_ascii=False,indent=2)+'\n')
 except Exception:pass


def valid_route(route, path):
 if not path.exists():return False
 try:
  o=json.loads(path.read_text())
  return o.get('test_type')=='CHROMIUM_OFFLINE_BUNDLED_SITE_WITH_REAL_NODE_API_BRIDGE' and len([x for x in o.get('components',[]) if x['route']==route])==sum(x['route']==route for x in LEGACY)
 except Exception:return False

def test_route(route):
 p=PARTS/(route+'.json')
 if not args.force and valid_route(route,p):return route,'REUSED',p
 cmd=[sys.executable,str(ROOT/'scripts/browser_v2952_demo_bridge.py'),'--route',route,'--timeout-ms',str(args.timeout_ms),'--out',str(p)]
 try:
  x=subprocess.run(cmd,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=args.route_timeout)
  if x.returncode==0 and valid_route(route,p):return route,'TESTED',p
  return route,'ERROR '+str(x.returncode)+' '+x.stdout[-600:],p
 except subprocess.TimeoutExpired:return route,'TIMEOUT',p

with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
 futures={pool.submit(test_route,r):r for r in ROUTES}
 for f in concurrent.futures.as_completed(futures):
  route,status,p=f.result()
  print('V2952 route',route,status,flush=True)

parts={};missing=[]
for r in ROUTES:
 p=PARTS/(r+'.json')
 if valid_route(r,p):parts[r]=json.loads(p.read_text())
 else:missing.append(r)
all_components=[]
for item in LEGACY:
 matched=next((x for x in parts.get(item['route'],{}).get('components',[]) if x['id']==item['id']),None)
 all_components.append(matched if matched else {**item,'status':'TEST_INFRASTRUCTURE_BLOCKED','error':'Route browser evidence not completed'})
report={'version':'2.9.52','test_type':'CHROMIUM_OFFLINE_BUNDLED_SITE_WITH_REAL_NODE_API_BRIDGE',
'is_real_browser_native_http_navigation':False,'source_mode':'SIMULATED',
'browser_url':'about:blank (set_content of original static/index.html)',
'backend_transport':'Python urllib forwards fetch() to local Node HTTP server',
'finished_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
'registered_legacy':len(LEGACY),'routes':[next(iter(parts[r]['routes'])) if parts[r].get('routes') else {'route':r} for r in ROUTES if r in parts],
'components':all_components,'route_evidence_missing':missing,
'limit':'Browser clicks, API responses and formula-bearing XLSX only; not full per-cell, row-selection, narrative validation.',
'exact_rendered':sum(x['status']!='NO_EXACT_DOM_NODE' and x['status']!='TEST_INFRASTRUCTURE_BLOCKED' for x in all_components),
 'three_entry_click_verified':sum(x['status']=='OFFLINE_BRIDGED_CLICK_OK' for x in all_components),
'formula_workbooks_checked':sum(x.get('excel',{}).get('ok',False) for x in all_components),
'api_trace_received':sum(bool(x.get('api_trace',{}).get('status','') not in ('','MISSING_API_TRACE')) for x in all_components)}
BASENAME.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('V2952 merged evidence:',len(all_components),'rows; DOM',report['exact_rendered'],'normal 3-entry',report['three_entry_click_verified'],'missing routes',missing)
if missing:sys.exit(2)
