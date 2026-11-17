/** Sign an existing review payload using the reviewer's own Ed25519 PEM key.
 * A signature is never auto-generated during builds/tests. Private keys stay outside repo.
 */
import fs from 'node:fs';import crypto from 'node:crypto';
import {canonical,sha256} from '../enterprise_acceptance_v2950.mjs';
const a=process.argv.slice(2),get=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
const payloadFile=get('--payload'),privateFile=get('--private-key'),role=get('--role'),keyId=get('--key-id'),out=get('--out');
if(!payloadFile||!privateFile||!keyId||!out||!['DATA_STEWARD','BUSINESS_OWNER'].includes(role))throw Error('usage: --payload PAYLOAD.json --private-key EXTERNAL.pem --role DATA_STEWARD|BUSINESS_OWNER --key-id ID --out SIGNATURE.json');
if(!fs.existsSync(privateFile))throw Error('Private key not available. Do not place a signing key in the source archive.');
const payload=JSON.parse(fs.readFileSync(payloadFile,'utf8'));
if(payload.decision!=='APPROVE_ENTERPRISE_BUSINESS_ACCEPTANCE'&&role==='BUSINESS_OWNER')throw Error('Approval payload must explicitly state decision');
const privateKey=crypto.createPrivateKey(fs.readFileSync(privateFile,'utf8'));
if(privateKey.asymmetricKeyType!=='ed25519')throw Error('Only Ed25519 signing is supported');
const signature=crypto.sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64');
fs.writeFileSync(out,JSON.stringify({role,key_id:keyId,payload_sha256:sha256(canonical(payload)),payload,signature},null,2)+'\n',{flag:'wx',mode:0o600});
console.log('SIGNED',role,'approval payload; signature:',out,'(not a substitute for authority/identity verification)');
