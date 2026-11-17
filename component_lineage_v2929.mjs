/** V2.9.29 · Component contract matcher, calculation methods and transparent
 * narrative audit. A rule mapping is not proof that missing ERP/QMS inputs exist.
 * No fabricated supplier approvals, root causes or financial values. */
import {METRICS} from './metric_registry_v2921.mjs';
import {ACTIONS} from './analysis_rules_v2922.mjs';
import {PAGE_METRIC_INDEX} from './page_metric_manifest_v2923.mjs';

// Each pattern corresponds to a concrete business operation, not an arbitrary
// page-wide generic formula. More specific matches precede broader patterns.
export const COMPONENT_CONTRACTS=Object.freeze([
 {id:'delivery-price-matrix',re:/OTD\s*[×x*]\s*PPV|PPV\s*[×x*]\s*OTD|交付.*价格.*矩阵/i,metrics:['SRC.PO.OTD','SRC.PO.PPV','SRC.PO.PPV_AMOUNT'],actions:['ACT.DELIVERY.INVESTIGATE','ACT.COST.PPV'],method:'先按订单逐行计算准交判断与价格基准差，再分别求 OTD、PPV；采用 OTD 90% 与 PPV 0% 作为演示象限分界，两个指标不相乘。'},
 {id:'otd',re:/OTD|准时交付|准交率|交付.*趋势|交付.*排名|交付.*状态|延误|延期|催货|承诺交期/i,metrics:['SRC.PO.OTD','SRC.PO.LATE_COUNT','SRC.PO.AVG_LATE_DAYS','SRC.PO.LATE_RATE','SRC.PO.ON_TIME_COUNT'],actions:['ACT.DELIVERY.INVESTIGATE'],method:'先筛选有可判交期的订单行；逐行比较交期与到货/延误记录，再计算准时行数/有效交期行数、延期数和延期均值。'},
 {id:'bom-waterfall',re:/BOM.*瀑布|成本.*拆解|BOM.*目标|目标成本|BOM.*差额/i,metrics:['SRC.BOM.LINE_COUNT','SRC.BOM.TARGET_TOTAL','SRC.BOM.QUOTED_TOTAL','SRC.BOM.VARIANCE','SRC.BOM.VARIANCE_RATE','SRC.PO.BENCHMARK_SPEND'],actions:['ACT.COST.PPV'],method:'同一物料、同一币种：逐行数量×目标单价得目标成本、数量×报价单价得报价成本；两者相减得到差额。无受控 BOM 行时不得由图形形状反推成本。'},
 {id:'quote-comparison',re:/供应商报价|询价|RFQ|比价|报价.*排行|最优.*报价|MOQ/i,metrics:['SRC.RFQ.RECORDS','SRC.RFQ.BEST_UNIT','SRC.RFQ.AVG_UNIT','SRC.QUOTE.COUNT','SRC.QUOTE.BEST_LANDED'],actions:['ACT.COST.PPV'],method:'按物料与币种匹配报价；逐行标记 MOQ、报价日期、运费和审查状态；只有可比报价进入最低价和均值。'},
 {id:'ppv',re:/PPV|价差|价格偏差|价格趋势|历史价格|价格基线|价格.*对标|价格.*异常/i,metrics:['SRC.PO.PPV','SRC.PO.PPV_AMOUNT','SRC.PO.BENCHMARK_SPEND','SRC.PO.WEIGHTED_PRICE','SRC.PO.WEIGHTED_BASELINE'],actions:['ACT.COST.PPV'],method:'逐笔以采购数量×(实际单价−基准单价)算价差金额；以数量×基准单价之和为分母求 PPV，按同一物料/币种/期间过滤。'},
 {id:'savings',re:/降本|节约|Savings|成本.*机会|成本.*复盘|成本.*达成/i,metrics:['SRC.SAVINGS.PLANNED','SRC.SAVINGS.REALIZED','SRC.SAVINGS.ATTAINMENT','SRC.PO.PPV_AMOUNT'],actions:['ACT.SAVINGS.ATTAINMENT'],method:'先分开登记计划节约、已经实现且经确认的节约，再计算实现额/计划额；情景降幅不是已兑现节约，缺乏财务确认要标为假设。'},
 {id:'gantt',re:/项目.*甘特|甘特图|阶段进度|项目.*进度|里程碑|计划周期|准入.*阶段/i,metrics:['SRC.PROJECT.STAGES','SRC.PROJECT.DONE','SRC.PROJECT.PROGRESS','SRC.PROJECT.BLOCKED'],actions:['ACT.CHANGE.CONTROL_REVIEW'],method:'按计划开始/结束日期计算阶段天数；从受控阶段状态统计 DONE/总阶段数，未签核的情景排程仅可展示，不能视为实际完成。'},
 {id:'supplier-scoring',re:/评分对比|五维.*评分|五维能力|能力雷达|供应商.*得分|综合得分|技术.*评分|商业得分|绩效评分|评价矩阵/i,metrics:['SRC.SCORE.REVIEWS','SRC.SCORE.WEIGHTED_MEAN','SRC.SCORE.TOP'],actions:['ACT.QMS.CRITICAL_REVIEW'],method:'分别列出质量、交付、技术、合规、商务五项评分及权重；验证各权重之和等于100%，再逐项 score×weight/100 汇总。无评分原始依据不得推定得分。'},
 {id:'tier',re:/供应商分级|供应商层级|战略供应商|优先供应商|供应商.*分布/i,metrics:['SRC.PO.ACTIVE_SUPPLIERS','SRC.SCORE.REVIEWS','SRC.SCORE.WEIGHTED_MEAN'],actions:['ACT.RISK.SUPPLIER_CONCENTRATION'],method:'按有记录的供应商逐家应用分级阈值，再按类别 COUNTIF；类别份额=该类家数/有分类依据的总家数。情景候选不可自动取得正式资格。'},
 {id:'quality',re:/质量事件|质量投诉|偏差|OOS|来料.*检验|IQC|质量.*历史|质量.*台账|质量.*异常/i,metrics:['SRC.QMS.EVENT_COUNT','SRC.QMS.CRITICAL_COUNT','SRC.QMS.OPEN_DEVIATIONS','SRC.QEVENT.COUNT','SRC.QEVENT.OPEN'],actions:['ACT.QMS.CRITICAL_REVIEW'],method:'逐条按事件ID、严重度、状态和关闭证据统计；无完整分母时不得推断IQC合格率或将没有记录误当零事件。'},
 {id:'capa',re:/CAPA|整改|审核发现项|审计整改|整改率|整改闭环/i,metrics:['SRC.QMS.OPEN_CAPA','SRC.QMS.OVERDUE_CAPA','SRC.QMS.CAPA_CLOSED_RATE','SRC.AUDIT.OPEN_FINDINGS'],actions:['ACT.QMS.CAPA_ESCALATE','ACT.AUDIT.FINDINGS'],method:'对每项 CAPA 检查责任人、计划截止日、提交/验证状态；按有效记录计算逾期与关闭比率，验证/关闭须有QA/QMS证据。'},
 {id:'risk',re:/风险等级|风险分类|供应链风险|风险可视|风险矩阵|风险.*热力图|风险.*分布|风险概率|依赖风险|风险.*台账/i,metrics:['SRC.PO.CR3_SHARE','SRC.PO.CR5_SHARE','SRC.PO.SPEND','SRC.PO.LATE_RATE'],actions:['ACT.RISK.SUPPLIER_CONCENTRATION','ACT.SOURCE.SECOND'],method:'先计算有来源的供应商采购金额和 CR3/CR5，再核对可替代厂址与质量准入。风险概率/影响等主观数需单独风险评估证据与阈值，不能从图形坐标反推。'},
 {id:'alternatives',re:/替代覆盖|双源|第二来源|备选|独家|单源|单一来源|来源.*覆盖/i,metrics:['SRC.QUAL.COMBINATIONS','SRC.QUAL.RECORDED','SRC.PO.CR5_SHARE'],actions:['ACT.SOURCE.SECOND','ACT.RISK.SUPPLIER_CONCENTRATION'],method:'按同物料、相同适用市场和Site分组检查合格来源数；有登记不代表正式ASL批准。结合采购集中度决定是否触发二供评估。'},
 {id:'spend',re:/采购金额|Spend|采购支出|支出.*品类|采购预算|年度预算|采购.*结构|累计采购|供方.*金额|集中度|TOP5/i,metrics:['SRC.PO.SPEND','SRC.PO.BENCHMARK_SPEND','SRC.PO.CR3_SHARE','SRC.PO.CR5_SHARE','SRC.PO.COUNT'],actions:['ACT.RISK.SUPPLIER_CONCENTRATION'],method:'逐笔订单数量×成交单价复核金额；按供应商、品类及月份分组求和，并将分组之和与源订单总和对账。预算执行率另需批准预算作分母。'},
 {id:'purchase',re:/采购执行|采购订单|采购.*台账|PO.*执行|订单.*台账|收货|在途|供货.*履约/i,metrics:['SRC.PO.COUNT','SRC.PO.QUANTITY','SRC.PO.RECEIVED_QTY','SRC.PO.UNRECEIVED_QTY','SRC.PO.RECEIPT_RATE'],actions:['ACT.RECEIPT.GAP'],method:'按源PO对账数量、收货量、未收货量；逐笔核对 GR 单号和日期，避免将收货数量误认为 QA 已放行可用库存。'},
 {id:'inventory',re:/库存|安全库存|批次|效期|复验|待放行|可用量|物料需求|缺料|库存.*覆盖|实际消耗/i,metrics:['SRC.INVENTORY.LOTS','SRC.INVENTORY.QC_HOLD','SRC.INVENTORY.RETEST_90','SRC.PO.UNRECEIVED_QTY'],actions:['ACT.INVENTORY.RETEST_REVIEW','ACT.RECEIPT.GAP'],method:'区分库存批次状态Released/Hold/Quarantine，按物料需求与已放行数量比对缺口；未经 QA 放行的批次不得计入可生产库存。'},
 {id:'qualification',re:/合规|资质|准入|证据|审批|证书|CEP|GMP|DMF|文件|合同.*附件|官方.*核验/i,metrics:['SRC.DOC.COUNT','SRC.DOC.VALID_RATE','SRC.DOC.DUE_30','SRC.DOC.DUE_90','SRC.EVIDENCE.DOCUMENTS','SRC.EVIDENCE.REGISTERED_VALID_RATE'],actions:['ACT.DOC.RECHECK'],method:'按 Supplier×Site×Material×市场和文件版本审核证据状态及到期日期；有登记与审核通过必须区分，不能自动推定官方认证或ASL准入。'},
 {id:'contract',re:/合同|框架协议|续签|采购协议|协议.*有效/i,metrics:['SRC.CONTRACT.COUNT','SRC.CONTRACT.ACTIVE','SRC.CONTRACT.DUE90'],actions:['ACT.CONTRACT.RENEWAL'],method:'按合同版本、开始/结束日期及状态计算有效和临期数量；没有真实合同签署文件时仅为演示台账。'},
 {id:'invoice',re:/发票|账龄|付款|三单匹配|对账|P2P|应付/i,metrics:['SRC.INVOICE.COUNT','SRC.INVOICE.MATCH_RATE','SRC.INVOICE.EXCEPTIONS','SRC.INVOICE.OVERDUE','SRC.INVOICE.AMOUNT'],actions:['ACT.INVOICE.MATCH_EXCEPTION','ACT.INVOICE.OVERDUE_REVIEW'],method:'按 PO/GR/Invoice 逐行对比物料、币种、数量、单价和税额，分开计算匹配数、异常数与逾期未付数。'},
 {id:'change',re:/变更|注册|法规|市场.*准入|RA.*评估|CMC|监管/i,metrics:['SRC.CHANGE.COUNT','SRC.CHANGE.OPEN','SRC.CHANGE.HIGH','SRC.REG.FILINGS'],actions:['ACT.CHANGE.CONTROL_REVIEW'],method:'按受控变更编号、批准时间、状态、受影响产品和上市市场逐条联结；不能把一个国家的变更批准视作全球批准。'},
 {id:'audit',re:/审计|GMP.*检查|审核.*计划|发现项/i,metrics:['SRC.AUDIT.COUNT','SRC.AUDIT.OPEN_FINDINGS'],actions:['ACT.AUDIT.FINDINGS'],method:'按审计ID统计发现项、关闭证据和目标日；无QA确认不能认定整改已关闭。'},
 {id:'market',re:/市场.*供给|官方.*发现|供应商候选|候选名录|供应商.*目录|官网/i,metrics:['SRC.CANDIDATE.TOTAL','SRC.CANDIDATE.SCENARIO','SRC.CANDIDATE.OFFICIAL'],actions:['ACT.MARKET.SUPPLY_SIGNAL'],method:'按来源等级去重企业线索，区分企业主体、厂址、物料和许可状态；线索不直接等于批准供方或可用于订单的产能。'},
 {id:'workflow',re:/工作流|执行历史|成功率|执行.*失败|数据血缘|AI.*执行/i,metrics:['SRC.WORKFLOW.RUNS','SRC.WORKFLOW.FAILURES','SRC.WORKFLOW.SUCCESS_RATE'],actions:['ACT.WORKFLOW.RELIABILITY'],method:'统计受控执行记录与失败/成功事件；执行日志缺失时不得声明全部成功或计算服务SLA。'},
 {id:'alerts',re:/告警|预警|通知|高风险项|风险.*提示/i,metrics:['SRC.ALERT.HIGH','SRC.DOC.DUE_30','SRC.QMS.OVERDUE_CAPA','SRC.PO.LATE_RATE'],actions:['ACT.ALERT.HIGH_REVIEW'],method:'先逐项执行风险触发阈值，再归并去重对应供应商、物料、Site和责任人；公告线索不能自动推定企业合规违规。'},
 {id:'master',re:/主数据|物料分类|主体.*资料|供应商.*档案|公司全景|企业画像/i,metrics:['SRC.MASTER.SUPPLIERS','SRC.MASTER.MATERIALS','SRC.CANDIDATE.TOTAL'],actions:[],method:'按唯一 Supplier ID、Site ID、Material ID 去重并核对字段完整性；未提供工商和财务来源时不推断事实。'},

 {id:'planning-deviation',re:/误差.*根因|归因交叉|差异原因|偏差.*原因|异常.*类型|管理行动|管理.*优先级/i,metrics:['SRC.PO.LATE_COUNT','SRC.PO.PPV_AMOUNT','SRC.PO.UNRECEIVED_QTY'],actions:['ACT.DELIVERY.INVESTIGATE','ACT.RECEIPT.GAP'],method:'先核算可确定的差额及频次，再按原始记录的显式原因字段分类。原因只是一项调查假设；没有调查编号及证明不能称为已证实根因。'},
 {id:'category-budget',re:/预算准确率|预算.*占比|预算资金|预算.*编制|分类.*金额|品类预算|库存资金/i,metrics:['SRC.PO.SPEND','SRC.PO.BENCHMARK_SPEND','SRC.PO.PPV_AMOUNT','SRC.INVENTORY.LOTS'],actions:['ACT.COST.PPV'],method:'用相同期间的已批准预算金额与实际使用额计算差异率；未取得预算批准版本时只能比较原站演示基准，不称预算执行率。'},
 {id:'stock-health',re:/资金.*趋势|库存.*金额|呆滞.*金额|库存.*优化|期末批次|库存.*周转/i,metrics:['SRC.INVENTORY.LOTS','SRC.INVENTORY.QC_HOLD','SRC.INVENTORY.RETEST_90','SRC.PO.SPEND'],actions:['ACT.INVENTORY.RETEST_REVIEW'],method:'按库存批次数量×可追溯单价复算账面估算；周转天数还需经确认的期初期末库存和期间领用成本，不能用现价直接代替。'},
 {id:'supplier-project-funnel',re:/项目漏斗|寻源.*漏斗|项目.*阶段.*数/i,metrics:['SRC.PROJECT.STAGES','SRC.PROJECT.DONE','SRC.PROJECT.BLOCKED'],actions:['ACT.SOURCE.SECOND'],method:'按唯一项目ID和受控阶段进度分组计数；演示漏斗仅说明情景阶段分布，不是正式已通过项目。'},
 {id:'kraljic',re:/Kraljic|卡拉杰克|四象限.*品类|品类分布|战略品|瓶颈品|杠杆品|非关键品/i,metrics:['SRC.PO.SPEND','SRC.PO.CR3_SHARE','SRC.PO.PPV'],actions:['ACT.RISK.SUPPLIER_CONCENTRATION'],method:'业务价值以同品类采购金额/价值分级；供应风险需要审核来源集中度、替代难度与市场风险权重，必须分别列出阈值才能进入四象限。'},
 {id:'analysis-narrative',re:/结论分析|管理建议|战略.*行动|行动.*建议|管理.*复盘|技术情报|产业洞察|预算.*说明|风险.*解读/i,metrics:['SRC.PO.SPEND','SRC.PO.OTD','SRC.PO.PPV','SRC.PO.CR3_SHARE'],actions:['ACT.DELIVERY.INVESTIGATE','ACT.COST.PPV','ACT.RISK.SUPPLIER_CONCENTRATION'],method:'先逐项引用源事实和对应阈值，再区分观察、可能原因、人工调查发现、正式行动建议；不得把价格、OTD或质量相关性写成已经确认的因果根因。'},
 {id:'regulatory-market',re:/目标市场.*分布|市场.*分布|风险级别|法规.*台账/i,metrics:['SRC.REG.FILINGS','SRC.CHANGE.COUNT','SRC.CHANGE.OPEN'],actions:['ACT.CHANGE.CONTROL_REVIEW'],method:'按有效注册记录的市场维度分组统计，记录公告来源与RA审核日期；没有数据不显示虚构的全球合规覆盖率。'},
 {id:'doc-type',re:/文档类型|文件类型|文件.*结构|文件.*分类|有效期分布|审批闭环状态|文件.*覆盖/i,metrics:['SRC.DOC.COUNT','SRC.DOC.VALID_RATE','SRC.DOC.DUE_30','SRC.DOC.DUE_90'],actions:['ACT.DOC.RECHECK'],method:'逐份按文件唯一编号、Site、物料、到期日期和受控审查状态分组，再计算占比。登记/有效不等于最终审批或上市市场资格。'},
 {id:'procurement-decision',re:/催货优先级|高风险事件|本周.*行动|整改.*建议|复盘.*行动/i,metrics:['SRC.PO.LATE_COUNT','SRC.PO.PPV_AMOUNT','SRC.QMS.OPEN_CAPA'],actions:['ACT.DELIVERY.INVESTIGATE','ACT.QMS.CAPA_ESCALATE'],method:'以可核查的延期天数、价差金额、CAPA状态等先计算排序依据，阈值触发后输出待确认行动，而不是生成不可追溯的自然语言原因。'},
 {id:'scenario',re:/情景.*模拟|采购情景|供给.*未来|模拟.*趋势|模拟.*历史/i,metrics:['SRC.PO.SPEND','SRC.PO.OTD'],actions:[],method:'情景数据必须逐项列出假设、输入、计算步骤和时间范围，且与原始ERP/PO实际值分区展示；无假设表不能宣称预测。'},
 {id:'supplier-comparison',re:/多供应商横向|参数对比|菱形评估|多选对比|供应商.*评价/i,metrics:['SRC.SCORE.REVIEWS','SRC.SCORE.WEIGHTED_MEAN','SRC.PO.OTD'],actions:[],method:'核对各供应商的原始参数、评价等级及评分权重，对同一维度分别比较；无报价/资格来源时仅能比较已登记的资料。'},

 {id:'capacity',re:/产能|排产|负荷|设备利用|峰值弹性/i,metrics:['SRC.PROJECT.STAGES','SRC.PO.QUANTITY'],actions:['ACT.RECEIPT.GAP'],method:'产能利用率=实际排产负荷/可用合格产能，需要独立厂区、产线、班次及QA放行状态；未提供产能来源时只能演示规划情景。'},
 {id:'financial-comparison',re:/总成本对比|成本.*对比|价格质量交付供应风险|报价.*达成率|供应商.*横向/i,metrics:['SRC.RFQ.RECORDS','SRC.RFQ.BEST_UNIT','SRC.PO.PPV'],actions:['ACT.COST.PPV'],method:'保持同物料、同币种、同有效期和相同需求量，分别计算报价、运输/MOQ和质量风险；不能把未经确认的情景报价当正式商务报价。'},
 {id:'procurement-coverage',re:/核心产品线采购策略|供应商.*评估结果|统一候选供应商|候选.*总数|来源.*目录/i,metrics:['SRC.CANDIDATE.TOTAL','SRC.CANDIDATE.SCENARIO','SRC.CANDIDATE.OFFICIAL','SRC.QUOTE.COUNT'],actions:['ACT.MARKET.SUPPLY_SIGNAL'],method:'去重候选Supplier ID，再将原始报价、情景估算和官方待核线索分别分组；候选≠有正式报价、GMP/CEP批准或ASL资格。'},
 {id:'quality-performance',re:/研发联合绩效|质量绩效|交付绩效|技术响应绩效|商务配合绩效|质量.*评分/i,metrics:['SRC.QMS.EVENT_COUNT','SRC.SCORE.WEIGHTED_MEAN','SRC.PO.OTD'],actions:['ACT.QMS.CRITICAL_REVIEW','ACT.DELIVERY.INVESTIGATE'],method:'分别核对质量事件、交付表现和受控评分维度；缺乏IQC数量/检验批次时不能推断来料合格率，缺乏技术响应事件时不能推断响应评分。'},
 {id:'document-project',re:/项目文档档案|文件.*检查清单|资料齐全率/i,metrics:['SRC.DOC.COUNT','SRC.EVIDENCE.DOCUMENTS','SRC.DOC.VALID_RATE'],actions:['ACT.DOC.RECHECK'],method:'按候选供应商×Site×物料对22类文件逐项核对有/无登记，登记覆盖率=有登记项数/应有文件项数；未批准文件不能标成正式准入合格。'},
 {id:'quality-batch',re:/批次.*追溯|ABC 关键物料|物料.*分层|呆滞.*批次/i,metrics:['SRC.INVENTORY.LOTS','SRC.INVENTORY.QC_HOLD','SRC.INVENTORY.RETEST_90'],actions:['ACT.INVENTORY.RETEST_REVIEW'],method:'按批次号、物料和放行状态对账数量、复验日期与风险分级。ABC分层必须声明采购金额、阈值和时间范围，否则只属于演示分类。'},
 {id:'master-qa',re:/数据质量|字段校验|敏感数据|角色.*能力|角色.*结构|演示账户目录/i,metrics:['SRC.MASTER.MATERIALS','SRC.MASTER.SUPPLIERS'],actions:[],method:'对字段完整性、唯一主键、来源时间戳与权限规则进行逐项判定；用户/角色目录不能用采购金额公式解释。'},
 {id:'document-ledger',re:/文档台账|受控.*台账|文件.*主台账|GMP.*核验/i,metrics:['SRC.DOC.COUNT','SRC.DOC.VALID_RATE','SRC.EVIDENCE.DOCUMENTS'],actions:['ACT.DOC.RECHECK'],method:'按受控文件编号、版本、供应商、Site、物料与有效期逐条登记，所有状态变更必须保留责任人和时间戳。'},
 {id:'data-integration',re:/Excel \/ CSV|数据源|ERP.*映射|三单.*明细|3-Way Matching/i,metrics:['SRC.INVOICE.MATCH_RATE','SRC.PO.COUNT'],actions:['ACT.INVOICE.MATCH_EXCEPTION'],method:'数据导入/映射需保存原字段、转换表达式、被拒绝行数与映射版本；企业来源未授权时所有计算留在演示模式。'},

 {id:'operations',re:/角色结构|账号角色|角色切换|操作记录|报表.*模板|报表.*类型|导出.*模板|快捷功能|自动发现设置|人工证据核验|ERP 映射暂存/i,metrics:[],actions:[],method:'此处属于功能配置或操作台，不应伪造采购财务计算。若出现次数、成功率等数值，只允许按真实操作日志ID计数；导出当前操作配置及缺失审计日志。'},

 {id:'portfolio-product',re:/核心产品线采购策略|Top30.*产品线|产品线采购结构/i,metrics:['SRC.PO.SPEND','SRC.PO.CR3_SHARE','SRC.PO.PPV'],actions:['ACT.RISK.SUPPLIER_CONCENTRATION'],method:'按产品线绑定的原材料与有效PO原始行计算采购金额、来源集中度和价格偏差；产品线营收与预算未接入不得臆造。'},
 {id:'rolling-budget',re:/月度滚动预算复盘|月度.*消耗.*金额|消耗数量.*金额/i,metrics:['SRC.PO.SPEND','SRC.PO.QUANTITY','SRC.PO.PPV_AMOUNT'],actions:['ACT.COST.PPV'],method:'分别按月汇总实际采购数量与数量×单价金额；滚动预算偏差需要审批版本和月度预算额度，未接入预算源只能展示演示来源PO与预算缺口。'},
 {id:'supplier-params',re:/供应侧参数|标准交期LT|最小起订量MOQ/i,metrics:['SRC.PO.AVG_LATE_DAYS','SRC.RFQ.RECORDS'],actions:['ACT.DELIVERY.INVESTIGATE'],method:'供应商交期需对比订单承诺与实收日期；MOQ和批量折扣来自版本有效报价原始行。未获正式RFQ时将参数列为演示假设。'},
 {id:'pricing-params',re:/价格侧参数|基准合同价|预计涨价幅度/i,metrics:['SRC.PO.PPV','SRC.PO.BENCHMARK_SPEND','SRC.RFQ.BEST_UNIT'],actions:['ACT.COST.PPV'],method:'逐项核对基准单价、报价有效期、币种、合同版本及运税。涨幅与运税比率是情景输入，需通过输入表先计算金额，不能当作正式价格。'},
 {id:'early-delivery',re:/提前到货|反向异常/i,metrics:['SRC.PO.OTD','SRC.PO.AVG_LATE_DAYS','SRC.PO.COUNT'],actions:['ACT.DELIVERY.INVESTIGATE'],method:'按 PO实际到货日期-承诺日期<0 筛选提前到货记录；无实际收货时间则展示待核验；切忌将提前到货自动视为质量或仓储风险。'},
 {id:'sourcing-branch',re:/分支判断节点|在研新品（NPI）|成熟量产.*技术评审|寻源路由/i,metrics:['SRC.PROJECT.STAGES','SRC.DOC.VALID_RATE'],actions:['ACT.SOURCE.SECOND'],method:'按NPI或量产物料类型确定必经技术评审、采购评审和合规前置检查分支；来源项目、物料风险与签核记录必须留痕，不按空白阶段自动批准。'},
 {id:'category-value-card',re:/品类名称|价值占比|采购金额.*需求状态/i,metrics:['SRC.PO.SPEND','SRC.PO.CR3_SHARE','SRC.PO.PPV'],actions:['ACT.RISK.SUPPLIER_CONCENTRATION'],method:'先按相同类别的PO金额汇总，价值占比=该品类金额÷当前范围合计金额，再独立检查供应来源数量和风险等级证据；未验证的不作正式风险级别。'},
 {id:'supplier-scores-table',re:/关键差异.?备注|商业评分.*准入|供应商.*Score.*准入|评估结果.*排序/i,metrics:['SRC.SCORE.REVIEWS','SRC.SCORE.WEIGHTED_MEAN','SRC.CANDIDATE.TOTAL'],actions:['ACT.SOURCE.SECOND'],method:'先按五维分数×受控权重计算综合分，按资格与来源可信度单独过滤再排序；分值未经评价记录不能当真实评分。'},
 {id:'supplier-qualification-table',re:/GMP.*CEP.*ASL|Site\/Material.*最终状态|最终状态.*Site.*物料/i,metrics:['SRC.DOC.COUNT','SRC.DOC.VALID_RATE','SRC.EVIDENCE.REGISTERED_VALID_RATE'],actions:['ACT.DOC.RECHECK'],method:'按唯一供应商/Site/Material/市场逐条核验GMP、CEP、正式ASL审批；文件存在、未过期、已审核是不同维度。'},
 {id:'savings-achievement',re:/目标达成率|降本.*达成率.*偏差/i,metrics:['SRC.SAVINGS.ATTAINMENT','SRC.SAVINGS.PLANNED','SRC.SAVINGS.REALIZED'],actions:['ACT.COST.SAVINGS_REVIEW'],method:'按计划降本额与可证明实现额计算达成率；存在超过目标封顶100%的显示规则时额外注明，并用逐笔PO/财务贷项证明实现值。'},
 {id:'savings-idea',re:/替代材料|工艺优化|长期框架|物流拼箱|港口优化|付款条款|汇率策略|降幅假设/i,metrics:['SRC.SAVINGS.PLANNED','SRC.SAVINGS.REALIZED','SRC.PO.PPV'],actions:['ACT.COST.SAVINGS_REVIEW'],method:'情景降本=同物料参考成本×假设降幅，需扣除注册验证、切换、物流、汇率与质量额外成本。假设百分比仅是未经验证的输入；缺少参考成本或证明时不宣称可实现。'},
 {id:'supplier-distribution',re:/供应商总数|战略协作Strategic|优先供方Preferred|跟踪整改/i,metrics:['SRC.CANDIDATE.TOTAL','SRC.MASTER.SUPPLIERS','SRC.SCORE.REVIEWS'],actions:['ACT.RISK.SUPPLIER_CONCENTRATION'],method:'按唯一供应商编号及最后有效分级记录逐类计数并除以同一来源总数；不得把77家演示候选生成的等级算作真实ASL/绩效评级。'},
 {id:'site-material-qualification',re:/登记有效率.*原站ASL|供应商.*Site.*物料.*市场|原站ASL状态/i,metrics:['SRC.DOC.COUNT','SRC.DOC.VALID_RATE','SRC.EVIDENCE.DOCUMENTS'],actions:['ACT.DOC.RECHECK'],method:'分母=该Site/Material应有文件数量，分子=有效且完成所需审核的唯一文件数量；缺乏证据应列缺口而不是视为批准。'},
 {id:'approval-status-count',re:/18登记|登记有效.*审查中|服务端流程.*其他/i,metrics:['SRC.DOC.COUNT','SRC.DOC.VALID_RATE','SRC.DOC.DUE_30'],actions:['ACT.DOC.RECHECK'],method:'按文件编号与审批状态分组；原始受控文件和服务端工作流两套来源不得直接重复计数。'},
 {id:'regulatory-fda-inspection',re:/FDA.*Inspection Classification|FDA.*检查分类/i,metrics:['SRC.REG.FILINGS','SRC.AUDIT.COUNT'],actions:['ACT.AUDIT.FINDINGS'],method:'FDA 检查分类与警告信须以FDA官方记录日期、场地和检查编号核对；无最新官方返回只能显示待联网，不能认定其“GMP证书”有效。'},
 {id:'supplier-profile-single',re:/Aster Pharma Materials|Boreal Chemicals|Cedar Life Sciences/i,metrics:['SRC.MASTER.SUPPLIERS','SRC.DOC.COUNT','SRC.PO.SPEND'],actions:['ACT.DOC.RECHECK'],method:'供应商档案字段应按受控Supplier/Site ID关联工商、财务、PO、合规证据；档案存在不代表所有类别均有来源数据。'},
 {id:'filter-controls',re:/来源\/风险类型|事件等级|完成状态|模块4$/i,metrics:[],actions:[],method:'此区域属于条件选择或字段分组，没有单独业务计算。展开表提供当前可见字段、筛选条件及操作证据，不得用无关采购数据填充。'},
 {id:'dashboard',re:/驾驶舱|总览|概览|经营.*摘要|财务.*指标|核心.*KPI/i,metrics:['SRC.PO.SPEND','SRC.PO.OTD','SRC.PO.PPV','SRC.PO.ACTIVE_SUPPLIERS'],actions:['ACT.DELIVERY.INVESTIGATE','ACT.COST.PPV'],method:'分别计算各基础指标；不要把金额、OTD、PPV按无依据的权重合成一个绩效分。每一指标保留独立分子/分母。'},
]);
const unique=a=>[...new Set(a)];
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
export function resolveComponentLineage(input){
 const title=clean(input.title), group=clean(input.group_title), full=[title,group,...(input.tables||[]).flatMap(t=>t.headers||[]),...(input.figures||[]).map(x=>x.label),...(input.narratives||[]).slice(0,6)].join(' ').slice(0,2500);
 const explicit=(input.metrics||[]).filter(id=>Object.hasOwn(METRICS,id));
 const actions=(input.actions||[]).filter(id=>Object.hasOwn(ACTIONS,id));
 const primary=COMPONENT_CONTRACTS.filter(rule=>rule.re.test(title));
 const secondary=primary.length?[]:COMPONENT_CONTRACTS.filter(rule=>rule.re.test(group||full)).slice(0,2);
 const contracts=primary.length&&primary[0].id==='delivery-price-matrix'?[primary[0]]:[...primary.slice(0,3),...secondary].slice(0,4);
 let ids=unique([...explicit,...(explicit.length>=2?[]:contracts.flatMap(x=>x.metrics)),...(explicit.length>=2?[]:contracts.flatMap(x=>x.actions.flatMap(a=>ACTIONS[a]?.metrics||[])))]).filter(id=>Object.hasOwn(METRICS,id));
 let act=unique([...actions,...contracts.flatMap(x=>x.actions)]).filter(id=>Object.hasOwn(ACTIONS,id));
 // Fallback is strictly a route-level research suggestion, never proof of the
 // selected figure. It is exported as a separate, explicitly unbound list.
 const contextual=contracts.length?[]:(PAGE_METRIC_INDEX[input.route]||[]).filter(x=>Object.hasOwn(METRICS,x)).slice(0,6);
 const methods=unique(contracts.map(x=>x.method));
 const noCalculation=/完成状态|来源\/风险类型|事件等级|模块4|搜索|列设置|每页|切换|导出|打印|新增|上传|连接|配置|自动发现设置|角色结构|模板库|快捷功能|帮助|数据源管理|操作日志|安全连接/i.test(title) && !(input.tables||[]).some(t=>t.rows?.length) && !(input.charts||[]).some(c=>c.series?.length);
 if(/OTD/i.test(full)&&/PPV/i.test(full)){ids=unique([...ids,'SRC.PO.OTD','SRC.PO.PPV']);}
 return {component_id:input.component_id||'',route:input.route,title,contracts:contracts.map(x=>x.id),metrics:ids.slice(0,35),actions:act.slice(0,12),methods,contextual_metrics:contextual,
  binding_status:contracts.length?'DOMAIN_RULE_MATCH':explicit.length?'EXPLICIT_METRIC_MATCH':noCalculation?'NO_BUSINESS_CALC_REQUIRED':'NO_BUSINESS_FORMULA_MATCH',
  note:'业务规则匹配只确定“应使用的算法”；有原始行与非空分母才能声明源数据已复算。页面快照的数值不等于ERP/QMS业务事实。'};
}
const toN=v=>{if(typeof v==='number')return Number.isFinite(v)?v:null;const s=String(v??'').replace(/[,，\s]/g,'').replace(/[$¥€]/g,'');return /^[-+]?\d+(\.\d+)?$/.test(s)?Number(s):null};
export function assessDisplayedTables(tables=[]){return (tables||[]).map((t,i)=>{
 const cols=(t.headers||[]).map(x=>clean(x).toLowerCase()),rows=t.rows||[];
 const profiles=cols.map((name,index)=>{const numeric=rows.map(x=>toN(x[index])).filter(v=>v!==null);const percent=/%|rate|率|占比|ppv|otd|完成度/i.test(name);const type=/(数量|qty|金额|amount|spend|sum|价格|单价|总额|得分|评分|权重|率|天数|amount)/i.test(name)?'NUMERIC':/(风险|状态|供应商|物料|厂址|部门|国家|类别|类型|等级)/i.test(name)?'CATEGORY':'UNKNOWN';return {column_index:index,header:t.headers[index]||`列${index+1}`,type,known_count:numeric.length,sum:type==='NUMERIC'&&numeric.length?numeric.reduce((a,b)=>a+b,0):null,mean:type==='NUMERIC'&&numeric.length?numeric.reduce((a,b)=>a+b,0)/numeric.length:null,percent};});
 const find=re=>cols.findIndex(x=>re.test(x));
 const qty=find(/采购量|数量|ordered_qty|qty/),price=find(/单价|unit_price|price_usd/),weight=find(/权重|weight/),score=find(/得分|评分|score/),actual=find(/实际|actual/),baseline=find(/基准|预算|目标|baseline|target/);
 const calculations=[];
 if(qty>=0&&price>=0&&qty!==price)calculations.push({name:'逐行金额',operation:'MULTIPLY',columns:[qty,price],expression:`${t.headers[qty]} × ${t.headers[price]}`,source:'DISPLAY_ROW',limitation:'UI字段逐行演算；仅当金额单位/币种一致且行可追溯时才能用于业务金额。'});
 if(weight>=0&&score>=0&&weight!==score)calculations.push({name:'分项加权贡献',operation:'WEIGHTED',columns:[score,weight],expression:`${t.headers[score]} × ${t.headers[weight]}÷(100或1)`,source:'DISPLAY_ROW',limitation:'必须先核实评分上限与每家供应商权重合计100%。'});
 if(actual>=0&&baseline>=0&&actual!==baseline)calculations.push({name:'实际与目标差额',operation:'DIFFERENCE',columns:[actual,baseline],expression:`${t.headers[actual]} − ${t.headers[baseline]}`,source:'DISPLAY_ROW',limitation:'必须验证期间、计量单位和基准版本一致。'});
 return {title:t.title||`表${i+1}`,row_count:t.row_count??rows.length,visible_rows:rows.length,columns:profiles,calculations,has_business_formula:calculations.length>0,scope:'页面当前可见行，不保证含翻页/隐藏数据'};
 })}
export function auditNarrativeParagraphs(input,actionReports=[],metricReports=[],resolved=null){
 const knownRules=actionReports.filter(x=>!['UNREGISTERED_ANALYSIS','INSUFFICIENT_EVIDENCE'].includes(x.status));
 return (input.narratives||[]).map((paragraph,i)=>{
  const text=clean(paragraph);const related=knownRules.filter(x=>{const title=clean(x.title);const meaningful=title.split(/[与的及、（）()\s]/).filter(w=>w.length>1);return meaningful.some(w=>text.includes(w))||text.includes('建议')&&knownRules.length===1}).slice(0,4);
  const basics=related.length?unique(related.flatMap(x=>(x.inputs||[]).map(y=>y.metric_id))):resolved?.metrics||[];
  const evidenced=metricReports.filter(x=>basics.includes(x.metric_id)&&x.result!=null&&!['INSUFFICIENT_SOURCE','MISSING_LINEAGE'].includes(x.status));
  const metrics=basics.map(id=>{const m=metricReports.find(x=>x.metric_id===id);return {metric_id:id,value:m?.result??null,formula:m?.formula||'未登记',source_class:m?.source_class||'UNKNOWN',source_rows:m?.rows?.length||0,status:m?.status||'UNAVAILABLE'};});
  return {number:i+1,paragraph:text,related_action_ids:related.map(x=>x.action_id),metric_inputs:metrics,
   rule_result:related.map(x=>x.decision).join('；')||null,
   status:related.length&&evidenced.length?'CHECK_RULE_AGAINST_TEXT':metrics.length?'DATA_AVAILABLE_BUT_CAUSALITY_UNPROVEN':'NO_VERIFIED_RULE',
   steps:[`记录原文：${text.slice(0,210)}`,`收集输入：${metrics.map(m=>`${m.metric_id}=${m.value??'证据不足'}`).join('；')||'本段尚无已绑定的可核查指标'}`,
    `判定：${related.length?related.map(x=>`${x.title}（${x.decision}）`).join('；'):'没有专属阈值或调查证据，不能将展示文字确认为系统自动推导的因果根因'}`,
    '结论：只有数字、阈值、完整来源和人工核验一致时才能采纳；未满足时应列为待确认假设。']};
 });
}
