# GeoMark

> 一个模型无关的 AI 推理能力评测基准与 Agent Harness，致力于实现公平、可复现的模型评测。

[English](README.md) | [简体中文](README.zh.md)

---

## 项目简介

GeoMark 是一个用于评估和研究 AI 模型推理能力的开源项目。

项目由两个相互关联的核心部分组成：

- **GeoMark Benchmark** —— 标准化的推理任务、数据集、评测协议、指标与失败分析体系。
- **GeoMark Harness** —— 模型无关的实验环境，用于在明确且统一的条件下运行不同 AI 模型。

GeoMark 当前以 **AI 几何推理**作为主要研究方向，同时从架构上为未来扩展到更广泛的推理任务保留空间。

---

## 为什么需要 GeoMark？

不同 AI 模型往往运行在不同的界面、Prompt、系统提示词、工具和执行环境中。

因此，当两个模型产生不同结果时，我们很难直接判断差异究竟来自：

- 模型本身的能力；
- System Prompt；
- 可用工具；
- 执行环境；
- 推理配置；
- 或其他实验变量。

GeoMark 希望让这些变量变得明确、可记录、可比较。

> **同一道题，同一套条件，交给不同的模型。**

Harness 不负责让某一个模型表现得更好，而是提供一个可以明确配置、记录、复现和比较实验条件的环境。

---

## 核心原则

### 模型无关

GeoMark 不围绕某一个特定 AI 模型或厂商进行设计。

不同模型可以通过统一的接口接入，从而使用相同的评测任务进行实验。

### 公平

Harness 不主动为特定模型优化 Prompt，不注入针对某个模型的隐藏人格或特殊能力，也不应为特定模型提供额外优势。

实验条件应当被明确配置，而不是被 Harness 静默修改。

### 可复现

实验应当保存理解和复现实验所需要的信息，包括：

- 模型与 Provider
- API Endpoint
- System Prompt
- User Prompt
- 推理配置
- 附加文件
- Token 使用量
- 延迟
- 结束原因
- 实验元数据

### 透明

失败同样是实验结果。

Timeout、Provider Error、无效响应以及其他执行错误都会被记录，而不是被静默丢弃。

---

# GeoMark Benchmark

GeoMark Benchmark 是项目的评测层。

当前 Benchmark 主要关注几何推理，用于研究 AI 模型如何理解、分析和解决几何问题。

早期 Benchmark 计划包含以下类别：

- 图示理解
- 平面几何 —— 允许使用坐标法
- 平面几何 —— 限制使用坐标法
- 立体几何 —— 允许使用坐标法
- 立体几何 —— 限制使用坐标法

未来可以扩展到更多推理任务和模态。

---

## 评测维度

GeoMark 不仅关注模型最终答案是否正确。

潜在评测维度包括：

- 最终答案准确率
- 推理有效性
- 约束遵循情况
- 图示理解能力
- 推理方法
- 坐标法使用情况
- 失败类型
- 多次运行稳定性

不同指标可以根据具体任务使用程序化评测或人工评审。

---

# GeoMark Harness

GeoMark Harness 是项目的实验执行层。

它提供统一的模型交互接口，同时将实验变量显式暴露出来。

简化的数据流如下：

```text
Benchmark Task
      │
      ▼
GeoMark Harness
      │
      ├── Model Adapter
      │
      ├── Prompt / Configuration
      │
      ├── File Input
      │
      ├── Streaming Events
      │
      └── Experiment Recorder
      │
      ▼
AI Model
      │
      ▼
Structured Experiment Result
````

Harness 的目标是提供实验环境，而不是决定哪个模型更强。

---

## 当前 Harness 能力

当前开发版本已经支持：

* 模型无关的 Provider 架构
* OpenAI-compatible API
* Anthropic-compatible API
* 模型切换
* 自定义模型配置
* System Prompt 配置
* Temperature 配置
* 最大 Token 配置
* 模型原生推理配置
* Reasoning Effort 配置
* Reasoning Budget 配置
* 显式文件附加
* 流式响应
* TTFT 测量
* Token 使用量记录
* 结束原因记录
* 实验历史
* 实验包持久化
* Provider Error 记录
* Timeout 记录

当前 Harness 仍处于持续开发阶段。

---

# 实验记录

每次实验都会获得唯一的实验 ID。

例如：

```text
exp-2026-09-12T18-34-14-482b29b6
```

一次完整实验可以记录：

```text
Model
Provider
Endpoint
System Prompt
User Prompt
Reasoning Configuration
Attached Files
TTFT
Total Latency
Input Tokens
Output Tokens
Termination Reason
Experiment Status
Timestamp
```

这样可以对每一次独立运行进行检查，而不是简单地将实验压缩成一个最终分数。

---

# 实验轨道

GeoMark 计划支持多种评测轨道。

### Real-World Track

通过模型正常面向用户的产品界面进行测试。

这一轨道更接近普通用户实际使用 AI 模型时获得的体验。

### Controlled Track

通过 GeoMark Harness 在明确配置的实验条件下运行模型。

这一轨道主要用于减少环境差异，更集中地研究模型自身能力。

### Agent Track

将模型与 Agent Harness 结合，对不同 Agent 配置对任务表现的影响进行评测。

在这一模式下，Harness 本身也可以成为实验变量，而不是一个隐藏的实现细节。

---

# 数据集结构

一个 Benchmark 数据集样本可以采用类似以下结构：

```text
geo_0001/
├── problem.txt
├── diagram_original.jpg
├── diagram_clean.png
├── answer.txt
└── metadata.json
```

例如：

```json
{
  "id": "geo_0001",
  "category": "plane_geometry",
  "coordinate_policy": "restricted",
  "difficulty": "medium"
}
```

具体数据结构会随着项目发展进行调整。

---

# 失败分析

GeoMark 不仅希望回答：

> **模型答对了多少？**

还希望进一步研究：

> **模型为什么答错？**

未来计划建立统一的失败分类体系，例如：

```text
F01 — 图示理解失败
F02 — 几何关系理解失败
F03 — 错误前提或错误假设
F04 — 计算错误
F05 — 推理链错误
F06 — 违反题目约束
F07 — 最终答案错误
F08 — 工具 / 执行错误
```

随着 Benchmark 实验结果积累，失败分类体系将持续调整。

---

# 项目状态

GeoMark 当前处于早期研究与开发阶段。

### 当前进展

* [x] GeoMark 项目概念
* [x] 模型无关 Harness 原型
* [x] 多 Provider 架构
* [x] 流式交互
* [x] 实验记录
* [x] 文件输入
* [x] 基础实验指标
* [x] Error 与 Timeout 记录
* [x] Harness v0.6.0

### 下一阶段

图例：`[x]` 已交付且有证据 · `[~]` 部分交付（附原因）· `[ ]` 未开始。

* [x] GeoMark Benchmark 0.1 —— 版本化数据集清单 `benchmark/dataset.json`（含逐产物哈希）
* [~] 初始几何数据集 —— 18 题，但仅 16 题有配图、8 题有来源标注（其余 10 道为自编，source 为 null）、
  8 题有 `visionRubric`
* [x] 标准化评测协议 —— `benchmark/docs/EVALUATION-PROTOCOL.md`
* [x] 自动化结果统计 —— `benchmark/tools/summarize.mjs`（对比表 / CSV / JSON）
* [~] 多次重复实验 —— `summarize.mjs --runs A,B` 已实现，但**从未真正跑过第二轮**，因此不存在任何稳定性表
* [~] 失败分类体系 —— 定义了 F01–F08，其中仅 5 个有自动检测器（见 Failure Analysis 一节）
* [~] Benchmark 结果可视化 —— `benchmark/viz/` 是 Remotion 视频工程：需要 `npm install` 且无 lockfile，
  并不是开箱即用的看板
* [~] 可复现实验包 —— `datasetHash` + `promptHash` + judge 配置均有记录，但 judge 与被测模型相同、
  `deepseek-chat` 是可变别名，且没有任何运行产物入库（见 Results）

### 长期计划

* [~] 多模态推理评测 —— `vision` 模式已实现并按 `visionRubric` 判分，但 18 题中仅 8 题有该细则，
  其余按跳过处理而非计分
* [ ] 更大规模 Benchmark
* [ ] Agent 能力评测 —— 当前 Agent 赛道只负责「把 Agent 拉起来」，不做评测
* [ ] 代码与工具调用评测
* [ ] 更多推理领域
* [ ] 跨模型对比 —— 尚未发布任何多模型运行结果
* [ ] 持续集成 —— 目前没有 `.github/workflows`，「测试通过」只能由作者本人验证
* [ ] 学术研究与论文

---

# 项目结构

项目围绕 Benchmark 与 Harness 两个核心部分组织：

```text
GeoMark/
├── benchmark/
│   ├── datasets/
│   ├── evaluation/
│   └── ...
│
├── harness/
│   └── ...
│
├── docs/
├── examples/
├── scripts/
├── results/
│
├── README.md
├── README.zh.md
├── LICENSE
└── .gitignore
```

随着项目发展，仓库结构可能继续调整。

---

# 设计理念

GeoMark 遵循一个简单的原则：

> **评测环境应该是显式的，而不是隐藏的。**

一个可靠的 AI 模型评测应该能够回答：

1. 测试了什么模型？
2. 在什么条件下测试？
3. 使用了什么 Prompt？
4. 使用了哪些工具或文件？
5. 进行了多少次测试？
6. 每一次实验具体发生了什么？
7. 其他研究者能否复现实验？

GeoMark 围绕这些问题进行设计。

---

# 参与贡献

欢迎提交代码、Issue、Benchmark 任务、评测方案、研究想法以及 Bug 报告。

如果发现 GeoMark Harness 存在问题，请尽可能提供：

* 复现步骤；
* 模型 / Provider 信息；
* 相关配置；
* 错误信息；
* 预期行为；
* 实际行为。

如果希望贡献 Benchmark 任务，请提供：

* 任务描述；
* 标准答案；
* 评测标准；
* 相关来源或标注信息。

---

# 开源协议

GeoMark 使用 MIT License 开源。

详细内容请参阅 [LICENSE](LICENSE)。

---

# 引用

GeoMark 当前仍处于持续开发阶段。

当 Benchmark 方法论与研究结果达到稳定版本后，将提供正式的论文引用格式。

---

# GeoMark

**公平评测 · 可复现实验 · 模型无关基础设施**
