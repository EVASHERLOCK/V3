/* V1.5 actual browser-side file generation. Native A4 PDF and native 4-slide PPTX.
 * Static, self-contained; no external service; Non-GxP and no electronic approval.
 */
(()=>{'use strict';
 const TE=new TextEncoder();
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const fmt=x=>Number.isFinite(Number(x))?Number(x).toLocaleString('en-US',{maximumFractionDigits:2}):'—';
 const byteJoin=arr=>{let len=arr.reduce((n,a)=>n+a.length,0),out=new Uint8Array(len),i=0;for(let a of arr){out.set(a,i);i+=a.length}return out};
 const U16=(buf,p,n)=>{buf[p]=n&255;buf[p+1]=n>>>8&255};
 const U32=(buf,p,n)=>{n=n>>>0;for(let i=0;i<4;i++)buf[p+i]=n>>>8*i&255};
 const R16=(b,i)=>b[i]|b[i+1]<<8, R32=(b,i)=>(b[i]|b[i+1]<<8|b[i+2]<<16|b[i+3]<<24)>>>0;
 const crc32=b=>{let c=-1;for(let x of b){c^=x;for(let j=0;j<8;j++)c=c&1?c>>>1^0xEDB88320:c>>>1}return(c^-1)>>>0};
 function zipParse(b){let items=[];for(let i=0;i<b.length-30;){if(R32(b,i)!==0x04034b50)break;const flags=R16(b,i+6),compression=R16(b,i+8),len=R32(b,i+18),nl=R16(b,i+26),el=R16(b,i+28);if(compression!==0||(flags&8))throw Error('PowerPoint template should use stored entries');let name=new TextDecoder().decode(b.slice(i+30,i+30+nl)),start=i+30+nl+el;items.push({name,bytes:b.slice(start,start+len)});i=start+len}return items}
 function zipWrite(items){let locals=[],central=[],offset=0;for(let item of items){let name=TE.encode(item.name),body=item.bytes,crc=crc32(body);let lh=new Uint8Array(30+name.length);U32(lh,0,0x04034b50);U16(lh,4,20);U32(lh,14,crc);U32(lh,18,body.length);U32(lh,22,body.length);U16(lh,26,name.length);lh.set(name,30);locals.push(lh,body);let c=new Uint8Array(46+name.length);U32(c,0,0x02014b50);U16(c,4,20);U16(c,6,20);U32(c,16,crc);U32(c,20,body.length);U32(c,24,body.length);U16(c,28,name.length);U32(c,42,offset);c.set(name,46);central.push(c);offset+=lh.length+body.length}
  let cbytes=byteJoin(central),e=new Uint8Array(22);U32(e,0,0x06054b50);U16(e,8,items.length);U16(e,10,items.length);U32(e,12,cbytes.length);U32(e,16,offset);return byteJoin([...locals,cbytes,e])}
 const decode64=text=>{const str=atob(text),a=new Uint8Array(str.length);for(let i=0;i<str.length;i++)a[i]=str.charCodeAt(i);return a};
 const date=()=>new Date().toISOString().slice(0,10);
 function download(name,bytes,mime){let u=URL.createObjectURL(new Blob([bytes],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)}
 function reportData(){const v=window.PharmaV14;if(!v?.state.data)throw Error('数据尚未载入');return v.reportData(v.state.data)}
 function context(){let d=reportData(),a=d.overview.current,late=d.purchasing.late||[],als=d.actions.alerts||[];return {d,a,late,als,basis:window.PharmaV14.state.basis,basisName:{net:'不含税',gross:'含税',landed:'落地成本'}[window.PharmaV14.state.basis]||'不含税',scope:JSON.stringify({global:window.EnterpriseV08?.state?.filters||{},active:window.PharmaV14.state.activeFilters}),summary:window.PharmaV14.narrative(d,window.PharmaV14.state.view)}}
 function drawPaper(ctx,c){let W=1240,H=1754;ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);let bar='#2C5F6B';ctx.fillStyle=bar;ctx.fillRect(0,0,W,14);let font=(size,bold=false)=>`${bold?'700 ':'400 '}${size}px 'Noto Sans CJK SC','Microsoft YaHei',Arial,sans-serif`;
 const text=(t,x,y,size=22,color='#18232B',bold=false,maxWidth=1120)=>{ctx.font=font(size,bold);ctx.fillStyle=color;let v=String(t??'');if(ctx.measureText(v).width>maxWidth){while(v.length&&ctx.measureText(v+'…').width>maxWidth)v=v.slice(0,-1);v+='…'}ctx.fillText(v,x,y)};
 text('PHARMA PROCUREMENT AI  /  MANAGEMENT BRIEF',64,65,22,bar,true);
 text('采购经营一页纸摘要',64,143,47,'#18232B',true);
 text(`数据截至 ${c.d.meta?.as_of||date()} · kpi-v1.5 · DEMO-USD · ${c.basisName} · Non-GxP`,64,190,20,'#6f808b');
 ctx.fillStyle='#F2F8F6';ctx.fillRect(64,219,1112,134);ctx.fillStyle=bar;ctx.fillRect(64,219,7,134);
 text('管理判断与建议',91,254,19,bar,true);let s=c.summary.replace(/（模拟数据 · Non-GxP）/,'');text(s.slice(0,58),91,291,22,'#18232B',true);text(s.slice(58,116),91,323,22,'#18232B',true);
 let v=[['采购金额',fmt(c.a.spend)],['Supplier OTD',fmt(c.a.otd)+'%'],['PPV',fmt(c.a.ppv)+'%'],['生产齐套率',fmt(c.a.ready)+'%'],['开放 Change',fmt(c.a.open_changes)],['异常金额敞口',fmt(c.late.reduce((n,x)=>n+Number(x.amount||0),0))]];
 for(let i=0;i<v.length;i++){let x=64+i%3*380,y=382+Math.floor(i/3)*128;ctx.fillStyle='#F4F6F7';ctx.fillRect(x,y,354,111);text(v[i][0],x+20,y+31,20,'#4C5B66');text(v[i][1],x+20,y+81,31,'#18232B',true,318)}
 text('采购金额趋势（仅记录有真实 PO 日期的数据）',64,705,24,bar,true);let rows=c.d.purchasing.orders||[],months={};for(let r of rows){let m=String(r.created_date||r.order_date||r.receipt_date||'').slice(0,7);if(/^\d{4}-\d{2}$/.test(m))months[m]=(months[m]||0)+Number(r.amount||0)}let series=Object.entries(months).sort().slice(-12);let max=Math.max(1,...series.map(x=>x[1]));ctx.strokeStyle='#CAD5D8';ctx.beginPath();ctx.moveTo(64,977);ctx.lineTo(1176,977);ctx.stroke();for(let i=0;i<series.length;i++){let xx=80+i*1040/series.length,w=Math.max(24,760/series.length),hh=190*series[i][1]/max;ctx.fillStyle='#779AA0';ctx.fillRect(xx,977-hh,w,hh);text(series[i][0].slice(5),xx,1005,15,'#4C5B66')};if(!series.length)text('缺少实际 PO 日期序列，不生成虚构同期',64,880,20,'#8A97A1');
 text('TOP 风险与建议行动（模拟）',64,1090,24,bar,true);const top=c.als.slice().sort((a,b)=>(b.severity==='HIGH')-(a.severity==='HIGH')).slice(0,6);ctx.fillStyle='#EAF2F4';ctx.fillRect(64,1113,1112,45);text('事件 / 风险',82,1143,19,bar,true);text('责任部门',682,1143,19,bar,true);text('下一步',912,1143,19,bar,true);for(let i=0;i<top.length;i++){let y=1190+i*64;ctx.fillStyle=i%2?'#fff':'#F6F8F8';ctx.fillRect(64,y-27,1112,56);text((top[i].title||top[i].id).slice(0,31),82,y,18,'#18232B');text(top[i].owner||'待指派',682,y,16,'#4C5B66',false,200);text('建议核对 / 指派',912,y,17,'#4C5B66')}
 ctx.fillStyle='#E2E7EA';ctx.fillRect(64,1628,1112,2);text('仅用于模拟采购决策展示。不得自动放行批次、批准来源、实施注册变更、付款或修改 SAP/MRP。',64,1661,16,'#8A97A1');text('估算损失与建议收益不是财务确认值；正式质量与法规结论需 QA/RA 受控系统授权。',64,1690,16,'#8A97A1');
 }
 function pdfFromJPEG(jpg,width,height){const parts=[],offsets=[0];let length=0;function add(b){parts.push(b);length+=b.length}const txt=x=>TE.encode(x);add(txt('%PDF-1.4\n%\x80\x81\x82\x83\n'));function obj(i,bytes){offsets[i]=length;add(txt(`${i} 0 obj\n`));add(bytes);add(txt('\nendobj\n'))}obj(1,txt('<< /Type /Catalog /Pages 2 0 R >>'));obj(2,txt('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));obj(3,txt('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Image1 4 0 R >> >> /Contents 5 0 R >>'));obj(4,byteJoin([txt(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),jpg,txt('\nendstream')]));let stream=txt('q\n595.28 0 0 841.89 0 0 cm\n/Image1 Do\nQ\n');obj(5,byteJoin([txt(`<< /Length ${stream.length} >>\nstream\n`),stream,txt('endstream')]));let start=length;add(txt('xref\n0 6\n0000000000 65535 f \n'));for(let i=1;i<=5;i++)add(txt(String(offsets[i]).padStart(10,'0')+' 00000 n \n'));add(txt(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`));return byteJoin(parts)}
 async function exportPDF(){const c=context(),canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;drawPaper(canvas.getContext('2d'),c);const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.93));if(!blob)throw Error('浏览器不支持 JPEG Canvas');const jpg=new Uint8Array(await blob.arrayBuffer()),pdf=pdfFromJPEG(jpg,canvas.width,canvas.height);download(`Pharma_Procurement_Brief_${date()}.pdf`,pdf,'application/pdf');return pdf.length}
 function pptxChartPNG(c,kind){
  const canvas=document.createElement('canvas');canvas.width=1050;canvas.height=160;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#EDF3F4';ctx.fillRect(0,0,1050,160);
  ctx.font='bold 19px Microsoft Yahei, Arial';ctx.fillStyle='#2C5F6B';
  if(kind==='amount'){
    ctx.fillText('采购金额时间分布 · 源于当前筛选后的 PO',19,25);
    const months={};for(let r of c.d.purchasing.orders||[]){let k=String(r.created_date||r.receipt_date||'').slice(0,7);if(/^\d{4}-\d{2}$/.test(k))months[k]=(months[k]||0)+Number(r.amount||0)}
    let arr=Object.entries(months).sort().slice(-12),max=Math.max(1,...arr.map(r=>r[1]));
    arr.forEach(([m,v],i)=>{let x=35+i*960/arr.length,hh=102*v/max;ctx.fillStyle='#779AA0';ctx.fillRect(x,139-hh,Math.max(20,620/arr.length),hh);ctx.font='14px Arial';ctx.fillStyle='#4C5B66';ctx.fillText(m.slice(5),x,158)});
  }else{
    let high=c.als.filter(x=>x.severity==='HIGH').length,medium=c.als.filter(x=>x.severity==='MEDIUM').length,low=c.als.length-high-medium,vals=[['HIGH',high,'#B4473F'],['MEDIUM',medium,'#B8823A'],['其他',low,'#9CB7BD']];
    ctx.fillText('风险等级分布 · 当前范围的演示事件',19,25);
    vals.forEach(([label,v,color],i)=>{let x=35+i*330;ctx.fillStyle=color;ctx.fillRect(x,70,Math.max(2,265*v/Math.max(c.als.length,1)),28);ctx.font='18px Microsoft Yahei, Arial';ctx.fillStyle='#4C5B66';ctx.fillText(`${label} ${v}`,x,127)})
  }
  return decode64(canvas.toDataURL('image/png').split(',')[1]);
 }
 function exportPPTX(){const c=context(),b64=window.PharmaV15Template;if(!b64)throw Error('离线 PPTX 模板未加载');let items=zipParse(decode64(b64)),lateAmount=c.late.reduce((n,x)=>n+Number(x.amount||0),0),blocked=c.d.qualification.sources.filter(x=>!x.prequalified).length;
 const map={TITLE1:'采购经营总览',SUBTITLE1:`${date()} · ${c.basisName} · kpi-v1.5 · Non-GxP`,BODY1:`采购金额 ${fmt(c.a.spend)} DEMO-USD\n订单行 ${c.a.po_lines} · OTD ${fmt(c.a.otd)}%`,BODY1B:`生产齐套率 ${fmt(c.a.ready)}%\n开放 Change ${c.a.open_changes} · PPV ${fmt(c.a.ppv)}%`,TITLE2:'支出 · 价格与交付',SUBTITLE2:'采购金额及异常支出敞口 · 按当前筛选范围',BODY2:`采购金额 ${fmt(c.a.spend)}\nPPV ${fmt(c.a.ppv)}%`,BODY2B:`逾期 PO ${c.late.length} 条\n关联金额 ${fmt(lateAmount)}（非确认损失）`,TITLE3:'供应商与制药合规',SUBTITLE3:'商业评分不能越过 GMP / ASL / Site / Market 门槛',BODY3:`候选报价 ${c.d.sourcing.quotes.length} 家\n准入受限来源 ${blocked} 项`,BODY3B:'CEP Holder ≠ 制造 Site\n需 QA / SQM / RA 分别复核',TITLE4:'风险行动 · 下一步',SUBTITLE4:'建议与责任跟踪；正式审批仍在受控系统进行',BODY4:`HIGH 告警 ${c.als.filter(a=>a.severity==='HIGH').length} 项\n任务跟进需人工验证`,BODY4B:'建议优先核对质量可用性与延期 PO\n风险金额不是已实现损失'};
 const charts={'ppt/media/image1.png':pptxChartPNG(c,'amount'),'ppt/media/image2.png':pptxChartPNG(c,'risk')};
 items=items.map(it=>{if(charts[it.name])return{name:it.name,bytes:charts[it.name]};if(!/^ppt\/slides\/slide[1-4]\.xml$/.test(it.name))return it;let xml=new TextDecoder().decode(it.bytes);for(let [k,v]of Object.entries(map).sort((a,b)=>b[0].length-a[0].length)){xml=xml.replaceAll(k,esc(v))}return {name:it.name,bytes:TE.encode(xml)}});const pptx=zipWrite(items);download(`Pharma_Procurement_4_Slide_Brief_${date()}.pptx`,pptx,'application/vnd.openxmlformats-officedocument.presentationml.presentation');return pptx.length}
 document.addEventListener('click',async e=>{const el=e.target.closest('[data-v15]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();try{if(el.dataset.v15==='export-pdf')await exportPDF();else if(el.dataset.v15==='export-pptx')exportPPTX()}catch(err){console.error('Export failed',err);const t=document.getElementById('toast');if(t){t.textContent='汇报生成失败：'+err.message;t.classList.add('show')}}},true);
 window.PharmaV15Exports={exportPDF,exportPPTX,context,zipParse,zipWrite};
})();
