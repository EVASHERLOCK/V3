# V2.9.49｜统一三入口、模拟计算回归与分层验收

**本次交付是 V2.9.48 源码上的可运行增量，不代表全站业务正式验收通过。**

## 1. 使用方法

1. GitHub/Bolt 导入 `Pharma_Procurement_AI_V2949_GitHub_Bolt_Source_Only.zip` 的源文件。Node ≥20；依照项目现有方式安装依赖、运行 `npm run build` 后再 `npm start`。`npm run build` 包含旧版 585 项登记一致性门禁与新的 171 指标定义一致性门禁，构建成功不等于业务验收。
2. 仅静态托管请使用 Full Source + Static Build ZIP 内 `dist/`。其绩效五页使用 `SIMULATED` CSV 静态计算和公式 XLSX 降级逻辑，不需要 Node API 才能生成模拟结果。但**企业数据**接口不允许降级成模拟数据。
3. 运行 `npm run check:v2949:all` 做研发回归。这条命令需要 Python + `artifact_tool` / `openpyxl` + Playwright + `/usr/bin/chromium`，本轮环境已具备。脚本会自动在本地临时端口启动 Node 做 HTTP 资源测试。生产构建只需 Node，无需这些 Python 测试依赖。
4. 若只有 Node 环境，执行 `npm run check:v2949:fast` 进行 171 项目录/14 页接入/模拟来源结构快速检查。若要重生指标定义目录，执行 `node scripts/generate_v2949_audit_catalog.mjs`，提交前会自动与源模型核对。

## 2. 本轮实装

- **14 个 iframe 页共用一套入口文字和控件生成器**：`static/audit/audit_ui_v2949.js`，分别由 `static/decision-center/lineage_entry_v2948.js` 及 `static/procurement-execution/assets/app.js` 执行。采购执行仍复用原 V2.9.48 的真实公式/来源/Excel 计算，不重写不必要的业务公式。
- **171 项指标定义的唯一自动生成目录**：`audit_registry_v2949.mjs`、`static/audit/metric_catalog_v2949.json`，其中 115 项决策中心 KPI、56 项采购执行 KPI，登记变量依赖、条件和解释步骤，并对重复或缺失引用失败即停。目录是**定义层**，并非 171 项全部计算已获业务审批。
- **静态绩效 Excel 路径**：`static/decision-center/offline_v2942.mjs` 根据点击的 KPI/规则/分析/行动等模块限定导出范围，包含模块分析、完整来源记录、术语变量、逐行唯一计数、逐行预测误差、115 项真公式及逐格对账表。修复独立公式重算发现的舍入、SUMPRODUCT 数组去重、预测差值、TOP5 不足五名的错误。测试样本为 SUP-001 范围内 115/115 MATCH。
- **避免旧式截断**：决策中心 Node 明细去除 500/1000 行固定截断；静态浏览器的来源展示每页 100 行，保留已取回的全部记录。**注意：接口返回的模拟快照的全部记录，不等于真实企业数据库全部记录。**
- **构建阻断**：延续 V2.9.48 共 585 个控件级验收登记及 12 类强制证据。没有真实验收记录仍不可标记 PASS，也不允许新增模块绕开目录一致性检查。

## 3. 可复验的测试证据

| 范围 | 实测结果 | 严格边界 |
| --- | --- | --- |
| 9 个采购执行 iframe | 62 个面板离线 Chromium DOM 三入口交互通过 | 不是正式站点 HTTP 浏览器点击 |
| 5 个绩效 iframe | 306 处三入口控件离线 DOM 挂载通过 | 模拟的网络不可用行为与页面控件验证；不证明 306 处单独下载均端到端成功 |
| 9 个采购执行页静态 Excel | 1512 个衍生单元格 MATCH，55 个聚合一致，1 个聚合仍未验证 | 模拟 SUP-001 样本，非所有筛选组合 |
| 绩效中心静态 Excel | 115 项 KPI 真实公式，独立计算引擎重新计算 115/115 MATCH | 仅 SUP-001 模拟筛选的工作簿，不代表所有数据筛选或业务审批 |
| 模拟来源 | 21 张表、21,363 行，已检查主键与分页完整性 | 不等于 ERP/QMS 企业全量 |
| 实际 Node HTTP 冒烟 | 22/22 资源与接口返回正常 | API 冒烟不是 Chromium 端到端验收 |
| 全站正式业务验收 | **BLOCKED；585 项未完成完整 12 类证据** | 尚缺 217 历史组件真实浏览器逐点、企业数据和业务负责人签核 |

测试报告：`docs/V2949_分层验收与剩余工作.json`、`docs/V2949_绩效115KPI逐格重算.json`、`docs/V2949_离线浏览器交互测试.json`、`docs/V2949_HTTP接口冒烟.json`。示范 XLSX：`Pharma_Decision_V2949_115_KPI_Formula_Reconciliation_DEMO.xlsx`（独立交付）。

## 4. 三层进度：不能混为一谈

- `FUNCTION_TESTED`：限定范围的离线 DOM/HTTP 冒烟绿灯，不是正式网站全量 E2E 证据。
- `SIMULATED_RECONCILED`：指定模拟样本计算相符；对未验证的 1 项仍留待办。
- `ENTERPRISE_BUSINESS_SIGNED`：必须提供真实部署可访问浏览器、ERP/QMS 全量数据访问、可追溯来源行与业务负责人签核；本轮依然 `BLOCKED`。

## 5. 下一阶段需外部条件的未完成事项

1. 部署到可被 Chromium 正常访问的测试域名，逐一为 217 个历史组件（以及 14 页三入口）采集真实点击、下载与源行核对证据。
2. 接入真实 ERP/QMS 数据源，校验数据库快照、分页终点、行键去重及访问范围，确认来源不再被 DOM 截断，并签署数据口径。
3. 按 585 项清单完成每项 12 类证据，特别是全部指标公式的变量、边界条件和业务文字结论。少一项禁止业务 PASS。
4. 将 1 项采购执行的未核验聚合与其他筛选条件下的 KPI 独立复算纳入后续校验；不可以把 SUP-001 的 MATCH 外推到全部业务数据。

**节省开发时间的规则**：不再按卡片重复写三个按钮；新增指标从源模型定义、生成目录、复算脚本和证据门禁统一推进；严格业务签核继续独立阻断。
