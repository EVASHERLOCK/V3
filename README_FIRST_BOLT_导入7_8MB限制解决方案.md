# Pharma Procurement AI V2.9.38 · Bolt.new 新项目导入精简版

## 为什么需要此版本

Bolt.new 提示原 GitHub 仓库的文本文件合计约 14.8 MB，超出新建项目 7.8 MB 的导入上限。这是**GitHub 仓库的文件体积限制**，而非 ZIP 文件压缩率问题。

该精简版维持 package.json 版本 **2.9.38**，只整理项目交付文件：
- **移除 `dist/` 构建输出**（可以随时通过 `npm run build` 自动生成；原 `dist/static/` 与 `static/` 重复）。
- 将不参与运行的历代 README、旧版验收报告和已经生成的部分扫描报表移出导入包；保留需要参与运行和测试的源码、规范、组件扫描基线和历史 V13 验收依赖。
- **未删除** `static/` 网站页面、九个采购执行分页面、五个绩效决策分页面、变更控制页面、业务数据服务、公式生成器、65 份 Excel 公式参考表与原始图片资源。
- `dist/` 已列入 `.gitignore`。请不要把它提交到 GitHub。

## 上传 GitHub 的正确方法

**最可靠的方法是新建一个空的 GitHub 仓库**（如 `Pharma-Procurement-V2938-Bolt`），解压本 ZIP 后，将压缩包中的**文件和目录本身**上传到仓库根目录。不要把 ZIP 整包当作一个文件上传，也不要把旧的 `dist/`、历史文档或者 node_modules 合并回去。

如果必须继续使用 `EVASHERLOCK/Pharma-Procurement-V2.9.38` 原仓库，必须删除旧仓库中仍保留的 `dist/` 和被本包排除的历史文本文件，并提交删除记录，再提交本包的全部文件。**仅仅覆盖同名文件，旧文件依然存在，可能继续超限。**

不论是使用 GitHub Web 上传还是 git push，上传前应确认仓库根目录有 `package.json`、`server.mjs`、`static/`、`scripts/`，**且没有 `dist/`**。

## Bolt.new 启动步骤

1. 在 Bolt.new 新建项目，选择 **Import from GitHub**，导入这个新的精简仓库。
2. 终端执行 `npm install` 和 `npm run dev`。`npm run dev` 会自动生成 `dist/`，这是正常的，不要把生成结果提交回 GitHub。
3. 检查：
   - 采购执行管理 00–08：`#exec-00` 至 `#exec-08`；
   - 全球药企采购绩效与经营决策中心 01–05：`#decision-01` 至 `#decision-05`；
   - Change Control 全流程参考：`#m09-reference`；
   - 已移除旧入口 `#m05`、`#m08`、`#m10` 的兼容跳转。

## 体积与验收

按照常见文本扩展名 `.html/.css/.js/.mjs/.json/.md/.csv/.txt/.py` 等统计，**本 ZIP 中的文本内容约 7.2 MB（十进制）**，低于报错中的 7.8 MB。但 Bolt.new 最终怎样分类文件以它的实际导入结果为准。

精简后已验证 `npm run build`、`npm test`、V2.9.37 九页业务专项测试、V2.9.36 五页主题专项测试、V2.9.38 导航专项测试通过。未在用户的 Bolt.new 账号实际执行 GitHub 导入。

## 注意：不等于新增真实企业数据

本次仅修复导入尺寸，保留原先 DEMO 数据、缺口标记和现有页面功能，不新增或伪造企业合同/发票/付款/索赔数据。
