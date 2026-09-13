
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

GeoMark is intended to support multiple evaluation tracks.

### Real-World Track

Compare models through their normal user-facing interfaces.

This track reflects the experience an ordinary user receives from each model.

### Controlled Track

Run models through GeoMark Harness with explicitly standardized experimental conditions.

This track is intended to reduce environmental variables when studying model capability.

### Agent Track

Evaluate models together with an Agent Harness and compare how different agent configurations affect task performance.

The Harness itself can therefore become an experimental variable rather than being treated as an invisible implementation detail.

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

* [ ] GeoMark Benchmark 0.1
* [ ] Initial geometry dataset
* [ ] Standardized evaluation protocol
* [ ] Automated result aggregation
* [ ] Repeated-run evaluation
* [ ] Failure taxonomy
* [ ] Benchmark result visualization
* [ ] Reproducible experiment packages

### Future

* [ ] Multimodal reasoning evaluation
* [ ] Larger benchmark datasets
* [ ] Agent evaluation
* [ ] Code and tool-use evaluation
* [ ] Additional reasoning domains
* [ ] Research publication

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

