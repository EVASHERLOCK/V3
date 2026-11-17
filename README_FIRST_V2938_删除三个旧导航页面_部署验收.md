# Pharma Procurement AI V2.9.38 | 删除三个重复旧导航页面

## 变更范围

基于 V2.9.37 完整源码，仅调整主网站的左侧导航，删除下列三个重复的旧版页面入口：

- 合同与采购执行（旧路由 `#m05`）
- 发票与付款智能分析（旧路由 `#m08`）
- 采购绩效与智能分析（旧路由 `#m10`）

这三个旧路由将安全跳转至现有的新页面，避免用户从旧书签进入重复界面：

| 旧路由 | 新页面 | 新路由 |
|---|---|---|
| `#m05` | 采购执行管理 → 02 PO 创建、确认 | `#exec-02` |
| `#m08` | 采购执行管理 → 04 发票核对 | `#exec-04` |
| `#m10` | 全球药企采购绩效与经营决策中心 → 01 全局 KPI 结果总览 | `#decision-01` |

保留「采购执行管理」00–08 九个子页面、「全球药企采购绩效与经营决策中心」01–05 五个子页面、「变更控制」两个页面和其他主站页面。**没有删除旧页面相关底层业务元数据**，以免破坏历史报表引用、公式追踪及现有接口；旧页面已经无法通过正常主站路由打开。

## 源文件

- `static/app.js`：移除左侧导航三个入口，增加旧路由跳转。
- `static/index.html`：通过现有 `scripts/regenerate-inline.mjs` 从权威 JS 重新生成，修复在 Bolt 启动时被旧内嵌脚本覆盖的风险。
- `dist/index.html` / `dist/static/app.js`：包含构建后的同样修改。
- `test_v2938_legacy_navigation.mjs`：新增导航与旧路由验收。
- `test_v2934_decision_center.mjs`：旧版导航布局断言更新为新布局。

原有指标计算、后端服务、原始业务样本、Excel 公式、图表模板、业务界面内容等均未修改。

## GitHub / Bolt.new 部署

1. 解压本完整源码 ZIP，把文件（不只是 ZIP 本身）上传并覆盖到原 GitHub 仓库的对应分支。
2. 在 Bolt.new 同步此分支的最新代码并重新构建。
3. 执行：

```bash
npm install
npm run build
npm run dev
```

4. 检查左边栏不再出现上述三个旧入口，同时可打开 `#exec-00` 至 `#exec-08`、`#decision-01` 至 `#decision-05`、`#m09`、`#m09-reference`。
5. 如果需要验证旧地址，访问 `#m05`、`#m08`、`#m10`，应分别转到上述新路由。

## 验收记录

- `npm run build`：通过。
- `npm test`：通过。
- `node test_v2938_legacy_navigation.mjs`：通过。
- `node test_v2937_procurement_execution.mjs`、决策中心与变更控制相关回归测试：通过。
- `npm run check:bolt`：通过。

以上为本地源码与自动化测试结论，并不等于已在你的 Bolt.new 线上项目中验证。
