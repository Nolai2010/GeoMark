
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

## Quick Start

Requires **Node.js ≥ 22** (the Harness itself has zero runtime dependencies — no `npm install`).

```bash
node harness/surfaces/web/server.mjs      # web UI  → http://127.0.0.1:7788
node harness/surfaces/cli/cli.mjs --help  # CLI surface
cd harness && npm test                    # 114 tests, all offline
```

Add an API key through the web UI (**API 密钥**) or `harness/config/secrets.json`
(see `secrets.example.json`). New here? Use the in-app **Guide** (新手教程) button, or read
[`GETTING-STARTED.zh.md`](GETTING-STARTED.zh.md) / [`GETTING-STARTED.en.md`](GETTING-STARTED.en.md).

To run the benchmark itself, see [`benchmark/README.md`](benchmark/README.md) and
[`benchmark/docs/EVALUATION-PROTOCOL.md`](benchmark/docs/EVALUATION-PROTOCOL.md).

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

## What is actually in v0.1

18 items, each attempted in three modes:

| Mode | What the model gets | What it is asked to do |
|---|---|---|
| `vision` | the figure only | describe the figure in words — no solving |
| `coord` | statement + figure | solve it, coordinate methods allowed |
| `pure` | statement + figure | solve it, coordinate methods **forbidden** — restricted items only |

Metadata that actually exists on the items (not every item has every field):

- `coordinatePolicy` — `restricted` on 8 items, `allowed` on 3 (GM-0007/0009/0010, whose rubrics score
  the coordinate route itself, e.g. 空间向量法), and **absent on the other 7**. A missing value means
  "not declared": `coord` is permissive for everything, and `pure` is only attempted on `restricted`
  items.
- `category` — `plane_geometry` (8) or `geometry` (10). The latter is a catch-all and currently also
  holds five solid-geometry items, so the plane/solid split is **not yet a reliable field**.
- `visionRubric` — present on 8 items (`hasVisionRubric` in `dataset.json`). Items without it are
  skipped in `vision` mode rather than scored against the solving rubric.
- `rubric` / `answerKey` / `knowledgeScope` / `difficulty` / `source` — `source` is `null` for the
  10 self-authored items.

So the shipped matrix is **3 modes × 18 items**, not a five-category taxonomy. Earlier drafts of this
README listed five categories (including *Solid Geometry — Coordinate Methods Allowed*); the metadata
never supported that split. [`benchmark/dataset.json`](benchmark/dataset.json) is the authoritative
list; [`benchmark/docs/EVALUATION-PROTOCOL.md`](benchmark/docs/EVALUATION-PROTOCOL.md) is the protocol.

---

## Evaluation

GeoMark is designed to evaluate more than whether a model produces the final answer.

Dimensions **computed today** are marked ✅; the rest are intended, not implemented.

- ✅ Final Answer Accuracy — rubric score via LLM-as-judge
- ✅ Constraint Compliance — deterministic regex scan + LLM audit; `pure` violations are zeroed
- ✅ Diagram Understanding — `vision` mode, scored against `visionRubric`
- ✅ Failure Type — automatic classification (only some taxonomy codes are reachable; see below)
- ⬜ Reasoning Validity — needs step-level scoring; not implemented
- ⬜ Reasoning Method — not implemented
- ⬜ Run-to-Run Stability — the comparison code exists (`summarize.mjs --runs A,B`), but no repeated
  run has ever been performed, so no stability table has been produced

---

## Results

One full run exists so far — **one model, one repetition**:

| Mode | Mean score | Items scored |
|---|---|---|
| `vision` (describe the figure) | 36% | 8 |
| `coord` (coordinates allowed) | 69% | 18 |
| `pure` (coordinates forbidden) | 55% | 18 ⚠ see caveat 2 |

Run: `deepseek-chat`, temperature 0, max_tokens 8192, 2026-09-18, 54 independent requests, no shared
context. Full snapshot with the per-item table, failure counts and the one caught constraint
violation: [`benchmark/docs/RESULTS.md`](benchmark/docs/RESULTS.md).

Three caveats matter more than the numbers:

1. **n = 1 model, 1 repetition.** Cross-model comparison — the headline claim of this project — has
   **no delivered data yet**. Everything above is a hypothesis, not a measurement.
2. The `coord` vs `pure` gap (14 pp) is **not yet a clean measurement of method-following**, for two
   independent reasons found in the 2026-09-19 audit: (a) for six of the eight `restricted` items the
   reference rubric was itself phrased in coordinate terms, biasing compliant answers downward;
   (b) `pure` ran on all 18 items even though three of them (GM-0007/0009/0010, now marked `allowed`)
   score the coordinate route itself, so those `pure` scores were structurally zero-able. Both are
   fixed — rubrics are method-neutral now, and `pure` only applies to `restricted` items. A rerun is
   required before the gap can be quoted as a number; under the new scope `pure` covers 8 items, not 18.
3. The judge and the model under test are **the same model**. Self-preference bias is unmeasured, and
   `deepseek-chat` is a moving alias, so this run is not reproducible in the strict sense.

Producing a cross-model table is the single highest-value next step; see Project Status.

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
```

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
* Reasoning effort configuration — **OpenAI-compatible protocol only**; the Anthropic spec has no
  such field, so the UI input is silently dropped on that side
* Reasoning budget configuration — **Anthropic-compatible protocol only** (`thinking.budget_tokens`);
  the OpenAI spec has no such field
* Explicit file attachment
* Streaming responses
* First-content latency measurement (`ttftMs`) — see the note below; this is **not** a strict
  time-to-first-token
* Token usage recording — taken from the provider's own `usage`, never estimated locally
* Termination reason recording — two layers: the provider's raw `finishReason` is stored verbatim,
  while the harness-level enum (`completed` / `provider_error` / `network_error` / `timeout` /
  `aborted` / `truncated` / `harness_error`) folds `length` and `content_filter` into `completed`
* Experiment history
* Experiment package persistence
* Provider error recording
* Timeout recording

Three precision notes, because these were previously overstated:

1. **`ttftMs` is first-content latency, not TTFT.** The clock starts before local file reads and
   prompt assembly (`pipeline.mjs`), and only a content delta stops it — a leading reasoning delta
   does not. Runs with large attachments are therefore systematically charged for local work.
2. **Reasoning effort and budget are asymmetrically supported** — each exists in exactly one of the
   two protocol specs, but both have UI inputs.
3. **`content_filter` is not a distinct terminal state.** It is preserved in `finishReason`, but the
   unified enum reports it as `completed`, so a real failure mode is invisible to aggregate queries.

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
First-Content Latency (ttftMs)
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

Three tracks, reachable from the **Start Test** chooser in the web UI. They are **not** equally
complete, and the difference matters:

| Track | Launches the environment | Collects answers | Scores | Records / replays |
|---|---|---|---|---|
| Real-World | ✅ | ❌ | ❌ | ❌ |
| Controlled | ✅ | ✅ | ✅ | ✅ |
| Agent | ✅ | ❌ | ❌ | ❌ |

Real-World and Agent are **provisioning tracks**: they put the same item in front of a vendor's site
or a locally installed agent and then leave the result with you. There is no answer capture and no
scoring — `grep` for `real.?world|agent.?track|launch-agent` under `benchmark/` returns nothing, so
neither is connected to the scoring pipeline. Results must be recorded by hand. Only the Controlled
track produces benchmark numbers.

### Real-World Track

Compare models through their normal user-facing interfaces.

This track reflects the experience an ordinary user receives from each model.

*Implemented as:* one click opens every vendor's official chat page simultaneously, so the same
question can be pasted into each. Conditions are opaque and not reproducible — that is the point:
this track measures what a user actually gets, not what a model can do under ideal conditions.
Targets are declared in `harness/config/tracks.json` and can be edited freely.

**Running a GeoMark item on a vendor site.** Each target carries a best-effort capability tag
(`accepts`: `text` / `image` / `document` / `archive` — the README previously called these
"Zip / Doc / Image") and the chooser shows a recommended method per platform:

| Platform capability | Recommended method |
|---|---|
| Reads archives (ChatGPT) | download the item **ZIP** and upload it directly |
| Accepts images | use the **item card PNG** — statement and figure composed into a single image |
| Text-oriented | **copy the statement**, upload the figure separately |

The card PNG exists because most domestic platforms cannot accept a document and an image in the
same message; composing both into one image sidesteps that limit. Where each action runs is worth
being precise about, since only one of the three is server-side:

- `Download ZIP` → **server** (`/api/export/item/<id>.zip`), written by a dependency-free store-only
  ZIP writer in `server.mjs`
- `Download card PNG` → **browser only** — composed on an HTML5 Canvas (`buildCardCanvas`) and saved
  via `toDataURL`. It therefore inherits your local fonts, and LaTeX is reduced to symbol
  substitution rather than rendered, so formula-heavy statements appear degraded on the card.
- `Copy statement` → **browser only** — fetches `problem.md` and writes it to the clipboard

The capability tags are a best-effort judgement, not a tested claim; they live in
`harness/config/tracks.json` and can be corrected there.

### Controlled Track

Run models through GeoMark Harness with explicitly standardized experimental conditions.

This track is intended to reduce environmental variables when studying model capability.

*Implemented as:* the existing benchmark runner — same items, same prompts, same parameters, every
variable recorded. Cross-model comparison should rely on this track.
The chooser's **Open controlled benchmark** button leads here. The header keeps a single *test* entry
point (`Start Test`); its other buttons are the guide and API-key dialogs.

### Agent Track

Evaluate models together with an Agent Harness and compare how different agent configurations affect task performance.

The Harness itself can therefore become an experimental variable rather than being treated as an invisible implementation detail.

*Implemented as:* the chooser lists 35 agent products and detects which are installed on this
machine. Detection and launch differ by form — a CLI is resolved on `PATH` and launched in a new
terminal; a **desktop client** is launched directly from its executable path; a **MSIX / Store app**
has no executable path at all and is launched through its AppID; anything else opens its official
site.

- **CLI agents (12):** Claude Code, Codex CLI, Gemini CLI, Copilot CLI, Qwen Code, opencode, Aider,
  Cline, Goose, Crush, Amp, Cursor Agent
- **Desktop clients (17):** ZCode, 智谱清言, TraeWork CN, Kimi, Qoder CN, MiniMax Code, MiniMax Design,
  WorkBuddy, ChatCut, QClaw, ima, 豆包, 腾讯元宝, 千问, Tuanjie Cowork, Cursor, Antigravity
- **Store (MSIX) apps (2):** Claude Desktop, ChatGPT Desktop
- **Web / plugin only (4):** TRAE CN, 通义灵码, CodeBuddy, 文心快码 Comate — these have no installable
  local executable in this configuration, so they fall back to opening the official site

12 + 17 + 2 + 4 = 35 declared targets.

- **Domestic (China) products:** ZCode / 智谱清言 (智谱), TRAE / TraeWork / 豆包 (字节跳动),
  Kimi (月之暗面), Qoder CN / 通义灵码 / 千问 (阿里), CodeBuddy / WorkBuddy / ChatCut / QClaw /
  ima / 腾讯元宝 (腾讯), 文心快码 Comate (百度), MiniMax Code / MiniMax Design (MiniMax),
  Tuanjie Cowork (团结引擎)

**This track is machine-bound, and that is a known limitation.** The `exe` paths in `tracks.json`
are absolute paths from one development machine; on any other machine the app targets will simply
report "not detected". The reason they are written down instead of guessed is that package names and
install directories routinely disagree with product names (TraeWork installs into `TRAE SOLO CN`;
Antigravity into `agy`; the ChatGPT desktop app carries the AppID prefix `OpenAI.Codex`).
`harness/tools/scan-agents.ps1` regenerates the inventory — Start-Menu shortcuts, AppIDs, the
uninstall registry, running-process paths and tool config dirs — and
[`harness/docs/AGENT-INVENTORY.md`](harness/docs/AGENT-INVENTORY.md) records the last scan together
with the exact install paths it found.

Only ids declared in `harness/config/tracks.json` can be launched — the endpoint is an allowlist,
never an arbitrary command. Executable paths come from the config file, never from the request body,
and are re-checked for existence before launch. For automated verification without popping windows
on someone's desktop, start the server with `GM_LAUNCH_DRY_RUN=1`: it then returns the command it
*would* run instead of running it.

**What that allowlist does and does not buy you.** A remote web page cannot make this server start
anything: the id must be in the config, the executable path must come from the config and exist, and
requests are gated by a Host check, an Origin check and a `Sec-Fetch-Site` check. What it does *not*
protect against is write access to `tracks.json` itself — CLI targets are launched through
`cmd /c start '' cmd /k <bin>`, which is a cmd.exe command line, not an `execve` argument vector. A
`bin` value containing shell metacharacters executes at that level. `bin`, `exe` and `url` values are
therefore charset-restricted in the server and asserted in `tests/tracks-config.test.mjs`. Treat the
config file as executable content, not as data.

---

# Dataset Structure

Every item is a directory named `GM-XXXX` under `benchmark/items/`. This is the real layout of
`GM-0101`:

```text
benchmark/items/GM-0101/
├── problem.md      statement, Markdown + LaTeX, figures inline as ![figure](assets/figure.png)
├── solution.md     reference solution
├── meta.json       machine-readable metadata (see below)
└── assets/
    └── figure.png  the figure (PNG; legacy items may carry both .svg and .png)
```

Real `meta.json` (abridged from `GM-0101`) — note camelCase keys and the nested `source` block:

```json
{
  "id": "GM-0101",
  "title": "圆的切线判定与线段比值：直径、中位线与切线",
  "subject": "math",
  "category": "plane_geometry",
  "coordinatePolicy": "restricted",
  "knowledgeScope": { "stage": "初中", "topics": ["切线的判定", "直径所对圆周角", "三角函数"] },
  "questionType": "解答题",
  "answer": "（1）见解析；（2）① $BC=\\dfrac{4\\sqrt{5}}{5}$；② $\\tan\\angle PEC=\\dfrac{24}{7}$",
  "answerKey": ["…"],
  "difficulty": "hard",
  "figure": ["assets/figure.png"],
  "rubric": [{ "point": "…", "score": 4 }],
  "visionRubric": [{ "point": "…", "score": 2 }],
  "source": {
    "site": "第一试卷网", "url": "https://www.shijuan1.com/a/sjsxzk/",
    "paper": "2026年江苏省苏州市中考数学试题 第25题",
    "region": "江苏苏州", "year": 2026, "license": "免费资源"
  },
  "tags": ["…"], "dateAdded": "2026-09-18"
}
```

An earlier version of this README showed a fictional `geo_0001/` layout with `problem.txt`,
`diagram_clean.png`, `answer.txt`, `metadata.json` and a snake_case `coordinate_policy` key. None of
those names were ever used. `benchmark/dataset.json` carries the authoritative list plus a SHA-256
per artifact, and `benchmark/docs/EVALUATION-PROTOCOL.md` documents how the fields are consumed.

---

# Failure Analysis

GeoMark is intended not only to measure success rates, but also to study how and why models fail.

Eight codes are defined. `summarize.mjs` can currently emit **five** of them plus `PASS`; the other
three are reserved labels with no automatic detector yet, so a zero count for them means "not
implemented", not "never happens":

```text
F01 — Diagram Understanding Failure      ✅ auto (vision mode, score < 40%)
F02 — Geometric Relationship Failure     ⬜ reserved — no detector
F03 — Incorrect Assumption               ⬜ reserved — no detector
F04 — Calculation Error                  ✅ auto (70–99%)
F05 — Reasoning Chain Failure            ✅ auto (40–69%)
F06 — Constraint Violation               ✅ auto (cheat flag from the compliance audit)
F07 — Final Answer Error                 ✅ auto (< 40%)
F08 — Tool / Execution Failure           ⬜ reserved — transport failures surface as provider_error/timeout instead
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

Legend: `[x]` delivered and evidenced · `[~]` partially delivered (reason given) · `[ ]` not started.

* [x] GeoMark Benchmark 0.1 — versioned dataset manifest `benchmark/dataset.json` with per-artifact hashes
* [~] Initial geometry dataset — 18 items, but only 16 have a figure, 8 have `source` filled in (the
  other 10 are self-authored), and 8 have a `visionRubric`
* [x] Standardized evaluation protocol — `benchmark/docs/EVALUATION-PROTOCOL.md`
* [x] Automated result aggregation — `benchmark/tools/summarize.mjs` (comparison table / CSV / JSON)
* [~] Repeated-run evaluation — `summarize.mjs --runs A,B` is implemented, but **no repeated run has
  ever been performed**, so no stability table has been produced
* [~] Failure taxonomy — F01–F08 defined, 5 of 8 have an automatic detector (see Failure Analysis)
* [~] Benchmark result visualization — `benchmark/viz/` is a Remotion video project: it needs
  `npm install` and there is no lockfile. It is not a ready-to-open dashboard
* [~] Reproducible experiment packages — `datasetHash` + `promptHash` + rubric/judge config are
  recorded, but the judge is the same model as the one under test, `deepseek-chat` is a moving
  alias, and no run output is committed (see Results)

### Future

* [~] Multimodal reasoning evaluation — `vision` mode exists and is scored against `visionRubric`,
  but only 8 of 18 items have one; the rest are skipped rather than scored
* [ ] Larger benchmark datasets
* [ ] Agent evaluation — the Agent track currently provisions agents, it does not evaluate them
* [ ] Code and tool-use evaluation
* [ ] Additional reasoning domains
* [ ] Cross-model comparison — no multi-model run has been published yet
* [ ] Continuous integration — there is no `.github/workflows`, so "tests pass" cannot be verified
  by anyone but the author
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
negation guards (two or more strong hits override a contrary LLM verdict), plus an LLM compliance
audit over both the reasoning trace and the final answer. See
`benchmark/docs/EVALUATION-PROTOCOL.md` for the exact criteria.

**The rubric must not smuggle the forbidden method back in.** This was a real defect: for six of the
eight `coordinatePolicy: restricted` items, the reference rubric or answer key was itself phrased in
coordinate terms ("by coordinates $A(0,0),B(6,0),\dots$ obtain $I(4,6)$"), which penalised compliant
answers for not following the forbidden route. Fixed on 2026-09-19 in two places:

- the affected `rubric` / `answerKey` entries were rewritten to state the geometric quantity and the
  justification, not the route;
- `score.mjs`'s judge prompt now carries an explicit method-neutrality rule — a grader may not
  deduct for the absence of a coordinate system, and may not require the reference route.

Consequence: results produced before this fix are not comparable with results produced after it. The
2026-09-18 run in `benchmark/docs/RESULTS.md` predates it.

---

# Repository Structure

```text
GeoMark/
├── benchmark/
│   ├── items/            the benchmark items themselves (GM-XXXX/, tracked)
│   ├── datasets/         external dataset importers + manifests (items are gitignored —
│   │                     large, and their licences differ from this repository's MIT)
│   ├── tools/            pipeline: fetch → transcribe → build → run → score → summarize
│   ├── docs/             protocol, failure taxonomy, results snapshot, external-dataset review
│   ├── viz/              Remotion video project (needs npm install)
│   ├── results/          run output — gitignored; summaries are republished under /results
│   ├── sources/          raw paper downloads and transcripts — gitignored
│   └── dataset.json      versioned item manifest with per-artifact hashes
├── harness/
│   ├── kernel/           pipeline, store, unified events, config, audit, replay, verify
│   ├── adapters/         declarative provider engine + one spec per protocol
│   ├── surfaces/         web (server + static UI) and CLI
│   ├── tests/            node --test, fully offline
│   ├── tools/            scan-agents.ps1, tracks-selftest.mjs
│   └── docs/             agent inventory
├── docs/reports/         audit reports
├── examples/             sample experiment bundle (mock, clearly labelled)
├── scripts/              convenience wrappers (benchmark.sh, …)
├── results/              placeholder for published run summaries
├── GETTING-STARTED.md / .zh.md / .en.md
├── README.md / README.zh.md
├── LICENSE
└── .gitignore
```

Note what is **not** in a clone: `benchmark/results/` and `benchmark/datasets/*/items/` are
gitignored, so a fresh checkout has the 18 core items but none of the 2,693 imported external items
and no run output other than the committed summaries. Regenerate with
`benchmark/tools/import-*.mjs`.

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

