# GeoMark Harness 新手教程 / Getting Started

> 10 分钟上手：用 Web 界面或命令行，把不同模型放进**完全相同**的实验条件下对比。
> English quick version at the bottom.

---

## 0. 准备（Prerequisites）

- Node.js ≥ 18（推荐 22）
- 一个模型的 API 密钥（如 DeepSeek / OpenAI / Anthropic，任一即可）

```bash
git clone https://github.com/Nolai2010/GeoMark.git
cd GeoMark/harness
npm test        # 应显示 103/103 通过（零依赖，无需 npm install）
```

---

## 1. Web 客户端（推荐新手）

### 启动

```bash
node surfaces/web/server.mjs
# 打开 http://127.0.0.1:7788
```

### 三步跑通第一轮实验

1. **配密钥**：右上角「API 密钥」→ 粘贴密钥 → 保存。
   密钥只存本机 `config/secrets.json`（已被 git 忽略），绝不上传、不入日志。
2. **加模型**：左侧「管理模型」→ 从预设（DeepSeek / Qwen / Kimi / MiniMax / ChatGLM / OpenAI / Anthropic）选一个 → 按需改模型 ID → **测试连接** → 保存。
   也可以完全自定义接口（协议 / 地址 / 接口路径 / 请求头 / Extra Body）。
3. **对话即实验**：左侧选模型、填系统提示词（可留空）、输入问题 → 发送。
   默认勾选「保存实验」——每轮对话都会生成一个可复现的实验包。

### 看懂结果

- 回答下方指标行：**结束原因 / 首词元延迟（TTFT）/ 总耗时 / 输入输出词元**
- 右栏「实验记录」→ 点「详情」：
  - **模型实际看到的输入**（渲染后的最终 prompt，一字不差）
  - **请求元数据**（实际发送的 HTTP 请求，密钥已脱敏）
  - **完整性校验**（SHA-256 哈希链，任何改动都会暴露）
- 「对比实验」玩法：换一个模型、**保持输入与配置一致**再跑一遍——两份记录的输入逐字节一致，这就是本工具的意义。

### 其它

- 顶栏 **EN**：切换中文 / English 界面（中文为默认）。
- 顶栏 **主题**：亮色 / 暗色 / 跟随系统。
- 上传 `.txt` / `.md` 附件：文件内容会显式进入该条消息，模型真实读取（实验详情里可核对）。

---

## 2. 命令行（CLI）

```bash
# 列出已配置的模型
node surfaces/cli/cli.mjs --list-models

# 普通对话
node surfaces/cli/cli.mjs --model deepseek-flash "简单介绍一下你自己"

# 完整实验（保存实验包，输出路径会打印在末尾）
node surfaces/cli/cli.mjs --model deepseek-flash --experiment "证明：B、E、F 三点共线" \
     --system "你是严谨的数学助手" --temperature 0 --max-tokens 2048

# 带附件
node surfaces/cli/cli.mjs --model deepseek-flash --file 题目.txt --experiment "请解题"

# 校验某个实验包是否被改动过（离线即可）
node surfaces/cli/cli.mjs --verify experiments/exp-XXXX

# 回放某次实验的事件流
node surfaces/cli/cli.mjs --replay experiments/exp-XXXX
```

常用参数：`--system` 系统提示词 · `--temperature` · `--max-tokens` · `--reasoning` / `--effort` / `--budget`（推理）· `--file`（附件，可多次）

---

## 3. 命令行方式配置密钥（可选）

Web 界面配置即可满足大多数场景；CI / 服务器场景用环境变量：

```bash
export HARNESS_OPENAI_API_KEY=sk-…      # OpenAI Compatible 协议
export HARNESS_ANTHROPIC_API_KEY=sk-ant-…  # Anthropic 协议
```

也可以编辑 `config/secrets.json`（参照 `config/secrets.example.json`）：

```json
{
  "providers": { "openai-compatible": "YOUR_API_KEY", "anthropic": "YOUR_API_KEY" },
  "models": { "my-model-id": "YOUR_API_KEY" }
}
```

优先级：环境变量 > 模型级（models）> 协议级（providers）。

---

## 4. AI 几何能力评测流水线（Benchmark）

`benchmark/` 内置 10 道题（平面几何 5 + 立体几何 5），每题含题面、SVG→PNG 配图、**分步评分细则**。三种评测模式：**纯识图**（只看图复述）、**可建系**（允许坐标法）、**不可建系**（纯几何证明）。

```bash
# 1) SVG 批量转 PNG（AI 只看图作答，防止读 SVG 源码"作弊"；SVG 保留作评分参照）
node benchmark/tools/svg2png.mjs

# 2) 三模式作答（--model 用 models.json 里的 id）
node benchmark/tools/run-eval.mjs --model deepseek-flash --out benchmark/results/run1

# 3) 评分：judge 模型对照评分细则逐项打分
node benchmark/tools/score.mjs --run benchmark/results/run1 --judge-model deepseek-flash

# 4) 生成对比表（summary.md / .csv / .json）
node benchmark/tools/summarize.mjs --run benchmark/results/run1
```

> 公平性保证：作答阶段**结构性禁止**读取 solution.md（代码中不存在该读取路径，dry-run 泄漏扫描为 0）；每个请求记录 promptHash + temperature + 时间戳，结果可复现可审计。

**渲染结果动效视频（Remotion）：**

```bash
cd benchmark/viz && npm i
npx remotion render index.jsx BenchmarkResults GeoMark-Benchmark.mp4 \
    --props ../results/run1/summary.json
```

---

## 5. 实验包里有什么？

```text
experiments/exp-…/
├── config.json      请求配置（含推理参数与来源标记）
├── prompt.txt       用户提示词
├── files/           附件（唯一存储名 + 原始字节 + SHA-256）
├── request.json     适配器实际发送的 HTTP 请求（密钥已脱敏）+ 实际生效配置
├── events.jsonl     哈希链密封的统一事件流
├── raw/response.sse 服务端原始字节流
├── result.json      最终回答 / 词元 / TTFT / 完成状态 / 渲染后的消息
└── manifest.json    版本三元组（Harness / 适配器规范哈希 / 运行时）
```

---

## 6. 常见问题（FAQ）

| 现象 | 处理 |
|---|---|
| HTTP 401 | 密钥无效或未配置 → 检查「API 密钥」/ `secrets.json` |
| HTTP 400 且提示模型名 | 模型 ID 不被服务端支持 → 「管理模型」里编辑模型 ID |
| HTTP 429 | 触发限流 → 等待或换模型；Harness **不会**自动重试 429（保护实验条件） |
| 开推理后回答为空 | 思考过程消耗词元 → 调大「最大词元数」（建议 ≥1024） |
| 换了配置想重新跑 | 新开一轮即可；两轮记录的配置差异都在 `request.json` 里 |

---

## English (quick version)

1. `node surfaces/web/server.mjs` → open `http://127.0.0.1:7788`
2. Top-right **API Keys** → paste your key. **Manage Models** → pick a preset → **Test Connection** → Save.
3. Type a prompt → Send. Every turn is saved as a reproducible experiment bundle (hash-chained, tamper-evident).
4. CLI: `node surfaces/cli/cli.mjs --model <id> --experiment "your prompt"`; verify with `--verify <bundle>`.
5. Benchmark pipeline: `svg2png` → `run-eval` (vision / coordinate / pure-geometry modes) → `score` (rubric-based LLM judge) → `summarize`; render the MP4 with Remotion (`cd benchmark/viz && npm i && npx remotion render index.jsx BenchmarkResults out.mp4 --props ../results/<runid>/summary.json`).

> Model-agnostic guarantee: the harness never injects model-specific prompts, tools or hidden instructions. Whatever a model sees is recorded byte-for-byte in the bundle.
