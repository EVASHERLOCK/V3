# V2.9.48 | 采购网站续开发与严格验收说明

**状态：代码构建、静态数据审计、限定范围公式重算成功；正式业务验收仍为 BLOCKED。绝不能将本报告当作 39 页全站端到端、受控企业数据覆盖或业务签核通过。**

## 一、继承与修改范围

在既有 V2.9.47 源码、217 个历史活动组件和 5+9 个 iframe 页面基础上修改，不替换业务平台。新增：

- `static/decision-center/lineage_entry_v2948.js`：5 个绩效页面共享三入口，覆盖 KPI 总览 115、分析卡 22、规则 30、行动 24、指标字典 115，共 306 个页面控件位置。公式/来源从 Node API 取得；仅静态部署且无 API 时明确报错，不伪装数据。
- `static/procurement-execution/assets/app.js`：9 个采购执行页面的 62 个可展开业务面板均具 ∑ 计算血缘、▤ 来源逐行与 ↓ Excel 入口；缺数返回不可计算；趋势图源数据缺失时跳过柱或断开折线，不补 0。
- `procurement_execution_v2937.mjs`：9 页服务端 XLSX 对原始字段、派生公式、指标计算、逐格对账、变量字典和步骤说明建立关联。派生字段为真正公式。核查并修正 RFQ 有效状态、币种舍入、PO 回签逾期、发票差异/匹配定义、数据基准日。
- `static/procurement-execution/assets/full_formula_xlsx_v2948.mjs`：无 Node API 时的静态 XLSX 生成器也使用实际单元格公式及网页—Excel 逐格对账。静态版属于 **模拟快照**；有动态权限/企业接口的页面不能依靠静态快照通过验收。
- `server.mjs`：新增 `GET /api/sim-data/complete-page`，按来源 CSV 快照 SHA-256、偏移量、筛选范围读取完整模拟表。单页上限 500，分页中数据变化返回 HTTP 409；主键重复、缺失返回错误。**该接口不连接真实企业 ERP/QMS。**
- `static/sim_data_center.html`、`static/sim_full_source_v2948.js`：新增用户可点的“21 表模拟来源全量分页核验”及每表状态栏；静态无 API 则显示不可用、不判通过。
- `module_traceability_v2928.mjs`、`static/module_traceability_v2928.js`、`browser_module_trace_v2939.mjs`：移除每表最多 800 条的硬截断。**DOM 行数仍是网页渲染行数，不代表数据库记录总数。**
- `docs/V2948_逐实际控件验收清单.json` + `scripts/check_v2948_component_inventory.mjs`：重做为实际控件级登记。217 个历史 + 306 绩效控件 + 62 采购执行面板 = **585 个验收单元**，全部沿用 12 类必须证据的严格门禁，未签核不可标记 PASS。V2.9.47 的 291 项旧暂定登记文件保留用于向后追踪，本版以 585 项为实际 UI 明细基准。

## 二、本轮已执行的测试范围和结果

| 检查 | 结果 | 限制 |
| --- | --- | --- |
| 模拟数据库来源 | 21 表 / 21,363 行，跨页快照一致、主键去重、总数一致；0 失败 | **仅模拟 CSV；不代表企业数据库** |
| 采购执行 Node 导出 | 9 页 `SUP-001` 筛选样本，1,512 个派生单元格 MATCH，55 个 KPI 聚合一致，1 个聚合因条件不足保留未核验 | **限定筛选范围，非全 21,363 行逐格** |
| 采购执行静态 XLSX | 9 页同一模拟筛选，1,512 个派生单元格 MATCH，55 个 KPI 聚合一致，1 个未核验 | Excel 引擎独立复算；不是页面真实点击/部署验证 |
| 离线 Chromium DOM | 9 页 62 面板三入口结构、公式/变量/来源点击；5 页 306 入口显示/事件接线，0 失败 | 仅浏览器 `set_content()` 注入，**不是 HTTP 部署端到端**；绩效 API 断开时只能核验失败提示 |
| 决策 Node API 冒烟 | `KPI-01-01` 来源证据 HTTP 200；对应真实 XLSX HTTP 200 | 属于单接口抽样，不是 115 指标逐格全面核对 |
| 构建与历史回归 | `npm run build`、旧的 9 页数据一致性和静态发布数据检查、115 项模拟 KPI 数据核查通过 | 属于代码/模拟测试，不是业务验收 |
| 严格验收 | 585 登记；**0 具备全部证据，585 待验收；BLOCKED** | 缺生产浏览器、ERP/QMS、业务 Owner 逐项签核 |

逐项报告在 `docs/V2948_来源公式结构测试.json`、`docs/V2948_Excel重算逐格对账.json`、`docs/V2948_静态Excel重算逐格对账.json`、`docs/V2948_离线浏览器交互测试.json`、`docs/V2948_严格验收门禁报告.json`。

### 当前仍缺哪些验收步骤？

1. **217 个历史模块**：尚无可访问已部署站点的 Chromium 交互证据，不能将 217 项标成通过。
2. **5 个绩效 iframe**：306 个入口的源码与离线 DOM 已接线，但真实 HTTP API 逐项点击、完整来源页分页、单元格公式和 115 个指标的 Excel 逐格核对仍需继续。纯静态发布未实现这 306 个入口的离线真实 Excel 下载，需要部署 API。
3. **9 个采购执行 iframe**：已修复并通过同一筛选条件下的实公式复算，但还要覆盖所有筛选组合、所有图表/表格的细项及已部署 HTTP 的下载、打开、点击验收。当前 1 个 KPI 在示例筛选中因缺乏充分条件仍不予认定。
4. **企业真实数据库来源**：无受控 ERP、QMS、SRM、AP 等接口授权和快照，所有 21 表完整性结论仅限模拟 CSV。
5. **文字分析签核**：已登记来源、变量、阈值与文字步骤，但仍需要逐条由相应采购/QA/财务责任人对实际业务结论、差异和例外签字。数据模拟场景下不应生成正式审批结论。

## 三、开发、核查与部署

从 ZIP 解压后的项目根目录执行：

```bash
npm run build
npm run dev
```

打开站点的“统一模拟数据中心”，点击“逐表取得全部来源行并核验”。采购执行九页各面板可点三入口；绩效决策五页的 Excel / 来源入口需要带 API 的 Node 服务才能真正取得内容。

独立测试：

```bash
npm run check:v2948:components
# 启动 SIMULATED Node 并监听 39476 后，运行：
PHARMA_TEST_URL=http://127.0.0.1:39476 npm run check:v2948:source-and-formula
# 需要 Python Playwright + /usr/bin/chromium，仅测试离线 DOM：
npm run check:v2948:offline-dom
# 需要 artifact_tool 公式计算引擎，使用项目所在机器已生成的样本 XLSX 目录：
python3 scripts/check_v2948_xlsx_recalc.py /path/to/nine/workbooks
# Node 生成静态发布版本：
node scripts/generate_v2948_static_xlsx_check.mjs
```

`npm run check:v2948:components:strict` **预期退出非零**：这表示待验收项目仍在硬拦截，而不是构建损坏。

**要求不变：每个组件必须列出公式与术语、全部变量、适用条件、全量来源、逐格网页/Excel 对账、真实公式 XLSX、逐步文字结论，以及真实浏览器与业务责任人证据。任一证据缺失均不得 PASS。**
