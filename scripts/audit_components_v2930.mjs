/** 26-route, 242 legacy module snapshot evidence audit. Does not forge ERP/QMS.
 * Core distinction: algorithm mapping != source recomputation != displayed-value
 * verification. Use live posted component reconciliation for actual browser runs.
 */
import fs from 'node:fs';import path from 'node:path';
import {resolveComponentLineage} from '../component_lineage_v2929.mjs';
import {metricReport} from '../metric_registry_v2921.mjs';
import {auditMetricSource} from '../component_reconciliation_v2930.mjs';
import {enterpriseAnalysis} from '../enterprise_v08.mjs';import {sourcingFacts} from '../sourcing_domain_v2921.mjs';
const src=path.resolve('docs/V2929_组件扫描基线.json'),inv=JSON.parse(fs.readFileSync(src,'utf8'));
const scope={supplier:'all',material:'all',year:'all',as_of:'2026-11-09'};
const facts=sourcingFacts(enterpriseAnalysis({}),{filters:scope});
const cache=new Map();function auditMetric(id){if(cache.has(id))return cache.get(id);const report=metricReport(id,{scope});const r=auditMetricSource(report,{facts,scope,enterprise:false,snapshot:'V08_DEMO'});cache.set(id,r);return r;}
const output=inv.components.map((c,i)=>{
 const lines=(c.ctx||'').split('\n'),r=resolveComponentLineage({route:c.route,title:c.title,component_id:c.id||c.route+'.'+i,narratives:lines.slice(1,6),tables:c.tables?[{headers:(lines[1]||'').split('\t'),rows:[]}]:[],charts:c.svg?[{series:[{label:'SVG可见轴'}]}]:[]});
 const source=r.metrics.map(auditMetric),passed=source.filter(s=>s.status==='DEMO_SOURCE_RECOMPUTED').length;
 const status=r.binding_status==='NO_BUSINESS_CALC_REQUIRED'?'OPERATION_NOT_MEASURE':passed?'DEMO_SOURCE_ONLY_DISPLAY_UNVERIFIED':r.metrics.length?'INSUFFICIENT_VERIFIED_SOURCE':'METHOD_ONLY_UNVERIFIED';
 const gap=(c.svg?'SVG图表缺机器可读原始序列；':'')+(c.tables?'表格未提供源行主键及数据版本；':'')+(r.actions.length?'文字分析无企业调查闭环验证；':'')+'没有真实ERP/QMS凭据和同口径显示绑定；不得判定显示值已通过。';
 return {route:c.route,component_id:c.id||c.route+'.'+i,title:c.title,type:c.svg?'图表':c.tables?'表格':r.binding_status==='NO_BUSINESS_CALC_REQUIRED'?'操作面板':'KPI/文字',method_status:r.binding_status,
 metrics:r.metrics,actions:r.actions,source_independently_recomputed:passed,source_metric_total:r.metrics.length,
 displayed_value_verified:0,enterprise_source_verified:0,status,missing:gap,source_issues:source.filter(x=>x.status!=='DEMO_SOURCE_RECOMPUTED').map(x=>x.metric_id+':'+x.status).slice(0,20),record_origin:'2026-11-09 V2929 isolated DOM inventory + bundled V08 DEMO only; NOT live enterprise'};
});
const counts=output.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
const routeRows=inv.routes.map(route=>{const arr=output.filter(c=>c.route===route);return {route,components:arr.length,operations:arr.filter(x=>x.status==='OPERATION_NOT_MEASURE').length,demo_source_only:arr.filter(x=>x.status==='DEMO_SOURCE_ONLY_DISPLAY_UNVERIFIED').length,source_missing:arr.filter(x=>x.status==='INSUFFICIENT_VERIFIED_SOURCE').length,method_only:arr.filter(x=>x.status==='METHOD_ONLY_UNVERIFIED').length,enterprise_display_passed:0};});
const data={schema:'V2930_COMPONENT_RECON_INDEPENDENT_AUDIT',evidence:'V2.9.29 isolated visible component inventory + bundled V08 DEMO source records',scope,company_connection:'NOT_CONFIGURED',official_connection:'NOT_TESTED_THIS_STEP',counts,summary:{routes:routeRows.length,components:output.length,source_only_demo:output.filter(x=>x.source_independently_recomputed).length,strict_display_verified:0,enterprise_display_verified:0,metric_definitions_checked:cache.size,source_row_count:facts.purchaseOrders.length,source_spend:metricReport('SRC.PO.SPEND',{scope}).result},routes:routeRows,components:output};
const outdir=path.resolve('docs');fs.writeFileSync(path.join(outdir,'V2930_242模块严格来源对账.json'),JSON.stringify(data,null,2));
const esc=x=>'"'+String(x??'').replace(/"/g,'""').replace(/[\n\r]+/g,' ').slice(0,3000)+'"';
fs.writeFileSync(path.join(outdir,'V2930_242模块未验证清单.csv'),['页面,组件ID,标题,类型,当前等级,方法映射,指标清单,分析规则,原站DEMO独立复算指标数,候选指标数,显示严格对账通过数,企业ERP/QMS严格对账通过数,阻碍因素,缺失/错误来源',...output.map(x=>[x.route,x.component_id,x.title,x.type,x.status,x.method_status,x.metrics.join(';'),x.actions.join(';'),x.source_independently_recomputed,x.source_metric_total,x.displayed_value_verified,x.enterprise_source_verified,x.missing,x.source_issues.join(';')].map(esc).join(','))].join('\n'));
let md=['# V2.9.30 · 26 页 / 242 业务模块严格对账复核','',`检查模块 ${output.length}，26页；此扫描基于既有独立DOM快照，不是用户企业正在运行的Bolt。`,`原站DEM0 PO：${data.summary.source_row_count}行，采购金额 ${data.summary.source_spend} USD；不可视为企业正式订单。`,'','## 独立验收等级','',...Object.entries(counts).map(([k,v])=>`- ${k}: ${v} 模块`),'','**真实 ERP/QMS 显示数值严格通过：0 / 242。** 未取得企业正式来源，没有凭据，不会伪造通过记录。','', 'DEMO_SOURCE_ONLY_DISPLAY_UNVERIFIED：能独立核对至少一个全局DEMO来源指标，但未确认本图显示范围/币种/时间/版本，不能算图表已核对。','', '## 26 页统计','', '|路由|模块|操作模块|DEMO仅源复算|缺少独立源|仅方法|真实企业显示值通过|','|---|---:|---:|---:|---:|---:|---:|',...routeRows.map(r=>`|${r.route}|${r.components}|${r.operations}|${r.demo_source_only}|${r.source_missing}|${r.method_only}|${r.enterprise_display_passed}|`),'','## 必须补齐的证据','', '1. 为图表数据点输出原始来源行ID、完整分组原始序列、Supplier / Site / Material、期间、市场、币种和计量单位。','2. 企业平台须先使用授权只读API或受控CSV/XLSX导入真实ERP PO、QMS事件，以及BOM/报价/评分/文件/项目阶段。','3. 审核发布到不可变快照后，由后端独立重算；只有完全一致时显示已通过，否则列差异及来源行。','4. 旧图表的SVG/CSS标签不能代替原始图表数组；无法得到原始序列的必须保留为缺口。','5. 必须在真实Bolt或持久化服务器验证数据接入、发布、撤回与权限，不能以本地模拟结果冒充正式验收。',''];
fs.writeFileSync(path.join(outdir,'V2930_严格对账复核与未完成项.md'),md.join('\n'));
if(output.length<200||routeRows.length!==26)throw Error('Component inventory incomplete');
console.log('PASS strict v2930 audit: '+JSON.stringify(data.summary)+'; statuses '+JSON.stringify(counts));
