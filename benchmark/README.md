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
