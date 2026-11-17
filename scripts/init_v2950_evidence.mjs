/** Initialize 585 empty evidence slots. Never create a verified:true proof. */
import fs from 'node:fs';import path from 'node:path';
const args=process.argv.slice(2),dir=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'enterprise_evidence_v2950');
fs.mkdirSync(dir,{recursive:true});
const file=path.join(dir,'component_evidence.json');if(fs.existsSync(file))throw Error('Refusing to overwrite existing evidence');
const registry=JSON.parse(fs.readFileSync('docs/V2948_逐实际控件验收清单.json','utf8'));
fs.writeFileSync(file,JSON.stringify({version:'2.9.50',status:'UNVERIFIED_TEMPLATE',components:registry.components.map(x=>({id:x.id,route:x.route,evidence:{}}))},null,2)+'\n');
fs.writeFileSync(path.join(dir,'README_正式证据文件说明.txt'),[
 '该目录初始文件全部为待核验；任何条目都不能仅因为按钮可点击而标记正式 PASS。',
 'browser_report.json：运行 scripts/browser_v2950_live.py --scope all 在获授权的 HTTPS 企业部署环境采集；本地/离线报告不算正式证据。',
 'source_manifest.json：真实 ERP/QMS 完整导出 + 独立 COUNT 查询 + 同快照、主键和文件 SHA256；需要被登记数据负责人的 Ed25519 签名。',
 'component_evidence.json：585 条每项 12 个证据，字段必须含 verified=true, path, sha256；文件内容须有 component_id, field, verified=true, method, provenance, recorded_at。',
 'business_signoffs.json：至少数据负责人和业务负责人两个不同受信任签名，签核内容绑定 browser/source/component 的哈希。',
 '不要把真实 ERP/QMS 数据、授权 Cookie、签名私钥、未脱敏截图或个人身份信息提交 GitHub / Bolt。'
].join('\n')+'\n');
console.log('Initialized',registry.components.length,'PENDING evidence slots in',dir);
