/** V2.9.35 workbook: every available KPI is an Excel formula over scoped source rows.
 * No fabricated enterprise sources and no precomputed values disguised as formulas.
 */
import {createWorkbook} from './formula_workbook.mjs';
import {exportSimulationDecisionWorkbook} from './simulation_workbook_v2942.mjs';
/** Use the already-tested dependency-free OOXML writer from the existing site.
 * It emits actual <f> formula cells and forces Excel to recalculate on open.
 * This avoids adding another server dependency to the Bolt build path.
 */
class LocalRow{constructor(sheet,i){this.sheet=sheet;this.i=i;this.font={};this.fill={};this.height=20;}getCell(n){if(typeof n==='string')n=Number(n);const self=this;return{get value(){return self.sheet.rows[self.i-1]?.[n-1]},set value(v){self.sheet.rows[self.i-1][n-1]=v},set numFmt(_) {}}}}
class LocalSheet{constructor(name){this.name=name;this.rows=[];this.cols={};this.pageSetup={};this.views=[];}
 addRow(values){this.rows.push([...values]);return new LocalRow(this,this.rows.length)}
 getRow(n){return new LocalRow(this,n)}
 getCell(r,c){if(typeof r==='string'){const m=/^([A-Z]+)([0-9]+)$/.exec(r);if(m){r=Number(m[2]);c=[...m[1]].reduce((a,k)=>a*26+k.charCodeAt(0)-64,0)}}return this.getRow(r).getCell(c)}
 get columnCount(){return Math.max(1,...this.rows.map(r=>r.length))}
 get columns(){return Array.from({length:this.columnCount},(_,i)=>this.getColumn(i+1))}
 getColumn(i){return this.cols[i]||(this.cols[i]={width:20})}
}
class LocalWorkbook{constructor(){this.sheets=[];this.calcProperties={};this.xlsx={writeBuffer:async()=>createWorkbook(this.sheets.map(sheet=>({name:sheet.name,rows:sheet.rows,widths:Array.from({length:sheet.columnCount},(_,i)=>sheet.getColumn(i+1).width||20)})))}}
 addWorksheet(name){const s=new LocalSheet(name);this.sheets.push(s);return s}}
const ExcelJS={Workbook:LocalWorkbook};
import {buildDecisionModule,buildDecisionExportFacts} from './decision_center_v2935.mjs';
const COLS={po:'原始_PO',qc:'原始_QC',production:'原始_生产',inventory:'原始_库存',changes:'原始_变更',suppliers:'原始_供应商',docs:'原始_文件',qms:'原始_QMS',links:'关联主键'};
const LETTER=n=>{let s='';for(;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};

const cell=(col,row)=>`${LETTER(col)}${row}`;
function format(ws){ws.getRow(1).font={name:'Microsoft YaHei',bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF15569C'}};ws.getRow(1).height=28;ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter={from:'A1',to:cell(ws.columnCount,1)};ws.columns.forEach(c=>{c.width=22});ws.pageSetup.fitToWidth=1;}
function prepareRows(model){const rows=Object.fromEntries(Object.entries(COLS).map(([k])=>[k,[...(model[k]||[])] ]));const qcByLot=new Map((model.full?.qc||rows.qc).map(x=>[x.lot_id,x]));const supById=new Map(rows.suppliers.map(x=>[x.supplier_id,x]));rows.production=rows.production.map(r=>({...r,linked_qc_status:qcByLot.get(r.lot_id)?.status||'',linked_qc_release_date:qcByLot.get(r.lot_id)?.release_date||''}));rows.changes=rows.changes.map(r=>({...r,source_risk_level:supById.get(r.supplier_id)?.risk_level||'未知'}));const poSet=new Set(rows.po.map(r=>r.po_id)),lotSet=new Set(rows.qc.map(r=>r.lot_id)),supSet=new Set(rows.suppliers.map(r=>r.supplier_id));rows.links=[...rows.po.map(r=>({from:r.po_id,to:r.supplier_id,link:'PO → supplier',ok:supSet.has(r.supplier_id)})),...rows.qc.map(r=>({from:r.lot_id,to:r.po_id,link:'QC → PO',ok:poSet.has(r.po_id)})),...rows.production.map(r=>({from:r.production_order,to:r.lot_id,link:'Production → QC',ok:lotSet.has(r.lot_id)})),...rows.changes.map(r=>({from:r.change_id,to:r.supplier_id,link:'Change → supplier',ok:supSet.has(r.supplier_id)}))];return rows;}
function sourceSheet(book,key,rows,asOf){
 const ws=book.addWorksheet(COLS[key]);const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];if(!keys.length)keys.push('no_source_records');const helpers=key==='po'?['f_spend','f_ppv','f_base','f_late','f_valid_delivery','f_ontime','f_valid_otif','f_otif','f_unique']:
 key==='production'?['f_ready']:key==='inventory'?['f_released_quantity','f_hold','f_batch_unique']:key==='changes'?['f_open','f_high_risk_open']:key==='docs'?['f_expiry90']:key==='qms'?['f_deviation','f_capa_valid','f_capa_ontime']:key==='links'?['f_join_ok']:[];
 ws.addRow([...keys,...helpers]);
 const idx=k=>keys.indexOf(k)+1,ref=(k,r)=>idx(k)?cell(idx(k),r):'""';
 const helperIndex=Object.fromEntries(helpers.map((h,i)=>[h,keys.length+i+1]));
 for(let i=0;i<rows.length;i++){
   const r=rows[i],n=i+2;const values=keys.map(k=>r[k]??'');ws.addRow([...values,...helpers.map(()=>null)]);
   const f=(k,formula)=>{ws.getCell(n,helperIndex[k]).value={formula, result:null}};
   if(key==='po'){
     const qty=ref('ordered_qty',n),unit=ref('unit_price',n),base=ref('benchmark_price',n),prom=ref('promised_date',n),recv=ref('receipt_date',n),rcvQty=ref('received_qty',n),id=ref('po_id',n);
     f('f_spend',`IF(AND(ISNUMBER(${qty}*1),ISNUMBER(${unit}*1),${qty}<>"",${unit}<>""),${qty}*${unit},0)`);
     f('f_ppv',`IF(AND(${qty}<>"",${unit}<>"",${base}<>""),(${unit}-${base})*${qty},0)`);
     f('f_base',`IF(AND(${qty}<>"",${base}<>""),${qty}*${base},0)`);
     f('f_late',`IF(AND(${prom}<>"",${recv}<>""),IF(${recv}>${prom},1,0),0)`);
     f('f_valid_delivery',`IF(AND(${prom}<>"",${recv}<>""),1,0)`);
     f('f_ontime',`IF(AND(${prom}<>"",${recv}<>""),IF(${recv}<=${prom},1,0),0)`);
     f('f_valid_otif',`IF(AND(${prom}<>"",${recv}<>"",${qty}<>"",${rcvQty}<>""),1,0)`);
     f('f_otif',`IF(AND(${prom}<>"",${recv}<>"",${qty}<>"",${rcvQty}<>""),IF(AND(${recv}<=${prom},${rcvQty}>=${qty}),1,0),0)`);
     f('f_unique',`IF(${id}="",0,IF(COUNTIF(${LETTER(idx('po_id'))}$2:${id},${id})=1,1,0))`);
   }
   if(key==='production'){const s=ref('linked_qc_status',n),release=ref('linked_qc_release_date',n),required=ref('required_date',n),allocated=ref('allocated_qty',n),need=ref('required_qty',n);f('f_ready',`IF(AND(${s}="Released",${release}<>"",${required}<>"",${release}<=${required},${allocated}>=${need}),1,0)`)}
   if(key==='inventory'){const status=ref('status',n),qty=ref('quantity',n),lot=ref('lot_id',n);f('f_released_quantity',`IF(${status}="Released",IF(${qty}="",0,${qty}*1),0)`);f('f_hold',`IF(${status}="Released",0,1)`);f('f_batch_unique',`IF(${lot}="",0,IF(COUNTIF(${LETTER(idx('lot_id'))}$2:${lot},${lot})=1,1,0))`)}
   if(key==='changes'){const status=ref('status',n),risk=ref('source_risk_level',n);f('f_open',`IF(OR(LOWER(${status})="closed",LOWER(${status})="complete",LOWER(${status})="completed"),0,1)`);f('f_high_risk_open',`IF(AND(${cell(helperIndex.f_open,n)}=1,LOWER(${risk})="high"),1,0)`)}
   if(key==='docs'){const type=ref('document_type',n),expires=ref('expiry_date',n);let dt=`IFERROR(DATE(VALUE(LEFT(${expires},4)),VALUE(MID(${expires},6,2)),VALUE(RIGHT(${expires},2))),0)`;const check="DATE(VALUE(LEFT('使用说明'!$B$7,4)),VALUE(MID('使用说明'!$B$7,6,2)),VALUE(RIGHT('使用说明'!$B$7,2)))";f('f_expiry90',`IF(AND(${type}="DOC-004",${dt}>=${check},${dt}<=${check}+90),1,0)`)}
   if(key==='qms'){const kind=ref('kind',n),due=ref('due_date',n),closed=ref('closed_at',n),status=ref('status',n);f('f_deviation',`IF(${kind}="DEVIATION",1,0)`);f('f_capa_valid',`IF(AND(${kind}="CAPA",${due}<>""),1,0)`);f('f_capa_ontime',`IF(AND(${kind}="CAPA",${due}<>"",${closed}<>"",${status}="CLOSED",${closed}<=${due}),1,0)`)}
   if(key==='links')f('f_join_ok',`IF(${ref('ok',n)}=TRUE,1,IF(${ref('ok',n)}="true",1,0))`);
 }
 // CSV numeric fields are text by design; convert to numeric worksheet values for formula recalculation.
 for(let i=0;i<rows.length;i++)for(const k of ['ordered_qty','received_qty','unit_price','benchmark_price','allocated_qty','required_qty','quantity']){const ix=idx(k);if(ix&&rows[i][k]!==''&&Number.isFinite(Number(rows[i][k])))ws.getCell(i+2,ix).value=Number(rows[i][k]);}
 format(ws);for(const h of helpers)ws.getColumn(helperIndex[h]).width=18;
 return {ws,keys,helpers:helperIndex,size:rows.length};
}
function metricFormula(id,sheet){const f=(key,helper)=>{const s=sheet[key];if(!s)return '0';const col=s.helpers[helper];if(!col)return '0';return `SUM('${COLS[key]}'!${LETTER(col)}2:${LETTER(col)}${Math.max(2,s.size+1)})`}; const ratio=(a,b)=>`IFERROR(100*(${a})/(${b}),0)`;
 const poSpent=f('po','f_spend'),poLate=f('po','f_late'),poOn=f('po','f_ontime'),poDelivered=f('po','f_valid_delivery'),poOtif=f('po','f_otif'),poValid=f('po','f_valid_otif');
 return ({'KPI-01-01':poSpent,'KPI-01-03':ratio(f('po','f_ppv'),f('po','f_base')),'KPI-03-01':f('po','f_unique'),'KPI-03-02':poLate,'KPI-03-03':`SUMPRODUCT('${COLS.po}'!${LETTER(sheet.po.helpers.f_spend)}2:${LETTER(sheet.po.helpers.f_spend)}${Math.max(2,sheet.po.size+1)},'${COLS.po}'!${LETTER(sheet.po.helpers.f_late)}2:${LETTER(sheet.po.helpers.f_late)}${Math.max(2,sheet.po.size+1)})`,'KPI-03-04':ratio(poOtif,poValid),'KPI-04-01':ratio(f('production','f_ready'),`COUNTA('${COLS.production}'!A2:A${Math.max(2,sheet.production.size+1)})`),'KPI-05-01':f('inventory','f_batch_unique'),'KPI-05-02':f('inventory','f_released_quantity'),'KPI-05-10':ratio(f('inventory','f_hold'),`COUNTA('${COLS.inventory}'!A2:A${Math.max(2,sheet.inventory.size+1)})`),'KPI-06-01':ratio(poOn,poDelivered),'KPI-07-09':f('docs','f_expiry90'),'KPI-08-01':f('changes','f_open'),'KPI-08-02':f('changes','f_high_risk_open'),'KPI-06-05':f('qms','f_deviation'),'KPI-06-06':ratio(f('qms','f_capa_ontime'),f('qms','f_capa_valid')),'KPI-11-06':ratio(f('links','f_join_ok'),`COUNTA('${COLS.links}'!A2:A${Math.max(2,sheet.links.size+1)})`)})[id]||null;
}
export async function exportDecisionModuleWorkbook(query={},options={}){
 const module=buildDecisionModule(query,options);if(!module)throw Error('Unknown decision module');
 const source=buildDecisionExportFacts(query,options);if(source.source_meta.source_boundary==='SIMULATED_115_KPIS_NON_GXP')return exportSimulationDecisionWorkbook(module,source);const wb=new ExcelJS.Workbook();wb.creator='Pharma Procurement AI · 溯源公式';wb.created=new Date();wb.calcProperties.fullCalcOnLoad=true;wb.calcProperties.calcMode='auto';
 const meta=wb.addWorksheet('使用说明');[['V2.9.35 绩效与经营决策中心 · 计算依据与来源表'],['模块',module.title],['来源',source.source_meta.source],['数据边界',source.source_meta.source_boundary],['月份',source.source_meta.scope.month],['供应商 / 物料',source.source_meta.scope.supplier+' / '+source.source_meta.scope.material],['检查日',source.source_meta.scope.as_of],['快照',source.source_meta.snapshot],['说明','原网站同源DEMO不等于企业ERP/QMS已接入；未验证的指标没有伪造结果。'],['公式规则','所有可计算结果在“指标公式”B列均为可编辑的Excel公式，引用“原始_*”工作表的逐行Excel公式辅助列。'],['差异边界','无币种PO不得标记USD；交付率ODT与OTIF不同口径；库存无历史快照时不能按月追溯。'],['说明','工作簿首次在Excel中打开时自动重新计算公式；其他兼容应用可能需手动重算。']].forEach(a=>meta.addRow(a));meta.getColumn(1).width=25;meta.getColumn(2).width=110;meta.getRow(1).font={bold:true,size:15,color:{argb:'FF15569C'}};meta.getCell('B7').numFmt='yyyy-mm-dd';
 const rows=prepareRows(source.tables);const sheet={};for(const key of Object.keys(COLS))sheet[key]=sourceSheet(wb,key,rows[key],source.source_meta.scope.as_of);
 const sum=wb.addWorksheet('指标公式');sum.addRow(['KPI ID','Excel可重算结果','基线结果（源接口）','单位','名称','状态','分子','分母','中文计算公式','源表','缺失字段 / 正式口径限制','责任部门','数据计算步骤','原始数据范围']);
 for(const m of module.metrics){const row=sum.addRow([m.id,null,m.status==='已计算'?Number(m.value):null,m.unit,m.name,m.status,m.numerator,m.denominator,m.formula,m.evidence?.source_table||'',m.missing_reason||m.evidence?.reason||'',m.owner,m.analysis_steps,m.evidence?.availability||'']);const form=m.status==='已计算'?metricFormula(m.id,sheet):null;if(form)row.getCell(2).value={formula:form,result:Number(m.value)};else if(m.status==='已计算')row.getCell(2).value='待补Excel公式：禁止以0伪装已复算';}
 format(sum);sum.getColumn(5).width=34;sum.getColumn(9).width=74;sum.getColumn(11).width=72;sum.getColumn(13).width=84;sum.getColumn(14).width=28;
 const steps=wb.addWorksheet('分析步骤与结论');steps.addRow(['顺序','类型','分析说明']);module.analysis_steps.forEach((r,i)=>steps.addRow([i+1,'分析步骤',r]));module.conclusions.forEach((r,i)=>steps.addRow([module.analysis_steps.length+i+1,'基于数据的分析结论',r]));steps.getColumn(1).width=11;steps.getColumn(2).width=24;steps.getColumn(3).width=138;format(steps);
 const manifest=wb.addWorksheet('来源表与字典');manifest.addRow(['源表','记录数','全站跳转页面','刷新或快照限制']);module.source_tables.forEach(t=>manifest.addRow([t.name,t.count,t.route,t.freshness]));manifest.getColumn(1).width=38;manifest.getColumn(2).width=15;manifest.getColumn(3).width=30;manifest.getColumn(4).width=65;format(manifest);
 const b=await wb.xlsx.writeBuffer();return Buffer.from(b);
}
