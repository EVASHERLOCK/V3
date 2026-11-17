/** Minimal standards-compliant XLSX writer for read-only static publication.
 * Original source values remain editable. Formula cells have no fake cached values;
 * Excel recalculates them on open. No network/CDN dependency. */
const enc=new TextEncoder();
const xml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const col=x=>{let r='';for(let n=x;n;n=Math.floor((n-1)/26))r=String.fromCharCode(65+(n-1)%26)+r;return r};
let crcTable;
function crc32(arr){crcTable??=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0});let c=0xffffffff;for(const b of arr)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function le(out,n,len){for(let i=0;i<len;i++)out.push((n>>>(8*i))&255)}
function pack(files){const all=[],dir=[];let at=0;for(const [name,content] of Object.entries(files)){
 const filename=enc.encode(name),bytes=enc.encode(content),crc=crc32(bytes);let head=[];le(head,0x04034b50,4);le(head,20,2);le(head,0,2);le(head,0,2);le(head,0,2);le(head,0,2);le(head,crc,4);le(head,bytes.length,4);le(head,bytes.length,4);le(head,filename.length,2);le(head,0,2);
 all.push(Uint8Array.from(head),filename,bytes);let cd=[];le(cd,0x02014b50,4);le(cd,20,2);le(cd,20,2);le(cd,0,2);le(cd,0,2);le(cd,0,2);le(cd,0,2);le(cd,crc,4);le(cd,bytes.length,4);le(cd,bytes.length,4);le(cd,filename.length,2);le(cd,0,2);le(cd,0,2);le(cd,0,2);le(cd,0,2);le(cd,0,4);le(cd,at,4);dir.push(Uint8Array.from(cd),filename);at+=head.length+filename.length+bytes.length;}
 let cdlen=dir.reduce((a,b)=>a+b.length,0),tail=[];le(tail,0x06054b50,4);le(tail,0,2);le(tail,0,2);le(tail,Object.keys(files).length,2);le(tail,Object.keys(files).length,2);le(tail,cdlen,4);le(tail,at,4);le(tail,0,2);
 const chunks=[...all,...dir,Uint8Array.from(tail)];const buf=new Uint8Array(chunks.reduce((a,b)=>a+b.length,0));let off=0;for(const part of chunks){buf.set(part,off);off+=part.length;}return buf;
}
function sheet(rows){let body=rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>{if(v==null||v==='')return '';const ref=col(j+1)+(i+1);
 if(typeof v==='object'&&'formula' in v)return `<c r="${ref}"><f>${xml(String(v.formula).replace(/^=/,''))}</f><v></v></c>`;
 if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"><v>${v}</v></c>`;
 return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('');
 return `<?xml version="1.0" encoding="utf-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;}
export function createXlsx(tabs){if(!tabs?.length)throw Error('No worksheets');const f={};
 f['[Content_Types].xml']=`<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tabs.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
 f['_rels/.rels']='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 f['xl/workbook.xml']=`<?xml version="1.0" encoding="utf-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabs.map((t,i)=>`<sheet name="${xml(t.name.slice(0,30))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
 f['xl/_rels/workbook.xml.rels']=`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tabs.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;
 tabs.forEach((t,i)=>f[`xl/worksheets/sheet${i+1}.xml`]=sheet(t.rows));
 return pack(f);
}
export const xlFormula=s=>({formula:s});
export function downloadXlsx(tabs,name='Pharma_Source_Formula.xlsx'){const blob=new Blob([createXlsx(tabs)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
export function sourceSheets(title,records,extra={}){
 const keys=[...new Set(records.flatMap(r=>Object.keys(r)))].slice(0,120),source=[keys,...records.map(r=>keys.map(k=>r[k]==null?'':typeof r[k]==='object'?JSON.stringify(r[k]):r[k]))];
 const inputs=[['项目','值'],['模块',title],['来源',extra.source||'主站 V2.9.38 DEMO 静态快照'],['筛选',JSON.stringify(extra.scope||{})],['原始记录数',records.length],['来源边界',extra.missing||'仅演示源；无法当作企业 ERP/QMS 记录']];
 const sums=[['字段','有效数值行数（Excel公式）','求和（Excel公式）','平均值（Excel公式）','核对说明']];
 for(let i=0;i<keys.length;i++){const c=col(i+1),end=Math.max(2,records.length+1);sums.push([keys[i],xlFormula(`COUNT('原始来源记录'!${c}2:${c}${end})`),xlFormula(`SUM('原始来源记录'!${c}2:${c}${end})`),xlFormula(`IFERROR(AVERAGE('原始来源记录'!${c}2:${c}${end}),"")`),'数值列才适用；文本列为空/0不可解释为真实指标']);}
 return [{name:'范围与口径',rows:inputs},{name:'原始来源记录',rows:source},{name:'来源核对公式',rows:sums}];
}
