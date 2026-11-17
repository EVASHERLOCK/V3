/**
 * V2.9.50: streaming real ERP/QMS CSV export audit.
 * Proof levels are deliberately separate: exported rows/count/PK/SHA != authenticated data origin.
 * Only an independently registered DATA_STEWARD signature can attest provenance.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {safeRef,canonical,sha256} from '../enterprise_acceptance_v2950.mjs';
const args=process.argv.slice(2),pick=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:null;
const root=path.resolve(pick('--bundle')||'enterprise_evidence_v2950');
const manifestPath=path.join(root,'source_manifest.json');
const result={version:'2.9.50',kind:'SOURCE_EXPORT_INTEGRITY',source:'NOT_CONNECTED',table_count:0,rows_total:0,verified_tables:0,status:'BLOCKED',tables:[],errors:[],test_data:false};
async function auditCSV(file,primaryKey){
 const stream=fs.createReadStream(file,{highWaterMark:128*1024}),hash=crypto.createHash('sha256'),decoder=new TextDecoder();
 let header=null,pkIndex=null,rows=0,cell='',row=[],mode='OUT',skipLF=false,seen=new Set();
 const putCell=()=>{row.push(cell);cell=''};
 const putRow=()=>{
  putCell();if(row.length===1&&row[0]===''){row=[];return}
  if(!header){header=row;if(new Set(header).size!==header.length)throw Error('duplicate CSV column heading');
   pkIndex=primaryKey.map(k=>header.indexOf(k));if(pkIndex.some(i=>i<0))throw Error('declared primary keys not present in CSV');
  }else{
   if(row.length!==header.length)throw Error('CSV column count mismatch at data row '+(rows+1));
   const ids=pkIndex.map(i=>row[i]);if(ids.some(x=>!String(x).trim()))throw Error('empty PK at data row '+(rows+1));
   const key=JSON.stringify(ids);if(seen.has(key))throw Error('duplicate primary key at data row '+(rows+1));seen.add(key);rows++;
  }
  row=[];
 };
 const feed=s=>{
  for(const c of s){
   if(skipLF){skipLF=false;if(c==='\n')continue}
   if(mode==='IN'){
    if(c==='"')mode='AFTER';else cell+=c;
   }else if(mode==='AFTER'){
    if(c==='"'){cell+='"';mode='IN'}
    else if(c===','){putCell();mode='OUT'}
    else if(c==='\n'||c==='\r'){putRow();mode='OUT';if(c==='\r')skipLF=true}
    else throw Error('unexpected character after CSV closing quote');
   }else if(c==='"'){if(cell!=='')throw Error('invalid CSV opening quote');mode='IN'}
   else if(c===',')putCell();
   else if(c==='\n'||c==='\r'){putRow();if(c==='\r')skipLF=true}
   else cell+=c;
  }
 };
 for await(const buf of stream){hash.update(buf);feed(decoder.decode(buf,{stream:true}))}
 feed(decoder.decode());if(mode==='IN')throw Error('unterminated CSV quote');
 if(row.length||cell)putRow();if(!header)throw Error('empty CSV header');
 return {row_count:rows,sha256:hash.digest('hex'),pk_unique:true,columns:header.length};
}
async function scan(table){
 const r={id:String(table.system)+'.'+String(table.name),rows:0,pk_unique:false,sha_match:false,count_match:false,full_scope:false,snapshot_match:false,errors:[]};
 try{
  for(const field of ['system','name','file','primary_key','sha256','snapshot_id','row_count','count_evidence'])if(table[field]===undefined)throw Error('missing '+field);
  if(!['ERP','QMS'].includes(table.system))throw Error('source system must be ERP or QMS');
  if(table.scope!=='FULL_TABLE'||table.limit!==undefined||table.offset!==undefined||table.filter)throw Error('full export required, no LIMIT/OFFSET/filter');
  if(!table.export_query||/\b(LIMIT|OFFSET|FETCH\s+FIRST|TOP\s*\d+)\b/i.test(table.export_query))throw Error('export query missing or explicitly truncated');r.full_scope=true;
  if(!Array.isArray(table.primary_key)||!table.primary_key.length||table.primary_key.some(x=>typeof x!=='string'||!x))throw Error('invalid primary key list');
  const fp=safeRef(root,table.file),data=await auditCSV(fp,table.primary_key);r.rows=data.row_count;r.pk_unique=data.pk_unique;r.columns=data.columns;
  r.sha_match=data.sha256===table.sha256;if(!r.sha_match)throw Error('CSV SHA256 changed after export');
  const count=table.count_evidence;r.snapshot_match=!!table.snapshot_id&&count.snapshot_id===table.snapshot_id;if(!r.snapshot_match)throw Error('count/export snapshot mismatch');
  if(count.system!==table.system||!count.query_ref||!count.query||!/count\s*\(/i.test(count.query))throw Error('independent COUNT query origin or SQL evidence missing');
  if(!Number.isSafeInteger(table.row_count)||table.row_count<0||!Number.isSafeInteger(count.result))throw Error('invalid expected count');
  r.count_match=table.row_count===r.rows&&count.result===r.rows;
  if(!r.count_match)throw Error(`declared ${table.row_count}, independent COUNT ${count.result}, exported ${r.rows}`);
 }catch(e){r.errors.push(String(e.message||e))}
 return {...r,status:r.errors.length?'BLOCKED':'STRUCTURAL_MATCH_AWAITING_DATA_STEWARD_SIGNATURE'};
}
if(fs.existsSync(manifestPath)){
 try{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(manifest.environment!=='ENTERPRISE'||manifest.data_type!=='REAL_ERP_QMS_EXPORT'||manifest.test_data===true)throw Error('manifest is demo/synthetic, not authorized enterprise data');
  if(!manifest.extracted_at||!manifest.environment_id||!manifest.dataset_version)throw Error('missing source environment/version/time');
  if(!Array.isArray(manifest.tables)||!manifest.tables.length)throw Error('no source tables');
  result.source='DECLARED_ENTERPRISE_EXPORT_NOT_YET_AUTHENTICATED';result.test_data=!!manifest.test_data;result.manifest_sha256=sha256(fs.readFileSync(manifestPath));
  const seen=new Set();for(const t of manifest.tables){const key=t.system+'.'+t.name;if(seen.has(key)){result.errors.push('duplicate source table '+key);continue}seen.add(key);const tr=await scan(t);result.tables.push(tr);result.rows_total+=tr.rows;if(!tr.errors.length)result.verified_tables++;else result.errors.push(key+': '+tr.errors.join('; '))}
  result.table_count=manifest.tables.length;
  const mappings=manifest.component_source_coverage||{};
  result.covered_component_ids=Object.keys(mappings).filter(k=>Array.isArray(mappings[k])&&mappings[k].length>0&&mappings[k].every(id=>seen.has(id)));
  const unsigned={...manifest};delete unsigned.steward_signature;
  result.source_manifest_payload_hash=sha256(canonical(unsigned));
  result.status=result.errors.length?'BLOCKED':'STRUCTURAL_MATCH_AWAITING_SIGNED_ORIGIN';
 }catch(e){result.errors.push(String(e.message||e));result.status='BLOCKED'}
}else result.errors.push('Missing real ERP/QMS source_manifest.json. Simulated/demo rows are not enterprise records.');
const file=pick('--out')||'docs/V2950_企业全量来源核验.json';fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');
console.log('V2950 streaming source:',result.status,'tables',result.verified_tables+'/'+result.table_count,'rows',result.rows_total,'errors',result.errors.length);
if(args.includes('--strict')&&result.status!=='APPROVED_ENTERPRISE_SOURCE')process.exitCode=2;
