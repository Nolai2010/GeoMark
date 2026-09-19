# GeoMark 能力落地审计报告（2026-09-19）

> 审计来源：4 个并行子代理对 README 宣称逐条核对 + 本人对关键指控的独立复核。
> 对象：HEAD `f514c05`（main）。本文件在修复**之前**写就，并随修复更新状态列。
> 所有路径相对仓库根。

## 状态图例

- ✅ 核验属实，已修复
- 🟡 核验属实，部分修复（遗留项见下）
- ⚪ 核验后判定**不成立**（审计有误）
- ⬜ 属实，待办（多为需要真实运行的项）

---

## 一、最严重的方法学问题（P0-1）✅ 已修复

**「禁止坐标法」的题，官方评分细则自己在用坐标法。**

8 道 `coordinatePolicy: restricted` 题里，6 道的 `answerKey`/`rubric` 用坐标法表述：

| 条目 | 原文位置 | 原文示例 |
|---|---|---|
| GM-0101 | `meta.json.answerKey[4]` | 「建系（$O$ 为原点，半径 2，$P(-2,4)$）求 $E=DP\cap OC$」 |
| GM-0103 | `meta.json.answerKey[4]` | 「可用坐标复核：$A(4,0),B(0,2)\dots$」 |
| GM-0106 | `meta.json.answerKey[2]` + `rubric[]` | 「由坐标 $A(0,0),B(6,0),C(6,8),D(0,8)$ 求得 $I(4,6)$」 |
| GM-0107 | `meta.json.rubric[2]` | 「用坐标或几何方法把 $EF+CF$ 化为单变量函数」 |
| GM-0108 | `meta.json.rubric[1][2]` | 「建立坐标或向量表示 $P,Q,R$」「用对角线或坐标导出四边形面积」 |

双向污染：合规作答被细则压分（judge 看不到坐标结果就扣分）；被抓作弊的 `rawTotal` 含违禁增益。
**RESULTS.md 里「可建系 69% vs 不可建系 55%，掉 14pp」的头号结论因此失效。**

修复：
1. 7 处细则/要点改写为「几何量 + 判定依据」表述（脚本化精确替换，JSON 规范格式不变）
2. `score.mjs` 的 `JUDGE_SYSTEM` 增加方法中立性硬规则：不得因作答未用坐标系扣分、不得要求
   参考路线、细则中的表达式应理解为「几何对象已被确定」
3. 5 份含坐标路线的 `solution.md` 头部加中立性说明
4. 复核脚本确认 8 道 restricted 题细则零路线指定
5. `dataset.json` 重算：`f73bdf36559c6e29` → `ef96d46a73656802`
6. RESULTS.md 顶部的 14pp 结论**降级为初步观察**并标注不可比

---

## 二、README 宣称核对（P0-2）✅ 已修复

| # | 审计指控 | 复核 | 处置 |
|---|---|---|---|
| 1 | `Dataset Structure` 整段虚构（`problem.txt`/`diagram_clean.png`/`metadata.json`/snake_case） | ✅ 属实（原 294–316 行） | 已换成真实 `GM-0101` 树 + 真实 camelCase `meta.json` 片段，并点名「旧版是虚构的」 |
| 2 | 217 行「All three are implemented」把启动器说成评测轨道 | ✅ 属实 | 已改为能力矩阵：Real-World/Agent 是 **provisioning**（无作答回收、无判分、无记录），只有 Controlled 出分 |
| 3 | 五类别与元数据不符（无 `allowed`、无 solid_geometry、识图非类别） | ✅ 属实（`coordinatePolicy` 仅 restricted/null 两种） | 已改为「3 模式 × 18 题」真实矩阵 + 逐字段说明 |
| 4 | Agent Track 分类缺 4 个 `kind:web`（12+17+2=31 ≠ 35） | ✅ 属实 | 已补「Web / plugin only (4)」并写明 12+17+2+4=35 |
| 5 | 能力清单三处不精确：TTFT / effort-budget 不对称 / termination 两层 | ✅ 属实（`pipeline.mjs:39,105`；两份 spec 各缺一字段） | 已逐条标注，并把三处精确化写成显式 note |
| 6 | 「header exposes a single Start Test entry」措辞过强 | ✅ 属实（另有教程/密钥按钮） | 已改为「单一个*测试*入口；其余按钮是教程与密钥」 |
| 7 | 无 Quick Start / Results / Installation，文档从不指向 GETTING-STARTED 与 RESULTS.md | ✅ 属实 | 已补 `## Quick Start`（Node ≥22、三条命令、密钥指引）与 `## Results`（真实分数表 + 三条 caveat） |
| 8 | `Repository Structure` 列了不存在的 `benchmark/evaluation/`，漏 `benchmark/items/` | ✅ 属实 | 已重写为真实结构，并说明 clone 后拿不到什么 |
| 9 | 无 4-backtick 代码块笔误 | ✅ 属实（原 147 行 ``````） | 已修 |

---

## 三、安全边界复核（P0-3）🟡 部分成立，已加固

**审计判定「远程 HTTP 请求方无法任意命令执行」——复核属实**，四条依据全部验证：

- allowlist：`server.mjs` 只按 config 的 agent targets 精确匹配 id，未命中 400 ✅
- 路径来自配置而非请求体 ✅
- 启动前复检存在性 ✅
- `GM_LAUNCH_DRY_RUN` 三处短路 ✅；spawn 均无 `shell:true`，app/msix 走 argv 数组 ✅

**但两处指控需要修正精度：**

1. 「CSRF 可让用户访问恶意网页就自动拉起本机应用」——**被高估了**。跨站表单 POST 的正文是
   `id=zcode`（urlencoded），`JSON.parse` 失败后 payload 为空 → 400 unknown id；`text/plain`
   编码强制尾随 `=` 同样解析失败；而带 `application/json` 的跨站 fetch 会触发预检被 CORS 拦截。
   因此实际可利用面接近于零。**但**这层防线是「偶然正确」而非「有意设防」，已按审计建议显式加固：
   - 全局 `Sec-Fetch-Site: cross-site` → 403（堵住「缺 Origin 即放行」这一类）
   - `/api/tracks/launch-agent` 强制 `content-type: application/json`（否则 415）
   - 新增 `tests/request-guards.test.mjs`（3 项、启动真实 server）锁定以上行为
2. 「可写 tracks.json 者即获 cmd 级执行」——**属实且是真实边界**。CLI 启动走
   `cmd /c start '' cmd /k <bin>`，cmd.exe 会重新解析整条命令行。已加固：
   - 服务端 `launchCli` 拒绝 `SAFE_BIN` 之外的 bin；`openUrl` 拒绝非 http/https 或含元字符的 url
   - `tracks-config.test.mjs` 新增 bin/url/exe 字符集断言
   - README 安全段改写为「把配置文件当可执行内容，不当数据」

未验证的遗留：审计提到的 `AGENTS.md:38 multipart 路径有误` 不成立——**仓库里根本没有 AGENTS.md**，
`multipart.mjs` 只在代码与测试中被正确引用（`harness/surfaces/web/multipart.mjs`）。

---

## 四、数字级不一致（P1）✅ 已修复

| 位置 | 原值 | 现值 |
|---|---|---|
| GETTING-STARTED ×3 | 测试 103/103 | 114/114（最终实测；修复中途为 110） |
| GETTING-STARTED.{zh,en} | Node ≥18（推荐 22） | ≥22（engines 强制，18 会 EBADENGINE） |
| GETTING-STARTED.{zh,en} | 题库 10 题（平面 5 + 立体 5） | 18 题（8 plane_geometry + 10 geometry 含 5 道立体） |
| README.zh.md「下一阶段」8 项全空 | 与 en 矛盾 | 已对齐（含 `[~]` 部分交付图例与原因） |
| FAILURE-TAXONOMY | F01–F08 平铺，未区分可达性 | 已标注：仅 F01/F04/F05/F06/F07 自动可达，F02/F03/F08 为保留标签，计数 0 = 未实现而非未发生 |
| EVALUATION-PROTOCOL | 「题目均来自公开免费真题」「经独立复核」 | 已改为如实表述：8 道真题 + 10 道自编（source null）；复核为作者本人；judge 身份必须披露 |
| EXTERNAL-DATASETS | 「已拿 2186 题 / 116MB」 | 已改为「已本地导入、条目不入库、用 import-*.mjs 重建」 |

---

## 五、P1 待办（需要真实运行，不是改文档能解决的）⬜

1. **跨模型对比数据为零**：README 主打「Same task. Same conditions. Different models.」，但没有
   第二个模型的任何运行。建议一强一弱两模型 × 18 题 × 3 模式，把 summary 提交进 results/，
   README 第一屏放表。
2. **重复运行稳定性从未执行**：`summarize.mjs --runs A,B` 代码在，产物从未产出。
3. **judge = 被测模型**：应换独立 judge 或双裁判报告一致性；`run-manifest.json` 应记录 judge 的
   服务版本/日期。
4. **无 CI、无 lockfile**：加一个跑 `node --test` 的 workflow 是投入产出比最高的一项。
5. **数据污染控制未落地**：8 道真题全是 2025/2026 卷，没有字段区分「模型大概率见过/没见过」；
   中考真题的汇编版权地位全仓无声明（建议 NOTICE）。
6. **本机指纹已入库**：`AGENT-INVENTORY.md` 与 `tracks.json` 含绝对安装路径，属机器绑定数据；
   正确形态是「示例输出 + 生成方法」，用户侧用 `HARNESS_CONFIG_DIR` 覆盖。

---

## 六、值得保留的正面结论

- Harness 层 20 项宣称 17 项完全兑现，token usage 取 provider 真值而非本地估算，缺值记 null
- 中立性写成了可执行测试（`neutrality.test.mjs` 静态扫描禁品牌名 + 跨协议逐字节一致）
- 实验包做到哈希链可审计（改一字节即失败），密钥走 REDACTED + 递归 scrub
- `secrets.json` **从未进入过 git 历史**（`git log --all -- harness/config/secrets.json` 为空），
  索引里只有 `secrets.example.json` —— 但密钥在本机明文存在过，仍应轮换
- 反作弊双路检测（正则否定语境保护 + LLM 审计 + ≥2 命中强制翻转）实现与文案逐字相符
