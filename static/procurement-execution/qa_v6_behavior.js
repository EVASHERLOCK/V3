const fs=require('fs'),vm=require('vm'),path=require('path');
const base=__dirname;
const ids=['rfq','contracts','orders','shipments','invoices','payments','claims','closing','exceptions'];
const checks=[];
for(const id of ids){
 const nodes={};const get=(key)=>nodes[key]??(nodes[key]={innerHTML:'',textContent:'',open:false,tagName:'SECTION',querySelector:()=>null});
 const context={window:{},localStorage:{getItem:()=>null,setItem:()=>{}},document:{body:{dataset:{page:id}},readyState:'loading',addEventListener:()=>{},getElementById:get},console,setTimeout};
 vm.createContext(context);
 for(const name of ['data.js','biz_data.js'])vm.runInContext(fs.readFileSync(path.join(base,'assets',name),'utf8'),context);
 const src=fs.readFileSync(path.join(base,'assets','app.js'),'utf8').replace(/\}\)\(\);\s*$/,`globalThis.TEST={renderAll,focus:focusDocFilter,state:BIZSTATE,page:PAGE};})();`);
 vm.runInContext(src,context);
 context.TEST.renderAll();
 const html=get('panels').innerHTML;
 if(html.includes('全量演示数据 · 非 GxP 实绩'))throw Error(`${id}: old hero label still visible`);
 if(!html.includes('<section class="bizBlock bizWide docReceive" id="biz-doc-section">'))throw Error(`${id}: visible document section missing`);
 if(html.includes('<details class="bizBlock bizWide docReceive"'))throw Error(`${id}: entire document section still collapsed`);
 if(!html.includes('<details class="docActionsFold" id="biz-doc-actions"><summary>载入可直接体验的双版本示例'))throw Error(`${id}: folded demonstration section missing`);
 if(html.includes('<details class="docActionsFold" id="biz-doc-actions" open'))throw Error(`${id}: demonstration section should start collapsed`);
 const docStart=html.indexOf('id="biz-doc-section"');
 const readerStart=html.indexOf('id="biz-reader-current"');
 const oldStart=html.indexOf('id="biz-reader-old"');
 const locateStart=html.indexOf('id="biz-doc-filter"');
 const actionStart=html.indexOf('id="biz-doc-actions"');
 const buttonStart=html.indexOf('data-action="biz-example"');
 if(![docStart,readerStart,oldStart,locateStart,actionStart,buttonStart].every(x=>x>=0) || !(docStart<readerStart&&readerStart<oldStart&&oldStart<locateStart&&locateStart<actionStart&&actionStart<buttonStart))throw Error(`${id}: bad visible/folded hierarchy`);
 if(!get('biz-doc-result').innerHTML.includes('id="doc-extracted-fields"')||!get('biz-doc-result').innerHTML.includes('id="doc-diff-fields"'))throw Error(`${id}: extracted/diff reports lost`);
 context.TEST.state.docLocate='4';context.TEST.focus();
 if((get('biz-reader-current').innerHTML.match(/docSelected/g)||[]).length!==1 || (get('biz-reader-old').innerHTML.match(/docSelected/g)||[]).length!==1)throw Error(`${id}: locator broken`);
 if(id==='contracts'){
  if(!html.includes('<details class="sourceInline contractSourceFold" id="contract-source-fold">'))throw Error('contracts: source fold missing');
  if(html.includes('<details class="sourceInline contractSourceFold" id="contract-source-fold" open'))throw Error('contracts: source should start collapsed');
  if(!(html.indexOf('合同字段对比') < html.indexOf('id="contract-source-fold"')))throw Error('contracts: main comparison should be visible above source');
  if(!html.includes('workbooks/01_contract_fields_v4.xlsx'))throw Error('contracts: excel lost');
 }
 checks.push({page:id,mainDocument:'visible',demoActions:'collapsed',fieldJump:'both readers',contractSource:id==='contracts'?'collapsed':'N/A'});
}
console.log(JSON.stringify(checks,null,2));
