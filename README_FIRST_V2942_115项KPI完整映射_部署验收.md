# Pharma Procurement AI V2.9.42 — 115 项 KPI 全量模拟映射与部署验收

## 本轮修复范围

在 V2.9.41 的全关联模拟种子数据库基础上，为「全球药企采购绩效与经营决策中心」原有 **115 项 KPI** 建立完整模拟计算映射。此前只有 15 项接上网站数据来源；本版新增另外 100 项，使 **115/115 项在有匹配模拟事件的范围内**均能取得计算结果。五个原型页面标题、业务区块与整体模板保持不变。

> 严格区分：这里的 115 项是 **SIMULATED / 非真实企业事实**。财务批准、QA/QMS、GMP、RA 市场适用性、CAPA 关闭、证照有效性等可能采用*模拟事件字段或模拟批准旗标*，**不能用于真实药企受控合规结论、真实付款或批准行为**。原系统受控企业来源和旧版 DEMO 模式不被模拟数据自动覆盖。

## 数据关联与计算链

- 统一来源：`seed_archive/*.csv.gz`（源码分发）在启动/构建时解压至 `seed_simulated/*.csv`。
- 核心主键：`supplier_id`、`material_id`、`project_id`，与 `po_id`、`lot_id`、`change_id`、`document_id` 等事实主键一一追溯。
- 规模：80 家供应商、120 物料、24 项目、30 产品线、12 个月（2025-11 至 2026-10）、1,440 个 PO 及 1,440 条关联 `metric_events`；模拟文件 80 条，另有变更、QC、库存和其他交易表。
- 本轮独立映射：`simulation_kpi_v2942.mjs`，针对 115 个 KPI-ID 定义指标类型、来源字段和可显示的计算表达式。所有映射通过 `po_id` 联接原始 PO、收货/QC、库存、生产和主数据，不填充无来源的“好看数字”。
- 完整计算逻辑：`decision_center_v2935.mjs`，在 `PHARMA_DATA_MODE=SIMULATED` 时启用新映射；允许 `month/supplier/material/project` 四类筛选，按范围重新计算。任一组合没有匹配模拟 PO 时显示「无匹配模拟记录」，不将缺失视作零，也不回退使用全站数值。
- 逐项证据：`/api/decision-center/evidence?metric=KPI-01-01`，每项保留表达式、分子分母、来源行和可追溯范围。`/api/decision-center/module?kind=group&id=d01` 提供分析组报告及关联明细；五页均接入相同指标 API。
- 30 条预警规则、24 项建议与 22 个分析专题会引用相同的 KPI，模拟观测与真正“触发预警/任务派发/合规批准”仍明确分开。

## Excel 真实公式

请求 `/api/decision-center/workbook.xlsx?kind=dictionary&id=all`，获得 10 张工作表：使用说明、指标公式、模拟指标事件、模拟变更、模拟证照、供应商金额汇总、地区金额汇总、完整性和金额核验、分析步骤与结论、逐项公式口径。

`指标公式` **B 列有 115 个独立的 OOXML Excel `<f>` 公式单元格**，C 列为独立 Node 模拟计算基线，可在 Excel 打开并重算对比；另有辅助表的 SUMIF、IF、检查公式。Excel 公式采用当次选择的事件范围，并非用脚本算好后作为固定字符串写入表格。

注意：Excel 中某些统计方法（尤其 DISTINCT、SUMPRODUCT、日期筛选、STDEV）要求正常支持相应函数的电子表格软件；模拟静态发布模式与 Node 模式的工作表数量不同，但都包含 115 项可重算公式。

## Bolt.new、GitHub 导入和部署

完整源码包已删除生成目录 `dist/` 和可由压缩种子恢复的原始 CSV，以适应 Bolt 对 GitHub 文本体积的限制；**不要将历史报告备份或构建输出重复提交到 GitHub**。

```bash
npm install
npm run build
npm run check:simulated
npm run dev
```

浏览器进入「全球药企采购绩效与经营决策中心」五个分页面（`#decision-01` ... `#decision-05`），可以查看模拟来源及 KPI。正式静态 `bolt.host` 发布使用本版构建产生的 `dist/seed_simulated/*.csv` 和浏览器模拟计算引擎；Node Preview 可以使用真正的 server.mjs API 和公式工作簿。

**重要：Bolt 静态 Publish 不意味着持续运行 Node。** 若要在公网使用企业数据同步、数据库写入、受控来源或 Node API Excel，需要另部署同版本的持续运行后端并按 V2.9.39 文档配置 HTTPS API 地址。模拟种子 CSV 更新后须重新构建并发布，静态页面才会显示新数据。

如需旧版样例/严格的旧版“待接入”行为，请在隔离的本地/测试环境运行 `npm run dev:legacy`。

## 验收

执行 `npm run check:simulated`、`npm test`、`npm run check:decision`、`npm run check:bolt`。

本版专项检查覆盖：115 个唯一 KPI-ID；11 个 KPI 业务分组；12 个完整月份（逐月均 115 个有来源模拟值）；各供应商、物料、项目独立筛选；存在真实数据的四维联合筛选；无关联范围的明确缺失状态；30 条模拟预警依据；24 条模拟行动引用；逐项证据与下钻；包含 115 个公式的 XLSX ZIP；构建静态来源快照。

本轮测试**不是**对真实 ERP、QMS、RA 或财务系统及已部署的线上 Bolt 项目的端到端签核。数据库是为业务演示创建的模拟事实模型；指标目标值、审批状态和跨币种/计量单位等须由真实业务定义和受控来源核定，方可用于生产环境。
