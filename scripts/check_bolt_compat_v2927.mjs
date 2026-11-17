import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {inspectXlsxFormulas} from './zip_formula_assert.mjs';
import {exportProjectWorkbook} from '../formula_workbook.mjs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.match(pkg.scripts.dev,/regenerate-inline/);
assert.match(pkg.scripts.dev,/build_static/);
assert.match(pkg.scripts.dev,/server\.mjs/);
assert.doesNotMatch(pkg.scripts.dev,/(python\b|unzip\b|check_evidence|test_v\d+)/);
assert.doesNotMatch(pkg.scripts.start,/(python\b|unzip\b|check_evidence|test_v\d+)/);
assert.doesNotMatch(pkg.scripts.build,/(python\b|unzip\b|check_evidence|test_v\d+)/);
const wb=exportProjectWorkbook({material:'API-001'});
const result=inspectXlsxFormulas(wb);
assert(result.formulas>=20);
// Reproduce the WebContainer-style PATH, exposing only node (no Python or unzip).
const empty=fs.mkdtempSync('/tmp/pharma-v2927-path-');
try {
  fs.symlinkSync(process.execPath,empty+'/node');
  execFileSync(empty+'/node',['scripts/check_evidence_v2919.mjs'],{
    cwd:process.cwd(),env:{...process.env,PATH:empty},stdio:'pipe',timeout:30000
  });
} finally { fs.rmSync(empty,{recursive:true,force:true}); }
console.log(`PASS Bolt v2.9.27: Python-free checks, ${result.formulas} Excel formulas, startup scripts launch Node server without running tests`);
