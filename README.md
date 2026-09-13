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
