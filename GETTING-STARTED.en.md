# Getting Started (English)

> GeoMark Harness — a model-agnostic experiment environment: put different models under **exactly the same** conditions and compare.
> 简体中文教程：[GETTING-STARTED.zh.md](GETTING-STARTED.zh.md)

---

## 0. Prerequisites

- Node.js ≥ 22 (enforced by harness/package.json engines; 18 fails with EBADENGINE)
- An API key for any supported provider (DeepSeek / OpenAI / Anthropic / Qwen / Kimi …)

```bash
git clone https://github.com/Nolai2010/GeoMark.git
cd GeoMark/harness
npm test        # expect 114/114 passed (zero dependencies, no npm install needed)
```

---

## 1. Web Client (recommended)

### Start

```bash
node surfaces/web/server.mjs
# open http://127.0.0.1:7788
```

### Three steps to your first experiment

1. **API key**: top-right **API Keys** → paste your key → Save.
   Keys are stored only in local `config/secrets.json` (git-ignored). Never uploaded, never logged, never written into experiment records.
2. **Add a model**: left panel **Manage Models** → pick a preset (DeepSeek / Qwen / Kimi / MiniMax / ChatGLM / OpenAI / Anthropic) → adjust the model ID → **Test Connection** → Save.
   Fully custom endpoints are supported too: protocol / base URL / endpoint path / per-model key / extra body (JSON).
3. **Chat = experiment**: pick a model, optionally set a system prompt, temperature and max tokens → type a question → Send.
   "Save experiment" is on by default: every turn produces a reproducible experiment bundle.

### Reading the results

- The metrics line under each answer: **finish reason / TTFT / total time / input & output tokens**
- Right panel **Experiment Records** → click **Details** to see:
  - **System prompt (verbatim, as sent to the model)**
  - **What the model actually saw** (the fully rendered prompt)
  - **Effective configuration** and **the actual HTTP request** (keys redacted)
  - **Integrity verification** (SHA-256 hash chain — any tampering is exposed)
- **Comparison runs**: switch to another model, keep inputs and configuration identical, run again. The "what the model actually saw" section is byte-for-byte identical across runs — any difference in answers can only come from the model itself. That is the whole point of this tool.

### Other features

- Top bar **中文**: switch to the Chinese interface (Chinese is the default).
- Top bar **Theme**: light / dark / follow system.
- **Attachments**: `.txt` / `.md` files are explicitly attached to the message and actually read by the model (verifiable in the bundle).
- **Chat history**: last 30 conversations auto-saved locally; refresh-safe, restorable, renameable.

---

## 2. CLI

```bash
# list configured models
node surfaces/cli/cli.mjs --list-models

# plain chat (no bundle)
node surfaces/cli/cli.mjs --model deepseek-flash "Introduce yourself briefly"

# full experiment (saves a bundle; path printed at the end)
node surfaces/cli/cli.mjs --model deepseek-flash --experiment "Prove: B, E, F are collinear" \
     --system "You are a rigorous math assistant" --temperature 0 --max-tokens 2048

# with attachments (--file repeatable)
node surfaces/cli/cli.mjs --model deepseek-flash --file problem.txt --experiment "Solve it"

# reasoning (choose the style your provider supports)
node surfaces/cli/cli.mjs --model deepseek-flash --reasoning --experiment "…"

# verify a bundle offline (tamper check)
node surfaces/cli/cli.mjs --verify experiments/exp-XXXX

# replay the unified event stream of a bundle
node surfaces/cli/cli.mjs --replay experiments/exp-XXXX
```

Common flags: `--system` · `--temperature` · `--max-tokens` · `--reasoning` / `--effort` / `--budget` · `--file`

---

## 3. API keys via environment (optional)

The web UI is enough for most cases; for CI / servers use environment variables:

```bash
export HARNESS_OPENAI_API_KEY=sk-…         # OpenAI-compatible protocol
export HARNESS_ANTHROPIC_API_KEY=sk-ant-…  # Anthropic protocol
```

Or edit `config/secrets.json` (see `config/secrets.example.json`; **never commit real keys**):

```json
{
  "providers": { "openai-compatible": "YOUR_API_KEY", "anthropic": "YOUR_API_KEY" },
  "models":    { "my-model-id": "YOUR_API_KEY" }
}
```

Precedence: environment variable > model-scoped (models) > provider-scoped (providers).

---

## 4. AI Geometry Benchmark Pipeline

`benchmark/` ships 18 geometry items (Benchmark v0.1). Each item has `problem.md`, `assets/` (PNG figures) and `solution.md` with a **step-by-step scoring rubric**. Eight are tagged `plane_geometry`; the other ten fall under a generic `geometry` category and include five solid-geometry items. Sixteen have a figure; eight have a `visionRubric` (the rest are skipped in vision mode rather than scored). Three evaluation modes:

| Mode | Description |
|---|---|
| vision | Only the figure is sent; the model describes what it sees |
| coordinate | Full problem + figure; coordinate systems allowed |
| pure geometry | Full problem + figure; coordinate systems forbidden |

**Fairness guarantee**: the answering stage structurally cannot read `solution.md` (no such code path exists; dry-run leak scan = 0). Every request records promptHash + temperature + timestamp.

```bash
# 1) batch SVG -> PNG (models see images; SVGs kept as scoring reference)
node benchmark/tools/svg2png.mjs

# 2) run all items in all modes (--model is an id from models.json)
node benchmark/tools/run-eval.mjs --model deepseek-flash --out benchmark/results/run1

# 3) scoring: an LLM judge grades each rubric line
node benchmark/tools/score.mjs --run benchmark/results/run1 --judge-model deepseek-flash

# 4) comparison table: summary.md / .csv / .json
node benchmark/tools/summarize.mjs --run benchmark/results/run1

# 5) render the results animation (Remotion; first time: cd benchmark/viz && npm i)
cd benchmark/viz
npx remotion render index.jsx BenchmarkResults GeoMark-Benchmark.mp4 \
    --props ../results/run1/summary.json
```

**Cross-model comparison**: add a second model in Manage Models, run `run-eval` with a different `--out` directory, score both, and merge the summaries.

---

## 5. What's inside an experiment bundle?

```text
experiments/exp-…/
├── config.json      request configuration (incl. reasoning params and their source)
├── prompt.txt       the user prompt
├── files/           attachments (unique stored names + raw bytes + SHA-256)
├── request.json     the HTTP request actually sent (keys redacted) + effective config
├── events.jsonl     hash-chained unified event stream
├── raw/response.sse raw provider bytes
├── result.json      final answer / tokens / TTFT / completion state / rendered messages
└── manifest.json    version triple (harness version / adapter spec hash / runtime)
```

See `examples/sample-experiment/` in the repository for a structural sample.

---

## 6. FAQ

| Symptom | Fix |
|---|---|
| HTTP 401 | Key invalid or missing → check "API Keys" / `secrets.json` |
| HTTP 400 about the model name | Model ID rejected by the provider → edit it in Manage Models |
| HTTP 429 | Rate-limited → wait or switch models; the harness never auto-retries 429 (protects experimental conditions) |
| Empty answer with reasoning on | Thinking consumes tokens → raise "Max tokens" (≥1024 recommended) |
| Chat history gone in another browser | History lives in the browser's localStorage; experiment bundles on disk are unaffected |
| Port already in use | `HARNESS_PORT=8080 node surfaces/web/server.mjs` |
