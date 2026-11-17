/* V2.9.18 - transparent formula-driven XLSX exports, standard OOXML.
 * No browser-only CSV masquerading as Excel. Calculated cells are true Excel
 * formulas; raw observations and scenario assumptions are separate sheets.
 * Excel/LibreOffice recalculates on opening, because we deliberately avoid
 * fabricating cached results for source-dependent formulas.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {deflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const xml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const formula=s=>({formula:s});
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const fx=n=>Math.round(n*100)/100;
function sheetXML(rows, options={}){
 const maxCols=Math.max(...rows.map(r=>r.length),1);
 const cols=Array.from({length:maxCols},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${Math.min(45,Math.max(13,(options.widths?.[i]|| (i===0?25:19))))}" customWidth="1"/>`).join('');
 const body=rows.map((row,ri)=>`<row r="${ri+1}" ht="${ri<3?23:20}" customHeight="1">${row.map((v,ci)=>{
  if(v===null||v===undefined||v==='')return '';
  const r=col(ci+1)+(ri+1), style=ri===0?'1':ri===2?'2':(v&&typeof v==='object'&&'formula' in v)?'4':typeof v==='number'?'3':'0';
  if(v&&typeof v==='object'&&'formula' in v)return `<c r="${r}" s="${style}"><f>${xml(v.formula.replace(/^=/,''))}</f><v></v></c>`;
  if(typeof v==='number'&&Number.isFinite(v))return `<c r="${r}" s="${style}"><v>${v}</v></c>`;
  return `<c r="${r}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
 }).join('')}</row>`).join('');
 const maxRow=rows.length;
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(maxCols)}${maxRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}
let crcTable=null;function crc32(b){if(!crcTable){crcTable=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0})}let c=0xFFFFFFFF;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zip(files){let at=0,headers=[],central=[];for(const [filename,content] of Object.entries(files)){
 const name=Buffer.from(filename), raw=Buffer.from(content,'utf8'), compressed=deflateRawSync(raw, {level:6}),crc=crc32(raw);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
 headers.push(local,name,compressed);
 const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(8,10);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(compressed.length,20);cd.writeUInt32LE(raw.length,24);cd.writeUInt16LE(name.length,28);cd.writeUInt32LE(at,42);central.push(cd,name);at+=local.length+name.length+compressed.length;
 }
 const dir=Buffer.concat(central);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(at,16);
 return Buffer.concat([...headers,dir,end]);
}
export function createWorkbook(tabs){
 const entries={};const types=tabs.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
 entries['[Content_Types].xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${types}</Types>`;
 entries['_rels/.rels']='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 entries['xl/workbook.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabs.map((t,i)=>`<sheet name="${xml(t.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
 entries['xl/_rels/workbook.xml.rels']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tabs.map((t,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${tabs.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 entries['xl/styles.xml']='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FF15395B"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1256A0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F1FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 tabs.forEach((t,i)=>entries[`xl/worksheets/sheet${i+1}.xml`]=sheetXML(t.rows,t));return zip(entries);
}
const headers=(title,subtitle,cols)=>[[title],[subtitle],cols];
let vmContext;
function sourceCostModel(material,year){
 if(!vmContext){const env={window:{},document:{addEventListener:()=>{}},sessionStorage:{getItem:()=>null,setItem:()=>{}},location:{hash:''},console,Number,Math,Date,Map,Set,Intl};env.window.window=env.window;vm.createContext(env);for(const f of ['strategic_sourcing_universe.js','strategic_sourcing_cost.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,'static',f),'utf8'),env,{filename:f,timeout:15000});vmContext=env}
 const raw=enterpriseAnalysis({});const filters={material,year,category:'all',supplier:'all',project:'all'};
 return vmContext.window.PharmaCostBaseline.build(raw,filters);
}
function safeMaterial(v){if(v==='all')throw Error('无效的物料筛选：公式Excel必须先选择单一物料；不同物料的单价不可直接比较');if(!/^[A-Z0-9_-]{2,40}$/.test(v||''))throw Error('无效物料ID');return v}
export const COST_ASSUMPTIONS=[
 {key:'替代材料',rate:-0.06,scope:'等效物料 / 质量与注册验证成本待补；未获 QA/RA 批准'},
 {key:'工艺优化',rate:-0.035,scope:'设计工艺优化假设；无已确认收率/加工费拆分'},
 {key:'长期框架',rate:-0.04,scope:'框架采购年量/返利未签约；仅折扣情景'},
 {key:'物流拼箱与港口优化',rate:-0.018,scope:'运价与运输方案未锁定；仅运输费假设'},
 {key:'付款条款与汇率策略',rate:-0.012,scope:'付款条件与汇率敞口待财务复核'}
];
export function getCostTrace({material='API-001',year='2026'}={}){
 material=safeMaterial(material);year=/^(20\d{2}|all)$/.test(year)?year:'2026';const m=sourceCostModel(material,year);
 return {material,year,model:m,computed:{referenceTarget:m.target,bestQuote:m.review.bestQuote,attainment:m.review.targetAchieve,poQty:m.qty,poSpend:m.spend},opportunities:COST_ASSUMPTIONS};
}
export function exportCostWorkbook(opts={}){
 const {material,year,model:m}=getCostTrace(opts);const npo=m.po.length, nq=m.candidates.length;const poEnd=3+npo, quoteEnd=3+nq;
 const sumPO=(c)=>`SUM('PO输入'!${c}4:${c}${poEnd})`;
 const quoteCols=['编号','供应商','来源标记','物料','单位价USD/kg','MOQ kg','运费USD','需求量kg','采购量kg','采购总金额USD','落地价USD/kg','目标参考价','目标差价USD/kg','潜在节省率','质量评分','交付评分','商务评分','风险指数','综合得分','原始报价币种','原始报价单价','汇率','报价证据'];
 const poRows=m.po.map((r,i)=>{const j=i+4;return [r.po_id,r.supplier_id,r.material_id,r.created_date,num(r.ordered_qty),num(r.amount),num(r.benchmark_price),formula(`E${j}*G${j}`),formula(`F${j}-H${j}`),formula(`IFERROR(F${j}/E${j},0)`),num(r.unit_price),'V08内置DEMO采购订单（非真实ERP）',formula(`LEFT(D${j},7)`)];});
 const quoteRows=m.candidates.map((r,i)=>{const j=i+4;return [r.supplier_id,r.supplier_name,r.price_origin,r.material_id,num(r.unit),num(r.moq),num(r.freight),1000,formula(`MAX(F${j},H${j})`),formula(`E${j}*I${j}+G${j}`),formula(`IFERROR(J${j}/H${j},0)`),formula(`'指标摘要'!B4`),formula(`K${j}-L${j}`),formula(`IFERROR(MAX(0,(L${j}-K${j})/L${j}),0)`),num(r.quality),num(r.delivery),num(r.commercial),num(r.risk),formula(`ROUND(O${j}*0.3+P${j}*0.22+Q${j}*0.18+(100-R${j})*0.18+MAX(0,MIN(100,120-K${j}))*0.12,2)`),r.quote?.currency||'演示USD',r.quote?num(r.quote.unit_price):'',r.quote?num(r.quote.fx_to_usd):'',r.price_origin==='V08_DEMO_QUOTE'?'sourcing.quotes · V08内置DEMO':'哈希规则情景价 · 非正式报价'];});
 const baseFormula=npo?`IF(${sumPO('E')}>0,${sumPO('H')}/${sumPO('E')},B5)`:'B5';
 const minFormula=nq?`MIN('报价比较'!K4:K${quoteEnd})`:'0';
 const summary=[...headers(`成本计算血缘｜${material}`,'V2.9.18 · 所有假设都要人工核验；打开Excel自动重算',['指标','取值 / Excel计算公式','口径 / 来源']),
 ['目标成本代理（USD/kg）',formula(baseFormula),'PO 参考基准加权均价 / 无PO时使用B5演示假设；非批准研发BOM'],
 ['无PO的假设目标价（USD/kg）',num(m.target),'若存在PO则不参与指标B4；原始演示目标'],
 ['最优候选落地价（USD/kg）',formula(minFormula),'同物料最低报价；V08 DEMO / 情景报价混合，不等于可下单'],
 ['目标达成率 (%)',formula('IFERROR(MAX(0,100-MAX(0,(B6-B4)/B4*100)),0)'),'超过目标的比例从100%扣减（并非报价/目标）'],
 ['原站PO采购量（kg）',formula(sumPO('E')),'按物料和年份过滤；原始PO明细'],
 ['原站PO支出（USD）',formula(sumPO('F')),'按物料和年份过滤；原始PO明细'],
 ['原站采购价差（USD）',formula(sumPO('I')),'SUM(订单金额 - 基准单价×数量)'],
 ['候选供应商数',nq,'目录中该物料匹配的全部候选（含演示）'],
 ['分析期间',String(year),'与当前URL查询筛选保持一致'],
 ['操作建议','查看「报价比较」「机会假设」「PO输入」「偏差复盘」工作表','蓝色标题、浅蓝表头；公式可在Excel公式栏检查'],
 ];
 const monthlyRows=m.months.map((x,i)=>{const j=i+4;return [x.month,formula(`SUMIF('PO输入'!M4:M${poEnd},A${j},'PO输入'!E4:E${poEnd})`),formula(`SUMIF('PO输入'!M4:M${poEnd},A${j},'PO输入'!F4:F${poEnd})`),formula(`SUMIF('PO输入'!M4:M${poEnd},A${j},'PO输入'!H4:H${poEnd})`),formula(`IFERROR(D${j}/B${j},0)`),formula(`IFERROR(C${j}/B${j},0)`),formula(`F${j}-E${j}`),formula(`COUNTIF('PO输入'!M4:M${poEnd},A${j})`)];});
 const assumptionsRows=COST_ASSUMPTIONS.map((item,i)=>{const j=i+4;return [item.key,'演示假设 / 未验证',item.rate,formula("'指标摘要'!B4"),formula(`D${j}*(1+C${j})`),formula(`D${j}-E${j}`),formula(`IFERROR(F${j}/D${j},0)`),item.scope,'待提供供应商正式报价、验证记录及财务批准'];});
 const oppRows=m.candidates.map((r,i)=>{const j=i+4;return [r.supplier_id,r.supplier_name,r.price_origin,formula("'指标摘要'!B4"),formula(`'报价比较'!K${j}`),formula(`MAX(0,D${j}-E${j})`),formula(`IFERROR(F${j}/D${j},0)`),r.lead,r.qualification,'情景价不能直接认定已实现降本'];});
 const varianceRows=m.varianceRows.map((r,i)=>{const j=i+4;return [r.supplier_id,r.supplier_name,formula(`SUMIF('PO输入'!B4:B${poEnd},A${j},'PO输入'!E4:E${poEnd})`),formula(`SUMIF('PO输入'!B4:B${poEnd},A${j},'PO输入'!F4:F${poEnd})`),formula(`SUMIF('PO输入'!B4:B${poEnd},A${j},'PO输入'!H4:H${poEnd})`),formula(`D${j}-E${j}`),formula(`IFERROR(D${j}/C${j},0)`),formula(`IFERROR(E${j}/C${j},0)`),'PO输入按供应商分组计算'];});
 const wf=m.waterfall;const fallRows=wf.parts.map((r,i)=>{const j=i+4;return [r.label,i===5?'基于最优报价和前五段残差':`目标参考价×${r.pct}%`,i===5?formula(`'指标摘要'!B6-'指标摘要'!B4+SUM(C4:C8)`):formula(`ROUND('指标摘要'!B4*${r.pct/100},2)`),i===5?formula(`IFERROR(C${j}/'指标摘要'!B4,0)`):r.pct/100,i===5?'价格拆解残差 ≠ 已批准利润率':'演示成本结构比例'];});
 const baseline=summary;
 const glossary=[...headers('全站计算规则登记簿','本版本已完成：成本页完整公式；其他页面保留待登记警示',['业务指标','公式 / 口径','来源记录','是否可完整复算']),
 ['同物料采购基准价','SUM(基准单价×采购量)/SUM(采购量)','purchasing.orders','已实现 · 原站DEMO'],
 ['供应商落地价','(含汇率单价×max(需求量,MOQ)+运费)/需求量','sourcing.quotes 或场景价','已实现 · 明确来源'],
 ['供应商综合评分','质量×30%+交付×22%+商务×18%+(100−风险)×18%+价格得分×12%','供应商模型评分','已实现 · 情景评分'],
 ['潜在降本率','(目标参考成本−供应商落地价)/目标参考成本，负值取0','成本参考 / 报价','已实现 · 不代表已实现节省'],
 ['降本机会−6.0%','演示假设：未来成本=当前成本×(1−6%)；没有已证实报价/验证就不能称为推算结果','机会假设表','演示假设，不是已实现'],
 ['供应商质量/风险/OTD等其他页面指标','模型内可能有计算；尚未统一登记所有参与明细/公式','各页面原模型','待逐页登记；不对外声称审计级'],
 ['正式 GMP / CEP / ASL','不能通过供应商演示数据或算术公式确定；必须 QA/RA 审核','资格/证书源记录','不得自动批准'],
 ];
 return createWorkbook([
 {name:'指标摘要',rows:baseline,widths:[34,35,75]},
 {name:'PO输入',rows:headers('采购订单原始记录','原站DEMO/Non-GxP · 数值输入与公式列分开', ['PO编号','供应商编号','物料','订单日期','数量kg','订单金额USD','基准单价USD/kg','加权基准金额','价差USD','成交单价','源站记录单价','数据来源','年月（公式）']).concat(poRows),widths:[20,20,20,18,18,22,22,24,22,22,24,35,18]},
 {name:'报价比较',rows:headers('供应商报价明细（全量，包含Top10以外）','同物料、需求量1000kg，MOQ不足部分计入总采购成本；场景未准入',quoteCols).concat(quoteRows),widths:[22,36,27,20,20,17,18,18,20,23,23,20,23,20,18,18,18,18,18,20,20,18,50]},
 {name:'月度基线',rows:headers('月度PO价格基线与偏差（逐月公式）','以PO输入里的日期公式提取年月，再按月汇总，不虚构缺失月份',['年月','采购量kg','采购支出USD','加权基准金额','加权基准单价','加权成交单价','月度单位价差','PO行数']).concat(monthlyRows),widths:[18,22,22,26,26,26,26,18]},
 {name:'机会假设',rows:headers('降本台账：五类策略必须说明假设来源','−6.0% 等不是历史事实；未来成本与节省金额以Excel公式计算',['杠杆','数据等级','假设降幅（小数）','基准成本','情景改善后成本','情景节省金额','情景节省占比','验证前提','缺少的证据']).concat(assumptionsRows),widths:[28,26,22,22,25,23,22,65,65]},
 {name:'供应商差异',rows:headers('供应商价格差与目标价的逐行计算','所有候选及来源可查；不将演示价视为正式报价',['供应商ID','名称','数据来源','目标参考价','候选落地价','潜在价差','潜在节省比例','交期天数','准入情况','分析口径']).concat(oppRows),widths:[22,36,30,24,24,22,25,20,32,50]},
 {name:'成本瀑布',rows:headers('BOM演示拆解 · 各分段公式','原站未提供批准BOM成本明细，百分比是假设而非已核验成本',['成本段','计算说明','成本金额USD/kg','占目标价比例','证据等级']).concat(fallRows),widths:[28,56,24,22,56]},
 {name:'偏差复盘',rows:headers('采购价差来源与分组公式','按供应商SUMIF追溯原站PO；没有真实ERP采购事实',['供应商ID','供应商','采购量','订单金额','基准金额','价差USD','实际单位价','基准单位价','来源']).concat(varianceRows),widths:[22,36,20,23,23,23,23,23,58]},
 {name:'口径登记簿',rows:glossary,widths:[36,85,48,45]},
 ]);
}
export function exportMetricCatalogWorkbook(){
 const raw=enterpriseAnalysis({}),sup=raw.master?.suppliers||[],orders=raw.purchasing?.orders||[];
 const rows=[...headers('全站指标血缘与覆盖矩阵','已接入通用PO与供应商算式；其余尚未实现的页面保持待登记',['范围','指标','Excel结果','计算依据','来源','血缘状态']),
 ['通用','供应商 DEMO 主数据数量',formula('COUNTA(供应商输入!A4:A300)'),'非空供应商编号计数','master.suppliers','已登记'],
 ['通用','原始 PO 订单笔数',formula('COUNTA(PO输入!A4:A300)'),'非空PO单据编号计数','purchasing.orders','已登记'],
 ['通用','原始 PO 总支出 USD',formula('SUM(PO输入!E4:E300)'),'采购订单原始金额求和','purchasing.orders','已登记'],
 ['通用','PO加权采购基准价',formula('IFERROR(SUM(PO输入!G4:G300)/SUM(PO输入!D4:D300),0)'),'SUM(qty×benchmark_price)/SUM(qty)','purchasing.orders','已登记'],
 ['通用','按PO准时交付率 OTD (%)',formula('IFERROR(COUNTIF(PO输入!H4:H300,"<=0")/COUNT(PO输入!H4:H300)*100,0)'),'准时收到的PO行数/有交期的PO行数×100；按 delay_days','purchasing.orders','已登记 · 基本行数口径'],
 ['通用','晚交平均延期天数',formula('IFERROR(SUMIF(PO输入!H4:H300,">0",PO输入!H4:H300)/COUNTIF(PO输入!H4:H300,">0"),0)'),'只计算延迟PO（delay_days > 0）','purchasing.orders','已登记'],
 ['通用','供应商档案质量平均分',formula('IFERROR(AVERAGE(供应商输入!C4:C300),0)'),'有质量档案评分的供应商等权平均','master.suppliers','已登记 · DEMO档案评分'],
 ['通用','前三供应商采购额贡献','—','参见「供应商汇总」中的每家 Spend/Share 公式','purchasing.orders','已登记 · 明细在供应商汇总'],
 ['全站','其余模块的风险率 / CAPA 绩效得分','—','需逐模块接入正式分子分母、计量期间、过滤条件和审批版本','各业务模型 / ERP / QMS','待补，不能当成已可审计'],
 ];
 const sr=sup.map(s=>[s.supplier_id,s.supplier_name,s.quality_score===null?null:Number(s.quality_score),s.delivery_score===null?null:Number(s.delivery_score),'BASE_DEMO']);
 const po=orders.map((o,i)=>[o.po_id,o.material_id,o.supplier_id,num(o.ordered_qty),num(o.amount),num(o.benchmark_price),formula(`D${4+i}*F${4+i}`),o.delay_days===null?null:Number(o.delay_days)]);
 const bySupplier=sup.map((s,i)=>{const j=i+4;return [s.supplier_id,s.supplier_name,formula(`SUMIF(PO输入!C4:C300,A${j},PO输入!E4:E300)`),formula(`IFERROR(C${j}/'指标覆盖'!C6,0)`),formula(`IFERROR(COUNTIFS(PO输入!C4:C300,A${j},PO输入!H4:H300,"<=0")/COUNTIF(PO输入!C4:C300,A${j})*100,0)`),'全部为V08原站DEMO，不代表真实ERP'];});
 return createWorkbook([
 {name:'指标覆盖',rows,widths:[20,40,35,80,40,42]},
 {name:'供应商输入',rows:headers('供应商DEMO基础记录','原站DEMO，未联网企业事实',['供应商编号','名称','质量档案分','交付档案分','来源']).concat(sr),widths:[25,38,24,24,24]},
 {name:'PO输入',rows:headers('原始 PO','原站DEMO，按PO逐行计算基准金额和延迟',['PO编号','物料','供应商','数量','采购额USD','基准价','基准金额','延误天数']).concat(po),widths:[22,25,25,20,23,22,22,20]},
 {name:'供应商汇总',rows:headers('按供应商分组的采购额、份额和OTD','SUMIF / COUNTIFS 实际Excel公式；逐笔来源见PO输入',['供应商ID','供应商名称','采购额USD','采购支出占比','按PO准时交付率（%）','来源等级']).concat(bySupplier),widths:[26,42,26,28,28,50]}
 ]);
}

/* V2.9.19 — project and performance workbooks share the exact browser models.
 * All non-original metrics remain DEMO scenarios and are explicitly labelled.
 * Every derived value below is an Excel formula referencing visible inputs.
 */
const reviewContexts=new Map();
function sourceViewModel(which,{material='API-001',view='rd'}={}){
  let env=reviewContexts.get(which);
  if(!env){env={window:{},document:{addEventListener(){}},sessionStorage:{getItem(){return null},setItem(){}},location:{hash:''},console,Number,Math,Date,Map,Set,Intl};env.window.window=env.window;vm.createContext(env);
    for(const f of ['strategic_sourcing_universe.js',which==='project'?'strategic_sourcing_project.js':'strategic_sourcing_performance.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,'static',f),'utf8'),env,{filename:f,timeout:15000});reviewContexts.set(which,env)
  }
  const raw=enterpriseAnalysis({});
  return which==='project'?env.window.PharmaSourcingProject.build(raw,material):env.window.PharmaSupplierPerformance.build(raw,{view});
}
export function exportProjectWorkbook({material='API-001'}={}){
  material=safeMaterial(material);const m=sourceViewModel('project',{material}),sup=m.suppliers,weights=[.24,.18,.22,.22,.14];
  const scoring=sup.map((r,i)=>{const n=i+4;return [r.supplier_id,r.supplier_name,r.quality,r.delivery,r.technical,r.compliance,r.commercial,formula(`ROUND(SUMPRODUCT(C${n}:G${n},'权重规则'!$B$4:$F$4),1)`),r.score_origin,r.quote_origin,r.is_scenario?'未核验演示候选':'原站DEMO（非GxP）']});
  const stages=m.stages.map((r,i)=>{const n=i+4;return [r.id,r.name,r.owner,r.from,r.to,formula(`DATE(LEFT(E${n},4),MID(E${n},6,2),RIGHT(E${n},2))-DATE(LEFT(D${n},4),MID(D${n},6,2),RIGHT(D${n},2))+1`),r.status,'规划情景：不等于已签核项目']});
  const checklist=m.suppliers.flatMap(s=>m.evidenceBySupplier[s.supplier_id].map(d=>[s.supplier_id,d.doc_id,d.name,d.hasEvidence?1:0,d.sourceIds.join('、')||'—','有登记不等于已批准'])) ;
  const last=checklist.length+3;
  const completeness=sup.map((r,i)=>{const n=i+4;return [r.supplier_id,r.supplier_name,formula(`COUNTIF('文件核验输入'!A4:A${last},A${n})`),formula(`COUNTIFS('文件核验输入'!A4:A${last},A${n},'文件核验输入'!D4:D${last},1)`),formula(`C${n}-D${n}`),formula(`IFERROR(D${n}/C${n},0)`),'仅按登记元数据判断是否有文件；不代表QA批准']});
  return createWorkbook([
   {name:'计算依据',rows:headers('寻源项目 · 可重算公式与来源','V2.9.19，当前物料 '+material+'。原站 DEMO + 情景候选，不得视为正式质量放行',['对象','计算口径','来源/风险']).concat([
    ['供应商综合评分','质量×24%+交付×18%+技术×22%+合规×22%+商务×14%','评分输入、权重规则'],
    ['文件完成度','证据存在的文件数/要求文件数','文件核验输入：同供应商×同物料，仅登记元数据'],
    ['阶段天数','计划结束日期−计划开始日期+1','项目甘特情景：未签核'],
    ['缺失说明','原站只有部分文件元数据，缺失项目不补造','无真实QMS附件/QA批准'],
    ['来源等级','原站DEMO/扩展情景候选区别保留','原始PO/报价不被覆盖']]),widths:[40,82,85]},
   {name:'权重规则',rows:headers('供应商评分权重','该行权重须加和为1；可在Excel更改后触发自动重算',['规则','质量','交付','技术','合规','商务','权重合计']).concat([['默认',...weights,formula('SUM(B4:F4)')]]),widths:[22,20,20,20,20,20,25]},
   {name:'评分输入',rows:headers('供应商评分 · 所有候选（Top10之外保留）','正式DEMO与情景评分相分离；Excel综合分为SUMPRODUCT公式',['供应商ID','供应商名称','质量','交付','技术','合规','商务','综合得分公式','分值来源','报价来源','合规状态']).concat(scoring),widths:[20,38,20,20,20,20,20,25,34,28,32]},
   {name:'甘特阶段',rows:headers('计划排程 · 16阶段','计划日期对应当地项目场景，不是通过的里程碑',['阶段编号','阶段名称','责任部门','开始日期','结束日期','周期天数公式','情景状态','证据等级']).concat(stages),widths:[20,43,28,20,20,24,28,55]},
   {name:'文件核验输入',rows:headers('供应商 × 文档 · 逐条检查','1=有源站DEMO登记；0=无登记。即使为1也不构成正式批准',['供应商ID','检查项ID','文件种类','有登记(1/0)','原站文档ID','警示']).concat(checklist),widths:[21,21,45,22,45,52]},
   {name:'文件覆盖率',rows:headers('每家供应商的有登记与缺件统计','按当前物料、供应商筛选文件状态；所有数值均有公式',['供应商ID','供应商名称','要求数','有登记数','缺件数','覆盖率','限制']).concat(completeness),widths:[20,38,22,22,22,22,75]}
  ]);
}
export function exportPerformanceWorkbook({view='rd'}={}){
 view=view==='commercial'?'commercial':'rd';const m=sourceViewModel('performance',{view});const rows=m.candidates;
 const entries=rows.map((r,i)=>[r.supplier_id,r.supplier_name,r.sourceType,r.quality,r.delivery,r.technical,r.compliance,r.commercial,r.otd,r.ppv,r.avgDelay,r.qualityDev,r.probability,r.impact,r.spend,r.altCount]);
 const end=3+entries.length;
 const calculated=rows.map((r,i)=>{const n=i+4;return [r.supplier_id,r.supplier_name,
  formula(`ROUND('输入数据'!D${n}*'权重规则'!B4+'输入数据'!F${n}*'权重规则'!C4+'输入数据'!H${n}*'权重规则'!D4+'输入数据'!E${n}*'权重规则'!E4+'输入数据'!G${n}*'权重规则'!F4,1)`),
  formula(`ROUND('输入数据'!E${n}*'权重规则'!B5+'输入数据'!D${n}*'权重规则'!C5+'输入数据'!H${n}*'权重规则'!D5+'输入数据'!F${n}*'权重规则'!E5+'输入数据'!G${n}*'权重规则'!F5+MAX(0,100-ABS('输入数据'!J${n})*5)*'权重规则'!G5,1)`),
  formula(`ROUND('输入数据'!M${n}*'权重规则'!B6+'输入数据'!N${n}*'权重规则'!C6+MAX(0,100-'输入数据'!I${n})*'权重规则'!D6+MIN(100,'输入数据'!K${n}*11)*'权重规则'!E6+MIN(100,'输入数据'!L${n}*20)*'权重规则'!F6,2)`),
  formula(`IF(E${n}>=55,"高",IF(E${n}>=38,"中","低"))`),
  formula(`IF('输入数据'!C${n}="扩展情景候选（未审核）","情景候选（淘汰）",IF(AND(${view==='rd'?'C':'D'}${n}>=90,E${n}<55),"战略协作",IF(AND(${view==='rd'?'C':'D'}${n}>=82,E${n}<55),"优先供方","跟踪整改")))`),
  formula(`IFERROR('输入数据'!O${n}/SUM('输入数据'!O$4:O$${end}),0)`),
  formula(`IF(AND('输入数据'!I${n}>=90,'输入数据'!J${n}<=0),"战略合作",IF('输入数据'!I${n}>=90,"优化谈判",IF('输入数据'!J${n}<=0,"需改善交付","重点议价")))`),
  r.sourceType,
 ];});
 const summary=[...headers('指标计算追溯','可编辑权重和输入数据后在Excel自动重算；场景候选必须先核验',['指标','计算公式','来源与风险等级']),
  ['研发绩效总分','质量32%+技术28%+商务18%+交付12%+合规10%','原站演示和场景分值'],
  ['量产总分','交付28%+质量24%+商务18%+技术12%+合规10%+价格控制8%','价格控制=MAX(0,100−ABS(PPV)×5)'],
  ['风险分值','概率30%+影响27%+交付缺口18%+延期15%+偏差10%','阈值：≥55高；≥38中；否则低'],
  ['Spend占比','单家Spend / 当前筛选范围Spend总和','演示Spend不等于真实ERP采购额'],
  ['PPV四象限','OTD≥90% 及 PPV≤0%为分界','按供应商 OTD 和价格偏差'],
  ['分级','正式DEMO或情景属性 + 综合分 + 风险阈值','情景候选统一不进入批准供方'],
  ['质量事件','原站事件 + 明确标记的演示事件','本地手动事件仅存在浏览器会话，不会出现在服务端Excel'],
  ['审计限制','未接入企业QMS正式电子签名或ERP','不能作为GxP审批/真实风险证明']];
 return createWorkbook([
  {name:'计算口径',rows:summary,widths:[35,83,79]},
  {name:'权重规则',rows:headers('模型权重 · 可手动修改并重算','第4行研发；第5行量产；第6行风险',['模型','A项','B项','C项','D项','E项','F项']).concat([
   ['研发：质量 技术 商务 交付 合规',.32,.28,.18,.12,.10,0],
   ['量产：交付 质量 商务 技术 合规 价格',.28,.24,.18,.12,.10,.08],
   ['风险：概率 影响 OTD缺口 延期 偏差',.30,.27,.18,.15,.10,0]
  ]),widths:[42,20,20,20,20,20,20]},
  {name:'输入数据',rows:headers('全体候选输入参数','原站DEMO vs 情景，所有输入字段都列示',['供应商ID','名称','来源类型','质量','交付','技术','合规','商务','OTD','PPV','平均延期天数','质量偏差数','概率','影响','SpendUSD','备选数']).concat(entries),widths:[20,40,32,16,16,16,16,16,18,18,19,18,18,18,24,18]},
  {name:'评分与风险',rows:headers('加权评分 / 分级 / PPV四象限（全部使用Excel公式）','输入数据或权重变化后Excel自动重算；不等于已批准供应商评价',['供应商ID','名称','研发总分','量产总分','风险总分','风险等级','采购分层','Spend占比','OTD×PPV象限','来源']).concat(calculated),widths:[20,40,22,22,23,20,28,24,28,35]},
  {name:'质量事件',rows:headers('质量事件来源与整改建议','原站DEMO、扩展情景必须分离；正式QMS事件/附件尚未接入',['编号','供应商','来源','问题','初步原因','所需文件','复盘结论','跟进里程碑','状态']).concat(m.qualityEvents.map(x=>[x.event_id,x.supplier,x.origin,x.issue,x.reason,x.documents,x.conclusion,x.milestone,x.progress])),widths:[23,42,30,45,50,60,55,38,24]},
  {name:'建议依据',rows:headers('管理建议和触发因子的文字解释','确定性规则输出；不是AI私有推理链',['优先级','标题','等级','Spend','触发数字与规则','建议措施','计划节点','来源']).concat(m.advice.map((r,i)=>[i+1,r.title,r.risk,r.spend,r.desc,r.action,r.milestones,r.origin])),widths:[17,42,21,23,80,80,50,32]}
 ]);
}
