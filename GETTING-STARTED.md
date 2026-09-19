# 新手教程（Getting Started）

> 请选择语言 / Choose your language:
>
> - **[简体中文教程 → GETTING-STARTED.zh.md](GETTING-STARTED.zh.md)**
> - **[English tutorial → GETTING-STARTED.en.md](GETTING-STARTED.en.md)**

## 30 秒快速开始 / 30-second quick start

```bash
git clone https://github.com/Nolai2010/GeoMark.git
cd GeoMark/harness
npm test                              # 应显示 114/114 passed（零依赖）
node surfaces/web/server.mjs          # 打开 http://127.0.0.1:7788
```

打开网页后：右上角 **API 密钥** 填入密钥 → **管理模型** 从预设选择并测试连接 → 输入问题发送。每一轮对话都会自动保存为可复现的实验包。

Open the web page: paste your **API key** (top-right) → **Manage Models** → pick a preset → send a prompt. Every turn is saved as a reproducible experiment bundle.

## 命令行 / CLI

```bash
node surfaces/cli/cli.mjs --list-models
node surfaces/cli/cli.mjs --model <id> --experiment "你的问题"
node surfaces/cli/cli.mjs --verify experiments/exp-XXXX   # 离线校验完整性
```

## AI 几何评测流水线 / Benchmark pipeline

```bash
node benchmark/tools/svg2png.mjs                                   # SVG → PNG
node benchmark/tools/run-eval.mjs  --model <id> --out benchmark/results/run1
node benchmark/tools/score.mjs     --run benchmark/results/run1 --judge-model <id>
node benchmark/tools/summarize.mjs --run benchmark/results/run1    # 对比表
```

详细说明、常见问题与实验包结构见对应语言教程。
