# GeoMark Harness

模型无关（Model-Agnostic）的 AI Agent 实验运行环境。目标不是让 Agent 更强，而是让 Harness 更**中立、透明、可复现、可审计**。

当前版本：**v0.6.0**（`package.json` 为准）。

## 架构

```
统一请求 makeRequest()
      │
      ▼
kernel/pipeline.mjs ──── 文件显式读取(事件化, fail-closed)
      │                   渲染唯一模板 → 冻结+哈希快照(中立卫兵)
      ▼
adapters/index.mjs → specs/*.json（声明式协议规范）
      │               adapters/engine.mjs（通用解释引擎，无任何模型分支）
      ▼
Provider API (SSE)
      │
      ▼
统一事件 (message_start/delta, reasoning_start/delta,
          file_read_start/end, message_end, error)
      │
      ├── EventChain 逐事件哈希成链 (kernel/audit.mjs)
      ├── ExperimentStore 落盘实验包 (kernel/store.mjs)
      └── verify.mjs 独立校验 / replay.mjs 离线重放

表面：surfaces/web（HTTP+SSE+静态UI） 与 surfaces/cli 共享同一内核
```

## 实验包布局（一次运行 = 一个可审计目录）

```
experiments/exp-<时间戳>-<请求ID>/
├── config.json      完整请求配置（自动脱敏，绝无密钥）
├── prompt.txt       最终用户 Prompt 原文
├── files/           输入文件逐字节副本
├── request.json     适配器实际发送的 HTTP 请求（脱敏）+ 实际生效配置
├── events.jsonl     哈希链密封的统一事件流
├── raw/response.sse provider 原始字节流（用于离线重放）
├── result.json      回答/思考/耗时/Token/状态/渲染后消息
└── manifest.json    每个产物的 SHA-256 + 链根
```

第三方复现三步：

```bash
node surfaces/cli/cli.mjs --verify experiments/exp-xxx   # 1. 完整性校验
node surfaces/cli/cli.mjs --replay experiments/exp-xxx   # 2. 离线重放
# 3. 对照 config.json + result.json.renderedMessages 核对"模型到底看到了什么"
```

## 中立性承诺（对应需求 1-8、十四）

- Adapter 只做协议转换：一切 provider 知识都在 `specs/*.json`，审一张表即可；引擎无模型分支。
- 运行时卫兵：渲染后的输入被 `deepFreeze` + SHA-256 快照，适配器返回后强制比对，任何修改即失败（有测试证明）。
- 统一 System Prompt：所有模型收到逐字节相同内容；不注入任何隐藏指令（全库扫描验证）。
- 不伪造事件：模型没有 reasoning 流就绝无 `reasoning_delta`（有测试证明）。
- 不检测模型能力、不按模型名改变行为；`supports_reasoning` 仅为用户声明的 UI 提示。
- 全程不引入 Skills/Plugins/MCP/联网/代码执行/Shell/浏览器等外部能力，Harness 本体零依赖。
- GeoMark 几何评测是使用场景而非代码：核心零几何/数学专用逻辑。

## 能力边界

只提供：原生 reasoning 透传、流式对话、显式文件读取（文本类；PDF 为元数据模式）、实验记录、双表面（Web/CLI）。
明确不做：见需求第三节全部禁项。未来扩展必须以独立实验模块实现，不进核心。

## 已知限制

- PDF 只读元数据（零依赖约束下的刻意取舍）；建议转 .txt/.md 保证各模型输入逐字节一致。
- `max_tokens` 对 Anthropic 协议有默认值 4096（协议必填项，已记录于 config.json）。
- OpenAI 兼容协议自动带 `stream_options.include_usage`（协议级，对所有该协议模型一致）。
