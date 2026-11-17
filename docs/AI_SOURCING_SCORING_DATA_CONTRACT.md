# 战略寻源共享数据契约 · V2.9.5

**适用于九个战略寻源子页面，后续扩展必须遵守。**

1. 基础采购/质量/准入数据只读：`enterprise_v08` `/api/v08`、统一 `master/purchasing/sourcing/qualification/supplier` 字段。
2. 原材料50家候选目录：`window.PharmaSourcingUniverse.catalog`；基准供应商3家，扩展情景候选47家，保留 `data_origin/is_scenario/evidence_status` 字段。任何新页面不得将场景候选自动转为已批准。
3. `window.PharmaAISourcing.build(raw,filters,universeCatalog,working)` 是可重用的纯计算入口；`window.PharmaAISourcing.model()` 读取当前工作集；`setFilters` 更新类别、模式、地区等共享筛选，并记录在sessionStorage。
4. 匹配关键字 `supplier_id + material_id + site_id + market`。不允许把“供应商已批准”直接等价为“所有物料/厂址/目标市场都批准”。
5. 商业评分与合规独立。即使低价/高评分，也不得替代 GMP/CEP/ASL/Site×Material 检查；证据未登记应显示“未核验”。
6. 报价落地成本：`unit_price × fx_to_usd × max(quantity,moq) + freight_usd`；必须注明源币种、来源，税费与单位不完备时报告提示。
7. 仅有来源质量/交付/报价时才生成商业评分；四权重自动归一化，不可空中制造质量指标或将未经核验情景风险分数当成正式审计。
8. 工作集 CSV 仅在页面内临时覆盖报价等分析输入，不回写原 PO、资质与财务，需走审批后端才可变更正式数据。
9. 每个新的模块、KPI、筛选器必须继承 `docs/GLOBAL_HELP_INVARIANT.md` 的全站永久问号字典规则。
10. 当前尚未开发的子页面只提供可导航的共享入口，不可以冒充已实现互相读写或受控工作流。
