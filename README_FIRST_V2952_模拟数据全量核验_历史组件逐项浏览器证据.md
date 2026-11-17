# V2.9.52 — 仅用模拟 Demo 数据：23 表全量 API + 历史模块逐项浏览器证据

> 本次版本**不需要 ERP/QMS、真实企业数据或企业业务负责人签名**。请勿将模拟数据验收标为企业生产/GxP 验收。

## 1. 本轮代码改动

- `sim_data_center_v2941.mjs`、`server.mjs`：将 21 张核心业务 CSV 和 **2 份辅助 CSV** 合并进只读全量分页源目录；分页返回每行主键、来源快照 SHA-256、offset、has_more、total。辅助源禁止通过旧的变更接口写入。
- `static/sim_full_source_v2948.js`：网页全量来源核验默认覆盖 **23 个模拟文件**。
- `scripts/test_v2952_23_demo_sources.mjs`：用真实 Node HTTP 接口逐页读取 **21,455 行**，核对本地原始 CSV、主键去重、顺序、分页和错误快照的拒绝行为。
- `static/module_traceability_v2928.css`：历史公式按钮由绝对浮动改为模块内部正常文档流，解决嵌套卡片遮挡；`static/module_traceability_v2928.js`：重复基线组件 ID 添加显式后缀，避免相同标题的组件互相覆盖。
- `scripts/browser_v2952_demo_bridge.py`：浏览器逐个操作公式入口、来源入口、Excel 下载，检查下载的 XLSX 存在实际公式 `<f>` 单元格，并记录实际 Node Demo 接口返回摘要；对于原站 `<details>` 的兼容区域先实际点击 summary 展开。
- `scripts/run_v2952_browser_routes.py`：按路由隔离运行浏览器操作，避免页面间状态污染；失败路由保留失败证据，不自动标记通过。
- `scripts/check_v2952_demo.mjs`：汇总 585 个控件的**分层**进度、原始证据哈希、按路由结果，提供 `static/audit/demo-acceptance.html` 可视页面。

## 2. 如何运行

在项目目录、Node.js >=20 的模拟模式：

```bash
npm run check:v2952:source
npm run check:v2952:demo
npm run build
```

浏览器回归需要 Python Playwright 及系统 Chromium。由于当前环境策略阻止 Chromium 直接导航本机 HTTP，采用离线注入**原始发布页面脚本**、以 Python 请求桥转发到实际本地 Node HTTP 服务的方式执行真实 DOM 点击：

```bash
python3 scripts/run_v2952_browser_routes.py --jobs 2
npm run check:v2952:demo
```

**注意：**离线页面脚本 + 真实 API 桥接 **不等于原生浏览器 HTTP 导航端到端测试**。源码中的 `--strict` 严格检查应继续阻止证据不全的全量通过声明。

## 3. 本轮复算结果（指定模拟数据）

- **23/23 来源 CSV**：**21,455 行**在 Node HTTP 分页接口中按主键、快照和原始文件逐行 MATCH。
- **217 个历史登记组件**：**211 个存在当前 DOM**；**202 个正常点击三入口并下载检测到真实公式的 XLSX**。
- **15 个仍待解决**：`m09` 旧版已被 CC31 替换的 **6 个旧控件 ID**；`ss-performance` 公式异步超时 **4 个**；`ss-data` 原站授权管理区默认隐藏 **5 个**。没有为这些组件伪造通过。
- **585 项单组件最终完整 Demo 验收仍为 0 项**：全来源文件完整、入口可点击和部分限定筛选样本同值不等于每一组件全部来源选取/公式格/文字分析已独立验证。

## 4. 三层证据是不同的

- **来源表级已核验**：23/23 CSV，21,455 行，完整分页、主键、快照、原值核对。
- **历史组件入口核验**：217 个历史基线控件中，本轮逐项记录是否正常点击三个入口、是否收到真实 API 响应、下载是否包含 XLSX 公式。页面中原 `m09` 6 个基线组件已经由新的 CC31 替代，不能用不存在的旧 ID 记为通过；鉴权后才展示的设置模块不能偷偷删除 `hidden` 属性来伪造点击通过。
- **单组件完整 Demo 业务验收**：仍需该组件**所有关联来源行、网页每格结果与 Excel 独立同值复算、公式/变量/术语/条件/文字结论**全部可查证。逐格工作仍未覆盖 585 个控件，因此不能因为三入口能点或表级完整就将其标记为最终 PASS。

本次基线沿用前版限定样本复算：115/115 KPI、九个采购执行页共 1,512 个单元格 MATCH，但**不冒充**所有筛选组合、所有组件已完成逐格对账。旧版 1 个采购执行聚合指标待核验。

## 5. 报告

- `docs/V2952_Demo_23表全量API分页逐行同值.json` — 23 个 CSV、21,455 行每一行 API 与 CSV 原始值验证
- `docs/V2952_217历史组件_离线浏览器真实Node接口点击证据.json` — 逐组件浏览器运行、真实 API 返回和 XLSX 公式证据
- `docs/V2952_Demo_585逐组件分层进度.json` — 585 项精确的未完成项与分层状态
- `docs/V2952_Demo_585逐组件验收进度.csv` — 可直接导入表格处理的进度表
- `docs/V2952_Demo_验收总报告.json` — 总结、版本、证据哈希与阻塞项
- `static/audit/demo-acceptance.html` — 打开站点 `/static/audit/demo-acceptance.html` 查看分层结果

## 6. 继续完成真正的 Demo 全量验收

先逐项处理旧 m09 到 CC31 的映射、鉴权隐藏与部分复杂图表的展开操作；随后对每个组件自动列出**所引用的模拟来源主键集合、筛选条件、公式格和逐步分析结论**，以源数据交叉计算检查 XLSX 对账。只有这些有独立可复查的证据后才可将某组件的 `component_demo_full_acceptance` 改为 `PASS`。
