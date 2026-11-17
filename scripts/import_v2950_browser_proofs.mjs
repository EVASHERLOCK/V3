/** Upgrade authorized real-browser tests to two evidence fields; NOT full business acceptance. */
import fs from 'node:fs';import path from 'node:path';
import {sha256,enterpriseBrowserReport} from '../enterprise_acceptance_v2950.mjs';
const args=process.argv.slice(2),get=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const dir=path.resolve(get('--bundle')||'enterprise_evidence_v2950'),browserPath=path.join(dir,'browser_report.json'),componentPath=path.join(dir,'component_evidence.json');
if(!fs.existsSync(browserPath)||!fs.existsSync(componentPath))throw Error('Need real deployed browser_report.json and initialized component_evidence.json in the same bundle');
const b=JSON.parse(fs.readFileSync(browserPath,'utf8')),c=JSON.parse(fs.readFileSync(componentPath,'utf8')),catalog=JSON.parse(fs.readFileSync('docs/V2948_逐实际控件验收清单.json','utf8')).components;
const summary=enterpriseBrowserReport(b,catalog);
if(!summary.production)throw Error('Only actual HTTPS enterprise deployment browser evidence can populate proof slots; local/offline tests prohibited.');
const by=new Map(c.components.map(x=>[x.id,x]));if(by.size!==585)throw Error('Not the 585-controlled inventory');
let injected=0;for(const r of b.components){if(r.status!=='CLICK_TESTED'||!r.formula?.ok||!r.sources?.ok||!r.excel?.ok||!(r.excel?.formula_cells>0))continue;
 const entry=by.get(r.id);if(!entry)throw Error('Unknown component id '+r.id);
 for(const field of ['click_formula','browser_e2e']){
  if(entry.evidence?.[field]?.verified)continue;
  const subpath=`browser_proofs/${encodeURIComponent(r.id)}.${field}.json`,target=path.join(dir,subpath);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const proof={component_id:r.id,field,verified:true,method:field==='click_formula'?'LIVE_BROWSER_PHYSICAL_CLICK':'CHROMIUM_URL_NAVIGATION_AND_THREE_ENTRIES_DOWNLOAD',provenance:{deployment_url:b.url,environment:b.environment,test_type:b.test_type,record_id:r.id,report_sha256:sha256(fs.readFileSync(browserPath)),download_sha256:r.excel.xlsx_sha256,formula_cells:r.excel.formula_cells},recorded_at:r.started_utc||b.started_utc};
  const bytes=JSON.stringify(proof,null,2)+'\n';if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')!==bytes)throw Error('Conflicting prior evidence: '+subpath);
  fs.writeFileSync(target,bytes);entry.evidence[field]={verified:true,path:subpath,sha256:sha256(bytes)};injected++;
 }
}
fs.writeFileSync(componentPath,JSON.stringify(c,null,2)+'\n');
console.log('Imported',injected,'individual browser proofs (two fields maximum per clicked component); 10 other fields and signatures remain separate.');
