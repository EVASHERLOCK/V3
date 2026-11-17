# V2.9.50 — 第三层：正式企业业务验收工程化交付

> 这次交付的是**可执行的正式验收采证与阻断工具**，不是未经企业数据和人员授权的“全站已签核”证明。

## 核心事实（请勿误读）

- 保留 V2.9.49 的统一三入口、171 项指标定义及前两层模拟复算结果；没有把模拟数据冒充真实 ERP/QMS。
- 全站控件登记仍为 **585 项**，其中 **217 历史组件 + 368 iframe 控件**。
- 在本沙箱中，真实 Chromium 访问 HTTP/localhost 受到 `ERR_BLOCKED_BY_ADMINISTRATOR` 限制。`docs/V2950_本环境真实浏览器受阻实测.json` 显示 **0/217** 成功，余下项标记“浏览器策略阻止，未尝试”，不是失败的业务组件，也不是通过。
- 没有提供企业真实部署 URL、ERP/QMS 只读访问/完整导出及授权业务负责人，因此正式第三层为 **BLOCKED（0/585 正式 PASS）**。
- `npm run build` 与 `npm run check:governance` 可运行；V2.9.49 原有 HTTP 22/22 冒烟检查通过。依赖安装在当前沙箱超时，**没有宣称完整 `npm test` 或真实生产端到端测试通过**。

## 本轮新增

1. `scripts/browser_v2950_live.py`：不注入 DOM，必须 `page.goto` 实际 HTTP(S) 页面，用真实 Playwright click 操作每个控件的公式、来源和 Excel；会检查下载的是有效 XLSX 且有公式单元格；记录控件 ID、页面、点击结果及哈希。缺失、下载失败或页面策略拦截均留痕。默认是 `--scope all`，覆盖 585；`--scope legacy` 单独覆盖 217。
2. `scripts/check_v2950_source_exports.mjs`：流式核验 ERP/QMS **真实** CSV，逐行检查主键、跨行引号、独立 `COUNT(*)`、版本快照、全量导出范围、文件 SHA-256；超过 800 行不截断。注意：CSV 本身只能证明导出包内部一致，不能证明“确实来自企业系统”，后者必须有数据负责人签名。
3. `enterprise_acceptance_v2950.mjs` + `scripts/check_v2950_enterprise.mjs`：严格检查 585 × 12 项独立证据文件的 ID、字段、记录时间及 SHA、非本地 HTTPS 浏览器、真实来源登记、全量来源关联与两个受信任签名。缺任何一项只能 `BLOCKED`。
4. `scripts/init_v2950_evidence.mjs`：初始化 585 个 **空白 PENDING** 证据槽位；不会生成虚假的通过材料。
5. `scripts/import_v2950_browser_proofs.mjs`：实际生产 HTTPS 浏览器测试后，最多自动登记两个证据字段（点击、浏览器 E2E）。不自动写入“数据库全量、公式正确、业务签核”等其余字段。
6. `scripts/sign_v2950_approval.mjs`、`scripts/attach_v2950_source_signature.mjs`、`scripts/prepare_v2950_signoff_payload.mjs`、`scripts/assemble_v2950_business_signoffs.mjs`：数据负责人和业务负责人分别持有外部 Ed25519 私钥签名；验收材料变化后原签名无法继续匹配。

## 在当前项目中执行（普通开发不应受正式验收证据缺失影响）

```bash
npm run build
npm run check:v2950:unit
npm run check:v2950:gate        # 输出报告，当前为 BLOCKED，不以非零状态影响正常构建
npm run check:v2950:strict      # 缺企业证据时必须返回退出码 2
```

第三层报告：`docs/V2950_第三层正式业务验收报告.json`。真实浏览器本环境受阻报告：`docs/V2950_本环境真实浏览器受阻实测.json`。

## 企业环境的正确执行流程

**前置条件：** 需要一处用户有权访问、确实部署了本版本的 **HTTPS Node 企业测试或生产站点**；ERP/QMS 数据访问需企业正式授权。不要在聊天中粘贴账户密码、生产数据或签名私钥。

1. 企业正式部署地址可访问后，使用下面命令执行全部 585 控件真实点击；如只补历史主站可先用 `--scope legacy`，但 217 项通过不等于 585 项整体通过：

```bash
python3 scripts/browser_v2950_live.py \
  --url 'https://YOUR-AUTHORIZED-DEPLOYMENT/' \
  --scope all \
  --environment ENTERPRISE_DEPLOYMENT \
  --storage-state /secure/playwright-auth.json \
  --out /secure/enterprise_evidence_v2950/browser_report.json
```

`--storage-state` 是可选的，若站点无需登录则去掉。该文件可能含登录令牌，不可传入代码仓库。只有企业批准并设置受控存储时才使用 `--screenshots`；截图和下载数据可能包含敏感商业信息。浏览器操作通过≠公式逐格复算通过。

2. 在受控服务器中对 ERP/QMS 执行**同一数据库快照**的全表只读导出及独立 COUNT 查询，使用 `templates/v2950/source_manifest.example.json` 所列字段建立真实 `source_manifest.json`，同时填写全部 585 组件的来源表覆盖关系。仅允许真正全量导出，不允许只列当前 DOM 行、`LIMIT` 或只以演示数据替代。

3. 执行：

```bash
node scripts/check_v2950_source_exports.mjs --bundle /secure/enterprise_evidence_v2950
node scripts/import_v2950_browser_proofs.mjs --bundle /secure/enterprise_evidence_v2950
```

4. 数据负责人审查真实来源清单，使用**本人在企业密钥管理中受控保存的 Ed25519 私钥**对尚未签名的来源清单签名；再将签名附回来源清单。企业 IAM/合规部门提供**独立于源码仓库**的 `trusted_signers.json`，登记两个不同人员的公钥、角色和有效状态。不要把私钥交给开发者或上传 Bolt。

```bash
node scripts/sign_v2950_approval.mjs \
  --payload /secure/enterprise_evidence_v2950/source_manifest.json \
  --private-key /secure/keys/data-steward.pem \
  --role DATA_STEWARD --key-id STEWARD-KEY \
  --out /secure/enterprise_evidence_v2950/steward-source-signature.json
node scripts/attach_v2950_source_signature.mjs \
  --bundle /secure/enterprise_evidence_v2950 \
  --signed-file /secure/enterprise_evidence_v2950/steward-source-signature.json
```

5. 每个组件剩余 10 类证据必须逐项提供独立工件（每项 JSON 写明 `component_id`、`field`、`verified`、`method`、`provenance`、`recorded_at`；在 `component_evidence.json` 中登记工件相对路径和 SHA-256）。Excel 仅存在公式不等于公式正确；必须明确变量、条件、源行、网页单元格、XLSX 单元格、独立数值差异及逐步文字结论。仅当完整满足后才可制作签核载荷：

```bash
node scripts/prepare_v2950_signoff_payload.mjs \
  --bundle /secure/enterprise_evidence_v2950 \
  --trusted-signers /secure/trusted_signers.json
```

随后数据负责人、业务负责人**分别复核并签署同一载荷**。使用 `scripts/sign_v2950_approval.mjs` 两次，角色分别为 `DATA_STEWARD` 与 `BUSINESS_OWNER`，使用不同签名密钥，再调用 `scripts/assemble_v2950_business_signoffs.mjs` 整合。最后严格检查：

```bash
node scripts/check_v2950_enterprise.mjs --strict \
  --bundle /secure/enterprise_evidence_v2950 \
  --trusted-signers /secure/trusted_signers.json
```

只有所有七个关口都通过，程序才会输出正式 `PASS`；这仍需要企业本身确保公钥登记、签核身份、数据库查询证据和部署环境真实性。

## 七道阻断关口

1. 企业自行管理且**不在源码目录下**的受信任签名人公钥登记；
2. 585 个组件全部来自真实非本地 HTTPS 浏览器点击、公式和来源入口可用、下载 XLSX 含真实公式；
3. 真实 ERP/QMS 完整来源文件与独立 COUNT、主键、SHA、快照吻合；
4. 585 个组件都完成实际来源表覆盖映射；
5. DATA_STEWARD 对真实来源清单的 Ed25519 签名有效；
6. 585 × 12 类证据分别具备唯一组件 ID、字段、方法、来源、日期和文件哈希；
7. 数据负责人和业务负责人两个不同受信任密钥的最终独立签核，与本次代码登记、部署地址、浏览器结果、来源版本和逐项证据完全绑定。

## 明确不包含的工作

没有授权就不能登录真实 ERP/QMS，也不能用项目中的 `seed_simulated` 与本地文件冒充真实记录；没有正式部署地址就无法突破当前 Chromium 的管理员网络限制；软件不能替真实业务负责人签字。项目此前的 115 项 KPI 与 1,512 项执行公式 MATCH 是**模拟范围的复算结果**，不是正式企业全量验收结果。

**交付结论：V2.9.50 使第三层正式验收变成可执行、不可静默放行的证据与签核工作流；真实生产验收尚待企业环境与授权材料，当前状态仍为 BLOCKED。**
