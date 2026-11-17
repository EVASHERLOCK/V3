/** Assemble two human-produced signatures without fabricating or overwriting them. */
import fs from 'node:fs';import path from 'node:path';import {canonical} from '../enterprise_acceptance_v2950.mjs';
const args=process.argv.slice(2),get=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const dir=path.resolve(get('--bundle')||'enterprise_evidence_v2950'),steward=get('--data-steward-signature'),owner=get('--business-owner-signature');
if(!steward||!owner)throw Error('--data-steward-signature FILE --business-owner-signature FILE');
const expected=JSON.parse(fs.readFileSync(path.join(dir,'business_signoff_payload.json'),'utf8'));
const s=JSON.parse(fs.readFileSync(steward,'utf8')),o=JSON.parse(fs.readFileSync(owner,'utf8'));
if(s.role!=='DATA_STEWARD'||o.role!=='BUSINESS_OWNER'||s.key_id===o.key_id||!s.signature||!o.signature||canonical(s.payload)!==canonical(expected)||canonical(o.payload)!==canonical(expected))throw Error('Two distinct independent signatures required on same exact reviewed business payload');
const dest=path.join(dir,'business_signoffs.json');fs.writeFileSync(dest,JSON.stringify({signatures:[s,o]},null,2)+'\n',{flag:'wx'});console.log('Assembled two separate signatures; formal checker still verifies registered trusted public keys and all evidence hashes.');
