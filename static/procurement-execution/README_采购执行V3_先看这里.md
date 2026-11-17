# 药企采购执行 V3 · 九页面详细业务改版

## 如何打开

1. 解压完整 ZIP，保持 `assets`、`workbooks`、`templates` 与 `.html` 文件的相对目录结构。
2. 用现代浏览器打开 `index.html`（默认 RFQ），或直接打开 `00_询价与报价比对.html`。
3. 使用顶部的九个横向导航；**左侧深蓝竖栏 / PROCURE TO PAY 竖排栏已从网页删除**。
4. 所有页面 **01 为 KPI，02 为七步异常流程（附异常数量、风险及责任台账）**；重做的前七个业务页面（含 RFQ）额外有 **03 业务操作/核查清单/比对工作台**。
5. 在各模块顶部点击“∑ 计算血缘 / 分析规则”、右上角“?”或底部“展开全量计算依据和来源表”；Excel 文件在对应 `workbooks` 目录。

## 页面位置与改版范围

- `00_询价与报价比对.html` —— **询价优先第一**：三类完整 RFQ、Word 下载模板、询价正文、供应商报价要素、总成本试算、同 RFQ 横向比价、历史价口径、Word 版本差异、字段提取复核、供应商发布邮件草稿/内部抄送。
- `01_合同核查.html` —— NDA、框架、供货、QAA、服务、物流等合同类别；双方名称/地址/签署权限/日期/邮箱、价格/分期付款/账期、清关及保险、违约责任与规格附件；Word 文字识别、勾选、版本差异。
- `02_PO创建与比对.html` —— PR→SAP PO→供应商确认，SAP 抬头/行项目/采购组织/工厂/库存地点/价格/计划行、供应商邮件草稿、签署责任与 Planning/AP 通知。**SAP 生成计划收货 ≠ 实际质量放行库存**。
- `03_发运与到货.html` —— FCA/CIF/CIP/DAP/DDP 责任解释、清关代理、目的地本地配送、仓库 GR/QMS 只读关联、ETA/短装/温偏异常。
- `04_发票核对.html` —— 发票全字段清单、PO/GR/适用验收三/四单匹配、重复票/税费、上传 Word、新旧版本逐段差异及人工复核。
- `05_付款与应付.html` —— 合同/PO/Invoice 联动、定金/尾款余额计算、到期预警、供应商银行资料独立验证、AP 授权及汇款跟踪。
- `06_退货与索赔.html` —— 拒收/短装/温偏等原因、QMS 证据、RMA/补货/贷项/退款、责任与金额回收、CAPA 跟踪。
- `07_订单关闭与绩效.html` —— 保留前版业务功能，七步异常区域统一移为 02。
- `08_异常处理中心.html` —— 保留前版跨模块异常管理，七步流程统一移为 02。

## 文件识别、差异比对与实际边界

- 已有：浏览器内 `.docx` **正文段落**读取（取决于浏览器支持 ZIP/DecompressionStream）、TXT、CSV、JSON、基础 EDI 文本接收；逐行关键词候选提取、字段勾选、人工修改/确认、来源行定位；导入“上一版”和“新版”可看新增/删除段落；每页均有不同的 DEMO 版本差异案例。
- 尚需系统接口：PDF 页面真实文本解析、扫描件 OCR、复杂 Excel 表结构抽取、Word 表格样式/原生修订红线、合同/银行/发票语义校验、正式系统权限/身份、外部邮件发送、电子签署与审计、SAP PO 建立、WMS GR、QMS QA 结论、财务付款及银行回单。这些功能**没有冒充已真实执行**。
- RFQ 的“到岸总成本”是可编辑**示例模型**，不能对所有贸易术语重复加运费或关税；必须依据具体 Incoterms、named place 与费用明细判定由谁承担。
- 模板/案例/台账均使用 DEMO 数据；不得直接用于药品质量批准、监管实施决策或支付授权。

## Excel 数据血缘与公式

原版 54 个小模块 `xlsx` 仍在；新增 7 个 `XX_business.xlsx`，共 61 份。新工作簿有：原始记录、逐行计算、汇总与计算公式、变量字典与清单、分析规则与流程、来源与边界，共六个工作表。公式以真正 Excel 单元格公式存储，并经程序检查。

## 下载的三种 RFQ Word 模板

`templates/RFQ_01_NewSupplier.docx`、`RFQ_02_AnnualRequote.docx`、`RFQ_03_SecondSource.docx`，页面中的 RFQ 类型下拉框切换时 Word 下载按钮同步更新。

## 相关公开产品文档

- SAP Learning 创建 PO： https://learning.sap.com/courses/business-processes-in-sap-s-4hana-sourcing-procurement/creating-a-purchase-order
- SAP Learning PO 字段与条款： https://learning.sap.com/courses/executing-basic-erp-processes-with-sap-s-4hana/executing-purchase-order-management
- SAP Learning 确认/发运/计划关联： https://learning.sap.com/courses/purchasing-in-sap-s-4hana/monitoring-purchase-orders
- ICC Incoterms® 2020： https://library.iccwbo.org/clp/clp-incoterms-qa-2020.htm
- 美国 21 CFR 211.84： https://www.law.cornell.edu/cfr/text/21/211.84

> 注：SAP 字段与具体屏幕依公司所用 SAP ERP/ECC/S/4HANA 版本、定制和业务流程配置而异，界面只提供字段映射参考，不声称具有真实 SAP 接口。
