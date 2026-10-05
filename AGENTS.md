# AGENTS.md — GeoMark

Instructions for AI coding agents working in this repository. This is the single source of truth; tool-specific rule files (CLAUDE.md, .cursor/, GEMINI.md, ...) are thin pointers to this file.

## Project overview

GeoMark is an AI geometry-reasoning benchmark + model-agnostic harness.

- `benchmark/items/GM-*` — problem bank (25 core items): `problem.md`, `solution.md`, `meta.json` (rubric, coordinatePolicy, figure), `assets/` (PNG figures)
- `benchmark/tools/` — pipeline: `run-eval.mjs` (generate answers) → `score.mjs` (LLM-judge + cheat audit) → `summarize.mjs` (leaderboard aggregation)
- `harness/` — model-agnostic agent harness (web UI, CLI), zero runtime dependencies, Node ≥ 22, no `npm install`
- `LEADERBOARD.md` (EN) / `LEADERBOARD.zh.md` (ZH) — public leaderboard, hand-maintained; charts are `docs/leaderboard-v1*.svg`
- `benchmark/docs/results/<runid>/` — committed evaluation summaries (the `benchmark/results/` working directory is gitignored)

## Hard rules

1. **Node ≥ 22, zero runtime deps.** Never add `npm install` requirements to the harness or benchmark tools.
2. **`benchmark/results/` is gitignored.** Committed report copies live in `benchmark/docs/results/<runid>/summary.{md,csv,json}` — update them (copy from results/) whenever a run's summary changes.
3. **Cheating rules (scoring pipeline):** `cfm` (fenced code blocks) is audited on the **final answer only** — CoT fences are internal scratch work. `coordinates` / `websearch` / `skillplugin` are audited on **thinking + answer** (coordinate scratchwork in thinking IS a violation for pure-mode problems, user decision 2026-10-05). Violation → score 0, raw score preserved for review.
4. **Empty answers are skipped, never scored 0** (unsupported modes), see `score.mjs`.
5. **Reasoning models need big token budgets:** default `--max-tokens 32768` for thinking models (8192 gets eaten by CoT; hard problems may need 65536).
6. **Tests must stay data-driven** (`harness/tests/*.test.mjs`): never hardcode item counts or track summaries; recompute from `dataset.json` / manifest.
7. **Bilingual docs:** `README.md`/`LEADERBOARD.md` are English (canonical), `README.zh.md`/`LEADERBOARD.zh.md` are Chinese. Keep both in sync; leaderboard layout convention = table → SVG chart → `<sub>` small-print caveats → findings. No checkmarks, pricing, or adjectives in model rosters; one row per vendor.
8. **Numeric adjudication discipline:** when two LLM answers conflict, settle with exact coordinate computation; geometry scripts must pass an identity self-check before their output is trusted (e.g. AF·AE = 2AH·AG).

## Common commands

```bash
node harness/surfaces/web/server.mjs                  # web UI → http://127.0.0.1:7788
cd harness && npm test                                # offline test suite
node benchmark/tools/run-eval.mjs --model <id> --modes vision,coord,pure [--resume] [--max-tokens 32768]
node benchmark/tools/score.mjs --run benchmark/results/<runid> --judge-model deepseek-chat --concurrency 6
node benchmark/tools/summarize.mjs --run benchmark/results/<runid>
```

`--resume` skips existing non-empty answers (cost-safe re-runs). API keys: `harness/config/secrets.json` (gitignored) or env vars. Model registry: `harness/config/models.json` (gitignored; `supports_vision` must be accurate — it controls whether figures are sent).

## Score-audit discipline

Before trusting a full scoring run, spot-check 2-3 audits: if the judge's own reason text says "no violation" but the record is zeroed, a regex override is masking the judge — fix the rule before re-running anything (burned-budget lesson, 2026-10-05).

## Which tools read what

| Tool(s) | File | Status |
|---|---|---|
| Codex CLI, OpenCode, Zed, Qoder, Devin, Factory, goose | `AGENTS.md` | native |
| Claude Code, CodeBuddy/WorkBuddy | `CLAUDE.md` | pointer → this file |
| Gemini CLI | `GEMINI.md` | pointer → this file |
| GitHub Copilot | `.github/copilot-instructions.md` | pointer |
| Cursor | `.cursor/rules/geomark.mdc` | pointer |
| Windsurf | `.windsurf/rules/geomark.md` | pointer |
| Cline | `.clinerules` | pointer |
| Roo Code | `.roorules` | pointer |
| Aider | `.aider.conf.yml` | `read: AGENTS.md` |
| Amazon Q Developer | `.amazonq/rules/geomark.md` | pointer |
| Augment | `.augment/rules/geomark.md` | pointer |
| Qoder (IDE rules) | `.qoder/rules/geomark.md` | pointer |
| Trae | `.trae/rules/geomark.md` | pointer |

Chat platforms without repo-level rule files (Coze/Dify builders, office suites, etc.): paste `AGENTS.md` content into their knowledge/system-prompt settings when relevant.
