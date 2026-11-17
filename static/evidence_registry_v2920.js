/* V2.9.20 shared read model. The two pages never maintain independent document
   existence decisions. No vendor approval is inferred from a document row. */
(()=>{'use strict';
const today=()=>new Date().toISOString().slice(0,10);
const dateDiff=(end,now)=>/^\d{4}-\d{2}-\d{2}$/.test(String(end||''))?Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(now+'T00:00:00Z'))/86400000):null;
const normalized=(d,managed=false)=>({
 id:String(d.id||d.doc_id||''),doc_id:String(d.id||d.doc_id||''),supplier_id:String(d.supplier_id||''),
 supplier_name:String(d.supplier_name||d.holder||d.supplier_id||''),site_id:String(d.site_id||''),material_id:String(d.material_id||''),
 type:String(d.type||'Other'),certificate_no:String(d.certificate_no||d.doc_id||d.id||d.version||''),holder:String(d.holder||d.supplier_name||d.supplier_id||''),
 issuer:String(d.issuer||'待核验'),market:String(d.market||'待判定'),version:String(d.version||'未登记'),
 effective:d.effective||null,expiry:d.expiry||null,status:String(d.status||'Unknown'),
 review_owner:String(d.review_owner||'QA/SQM 待分配'),change_control:d.change_control||null,
 related_products:Array.isArray(d.related_products)?d.related_products:[],origin:managed?'服务端受权限保护登记':'原站DEMO元数据',is_legacy:!managed,
 scopeVerified:false,approvedExternally:false,source_record:d
});
const getDocuments=(raw,server)=>{
 const base=(raw?.qualification?.documents||[]).map(d=>normalized(d,false));
 const named=new Map((raw?.master?.suppliers||[]).map(s=>[s.supplier_id,s.supplier_name]));
 return [...base,...(server?.documents||[]).map(d=>normalized(d,true))].map(d=>({...d,supplier_name:named.get(d.supplier_id)||d.supplier_name,days_to_expiry:dateDiff(d.expiry,today())}));
};
// Mapping is intentionally conservative: a CoA never satisfies a GMP requirement.
function evidenceMatches(document,required){const t=document?.type||'',s=String(required||'');
 const match=[
  [/CEP/i,/^CEP$/i],[/EU GMP|EudraGMDP/i,/^GMP Certificate$/i],[/FDA FEI|EIR/i,/^Inspection Report$/i],
  [/DMF/i,/^DMF$/i],[/CDE|NMPA/i,/^CDE Registration$|^NMPA Filing$/i],
  [/质量协议|技术协议/i,/^Quality Agreement$/i],[/现场审计|审计报告/i,/^Site Audit Report$/i],
  [/CoA|批次放行/i,/^CoA$/i],[/Specification|物料规格/i,/^Specification$/i],
  [/Change Control|变更控制/i,/^Change Control$|^Change Notification$/i],
  [/CAPA|8D/i,/^CAPA$|^Site Audit Report$/i],
  [/ISO/i,/^ISO Certificate$/i]
 ];
 return match.some(([a,b])=>a.test(s)&&b.test(t));
}
function assessRequirement(name){const n=String(name||'');let owner='SQM / QA',level='重要',risk='缺少材料会影响供应商审核和质量证据闭环';
 if(/CEP|DMF|CDE|上市|注册|PMDA|TGA|原辅包|监管|EudraGMDP|FDA|LoA/i.test(n)){owner='RA / QA';level='关键';risk='可能导致目标市场注册路径不成立、上市产品变更评估延迟或准入暂停'}
 else if(/GMP|CoA|偏差|OOS|质量|批次|稳定性|召回|CAPA|8D|APR|PQR|检验|样品|试验|验证|Site Audit/i.test(n)){owner='SQM / QA / QC';level='关键';risk='不能完成质量适用性确认、来料放行或 CAPA 有效性验证'}
 else if(/技术|图纸|BOM|PFD|PFMEA|工艺|SOP|CPK|设备|模具|专利/i.test(n)){owner='研发 / 工艺 / QC';level='重要';risk='NPI 的工艺适配、技术风险或量产可靠性无法证明'}
 else if(/营业执照|ISO|进出口|反贿赂|出口管制|信用|许可/i.test(n)){owner='采购 / SQM / 法务';level='重要';risk='企业身份、体系认证或贸易合规基础证据不足'}
 else if(/合同|协议|NDA|报价|保密/i.test(n)){owner='采购 / 法务 / SQM';level='重要';risk='权利义务、定价与质量责任未形成受控约定'};
 if(/（适用）|适用/i.test(n)){risk+='；是否适用须由责任部门判定，不默认强制';}
 return {owner,level,risk};}
const chooseRecord=(docs,requirement,supplier,site,material)=>{
 const relevant=docs.filter(d=>d.supplier_id===supplier&&d.material_id===material&&(!site||site==='all'||!d.site_id||d.site_id===site)&&evidenceMatches(d,requirement));
 return relevant.sort((a,b)=>Number(b.status==='Valid')-Number(a.status==='Valid')||String(b.expiry||'').localeCompare(String(a.expiry||'')))[0]||null;
};
const getLineage=(key,rows,params={})=>{
 const now=today(),docs=rows,valid=d=>d.status==='Valid'&&d.days_to_expiry!=null&&d.days_to_expiry>=0;
 const spec={
 documents:{name:'受控文件数',expression:'COUNT(当前筛选范围的唯一文件登记ID)',rows:docs,where:'由 qualification.documents 与授权登记文件合并、按登记ID去重',result:docs.length,source:'原站 DEMO + 受权限保护的服务端数据'},
 valid:{name:'登记有效文件数',expression:'COUNT(status=Valid AND expiry≥今天)',rows:docs,where:'仅本地登记状态；不是官方网站验证',result:docs.filter(valid).length},
 coverage:{name:'文件有效率（登记口径）',expression:'登记有效文件数 ÷ 范围内文件登记总数 × 100%',rows:docs,where:'有效=状态Valid且未过期；无文件时显示无数据，不计作100%',result:docs.length?100*docs.filter(valid).length/docs.length:null},
 expired:{name:'已到期文件',expression:'COUNT(expiry < 今天)',rows:docs.filter(d=>d.days_to_expiry!=null&&d.days_to_expiry<0),where:`基准日期 ${now}`,result:docs.filter(d=>d.days_to_expiry!=null&&d.days_to_expiry<0).length},
 within30:{name:'30天内到期',expression:'COUNT(0 ≤ expiry−今天 ≤ 30)',rows:docs.filter(d=>d.days_to_expiry!=null&&d.days_to_expiry>=0&&d.days_to_expiry<=30),where:`基准日期 ${now}`,result:docs.filter(d=>d.days_to_expiry!=null&&d.days_to_expiry>=0&&d.days_to_expiry<=30).length},
 within90:{name:'90天内到期（不含30天内）',expression:'COUNT(30 < expiry−今天 ≤ 90)',rows:docs.filter(d=>d.days_to_expiry!=null&&d.days_to_expiry>30&&d.days_to_expiry<=90),where:`基准日期 ${now}`,result:docs.filter(d=>d.days_to_expiry!=null&&d.days_to_expiry>30&&d.days_to_expiry<=90).length},
 risk:{name:'需优先处理的登记风险',expression:'COUNT(已过期 OR 作废 OR 退回)；不等于监管官方高风险结论',rows:docs.filter(d=>(d.days_to_expiry!=null&&d.days_to_expiry<0)||['void','Expired','returned'].includes(d.status)),where:'基于文件登记日期、内部状态触发的提醒',result:docs.filter(d=>(d.days_to_expiry!=null&&d.days_to_expiry<0)||['void','Expired','returned'].includes(d.status)).length},
 }[key];
 if(!spec)return null;
 return {...spec,metric_key:key,rows:spec.rows.map(d=>({document_id:d.id,supplier_id:d.supplier_id,site_id:d.site_id,material_id:d.material_id,type:d.type,status:d.status,expiry:d.expiry||'未知',remaining_days:d.days_to_expiry,record_source:d.origin})),reason:`筛选后的 ${docs.length} 条文件登记参与统计；对 ${spec.rows.length} 条符合条件的记录执行 ${spec.expression}。此结果只说明登记数据状态，不是监管批准，也未验证证书真实性。`,limits:'其他真实合规结论需要 QA/RA 审核、对应附件和官方来源证据。'};
};
window.PharmaEvidenceRegistry={getDocuments,evidenceMatches,assessRequirement,chooseRecord,getLineage};
})();
