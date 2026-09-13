# results / 评测结果

本目录存放 benchmark 流水线的运行输出（`run-eval` / `score` / `summarize` 的 `--out` 目标）。

- 目录已被 git 忽略：评测数据（含原始作答）默认留在本机，不入仓库。
- 对外发布时，请只提交 `summary.md / summary.csv / summary.json` 与 `run-manifest.json`，并注明模型、judge 与 temperature。

结构：

```text
results/<runid>/
├── GM-XXXX__<mode>.answer.md     模型原始作答
├── GM-XXXX__<mode>.prompt.json   实际提示词（promptHash 可复核）
├── GM-XXXX__<mode>.meta.json     请求元数据（模型/时间戳/usage）
├── scores/GM-XXXX__<mode>.score.json  rubric 逐项得分
├── run-manifest.json             本次运行清单
└── summary.md / .csv / .json     对比表
```
