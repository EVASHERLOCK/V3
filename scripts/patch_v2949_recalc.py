from pathlib import Path
p=Path(__file__).resolve().parent.parent/'static/decision-center/offline_v2942.mjs'
s=p.read_text()
a=" const regs=await import('/engine/simulation_kpi_v2942.mjs');\n const summary=";
b=''' const regs=await import('/engine/simulation_kpi_v2942.mjs');
 // Normalized per-source-row helper formulas, not Excel array COUNTIF(range,range)
 // tricks. Each unique key/flag is explicitly counted once under the current
 // filter; columns reference the same raw event rows exported above.
 const helperSpecs=new Map();
 function ukey(key,flag=''){const tag=key+(flag?' | '+flag+'=1':'');if(!helperSpecs.has(tag))helperSpecs.set(tag,{key,flag,col:letter(helperSpecs.size+2)});return helperSpecs.get(tag)}
 for(const m of dataset.metrics.filter(m=>selectedIds.has(m.id))){const spec=regs.SIM_KPI_REGISTRY.get(m.id);
  if(spec.type==='distinct'||spec.type==='pct_distinct'){ukey(spec.fields[0],spec.fields[1]||'');if(spec.type==='pct_distinct')ukey(spec.fields[0]);}
  if(spec.type==='po_per_fte')ukey('buyer_owner');
 }
 const distinctRows=[['来源事件ID',...[...helperSpecs.keys()]]];
 for(let i=0;i<rows.length;i++){const rowNum=i+2,one=[rows[i].event_id];for(const entry of helperSpecs.values()){
  const main=idx(entry.key),ref=`'模拟指标事件'!${main}${rowNum}`;
  if(!entry.flag)one.push(xlsx.xlFormula(`IF(AND(${ref}<>"",COUNTIF('模拟指标事件'!${main}$2:${main}${rowNum},${ref})=1),1,0)`));
  else{const flag=idx(entry.flag),flagref=`'模拟指标事件'!${flag}${rowNum}`;
   one.push(xlsx.xlFormula(`IF(AND(${ref}<>"",${flagref}=1,COUNTIFS('模拟指标事件'!${main}$2:${main}${rowNum},${ref},'模拟指标事件'!${flag}$2:${flag}${rowNum},1)=1),1,0)`));
  }
 }distinctRows.push(one)}
 const totalU=(key,flag='')=>{const {col}=ukey(key,flag);return `SUM('逐行唯一计数'!${col}2:${col}${rows.length+1})`};
 const forecastRows=[['事件ID','绝对预测误差'],...rows.map((r,i)=>[r.event_id,xlsx.xlFormula(`ABS('模拟指标事件'!${idx('forecast_qty')}${i+2}-'模拟指标事件'!${idx('actual_qty')}${i+2})`)])];
 const summary='''
assert a in s, 'not found anchor1'
s=s.replace(a,b)
a='''  if(spec.type==='top_suppliers')f=`IFERROR(100*(${[1,2,3,4,5].map(i=>`LARGE('供应商采购额'!B2:B${supRows.length},${i})`).join('+')})/SUM('供应商采购额'!B2:B${supRows.length}),0)`;
  if(!f)throw Error('Offline Excel missing KPI formula: '+m.id);
  summary.push([m.id,xlsx.xlFormula(f),Number(m.value),m.unit,m.name,m.numerator,m.denominator,m.formula]);'''
b='''  if(spec.type==='top_suppliers')f=`IFERROR(100*(${[1,2,3,4,5].map(i=>`IFERROR(LARGE('供应商采购额'!B2:B${supRows.length},${i}),0)`).join('+')})/SUM('供应商采购额'!B2:B${supRows.length}),0)`;
  if(spec.type==='po_per_fte')f=`IFERROR(COUNTA(${R('event_id')})/${totalU('buyer_owner')},0)`;
  if(spec.type==='distinct')f=totalU(spec.fields[0],spec.fields[1]||'');
  if(spec.type==='pct_distinct')f=`IFERROR(100*${totalU(spec.fields[0],spec.fields[1])}/${totalU(spec.fields[0])},0)`;
  if(spec.type==='forecast_accuracy')f=`IFERROR(100*(1-SUM('逐行预测误差'!B2:B${forecastRows.length})/SUM(${R('actual_qty')})),0)`;
  if(!f)throw Error('Offline Excel missing KPI formula: '+m.id);
  // The JS KPI contract rounds to two decimal places. Match that contract
  // explicitly in Excel, rather than comparing raw unrounded intermediate values.
  summary.push([m.id,xlsx.xlFormula(`ROUND(${f},2)`),Number(m.value),m.unit,m.name,m.numerator,m.denominator,m.formula]);'''
assert a in s, 'not found anchor2'
s=s.replace(a,b)
a="{name:'模拟指标事件',rows:simRows},{name:'模拟变更'"
b="{name:'模拟指标事件',rows:simRows},{name:'逐行唯一计数',rows:distinctRows},{name:'逐行预测误差',rows:forecastRows},{name:'模拟变更'"
assert a in s, 'not found anchor3'
s=s.replace(a,b)
p.write_text(s)
print('patched',p)
