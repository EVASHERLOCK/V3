# V2.9.12 官方数据、人工审查和 ERP 数据集成架构

## 真实已实现的机制

- 来源：FDA 药品短缺 `https://api.fda.gov/drug/drugshortages.json`（上游每日更新）及 FDA 药品召回 `https://api.fda.gov/drug/enforcement.json`（上游每周更新），由 `sourcing_registry.mjs` 去重、时间戳、来源 URL、源记录散列、变化追踪、失败日志。
- 调度：长驻 Node 服务设置 `SOURCING_AUTO_SYNC=1` 后启动检查+24小时轮询；或 GitHub Actions 每日定时运行并将数据写入 `data/official_signal_registry.json`。**GitHub 自动任务需实际部署并开通 Actions 写入权限；静态网页自己不会定时运行。**
- 核实：进入人工证据复核队列；`ACCEPT_EVIDENCE` 必须填写 supplier_id + site_id + material_id，但**不能自动获得 GMP、CEP、ASL 或采购批准**。官方召回/短缺记录不能直接证明某企业所供 API 的风险等级。
- ERP：`GENERIC` 和 `SAP_S4HANA` 示例映射，统一解析 supplier_id、legal_entity_id、site_id、material_id、单价、币种、单位、交期、有效期；仅进入 `STAGED_UNREVIEWED`，后续需组织自己的主数据映射、字段校验、QA 审核和审批工作流。
- 安全：写入与私有查询接口要求 `SOURCING_ADMIN_TOKEN` 环境变量，并从 `Authorization: Bearer ...` 传入。**未配置 token 则所有写入接口禁止使用**。勿将真实 ERP token/敏感报价放到静态 GitHub 公共仓库；需受控服务端和访问控制。

## API（仅 Node 服务，静态 Bolt 预览不会提供持久化服务端）

- `GET /api/sourcing/registry/schema`：公开只读的官方来源和 ERP 字段映射说明
- `GET /api/sourcing/registry`：授权后返回 Top10、其余数量及最新同步状态
- `GET /api/sourcing/registry/all`：授权后返回全部记录、数据来源、审核状态、历史变更
- `POST /api/sourcing/registry/sync`：授权后手动拉取（POST `{ "force": true }`）
- `POST /api/sourcing/registry/review`：授权后对线索进行人工复核
- `POST /api/sourcing/registry/erp`：授权后导入 `{ "adapter":"GENERIC", "rows":[...] }`，仅暂存

## 未完成 / 需要企业配合

- EDQM CEP、EMA、NMPA 没有在本次代码中假设出未经证实的公开标准 API；当前为官方参考/人工核验入口，商业授权或合规接口取得之后再接入。
- 未建立 SAP OAuth/通信认证，也未连接企业生产系统；ERP 映射器可运行但真实同步取决于用户企业提供的接口权限、环境与业务数据。
- 目前浏览器演示环境和真实服务端的用户身份未统一；真实上线必须完成企业 IAM、加密存储、审计保留策略、GxP 计算机化系统验证。
