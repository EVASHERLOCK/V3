#!/usr/bin/env python3
"""DEMO browser evidence: permitted local or hosted HTTP URL, no ERP/QMS or enterprise signatures.
Runs the V2950 browser click implementation in DEVELOPMENT mode. This is a *real HTTP*
interaction test, but its origin is DEMO and never an enterprise-compliance attestation.
"""
import sys
from browser_v2950_live import main
if __name__=='__main__':
    argv=sys.argv
    if '--url' not in argv:
        argv.extend(['--url','http://127.0.0.1:3000'])
    if '--environment' not in argv:
        argv.extend(['--environment','DEVELOPMENT'])
    if '--out' not in argv:
        argv.extend(['--out','docs/V2951_Demo_浏览器逐组件点击.json'])
    sys.exit(main())
