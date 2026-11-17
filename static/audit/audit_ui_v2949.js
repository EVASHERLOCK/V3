/* V2.9.49 single three-entry presentation contract across 14 iframe pages. */
(function(global){'use strict';
 const entries=Object.freeze([
  {id:'formula',label:'∑ 本模块公式 / 分析依据'},
  {id:'sources',label:'▤ 展开全量计算依据和来源表'},
  {id:'excel',label:'↓ Excel 含真实公式'}
 ]);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function decisionControls(){return entries.map(e=>e.id==='excel'?`<a data-audit="excel" download>${e.label}</a>`:`<button type="button" data-audit="${e.id}">${e.label}</button>`).join('');}
 function executionControls(code,key){const url=`workbooks/${escape(code)}_${escape(key)}.xlsx`;return entries.map(e=>e.id==='formula'?`<button class="btn sm" type="button" data-action="lineage" data-module="${escape(key)}">${e.label}</button>`:e.id==='sources'?`<button class="btn sm" type="button" data-action="fold" data-module="${escape(key)}">${e.label}</button>`:`<a class="btn success" href="${url}" download>${e.label}</a>`).join('');}
 global.PHARMA_AUDIT_UI=Object.freeze({version:'2.9.49',entries,decisionControls,executionControls});
})(window);
