/** V2.9.29 26-route component-level audit. A methodology match is never proof of a source-backed answer. */
import fs from 'node:fs';
import path from 'node:path';
import {resolveComponentLineage,COMPONENT_CONTRACTS} from '../component_lineage_v2929.mjs';
import {PAGE_METRIC_INDEX} from '../page_metric_manifest_v2923.mjs';
const root=process.cwd(),base=path.join(root,'docs','V2929_组件扫描基线.json');
if(!fs.existsSync(base))throw Error('缺少逐模块扫描基线');
const data=JSON.parse(fs.readFileSync(base,'utf8'));
if(data.routes?.length!==26||data.components?.length<200)throw Error('26页/200+组件清点不完整');
const esc=v=>'"'+String(v??'').replace(/"/g,'""').replace(/[\r\n]+/g,' ').slice(0,1700)+'"';
const records=data.components.map((c,i)=>{
 const n=c.ctx?.split('\n').slice(1,6)||[],r=resolveComponentLineage({route:c.route,title:c.title,component_id:c.id||`${c.route}.${i}`,group_title:'',figures:[],narratives:n,tables:c.tables?[{headers:(c.ctx?.split('\n')[1]||'').split('\t'),rows:[]}]:[],charts:c.svg?[{series:[{label:'可见图'}]}]:[]});
 return {route:c.route,id:c.id||`${c.route}.${i}`,title:c.title,kind:r.binding_status==='NO_BUSINESS_CALC_REQUIRED'?'纯操作/筛选控件':c.svg>0?'图表':c.tables>0?'表格':'KPI/叙述/业务面板',status:r.binding_status,contract:r.contracts.join(';'),metrics:r.metrics.join(';'),actions:r.actions.join(';'),source_status:r.metrics.length?'来源记录须按用户筛选/企业快照逐项校验':r.binding_status==='NO_BUSINESS_CALC_REQUIRED'?'不适用业务公式':'尚无正式来源',method:r.methods.join('；'),gap:r.binding_status==='NO_BUSINESS_CALC_REQUIRED'?'操作逻辑与筛选条件需要留痕':`算法匹配≠图上每个数字已核对；需比对原始来源行/范围/期间/版本，并审查未覆盖展示列`};
});
const status=records.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
const routes=data.routes.map(name=>({route:name,total:records.filter(x=>x.route===name).length,matched:records.filter(x=>x.route===name&&x.status==='DOMAIN_RULE_MATCH').length,no_calc:records.filter(x=>x.route===name&&x.status==='NO_BUSINESS_CALC_REQUIRED').length,unknown:records.filter(x=>x.route===name&&x.status==='NO_BUSINESS_FORMULA_MATCH').length}));
if(records.some(r=>r.status==='NO_BUSINESS_FORMULA_MATCH'))throw Error('未分类组件仍有 '+records.filter(r=>r.status==='NO_BUSINESS_FORMULA_MATCH').length+' 项');
if(Object.keys(PAGE_METRIC_INDEX).length<26)throw Error('路由指标目录没有覆盖26页');
if(COMPONENT_CONTRACTS.length<40)throw Error('业务公式与判断契约过少');
const csv=['页面,组件ID,标题,类型,绑定状态,规则契约,候选公式指标,候选分析规则,来源验证等级,计算或判断步骤,剩余需要验证的依据',...records.map(r=>[r.route,r.id,r.title,r.kind,r.status,r.contract,r.metrics,r.actions,r.source_status,r.method,r.gap].map(esc).join(','))].join('\n');
const summary=['# V2.9.29 逐模块业务计算 / 判断规则审计','',`- 扫描页面：${routes.length}（其中在当前隔离浏览器输入中实际渲染业务模块 ${routes.filter(r=>r.total).length} 页）`,`- 识别模块：${records.length}`,...Object.entries(status).map(([k,n])=>`- ${k}: ${n}`),`- 已登记业务方法契约：${COMPONENT_CONTRACTS.length}`,'','## 验收等级与限制','', '1. DOMAIN_RULE_MATCH 仅表示找到了该组件适用的计算与分析方法；不表示所有图表原始序列、每个显示数值均由ERP/QMS复算。','2. NO_BUSINESS_CALC_REQUIRED 为搜索/筛选/数据源管理等控件，无独立业务指标，不得套采购金额公式。','3. 组件证据 Excel 包含模块UI来源快照、已匹配公式、真实来源行（如有）、对账状态和逐段文字核验；缺乏来源则明示缺口。','4. 当前演示原站数据与已发布企业快照严格分开；当前环境没有用户企业生产API授权，不能声称全部数据真实。','','## 26 页盘点','', '|路由|扫描模块|业务方法匹配|纯操作|未分类|','|---|---:|---:|---:|---:|',...routes.map(x=>`|${x.route}|${x.total}|${x.matched}|${x.no_calc}|${x.unknown}|`),'','## 仍须正式业务数据验证','', '所有业务组件仍需要企业原始记录、筛选维度、币种和计量单位、有效期、图表序列、人员审批记录逐一核对。只在本地HTML或演示表里出现的数值，不能宣称已经完成正式来源验证。',''];
const out=path.join(root,'docs','V2929_逐模块公式判断覆盖扫描.csv');fs.writeFileSync(out,csv);fs.writeFileSync(path.join(root,'docs','V2929_全站逐模块公式判断验收.md'),summary.join('\n'));
console.log('PASS V2.9.29 component audit:',JSON.stringify({routes:routes.length,components:records.length,contracts:COMPONENT_CONTRACTS.length,levels:status}));
