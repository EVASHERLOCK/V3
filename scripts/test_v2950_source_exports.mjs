import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {fileHash} from '../enterprise_acceptance_v2950.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v2950-source-'));
try{
 const csv=path.join(dir,'erp.csv');fs.writeFileSync(csv,'id,qty,note\nPO-1,4,"quoted, note"\nPO-2,5,"two\nlines"\n');
 const t={system:'ERP',name:'purchase_orders',file:'erp.csv',primary_key:['id'],row_count:2,sha256:fileHash(csv),scope:'FULL_TABLE',export_query:'SELECT * FROM purchase_orders',snapshot_id:'SNAP-XYZ',count_evidence:{system:'ERP',query:'SELECT COUNT(*) FROM purchase_orders',query_ref:'ERP_JOB123',snapshot_id:'SNAP-XYZ',result:2}};
 const manifest={environment:'ENTERPRISE',data_type:'REAL_ERP_QMS_EXPORT',environment_id:'TEST_FIXTURE_ONLY',dataset_version:'TEST_V1',extracted_at:'2026-11-13T00:00:00Z',tables:[t],component_source_coverage:{ONE:['ERP.purchase_orders']}};
 const save=()=>fs.writeFileSync(path.join(dir,'source_manifest.json'),JSON.stringify(manifest));
 const run=()=>{const out=path.join(dir,'report.json'),r=spawnSync(process.execPath,['scripts/check_v2950_source_exports.mjs','--bundle',dir,'--out',out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(fs.readFileSync(out,'utf8'))};
 save();let report=run();assert.equal(report.status,'STRUCTURAL_MATCH_AWAITING_SIGNED_ORIGIN');assert.equal(report.rows_total,2);assert.equal(report.verified_tables,1);
 manifest.tables[0].count_evidence.result=3;save();report=run();assert.equal(report.status,'BLOCKED');assert.match(report.errors.join(' '),/declared 2/);
 manifest.tables[0].count_evidence.result=2;manifest.tables[0].snapshot_id='SNAP-WRONG';save();report=run();assert.equal(report.status,'BLOCKED');
 manifest.tables[0].snapshot_id='SNAP-XYZ';fs.writeFileSync(csv,'id,qty,note\nPO-1,4,AAA\nPO-1,5,BBB\n');manifest.tables[0].sha256=fileHash(csv);save();report=run();assert.equal(report.status,'BLOCKED');assert.match(report.errors.join(' '),/duplicate primary key/);
 // Ensure a >800-row export is never truncated to the visible DOM limit.
 fs.writeFileSync(csv,'id,qty,note\n'+Array.from({length:2601},(_,i)=>`PO-${i},${i},bulk`).join('\n')+'\n');
 manifest.tables[0].row_count=2601;manifest.tables[0].count_evidence.result=2601;manifest.tables[0].sha256=fileHash(csv);save();report=run();
 assert.equal(report.rows_total,2601);assert.equal(report.verified_tables,1);
 console.log('V2950 source integrity tests PASS: multiline CSV, same snapshot, independent count, row identity, no enterprise auto-approval');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
