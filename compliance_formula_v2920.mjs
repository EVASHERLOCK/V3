/* Formula-first compliance workbook. Uses only registry inputs passed from
   server; never treats an original DEMO certificate as official authorization. */
import {enterpriseAnalysis} from './enterprise_v08.mjs';
import {createWorkbook} from './formula_workbook.mjs';
const h=(a,b,cols)=>[[a],[b],cols];
const f=x=>({formula:x});
const iso=x=>/^20\d{2}-\d{2}-\d{2}$/.test(String(x||''))?String(x):'';
export function exportComplianceWorkbook({managedDocuments=[],managedTasks=[]}={}){
 const raw=enterpriseAnalysis({});
 const origin=(raw.qualification?.documents||[]).map(x=>({...x,id:x.doc_id,origin:'原站DEMO：非GxP批准'}));
 const records=[...origin,...managedDocuments.map(x=>({...x,origin:'授权服务端登记：仍待核验'}))];
 const n=records.length,end=3+n;
 const inputs=records.map((x,i)=>{const r=i+4;return [x.id||x.doc_id,x.supplier_id,x.site_id,x.material_id,x.type,x.version||'',x.status||'',iso(x.expiry),x.origin||'',f(`IF(H${r}="","",DATE(LEFT(H${r},4),MID(H${r},6,2),RIGHT(H${r},2))-TODAY())`),f(`IF(AND(G${r}="Valid",ISNUMBER(J${r}),J${r}>=0),1,0)`),f(`IF(AND(ISNUMBER(J${r}),J${r}>=0,J${r}<=30),1,0)`),f(`IF(AND(ISNUMBER(J${r}),J${r}>30,J${r}<=90),1,0)`),f(`IF(OR(AND(ISNUMBER(J${r}),J${r}<0),G${r}="void",G${r}="returned",G${r}="Expired"),1,0)`)]});
 const relevant=(raw.qualification?.sources||[]).map((x,i)=>{const r=i+4;return [x.supplier_id,x.site_id,x.material_id,x.approved_for_use?1:0,x.in_asl_for_site?1:0,x.prequalified?1:0,x.critical_expired?1:0,f(`IF(AND(D${r}=1,E${r}=1,F${r}=1,G${r}=0),1,0)`),'V08 原站 DEMO 字段；非企业授权ASL']});
 const sourcesEnd=3+relevant.length;
 const tasks=[...(raw.documents?.gaps||[]).map(x=>({id:x.gap_id,supplier_id:x.supplier_id,task:'补件 · '+x.type,owner:x.owner,due:x.due,status:x.status,origin:'原站DEMO'})),...managedTasks.map(x=>({...x,origin:'授权服务端登记'}))];
 const tasksRows=tasks.map((x,i)=>{const r=i+4;return [x.id,x.supplier_id,x.task,x.owner,iso(x.due),x.status,x.origin,f(`IF(E${r}="","",MAX(0,TODAY()-DATE(LEFT(E${r},4),MID(E${r},6,2),RIGHT(E${r},2))))`)]});
 return createWorkbook([
 {name:'指标解释',rows:h('合规与证据中心 · 可重算公式','V2.9.20；来源：DEMO+授权登记。证书登记不能自动取得 GMP / CEP / ASL 准入。',['指标','计算口径','证据范围 / 规则限制']).concat([
  ['受控文件','COUNT(文件登记ID)','按供应商 × Site × Material × 文件类型登记；原站与授权记录均标记来源'],
  ['登记有效率','有效登记数 / 文件总数 × 100%','有效=Valid AND 未到期，非监管官方核验'],
  ['30天内到期','0 ≤ 到期日−今天 ≤ 30','动态 TODAY，日期未知不放入分子'],
  ['31–90天内到期','30 < 到期日−今天 ≤ 90','不重复计入30天内'],
  ['登记风险缺口','到期 OR void OR returned OR Expired','是登记警示，不代表官方重大缺陷判定'],
  ['原站示例合格组合','approved_for_use AND in_asl_for_site AND prequalified AND NOT critical_expired','原站DEMO并非正式ASL，电子审批与真实ERP需另行集成'],
  ['补件逾期天数','MAX(0, TODAY−计划到期日)','状态是否关闭须责任部门核实'],
  ['文字诊断','数据门槛 -> 触发数字 -> 建议 -> 证据缺口','不得把相关关系说成根因因果证明']]),widths:[34,86,82]},
 {name:'文件登记输入',rows:h('登记文件输入（含源头标记）','修改输入后将依据 TODAY 重算到期天数、登记有效、临期、风险。',['ID','供应商','Site','物料','文件类型','版本','状态','到期日期ISO','来源','剩余天数公式','登记有效(0/1)','30日临期(0/1)','31–90日(0/1)','风险(0/1)']).concat(inputs),widths:[30,18,20,20,30,20,20,22,36,19,18,18,18,18]},
 {name:'关键指标公式',rows:h('关键指标 · Excel公式汇总','分母为全部文件登记；未接入官方证书平台，不用于正式GxP/ASL。',['指标','重算结果','公式说明','分子','分母']).concat([
  ['受控文件',f(`COUNTA('文件登记输入'!A4:A${end})`),'非唯一业务批准数',null,null],
  ['登记有效',f(`SUM('文件登记输入'!K4:K${end})`),'Valid且到期日≥今天',null,null],
  ['30天内到期',f(`SUM('文件登记输入'!L4:L${end})`),'0≤剩余天数≤30',null,null],
  ['31–90天',f(`SUM('文件登记输入'!M4:M${end})`),'30<剩余天数≤90',null,null],
  ['登记风险缺口',f(`SUM('文件登记输入'!N4:N${end})`),'到期/作废/退回/失效',null,null],
  ['有效登记率',f(`IFERROR(B5/B4,0)`),'文件有效数/全部登记数',f('B5'),f('B4')],
  ['原站示例合格组合',f(`SUM('资格组合输入'!H4:H${sourcesEnd})`),'仅演示字段，不自动写入ERP',null,null],
  ['整改任务数',tasks.length,'原站+授权整改登记',null,null]
 ]),widths:[37,25,70,20,20]},
 {name:'资格组合输入',rows:h('准入资格组合 · 原站演示字段','1 / 0 是登记字段，不是真实准入批准',['供应商','Site','物料','approved_for_use','in_asl_for_site','prequalified','critical_expired','组合公式','来源警示']).concat(relevant),widths:[22,22,23,23,22,22,22,19,59]},
 {name:'整改任务输入',rows:h('CAPA / 补件任务','状态、原因、负责人应由责任部门验证；逾期为日历差值',['ID','供应商','任务','责任人','截止日期','当前状态','来源','逾期天数公式']).concat(tasksRows),widths:[28,23,58,26,22,26,35,22]},
 {name:'诊断规则与边界',rows:h('可解释诊断 · 规则和需要的数据','以下为条件触发建议，不是未经证明的根因或AI推理链',['诊断','触发公式 / 阈值','输入数字','建议措施','尚缺外部证据']).concat([
  ['30天内到期证书',"'关键指标公式'!B6 > 0",f("'关键指标公式'!B6"),'安排证书补件与QA/RA有效性核验','官网当前证书状态、关联产品和生产站点'],
  ['登记失效或退回',"'关键指标公式'!B8 > 0",f("'关键指标公式'!B8"),'通知供应商，评估在途与新采购限制','ERP订单和QMS/ASL真实状态'],
  ['整体登记覆盖',"'关键指标公式'!B9 < 0.90",f("'关键指标公式'!B9"),'优先检查无记录/过期受控文件','分物料强制文件清单及RA适用性'],
  ['资格组合提醒',"'关键指标公式'!B10 = 0",f("'关键指标公式'!B10"),'启动供应商质量准入/备选来源开发','实际签核与厂址-物料-市场登记链']
 ]),widths:[35,72,24,78,81]}
 ]);
}
