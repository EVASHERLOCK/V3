const fs=require('fs'),vm=require('vm');
const context={window:{DecompressionStream},TextDecoder,Blob,DecompressionStream,Response,Uint8Array,Error,Set};
vm.createContext(context);vm.runInContext(fs.readFileSync('static/pdf_inspector.js','utf8'),context);
(async()=>{let buf=fs.readFileSync('samples/test_certificate.pdf');let input={name:'test_certificate.pdf',size:buf.length,arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.length)};const x=await context.window.PharmaPDF.inspect(input);console.log('PDF test',x.pages,x.extractable,x.certificate_candidates,x.excerpt.slice(0,100));if(!x.extractable)process.exitCode=1})().catch(e=>{console.error(e);process.exitCode=1});
