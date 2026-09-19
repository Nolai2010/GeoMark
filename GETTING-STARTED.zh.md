# 新手教程（简体中文）

> GeoMark Harness —— 模型无关的 AI 实验环境：把不同模型放进**完全相同**的条件下对比。
> English version: [GETTING-STARTED.en.md](GETTING-STARTED.en.md)

---

## 0. 准备

- Node.js ≥ 22（harness/package.json 的 engines 强制 ≥22，用 18 会报 EBADENGINE）
- 任一模型的 API 密钥（DeepSeek / OpenAI / Anthropic / Qwen / Kimi 均可）

```bash
git clone https://github.com/Nolai2010/GeoMark.git
cd GeoMark/harness
npm test        # 应显示 114/114 通过（项目零依赖，无需 npm install）
```

---

## 1. Web 客户端（推荐新手）

### 启动

```bash
node surfaces/web/server.mjs
# 浏览器打开 http://127.0.0.1:7788
```

### 三步跑通第一轮实验

1. **配密钥**：右上角「API 密钥」→ 粘贴密钥 → 保存。
   密钥只存本机 `config/secrets.json`（已被 git 忽略），绝不上传、不入日志、不入实验记录。
2. **加模型**：左侧「管理模型」→ 顶部「已有模型」下拉可编辑既有配置；从预设（DeepSeek / Qwen / Kimi / MiniMax / ChatGLM / OpenAI / Anthropic）选一个 → 按需修改模型 ID → **测试连接** → 保存。
   也支持完全自定义接口：协议类型 / API 地址 / 接口路径 / API 密钥 / Extra Body（JSON）。
3. **对话即实验**：左侧选模型、按需填系统提示词与温度/最大词元数 → 输入问题 → 发送。
   默认勾选「保存实验」，每轮对话自动生成可复现的实验包。

### 看懂结果

- 回答下方的指标行：**结束原因 / 首词元延迟（TTFT）/ 总耗时 / 输入输出词元**
- 右栏「实验记录」→ 点「详情」可看到：
  - **系统提示词（发送给模型的原文）**
  - **模型实际看到的输入**（渲染后的最终 prompt，逐字保真）
  - **实际生效配置** 与 **实际发送的 HTTP 请求**（密钥已脱敏）
  - **完整性校验**（SHA-256 哈希链，任何篡改都会暴露）
- **对比实验**：换一个模型、保持输入与配置一致再跑一遍。两份记录的"模型实际看到的输入"逐字节一致——差异只能来自模型本身，这正是本工具的价值。

### 其它功能

- 顶栏 **EN**：切换中文 / English 界面（中文为默认）。
- 顶栏 **主题**：亮色 / 暗色 / 跟随系统。
- **上传附件**：支持 `.txt` / `.md` 等文本文件，内容会显式进入该条消息，模型真实读取（可在实验详情里核对原文）。
- **对话记录**：自动保存最近 30 条，刷新页面回到上次对话，可恢复 / 重命名 / 删除。

---

## 2. 命令行（CLI）

```bash
# 列出已配置的模型
node surfaces/cli/cli.mjs --list-models

# 普通对话（不留档）
node surfaces/cli/cli.mjs --model deepseek-flash "简单介绍一下你自己"

# 完整实验（保存实验包，路径打印在输出末尾）
node surfaces/cli/cli.mjs --model deepseek-flash --experiment "证明：B、E、F 三点共线" \
     --system "你是严谨的数学助手" --temperature 0 --max-tokens 2048

# 带附件（可多次 --file）
node surfaces/cli/cli.mjs --model deepseek-flash --file 题目.txt --experiment "请解题"

# 开启推理（按模型支持情况选择风格）
node surfaces/cli/cli.mjs --model deepseek-flash --reasoning --experiment "…"

# 离线校验某个实验包是否被改动过
node surfaces/cli/cli.mjs --verify experiments/exp-XXXX

# 回放某次实验的统一事件流
node surfaces/cli/cli.mjs --replay experiments/exp-XXXX
```

常用参数：`--system` 系统提示词 · `--temperature` · `--max-tokens` · `--reasoning` / `--effort` / `--budget`（推理）· `--file`（附件）

---

## 3. 密钥配置（命令行方式，可选）

Web 界面配置即可满足大多数场景；CI / 服务器场景用环境变量：

```bash
export HARNESS_OPENAI_API_KEY=sk-…         # OpenAI Compatible 协议
export HARNESS_ANTHROPIC_API_KEY=sk-ant-…  # Anthropic 协议
```

或编辑 `config/secrets.json`（参照 `config/secrets.example.json`，**不要提交真实密钥**）：

```json
{
  "providers": { "openai-compatible": "YOUR_API_KEY", "anthropic": "YOUR_API_KEY" },
  "models":    { "my-model-id": "YOUR_API_KEY" }
}
```

优先级：环境变量 > 模型级（models）> 协议级（providers）。

---

## 4. AI 几何能力评测流水线（Benchmark）

`benchmark/` 内置 18 道几何题（Benchmark v0.1），每题三件套：`problem.md`（题面）、`assets/`（PNG 配图）、`solution.md`（含分步评分细则）。其中 8 道标注为 `plane_geometry`，其余 10 道归入通用 `geometry` 类（含 5 道立体几何）；16 道有配图，8 道有 `visionRubric`（其余在识图模式下跳过而非计分）。评测分三种模式：

| 模式 | 说明 |
|---|---|
| 纯识图 | 只把配图发给模型，复述图中内容（考察识图能力） |
| 可建系 | 完整题面 + 配图，允许建立坐标系求解 |
| 不可建系 | 完整题面 + 配图，禁止坐标，须用纯几何综合法 |

**公平性保证**：作答阶段结构性禁止读取 `solution.md`（代码中不存在该读取路径，dry-run 泄漏扫描为 0）；每次请求记录 promptHash + temperature + 时间戳。

```bash
# 1) SVG 批量转 PNG（AI 只看图作答；SVG 保留作评分参照）
node benchmark/tools/svg2png.mjs

# 2) 三模式作答（--model 取 models.json 中的 id）
node benchmark/tools/run-eval.mjs --model deepseek-flash --out benchmark/results/run1

# 3) 评分：judge 模型对照评分细则逐项打分（LLM-as-judge）
node benchmark/tools/score.mjs --run benchmark/results/run1 --judge-model deepseek-flash

# 4) 生成对比表 summary.md / .csv / .json
node benchmark/tools/summarize.mjs --run benchmark/results/run1

# 5) 渲染结果动效视频（Remotion，首次需 cd benchmark/viz && npm i）
cd benchmark/viz
npx remotion render index.jsx BenchmarkResults GeoMark-Benchmark.mp4 \
    --props ../results/run1/summary.json
```

**换模型对比**：在「管理模型」中添加第二个模型，然后对同一个 `--out` 目录分别执行 `run-eval`（注意换目录或对比两个 run），最后合并评分即可得到跨模型对比表。

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
└── manifest.json    版本三元组（Harness 版本 / 适配器规范哈希 / 运行时）
```

示例结构见仓库 `examples/sample-experiment/`。

---

## 6. 常见问题（FAQ）

| 现象 | 处理 |
|---|---|
| HTTP 401 | 密钥无效或未配置 → 检查「API 密钥」/ `secrets.json` |
| HTTP 400 提示模型名 | 模型 ID 不被服务端支持 → 「管理模型」里编辑模型 ID |
| HTTP 429 | 限流 → 等待或换模型；Harness 不会自动重试 429（保护实验条件） |
| 开推理后回答为空 | 思考过程消耗词元 → 调大「最大词元数」（建议 ≥1024） |
| 换浏览器后对话记录消失 | 对话记录存本机浏览器 localStorage；实验包在服务器磁盘不受影响 |
| 端口被占用 | `HARNESS_PORT=8080 node surfaces/web/server.mjs` |
