#!/usr/bin/env bash
# 完整 benchmark 流水线：转图 → 作答 → 评分 → 汇总
# 用法：GM_MODEL=deepseek-flash ./scripts/benchmark.sh
set -e
: "${GM_MODEL:?请先设置 GM_MODEL，例如: GM_MODEL=deepseek-flash}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNID="$GM_MODEL-$(date +%Y%m%d)"
cd "$ROOT"
node benchmark/tools/svg2png.mjs
node benchmark/tools/run-eval.mjs --model "$GM_MODEL" --out "benchmark/results/$RUNID"
node benchmark/tools/score.mjs --run "benchmark/results/$RUNID" --judge-model "$GM_MODEL"
node benchmark/tools/summarize.mjs --run "benchmark/results/$RUNID"
echo "汇总: benchmark/results/$RUNID/summary.md"
