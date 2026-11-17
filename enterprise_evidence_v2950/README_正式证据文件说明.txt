该目录初始文件全部为待核验；任何条目都不能仅因为按钮可点击而标记正式 PASS。
browser_report.json：运行 scripts/browser_v2950_live.py --scope all 在获授权的 HTTPS 企业部署环境采集；本地/离线报告不算正式证据。
source_manifest.json：真实 ERP/QMS 完整导出 + 独立 COUNT 查询 + 同快照、主键和文件 SHA256；需要被登记数据负责人的 Ed25519 签名。
component_evidence.json：585 条每项 12 个证据，字段必须含 verified=true, path, sha256；文件内容须有 component_id, field, verified=true, method, provenance, recorded_at。
business_signoffs.json：至少数据负责人和业务负责人两个不同受信任签名，签核内容绑定 browser/source/component 的哈希。
不要把真实 ERP/QMS 数据、授权 Cookie、签名私钥、未脱敏截图或个人身份信息提交 GitHub / Bolt。
