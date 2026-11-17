/* Host adapter only. Original 9 page business functions and document readers remain unchanged. */
(()=>{'use strict';
const page=document.body.dataset.page;
const contract=window.APP_DATA?.pages?.find(x=>x.id===page)?.site_contract||{};
window.__PE_SITE_SYNC={page,allowed_metrics:contract.supported_metrics||[],contract};
const slugs={rfq:'00_询价与报价比对.html',contracts:'01_合同核查.html',orders:'02_PO创建与比对.html',shipments:'03_发运与到货.html',invoices:'04_发票核对.html',payments:'05_付款与应付.html',claims:'06_退货与索赔.html',closing:'07_订单关闭与绩效.html',exceptions:'08_异常处理中心.html'};
const ids=Object.keys(slugs);
if(window.parent!==window){document.body.classList.add('site-embedded');}
const params=new URLSearchParams(location.search);
function sendHeight(){if(window.parent===window)return;try{parent.postMessage({type:'pharma-execution-height',height:document.documentElement.scrollHeight},location.origin)}catch{}}
function setScope(){const keys=['supplier','material','month','project'];for(const k of keys){const el=document.getElementById('filter-'+k);const value=params.get(k);if(value&&value!=='all'&&el&&[...el.options].some(o=>o.value===value)){el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}}}
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function banner(){const app=document.getElementById('app');if(!app)return;const notice=document.createElement('div');notice.className='pe-site-source-banner';notice.innerHTML=`<b>统一模拟业务链 · V2.9.49 · SIMULATED / Non-GxP</b><span>主站统一供应商 / 物料 / 项目关联；PO、RFQ候选报价、合同、GR/QC、发票、付款、索赔和异常均可按来源键追溯。${escape(contract.missing)}</span><a target="_parent" href="/#sim-center">统一模拟数据中心</a>`;
app.insertBefore(notice,app.firstChild);if(window.parent!==window){for(const x of document.querySelectorAll('.side,.topbar'))x.style.display='none';}sendHeight();}
// Keep original anchor/action, but route the nine page links within the main website.
document.addEventListener('click',event=>{const anchor=event.target.closest('a[href]');if(!anchor)return;const href=anchor.getAttribute('href')||'';
 if(href.startsWith('workbooks/')){event.preventDefault();event.stopImmediatePropagation();const filename=decodeURIComponent(href.split('/').pop()||'');const mod=filename.replace(/^\d\d_/,'').replace(/\.xlsx$/i,'');const keys=new URLSearchParams({page,module:mod,supplier:document.getElementById('filter-supplier')?.value||'all',material:document.getElementById('filter-material')?.value||'all',month:document.getElementById('filter-month')?.value||'all',project:document.getElementById('filter-project')?.value||'all'});
  const nodeAPI=window.parent!==window?window.parent.PHARMA_API_ORIGIN:window.PHARMA_API_ORIGIN;
  if(nodeAPI){location.assign(nodeAPI+'/api/procurement-execution/workbook.xlsx?'+keys);return;}
  // Static published mode: use the same per-row derived formulas and web/Excel
  // reconciliation semantics as the Node export, never value-only pseudo formulas.
  void import('/static/procurement-execution/assets/full_formula_xlsx_v2948.mjs').then(({downloadExecutionFormulaWorkbook})=>{
   const model=window.APP_DATA?.pages?.find(x=>x.id===page),filters=Object.fromEntries(keys);
   const match=r=>(filters.supplier==='all'||r.supplier===filters.supplier)&&(filters.material==='all'||r.material===filters.material)&&(filters.month==='all'||r.month===filters.month)&&(filters.project==='all'||r.project_id===filters.project);
   const records=(model?.rows||[]).filter(match);
   downloadExecutionFormulaWorkbook(model,records,filters,window.APP_DATA?.asof||'2026-11-11',mod);
  }).catch(e=>alert('静态公式工作簿生成失败：'+e.message));return;}
 if(window.parent!==window){let file;try{file=decodeURIComponent(new URL(href,location.href).pathname.split('/').pop())}catch{return;}const index=ids.findIndex(id=>slugs[id]===file);if(index>=0){event.preventDefault();event.stopImmediatePropagation();parent.postMessage({type:'pharma-execution-route',page:ids[index]},location.origin);}}},true);
document.addEventListener('change',event=>{const el=event.target;if(el&&['filter-supplier','filter-material','filter-month','filter-project'].includes(el.id)&&window.parent!==window){parent.postMessage({type:'pharma-execution-scope',field:el.id.replace('filter-',''),value:el.value},location.origin);sendHeight();}},true);
document.addEventListener('DOMContentLoaded',()=>{banner();setScope();sendHeight();if('ResizeObserver' in window){const o=new ResizeObserver(()=>sendHeight());o.observe(document.body);}else setTimeout(sendHeight,500);});
})();
