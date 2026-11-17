/* Browser-local preliminary text inspection for selectable-text PDFs.
   Supports uncompressed/FlateDecode and ASCII85+Flate streams for common PDFs.
   No OCR, no certificate authentication, no electronic signature verification.
   Sensitive files remain in the browser. */
(()=>{'use strict';
const MAX=12*1024*1024;
function stringLiterals(s){let out=[],stack=0,escape=false,start=0,buf='';
 for(let i=0;i<s.length;i++){const c=s[i];if(stack){if(escape){buf+=({'n':'\n','r':'\r','t':'\t'}[c]||c);escape=false;continue}if(c==='\\'){escape=true;continue}if(c==='('){stack++;buf+=c;continue}if(c===')'){stack--;if(stack===0){if(buf.trim())out.push(buf);buf='';continue}}buf+=c}else if(c==='('){stack=1;start=i;buf=''}}return out}
function decodeA85(input){let str=input.replace(/^\s*<~/,'').replace(/~>.*$/s,'').replace(/\s+/g,'');let out=[],grp=[];for(const c of str){if(c==='z'&&!grp.length){out.push(0,0,0,0);continue}let n=c.charCodeAt(0)-33;if(n<0||n>84)continue;grp.push(n);if(grp.length===5){let value=grp.reduce((x,n)=>x*85+n,0)>>>0;out.push((value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255);grp=[]}}if(grp.length){const count=grp.length;while(grp.length<5)grp.push(84);let value=grp.reduce((x,n)=>x*85+n,0)>>>0;for(let k=0;k<count-1;k++)out.push((value>>>(24-8*k))&255)}return Uint8Array.from(out)}
async function inflate(bytes){if(!('DecompressionStream'in window))throw Error('此浏览器不能解析压缩 PDF');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer())}
async function inspect(file){if(!file?.name?.toLowerCase().endsWith('.pdf'))throw Error('仅接受 PDF');if(file.size>MAX)throw Error('PDF 文件超过 12 MB');const bytes=new Uint8Array(await file.arrayBuffer());const raw=new TextDecoder('latin1').decode(bytes);if(!raw.startsWith('%PDF-'))throw Error('无效 PDF 文件头');if(/\/Encrypt\s+\d+\s+\d+\s+R/.test(raw))throw Error('加密 PDF 无法读取');
 let chunks=[];const streamRe=/([\s\S]{0,1000}?)\bstream\r?\n([\s\S]*?)\r?\nendstream/g;let m;while((m=streamRe.exec(raw))&&chunks.length<350){let head=m[1],data=m[2],text='';try{let a=Uint8Array.from(data,c=>c.charCodeAt(0)&255);if(/\/ASCII85Decode/.test(head))a=decodeA85(data);if(/\/FlateDecode/.test(head))a=await inflate(a);text=new TextDecoder('latin1').decode(a)}catch{continue}if(/\bBT\b[\s\S]*?\bET\b/.test(text))chunks.push(text)}
 let extract=(src)=>{let out=[];for(const b of src.match(/\bBT\b[\s\S]*?\bET\b/g)||[]){for(const str of stringLiterals(b)){if(str.length>2)out.push(str.replace(/\\[0-7]{3}/g,''))}for(const hex of b.match(/<[0-9a-fA-F]{4,}>/g)||[]){let t=hex.slice(1,-1),v='';if(t.startsWith('FEFF')){for(let i=4;i+3<t.length;i+=4){let cp=parseInt(t.slice(i,i+4),16);if(cp>31)v+=String.fromCharCode(cp)}}else for(let i=0;i+1<t.length;i+=2)v+=String.fromCharCode(parseInt(t.slice(i,i+2),16));if(v.trim().length>2)out.push(v)}}return out.join('\n')};
 let content=chunks.map(extract).filter(Boolean).join('\n'),pages=(raw.match(/\/Type\s*\/Page\b/g)||[]).length;
 if(!content.trim())content=extract(raw);
 const keywords=['certificate of analysis','coa','gmp','cep','dmf','asmf','manufacturer','manufacturing site','address','expiry','expires','retest','quality agreement','specification','nitrosamine'].filter(k=>content.toLowerCase().includes(k));
 const dates=[...new Set(content.match(/\b20\d{2}[-/.][01]?\d[-/.][0-3]?\d\b|\b[0-3]?\d[-/.][01]?\d[-/.]20\d{2}\b/g)||[])].slice(0,30);
 const certs=[...new Set(content.match(/(?:R\d{2}-)?CEP\s*\d{4}[-\s]\d{2,5}(?:\s*Rev\s*\d{1,2})?/gi)||[])].slice(0,25);
 return {filename:file.name,pages,extractable:content.trim().length>20,excerpt:content.slice(0,5000),text:content.slice(0,150000),keywords,date_candidates:dates,certificate_candidates:certs,engine:'browser-local limited parser; no OCR',note:'此结果仅提取可选文本线索；可能漏读嵌入字体/扫描页。必须由 QA/SQM 验证原件与来源。'};
}
function compare(a,b){let lines=s=>[...new Set(s.text.split(/[\r\n]+/).map(x=>x.trim()).filter(x=>x.length>=6))];let before=new Set(lines(a)),after=new Set(lines(b));return {removed:[...before].filter(x=>!after.has(x)).slice(0,35),added:[...after].filter(x=>!before.has(x)).slice(0,35),same:before.size-[...before].filter(x=>!after.has(x)).length,requires_human_review:true};}
window.PharmaPDF={inspect,compare};
})();
