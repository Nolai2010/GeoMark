# GeoMark

[![test](https://github.com/Nolai2010/GeoMark/actions/workflows/test.yml/badge.svg)](https://github.com/Nolai2010/GeoMark/actions/workflows/test.yml)

**AI 几何推理评测基准**：25 道全双盲几何题 × 5 个独立轨道，rubric 逐项评分，内置作弊检测（禁止建系仍建系 → 归零）。

[English](README.md) | [简体中文](README.zh.md)

## 榜单

完整榜单与证据：[LEADERBOARD.zh.md](LEADERBOARD.zh.md)（English: [LEADERBOARD.md](LEADERBOARD.md)）

| 模型 | PNG识图 | 平面可建系 | 平面纯几何 | 立体可建系 | 作弊归零 | 总分 |
|---|---|---|---|---|---|---|
| deepseek-flash | — | 86% | 0%¹ | 80% | 13 题 | **55.3** |
| deepseek-chat (V3.2) | 37% | 52% | 29% | 83% | 3 题 | **50.2** |
| 更多模型 | 待测 | 待测 | 待测 | 待测 | — | — |

¹ 13 道禁建系题的思维链里全部出现坐标草稿（多数原始分满分），按规则全数归零——思维链让「偷跑坐标校验」无处遁形。

几个值得注意的数字（完整证据见 [LEADERBOARD.md](LEADERBOARD.md) 与[评测报告](benchmark/docs/results/lb-deepseek-chat/summary.md)）：

- **看图做（37%）远差于读题做（52%）** —— 模型"看不懂"几何图。
- **禁用坐标法后均分跌至 29%** —— 纯几何推理是灾难区。
- **3 题被作弊检测抓到**：题目明确禁止建系，模型仍偷偷建立坐标系，文本证据坐实，总分归零。

## 三种评测模式

| 模式 | 输入 | 约束 | 考察 |
|---|---|---|---|
| vision | **仅配图** PNG | 不得解题，只复述 | 图形理解 |
| coord | 题面 + 配图 | 无限制 | 完整推理 |
| pure | 题面 + 配图 | **禁止坐标法** | 纯几何能力 |

> **v1 口径提示**：coord/pure 按协议应发送配图；本轮实测中支持图像的模型收到了配图，不支持图像输入的模型仅收到文字题干（如 deepseek-flash，配置误标已修正）。v1.1 将统一全部模式发图。详见 [LEADERBOARD.zh.md](LEADERBOARD.zh.md)。

同一道题拆成独立对话分别作答（上下文不互通），答案冲突时先数值仲裁（精确坐标计算复核）再定标准答案。

## Quick Start

Node.js ≥ 22，零运行时依赖，无需 `npm install`：

```bash
node harness/surfaces/web/server.mjs                 # Web UI → http://127.0.0.1:7788
node benchmark/tools/run-eval.mjs --model <id>       # 跑评测
node benchmark/tools/score.mjs --run <runid>         # 评分（rubric + 作弊检测）
node benchmark/tools/summarize.mjs --run <runid>     # 汇总榜单
```

API 密钥通过 Web UI 或 `harness/config/secrets.json` 配置。新手教程：[`GETTING-STARTED.zh.md`](GETTING-STARTED.zh.md)。

## 文档

- 评测协议：[`benchmark/docs/EVALUATION-PROTOCOL.md`](benchmark/docs/EVALUATION-PROTOCOL.md)
- 题库与数据集：[`benchmark/README.md`](benchmark/README.md)
- 英文版：[`README.md`](README.md)
- AI 编码工具（Claude Code、Cursor、Codex、Gemini CLI 等）：[`AGENTS.md`](AGENTS.md)

## License

MIT
