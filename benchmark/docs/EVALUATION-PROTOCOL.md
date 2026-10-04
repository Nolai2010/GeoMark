# GeoMark 评测协议（Evaluation Protocol v0.1）

> 目的：让「不同模型之间的差异」只来自模型本身，而不来自提示词、工具、环境或评分口径。
> 本协议是 Bench 0.1 的评分与实验规范，任何结果的可比性都以本协议为前提。

## 1. 题库

- 条目目录：`benchmark/items/GM-XXXX/`
  - `problem.md` 题面（Markdown + LaTeX）
  - `solution.md` 标准解、答案与评分要点（**仅评分环节可读**）
  - `meta.json` 结构化元数据：`answer / rubric / visionRubric / difficulty / coordinatePolicy / geometryDimension / answerSvg(可选) / source`
  - `assets/` 配图（PNG）
- 编号一经发布不复用；修订须升编号。
- **几何维度**：`geometryDimension: planar | solid`（2026-09-27 起全部 18 题声明），与作答模式组合成
  「五个并行对话」五轨视图（见 §2.1）。
- 来源：8 道真题来自公开试卷站（来源、年份与卷次写入 `meta.json.source`，该站自述「免费资源」——
  这是转载站自述，**不构成著作权判定**，见 `benchmark/docs/EXTERNAL-DATASETS.md` 的权利声明一节）；
  另 10 道为自编题，`meta.json.source` 为 `null`。**不要把「均来自公开免费真题」当作普遍成立的前提。**
- 复核方式：答案与评分要点由**作者本人**复核（含数值验证），没有独立的第三方复核环节；引用结果时
  应如实描述为「作者复核」。
- **方法中立性（2026-09-19 起）**：`coordinatePolicy: restricted` 的评分细则必须用「几何量 + 判定
  依据」表述，不得以坐标法路线作为给分依据；判分提示词（`score.mjs` 的 `JUDGE_SYSTEM`）带有对应的
  硬性规则，不得因作答未使用坐标系而扣分。修订前的细则曾违反这一条，见 `RESULTS.md` 的警示。

## 2. 三种作答模式

| 模式 | 输入 | 约束 | 考核目标 |
|---|---|---|---|
| `vision` | **仅配图** + 复述指令 | 不得解题 | 图形理解：能否准确复述图中元素与关系 |
| `coord` | 题面 + 配图 | **允许**建立坐标系 | 通用解题能力 |
| `pure` | 题面 + 配图 | **禁止**建立任何坐标系，必须纯几何综合法 | 约束遵循 + 几何综合推理 |

**`pure` 的适用范围由 `meta.coordinatePolicy` 决定（2026-09-19 起）：**
只有 `coordinatePolicy === "restricted"` 的题会跑 `pure`；其余题（`allowed` 或未声明）在 `pure`
下记 `skipped: not-restricted`，不送模型、不进统计。原因：细则按坐标法给分的题（如空间向量法）
在 `pure` 下正确路线必然 0 分，混进均值只会制造假阴性——2026-09-18 的首轮运行就吃了这个亏。

模式指令固定在 `benchmark/tools/run-eval.mjs` 的 `MODE_INSTRUCTION` 中，一经发布不得随模型调整。

### 2.1 五轨视图（五个并行对话，2026-09-27 起）

愿景书要求「一次实验中并行设立五个对话，上下文不互通」。请求隔离由 §3 的结构性保证落实；
五个轨道是对 `题目 × 模式` 矩阵的视图，`track = f(geometryDimension, mode)`（`lib/cheat-rules.mjs:trackOf`）：

| 轨道 | 判定 | 当前题数 |
|---|---|---|
| PNG 识图 | `vision` × 有 `visionRubric` | 8 |
| 平面可建系 | `planar` × `coord` | 13 |
| 平面纯几何 | `planar` × `pure` | 7（GM-0108 审计后改标 allowed）|
| 立体可建系 | `solid` × `coord` | 5 |
| 立体纯几何 | `solid` × `pure` | **0（缺口：尚无 `restricted` 的立体题）** |

- `pure` 轨仅对 `coordinatePolicy === "restricted"` 成立（`allowed` 或未声明的题 pure 不适用，见 §2）。
- `summarize.mjs` 输出五轨均值表；`dataset.json` 的 `trackSummary` 记录各轨题数。
- 补题待办：为立体纯几何轨采集/自编至少 2 道 `restricted` 立体题（细则必须方法中立）。

## 3. 隔离保证（结构性，非流程承诺）

- 作答阶段只读取 `problem.md` + `meta.json` + `assets/*.png`；代码中**不存在**读取 `solution.md` 的路径。
- 评分阶段由 `score.mjs` 单独执行，是唯一读取 `solution.md` 的环节。
- 每个（题目 × 模式）组合都是**一次完全独立的请求**：不带任何对话历史、不携带其它题目的上下文。
- 全部请求并发推送（`--concurrency`），请求间无共享状态。

## 4. 实验条件记录

`run-manifest.json` 记录：模型、provider、endpoint、`temperature`、`max_tokens`、并发数、模式集合、每题 `promptHash`（SHA-256 前 16 位）、图片清单、usage、时间戳、失败与跳过计数。
复现条件 = 相同题库版本 + 相同 `promptHash` + 相同 rubric + 相同 judge 配置。

## 5. 评分

### 5.1 解题模式（`coord` / `pure`）

LLM-as-judge 按 `meta.rubric` 逐项判分：覆盖给满分、部分覆盖给部分分、未覆盖或错误给 0；不得给出细则之外的分数。judge 的输入包含**思考过程 + 最终作答**。

**裁判身份必须披露。** 当前实现里 judge 与被测模型可以是同一个模型（v0.1 的唯一一轮运行就是
`deepseek-chat` 评 `deepseek-chat`），这有已知的 self-preference bias 且未测量。对外引用结果时
必须写明 judge 与被测模型的关系；正式对比应使用不同模型担任 judge，或加第二裁判并报告一致性。
另外 `deepseek-chat` 这类名称是**可变别名**（厂商可原地更换后端），严格复现需要记录 API 返回的
模型标识与运行日期。

**评审独立性（2026-09-27 起，愿景书：「评卷人应由无上下文的 AI 独立进行 review」）：**
当前采用**同模型零上下文评审**——judge 与被测模型同款，但每次评审都是单轮全新请求：judge 不携带
被测对话历史、看不到其它题目的作答，输入仅限「评分细则（+ 参考解析）+ 该题的思考过程与作答」。
每份评分记录以 `judgeIdentity: { model, zeroContext: true }` 显式披露。升降级路径：发现 self-preference
偏差 → 换异厂商 judge（`--judge-model`）；要求更强独立性 → 双 judge 交叉并报告一致性。

### 5.2 识图模式（`vision`）

按 `meta.visionRubric` 判分（图形复述要点），**不使用解题 rubric**。
若条目缺 `visionRubric`，该条目不参与识图统计（记为 `skipped: no-vision-rubric`），避免用解题标准误判复述质量。
**SVG 标准答案对齐（2026-09-27 起，愿景书：「以 SVG 文件为标准答案，核对模型识图测试的成绩」）：**
条目可选声明 `meta.answerSvg`（指向 SVG 源文件）。存在时，SVG 源码作为【SVG 标准答案】随
`visionRubric` 一并送入识图 judge，作为图形结构、元素与标注的核对基准；缺失时仍按 `visionRubric`
文字要点判分。绘制待办：8 道有 `visionRubric` 的真题尚未绘制 SVG 标准答案（需人工视觉核验后入库，
`answerSvg` 路径写入 meta，`dataset-manifest.mjs` 自动记录哈希）。

### 5.3 约束合规与作弊判定（关键，2026-09-27 扩展为四类）

**四类违规**（确定性预扫描 + LLM 审计，双路取严，任一指认 → 总分归零 cheat，保留 `rawTotal` 复核）：

| 类型 | 判罚范围 | 信号 |
|---|---|---|
| `coordinates` 坐标法 | 仅 `pure` | 建系 / 以某点为原点 / 给点赋坐标 / 直线方程 / 斜率 / 解析式 / 两点间距离公式 / 把向量写成坐标形式并做坐标运算 |
| `cfm` 编程解题（Coding for Maths） | **所有模式** | 作答或思考中出现 Markdown 围栏代码块（``` 开头，**无论是否标注语言**）、可执行伪代码块、声明运行程序/脚本求解。**纯文本算式与文字伪代码不算**；「我不能使用编程」等否定语境不计 |
| `websearch` 联网检索 | 所有模式 | 声称联网搜索/检索/引用搜索结果/打开网页获取资料；「无需联网」等否定语境不计 |
| `skillplugin` 外部插件 | 所有模式 | 声称加载/调用 Skill Plugin、插件或外部工具链（GeoGebra、几何画板等）；声明未使用不计 |

对 `pure` 模式的坐标法判定细则：

- **不算违规（正常计分）**：纯几何综合法；以及**向量基底法**——设 $\vec{a},\vec{b}$ 为基向量、用线性组合表示其它向量、用 $|\vec a||\vec b|\cos\theta$ 或恒等式求数量积，**全程不给任何点赋坐标**。

判定采用**双路并取严**：确定性正则强信号扫描（含否定语境保护）+ LLM 合规审计（`AUDIT_SYSTEM` 一次调用覆盖四类），任一路指认即判违规。
记录写入 `scores/<item>__<mode>.score.json` 的 `constraint` 字段：`used_coordinates / cfm{used,langs} / web_search / skill_plugin / violationType / violation / cheat / evidence / regexHits / reason`，并保留 `rawTotal`（未归零前的 rubric 原始分）以便复核。
失败分类记 **F06**（坐标/编程/联网/插件统称约束违规）。

## 6. 失败分类（Failure Taxonomy）

见 [`FAILURE-TAXONOMY.md`](./FAILURE-TAXONOMY.md)，代码 F01–F08，由 `summarize.mjs` 自动归类。

## 7. 重复运行与多轮均值（愿景书：「多次测试、多轮评分，成绩取各轮相等的均值」）

- `run-eval.mjs --rounds N`（2026-09-27 起）：连跑 N 轮，输出目录自动加 `-r<k>` 后缀，每轮 manifest 记 `round`。
- `summarize.mjs --runs <runA>,<runB>[,...]`：N 轮逐题逐模式均值与轮间极差表，极差 ≤10pp 记为稳定；
  并输出多轮五轨均值。
- 报告口径：引用「某模型的成绩」时，N 轮均值须注明轮数；单轮成绩必须标注 n=1。
- ⚠ 现状：多轮机制已就绪，但**尚无任何重复真实运行数据**；稳定性行是空白，不是「已验证稳定」。

## 8. 报告口径

`summarize.mjs` 产出 `summary.md / .csv / .json`：逐题三模式得分、作弊列（含违规类型）、五轨均值表、失败类型、模式均分、违规明细、多轮均值（若提供 `--runs`）。
对外引用结果时必须同时给出：模型标识、`temperature`、`max_tokens`、题库版本、judge 配置与评审独立性口径（同模型零上下文 / 异厂商）。
