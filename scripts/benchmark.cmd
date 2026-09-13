@echo off
rem 完整 benchmark 流水线：转图 → 作答 → 评分 → 汇总
rem 用法：set GM_MODEL=deepseek-flash && scripts\benchmark.cmd
if "%GM_MODEL%"=="" ( echo 请先设置 GM_MODEL，例如: set GM_MODEL=deepseek-flash & exit /b 1 )
set ROOT=%~dp0..
set RUNID=%GM_MODEL%-%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%
cd /d "%ROOT%"
node benchmark/tools/svg2png.mjs || exit /b 1
node benchmark/tools/run-eval.mjs --model %GM_MODEL% --out benchmark/results/%RUNID% || exit /b 1
node benchmark/tools/score.mjs --run benchmark/results/%RUNID% --judge-model %GM_MODEL% || exit /b 1
node benchmark/tools/summarize.mjs --run benchmark/results/%RUNID%
echo 汇总: benchmark\results\%RUNID%\summary.md
