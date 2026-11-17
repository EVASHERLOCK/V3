#!/usr/bin/env python3
"""Run V2949 HTTP smoke against an ephemeral local Node server.
This is API/resource testing; NOT a live Chromium browser acceptance test.
"""
import os,sys,socket,time,subprocess,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
if os.environ.get('PHARMA_TEST_URL'):
 raise SystemExit(subprocess.call([sys.executable,str(ROOT/'scripts/test_v2949_http_smoke.py')],cwd=ROOT,env=os.environ.copy()))
with socket.socket() as sock:
 sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
env={**os.environ,'PORT':str(port),'PHARMA_DATA_MODE':'SIMULATED','PHARMA_TEST_URL':f'http://127.0.0.1:{port}'}
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
try:
 for tries in range(50):
  if proc.poll() is not None:raise RuntimeError('Local server exited '+str(proc.returncode)+': '+proc.stderr.read().decode(errors='replace')[:400])
  try:
   with urllib.request.urlopen(env['PHARMA_TEST_URL']+'/static/audit/audit_ui_v2949.js',timeout=1) as r:
    if r.status==200:break
  except Exception:time.sleep(.2)
 else:raise RuntimeError('Local server failed readiness after retries')
 result=subprocess.run([sys.executable,str(ROOT/'scripts/test_v2949_http_smoke.py')],cwd=ROOT,env=env,check=False)
 sys.exit(result.returncode)
finally:
 proc.terminate()
 try:proc.wait(timeout=5)
 except subprocess.TimeoutExpired:proc.kill();proc.wait()
