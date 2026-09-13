# GeoMark 评测方法论（Benchmark Methodology）

> 本文档说明 GeoMark Benchmark 的评测设计原则、三模式定义与可复现性保证。
> 题库结构与条目规范见 [benchmark/README.md](../benchmark/README.md)。

## 1. 设计原则

1. **模型无关（Model-Agnostic）**：题面、提示词、评分细则对一切模型完全一致；Harness 不注入任何模型专属提示词、工具或隐藏指令。
2. **输入可证**：每份实验包记录"模型实际看到的渲染后输入"与"适配器实际发送的 HTTP 请求"（密钥脱敏），输入差异可逐字节审计。
3. **防作弊**：模型只接触题面的 PNG 渲染图与文本，结构上无法接触 SVG 源码与评分文件。
4. **评分可追溯**：LLM judge 按公布的最小评分单元（rubric line）逐项打分，每项得分附理由，人工可复核、可改判。

## 2. 三种评测模式

| 模式 | 输入 | 考察目标 |
|---|---|---|
| 纯识图 vision | 仅题目配图（PNG） | 图形理解与转述能力 |
| 可建系 coord | 题面 + 配图，允许建立坐标系 | 解析化求解能力 |
| 不可建系 pure | 题面 + 配图，禁止坐标系 | 纯几何综合推理能力 |

三种模式的提示词模板固定于 `benchmark/tools/run-eval.mjs`，修改即视为新版本（promptHash 会变化，结果不可与旧版混比）。

## 3. 评分模型

- 每题在 `meta.json` 的 `rubric` 中定义最小得分单元与分值（总分 12 分）。
- judge 模型收到：评分细则 + 参考解析 + 考生作答，输出逐项 `score/comment` 的严格 JSON。
- 题目得分归一化为百分比参与跨题、跨模型对比；建议同时报告 judge 身份（同 judge 自比才公平）。

## 4. 可复现性保证

```text
相同 promptHash + 相同 rubric + 相同 judge 配置 + temperature 固定 ⇒ 结果可复现
```

- 每次请求记录 promptHash（SHA-256 前 16 位）、temperature、时间戳于 `run-manifest.json` 与逐请求 `*.meta.json`。
- `results/` 目录不入库（数据留本机）；对外发布时提交 `summary.md/csv/json` 与运行清单。
- LLM 采样具有固有随机性：跨模型对比请使用相同 temperature 并报告多次运行统计。

## 5. 与 Harness 的关系

Benchmark 通过 Harness 发起的一切实验都自动获得完整审计能力（哈希链实验包、脱敏请求留痕、完成态语义）。推荐做法：把 `run-eval` 指向 Harness 的 `config/`（模型与密钥复用），使评测运行与日常实验共享同一套可审计记录。
