# GeoMark 评测协议（Evaluation Protocol v0.1）

> 目的：让「不同模型之间的差异」只来自模型本身，而不来自提示词、工具、环境或评分口径。
> 本协议是 Bench 0.1 的评分与实验规范，任何结果的可比性都以本协议为前提。

## 1. 题库

- 条目目录：`benchmark/items/GM-XXXX/`
  - `problem.md` 题面（Markdown + LaTeX）
  - `solution.md` 标准解、答案与评分要点（**仅评分环节可读**）
  - `meta.json` 结构化元数据：`answer / rubric / visionRubric / difficulty / coordinatePolicy / source`
  - `assets/` 配图（PNG）
- 编号一经发布不复用；修订须升编号。
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

模式指令固定在 `benchmark/tools/run-eval.mjs` 的 `MODE_INSTRUCTION` 中，一经发布不得随模型调整。

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

### 5.2 识图模式（`vision`）

按 `meta.visionRubric` 判分（图形复述要点），**不使用解题 rubric**。
若条目缺 `visionRubric`，该条目不参与识图统计（记为 `skipped: no-vision-rubric`），避免用解题标准误判复述质量。

### 5.3 约束合规与作弊判定（关键）

对 `pure` 模式（题面明令禁止建系）：

- **判为违规（总分归零，按作弊处理）**：作答或思考过程中使用了坐标法——
  建立坐标系 / 以某点为原点 / 给点赋予坐标 / 直线方程 / 斜率 / 解析式 / 两点间距离公式 / 点到直线距离公式 / 把向量写成坐标形式并做坐标运算。
- **不算违规（正常计分）**：纯几何综合法；以及**向量基底法**——设 $\vec{a},\vec{b}$ 为基向量、用线性组合表示其它向量、用 $|\vec a||\vec b|\cos\theta$ 或恒等式求数量积，**全程不给任何点赋坐标**。

判定采用**双路并取严**：确定性正则强信号扫描（含否定语境保护，如「不使用坐标法」不计入）+ LLM 合规审计，任一路指认即判违规。
记录写入 `scores/<item>__pure.score.json` 的 `constraint` 字段：`used_coordinates / method / violation / cheat / evidence / regexHits / reason`，并保留 `rawTotal`（未归零前的 rubric 原始分）以便复核。

## 6. 失败分类（Failure Taxonomy）

见 [`FAILURE-TAXONOMY.md`](./FAILURE-TAXONOMY.md)，代码 F01–F08，由 `summarize.mjs` 自动归类。

## 7. 重复运行与稳定性

同一 run 可重复执行（`--resume` 断点续跑）。`summarize.mjs --runs A,B` 输出逐题逐模式的差值表，差值 ≤10pp 记为稳定。

## 8. 报告口径

`summarize.mjs` 产出 `summary.md / .csv / .json`：逐题三模式得分、作弊列、失败类型、模式均分、违规明细。
对外引用结果时必须同时给出：模型标识、`temperature`、`max_tokens`、题库版本、judge 配置。
