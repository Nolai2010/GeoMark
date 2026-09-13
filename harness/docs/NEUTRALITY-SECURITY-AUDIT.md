# 中立性与安全审计报告

审计日期：2026-09-12 · 审计对象：GeoMark-Harness 全部核心代码

> **阅读说明（v0.6.0 发布时补充）**：本文各节为**追加式历史记录**，每节末尾的测试数字仅代表该节撰写时的版本基线（第五节=76/76@v0.3.0、第七节=87/87@v0.4.0、第八节起=102/102）。当前发布版本 **v0.6.0** 的最终测试结果与安全扫描状态以根目录 `FINAL-RELEASE-REPORT.md` 为准。

## 一、中立性审计

### A1. 静态扫描
- 在 `kernel/ adapters/ surfaces/` 全文扫描 `gpt|claude|deepseek|qwen|doubao|gemini|you are|你是|geometry|几何`：
  唯一命中为 CLI 用法示例注释（用户文档，非执行逻辑）。**核心无模型名分支、无隐藏提示词、无领域专用逻辑。**

### A2. 运行时保障（均有对应自动化测试）
| 保障 | 机制 | 测试 |
|---|---|---|
| 适配器不得修改输入 | 渲染后消息 `deepFreeze` + SHA-256 快照，流结束后比对 | pipeline.test.mjs "adapter attempting input mutation is caught" |
| 调用方请求对象不被污染 | pipeline 在 `structuredClone` 副本上工作，运行后逐字节比对 | pipeline.test.mjs "caller request object untouched" |
| 所有模型收到相同输入 | 唯一渲染模板在 `kernel/assembly.mjs`，adapter 仅消费 `renderedMessages` | engine.test.mjs "body: exact messages" |
| 无隐藏 System Prompt | system 仅来自用户输入原样传递；specs 中无任何提示词文本 | 静态扫描 + build 测试 |
| 不伪造事件 | 统一事件仅由 spec 规则匹配产生；content=null/无 reasoning 字段 → 零事件 | engine.test.mjs "emits NOTHING (no fabrication)" |
| 不按能力改变行为 | `supports_reasoning` 仅展示给 UI，不进入任何执行路径 | 代码审查 |
| 不区分模型 | 引擎只有一条代码路径，按 spec 解释 | 架构审查 |

### A3. 明确不实现清单（需求第三节）
Skills / Plugins / MCP / Web Search / Browser / Code Interpreter / Shell /
Computer Use / 自动执行代码 / 自动增删改文件 / 自动联网 / Agent 自主扩展 —— 全部不存在于核心。
`tests/mock-provider.mjs` 仅为 QA 用本地 mock，不属核心，不被任何核心代码引用。

## 二、安全审计

### A4. 密钥处理
- 密钥来源：环境变量或 `config/secrets.json`（已 gitignore），仅存进程内存。
- 密钥只进入 HTTP headers（bearer / x-api-key），从不进入请求体、日志或事件流（engine.mjs 构建逻辑 + 测试断言 `!body.includes(key)`）。
- `store.mjs` 的 `scrub()` 防御性二次过滤：任何名为 api_key/authorization/token/secret/password 的字段落盘前替换为 `[REDACTED]`。
- 实测：端到端 QA 后在 `experiments/` 全目录 `grep` 密钥明文，零命中。

### A5. 文件输入
- 仅显式注册（上传或 registerPath）；无任何目录扫描/自动发现代码。
- 上传文件名经 basename 清洗 + 随机前缀防覆盖；单文件上限 10MB；请求体上限 20MB。
- 二进制/NUL 探测，二进制与 PDF 读取被明确拒绝（fail-closed）。

### A6. 注入面
- 静态文件服务做了路径归一化 + 前缀校验（防目录穿越）。
- `ExperimentStore.get/dirOf` 用 `path.basename` 拒绝穿越（有测试）。
- 无 eval / 无动态 require / 无 child_process（零依赖 + 纯 ESM 静态可查）。
- Web 服务只绑定 127.0.0.1。

### A7. 完整性
- 事件流逐条哈希成链（seq|prevHash|hash），篡改任意字节即可检出（audit/store-verify 测试）。
- 实验包 manifest 记录全部产物 SHA-256，`verify` 独立校验，与生产/适配器代码零耦合。

## 三、QA 结果

- 单元/集成测试：**44/44 通过**（`node --test tests/*.test.mjs`）。
  覆盖：SSE 解析、两份 spec 规则映射、请求构建、审计链、组装、文件注册、pipeline（含中立性卫兵）、
  实验包、校验器、离线重放、multipart 解析。
- 端到端冒烟：Web 服务 + 本地 mock provider 全链路 SSE 成功；
  回显证实 system prompt 与 reasoning_effort 原样到达 provider；
  实验包落盘 → verify 通过 → CLI 离线重放输出与线上一致。
- 错误路径实测：HTTP 401、fetch 失败、未知文件 ID（fail-closed，未调用模型 API）均产生 error 事件且不伪造内容。

## 四、遗留事项（不阻塞 Phase 1）

1. PDF 文本提取未实现（零依赖取舍），读取时报清晰错误。
2. 文件"移除"按钮当前为清空全部（UI 简化），API 层无单文件删除接口。
3. 未来扩展（批量实验、自动评分等）必须以独立模块实现并重新过本审计。

## 五、v0.2 UI 审计增补（2026-09-13）

1. 「钥匙」弹窗经 `POST /api/keys` 落盘 config/secrets.json（gitignored）；`keyStatus()` 只返回布尔，任何接口均不回显密钥；密钥依旧只进 headers，不入 config.json 与事件流（keys.test.mjs 断言）。
2. 术语笺为纯静态文案（glossary.js），内容不进入任何模型输入，不改变实验条件；链接仅改写 DOM 展示层，不触碰 request 渲染管线。
3. 录屏演示钩子（#qa-demo 等）只在浏览器本地绘制画面，不发起任何网络请求、不产生实验记录。
4. UI 零外部资源（无 CDN/字体/图片），与零依赖审计原则一致；渲染管线代码未改动。

## 六、Phase 1 整改审计增补（v0.3，2026-09-13）

按定向整改要求完成 P0×3 / P1×7 / P2 修复。逐项细节见根目录 PHASE-1-REPAIR-REPORT.md（以实际 npm test 输出为准：76/76 通过）。要点：

1. 完成态语义：completed/provider_error/network_error/timeout/aborted/truncated/harness_error 七态；仅 completed 记为成功，断流/超时/中止一律 error + 显式 completion，禁止伪造 message_end（completions.test.mjs 覆盖全部状态）。
2. request.json：记录适配器实际发送的 HTTP 请求（endpoint/method/脱敏 headers/完整 body），并区分 requestedConfig 与 resolvedConfig（如 anthropic max_tokens 默认 4096 现已可从记录复原）。
3. 通用引擎已无 provider 专属分支（thinking 移入 anthropic.json 的声明式 $if/$then/$else）；静态回归测试（neutrality.test.mjs）对 13 个核心模块扫描模型品牌名/几何逻辑/身份条件分支，0 命中，并断言 spec 的 system 必须为纯引用。
4. Web/CLI 请求统一经 kernel/unified.mjs 单一构建器，extra_body 字段命名漂移不可能再发生（unified.test.mjs 钉死）。
5. 实验包新增：request.json、唯一 stored identity 文件存储 + fileRecords、manifest 版本三元组（harnessVersion/adapterSpec sha256/runtime.node/git commit 尽力而为）。
6. 重试默认为 0，仅显式配置且仅限 network_error/timeout；provider_error（含 429）不自动重试；每次尝试与重试决策均入事件链与 result。
7. E2E 实测：Web 上传文件→fileIds→file_read 事件→provider 实际收到文件内容（mock 回显断言）→实验包 verify 通过；未知 fileId 400 且 provider 零调用；CLI 同链路通过；bundle 全文件密钥明文扫描 0 命中。

本节为追加记录；此前各节结论仅在其对应版本范围内有效。

## 七、Phase 2 产品升级审计增补（v0.4，2026-09-13）

1. Provider 预设（DeepSeek/Qwen/Kimi/MiniMax/ChatGLM/OpenAI/Anthropic）仅为 JSON 配置模板（协议+地址+接口路径+默认模型 ID），providers.test.mjs 对全部预设断言：wire 请求仅含协议映射，系统提示词逐字来自用户输入，密钥只进 headers。
2. 自定义接口（endpoint_path/custom_headers/默认参数）为协议层配置：customHeaders 用户声明优先、全部脱敏入记录（scrubHeaders 子串匹配仅用于 header 类对象，保护 max_tokens 等字段不被误伤）；engine 无新增 provider 分支。
3. 密钥体系升级：secrets.json = {providers, models}（兼容旧扁平）；优先级 env > 模型级 > 协议级；任何接口不回显密钥；连接测试错误信息只含 HTTP 状态分类，永不包含密钥（单测断言）。
4. 双主题与微动效为纯展示层改动（CSS 变量 + <dialog>/transition），未触碰渲染管线；prefers-reduced-motion 全局生效。
5. 文案回归测试（ui-copy.test.mjs）：24 个古风词与 4 类自创替代词在 4 个静态 UI 文件中命中数为 0，正式术语（词元/流式输出/系统提示词等）必须在位。
6. 本轮 npm test：87/87 通过。未新增任何 Agent 能力。

## 八、Markdown + LaTeX 渲染增补（v0.4.1，2026-09-13）

1. 新增本地 vendor：`static/vendor/katex/`（KaTeX 0.16.11 JS+CSS+20 个 woff2 字体，共约 600KB），运行时零 CDN；`static/markdown.js` 为自研零依赖安全渲染器（~150 行）。
2. XSS 防线：**先 HTML 转义、再语法替换**——模型输出中的 `<script>`/`<img onerror>` 等只以转义文本出现；链接仅允许 http(s)/mailto 并带 rel=noopener；代码块内容不做任何语法处理；`javascript:` 等协议不生成 `<a>`（markdown.test.mjs 6 例覆盖）。
3. LaTeX：`$…$`/`$$…$$`/`\[…\]`/`\(…\)` 由本地 KaTeX 渲染（trust:false、throwOnError:false）；KaTeX 加载失败时降级为转义原文，不抛错。公式只改展示层，实验记录中的 result.text 保持模型原文。
4. CSP 调整：style-src 增加 'unsafe-inline'（KaTeX 输出依赖内联样式属性）、新增 font-src 'self'（本地字体）；script-src 保持 'self'（主题脚本已外置）。
5. 覆盖范围：模型回答与思考过程实时渲染；实验详情的原始 pre 区块保持原样（保真原则）。
6. 本轮 npm test：102/102 通过。

## 九、v0.6.0 交付审计增补（2026-09-13）

1. 滚动修复（min-height:0 链）与悬浮按钮为纯展示层；新增浏览器自动化自测（tools/cdp-selftest.mjs）直接驱动真实 Edge：页面锁滚、聊天独立滚动、按钮出现/跳底/隐藏、真实密钥调用、渲染管线、零页面异常——7/7。
2. Markdown/LaTeX 渲染为展示层，实验记录原文不受影响；XSS 防线"先转义再渲染"有单测钉死。
3. 无新增 Agent 能力；npm test 102/102。
