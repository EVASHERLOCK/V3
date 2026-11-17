/** V2.9.42 Excel – original simulated events and 115 *actual* recalculating formula cells.
 * No static KPI literals substituted for Excel formula results.
 */
import {createWorkbook} from './formula_workbook.mjs';
import {SIM_KPI_REGISTRY,simulatedExcelFormula} from './simulation_kpi_v2942.mjs';
const F=formula=>({formula});
const l=i=>{let s='';while(i){s=String.fromCharCode(65+(i-1)%26)+s;i=Math.floor((i-1)/26)}return s};
const c=(keys,k)=>l(keys.indexOf(k)+1);
function sheetRows(rows){const keys=Object.keys(rows[0]||{}),numericKeys=new Set(keys.filter(k=>rows.every(r=>r[k]===''||Number.isFinite(Number(r[k])))));return {keys,rows:[keys,...rows.map(r=>keys.map(k=>numericKeys.has(k)&&r[k]!==''?Number(r[k]):r[k]??''))]};}
export function exportSimulationDecisionWorkbook(module,src){
 if(!module.source_meta.source_boundary.startsWith('SIMULATED'))throw Error('Simulation workbook called without simulation source');
 const events=src.tables.simEvents||[], changes=src.tables.changes||[], docs=src.tables.docs||[];
 if(!events.length)throw Error('No matched simulated events: refusing empty spreadsheet');
 // V2.9.55: row-local helper formulas make exact distinct counts and absolute
 // forecast errors independently recalculable. SUMPRODUCT(array COUNTIF) was not
 // reliable in the offline calculation engine (ten KPI mismatches).
 const raw=sheetRows(events),rawKeys=raw.keys,helperSpecs=[
  ['helper_distinct_lot','lot_id'],['helper_distinct_product_line','product_line_id'],
  ['helper_distinct_material','material_id'],['helper_distinct_supplier','supplier_id'],
  ['helper_distinct_buyer','buyer_owner'],
  ['helper_high_material','material_id','high_material_risk'],
  ['helper_product_shortage','product_line_id','shortage_flag'],
  ['helper_single_material','material_id','single_source_material'],
  ['helper_high_supplier','supplier_id','high_supplier_risk'],
  ['helper_second_material','material_id','second_source_approved'],
  ['helper_financial_supplier','supplier_id','financial_risk'],
  ['helper_forecast_abs','forecast_qty','actual_qty']
 ];
 const excelCol=k=>{const index=rawKeys.indexOf(k)+1;if(!index)throw Error('Required KPI helper source missing: '+k);return l(index)};
 const helperFormula=(h,row)=>{
  const [_,key,flag]=h,letter=excelCol(key),cell=letter+row,base=`$${letter}$2:${letter}${row}`;
  if(h[0]==='helper_forecast_abs')return `ABS(${cell}-${excelCol(flag)}${row})`;
  if(!flag)return `IF(AND(${cell}<>"",COUNTIF(${base},${cell})=1),1,0)`;
  const fc=excelCol(flag),fcell=fc+row;
  return `IF(AND(${cell}<>"",${fcell}>0,COUNTIFS(${base},${cell},$${fc}$2:${fc}${row},">0")=1),1,0)`;
 };
 const data={keys:[...rawKeys,...helperSpecs.map(x=>x[0])],rows:[ [...rawKeys,...helperSpecs.map(x=>x[0])],...raw.rows.slice(1).map((r,i)=>[...r,...helperSpecs.map(h=>F(helperFormula(h,i+2)))])]};
 const N=events.length+1,idx=k=>c(data.keys,k),range=k=>`'模拟指标事件'!${idx(k)}2:${idx(k)}${N}`;
 const supplierIDs=[...new Set(events.map(x=>x.supplier_id))].sort();const countryIDs=[...new Set(events.map(x=>x.supplier_country))].sort();
 const moneyR=range('amount_usd'), supplierR=range('supplier_id'),countryR=range('supplier_country');
 const supplierRows=[['供应商ID','采购金额（SUMIF逐笔PO）','TOP5保留金额（公式）'],...supplierIDs.map((id,i)=>[id,F(`SUMIF(${supplierR},A${i+2},${moneyR})`),F(`IF(COUNTIF($B$2:$B$${supplierIDs.length+1},">"&B${i+2})+COUNTIF($B$2:B${i+2},B${i+2})<=5,B${i+2},0)`)])];
 const countryRows=[['供应商国家/地区','采购金额（SUMIF逐笔PO）'],...countryIDs.map((id,i)=>[id,F(`SUMIF(${countryR},A${i+2},${moneyR})`)])];
 const changesKeys=['change_id','supplier_id','material_id','project_id','status','risk_level','是否在途（公式）','是否高风险且在途（公式）'];
 const changeRows=[changesKeys,...changes.map((r,i)=>{const row=i+2;return [r.change_id,r.supplier_id,r.material_id,r.project_id,r.status,r.risk_level,F(`IF(OR(E${row}="Closed",E${row}="Completed",E${row}="Complete"),0,1)`),F(`IF(AND(G${row}=1,F${row}="High"),1,0)`)];})];
 const docRows=[['文件ID','类型','供应商','物料','项目','到期日ISO','90天内到期（公式）'],...docs.map((r,i)=>{const row=i+2;return [r.document_id,r.document_type,r.supplier_id,r.material_id,r.project_id,r.expiry_date,F(`IF(AND(B${row}="DOC-004",F${row}>='使用说明'!$B$6,F${row}<=TEXT(DATE(VALUE(LEFT('使用说明'!$B$6,4)),VALUE(MID('使用说明'!$B$6,6,2)),VALUE(RIGHT('使用说明'!$B$6,2)))+90,"yyyy-mm-dd")),1,0)`)];})];
 const sumChange= col=>`SUM('模拟变更'!${col}2:${col}${Math.max(2,changeRows.length)})`;
 const sumDocs=`SUM('模拟证照'!G2:G${Math.max(2,docRows.length)})`;
 const sumSup=`'供应商金额汇总'!B2:B${Math.max(2,supplierRows.length)}`;
 const sumCountry=`'地区金额汇总'!B2:B${Math.max(2,countryRows.length)}`;
 const ordered=module.metrics;
 const KPIrows=[['KPI-ID','Excel计算结果（真实公式）','Node模拟计算结果','单位','原指标名称','分子','分母','计算方法','原始来源','模拟限制与说明']];
 for(const m of ordered){const spec=SIM_KPI_REGISTRY.get(m.id);if(!spec)throw Error('KPI missing mapping '+m.id);let expr=simulatedExcelFormula(m.id,data.keys,events.length,module.scope);
  if(spec.type==='open_changes')expr=sumChange('G');
  if(spec.type==='high_risk_changes')expr=sumChange('H');
  if(spec.type==='cert_90_days')expr=sumDocs;
  const distinctHelper={
   'KPI-03-12':'helper_distinct_buyer','KPI-04-02':'helper_high_material',
   'KPI-05-01':'helper_distinct_lot','KPI-09-01':'helper_distinct_product_line',
   'KPI-09-03':'helper_product_shortage','KPI-09-04':'helper_single_material',
   'KPI-09-05':'helper_high_supplier','KPI-10-07':'helper_financial_supplier'
  };
  const helperSum=k=>`SUM(${range(k)})`;
  if(distinctHelper[m.id])expr=helperSum(distinctHelper[m.id]);
  if(m.id==='KPI-03-12')expr=`IFERROR(COUNTA(${range('event_id')})/${helperSum('helper_distinct_buyer')},0)`;
  if(m.id==='KPI-04-05')expr=`IFERROR(100*(1-${helperSum('helper_forecast_abs')}/SUM(${range('actual_qty')})),0)`;
  if(m.id==='KPI-09-06')expr=`IFERROR(100*${helperSum('helper_second_material')}/${helperSum('helper_distinct_material')},0)`;
  if(spec.type==='top_suppliers')expr=`IFERROR(100*SUM('供应商金额汇总'!C2:C${Math.max(2,supplierRows.length)})/SUM(${sumSup}),0)`;
  if(spec.type==='top_country')expr=`IFERROR(100*MAX(${sumCountry})/SUM(${sumCountry}),0)`;
  if(!expr)throw Error('KPI has no Excel formula '+m.id);
  KPIrows.push([m.id,F(expr),Number(m.value),m.unit,m.name,m.numerator,m.denominator,m.formula,m.evidence.source_table,'严格SIMULATED；财务、QA、RA旗标均为模拟。']);
 }
 const readme=[['V2.9.42 115项KPI公式和原始来源（模拟种子数据库）','非真实ERP/QMS/RA业务事实'],['计算版本','V2942-SIMULATED-115-KPI'],['数据边界',module.source_meta.source_boundary],['月份',module.scope.month],['供应商/物料/项目',`${module.scope.supplier} / ${module.scope.material} / ${module.scope.project}`],['检查日',module.scope.as_of],['所选原始PO/模拟事件行数',events.length],['KPI公式数量',KPIrows.length-1],['计算说明','每项KPI结果在“指标公式”B列使用Excel公式；C列是服务端独立计算供逐项核对。'],['注意','模拟批准/QA/RA/财务标记不能替代受控审批、证照核验或实际会计凭证。'],['维护','更改模拟指标事件原始单元格后Excel需重算；实际网站数据请经统一数据中心更新后再生成。']];
 const audit=[['检查项','结果','公式或说明'],['指标映射覆盖率',F("IFERROR(100*COUNTA('指标公式'!A2:A116)/115,0)"),'115项必须全部有Excel公式'],['模拟事件行数',F(`COUNTA('模拟指标事件'!${idx('event_id')}2:${idx('event_id')}${N})`),'与当前过滤后的PO行一致'],['模拟采购总额（USD）',F(`SUM(${moneyR})`),'与KPI-01-01的B列应一致'],['Excel与服务端模拟基线对账',F("IFERROR(ABS('指标公式'!B2-'指标公式'!C2),0)"),'打开Excel后自动重新计算']];
 return createWorkbook([
  {name:'使用说明',rows:readme,widths:[33,100]},
  {name:'指标公式',rows:KPIrows,widths:[21,24,24,20,42,23,23,75,25,62]},
  {name:'模拟指标事件',rows:data.rows,widths:data.keys.map((k,i)=>i<6?22:19)},
  {name:'模拟变更',rows:changeRows,widths:[24,23,23,23,20,20,24,26]},
  {name:'模拟证照',rows:docRows,widths:[25,20,22,22,22,22,25]},
  {name:'供应商金额汇总',rows:supplierRows,widths:[25,36]},
  {name:'地区金额汇总',rows:countryRows,widths:[30,36]},
  {name:'完整性和金额核验',rows:audit,widths:[40,35,95]},
  {name:'分析步骤与结论',rows:[['步骤/类型','内容'],...module.analysis_steps.map((s,i)=>[i+1,s]),...module.conclusions.map((s,i)=>['结论'+(i+1),s])],widths:[20,130]},
  {name:'逐项公式口径',rows:[['KPI-ID','指标名','模拟表达式','业务规范/字段要求','状态'],...ordered.map(m=>[m.id,m.name,m.formula,m.required_fields,'已计算 / 模拟'])],widths:[22,42,90,85,23]},
 ]);
}
