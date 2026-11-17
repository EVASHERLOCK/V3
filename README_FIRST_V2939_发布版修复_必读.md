# Pharma Procurement AI V2.9.39 · Bolt 发布版兼容及完整后端部署

## 这次到底修复了什么？

现象：Bolt Preview 里的 Node server 运行正常，但发布到 `https://evasherlock-pharma-p-h7kx.bolt.host` 后：

- 「∑ 本模块公式 / 分析依据」及「▤ 展开全量计算依据和来源表」请求 `POST /api/lineage/module` 返回非 JSON 结果，旧浏览器引擎误把 JSON 当 FormData 抛出“请求缺少 FormData”；
- 采购执行九页入口初始调用 `GET /api/procurement-execution/site-data.js`，发布时缺少持续运行的 Node 端点，导致 `window.APP_DATA` 未定义，页面停留“正在加载”。

**根因是代码对发布环境的后端能力假设不成立，并不等于页面内容被删除。**

### 已实施的静态兼容修复

- 九页 HTML 改为加载本项目**构建时**从同一 `samples/*.csv` 计算生成的 `site-data.js`，缺少后端时也能初始化页面。修改后仍有 9 个页面、65 份 Excel 参考工作簿和同一数据键。
- 「模块公式/来源表」JSON POST 不再误作 FormData。无 Node 后端时，只读浏览器引擎加载本次构建生成的 97 项 V08 DEMO 源指标公式目录。能展开匹配指标、公式、原始来源行和当前可见表格，**明确显示静态快照与证据等级**。
- 静态备用模式下，浏览器可生成含真实 `COUNT/SUM/AVERAGE` 等 Excel 公式单元格的 XLSX。订单/发运九页的来源表按当前前端筛选重新取行，不能假称是正式签署的审批/付款/发票。
- **静态页面更改供应商/物料/年份筛选后，模块聚合 KPI 不会借用未筛选原值：标记“待 Node 后端重算”。** 不把未计算的财务指标伪装成已核验结果。
- 企业来源模式没有静态 DEMO 冒充，缺少后端时明确拒绝企业证据查询。

这些修复让静态发布版页面可查看，但**静态页面不等于完整 Node API，也不承诺 100% 的全站正式公式、动态财务数据与企业对账可用**。

## 要在 bolt.host 上完整使用所有计算/明细/Excel，需要一个持续可访问的 Node 后端

项目已有 `server.mjs`（不是 Bolt Cloud Edge Functions）。`npm run dev` 在 Preview 的 WebContainer 内运行 Node，并不保证 Bolt Publish 将此进程作为生产 API 持续运行。要恢复与 Preview 相同的 API 功能，可将**同一源码仓库**部署到支持长运行 Node 的平台，例如 Render / Railway / 你自己的服务器；网页仍保留当前 `bolt.host` 地址。

### A. 部署 Node API

1. 在支持 Node 的托管平台从 GitHub 连接 **同一 V2.9.39 源码**，创建 Web Service。仓库内附 `render.yaml`（使用该平台时可按实际套餐调整）。
2. 构建命令：`npm install && npm run build`；启动命令：`node server.mjs`。需要 Node 20+，端口使用托管平台的环境变量 `PORT`。
3. 环境变量必须设定：
   `PHARMA_ALLOWED_ORIGINS=https://evasherlock-pharma-p-h7kx.bolt.host`
   这是浏览器端访问本服务的精确来源白名单；多个域名可用英文逗号分隔。**不要在前端写管理员令牌。**
4. 获得后端 HTTPS 地址，例如 `https://<你的服务名>.onrender.com`（这只是格式示例）。检查 `<后端地址>/api/health` 能返回 JSON，检查 `<后端地址>/api/procurement-execution/site-data.js` 返回 JavaScript。
5. Node 如需保留企业签核、文件、ERP 映射或审计记录，需要另外配置持久化存储、备份和访问控制；临时文件系统或免费实例不保证这些记录跨重启留存。**此包仍是 Non-GxP DEMO，不能作为真实质量放行/电子签名系统。**

### B. 在 Bolt 的静态前端设置后端地址

1. Bolt Code 打开根目录 `static/index.html`。
2. 找到 `<meta name="pharma-api-origin" content=""/>`。
3. 将 `content` 改成你真正部署后的 HTTPS Node API **origin**，例如：
   `<meta name="pharma-api-origin" content="https://<你的服务名>.onrender.com"/>`
   这不是密钥，只是 API 域名；不要在地址中加 `/api/`。
4. 在 Bolt 终端执行 `npm run build`，Preview 检查；再点 **Publish → Update**，重新发布同一个 `bolt.host` 网址。
5. Chrome 开发者工具 → Network → 打开一个模块的「∑」按钮，应观察到 JSON `POST https://<后端地址>/api/lineage/module?source=demo...` 返回 **200**；点击 Excel 应返回 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`。采购执行九页的启动数据同样来自 Node API，失败时安全退到静态 DEMO 快照。

### C. 不部署后端，只继续使用 Bolt 静态发布

也可以。九页不再卡在“正在加载”，模块公式按钮至少能展开本次发布快照的来源、关联指标和静态公式工作簿。然而 V08 以外的动态指标接口、跨页筛选聚合、全部企业凭证和完整 Excel 业务复算仍需要后端。不要将静态模式当作真实 ERP/QMS 数据服务。

## 测试记录

- `npm run build` 和整站 `npm test`：通过。
- `npm run check:execution` 和 `node test_v2939_published.mjs`：通过。
- 九个采购执行页面在离线 Chromium 中逐页初始化：9 / 9，未发现 JS 异常。
- 静态模块 `POST` JSON：返回包含同源 DEMO 来源行的结构化报表，筛选改变时不冒用原范围数值。
- 静态公式 Excel：通过 openpyxl 读取并检查确实存在公式单元格。
- 本地 Node API：`GET /api/procurement-execution/site-data.js` 返回 200；`POST /api/lineage/module` 返回 200，跨域预检 OPTIONS 返回 204 和精确允许源。
- 由于运行环境无法访问你当前 `bolt.host` 部署页面，**未宣称已在线上实测**。以上只证明修复源码本地行为；真正发布后仍需进行网络请求验收。

## 覆盖时的重要提醒

如果 Bolt 项目已经可用，直接把 ZIP **解压后的内容**覆盖到 Bolt 项目根目录。不要上传 `dist/` 或 `node_modules/` 到 GitHub；构建时自动生成。项目版本是 `2.9.39`，原有 Overview、变更控制、五页绩效中心、九页采购执行和其他业务模块均保留。
