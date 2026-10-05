# GeoMark

[![test](https://github.com/Nolai2010/GeoMark/actions/workflows/test.yml/badge.svg)](https://github.com/Nolai2010/GeoMark/actions/workflows/test.yml)

**An AI geometry-reasoning benchmark**: 25 double-blind geometry problems × 5 independent tracks, rubric-based scoring, built-in cheat detection (secretly using coordinates when forbidden → zeroed).

[English](README.md) | [简体中文](README.zh.md)

## Leaderboard

Full leaderboard and evidence: [LEADERBOARD.md](LEADERBOARD.md)（中文：[LEADERBOARD.zh.md](LEADERBOARD.zh.md)）

| Model | PNG vision | Planar w/ coords | Planar pure | Solid w/ coords | Cheating | Score |
|---|---|---|---|---|---|---|
| deepseek-flash | — | 86% | 0%¹ | 80% | 13 hits | **55.3** |
| deepseek-chat (V3.2) | 37% | 52% | 29% | 83% | 3 hits | **50.2** |
| more models | TBD | TBD | TBD | TBD | — | — |

¹ All 13 coordinate-restricted problems were zeroed: coordinate scratchwork appeared in every chain-of-thought (most raw scores were full marks). CoT makes "secret coordinate checks" impossible to hide.

Three notable numbers (full evidence in [LEADERBOARD.md](LEADERBOARD.md) and the [evaluation report](benchmark/docs/results/lb-deepseek-chat/summary.md)):

- **Reading the figure (37%) is far worse than reading the text (52%)** — models can't really "see" geometry.
- **Banning coordinates drops the average to 29%** — pure geometric reasoning is a disaster zone.
- **3 problems caught by cheat detection**: the problem forbids coordinates, the model secretly sets one up anyway — caught by textual evidence, score zeroed.

## Three evaluation modes

| Mode | Input | Constraint | Measures |
|---|---|---|---|
| vision | **Figure only** (PNG) | Describe, don't solve | Figure understanding |
| coord | Problem + figure | Unrestricted | Full reasoning |
| pure | Problem + figure | **Coordinates forbidden** | Pure geometry |

> **v1 caveat**: coord/pure should ship the figure per protocol; in this round, vision-capable models received it while others got text-only problems (deepseek-flash, due to a mislabeled config flag, now fixed). v1.1 will send figures uniformly in all modes. See [LEADERBOARD.md](LEADERBOARD.md).

Each problem is split into independent conversations (no shared context); conflicting answers are settled by numeric adjudication (exact coordinate recomputation) before the reference answer is fixed.

## Quick Start

Node.js ≥ 22, zero runtime dependencies, no `npm install`:

```bash
node harness/surfaces/web/server.mjs                 # Web UI → http://127.0.0.1:7788
node benchmark/tools/run-eval.mjs --model <id>       # run evaluation
node benchmark/tools/score.mjs --run <runid>         # score (rubric + cheat detection)
node benchmark/tools/summarize.mjs --run <runid>     # aggregate leaderboard
```

Configure your API key via the Web UI or `harness/config/secrets.json`. New here? See [`GETTING-STARTED.en.md`](GETTING-STARTED.en.md).

## Docs

- Evaluation protocol: [`benchmark/docs/EVALUATION-PROTOCOL.md`](benchmark/docs/EVALUATION-PROTOCOL.md)
- Items & dataset: [`benchmark/README.md`](benchmark/README.md)
- 中文版：[`README.zh.md`](README.zh.md)
- AI coding agents (Claude Code, Cursor, Codex, Gemini CLI, ...): [`AGENTS.md`](AGENTS.md)

## License

MIT
