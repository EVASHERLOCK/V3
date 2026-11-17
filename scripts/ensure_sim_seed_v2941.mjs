/** Bolt-safe Node-only simulated dataset unpack. Does not overwrite edited CSV files. */
import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';
const ROOT=process.cwd(),archive=path.join(ROOT,'seed_archive'),target=path.join(ROOT,'seed_simulated');
if(!fs.existsSync(archive))throw Error('Missing seed_archive; upload complete V2.9.41 source');
fs.mkdirSync(target,{recursive:true});let unpacked=0;
for(const file of fs.readdirSync(archive).filter(x=>x.endsWith('.csv.gz'))){const name=file.slice(0,-3),dest=path.join(target,name);if(fs.existsSync(dest))continue;const raw=gunzipSync(fs.readFileSync(path.join(archive,file)));fs.writeFileSync(dest,raw);unpacked++;}
console.log('SIMULATED data archive verified; restored missing CSV tables:',unpacked);
