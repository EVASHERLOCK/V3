/*
 * PHARMA AI — Global Help & Classification Dictionary
 * PERMANENT PRODUCT REQUIREMENT (see docs/GLOBAL_HELP_INVARIANT.md)
 * Every page, analysis block, chart, table, KPI and filter receives a help entry.
 * The complete reference taxonomy is NEVER cropped to the observed data.
 * Page text detection is only a visibility hint, not an audit assertion.
 * Keep this dependency independent from the /api datasets and any external service.
 */
(()=>{
'use strict';
const HELP_VERSION='2.9.13';
const pair=(label,detail='')=>({label,detail});
const group=(title,description,labels)=>({title,description,items:labels.map(x=>typeof x==='string'?pair(x):pair(...x))});
const GROUPS={
 riskRoot:group('风险根因完整分类','用于事件复盘和根本原因分析；一级/二级根因必须基于证据与责任部门核实，不能由看板直接认定。',[
 ['需求预测偏差','预测假设、销量、配方或市场需求与实际不一致'],['销售预测波动','市场订单、招标结果、销售计划突变'],['生产计划临时变更','批次调整、排产冻结或生产提前'],['临时插单/紧急需求','未进入正式滚动计划的追加需求'],['物料需求计算错误','BOM、批量、损耗率或单位换算不正确'],['MRP/ERP 参数错误','运行逻辑、主数据、冻结期、计划日历异常'],['安全库存设置偏低','覆盖天数与风险容忍度不符'],['安全库存设置偏高','资金占用与呆滞积压'],['最小订购量 MOQ 约束','订货批量不匹配'],['标准提前期 LT 偏差','标准交期与实际采购交期不一致'],['供应商延迟交付','承诺日期后到货'],['供应商短交/欠交','到货数量低于订单需求'],['供应商产能不足','产线受限、排产冲突'],['单一来源依赖','无有效第二批准供应商'],['跨境运输/清关延误','海运、空运、口岸、关税文件'],['在途库存登记偏差','ASN、收货、运输记录不一致'],['QC 检验排期滞后','取样、检验资源与优先级不足'],['QC 待放行/隔离','检验、偏差、审评未完成'],['来料质量不合格','OOS/OOT、缺陷、杂质或污染'],['批次复验或效期限制','有效期、复验期、安全使用期限'],['GMP 审计/资质问题','审计未通过、CAPA、ASL 范围限制'],['受控文件到期','CoA、GMP 证明、技术协议、质量合同等'],['注册/DMF 资料异常','注册状态、DMF/CEP/市场准入限制'],['变更控制冻结','供应商、工艺、包装或配方变更未批准'],['市场批准范围不匹配','Site × Material × Market 未满足'],['主数据编码/单位错误','物料代码、UOM、批次规格、物料组'],['库存记录或仓位差错','盘点差异、库位、账实不符'],['合同价格或币种偏差','价格基准、汇率、贸易条款偏离'],['付款/三单匹配阻断','PO、GR、Invoice 不一致'],['职责/审批流程延迟','QA、RA、计划、财务跨部门依赖'],['系统接口/同步异常','ERP/WMS/QMS 数据延迟或缺失'],['其他/待核实根因','证据不足，须保留开放分类']]),
 riskType:group('重点风险类型完整清单','风险等级由发生概率、影响范围、紧迫性及 GMP 约束综合判断；不是所有预警都代表真实损失。',[
 '生产停线/齐套风险','缺料与生产交付风险','延期 PO/交付风险','单一来源断供风险','供应商产能风险','GMP 合规风险','法规注册/DMF 风险','文件到期风险','供应商审计/准入风险','来料质量/OOS/OOT 风险','QC 隔离/复验/放行风险','物料效期与呆滞风险','安全库存不足风险','预测及生产计划变更风险','采购价格/PPV 风险','采购预算超支/偏差风险','汇率/运费/税费风险','合同到期与条款风险','库存资金占用风险','付款/发票匹配风险','数据质量与主数据风险','变更控制风险','跨部门审批超时风险','信息安全/权限风险','应急采购溢价风险','供应商集中度风险','其他/待核实风险']),
 riskGrade:group('风险级别与处置规则','颜色含义保持全站一致；HIGH 重大风险要求有责任人、计划完成日期和证据闭环。',[['HIGH/高危','红色：GMP 合规、停线或重大敞口，立即升级处置'],['MEDIUM/预警','橙色：不达标、可控但须限期跟进'],['LOW/关注','黄色：一般关注项，持续监控'],['达标/正常','绿色：满足规则阈值'],['未知/未评估','灰色：证据不足，不得假定正常'],['逾期未闭环','单独标记已超过截止日'],['待 QA/RA 审批','正式放行或注册结论未完成']]),
 issueType:group('采购异常与问题描述完整类型','适用于风险台账、问题明细、TOP 事项及跨部门协同。',[ '生产需求未齐套','订单延迟交货','供应商短交/部分交货','质量检验超周期','QC 放行冻结','来料不合格/质量投诉','价格超基准','汇率或价格波动','计划版本不一致','供应商准入失效','注册证/受控文件到期','主数据有误','仓库收货/盘点差异','安全库存不足','效期/复验预警','呆滞库存增长','合同临期/到期','异常变更未审批','采购申请/审批超时','发票与 GR/PO 不一致','供应商单一来源','供应商交付绩效下降','预测误差扩大','MOQ/交期不匹配','缺乏批准的替代来源','其他/待核实']),
 action:group('战略行动建议与优先改善任务类型','属于可选行动词典；是否执行必须以来源记录、责任人、QA/RA 审批和业务场景为准。',[
 ['启动第二供应商开发','确认 Site/Material/Market 资格范围与变更注册要求'],['供应商交付整改','改善 OTIF/OTD、产能与承诺交付'],['供应商质量整改/CAPA','8D/根因调查、纠正预防与有效性检查'],['GMP 审计/复评估','计划审核、缺陷整改和持续合规'],['资质证书续期','主动催办 GMP、CoA、技术协议及注册资料'],['合同到期提前续签','谈判商务条款与价格锁定'],['采购价格重新谈判','基于合同、历史价和基准价'],['启动 RFQ/招标/比价','满足批准供应商、质量及法规前置门槛'],['二供验证/工艺确认','工艺、规格、质量和注册范围确认'],['安全库存参数重算','按日均需求、提前期与波动性测算'],['优化补货周期/批量','MOQ、订单频次、现金约束'],['调整生产计划与物料配给','仅协同建议，实际排产由 Planning 决策'],['加急 PO/催交','核实交期、运输和质量风险'],['替代料评估/Change Control','经 QA/RA/生产批准方可使用'],['加速 QC 检验与放行排程','不得跳过 GMP 检验与放行要求'],['临期批次优先使用 FEFO','核对复验和生产可用日期'],['呆滞库存退回/换货','合同允许且质量合规'],['减少报废与库存折损','与仓库、财务、QA 联动验证'],['资金利息/库存占用优化','估算资金收益须说明利率假设'],['区域/币种分散采购','法规、关税及供应资格先行'],['修正 BOM/MRP/主数据','需有修改记录和审批'],['建立滚动预测复盘','需求偏差分层、Owner 与行动'],['建立风险预警与升级','阈值、责任人、闭环日期、证据'],['供应商替换/退出计划','不得忽略验证和市场申报'],['强化三单匹配与付款流程','发票、收货、PO 一致性核验'],['保持合作/长期协议','低风险且绩效达标来源'],['持续监控/待人工核实','证据不足时不得自动定性']]),
 outcome:group('预期效果与验证指标完整类型','“预期”不等于“已实现”；优先量化基线、分母、时间窗、确认部门和证据。',[
 '停线风险降低','缺料风险行数下降','生产齐套率改善','供应商 OTD 提升','OTIF/准时足量率提升','供应商异常率降低','QC 放行周期缩短','CAPA 及时闭环','GMP/注册合规率提升','二供覆盖率提升','单一来源依赖下降','合同到期预警减少','采购成本节约（预测）','财务已确认降本（Realized）','PPV 不利价差降低','库存资金占用下降','平均库存覆盖天数优化','呆滞/临期金额减少','库存报废损失减少','现金流占用改善','预算准确率改善','预测误差降低','紧急采购次数下降','供应商切换周期缩短','付款/发票异常下降','质量投诉下降','供应链韧性提升','待量化/待审批']),
 taskStatus:group('行动与审批状态完整类型','展示任务闭环流转阶段，不把“已建议”当成“已执行”。',['待识别','待评估','待分配责任人','待启动','进行中','待供应商回复','待 QA 审批','待 RA 评估','待采购/计划确认','待验证效果','已完成待验收','已闭环','已逾期','已取消（有原因）','被阻断/缺证据']),
 calendar:group('未来 24 个月采购战略节点完整类型','日历必须有明确日期、来源系统/责任人及审批状态；没有来源的示例节点不得作为正式计划。',['招标启动','寻源启动','RFQ 发出','比价/报价评审','价格重谈','合同到期','合同续签','框架协议签订','二供开发启动','二供验证','工艺验证','供应商资格评审','GMP 审计','供应商现场审核','受控文件续期','证书临期','注册资料提交','注册获批','变更控制 Change Control','供应商 Change Control','新供应商导入','供应商复评估','产能扩张/转产','年度预算锁定','长协价格生效','质量整改 CAPA 验证','物流/运输策略切换','供应中断预案演练']),
 supply:group('供应商风险与交付绩效分类','供应商绩效、交付、质量、合规和集中度应分维度呈现，不能使用金额等级冒充质量风险等级。',['OTD 达标','OTD 不达标','OTIF 达标','供应商延期','供应商欠交','产能受限','供应商高依赖','单一批准来源','第二批准来源','ASL/AVL 有效','ASL 待验证','GMP 审计通过','GMP 审计待整改','GMP 审计未通过','质量事件','质量投诉','批次拒收','审计 CAPA 逾期','市场注册范围不匹配','高风险供应商','中风险供应商','低风险供应商','A类采购主力','B类供应商','C类常规供应商','价格偏差严重','采购份额集中']),
 spend:group('花费结构/品类完整分类','取决于药企物料主数据；不存在的品类仍应在目录中供核查，不虚构采购金额。',['API 原料药','关键中间体','常规中间体','辅料','关键辅料','包材与耗材','直接包材','二次包装材料','质量检验耗材','生产用品','研发与临床耗材','实验室试剂','工程物料/MRO','外包生产 CMO/CDMO','物流运输','设备与维护','工程服务','信息化采购','间接采购','其他/未分类']),
 abc:group('ABC 分类与来源结构','ABC 排序口径需使用同一筛选范围的采购金额；第二来源须按 Site × Material × Market 资格独立核实。',[['A 类关键物料','高金额贡献，重点关注合同、二供与供应韧性'],['B 类常规物料','中等金额贡献，控制成本和库存策略'],['C 类低值物料','低金额贡献，简化流程'],['已批准第二来源','ASL/市场/物料资质均满足'],['单一批准来源','在当前限定范围仅有一个合规来源'],['未核实来源','无足够证据，不视为已批准'],['战略供方','重点合作与持续改进'],['常规供方','标准化执行与复评']]),
 inventory:group('库存生命周期状态/流程完整分类','Released、Quarantined、Rejected、在途不能混为可用；状态更改须来自 WMS/QMS 受控流程。',['PO 已创建','供应商已承诺','在途/ASN','PO 到货','收货待 GR','GR 待检隔离','待抽样','待检验','QC 检验中','复验中','待 QA 审批','Released/可放行','Quarantined/隔离','Blocked/冻结','Rejected/拒收','待退货','待报废','降级限制使用','已消耗/生产领料','已调拨','近效期','效期已到','复验到期','呆滞库存','安全库存不足','正常覆盖','在途逾期','跨仓转移']),
 forecast:group('预测偏差与物料需求分析类型','预测误差须有同口径预测与实际数据；如只有标准/实耗，说明是耗用差异而非正式预测准确率。',['预测高估','预测低估','物料齐套率偏低','生产工单缺料','标准用量与实际消耗差异','BOM 损耗率不符','销量需求波动','月度滚动预测偏差','计划提前/推迟','生产订单插单','跨月需求移位','MOQ 约束','批次效期约束','运输延迟','QC 待放行','库存安全阈值失效','消耗异常','在途与可用库存口径差异','未有正式预测历史']),
 price:group('价格偏差、成本与预算差异类型','采购价差 PVV/PPV 的汇率、基准、数量、运费需分别说明；预算均须区分审批版本与模拟情景。',['采购价格上涨','采购价格下降','PPV 不利价差','PPV 有利价差','基准价失效','合同价格偏差','汇率影响','数量/采购量偏差','组合/品类结构变化','临时采购溢价','运费成本增加','关税税费变化','MOQ 单位成本增加','仓储持有成本','呆滞库存减值','报废损失','供应商返利','二供降本机会','已确认降本','预测降本机会','预算准确率偏差','月度滚动预算偏差','未获批准预算']),
 quality:group('质量/合规/注册完整分类','药企正式放行与注册结论必须由授权人员和受控系统确认。',['来料检验合格','来料检验不合格','OOS/超标','OOT/超趋势','质量投诉','偏差调查','CAPA 待关闭','CAPA 逾期','GMP 审计待整改','GMP 审计通过','GMP 审计未通过','质量协议待续签','CoA 缺失','工艺验证未完成','变更控制未批准','工厂/市场注册不匹配','CEP/DMF 状态异常','注册证即将到期','受控文件到期','供应商资质被暂停','QA 放行冻结','复验限制','合规缺口待评估']),
 change:group('变更控制/审批类型','涉及材料、供应商、工艺、注册与市场的变更需核对 QA/RA 影响和验证计划。',['原材料配方变更','供应商变更','生产厂址变更','关键工艺变更','质量标准变更','包装材料变更','包装标签变更','运输条件变更','检验方法变更','注册文件变更','市场准入变更','受控文件修订','变更申请','QA 影响评估','RA 法规影响评估','验证执行中','变更待批准','变更关闭','变更逾期']),
 budget:group('年度预算与滚动复盘完整分类','正式预算、参考预算和未批准情景须分别标识；数据不足不能虚构年度执行率。',['上年度实际消耗量','下年度生产计划量','期初可用库存','在途未到货量','预计消耗数量','预计消耗金额','实际消耗数量','实际消耗金额','月度采购预算','月度实际采购金额','预算准确率','预算差异原因','需求侧参数','库存侧参数','供应侧参数','价格侧参数','风险侧参数','基准情景 A','涨价情景 B','二供替代情景 C','月度资金分布','品类预算占比','预算编制说明','版本保存','版本对比','提交审批/待接入']),
 invoices:group('PO/收货/发票匹配完整异常类型','付款与三单匹配依赖 PO、GR、Invoice 原始流水，例外处理保留审计痕迹。',['PO 数量超/欠','收货数量不符','发票数量不符','采购价与发票价不符','汇率不符','税率错误','发票重复','供应商主数据错误','GR 缺失','PO 缺失','合同条款不一致','付款条件异常','预付款未清','开票与采购主体不符','发票未审批','例外已核准']),
 data:group('数据来源/分析边界完整清单','当前网站是 DEMO/Non-GxP；问号给出治理与审计检查范围，不等于自动通过法规审核。',['原始 PO 数据','供应商主数据','物料主数据/BOM','生产工单','库存批次 WMS','QC 检验/放行','ASL/AVL 来源资格','受控质量文件','注册/DMF/CEP','采购合同','财务预算版本','供应商评分卡','变更控制台账','行动闭环任务','实际消耗记录','预测版本快照','导入批次与时间戳','计算公式/分子分母','筛选范围','权限与审计轨迹','缺失字段/未接入','模拟情景/假设','审批人和生效日期','数据质量异常/重复记录']),
 filter:group('全站筛选维度/可选条件','以下是应支持的参考维度；页面下拉框只显示该页面已实现或有源数据的选项。',['年份','月份','滚动 12 个月','自定义日期范围','地区/市场','产品线 Top10/Top30/全部','供应商','供应商 A/B/C 分类','战略/常规供应商','物料编码','物料大类','API/中间体/辅料/包材','仓库/工厂/产线','QC 状态','库存状态','ABC 物料分级','关键物料','风险等级 HIGH/MEDIUM/LOW','生产工单','批次','到货状态','PO/合同','预算年度和版本','情景 A/B/C','责任部门/责任人','待办状态','批准供应来源范围','清除/重置筛选'])
};
// V2.9.3: Upstream-market taxonomies remain available even where recorded data has no category.
GROUPS.upstreamMarket=group('上游市场调研完整类别','市场情报分类是参考清单，不等于本系统已获得实时行情或已验证供应商。',[
'原料药（API）','关键医药中间体','药用辅料','工艺溶剂','生物工艺原料','天然提取/发酵原料','关键试剂与催化剂','药用高分子与制剂辅料','生物催化与连续流工艺','细胞培养及发酵工艺','结晶与纯化工艺','绿色化学路线','CDMO/CMO产能','第二供应源评估','地缘政治及关税变化','物流线路与口岸','能源及公用工程','反应原料价格','行业展会官方信息','产能投扩建','商业合约与汇率','上市产品与治疗领域','法规注册和GMP资质','潜在客户/竞品供应链动向']);
GROUPS.upstreamRisk=group('全球供给风险因子与等级完整字典','风险指标分为原始台账证据与情景评分；情景评分不能代替正式供应中断预警。',[
'地缘风险：制裁与战争','地缘风险：跨境贸易与关税','地缘风险：自然灾害与政治不稳定','产能波动：关键产线停机','产能波动：负荷率与检修','产能波动：电力与能源','产能波动：环保排放限制','原料短缺：上游化工品','原料短缺：关键溶剂','原料短缺：发酵培养基','原料短缺：罕见中间体','监管政策：GMP审计','监管政策：危险品运输','监管政策：环保/碳排要求','监管政策：进出口许可','注册法规：DMF备案','注册法规：CEP适用范围','注册法规：生产场地变更','注册法规：质量协议到期','注册法规：市场准入','供应链风险：独家供应','供应链风险：延迟交付','供应链风险：文件过期','供应链风险：质量偏差','低风险（0–20）','较低风险（20–40）','中风险（40–60）','较高风险（60–80）','高风险（80–100）']);
GROUPS.marketPricing=group('价格趋势/价格预测完整检查清单','历史采购单价、合同报价、行情指数、情景预测必须严格区分来源。',[
'历史PO成交单价','基准价/合同价','汇率与付款货币','运输和到岸成本','最小订购量MOQ','价格差异PPV','同品不同等级可比性','供应商报价日期','公开市场指数（待接入）','成本驱动因素','能源成本与关税','供需周期与产能扩张','价格上涨情景','价格下跌情景','报价回归情景','预测区间/不确定性','价格风险转移','价格再谈判窗口','材料替代/配方变更影响','情报来源和发布日期核验']);
GROUPS.costBaseline=group('成本基线与目标成本管理完整分类','研发 BOM、目标价、PO基准、供应商报价与降本收益必须按来源、币种、数量和审批级别区分；空白不是零。',[
'研发 BOM 目标价（待接入或获批版本）','PO benchmark参考基线','最新成交价格','加权平均采购单价','合同有效价格','供应商RFQ报价','币种及汇率换算','MOQ及数量阶梯','运费及贸易条款','原材料直接成本','加工及制造费用','注册和合规成本','物流与仓储费用','管理及间接费用','利润与风险溢价','BOM成本拆解瀑布','目标成本达成率','价格高于基准异常','历史基线价对比','供应商落地成本比较','替代材料降本','工艺优化降本','长期框架议价','潜在降本机会','财务已认定降本','本地成本情景','采购价格闭环流程','报价溯源与历史PO明细','审批及合规资格门槛']);
GROUPS.marketSupplier=group('原材料供应商档案与覆盖维度','供应商在目录中不等于批准供应商；新增候选必须有尽调证据才能进入正式 Site × Material × Market。',[
'供应商主数据ID','企业/厂址名称','生产商/贸易商','所在国家及地区','原材料分类','可供物料规格及等级','Site与Material映射','批准市场范围','GMP/ISO/CEP/DMF适用情况','ASL批准状态','审计计划和结论','质量协议','CoA/检验记录','DMF/CEP/注册证','产能及开工率证据','产能扩建及建设状态','标准交期LT','运输路线及贸易条款','单一来源与二供状态','报价与历史PO','供方财务和连续性','地缘及政策风险','研发技术适配','电子文件有效期','扩展演示/待核验标记']);

GROUPS.kraljic=group('Kraljic四象限分类与品类价值计算完整字典','价值影响与供应风险应有独立证据；无PO物料只能做明确标注的情景分级。',[
'战略品 Strategic：高价值/高供应风险','杠杆品 Leverage：高价值/低供应风险','瓶颈品 Bottleneck：低价值/高供应风险','非关键品 Non-Critical：低价值/低供应风险','实际PO金额占比','总拥有成本与替代成本','供应商来源数量','单一来源依赖','产能稳定度','地缘政治风险','GMP与法规状态','物料生命周期风险','供应市场集中度','利润影响','缺料停线影响','定量评分阈值和公式','不含历史金额的情景评级','审批与决策复核']);
GROUPS.sourcingPath=group('差异化寻源策略/执行路径完整分类','完整策略库不等于当前已执行项目；路径执行必须追溯审批、合同与证据。',[
'集中招标与框架协议','反向竞价与多轮比价','长期战略合作/产能锁定','第二供应商开发','供应商技术初评','资格预审（CEP/GMP/ASL）','研发新品 NPI 路径','商业成熟品路径','价格基线和TCO','线上评标/价格质量交付权重','定标与合同生效','Supplier Change Control','GMP审计与CAPA','场址/物料/市场范围确认','价格回溯与成本分析','降本机会与财务确认','采购目录化管理','供应商绩效与持续改善']);
// V2.9.7: permanent sourcing-project lifecycle help taxonomy, separate from source records.
GROUPS.projectStages=group('寻源项目阶段与甘特排程完整类型','本页默认排程为未批准的本地情景，不得将项目来源证据自动转换为已完成阶段。',[
'需求归口/物料定义','市场与供应商 RFI','保密协议 NDA','供应商初筛','RFQ 文件准备','RFQ 询价发出','报价有效期确认','MOQ/交付条件核对','样品申请','样品接收与入库','样品检验/QC','方法学与技术评审','质量协议评审','现场 GMP 审计','CEP/DMF/ASMF 文件核对','ASL 资格评估','Site × Material 准入确认','市场注册适用性评估','多供应商加权评标','落地总成本 TCO','商务谈判','合同授权与签署','第二来源验证','工艺/设备适配','产能审核与锁定','首批物料交付','首次检验放行','试生产/商业化转化','阶段签核与关闭']);
GROUPS.projectMilestones=group('准入里程碑和责任矩阵完整类型','示例动作仅供项目经理检查遗漏；实际签核由授权部门完成。',[
'项目立项批准','需求规格冻结','供应商技术初筛','RFI 评审完成','RFQ 评标完成','样品测试完成','技术评审通过','方法学验证完成','GMP 合规核验通过','注册/RA 适用性确认','质量协议签署','商业条款达成','供应商准入审批','ASL 更新','合同生效','首批订单批准','首批收货/GR','首批 QC 放行','首批商业化供货','项目转运营移交','偏差/CAPA 关闭','项目文档归档']);
GROUPS.projectDocs=group('寻源项目文档资料完整分类','证书登记元数据不等于 PDF 原件；实际审核需核对有效版本、范围和受控附件。',[
'物料技术规格书','URS/需求说明','BOM 与物料清单','供应商 RFI 回函','保密协议 NDA','RFQ 招标/询价文件','供应商报价单','报价有效期与币种','样品申请/交样记录','CoA/批次质量证明','QC 检验报告','技术评审意见','评标打分记录','GMP 证书','GMP 审计报告','CEP 证书及持有人','DMF/ASMF 主文件状态','供货 Site × Material 资格','ASL 授权证明','质量协议','成本基线/定价依据','商务谈判纪要','合同及签署版','采购订单 PO','收货与放行凭证','变更控制记录','CAPA/偏差记录','项目批准/关闭记录']);
GROUPS.projectConstraints=group('后端产能、库存、排期约束完整类型','约束预估与真实库存状态必须独立核对，不得将 Quarantined 视为 Released。',[
'原料供应产能','供应商有效产线','交付提前期 LT','MOQ/最小订购批量','质量检验周期','QC 放行周期','来料待检隔离','安全库存阈值','Released 可用库存','可用库存覆盖天数','在途 PO/ASN','交期延迟风险','生产工单需求','替代来源验证状态','研发/生产节点冲突','GMP 批次放行','注册准入阻断','冷链/仓储能力','物流与清关限制','物料效期与复验','二供切换计划','工程变更/Change Control','成本与现金流约束']);
// V2.9.8: Permanent supplier-performance & improvement help taxonomies.
GROUPS.supplierPerformance=group('供应商绩效与分级完整分类','档案评分、PO履约及供货资质三者口径独立。情景候选不可自动视为已交易或已准入。',[
'研发阶段技术协同','量产供货绩效','供应商分级分布','战略协作供应商','优选供应商','跟踪整改供应商','暂停/淘汰观察','候选未核验供应商','供应商主数据质量评分','来料 QC 合格率','供应商 OTD','OTIF准时足量率','技术响应时效','技术投诉闭环率','合同签署时效','合同有效性覆盖','供应商质量风险','商业合作响应速度','多维评分雷达','价格/质量/交付/风险/合规评分','供应商绩效年审','研发与量产双维度绩效']);
GROUPS.supplierCAPA=group('供应商 CAPA 与 GMP 审计整改完整类型','质量事件与审计 CAPA 只反映系统已登记证据；整改建议不构成正式 eQMS 已关闭CAPA。',[
'来料偏差','供应商质量投诉','8D 根因调查','OOS/OOT','供应商审核缺陷','GMP 现场审计整改','GMP 文档整改','供应商产线纠正措施','供应商过程控制改善','技术响应超时','交期延误 CAPA','短交/欠交整改','批次污染/交叉污染风险','变更控制通知不及时','质量协议更新','合规文件过期','整改责任人分配','整改截止日期','纠正措施计划','预防措施计划','CAPA 有效性验证','CAPA 已关闭','CAPA 逾期','CAPA 重新开启','QA/采购确认','审核轨迹和批准证据']);
GROUPS.supplierReview=group('供应商年度联合战略复盘完整类型','计划/建议与已完成记录必须区分；管理建议需要责任部门、正式评价及验收证据。',[
'年度供应商绩效复评','供应商分类建议','研发联合技术改善计划 JIP','GMP CAPA 状态复盘','资质续期与质量协议','交期与供应保障行动','价格谈判与采购成本优化','PPV 正向/负向表现','批准的第二来源资格','单一来源风险应急方案','供应商现场审核','准入与退出策略','年度采购份额与集中度','季度复盘里程碑','改善建议责任人','改善目标完成日期','证据覆盖率','正式签核与验收','跨部门共识','持续改善 CI','战略伙伴复评','风险供应商重点整改']);
GROUPS.supplierDelivery=group('供应商交付和质量深度分析完整类型','时间趋势只能绘制有PO/批次来源的月份；缺失周期不能当成真实历史。',[
'供应商 OTD','目标OTD 90%','平均延期天数','晚交/部分交付','收货差异','来料质量评分','来料质量拒收率','GMP审计/质量事件','六期OTD趋势','供应商 TOP/BOTTOM 排名','能力五维雷达','OTD × PPV 散点图','季度交付趋势','供应商质量事件台账','批次偏差调查','事件归因状态','质量成本核算','CAPA结果验证','批次/PO关联','质量趋势来源与缺失口径']);
GROUPS.supplierQuality=group('质量事件与供应商质量分类','同一质量事件不可和多个CAPA重复计数，质量事件未关闭不一定判定供应商责任。',[
'偏差调查Open','偏差Closed','归因未定Under Investigation','来料异常事件','OOS/OOT','批次拒收','QA审核','QC再检验','审计发现','质量协议有效','GMP合规审查','数据缺口待补录','正式CAPA系统未接入','年度质量绩效复评']);
GROUPS.supplierDependency=group('采购集中度、依赖与备选开发分类','集中度来自本期PO金额，第二合格来源必须根据Site×Material批准范围计算。',[
'单一合格来源','备用来源已验证','第二来源开发中','未核验候选','前三大供方CR3','供应商最大份额','按季度最大依赖','高风险来源','高质量稳定来源','长期框架合同','供货中断情景','合同/准入失效','跨区域备选','质量风险分散','产能/提前期风险','供方评级升级/降级','资格复核','采购风险登记','备选供应商审批','风险管理行动台账']);
// V2.9.9: permanent supplier compliance coverage independent of currently observed record types.
GROUPS.supplierCompliance=group('供应商合规管理完整业务类型','完整证据类型与审批门槛，不等于当前已收集或已获批准的资质。',[
'GMP Certificate/GMP证书','CEP证书与持有人','DMF/ASMF登记','FDA Inspection Classification','EudraGMDP GMP检查结果','NMPA监管信息','ASL批准供方清单','Site × Material × Market适用性','质量协议Quality Agreement','来料CoA','场地审计报告','供应商整改CAPA','有效期与复核周期','合同及生产场地变更','生产工艺验证','供应商资质复审','供应商分级与来源风险','核验人/核验日期/官方URL','OA/QA审批签核','审批变更撤销','文件元数据版本管理','缺口关闭证据']);
GROUPS.officialEvidence=group('官方证据核验的完整参考渠道','官方核验需要人工查证及留存，不代表当前浏览器实时连接监管系统。',[
'EDQM CEP数据库查询','EudraGMDP GMP证书及不符合事项','FDA 检查分类 NAI/VAI/OAI','NMPA药品与监管公示','GMP证书编号','CEP编号及持有人','企业/厂址识别','检查/批准日期','证书发证主体','当前有效状态','证书适用原料','市场法规适用性','质量协议签署','DMF/ASMF变化','官方查询地址与截屏留痕','电子核验记录与双人复核']);
GROUPS.complianceLedger=group('受控文件与完整性分类','文件登记、有效、官核、QA审批与正式准入不能混用。',[
'有效 Valid','待复核 Under Review','已到期 Expired','未提供 Missing','已申请 Requested','待供应商回复 Awaiting Reply','新版本待审核','证书过期30天窗口','证书过期90天窗口','证书需复验','供应商注册资料','GMP和药学合规证明','公司主体文件','质量协议/COA','审计报告/CAPA','ASL与适用市场','Site × Material组合','批准与暂停使用','文件版本号','所有者/核验人','证据来源URL','受控原文件与附件']);
GROUPS.complianceRemediation=group('供应商合规缺口与整改任务完整类型','整改建议和状态不能替代已经批准的 eQMS 工作流。',[
'缺少CEP/GMP证书','证书到期续期','FDA/EMA公开检查异常','GMP审计不合格项','DMF/ASMF文件缺失','CoA不匹配','Site × Material资格不符','ASL名单不一致','QA/SQM审批待签','质量协议未签署','文件版本冲突','文件清晰度不足','供应商答复逾期','CAPA根因待验证','变更管理未完成','跨市场注册影响','风险升高需阻断','临期提醒','完成证据上传','QA审批与记录归档']);
GROUPS.supplierTechnical=group('供应商技术档案与能力验证完整分类','能力标签是候选信息，正式产能、精度、工艺验证、注册批准、Site × Material 资格必须由受控证据支持，图表数字不应冒充实际核验。',[
'原料药化学合成','关键中间体合成','辅料生产与混配','药用包装材料','工艺溶剂处理','生物发酵与纯化','天然提取物','医药试剂与催化剂','无菌生产能力（待核验）','多步合成路线','连续流生产','结晶纯化能力','工艺放大与技术转移','产能及排产证据','GMP 厂址审计结果','CEP/DMF/ASMF 适用范围','质量协议有效性','ASL / AVL 准入范围','Site × Material 资格','市场注册/RA 清关','物料规格与检验方法','CoA与批次质量资料','工艺验证与可靠性','QC放行与检验周期','供应商打样与样品验证','技术评审结论','验证进度与逾期','质量问题与偏差记录','历史交付 OT(D)','供货集中度与单一来源','价格与合同基础','风险等级与人工复核','候选未审核标记','技术能力缺失证据','可下单资格与禁止下单门槛','供应商横向比较评分','供应商雷达图与可追溯评分口径','供应商已失效证据','跨页面统一筛选与来源明细']);
// Highest-priority site-wide decision display invariant. Applies to ALL routes.
GROUPS.top10=group('全站最高优先级：Top 10 决策展示规则','所有页面的可排名图表、供应商、风险和改进行动均按业务价值优先列出最重要10项；完整数据不丢失、其余可展开。不得将演示样例视为正式供应商、报价或采购准入。',[
 ['前10位 Top 10','按金额、风险、商业分数、节约机会等明确业务指标排序'],
 ['由高到低排序','同一量纲同一日期；以节约价值排名时可按总成本升序'],
 ['显示排序口径','每张排名图应说明金额/风险/得分/交付等指标及降序依据'],
 ['其他条目折叠','第11位及以后仍在展开区域，不可丢弃或从导出中排除'],
 ['筛选后重新排名','先选定物料、地区、时间、项目，再计算该组Top10'],
 ['缺失数据不是0分','未知、未提供、未核验不得当作差评或已通过'],
 ['时间序列与漏斗例外','月份、五阶段漏斗、坐标轴、地图完整保留，关联明细按Top10折叠'],
 ['演示/正式数据隔离','模拟报价、风险和资格必须标注；不计正式采购授权'],
 ['来源可追溯','官方URL、采集时间、来源记录号、审核人和变更历史独立留存'],
 ['人工审批准入','FDA风险线索不是GMP/CEP/ASL；未获企业QA/RA正式批准不可下单'],
 ['全站永久构建校验','新增页面与图表必须经过Top10治理检查及人工交互验收']]);
const ROUTES={
 overview:['riskType','riskRoot','issueType','action','outcome','taskStatus','spend','supply','quality','data'],
 m01:['forecast','riskRoot','riskType','inventory','issueType','action','outcome','data'],
 portfolio:['calendar','action','outcome','riskType','supply','abc','spend','data'],
 m06:['inventory','abc','riskType','forecast','quality','data'],
 m02:['spend','abc','price','budget','inventory','outcome','data'],
 'ss-overview':['supply','riskType','action','outcome','calendar','data'],
 'ss-market':['upstreamMarket','upstreamRisk','marketPricing','marketSupplier','supply','riskRoot','riskType','calendar','data'],
 'ss-kraljic':['kraljic','sourcingPath','marketSupplier','supply','quality','price','riskType','action','spend','data'],
 'ss-ai':['supply','quality','price','action','data'],
 'ss-cost':['costBaseline','price','budget','spend','outcome','data'],
 'ss-project':['projectStages','projectMilestones','projectDocs','projectConstraints','taskStatus','action','data'],
 'ss-performance':['supplierPerformance','supplierCAPA','supplierReview','supplierDelivery','supplierQuality','supplierDependency','supply','quality','taskStatus','action','outcome','data'],
 'ss-compliance':['supplierCompliance','officialEvidence','complianceLedger','complianceRemediation','quality','change','data'],
 'ss-technical':['supplierTechnical','marketSupplier','supplierCompliance','quality','supply','riskType','data'],
 'ss-data':['officialEvidence','marketSupplier','supplierCompliance','riskType','data'],
 m05:['inventory','supply','invoices','riskType','data'],
 m08:['invoices','price','data'],
 m09:['change','quality','riskType','data'],
 m10:['taskStatus','action','outcome','riskType','data'],
 documents:['quality','riskType','data'],regulatory:['quality','change','data'],
 workflow:['taskStatus','action','change','data'],reports:['data','spend','budget'],
 access:['data','quality'],master:['data','inventory','spend'],alerts:['riskType','riskRoot','issueType','action','taskStatus','data']
};
// Universal route coverage; keeping Top 10 policy at highest priority in every page help dictionary.
for(const key of Object.keys(ROUTES))ROUTES[key]=['top10',...ROUTES[key]];
const MATCHERS=[
 [/供应商合规与证据|官方证据核验|EudraGMDP|EDQM|NMPA|FDA|合规与证据|准入状态总览/i,['supplierCompliance','officialEvidence','quality']],
 [/证据登记|文件主台账|文件类型|审批闭环|到期预警|文件有效占比/i,['complianceLedger','supplierCompliance','officialEvidence']],
 [/补件与整改任务|合规缺口|资格受限/i,['complianceRemediation','supplierCAPA','taskStatus']],
 [/供应商绩效|持续改善|供应商分级分布|管理建议与行动/i,['supplierPerformance','supplierReview','supplierDependency']],
 [/CAPA|质量事件|整改跟踪|审计整改/i,['supplierCAPA','supplierQuality','quality']],
 [/年度战略复盘|联合技术改善|复盘台账/i,['supplierReview','taskStatus','action']],
 [/交付与质量深度|OTD|平均延期天数|交付趋势/i,['supplierDelivery','supplierQuality','supply']],
 [/供应依赖|采购集中度|替代覆盖|备选开发/i,['supplierDependency','supplierPerformance','riskType']],
 [/项目进度甘特|寻源项目全流程|计划排程|阶段证据/i,['projectStages','taskStatus','calendar']],
 [/准入里程碑|里程碑跟踪|阶段签核/i,['projectMilestones','projectStages','quality']],
 [/项目文档档案|文件目录|RFQ 文件|评审记录|资质文件/i,['projectDocs','quality','data']],
 [/后端产约束|产能|排期约束/i,['projectConstraints','inventory','forecast']],
 [/Kraljic|四象限|分支判断节点|品类分级|寻源路径|差异化寻源|资格预审|线上评标|定标|成本基线库/i,['kraljic','sourcingPath','marketSupplier','quality']],
 [/上游|全球供给|供应商分布|产能格局|市场情报|产业洞察|技术情报/i,['upstreamMarket','marketSupplier','upstreamRisk']],
 [/价格趋势|重点品类价格指数|预测区间|价格情景/i,['marketPricing','upstreamMarket','price']],
 [/供给风险|潜在断供|风险热力图|高风险物料/i,['upstreamRisk','riskGrade','riskType']],
 [/原材料供应商候选|原材料类别|原材料供应商名录/i,['marketSupplier','upstreamMarket','data']],
 [/根因|因果|追溯|Pareto|复盘|偏差原因/i,['riskRoot','issueType','action']],
 [/风险|预警|告警|缺料|高风险/i,['riskType','riskGrade','riskRoot']],
 [/战略日历|日历|里程碑|24个月|节点/i,['calendar','action','taskStatus']],
 [/行动清单|战略行动|改善任务|纠正|任务进度|优先改善|闭环|行动中心/i,['action','outcome','taskStatus']],
 [/预期效果|目标|收益|降本|Savings/i,['outcome','action','price']],
 [/供应商|OTD|交付绩效|第二来源|二供|SQE|资质/i,['supply','quality','riskType']],
 [/Spend|花费|支出|品类|ABC|金额排行|采购结构/i,['spend','abc','price']],
 [/库存|批次|仓储|可放行|效期|在途|覆盖天数|消耗|收货/i,['inventory','forecast','quality']],
 [/预测|齐套|生产需求|数量偏差|需求计划/i,['forecast','riskRoot','inventory']],
 [/价格|PVV|PPV|成本|预算|价差|滚动/i,['price','budget','outcome']],
 [/质检|QC|GMP|合规|注册|DMF|文件|审核|验收/i,['quality','change','data']],
 [/Change|变更|审批/i,['change','quality','taskStatus']],
 [/发票|付款|对账|三单|匹配/i,['invoices','price','data']],
 [/筛选|类别|月份|范围|工厂|市场|仓库|物料类型|物料类别|版本/i,['filter','data']]
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const visible=(el)=>!!(el&&el.isConnected&&!el.closest('[hidden],.gh-overlay,.gh-drawer')&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden');
const clean=s=>String(s||'').replace(/[↗?ⓘ▣●]/g,'').replace(/\s+/g,' ').trim().slice(0,125);
let modal=null,scanScheduled=false,observer=null;
function route(){return (location.hash.replace(/^#/,'').split('&')[0]||'overview').toLowerCase()}
function infer(title,routeId){const matches=[];for(const [pattern,groups] of MATCHERS){if(pattern.test(title)){for(const g of groups)if(!matches.includes(g))matches.push(g)}}if(!matches.length){const f=ROUTES[routeId]||['data'];matches.push(...f.slice(0,3))}return matches.slice(0,4)}
function titleFor(el){const direct=[...el.children].find(x=>x.matches?.('header,.panel-head,.cp-panel-h,.lc-card-head,.sp-cardhead,.m01-card>header,.section-head,.sp-section-head,.page-head'));
 const root=direct||el;
 const item=root.querySelector?.('h1,h2,h3,h4,.panel-title,.v17-panel-title,.cp-panel-h>b,.sp-cardhead>strong,.lc-card-head>h3,.section-head>div>h2,.kpi-section-header h3,.sp-kpi>span,.m01-kpi-name,.v17-kpi-name,.e8-stat-l,.sp-param-header>b,.sp-annual-kpi-label,.sp-scenario-v27 b,.sp-scen-head strong');
 if(item&&item.closest('.gh-overlay,.gh-drawer')===null)return clean(item.textContent);
 if(root!==el)return clean(root.textContent).slice(0,56);
 return clean(el.getAttribute('aria-label')||el.getAttribute('title')||'')
}
function mkTrigger(title,kind,host){const span=document.createElement('span');span.setAttribute('role','button');span.setAttribute('tabindex','0');span.setAttribute('aria-label',`查看「${title}」完整分类及数据口径`);span.setAttribute('title',`查看「${title}」完整类别、当前显示情况与核对说明`);span.dataset.ghTitle=title;span.dataset.ghKind=kind;span.className='gh-trigger';span.textContent='?';if(host?.tagName==='BUTTON')span.classList.add('gh-in-button');return span}
function injectCard(el){if(!visible(el)||el.dataset.ghReady)return false;
 if(el.closest('.kj-page')){el.dataset.ghReady='1';return false;}
 if(el.querySelector('.ssm-help,.cb-help,.sp-help,.spf-help')){el.dataset.ghReady='1';return false}
 const name=titleFor(el);if(name.length<2)return false;
 // Prefer unique card-level question marks; the underlying card remains clickable.
 el.dataset.ghReady='1';el.classList.add('gh-annotated');
 const header=[...el.children].find(c=>c.matches?.('header,.panel-head,.cp-panel-h,.lc-card-head,.sp-cardhead,.section-head,.m01-card > header'));
 const host=header||el;host.classList.add('gh-help-host');host.appendChild(mkTrigger(name,'module',el));return true
}
function injectFilter(el){if(!visible(el)||el.dataset.ghFilterReady)return false;
 if(el.closest('.kj-page')){el.dataset.ghFilterReady='1';return false;}
 if(el.querySelector('.ssm-help,.cb-help,.sp-help,.spf-help')){el.dataset.ghFilterReady='1';return false}
 const input=el.querySelector?.('select,input,textarea')||el.matches?.('select,input,textarea')&&el;if(!input)return false;
 const name=clean(el.querySelector?.('span,small,strong')?.textContent||el.textContent?.replace(input.textContent,'')||input.getAttribute('aria-label')||input.name||'筛选条件');
 const title=name.length>55||name.length<2?(input.getAttribute('aria-label')||input.name||'筛选条件'):name;
 el.dataset.ghFilterReady='1';el.classList.add('gh-filter-host');el.appendChild(mkTrigger(title,'filter',el));return true
}
const CARD_SELECTORS=[
 '#content .v17-panel','#content .m01-card','#content .cp-panel','#content .lc-card','#content .sp-card','#content .sp-kpi','#content .lc-kpi','#content .m01-kpi','#content .v17-kpi','#content .v19-kpi','#content .cp-kpi','#content .e8-card','#content .kpi-domain-card','#content .kpi-metric-tile','#content .kpi-executive','#content .panel.padded','#content .panel','#content .sp-section','#content .lc-section','#content .m01-causes','#content .cp-hero','#content .page-head','#content .sp-head','#content .lc-head','#content .v17-zone','#content .cp-row > section',
 '#content .section-head','#content .kpi-section-header','#content .e8-page > section',
 '#content .sp-tile','#content .sp-widget','#content .lc-abc-card',
 '#content .p12-box','#content .e8-box','#content .e8-stat','#content .p12-kpi','#content .sp-annual-kpi','#content .sp-param-card','#content .sp-section-head','#content .sp-annual-head','#content .sp-scenario-v27','#content .lc-ledger-head','#content .sp-money-composite','#content .p12-card'
];
const FILTER_SELECTORS=[
 '#content label:has(select)','#content label:has(input:not([type="hidden"]))','#content .sp-filter','#content .lc-filter','#content .cp-filter','#content .m01-filter',
 '#content .filter-field','#content .field:has(select)','#content .form-field:has(select)'
];
function scan(){const content=document.getElementById('content');if(!content)return 0;let count=0;
 for(const selector of CARD_SELECTORS){content.querySelectorAll(selector).forEach(el=>{if(injectCard(el))count++})}
 // Ensure every meaningful chart or table has one help entry even when its layout lacks a panel wrapper.
 content.querySelectorAll('table,svg[role="img"],canvas,[class*="chart"],[class*="matrix"]').forEach(el=>{
  if(!visible(el))return;
  if(el.closest('.gh-annotated'))return;
  const outer=el.closest('section,article,.panel,.card,[class*="panel"],[class*="card"]');if(outer&&injectCard(outer))count++;
 });
 content.querySelectorAll(FILTER_SELECTORS.join(',')).forEach(el=>{if(injectFilter(el))count++});
 // Minimal page-level entry even for a future page with only text.
 if(!content.querySelector('.gh-trigger[data-gh-kind="module"]')){
  const header=content.querySelector('h1,h2');if(header){const el=header.parentElement; if(el&&injectCard(el))count++}
 }
 return count
}
function schedule(){if(scanScheduled)return;scanScheduled=true;requestAnimationFrame(()=>{scanScheduled=false;scan()})}
function findVisible(host,title){const text=clean(host?.innerText||host?.textContent||'').toLowerCase();const matched=MATCHERS.filter(([pattern])=>pattern.test(title)).flatMap(x=>x[1]);const groups=(arguments[2]==='filter'?[...new Set(['filter',...(matched.length?matched:['data'])])].slice(0,3):infer(title,route()));return groups.map(key=>{
 const g=GROUPS[key];return {key,group:g,items:g.items.map(it=>({...it,shown:text.includes(it.label.toLowerCase())}))}
 })}
function itemList(key,items,onlyVisible){const selected=onlyVisible?items.filter(x=>x.shown):items;return selected.map(x=>`<li class="gh-item ${x.shown?'gh-item-seen':'gh-item-unseen'}"><span class="gh-item-status" aria-label="${x.shown?'当前模块可见':'未在当前模块显示'}">${x.shown?'✓':'○'}</span><div><b>${esc(x.label)}</b>${x.detail?`<small>${esc(x.detail)}</small>`:''}</div><em>${x.shown?'本模块可见':'未显示'}</em></li>`).join('')||'<li class="gh-empty">本模块暂未识别到该分类，但完整分类仍保留在「全部类别」中。</li>'}
function scopeNote(kind,host){if(kind==='filter'){
 const options=[...host.querySelectorAll('option')].map(x=>clean(x.textContent)).filter(Boolean);
 const shown=options.length?`当前控件实际包含 ${options.length} 项可选值：${options.slice(0,18).map(esc).join('、')}${options.length>18?'…':''}。`:'当前控件的实际选项以网页显示为准。';
 return `筛选器仅能选择当前页面已经实现的选项。${shown}帮助字典中的额外维度不是自动新增的可选项。`;
 }
 return '“本模块可见”仅根据当前可见文字识别，并不等于数据库核查、发生频次或风险认定。未显示的分类可能是无记录、筛选排除、尚未接入或字段缺失；应到明细/源系统核实。';
}
function popup(title,kind,host){const r=route(),families=findVisible(host,title,kind),all=kind==='directory',groups=all?Object.entries(GROUPS).map(([key,g])=>({key,group:g,items:g.items.map(it=>({...it,shown:false}))})):families;
 let shown=0,available=0;for(const g of groups){available+=g.items.length;shown+=g.items.filter(i=>i.shown).length}
 let out=`<div class="gh-overlay" data-gh-backdrop="1"><aside class="gh-drawer" role="dialog" aria-modal="true" aria-labelledby="gh-dialog-title" tabindex="-1">
 <header class="gh-dialog-header"><div class="gh-header-copy"><div class="gh-eyebrow">PHARMA AI · 全站指标/分类字典 · V${HELP_VERSION}</div><h2 id="gh-dialog-title">${esc(title)}</h2><p>${all?'全站参考分类总目录 · 面向所有页面和未来新模块':`当前页面：${esc(r)} · ${kind==='filter'?'筛选器':'图表 / 卡片 / 明细模块'}`}</p></div><button type="button" class="gh-close" data-gh-close="1" aria-label="关闭完整说明">×</button></header>
 <div class="gh-body"><section class="gh-notice"><b>${all?'完整采购知识分类库':kind==='filter'?'筛选器与候选维度':'数据稀疏也保留完整类型'}</b><p>${esc(all?'这是一套可扩展的药企采购参考检查目录，不代表当前系统已经接入或完成全部流程。':scopeNote(kind,host))}</p></section>
 <div class="gh-summary"><span><b>${groups.length}</b> 项分类主题</span><span><b>${available}</b> 个参考类别</span>${!all?`<span><b>${shown}</b> 个当前模块文字命中</span>`:''}</div>
 <div class="gh-controls"><button class="gh-tab active" data-gh-filter="all">全部类别</button><button class="gh-tab" data-gh-filter="visible">仅当前显示</button><button class="gh-tab" data-gh-open-directory="1">全站分类目录</button></div>
 <div class="gh-groups">${groups.map((g,i)=>`<details class="gh-group" ${i===0?'open':''} data-gh-group="${g.key}"><summary><span>${esc(g.group.title)}<small>${g.items.length} 个完整可核查类型</small></span><i>⌄</i></summary><p class="gh-group-desc">${esc(g.group.description)}</p><ul>${itemList(g.key,g.items,false)}</ul></details>`).join('')}</div>
 <div class="gh-audit"><b>核查方法（推荐）</b><ol><li>先对照上方「全部类别」检查是否遗漏重要风险、根因或行动。</li><li>再回到业务明细，核对编码、来源、时间窗、字段及筛选范围。</li><li>涉及 GMP、注册、供应商批准和财务实际收益时，必须经过授权审批。</li></ol></div>
 <footer class="gh-footer">固定规则：完整字典不得随筛选结果自动裁剪 · 当前演示数据非 ERP/WMS/QMS 实时数据 · Non-GxP</footer></div></aside></div>`;
 if(modal)modal.remove();const wrap=document.createElement('div');wrap.innerHTML=out;modal=wrap.firstElementChild;document.body.appendChild(modal);modal._help={groups,onlyVisible:false};modal.querySelector('.gh-close')?.focus();document.body.classList.add('gh-modal-open')
}
function close(){modal?.remove();modal=null;document.body.classList.remove('gh-modal-open')}
function showTitleFor(trigger){const title=trigger?.dataset.ghTitle||'全站分类总目录';const kind=trigger?.dataset.ghKind||'directory';const host=trigger?.closest('.gh-annotated,.gh-filter-host')||document.querySelector('#content');popup(title,kind,host)}
function eventClick(e){const trigger=e.target.closest?.('.gh-trigger');if(trigger){e.preventDefault();e.stopImmediatePropagation();showTitleFor(trigger);return}
 const closeBtn=e.target.closest?.('[data-gh-close]');if(closeBtn){e.preventDefault();e.stopPropagation();close();return}
 if(e.target.classList?.contains('gh-overlay')){close();return}
 const dir=e.target.closest?.('[data-gh-open-directory]');if(dir){e.preventDefault();e.stopPropagation();popup('全站分类总目录','directory',document.getElementById('content'));return}
 const tab=e.target.closest?.('[data-gh-filter]');if(tab&&modal){e.preventDefault();modal._help.onlyVisible=tab.dataset.ghFilter==='visible';modal.querySelectorAll('.gh-tab[data-gh-filter]').forEach(x=>x.classList.toggle('active',x===tab));modal.querySelectorAll('.gh-group').forEach(node=>{const g=modal._help.groups.find(x=>x.key===node.dataset.ghGroup);if(g)node.querySelector('ul').innerHTML=itemList(g.key,g.items,modal._help.onlyVisible)});return}
}
function onKey(e){if(e.key==='Escape'&&modal){e.preventDefault();close();return}if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('gh-trigger')){e.preventDefault();e.stopImmediatePropagation();showTitleFor(e.target)}}
function install(){if(document.body.dataset.ghInstalled)return;document.body.dataset.ghInstalled='1';const right=document.querySelector('.topbar-right');if(right){const b=document.createElement('button');b.type='button';b.className='gh-directory-button';b.textContent='ⓘ 全站分类目录';b.addEventListener('click',e=>{e.stopPropagation();popup('全站分类总目录','directory',document.getElementById('content'))});right.insertBefore(b,right.firstChild)}
 document.addEventListener('click',eventClick,true);document.addEventListener('keydown',onKey,true);
 const content=document.getElementById('content');if(content){observer=new MutationObserver(schedule);observer.observe(content,{childList:true,subtree:true});scan()}
 window.addEventListener('hashchange',schedule)
}
function audit(){const root=document.getElementById('content');const panels=[...new Set(CARD_SELECTORS.flatMap(s=>[...root?.querySelectorAll(s)||[]]))].filter(visible);
 const missed=panels.filter(el=>!el.dataset.ghReady&&titleFor(el).length>1).map(el=>({title:titleFor(el),className:el.className}));
 const filters=[...root?.querySelectorAll(FILTER_SELECTORS.join(','))||[]].filter(visible);
 return {version:HELP_VERSION,route:route(),modules:panels.length,modulesWithHelp:panels.length-missed.length,filters:filters.length,filtersWithHelp:filters.filter(el=>el.dataset.ghFilterReady).length,missed};
}
window.PharmaGlobalHelp={version:HELP_VERSION,groups:GROUPS,routes:ROUTES,scan,open:popup,audit,close};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
