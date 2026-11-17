/** V2.9.26: evidence-controlled supplemental enterprise domains.
 * No synthetic records, no implicit GMP/CEP/ASL approval, no fallback to DEMO.
 * An analytical reviewer may release a source snapshot, not a QMS e-signature.
 */
import {createWorkbook} from './formula_workbook.mjs';

const REQUIRE=['bom','stages','scores','documents','quotes'];
const pattern=/^[A-Za-z0-9_.:/-]{1,120}$/;
const id=(v,k)=>{if(typeof v!=='string'||!pattern.test(v))throw Error(`${k}: nonempty stable ID required`);return v};
const label=(v,k)=>{if(typeof v!=='string'||!v.trim()||v.length>160)throw Error(`${k}: nonempty label required`);return v.trim()};
const date=(v,k)=>{if(typeof v!=='string'||!/^\d{4}-\d\d-\d\d$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error(`${k}: invalid ISO date`);return v};
const money=(v,k,{positive=false}={})=>{if(v==null||v==='')throw Error(`${k}: missing numeric input`);const n=Number(v);if(!Number.isFinite(n)||n<0||(positive&&n<=0))throw Error(`${k}: nonnegative numeric input required`);return n};
const state=(v,valid,k)=>{const x=label(v,k).toUpperCase();if(!valid.includes(x))throw Error(`${k}: unsupported state ${x}`);return x};
const mandatory=x=>({id:id(x.id,'id'),supplier_id:id(x.supplier_id,'supplier_id'),material_id:id(x.material_id,'material_id')});
const site=x=>id(x.site_id,'site_id');
const currency=x=>{if(x.currency!=='USD')throw Error('Currency must be explicitly normalized to USD with upstream FX evidence');};
const documented=x=>id(x.evidence_ref,'evidence_ref');
const append=(o,i,k)=>({...o,source_row:`ENTERPRISE.${k}[${i}]`,source_class:'ENTERPRISE_REVIEWED_ANALYTICS_NON_GXP'});
const mapping={
 bom:(x,i)=>{currency(x);const b=mandatory(x),q=money(x.qty,'qty',{positive:true}),t=money(x.target_unit_usd,'target_unit_usd'),v=money(x.quoted_unit_usd,'quoted_unit_usd');return append({...b,id:id(x.id,'id'),category:label(x.category,'category'),site_id:site(x),qty:q,target_unit_usd:t,quoted_unit_usd:v,target_total_usd:q*t,quoted_total_usd:q*v,variance_usd:q*(v-t),as_of:date(x.as_of,'as_of'),evidence_ref:documented(x)},i,'bom');},
 stages:(x,i)=>{const b=mandatory(x),st=state(x.status,['NOT_STARTED','IN_PROGRESS','DONE','BLOCKED'],'status'),start=date(x.start_date,'start_date'),end=date(x.end_date,'end_date');if(start>end)throw Error('stage end before start');return append({...b,id:id(x.id,'id'),project_id:id(x.project_id,'project_id'),site_id:site(x),stage:label(x.stage,'stage'),start_date:start,end_date:end,status:st,evidence_ref:documented(x),approved_for_GxP:false},i,'stages');},
 scores:(x,i)=>{const b=mandatory(x),dimension=['quality','delivery','technical','compliance','commercial'];const w={};let total=0;for(const k of dimension){w[k]=money(x.weights?.[k],`weights.${k}`);total+=w[k];}if(Math.abs(total-100)>0.0001)throw Error('supplier score weights must sum to exactly 100%');const r={...b,id:id(x.id,'id'),site_id:site(x),weights:w,evidence_ref:documented(x)};for(const k of dimension){r[k]=money(x[k],k);if(r[k]>100)throw Error(`${k} score >100`);}r.weighted_score=Math.round(dimension.reduce((a,k)=>a+r[k]*w[k]/100,0)*1e4)/1e4;return append(r,i,'scores');},
 documents:(x,i)=>{const b=mandatory(x);return append({...b,id:id(x.id,'id'),site_id:site(x),document_type:label(x.document_type,'document_type'),market:label(x.market,'market'),expiry_date:date(x.expiry_date,'expiry_date'),review_status:state(x.review_status,['PENDING','REVIEWED','REJECTED','SUPERSEDED','VOID'],'review_status'),evidence_ref:documented(x),asl_approved:false,gmp_approved:false},i,'documents');},
 quotes:(x,i)=>{currency(x);const b=mandatory(x);return append({...b,id:id(x.id,'id'),site_id:site(x),quote_date:date(x.quote_date,'quote_date'),unit_price_usd:money(x.unit_price_usd,'unit_price_usd',{positive:true}),moq:money(x.moq,'moq',{positive:true}),freight_usd:money(x.freight_usd,'freight_usd'),review_status:state(x.review_status,['RECEIVED','REVIEWED','REJECTED','EXPIRED'],'review_status'),evidence_ref:documented(x)},i,'quotes');}
};
export const DOMAIN_NAMES=Object.freeze(REQUIRE);
export function mapEnterpriseDomains(payload={}){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('enterprise_domains must be object');
 for(const k of Object.keys(payload))if(!REQUIRE.includes(k))throw Error(`Unknown enterprise evidence domain: ${k}`);
 const out={};for(const key of REQUIRE){const raw=payload[key]??[];if(!Array.isArray(raw)||raw.length>10000)throw Error(`${key}: too many or invalid rows`);
  const ids=new Set();out[key]=raw.map((r,i)=>{if(!r||typeof r!=='object'||Array.isArray(r))throw Error(`${key}[${i}]: invalid record`);const m=mapping[key](r,i);if(ids.has(m.id))throw Error(`duplicate ${key} id ${m.id}`);ids.add(m.id);return m;});}
 return out;
}
export const emptyEnterpriseDomains=()=>Object.fromEntries(REQUIRE.map(k=>[k,[]]));
export function domainsForScope(released,scope={}){const src=released?.domains||{};const result={};for(const k of REQUIRE){result[k]=(src[k]||[]).filter(r=>(!scope.supplier||scope.supplier==='all'||scope.supplier===r.supplier_id)&&(!scope.material||scope.material==='all'||scope.material===r.material_id)&&(!scope.year||scope.year==='all'||String(r.as_of||r.start_date||r.quote_date||'').startsWith(scope.year)));}return result;}
const dec=(n,precision=4)=>Math.round(n*10**precision)/10**precision;
const sum=(rows,k)=>rows.reduce((s,r)=>s+Number(r[k]||0),0);
const defs={
 'SRC.BOM.LINE_COUNT':['已核对 BOM 行数','行','COUNT(BOM line ID)','bom'],
 'SRC.BOM.TARGET_TOTAL':['BOM 目标成本（范围合计）','USD','SUM(BOM.qty × target_unit_usd)','bom'],
 'SRC.BOM.QUOTED_TOTAL':['BOM 报价成本（范围合计）','USD','SUM(BOM.qty × quoted_unit_usd)','bom'],
 'SRC.BOM.VARIANCE':['BOM 报价相对目标价差','USD','SUM(BOM.qty × (quoted_unit_usd−target_unit_usd))','bom'],
 'SRC.BOM.VARIANCE_RATE':['BOM 相对目标价差率','%','100×SUM(quoted−target)/SUM(target)','bom'],
 'SRC.PROJECT.STAGES':['寻源阶段登记数量','阶段','COUNT(stage ID)','stages'],
 'SRC.PROJECT.DONE':['来源标记已完成阶段数','阶段','COUNTIF(source_status=DONE)','stages'],
 'SRC.PROJECT.PROGRESS':['寻源阶段完成率（未加权）','%','100×标记DONE阶段数/有来源阶段总数','stages'],
 'SRC.PROJECT.BLOCKED':['来源阻塞阶段数','阶段','COUNTIF(status=BLOCKED)','stages'],
 'SRC.SCORE.REVIEWS':['有证据评分记录数','项','COUNT(review ID)','scores'],
 'SRC.SCORE.WEIGHTED_MEAN':['供应商加权能力均分','分','AVG(∑维度分×维度权重/100)','scores'],
 'SRC.SCORE.TOP':['最高有证据供应商加权分','分','MAX(∑维度分×维度权重/100)','scores'],
 'SRC.EVIDENCE.DOCUMENTS':['厂址×物料文件登记数量','份','COUNT(evidence ID)','documents'],
 'SRC.EVIDENCE.REVIEWED_VALID':['来源审核且未过期文件数','份','COUNT(review_status=REVIEWED AND expiry_date≥as_of)','documents'],
 'SRC.EVIDENCE.REGISTERED_VALID_RATE':['已登记文件审核有效率（非市场资格覆盖率）','%','100×有效已审核文件数/已登记文件数','documents'],
 'SRC.EVIDENCE.EXPIRED':['过期文件数量','份','COUNT(expiry_date<as_of)','documents'],
 'SRC.EVIDENCE.DUE30':['未来30天到期文件数','份','COUNT(as_of≤expiry_date≤as_of+30日)','documents'],
 'SRC.RFQ.RECORDS':['供应商报价登记数','份','COUNT(quote ID)','quotes'],
 'SRC.RFQ.BEST_UNIT':['最低来源报价单价','USD/kg','MIN(unit_price_usd)（同币种和同物料才可比）','quotes'],
 'SRC.RFQ.AVG_UNIT':['来源报价平均单价（等权）','USD/kg','SUM(unit_price_usd)/COUNT(quote ID)','quotes']
};
export const DOMAIN_METRICS=Object.freeze(Object.fromEntries(Object.entries(defs).map(([id,[label,unit,formula,domain]])=>[id,{label,unit,formula,type:'enterprise_domain',domain,description:'使用受控来源行重算；不代表独立GxP认证、ASL准入或批准'}])));
function metricMissing(id,scope,message){const d=DOMAIN_METRICS[id];return {id,metric_id:id,label:d.label,unit:d.unit,formula:d.formula,weights:[],source_class:'NO_SOURCE',source_release:null,scope,status:'INSUFFICIENT_SOURCE',result:null,numerator:null,denominator:null,rows:[],inputs:[],thresholds:[],missing:[message],explanation:'该分析域未提供可验证数据，不使用DEMO、推测或0填补。'};}
export function enterpriseDomainMetric(id,{scope={},factsOverride=null}={}){
 const def=DOMAIN_METRICS[id];if(!def)return null;const raw=factsOverride?.enterprise_domains;
 if(!raw)return metricMissing(id,scope,'需要经审核发布的企业扩展证据域，V08 DEMO不能充当厂址/物料质量证据。');
 const rows=raw[def.domain]||[];
 if(!rows.length)return metricMissing(id,scope,`已发布快照缺少 ${def.domain} 来源行，或当前过滤范围内无匹配证据。`);
 const as_of=scope.as_of||new Date().toISOString().slice(0,10);
 const r={id,metric_id:id,label:def.label,unit:def.unit,formula:def.formula,weights:[],source_class:'ENTERPRISE_RELEASED_NON_GXP',source_release:factsOverride.scope?.source_release||null,scope,status:'ENTERPRISE_RECOMPUTABLE_NON_GXP',result:null,numerator:null,denominator:null,rows:rows.map(x=>({...x})),inputs:[],thresholds:[],missing:[],explanation:`源域 ${def.domain}，登记 ${rows.length} 行，按供应商、厂址、物料及当前筛选范围重算；非GxP认证或审批。`};
 const count=rows.length, n=()=>r.numerator;
 if(id==='SRC.BOM.LINE_COUNT'||id==='SRC.PROJECT.STAGES'||id==='SRC.SCORE.REVIEWS'||id==='SRC.EVIDENCE.DOCUMENTS'||id==='SRC.RFQ.RECORDS')r.numerator=count;
 if(id==='SRC.BOM.TARGET_TOTAL')r.numerator=sum(rows,'target_total_usd');
 if(id==='SRC.BOM.QUOTED_TOTAL')r.numerator=sum(rows,'quoted_total_usd');
 if(id==='SRC.BOM.VARIANCE'||id==='SRC.BOM.VARIANCE_RATE'){r.numerator=sum(rows,'variance_usd');if(id.endsWith('RATE'))r.denominator=sum(rows,'target_total_usd');}
 if(id==='SRC.PROJECT.DONE'||id==='SRC.PROJECT.PROGRESS'){r.numerator=rows.filter(x=>x.status==='DONE').length;if(id.endsWith('PROGRESS'))r.denominator=count;}
 if(id==='SRC.PROJECT.BLOCKED')r.numerator=rows.filter(x=>x.status==='BLOCKED').length;
 if(id==='SRC.SCORE.WEIGHTED_MEAN'){r.numerator=sum(rows,'weighted_score');r.denominator=count;r.weights=rows.slice(0,20).flatMap(x=>Object.entries(x.weights).map(([dimension,weight])=>({name:`${x.id}/${dimension}`,weight})));if(rows.length>20)r.explanation+=' 权重明细仅显示前20条；所有行的独立权重均在Excel和来源行中。';}
 if(id==='SRC.SCORE.TOP')r.numerator=Math.max(...rows.map(x=>x.weighted_score));
 if(id==='SRC.EVIDENCE.REVIEWED_VALID'||id==='SRC.EVIDENCE.REGISTERED_VALID_RATE'){r.numerator=rows.filter(x=>x.review_status==='REVIEWED'&&x.expiry_date>=as_of).length;if(id.endsWith('RATE'))r.denominator=count;}
 if(id==='SRC.EVIDENCE.EXPIRED')r.numerator=rows.filter(x=>x.expiry_date<as_of).length;
 if(id==='SRC.EVIDENCE.DUE30'){const limit=new Date(Date.parse(as_of+'T00:00:00Z')+30*86400000).toISOString().slice(0,10);r.numerator=rows.filter(x=>x.expiry_date>=as_of&&x.expiry_date<=limit).length;}
 if(id==='SRC.RFQ.BEST_UNIT')r.numerator=Math.min(...rows.map(x=>x.unit_price_usd));
 if(id==='SRC.RFQ.AVG_UNIT'){r.numerator=sum(rows,'unit_price_usd');r.denominator=count;}
 if(r.numerator==null)return metricMissing(id,scope,'指标计算程序不完整，禁止自行推断值');
 if(r.denominator!=null&&r.denominator<=0)return metricMissing(id,scope,'分母为零或缺失');
 r.result=dec(r.denominator!=null?r.numerator/r.denominator*(id.endsWith('RATE')||id.endsWith('PROGRESS')?100:1):r.numerator);
 return r;
}
export const DOMAINS_BY_ROUTE={
 'overview':['bom','stages','scores','documents','quotes'],
 'portfolio':['bom','quotes'],m01:['stages'],m06:['documents'],m02:['bom','quotes'],
 'ss-overview':['stages','scores'], 'ss-market':['quotes'],'ss-kraljic':['scores','bom'],
 'ss-ai':['scores','quotes'],'ss-cost':['bom','quotes'], 'ss-project':['stages','scores','documents'],
 'ss-performance':['scores','documents'], 'ss-compliance':['documents'], 'ss-technical':['documents','scores'],
 'ss-data':['documents'],m05:['stages'],m08:['quotes'],m09:['documents','stages'],
 m10:['scores'],documents:['documents'],regulatory:['documents'], workflow:['stages'],
 reports:['bom','scores'],access:['documents'],master:['documents'],alerts:['documents','stages']
};
const source=rows=>rows.map(x=>({...x}));
const groupBy=(rows,fn)=>{const m=new Map();for(const r of rows){const key=fn(r);if(!m.has(key))m.set(key,[]);m.get(key).push(r)}return m};
export function buildDomainVisuals(facts,route,scope={}){
 const domains=facts?.enterprise_domains||{},needed=DOMAINS_BY_ROUTE[route]||[];
 const panels=[],missing=[];const as_of=scope.as_of||new Date().toISOString().slice(0,10);
 for(const domain of needed){const rows=domains[domain]||[];
  if(!rows.length){missing.push({domain,status:'INSUFFICIENT_SOURCE',reason:`未发布 ${domain} 的来源明细；不可显示模拟的专用业务图。`});continue;}
  if(domain==='bom'){
   const groups=[...groupBy(rows,r=>r.material_id+'|'+r.supplier_id).entries()];
   for(const [key,r] of groups)panels.push({id:'bom_waterfall:'+key,kind:'bom_waterfall',title:'BOM 目标→供应商报价成本瀑布 · '+key,metric_id:'SRC.BOM.VARIANCE',formula:'∑(数量×报价单价)−∑(数量×研发目标单价)',status:'ENTERPRISE_RECOMPUTABLE_NON_GXP',points:r.map(x=>({label:x.category,reference:x.target_total_usd,actual:x.quoted_total_usd,value:x.variance_usd,source_breakdown:source([x])})),totals:{target:dec(sum(r,'target_total_usd')),actual:dec(sum(r,'quoted_total_usd'))},note:'只有提供真实 BOM 行和目标价才能显示此图。负值表示报价低于目标。'});
  }else if(domain==='stages'){
   for(const [key,r] of groupBy(rows,x=>x.project_id).entries())panels.push({id:'project_gantt:'+key,kind:'project_gantt',title:'寻源项目阶段甘特 · '+key,metric_id:'SRC.PROJECT.PROGRESS',formula:'完成率=COUNT(status=DONE)/COUNT(阶段)×100，时长=end-start+1天',points:r.sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(x=>({label:x.stage,start:x.start_date,end:x.end_date,status:x.status,value:x.status==='DONE'?1:0,source_breakdown:source([x])})),note:'只反映来源排程状态，不代表 QA/RA 签核或变更控制正式批准。'});
  }else if(domain==='scores'){
   panels.push({id:'supplier_score',kind:'score_matrix',title:'供应商五维能力加权评分（源证据）',metric_id:'SRC.SCORE.WEIGHTED_MEAN',formula:'质量×权重 + 交付×权重 + 技术×权重 + 合规×权重 + 商务×权重（权重合计100%）',points:rows.map(x=>({label:x.supplier_id+' / '+x.material_id,value:x.weighted_score,weights:x.weights,dimensions:{quality:x.quality,delivery:x.delivery,technical:x.technical,compliance:x.compliance,commercial:x.commercial},source_breakdown:source([x])})).sort((a,b)=>b.value-a.value),note:'评分依据必须有 evidence_ref；审核发布分析快照不是供应商正式资格批准。'});
  }else if(domain==='documents'){
   panels.push({id:'site_material_evidence',kind:'evidence_matrix',as_of,title:'Site × Material 文件证据状态与缺口',metric_id:'SRC.EVIDENCE.REGISTERED_VALID_RATE',formula:'审核有效率=100×COUNT(已复核且未过期的登记文件)/COUNT(全部登记文件)',points:rows.map(x=>({label:`${x.supplier_id} / ${x.site_id} / ${x.material_id} / ${x.document_type}`,value:x.review_status==='REVIEWED'&&x.expiry_date>=as_of?1:0,status:x.review_status,expiry_date:x.expiry_date,source_breakdown:source([x])})),note:'分母仅为已登记文件，不代表应备文件齐全率；未提供法规要求清单时不得推断市场准入。'});
  }else if(domain==='quotes'){
   const groups=groupBy(rows,x=>x.material_id);
   for(const [key,r] of groups)panels.push({id:'rfq_compare:'+key,kind:'rfq_compare',title:'同物料供应商来源报价 · '+key,metric_id:'SRC.RFQ.BEST_UNIT',formula:'比价基准=单价USD/kg，运费与MOQ单列（不同交易条件不得直接等同落地价）',points:r.map(x=>({label:x.supplier_id,value:x.unit_price_usd,moq:x.moq,freight:x.freight_usd,status:x.review_status,source_breakdown:source([x])})).sort((a,b)=>a.value-b.value),note:'报价未包含税费、运费分摊和质量验证成本；此图只比较同币种原始单价。'});
  }
 }
 return {panels,missing};
}
const F=v=>({formula:v});
const S=(name,names,rows)=>({name,rows:[[name],['NON-GxP released source · values and formula cells kept separate'],names,...rows]});
export function domainEvidenceSheets(facts,scope={}){
 const x=facts?.enterprise_domains||{},bo=x.bom||[],st=x.stages||[],sc=x.scores||[],dc=x.documents||[],qu=x.quotes||[],as_of=scope.as_of||new Date().toISOString().slice(0,10);
 const bom=bo.map((r,i)=>{const k=i+4;return [r.id,r.supplier_id,r.material_id,r.site_id,r.category,r.qty,r.target_unit_usd,r.quoted_unit_usd,F(`F${k}*G${k}`),F(`F${k}*H${k}`),F(`J${k}-I${k}`),r.evidence_ref];});
 const stages=st.map((r,i)=>{const k=i+4;return [r.id,r.project_id,r.stage,r.supplier_id,r.material_id,r.start_date,r.end_date,r.status,F(`IF(H${k}="DONE",1,0)`),r.evidence_ref];});
 const scores=sc.map((r,i)=>{const k=i+4;return [r.id,r.supplier_id,r.material_id,r.quality,r.delivery,r.technical,r.compliance,r.commercial,r.weights.quality,r.weights.delivery,r.weights.technical,r.weights.compliance,r.weights.commercial,F(`SUMPRODUCT(D${k}:H${k},I${k}:M${k})/100`),r.evidence_ref];});
 const docs=dc.map((r,i)=>{const k=i+4;return [r.id,r.supplier_id,r.site_id,r.material_id,r.document_type,r.market,r.expiry_date,r.review_status,F(`IF(AND(H${k}="REVIEWED",DATEVALUE(G${k})>=DATEVALUE('Evidence_Derived'!B4)),1,0)`),F(`IF(DATEVALUE(G${k})<DATEVALUE('Evidence_Derived'!B4),1,0)`),F(`IF(AND(DATEVALUE(G${k})>=DATEVALUE('Evidence_Derived'!B4),DATEVALUE(G${k})<=DATEVALUE('Evidence_Derived'!B5)),1,0)`),r.evidence_ref];});
 const quotes=qu.map(r=>[r.id,r.supplier_id,r.site_id,r.material_id,r.quote_date,r.unit_price_usd,r.moq,r.freight_usd,r.review_status,r.evidence_ref]);
 const end=rows=>Math.max(4,rows.length+3);
 const ed=end(docs),eB=end(bom),eS=end(stages),eSc=end(scores),eQ=end(qu);
 const detail=Object.keys(DOMAIN_METRICS).map((id,i)=>{const r=enterpriseDomainMetric(id,{scope,factsOverride:facts});const frm=id==='SRC.BOM.LINE_COUNT'?`COUNTA('Evidence_BOM'!A4:A${eB})`:id==='SRC.BOM.TARGET_TOTAL'?`SUM('Evidence_BOM'!I4:I${eB})`:id==='SRC.BOM.QUOTED_TOTAL'?`SUM('Evidence_BOM'!J4:J${eB})`:id==='SRC.BOM.VARIANCE'?`SUM('Evidence_BOM'!K4:K${eB})`:id==='SRC.BOM.VARIANCE_RATE'?`IFERROR(100*SUM('Evidence_BOM'!K4:K${eB})/SUM('Evidence_BOM'!I4:I${eB}),"")`:id==='SRC.PROJECT.STAGES'?`COUNTA('Evidence_Stages'!A4:A${eS})`:id==='SRC.PROJECT.DONE'?`SUM('Evidence_Stages'!I4:I${eS})`:id==='SRC.PROJECT.PROGRESS'?`IFERROR(100*SUM('Evidence_Stages'!I4:I${eS})/COUNTA('Evidence_Stages'!A4:A${eS}),"")`:id==='SRC.PROJECT.BLOCKED'?`COUNTIF('Evidence_Stages'!H4:H${eS},"BLOCKED")`:id==='SRC.SCORE.REVIEWS'?`COUNTA('Evidence_Scores'!A4:A${eSc})`:id==='SRC.SCORE.WEIGHTED_MEAN'?`IFERROR(AVERAGE('Evidence_Scores'!N4:N${eSc}),"")`:id==='SRC.SCORE.TOP'?`IFERROR(MAX('Evidence_Scores'!N4:N${eSc}),"")`:id==='SRC.EVIDENCE.DOCUMENTS'?`COUNTA('Evidence_Docs'!A4:A${ed})`:id==='SRC.EVIDENCE.REVIEWED_VALID'?`SUM('Evidence_Docs'!I4:I${ed})`:id==='SRC.EVIDENCE.REGISTERED_VALID_RATE'?`IFERROR(100*SUM('Evidence_Docs'!I4:I${ed})/COUNTA('Evidence_Docs'!A4:A${ed}),"")`:id==='SRC.EVIDENCE.EXPIRED'?`SUM('Evidence_Docs'!J4:J${ed})`:id==='SRC.EVIDENCE.DUE30'?`SUM('Evidence_Docs'!K4:K${ed})`:id==='SRC.RFQ.RECORDS'?`COUNTA('Evidence_RFQ'!A4:A${eQ})`:id==='SRC.RFQ.BEST_UNIT'?`IFERROR(MIN('Evidence_RFQ'!F4:F${eQ}),"")`:id==='SRC.RFQ.AVG_UNIT'?`IFERROR(AVERAGE('Evidence_RFQ'!F4:F${eQ}),"")`:'';return [id,r.label,r.status,r.result??'',r.rows.length&&frm?F(frm):'',r.formula,r.source_class];});
 const cut=new Date(Date.parse(as_of+'T00:00:00Z')+30*864e5).toISOString().slice(0,10);
 return [S('Evidence_Derived',['As_of','Value'],[['As_of',as_of],['Plus_30_days',cut]]),S('Evidence_BOM',['ID','Supplier','Material','Site','Category','Qty','TargetPrice','QuotePrice','TargetAmount','QuoteAmount','Variance','EvidenceRef'],bom),S('Evidence_Stages',['ID','Project','Stage','Supplier','Material','Start','End','Status','DoneFormula','EvidenceRef'],stages),S('Evidence_Scores',['ID','Supplier','Material','Q','D','T','Compliance','Commercial','W_Q','W_D','W_T','W_Compliance','W_Commercial','WeightedScoreFormula','EvidenceRef'],scores),S('Evidence_Docs',['ID','Supplier','Site','Material','Type','Market','Expiry','ReviewStatus','ValidFormula','ExpiredFormula','Due30Formula','EvidenceRef'],docs),S('Evidence_RFQ',['ID','Supplier','Site','Material','Date','PriceUSD','MOQ','FreightUSD','ReviewStatus','EvidenceRef'],quotes),S('Evidence_Metrics',['Metric_ID','Metric','Status','Server_result','Excel_formula','Definition','Source'],detail)];
}

export function exportDomainEvidenceWorkbook(facts,scope={}){return createWorkbook(domainEvidenceSheets(facts,scope))}
