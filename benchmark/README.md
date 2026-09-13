# GeoMark Benchmark

> 与 `harness/` 配套的标准化题目集：同一题库，同一条件，跨模型公平评测。

## 目录结构

```text
benchmark/
├── README.md            本说明
└── items/
    └── GM-XXXX/
        ├── problem.md   题面（含作答要求）
        ├── solution.md  正解、解析、评分要点
        └── meta.json    结构化元数据（答案、知识范围、难度、标签）
```

## 条目规范

- **编号**：`GM-XXXX`，四位递增，一经发布不复用。
- **`meta.json`**：`id / title / subject / knowledgeScope / questionType / options / answer / answerKey（评分要点）/ difficulty / tags` 为必填字段。
- **题面**：Markdown + LaTeX（`$…$` 行内、`$$…$$` 块级），与 Harness 的渲染管线一致；单选题须列出全部选项。
- **作答要求**：题面末尾统一注明输出格式（如"直接给出选项字母，并给出完整推理过程"），保证跨模型输入一致。
- **评分要点**：`solution.md` 必须写明可判分的步骤要点与部分分规则；纯记忆性答案不给满分。
- **中立性**：题面不得包含针对特定模型的提示、示例或引导；题目内容一经发布不再修改（修订须升编号）。

## 现有条目

| 编号 | 知识范围 | 类型 | 答案 | 难度 |
|---|---|---|---|---|
| GM-0001 | 人教A版必修二 · 平面向量 | 单选（三角形五心） | B | medium |
| GM-0002 | 人教A版必修二 · 平面向量 | 证明（三点共线） | BF = (3/5)BE | medium |
| GM-0003 | 人教A版必修二 · 平面向量 | 解答（求取值范围） | μ ∈ [2/3, 5/6] | medium |
| GM-0004 | 人教A版必修二 · 平面向量（综合） | 解答（黄金矩形折叠，3 问） | BP = √5−1，是黄金矩形 | hard |
| GM-0005 | 几何综合（相似与圆） | 解答（作图+证明+最值，3 问） | CB_max = 2√2 | hard |

## 评测流水线（benchmark/tools/）

```text
SVG（评分参照，保留）                    solution.md（评分细则）
   │ svg2png.mjs 批量转 PNG                 │
   ▼                                       ▼
PNG ──► run-eval.mjs（三模式作答）──► score.mjs（LLM 逐项对照细则打分）──► summarize.mjs（对比表）
        纯识图 / 可建系 / 不可建系          结果：results/<runid>/scores/       summary.md .csv .json
```

隔离保证：`run-eval.mjs` 作答阶段**只读取 problem.md + meta.json + PNG**，代码中不存在读取 solution.md 的路径（dry-run 泄漏扫描为 0）。

```bash
# 1) SVG → PNG（Edge 无头渲染；--force 强制重转）
node benchmark/tools/svg2png.mjs

# 2) 三模式作答（模型配置复用 Harness 的 config/models.json + secrets.json）
node benchmark/tools/run-eval.mjs --model deepseek-flash --out benchmark/results/run1
#    可选：--items GM-0006,GM-0007 --modes coord,pure --temperature 0 --dry-run

# 3) 评分（judge 默认与被评模型同 provider，可 --judge-model 指定）
node benchmark/tools/score.mjs --run benchmark/results/run1 --judge-model deepseek-flash

# 4) 汇总对比表
node benchmark/tools/summarize.mjs --run benchmark/results/run1
```

- 三模式提示词模板固定于 `run-eval.mjs`（可复现）；每次请求记录 promptHash（SHA-256 前 16 位）、temperature、时间戳，写入 `run-manifest.json`。
- `results/` 已 gitignore；科研复现 = 相同 promptHash + 相同 rubric + 相同 judge 配置。
- 冒烟：`GM_ALLOW_MOCK_JUDGE=1` 环境变量允许确定性折半评分（仅流水线验证用，记录会标注 mock-fallback）。
