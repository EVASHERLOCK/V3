/* V2.9.16: compliance workflow domain. Non-GxP prototype. All state transitions
 * validated server-side; no automatic ERP / ASL approval or electronic signatures.
 */
export const FLOW={high:['procurement','sqm','ra','qa'],medium:['procurement','sqm','qa'],low:['procurement','sqm']};
export const ROLE_NAME={procurement:'采购初审',sqm:'SQM 供应商质量审核',ra:'RA 法规事务审核',qa:'QA 质量放行',admin:'系统管理员'};
export const STATUS={draft:'草稿',in_review:'审批中',returned:'已退回',review_complete:'内部审核完成（非正式ASL）',void:'已作废'};
export const MARKET_RULES={
 EU:{label:'欧盟 EU',checks:['CEP 证书或适用 ASMF/其他药学资料路径','EU GMP 合规证据 / EudraGMDP 查询','上市许可及活性物质来源变更影响评估'],notice:'CEP 并非所有原料药的通用强制要求；由 RA 按产品、API、适用法规决定路径。'},
 US:{label:'美国 US',checks:['适用时 DMF + LoA / 其他申报资料','生产厂址注册及 FDA 检查/合规信息评估','上市申请对该物料的引用与变更评估'],notice:'DMF 备案不代表 FDA 批准；检查合规状况不等同于获准供应。'},
 CN:{label:'中国 CN',checks:['CDE 原辅包登记 / 关联审评适用性','药品生产许可与 GMP 符合性检查记录','药品上市许可关联审评与变更影响评估'],notice:'中国自2019-12-01起不再签发旧式药品 GMP 认证证书。'},
 OTHER:{label:'其他市场',checks:['市场本地监管及贸易许可','产品与厂址适用性','RA 签核的市场准入差距清单'],notice:'按 PMDA/TGA 等目标市场独立检查。'}
};
export function riskFlow({category='API',type='',market=''}={}){const t=String(type).toUpperCase();const c=String(category).toUpperCase();return /API|CEP|DMF|GMP|REGULATORY|AUDIT/.test(c+' '+t)?'high':/EXCIPIENT|PACK|辅料|包材/.test(c+' '+t)?'medium':'low'}
export function nextStep(doc){const flow=FLOW[doc.risk||'high']||FLOW.high;return flow[doc.next_index||0]||null}
export function transition(doc,action,{actor,role,comment='',now=new Date().toISOString(),payload={}}){
 if(!doc||typeof doc!=='object'||!actor||!role)throw Error('无效文件或审批身份');
 const d=structuredClone(doc),old=d.status;
 const workflow=FLOW[d.risk]||FLOW.high;
 const history=d.history||[];
 const push=(kind,extra={})=>history.push({kind,actor,role,at:now,comment:String(comment).slice(0,1000),before:old,after:d.status,...extra});
 if(action==='submit'||action==='resubmit'){
  if(role!=='procurement')throw Error('仅采购角色可提交或重新提交');
  if(!['draft','returned'].includes(d.status))throw Error('仅草稿或已退回状态可提交');
  if(!d.supplier_id||!d.site_id||!d.material_id||!d.type||!d.certificate_no)throw Error('缺少供应商/厂址/物料/文件类型/证书编号');
  d.status='in_review';d.next_index=0;d.submitted_at=now;push(action,{step:workflow[0]});
 }else if(action==='approve'){
  if(d.status!=='in_review')throw Error('文件不在审批状态');
  if(role!==workflow[d.next_index||0])throw Error(`仅当前节点 ${ROLE_NAME[workflow[d.next_index||0]]} 可审核`);
  d.next_index=(d.next_index||0)+1;
  d.status=d.next_index===workflow.length?'review_complete':'in_review';
  push('approve',{step:role});
 }else if(action==='return'){
  if(d.status!=='in_review'||!workflow.includes(role))throw Error('非有效审核节点不能退回');
  if(role!==workflow[d.next_index||0])throw Error('只有当前节点可退回');
  if(!comment.trim())throw Error('退回必须填写理由');
  d.returns=(d.returns||0)+1;d.status='returned';d.next_index=0;push('return',{step:role});
 }else if(action==='revise'){
  if(role!=='procurement'||!['draft','returned','review_complete'].includes(d.status))throw Error('不允许该角色或状态升版');
  if(!payload.version||!payload.reason)throw Error('升版必须包含版本号和变更理由');
  if(payload.version===d.version)throw Error('新版本号不能相同');
  const previous={version:d.version,effective:d.effective||null,superseded_at:now,reason:payload.reason,locked:true};
  d.versions=[...(d.versions||[]),previous];d.version=String(payload.version).slice(0,64);d.status='draft';d.next_index=0;
  d.change_control={id:`CC-${now.slice(0,10).replaceAll('-','')}-${String(d.versions.length).padStart(3,'0')}`,reason:String(payload.reason).slice(0,500),state:'待影响评估',validation:'待制定验证方案',planned_effective:payload.planned_effective||null};
  push('revise',{previous_version:previous.version,change_control:d.change_control.id});
 }else if(action==='void'){
  if(!['qa','admin'].includes(role))throw Error('仅 QA 或系统管理员可作废');
  if(d.status==='void')throw Error('已作废不可重复作废');
  if(!comment.trim())throw Error('作废必须填写理由');d.status='void';d.voided_at=now;d.block_new_po=true;push('void');
 }else throw Error('不支持的文件动作');
 d.updated_at=now;d.history=history;
 d.purchase_authorized=false; // always deny until separately validated GxP/ERP integration
 return d;
}
export function screening(doc,asof=new Date().toISOString().slice(0,10)){
 const expired=!!doc?.expiry && doc.expiry<asof;
 const evidence=doc?.status==='review_complete'&&!expired&&!doc?.voided_at;
 return {status:doc?.status||'missing',expired,internal_review_done:evidence,asl:'未正式准入',purchase_blocked:true,reason:expired?'证书过期需复核':!evidence?'证据或审批未完成':'需正式 QMS/ERP/ASL 授权，不能仅凭内部审批下单'};
}
export function escalation(task,asof=new Date().toISOString().slice(0,10)){
 const overdue=Math.max(0,Math.floor((Date.parse(asof)-Date.parse(task.due))/86400000));
 const level=overdue>=30?3:overdue>=15?2:overdue>=7?1:0;
 return {...task,overdue_days:overdue,escalation_level:level,notify_level:['未升级','采购对接人','采购负责人 + SQM 负责人','供应链总监 + QA 负责人'][level],suggest_freeze:level===3,closed:task.verification==='passed'};
}
export function auditHash(previous,event){const stable=JSON.stringify({prev_hash:previous||'GENESIS',event});return stable}
export function defaultDossier(s){return {supplier_id:s.supplier_id,supplier_name:s.supplier_name,site_id:s.site_id||s.site||'待核验',material_id:s.material_id,provenance:s.data_origin||'SCENARIO',fields:{},documents:{},updated_at:null};}
