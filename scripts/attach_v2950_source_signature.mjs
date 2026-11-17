/** Attach a genuine data-steward signature, after the steward reviewed exported source counts/scope. */
import fs from 'node:fs';import path from 'node:path';import {canonical,sha256} from '../enterprise_acceptance_v2950.mjs';
const a=process.argv.slice(2),pick=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
const dir=path.resolve(pick('--bundle')||'enterprise_evidence_v2950'),s=pick('--signed-file');if(!s)throw Error('usage: --bundle ENTERPRISE_DIRECTORY --signed-file DATA_STEWARD_SIGNATURE.json');
const file=path.join(dir,'source_manifest.json');const m=JSON.parse(fs.readFileSync(file,'utf8'));const sig=JSON.parse(fs.readFileSync(s,'utf8'));
if(m.steward_signature)throw Error('Source manifest is already signed; any change requires a new reviewed dataset and signature');
if(sig.role!=='DATA_STEWARD'||sig.payload_sha256!==sha256(canonical(m))||canonical(sig.payload)!==canonical(m))throw Error('Data steward signature does not bind this exact source manifest');
const out={...m,steward_signature:{role:sig.role,key_id:sig.key_id,payload_sha256:sig.payload_sha256,signature:sig.signature}};
fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');console.log('Attached data steward signature to exact source manifest (cryptographic validity checked again by formal gate)');
