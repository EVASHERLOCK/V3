import fs from 'node:fs';
import {buildAuditCatalog} from '../audit_registry_v2949.mjs';
const target='static/audit/metric_catalog_v2949.json';const contents=JSON.stringify(buildAuditCatalog(),null,2)+'\n';
if(process.argv.includes('--check')){
 if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==contents)throw Error('Metric catalog not synchronized: run node scripts/generate_v2949_audit_catalog.mjs and review the diff');
 console.log('V2949 canonical audit catalog consistent:',JSON.parse(contents).metric_count,'definitions');
}else{fs.writeFileSync(target,contents);console.log('Generated',target,JSON.parse(contents).metric_count,'metric contracts');}
