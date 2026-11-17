/** V2.9.48 offline static-publish formula workbook. All formula cells are Excel
 * formulas, not precomputed numbers. SIMULATED scope only, not enterprise DB. */
import {downloadXlsx} from '/engine/browser_xlsx_v2939.mjs';
const excelCol=n=>{let out='';for(let i=n;i>0;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out};
const isNumeric=v=>v!==undefined&&v!==null&&v!==''&&Number.isFinite(Number(v));
function createTabs(model,records,filters,asof,module){
 const columns=[...model.columns,...model.derived],fields=columns.map(c=>c.key),ref=Object.fromEntries(fields.map((k,i)=>[k,excelCol(i+3)])),raw=new Map(model.columns.map(c=>[c.key,c]));
 function formulaForDerived(d,row){
  const names=[...d.formula.matchAll(/\{([a-zA-Z_][a-zA-Z_0-9]*)\}/g)].map(m=>m[1]);
  const convert=(key)=>{const addr=ref[key]+row;if(!ref[key])throw Error('未登记字段 '+key);return raw.get(key)?.kind==='date'?`IFERROR(DATE(VALUE(LEFT(${addr},4)),VALUE(MID(${addr},6,2)),VALUE(MID(${addr},9,2))),0)`:addr};
  const base=d.formula.replace(/\{([a-zA-Z_][a-zA-Z_0-9]*)\}/g,(_,k)=>convert(k)).replace(/^=/,'');
  const required=names.filter(k=>raw.has(k)).map(k=>`ISBLANK(${ref[k]}${row})`);
  return required.length?`IF(OR(${required.join(',')}),"",${base})`:base;
 }
 const input=[['来源文件','源记录ID',...fields]];
 for(let i=0;i<records.length;i++){
  const r=records[i],row=i+2;
  input.push([r.source_file||model.site_contract?.source||'SIMULATED_SEED',r.source_id||'',...fields.map(k=>{
   const der=model.derived.find(d=>d.key===k);
   if(der)return {formula:formulaForDerived(der,row)};
   if(r[k]===undefined||r[k]===null||r[k]==='')return '';
   return raw.get(k)?.kind==='number'&&isNumeric(r[k])?Number(r[k]):r[k];
  })]);
 }
 const address=(key)=>ref[key]?`'原始来源与派生'!${ref[key]}2:${ref[key]}${Math.max(2,records.length+1)}`:null;
 const metrics=[['指标键','指标','网页结果','Excel即时重算公式','变量/计算口径','证据状态']];
 for(const m of model.metrics){
  const range=address(m.field),denom=address(m.denom_field),cond=address(m.condition_field);
  const complete=records.length>0&&(m.op==='count'||(range&&records.every(r=>isNumeric(r[m.field]))));
  let formula=null;
  if(complete){
   if(m.op==='count')formula=`COUNTA('原始来源与派生'!B2:B${records.length+1})`;
   else if(m.op==='sum')formula=`SUM(${range})`;
   else if(m.op==='sumif'&&cond&&records.every(r=>isNumeric(r[m.condition_field])))formula=`SUMIF(${cond},${Number(m.condition_value)===1?'1':'0'},${range})`;
   else if(m.op==='rate'||m.op==='avg')formula=`IFERROR(SUM(${range})/COUNT(${range}),"")`;
   else if(m.op==='ratio'&&denom&&records.every(r=>isNumeric(r[m.denom_field])))formula=`IFERROR(SUM(${range})/SUM(${denom}),"")`;
  }
  let value=null;
  if(records.length){
   const n=records.map(r=>Number(r[m.field]));
   if(m.op==='count')value=records.length;
   else if(complete&&m.op==='sum')value=n.reduce((a,b)=>a+b,0);
   else if(complete&&m.op==='sumif'&&records.every(r=>isNumeric(r[m.condition_field])))value=records.filter(r=>Number(r[m.condition_field])===Number(m.condition_value)).reduce((a,r)=>a+Number(r[m.field]),0);
   else if(complete&&(m.op==='rate'||m.op==='avg'))value=n.reduce((a,b)=>a+b,0)/n.length;
   else if(complete&&m.op==='ratio'&&records.every(r=>isNumeric(r[m.denom_field]))){const den=records.reduce((a,r)=>a+Number(r[m.denom_field]),0);value=den? n.reduce((a,b)=>a+b,0)/den:null;}
  }
  metrics.push([m.key,m.label,value??'待核验',formula?{formula}:'源记录或变量缺失，禁止填0',m.excel_formula||m.explain||'',formula?'SIMULATED_FORMULA':'NOT_VERIFIED']);
 }
 const compare=[['源记录ID','源工作表地址','变量键','网页快照值','Excel逐行公式返回值','同值检查（公式）','Excel具体单元格公式','字段定义']];
 for(let i=0;i<records.length;i++)for(const d of model.derived){const r=records[i],row=i+2,at=compare.length+1,c=ref[d.key]+row;
  compare.push([r.source_id||'',`原始来源与派生!${c}`,d.key,isNumeric(r[d.key])?Number(r[d.key]):'',{formula:`'原始来源与派生'!${c}`},{formula:`IF(OR(NOT(ISNUMBER(D${at})),NOT(ISNUMBER(E${at}))),"MISSING",IF(ABS(D${at}-E${at})<0.000001,"MATCH","DIFF"))`},'='+formulaForDerived(d,row),d.definition||'']);
 }
 const yyyy=Number(asof.slice(0,4)),mm=Number(asof.slice(5,7)),dd=Number(asof.slice(8,10));
 const params=[['参数','模拟值','定义'],['as_of',{formula:`DATE(${yyyy},${mm},${dd})`},'模拟快照日期，非企业批准日'],['price_tolerance',0.01,'报价差异容差 USD'],['ack_days',3,'供应商回签目标自然天'],['expiry_window',60,'到期窗口自然天']];
 const info=[['项目','说明'],['页面',model.title],['模块',module],['筛选',JSON.stringify(filters)],['来源表',model.site_contract?.source],['来源记录条数',records.length],['来源范围','静态网页内完整模拟快照；不等于企业数据库全量'],['记录唯一性',records.length===new Set(records.map(r=>r.source_id)).size?'当前快照主键去重':'当前快照主键重复，需复核'],['Excel计算状态','公式打开后由Excel重算；网页与Excel相等性须以公式重算结果实证'],['数据状态','SIMULATED / Non-GxP']];
 const dict=[['字段','名称','变量定义','来源','单位','来源覆盖状态'],...columns.map(c=>[c.key,c.label,c.definition||'',c.source||'',c.unit||'',records.length&&records.every(r=>r[c.key]!==null&&r[c.key]!==undefined&&r[c.key]!=='')?'当前快照无空值':'源数据缺失/无记录'])];
 const analysis=[['步骤','方法','逐步文字说明'],['1','来源定位',model.site_contract?.source||'seed_simulated'],['2','逐行复算',`按来源主键展开 ${records.length} 行，原始变量和派生变量逐格保留`],['3','变量完整性',`逐字段检查必需变量，缺值不能等同0，零分母返回空值`],['4','KPI计算',model.metrics.map(m=>m.label+': '+(m.excel_formula||m.explain||'待核实')).join('\n')],['5','切片/归因','供应商、物料、月份、项目筛选需与网页保持同一口径'],['6','业务结论',model.analyses.join('\n')],['7','限制','Excel打开后手动审查逐格比较结果；本静态版不是 ERP/QMS 的全数据库来源校验']];
 return [{name:'来源口径',rows:info},{name:'参数',rows:params},{name:'原始来源与派生',rows:input},{name:'网页Excel逐格对账',rows:compare},{name:'变量字典',rows:dict},{name:'指标计算',rows:metrics},{name:'文字分析步骤',rows:analysis}];
}
export function downloadExecutionFormulaWorkbook(model,records,filters,asof,module){
 if(!model?.columns||!Array.isArray(records))throw Error('找不到当前页面的来源数据');
 const tabs=createTabs(model,records,filters,asof,module);
 downloadXlsx(tabs,`Pharma_Execution_${model.id}_${module}_SIMULATED_REAL_FORMULAS.xlsx`);
 return {records:records.length,derived_formulas:records.length*model.derived.length,metric_formulas:model.metrics.length};
}
export {createTabs as buildExecutionFormulaTabs};
