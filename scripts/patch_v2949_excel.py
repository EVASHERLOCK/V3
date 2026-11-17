from pathlib import Path
p=Path(__file__).resolve().parent.parent/'static/decision-center/offline_v2942.mjs'
s=p.read_text()
old=''' xlsx.downloadXlsx([{name:'模块分析',rows:'''
assert old in s
replacement=''' const dictionary=[['KPI-ID','专业术语','变量键','字段含义/运算条件','来源定位'],...selected.metrics.flatMap(m=>{
  const spec=regs.SIM_KPI_REGISTRY.get(m.id);return (spec?.fields?.length?spec.fields:['event_id']).map(field=>[m.id,spec?.type||'unknown',field,m.required_fields||'来源字段须经业务Owner核验',m.evidence?.source_table||'simEvents']);
 })];
 const comparison=[['KPI-ID','网页JS重算值','Excel公式结果（引用KPI公式表）','逐格同值（可重算）','原始指标公式']];
 for(let i=1;i<summary.length;i++)comparison.push([summary[i][0],summary[i][2],xlsx.xlFormula(`'KPI公式'!B${i+1}`),xlsx.xlFormula(`IF(OR(NOT(ISNUMBER(B${i+1})),NOT(ISNUMBER(C${i+1}))),"MISSING",IF(ABS(B${i+1}-C${i+1})<0.000001,"MATCH","DIFF"))`),summary[i][7]]);
 const sourceSheets=selected.tables.map(t=>({name:('模块来源_'+t.table).slice(0,31),rows:(()=>{
  const keys=[...new Set(t.rows.flatMap(r=>Object.keys(r)))];return [keys,...t.rows.map(row=>keys.map(k=>typeof row[k]==='object'?JSON.stringify(row[k]):row[k]??''))];
 })()}));
 xlsx.downloadXlsx([{name:'模块分析',rows:'''
s=s.replace(old,replacement)
old="{name:'KPI公式',rows:summary},{name:'模拟指标事件',rows:simRows}"
assert old in s
s=s.replace(old,"{name:'KPI公式',rows:summary},{name:'网页Excel逐格对账',rows:comparison},{name:'术语及变量',rows:dictionary},...sourceSheets,{name:'模拟指标事件',rows:simRows}")
p.write_text(s)
print('ADDED static decision module-specific formula reconciliation, dictionary, and complete source sheets')
