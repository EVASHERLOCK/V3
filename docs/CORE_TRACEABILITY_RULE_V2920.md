# 全站永久强制：指标/图表/文字分析的来源与计算可追溯（V2.9.20）

适用全站26个路由及今后新增页面，继承 `CORE_TRACEABILITY_RULE_V2919.md`。

## 每个计算型指标的最小审计契约

`metric_id, label, unit, source_kind, source_ref_ids[], as_of, filters, inputs[], numerator, denominator, weights[], formula, rounding, result, calculation_version, missing_value_policy`。页面入口应展示与导出全部字段。不得用 `0` 替代缺失数据；不允许跨物料混合正式报价与模拟价做同一排名基准。

## 每个文字结论的最小依据契约

`claim, evidence_refs[], measured_values[], baseline, comparator, threshold, triggered_rule, exclusions[], confidence_or_status, recommended_action, reviewer_status`。展示决定性数字和**可审查的判断规则**，而不是声称公开模型私有思维链。缺证据时显示“情景建议/待核实”，不能称作审批结论。

## 图表与 Excel

排名显示 Top10，其余可自行展开；时间趋势和漏斗不能裁掉必要轴。每张图应能打开完整源数据表、参数、过滤条件、指标/判定公式。导出 `.xlsx` 必须含输入工作表 + 公式单元格 + 口径说明，不允许伪装 CSV。

## 证书与审批的更高约束

供应商、Site、物料、文件编号与版本必须共同关联；官方线索不是 GxP 批准。缺 GMP/CEP/ASL 文件并不总意味着适用市场禁止准入，RA 必须判断产品、申请路径及法律适用性。未授权系统不能自动变更采购订单权限。此仓库当前是 Non-GxP 原型。

## 当前覆盖状态（不可误述）

已重点补齐成本、项目、供应商绩效和本次合规页公式明细/工作簿；其余页面**尚未逐项实现完整公式血缘**，即便已接全站公式入口，也应显示待登记。开发门禁与渲染测试不能替代企业真实运营审计或监管验证。
