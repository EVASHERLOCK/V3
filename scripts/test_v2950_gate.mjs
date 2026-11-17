import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {canonical,sha256,verifySignature,auditComponentEvidence,enterpriseBrowserReport,verifyFileRef} from '../enterprise_acceptance_v2950.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'v2950-gate-'));
try{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');const payload={version:'2.9.50',decision:'APPROVE_ENTERPRISE_BUSINESS_ACCEPTANCE'};
 const sig=crypto.sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64'),trusted={signers:[{key_id:'T',role:'BUSINESS_OWNER',active:true,public_key_pem:publicKey.export({format:'pem',type:'spki'})}]};
 const signed={role:'BUSINESS_OWNER',key_id:'T',payload_sha256:sha256(canonical(payload)),signature:sig};
 assert.equal(verifySignature(trusted,signed,payload).ok,true);assert.equal(verifySignature(trusted,signed,{...payload,decision:'REJECT'}).ok,false);
 const fp=path.join(tmp,'evidence.txt');fs.writeFileSync(fp,'real test bytes');const proof={path:'evidence.txt',sha256:sha256('real test bytes'),verified:true};assert(verifyFileRef(tmp,proof));fs.writeFileSync(fp,'tampered bytes');assert(!verifyFileRef(tmp,proof));
 assert.equal(auditComponentEvidence({components:[{id:'ONE',evidence:{}}]},[{id:'ONE'}],tmp).complete,0);
 assert.equal(enterpriseBrowserReport({test_type:'LIVE_CHROMIUM_HTTP_BROWSER',environment:'ENTERPRISE_DEPLOYMENT',url:'http://127.0.0.1:3000/',components:[]},[{id:'ONE'}]).all_clicked,false);
 const gate=spawnSync(process.execPath,['scripts/check_v2950_enterprise.mjs','--bundle',tmp,'--out',path.join(tmp,'gate.json'),'--strict'],{encoding:'utf8'});
 assert.equal(gate.status,2,'formal gate must block when all genuine source/browser/signature evidence is absent');
 const rep=JSON.parse(fs.readFileSync(path.join(tmp,'gate.json'),'utf8'));
 assert.equal(rep.status,'BLOCKED');assert.equal(rep.formal_passed,0);assert(rep.blocker_count>=5);
 console.log('V2950 gate unit tests PASS: signature binding, tamper detection, localhost exclusion, no-fake-pass strict gate');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
