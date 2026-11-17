/** Generate an exact owner signoff payload ONLY after the non-signature gates pass. */
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileHash} from '../enterprise_acceptance_v2950.mjs';
const args=process.argv.slice(2),pick=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const dir=path.resolve(pick('--bundle')||'enterprise_evidence_v2950'),trusted=pick('--trusted-signers')||process.env.PHARMA_TRUSTED_SIGNERS_PATH;
const result=spawnSync(process.execPath,['scripts/check_v2950_enterprise.mjs','--bundle',dir,'--out','docs/V2950_第三层正式业务验收报告.json',...(trusted?['--trusted-signers',trusted]:[])],{encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr||result.stdout);
const gate=JSON.parse(fs.readFileSync('docs/V2950_第三层正式业务验收报告.json','utf8'));
const pending=Object.entries(gate.checks).filter(([name,value])=>name!=='separate_signatures_data_steward_business_owner'&&!value.ok).map(([name])=>name);
if(pending.length)throw Error('Cannot sign incomplete evidence. Remaining non-signature gates: '+pending.join(', '));
const get=x=>JSON.parse(fs.readFileSync(path.join(dir,x),'utf8'));
const browser=get('browser_report.json'),source=get('source_manifest.json');
const payload={inventory_sha256:fileHash('docs/V2948_逐实际控件验收清单.json'),browser_report_sha256:fileHash(path.join(dir,'browser_report.json')),source_manifest_sha256:fileHash(path.join(dir,'source_manifest.json')),component_evidence_sha256:fileHash(path.join(dir,'component_evidence.json')),decision:'APPROVE_ENTERPRISE_BUSINESS_ACCEPTANCE',scope:'ALL_585_COMPONENTS',version:'2.9.50',deployment_url:browser.url,dataset_version:source.dataset_version};
const output=path.join(dir,'business_signoff_payload.json');if(fs.existsSync(output))throw Error('Refusing to overwrite already prepared signoff payload');
fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n',{flag:'wx'});
console.log('Ready for data steward and business owner independent review and Ed25519 signature:',output);
