
# GeoMark

> A model-agnostic benchmark and agent harness for fair, reproducible evaluation of AI reasoning capabilities.

[English](README.md) | [简体中文](README.zh.md)

---

## Overview

GeoMark is an open-source project for evaluating and studying the reasoning capabilities of AI models.

The project consists of two closely connected components:

- **GeoMark Benchmark** — a standardized collection of reasoning tasks, evaluation protocols, metrics, and failure analysis.
- **GeoMark Harness** — a model-agnostic experimental environment designed to run different models under the same explicitly defined conditions.

The initial research focus of GeoMark is **AI geometry reasoning**, while the architecture is designed to support broader reasoning tasks in the future.

---

## Why GeoMark?

Different AI models are often evaluated through different interfaces, prompts, system instructions, tools, and execution environments.

This makes it difficult to determine whether a difference in results comes from:

- the underlying model capability;
- the system prompt;
- the available tools;
- the execution environment;
- the reasoning configuration;
- or other experimental variables.

GeoMark aims to make these variables explicit.

> **Same task. Same conditions. Different models.**

The Harness does not attempt to make one model perform better than another. Instead, it provides a controlled environment in which experimental conditions can be defined, recorded, reproduced, and compared.

---

## Core Principles

### Model-Agnostic

GeoMark is not designed around a specific AI model or provider.

Models can be connected through standardized interfaces, allowing the same evaluation tasks to be executed across different providers and model families.

### Fair

The Harness does not intentionally optimize prompts, add model-specific personalities, or introduce hidden advantages for particular models.

Experimental conditions should be explicitly defined rather than silently modified.

### Reproducible

Experiments should preserve the information required to understand and reproduce a result, including:

- model and provider
- endpoint configuration
- system prompt
- user prompt
- reasoning configuration
- attached files
- token usage
- latency
- termination reason
- experiment metadata

### Transparent

Failures are results too.

Timeouts, provider errors, invalid responses, and other execution failures are recorded rather than silently discarded.

---

# GeoMark Benchmark

GeoMark Benchmark is the evaluation layer of the project.

The initial benchmark focuses on geometry reasoning and is designed to investigate how AI models understand, reason about, and solve geometric problems.

Early benchmark categories include:

- Diagram Understanding
- Plane Geometry — Coordinate Methods Allowed
- Plane Geometry — Coordinate Methods Restricted
- Solid Geometry — Coordinate Methods Allowed
- Solid Geometry — Coordinate Methods Restricted

The benchmark can later be extended to additional reasoning tasks and modalities.

---

## Evaluation

GeoMark is designed to evaluate more than whether a model produces the final answer.

Potential evaluation dimensions include:

- Final Answer Accuracy
- Reasoning Validity
- Constraint Compliance
- Diagram Understanding
- Reasoning Method
- Coordinate-Method Usage
- Failure Type
- Run-to-Run Stability

Some metrics may require human or programmatic verification depending on the task.

---

# GeoMark Harness

GeoMark Harness is the experimental execution layer.

It provides a unified interface for interacting with different AI models while keeping experimental variables explicit.

A simplified workflow is:

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

The Harness is intended to handle the experimental environment, not to determine which model is "better".

---

## Current Harness Capabilities

The current development version includes:

* Model-independent provider architecture
* OpenAI-compatible API support
* Anthropic-compatible API support
* Model switching
* Custom model configuration
* System prompt configuration
* Temperature configuration
* Maximum token configuration
* Native reasoning configuration
* Reasoning effort configuration
* Reasoning budget configuration
* Explicit file attachment
* Streaming responses
* TTFT measurement
* Token usage recording
* Termination reason recording
* Experiment history
* Experiment package persistence
* Provider error recording
* Timeout recording

The Harness is under active development.

---

# Experiment Records

Each experiment receives a unique identifier.

Example:

```text
exp-2026-09-12T18-34-14-482b29b6
```

A recorded experiment may contain information such as:

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

This allows individual runs to be inspected instead of reducing an experiment to a single score.

---

# Experimental Tracks

Three evaluation tracks. All three are implemented in the web interface — click **Start Test**
to open the track chooser.

### Real-World Track

Compare models through their normal user-facing interfaces.

This track reflects the experience an ordinary user receives from each model.

*Implemented as:* one click opens every vendor's official chat page simultaneously, so the same
question can be pasted into each. Conditions are opaque and not reproducible — that is the point:
this track measures what a user actually gets, not what a model can do under ideal conditions.
Targets are declared in `harness/config/tracks.json` and can be edited freely.

**Running a GeoMark item on a vendor site.** Each target carries a best-effort capability tag
(`Zip` / `Doc` / `Image`) and the chooser shows a recommended method per platform:

| Platform capability | Recommended method |
|---|---|
| Reads archives (ChatGPT) | download the item **ZIP** and upload it directly |
| Accepts images | use the **item card PNG** — statement and figure composed into a single image |
| Text-oriented | **copy the statement**, upload the figure separately |

The card PNG exists because most domestic platforms cannot accept a document and an image in the
same message; composing both into one image sidesteps that limit entirely. All three actions are
available in the chooser (`Copy statement` / `Download card PNG` / `Download ZIP`), served by
`/api/export/*`. The ZIP is written by a dependency-free store-only ZIP writer in `server.mjs`.

### Controlled Track

Run models through GeoMark Harness with explicitly standardized experimental conditions.

This track is intended to reduce environmental variables when studying model capability.

*Implemented as:* the existing benchmark runner — same items, same prompts, same parameters, every
variable recorded. Cross-model comparison should rely on this track.
The chooser's **Open controlled benchmark** button leads here; the header exposes a single
`Start Test` entry so the two are not duplicated.

### Agent Track

Evaluate models together with an Agent Harness and compare how different agent configurations affect task performance.

The Harness itself can therefore become an experimental variable rather than being treated as an invisible implementation detail.

*Implemented as:* the chooser lists 22 agent products and detects which are installed on this
machine. Installed CLI agents launch in a new terminal window; desktop IDEs and anything not
installed open their official site instead.

- **CLI agents:** Claude Code, Codex CLI, Gemini CLI, Copilot CLI, Qwen Code, opencode, Aider,
  Cline, Goose, Crush, Amp, Cursor Agent
- **Domestic (China) products:** ZCode (智谱), TRAE / TraeWork (字节跳动), Kimi Code (月之暗面),
  Qoder CN / 通义灵码 (阿里云), CodeBuddy (腾讯云), 文心快码 Comate (百度), MiniMax Code (MiniMax),
  WorkBuddy (腾讯)

Only binaries and URLs declared in `harness/config/tracks.json` can be launched — the endpoint is
an allowlist, never an arbitrary command.

---

# Dataset Structure

A benchmark item may follow a structure such as:

```text
geo_0001/
├── problem.txt
├── diagram_original.jpg
├── diagram_clean.png
├── answer.txt
└── metadata.json
```

Example metadata:

```json
{
  "id": "geo_0001",
  "category": "plane_geometry",
  "coordinate_policy": "restricted",
  "difficulty": "medium"
}
```

The exact schema is subject to change during early development.

---

# Failure Analysis

GeoMark is intended not only to measure success rates, but also to study how and why models fail.

A future failure taxonomy may include categories such as:

```text
F01 — Diagram Understanding Failure
F02 — Geometric Relationship Failure
F03 — Incorrect Assumption
F04 — Calculation Error
F05 — Reasoning Chain Failure
F06 — Constraint Violation
F07 — Final Answer Error
F08 — Tool / Execution Failure
```

The taxonomy will evolve as benchmark results accumulate.

---

# Project Status

GeoMark is currently in an early research and development stage.

### Current

* [x] Initial GeoMark concept
* [x] Model-agnostic Harness prototype
* [x] Multi-provider architecture
* [x] Streaming interaction
* [x] Experiment recording
* [x] File input
* [x] Basic experiment metrics
* [x] Error and timeout recording
* [x] Harness v0.6.0

### Next

* [x] GeoMark Benchmark 0.1 — 版本化数据集清单 `benchmark/dataset.json`（含内容哈希，可复现）
* [x] Initial geometry dataset — 平面几何题库（含配图、rubric、visionRubric、来源标注）
* [x] Standardized evaluation protocol — `benchmark/docs/EVALUATION-PROTOCOL.md`
* [x] Automated result aggregation — `benchmark/tools/summarize.mjs`（对比表 / CSV / JSON）
* [x] Repeated-run evaluation — `summarize.mjs --runs A,B` 输出逐题差值稳定性表
* [x] Failure taxonomy — F01–F08，见 `benchmark/docs/FAILURE-TAXONOMY.md`
* [x] Benchmark result visualization — `benchmark/viz/`
* [x] Reproducible experiment packages — `datasetHash` + `promptHash` + rubric/judge 配置共同锁定

### Future

* [x] Multimodal reasoning evaluation — `vision` 模式（纯识图），按 `visionRubric` 判分
* [ ] Larger benchmark datasets
* [ ] Agent evaluation
* [ ] Code and tool-use evaluation
* [ ] Additional reasoning domains
* [ ] Research publication

---

# Constraint Compliance

GeoMark evaluates more than correctness. Under the `pure` mode (coordinate methods
explicitly forbidden), an answer that secretly builds a coordinate system is treated as a
**constraint violation**: the total score is zeroed and flagged as cheating, while the raw
rubric score is preserved for review.

Using **vectors with a basis** (expressing vectors as linear combinations of basis vectors,
computing dot products via $|\vec a||\vec b|\cos\theta$, never assigning coordinates to any
point) is a legitimate synthetic method and is **not** penalized.

Detection is double-path and takes the stricter outcome: deterministic regex scanning with
negation guards, plus an LLM compliance audit over both the reasoning trace and the final
answer. See `benchmark/docs/EVALUATION-PROTOCOL.md` for the exact criteria.


---

# Repository Structure

The repository is organized around the two main components:

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

The repository structure may evolve as the project develops.

---

# Design Philosophy

GeoMark follows a simple principle:

> **The evaluation environment should be explicit, not invisible.**

A model benchmark should make it possible to answer:

1. What model was tested?
2. Under what conditions?
3. With what prompt?
4. With what tools or files?
5. How many times was it tested?
6. What exactly happened during each run?
7. Can another researcher reproduce the experiment?

GeoMark is built around these questions.

---

# Contributing

Contributions, discussions, benchmark proposals, evaluation ideas, and bug reports are welcome.

If you discover a problem with GeoMark Harness, please provide:

* reproduction steps;
* model/provider information;
* relevant configuration;
* error messages;
* expected behavior;
* actual behavior.

For benchmark contributions, please provide the task definition, expected answer, evaluation criteria, and any relevant source or annotation information.

---

# License

GeoMark is released under the MIT License.

See [LICENSE](LICENSE) for details.

---

# Citation

GeoMark is currently under active development.

A formal citation format will be provided when the benchmark methodology and research results reach a stable version.

---

## GeoMark

**Fair evaluation. Reproducible experiments. Model-agnostic infrastructure.**

