#!/usr/bin/env python3
"""Re-test the fifteen previously missing legacy controls in 3 isolated browser runs.
Includes two already passing ss-data controls as same-route regression; saves all 17 XLSX.
Not a substitute for 585 full semantic/row/cell reconciliation.
"""
from pathlib import Path
import subprocess,sys,os
R=Path(__file__).resolve().parent.parent
CASES=[('m09',[], 'V2953_m09_clicks.json'),('ss-data',[], 'V2953_ssdata_clicks.json'),
 ('ss-performance',['ss-performance.bb546065','ss-performance.ea85f424','ss-performance.63a41dc0','ss-performance.fa9c5927'],'V2953_perf_four.json')]
for route,ids,name in CASES:
 args=[sys.executable,'scripts/browser_v2952_demo_bridge.py','--route',route,'--out','docs/'+name,'--timeout-ms','9000']
 for identifier in ids:args+=['--id',identifier]
 env={**os.environ,'PHARMA_BROWSER_XLSX_DIR':'docs/V2953_15历史组件真实公式Excel','PHARMA_DATA_MODE':'SIMULATED'}
 print('Checking',route,'registered items',len(ids) or ('6' if route=='m09' else '7'),flush=True)
 subprocess.run(args,env=env,cwd=R,check=True)
subprocess.run(['node','scripts/check_v2953_demo.mjs'],cwd=R,check=True)
