/* V2.9.16 supplier database schema. Field presence does not imply verified data. */
(()=>{'use strict';
const fields=(group,items)=>({group,items:items.split('|').map(s=>{const [key,label]=s.split(':');return {key,label}})});
const sections=[
{key:'panorama',title:'一、公司全景',subtitle:'工商主体 · 产能布局 · 财务健康 · 组织 · ESG',groups:[
 fields('工商主体信息','legal_name:企业全称|registered_address:注册地址|founded_date:成立时间|ownership_type:企业性质（外资 / 民营 / 国企）|unified_credit_code:统一社会信用代码|legal_representative:法定代表人|actual_controller:实际控制人|shareholders:股权结构与关联公司|business_scope:经营范围|manufacturing_license:生产许可证|import_export_license:进出口经营权|hazard_permit:危险品经营许可'),
 fields('地理与产能布局','headquarters:总部地址|plant_locations:生产工厂分布（国家/城市/厂区）|r_and_d_centers:研发中心分布|single_site_capacity:单厂最大产能|core_lines:核心产线数量|peak_ramp:峰值产能爬坡比例|warehouses:仓储布局|logistics_reach:物流辐射范围|export_ports:主要出口港口与口岸'),
 fields('经营与财务健康度','annual_revenue:年营收规模|revenue_growth:营收增速|main_business_share:主营业务占比|debt_ratio:资产负债率|cashflow_rating:现金流评级|payment_requirements:付款周期要求|top5_customers_share:前五大客户占比|key_clients:行业头部客户|break_even:盈亏平衡情况|business_changes_3y:近三年扩产、并购、亏损、裁员'),
 fields('组织与核心能力','employee_count:员工总数|rd_staff_share:研发人员占比|core_team:核心技术团队背景|patent_count:专利数量|proprietary_process:独家工艺|industry_certifications:行业认证|procurement_contact:采购接口人|technical_contact:技术接口人|quality_contact:质量负责人|executive_contact:高层对接人'),
 fields('ESG 与可持续发展','carbon_emissions:碳排放|waste_treatment:三废处理|energy_consumption:能耗水平|labor_compliance:劳工合规|workplace_safety:安全生产记录|occupational_health:职业健康体系|anti_bribery:商业反腐合规|data_security:数据安全|ip_compliance:知识产权合规')
]},
{key:'compliance',title:'二、合规资质档案',subtitle:'通用体系 · 药监专项 · 区域贸易 · 合规过程',groups:[
 fields('通用体系合规','business_license:营业执照与税务登记|iso9001:ISO 9001|iso14001:ISO 14001|iso45001:ISO 45001|iatf16949:IATF 16949（适用时）|iso13485:ISO 13485（适用时）|customs_registration:海关登记与信用等级|type_test_report:第三方型式/性能检测报告'),
 fields('药监市场准入','cep:CEP 证书与状态|eu_gmp:EU GMP 厂址证据|fda_fei:FDA FEI/登记与现场检查报告|fda_eir:FDA EIR / 检查分类|dmf:DMF / LoA|cde_aep:CDE 原辅包登记与关联审评|pmda:PMDA 日本市场资料|tga:TGA 澳洲市场资料'),
 fields('药监质量协议与审计','quality_agreement:质量协议|technical_agreement:技术协议|regulatory_inspection:EMA/FDA/NMPA 检查记录|supplier_audit:我方供应商现场审计|gmp_deviation:GMP 偏差调查|oos:OOS 调查'),
 fields('物料与放行','material_spec:物料质量标准|method_validation:检验方法验证|batch_release:批次放行记录|coa_template:CoA 模板|stability:稳定性研究与有效期验证'),
 fields('区域与专项合规','certificate_origin:原产地证|free_sale:自由销售证明|health_certificate:卫生证书|safety_permit:安全生产许可证|dangerous_goods:危险品运输资质|emission_permit:排污许可证|export_control:出口管制合规|non_infringement:知识产权无侵权声明|anti_bribery_statement:反贿赂合规承诺'),
 fields('合规过程文件','change_control:变更控制记录|capa:CAPA 与验证记录|recalls:召回与投诉记录|apr_pqr:APR/PQR 年度产品质量回顾')
]},
{key:'technology',title:'三、技术能力档案',subtitle:'设计 · 样品验证 · 制程 · 研发创新',groups:[
 fields('基础技术资料','datasheet:技术规格书 Datasheet|drawings_2d3d:2D 工程图 / 3D 数模|multi_level_bom:多级 BOM|material_code_rules:物料编码规则|alternates:可替代物料清单|packaging_spec:包装与运输防护标准|storage_requirements:存储要求'),
 fields('样品与验证文件','sample_request:样品申请与送样记录|sample_inspection:自检/第三方样品检验|pilot_validation:小试/中试验证|scale_up:工艺放大验证|compatibility:兼容性测试|aging_life:寿命/老化测试|failure_analysis:失效分析与整改|rd_meeting_minutes:研发评审纪要'),
 fields('工艺与制程','pfd:工艺流程图 PFD|pfmea:PFMEA|control_plan:Control Plan 与抽检/SOP|critical_equipment:关键设备与校准|tooling_moulds:关键工装模具|tooling_life:模具寿命与维护|yield_fpy:良率/直通率|cpk:制程能力指数 CPK'),
 fields('研发与创新','patent_list:专利清单|next_tech_roadmap:下一代工艺规划|joint_projects:联合开发项目经验|head_customer_cases:头部客户合作案例|core_team_cv:核心团队履历|rd_investment:研发投入占比')
]},
{key:'commercial',title:'四、商务与采购历史档案',subtitle:'合作信息 · 价格成本 · 合同 · 份额',groups:[
 fields('合作基础','first_cooperation:首次合作时间|categories_cooperated:合作品类|current_share:当前供货份额|contact_levels:对接层级|response_time:日常/紧急沟通时效|moq:MOQ|lead_time:标准交期|expedited_lead:加急交期'),
 fields('价格成本','price_yearly:年度/季度采购价趋势|price_change:价格变更记录|cost_breakdown:BOM 成本拆解|benchmark_comp:行业基准/竞品/目标成本|savings_history:年度降本历史|savings_measures:降本措施记录'),
 fields('合同与条款','framework_contract:框架合同及到期|contract_renewal:续约条款|payment_terms:账期/付款条件|quote_validity:报价有效期|liability:违约责任和赔偿|ip_terms:知识产权条款|nda:保密协议 NDA'),
 fields('采购份额与定位','category_spend_share:品类采购占比|supplier_tier:战略/优先/备选/观察|future_share_plan:未来1–3年份额规划')
]},
{key:'performance',title:'五、供应绩效与质量历史档案',subtitle:'OTD · IQC · 质量事件 · 8D/CAPA',groups:[
 fields('交付绩效','otd_12m:近12个月 OTD 趋势|delay_avg:平均延期天数|delay_events:重大延期事件|fill_rate:订单满足率|emergency_order:紧急订单响应率|lead_cv:交期波动系数'),
 fields('质量绩效','iqc_12m:近12个月 IQC 合格率|reject_count:批次不合格数|major_quality_incidents:重大质量事件|complaints:客诉次数|complaint_closure:客诉闭环率|return_replacement:退换货率|rework_cost:返工成本'),
 fields('异常与整改','incident_records:质量/交付异常明细|root_cause:根因分析|containment:临时措施|permanent_capa:永久整改措施|capa_effectiveness:CAPA 有效性与复发|eight_d:8D 报告|deviation_investigation:偏差调查报告')
]},
{key:'resilience',title:'六、供应链风险与韧性评估',subtitle:'供应结构 · 外部风险 · BCP/替代',groups:[
 fields('供应结构风险','source_type:独家/双源/多源|supplier_dependency:我方采购占供应商营收比例|buyer_dependency:供应商占我方品类份额|second_sources:替代供应商数量|switching_difficulty:替代开发难度'),
 fields('外部环境风险','geo_risk:地缘政治风险|trade_controls:贸易管制|tariffs:关税影响|natural_disaster:自然灾害风险|energy:能源供应风险|logistics_interruption:物流中断风险|fx_exposure:汇率波动|commodity_volatility:原材料价格波动'),
 fields('供应链韧性','backup_capacity:备份产能|alternate_sites:异地工厂备份|secondary_raw_share:关键原料第二来源占比|safety_stock:安全库存|emergency_plan:应急响应预案|bcp:业务连续性计划 BCP|drp:灾难恢复计划')
]},
{key:'relations',title:'七、战略合作与关系管理',subtitle:'合作层级 · 联合价值 · 替代图谱',groups:[
 fields('合作层级','relationship_tier:交易/合作/战略伙伴|executive_alignment:高层对接机制|annual_business_review:年度战略复盘|trust_level:互信程度|openness:信息开放度'),
 fields('联合价值项目','joint_rd:新品共研项目|joint_process:联合工艺优化|cost_down:成本共降|exclusive_agreement:独家合作/优先供货|tech_sharing:技术共享|patent_cross_license:专利交叉许可'),
 fields('替代关系图谱','direct_alternates:直接替代候选与阶段|reverse_alternates:可替代其他供应商|switch_time:切换时间成本|switch_validation_cost:切换验证成本|switch_tooling_cost:模具切换成本')
]},
{key:'audit',title:'八、文档留痕与审计追溯',subtitle:'沟通 · 版本 · 年审 · 数据治理',groups:[
 fields('记录与追溯','meeting_minutes:正式会议纪要|email_confirmation:邮件确认|negotiation_history:谈判记录|document_versions:文件历史版本/作废|supplier_annual_review:年度供应商评审|improvement_plan:改进计划|record_owner:档案维护责任人|last_verified:最后核验时间|source_reference:数据来源与证据链接|data_lineage:证据审核/变更记录')
]}
];
const documents={
 universal:['营业执照（含合一登记信息）','ISO 9001 证书与认证范围','ISO 14001 环境体系','ISO 45001 职业健康','IATF 16949 / ISO 13485（适用）','进出口备案 / 海关信用','产品第三方检测报告'],
 pharma:['CEP 证书 / 修订记录','EudraGMDP / EU GMP 厂址检查资料','FDA FEI / 检查报告 / EIR','DMF 编号 / LoA（适用）','CDE 原辅包登记 / 关联审评','PMDA / TGA 当地资料','质量协议 / 技术协议','官方检查报告及缺陷回复','我方现场审计报告','GMP 偏差/OOS 调查','物料规格书及检验方法验证','CoA/批次放行记录','稳定性研究与有效期'],
 regional:['原产地证 / 自由销售 / 卫生证书','安全生产 / 危险品运输 / 排污许可证','出口管制与制裁合规','反贿赂 / IP 无侵权承诺'],
 lifecycle:['Change Control 变更控制','CAPA/8D 报告与验证','召回与客诉记录','APR/PQR 年度质量回顾','历史版本与归档证明'],
 technical:['Datasheet / 图纸 / BOM','样品申请与检验报告','小试/中试与工艺验证','兼容性/老化/失效分析','工艺流程图 PFD / PFMEA','Control Plan / SOP','设备/模具维护与校准','CPK / 良率数据','专利与技术路线']
};
window.PharmaSupplierDatabaseSchema={sections,documents};
})();
