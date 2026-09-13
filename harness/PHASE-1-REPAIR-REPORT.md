# Phase 1 修复报告（PHASE-1-REPAIR-REPORT）

> **Historical report** · Version: 0.3.0 · Historical test baseline: 76/76
> 本报告为 v0.3.0 时期的历史整改记录，数字仅代表当时基线。当前发布版本 v0.6.0 的最终测试结果见 `FINAL-RELEASE-REPORT.md`。

日期：2026-09-13 · 版本：0.3.0 · 基线：0.2.0（格物台 UI 版）

结论先行：**Phase 1 PASSED**（以 `npm test` 实际输出为准，见第六节）。

---

## 一、修复问题列表与根因

| # | 级别 | 问题 | 根因 |
|---|---|---|---|
| 1 | P0-1 | Web 上传的文件从未进入模型消息：前端发送 message 时未携带 `fileIds`，Web 服务端也未把 registry 文件绑定到 message，kernel 文件读取流程不触发 | 前后端契约缺失：`app.js` 构造 payload 时丢了 fileIds；服务端把 `request.files` 直接设为 registry 全量，与 messages 无关联 |
| 2 | P0-2 | CLI 用 `model.extra_body`（生效），Web 用 `model.extraBody`（undefined，丢失）→ 同一配置两表面 API 请求不同 | 两个 surface 各自手写 makeRequest 映射，字段命名无单一出处 |
| 3 | P0-3 | 流异常结束时仍会产出 message_end，网络断流被当作正常完成；无 timeout/abort/truncated 语义 | 引擎在迭代结束后无条件 yield message_end；没有完成信号判定与完成态枚举 |
| 4 | P1-1 | 实验包无法证明"适配器实际发了什么" | 无 request.json；headers 含密钥、body 只存在于内存 |
| 5 | P1-2 | config.json 记录 requestedConfig（如 maxTokens: null），但实际发送的是协议默认（max_tokens: 4096），实验条件不可复原 | 没有 resolved 概念 |
| 6 | P1-3 | 通用引擎内含 `if (name === 'anthropicThinking')` provider 专属分支 | 早期实现图省事把 thinking 结构写成了命名 transform |
| 7 | P1-4 | `"test": "node --test tests/"` 在本机 Node 22.22 报 MODULE_NOT_FOUND | Node 测试运行器不接受裸目录参数（需 glob） |
| 8 | P1-5 | sanitizer 测试失败：`..\..\evil.txt` → `.._.._evil.txt`，期望 `evil.txt` | sanitizer 行为先替换分隔符后保留整体串，未定义明确契约 |
| 9 | P1-6 | 实验包 files/ 按原始文件名存放，同名文件互相覆盖 | bundle 存储键 = 原始文件名，无唯一 stored identity |
| 10 | P1-7 | 实验包未记录 harness 版本、spec 版本/哈希、运行时 | 无版本模块与 manifest 字段 |
| 11 | P2 | 无 retry/timeout 状态机；无 attempts/retries 记录 | 缺失 |
| 12 | 附带 | CLI `--experiment "prompt"` 会把 prompt 吞成 flag 值，退化为交互模式（E2E 测试暴露） | parseArgs 未区分布尔旗标 |

## 二、修复方式

1. **P0-1**：前端把当前附加文件的 `fileIds` 显式写入发送的 user message（并保留在历史里）；服务端校验每个 fileId 必须存在于 registry（未知 id → 400，fail-closed，绝不调模型）；`request.files` 只取 message 实际引用的文件。kernel 流程不变（file_read_start/end 事件 → 渲染 → adapter）。E2E 测试全链路证明。
2. **P0-2**：新增 `kernel/unified.mjs` 的 `unifiedRequestFromModel(model, payload, files)` 作为**唯一**请求构建器，Web 与 CLI 都改走它；model 条目以 `loadModels()` 产出的 canonical snake_case `extra_body` 为准。新增一致性测试钉死契约。
3. **P0-3**：引入 `CompletionStates`（completed / provider_error / network_error / timeout / aborted / truncated / harness_error）。完成判定 = provider 明确结束信号（[DONE] 或 finish_reason 或 spec `markComplete` 规则，如 Anthropic message_stop）；干净结束但无信号 = truncated；连接异常 = network_error；harness 超时 = timeout；用户取消 = aborted；HTTP 非 2xx / 错误载荷 = provider_error。引擎总是以带 completion 的 message_end 收尾（不伪造内容）；pipeline 仅在 completion==='completed' 时置 status='ok'，否则补发 error 事件并置 error。`result.json`/index 记录 completion。
4. **P1-1/P1-2**：适配器构建请求后即生成脱敏留痕（`sanitizeHeaders`：authorization/x-api-key/cookie 及一切含 key/token/secret/credential/password 字样的 header → `[REDACTED]`），`store.writeRequest` 落盘 `request.json`，内含 provider/baseUrl/endpoint/method/脱敏 headers/完整 body/`requestedConfig`/`resolvedConfig`（从实际 wire body 通用推导，删除 messages/system）。`store.get` 一并返回。
5. **P1-3**：删除 `applyTransform` 与 `anthropicThinking` 分支；引擎新增**通用**声明式条件 `{"$if":…,"$then":…,"$else":…}`；thinking 结构移入 `anthropic.json` 规范（`$if: $.reasoning.hasBudget`）。引擎零 provider 名、零 thinking 字样（有静态测试）。
6. **P1-4**：`npm test` = `node --test tests/*.test.mjs`，直接可用。
7. **P1-5**：先定契约（见 `kernel/files.mjs` `sanitizeFileName` 注释）：取分隔符归一化后的最后一段 → 非法字符/控制字符转 `_` → 去尾部点空格 → 空回落 `file`；写入目标恒在 uploads 目录内（uuid 前缀 + path.join）。实现与测试均按契约。
8. **P1-6**：bundle 内文件以 `storedFileName = <fileId前8位>_<原名>` 唯一存储；`manifest.fileRecords` 记录 fileId/originalName/storedName/sha256。原始名可重复，存储绝不覆盖。
9. **P1-7**：新增 `kernel/version.mjs`（harnessVersion = package.json 版本，node 版本，git commit 尽力而为）；`loadSpecInfo()` 计算 spec sha256 与 specVersion；写入 `manifest.json` 与 `request.json`。git 不存在也能运行。
10. **P2**：unified request 增加 `maxRetries`（默认 0，上限 5）与 `timeoutMs`（默认无，1s–600s）；pipeline 仅对显式配置的 maxRetries 且 completion ∈ {network_error, timeout} 重试；provider_error 一律不自动重试（避免改变实验条件）。每次尝试发 `request_start` 事件，重试发 `retry_start`/`retry_end`；result 记录 attempts/retries/final completion。
11. **附带**：parseArgs 增加布尔旗标集合（experiment/reasoning/list-models）。

## 三、修改文件

- kernel：`schema.mjs`（completion/retry 事件与字段）、`pipeline.mjs`（完成态闭环 + 尝试循环）、`engine` 相关、`unified.mjs`（新）、`version.mjs`（新）、`store.mjs`（writeRequest/storedFileName/manifest 版本/fileRecords）、`files.mjs`（sanitizeFileName 契约）、`config.mjs`（HARNESS_CONFIG_DIR/HARNESS_DATA_DIR 环境隔离，仅测试用）、`replay.mjs`（message_end 补 completion）
- adapters：`engine.mjs`（$if 声明式、完成信号、超时/中止分类、extractResolvedConfig）、`index.mjs`（loadSpecInfo/specSha、sanitizeHeaders、lastRequest、timeoutMs 透传）、`specs/anthropic.json`（thinking → $if、message_stop markComplete）
- surfaces：`web/server.mjs`（统一构建器、fileIds 校验与绑定、timeout/retries 上限、writeRequest、manifest meta）、`web/static/app.js`（fileIds 显式绑定）、`cli/cli.mjs`（统一构建器、writeRequest、meta、--retries/--timeout-ms、布尔旗标）
- tests：`mock-provider.mjs`（回显全部消息与 max_tokens）
- package.json：test 脚本、版本 0.3.0

## 四、新增测试

- `tests/completions.test.mjs`（11）：finish_reason/DONE→completed；无信号→truncated；fetch 异常→network_error；HTTP 400/401/429/500→provider_error；错误载荷→provider_error；timeoutMs→timeout；主动 abort→aborted；maxRetries=1 重试成功（attempts=2、retry 事件）；默认不重试；429 不重试。
- `tests/request-record.test.mjs`（4）：lastRequest 留痕且密钥全链路脱敏；resolvedConfig 显示实际生效值（anthropic max_tokens 4096、thinking 结构）；buildRequestRecord 版本/spec 指纹；可疑 header 一律脱敏。
- `tests/unified.test.mjs`（4）：extra_body snake_case canonical；无 extra_body → {}；Web/CLI payload 经同一 builder 逐字段相等；同输入 → 相同 HTTP body。
- `tests/neutrality.test.mjs`（5）：核心 13 个模块静态扫描（品牌名/几何/身份分支为 0）；引擎无 $transform 与 thinking 内建；两份 spec 的 system 必须是纯引用 `$.system`（无隐藏提示词）且模板无内联文本；跨协议渲染确定性 + 用户/系统文本逐字一致；跨协议统一事件语义一致。
- `tests/e2e-web.test.mjs`（2）：真实 HTTP 服务 + 本地 mock provider 全链路（上传→fileIds→file_read 事件→provider 实际收到文件内容与 extra_body→实验包→verify 通过→request.json 无密钥→bundle 逐文件扫密钥为零命中→manifest 版本）；未知 fileId 400 且 provider 零调用。
- `tests/e2e-cli.test.mjs`（1）：真实 CLI 进程（prompt+--file→流式→bundle 完整性→request.json 脱敏→manifest 版本→--verify 通过）。
- 更新：`engine.test.mjs`（HTTP 401 现断言 error+message_end(provider_error)）、`pipeline.test.mjs`（request_start 事件、completion 字段、network_error 语义）、`store-verify.test.mjs`（stored 文件名）、`keys.test.mjs` 不变。

## 五、E2E QA 结果（需求十三）

| 项 | 方式 | 结果 |
|---|---|---|
| A. CLI 全链路 | e2e-cli.test.mjs（真实进程） | PASS |
| B. Web 全链路 | e2e-web.test.mjs（真实 HTTP 服务） | PASS |
| C. Web 文件 | 同上：upload→fileIds→file_read→provider 实收→bundle | PASS |
| D. Reasoning | engine.test.mjs：on→reasoning_effort/thinking 原样进 wire body；off→不发送；provider 无 reasoning 字段→零 reasoning 事件（不伪造） | PASS |
| E. Error 矩阵 | completions.test.mjs：400/401/429/500/network/timeout/abort/truncated | PASS |
| F. Cross Model | neutrality.test.mjs：同输入→渲染逐字节一致、跨协议语义一致、system 无隐藏注入 | PASS |
| G. 中立性回归（十四） | neutrality.test.mjs 静态扫描：13 个核心模块品牌名/几何/身份条件分支 = 0 | PASS |

## 六、实际测试结果（真实输出）

```
$ npm test
# tests 76
# pass 76
# fail 0
```

复跑两遍，结果一致（76/76/0）。旧报告的 44/44 对应修复前基线；本轮新增 30 个测试后以 76/76 为准。

## 七、Neutrality Audit（增量）

- 通用引擎已无任何 provider 分支：`grep -n "anthropicThinking\|applyTransform\|\$transform" adapters/engine.mjs` = 0 命中（有测试钉死）。
- thinking 结构现完全由 `specs/anthropic.json` 的 `$if/$then/$else` 声明；openai 规范无任何 system/thinking 字面量（测试断言 template 值必须是 `$.` 引用）。
- 两表面请求经同一 builder，字段命名不可能再漂移（unified.test.mjs）。
- 静态扫描（品牌名/几何/身份条件）覆盖 kernel 全部 11 个模块 + 引擎 + 适配器注册表，0 命中。
- 未增加任何 Agent 能力；本轮所有改动均为正确性/可审计性修复。

## 八、Security Audit（增量）

- `request.json` 含完整 wire body 与脱敏 headers；authorization/x-api-key/cookie 等一律 `[REDACTED]`；E2E 对 bundle 内**每一个文件**做密钥明文扫描，0 命中。
- 未知 fileId → 400，fail-closed，E2E 断言 provider 被调用次数 = 0。
- 仍无目录扫描、无自动联网、无代码执行、无自动增删改文件；`request.json` 只新增落盘产物，不新增任何主动行为。

## 九、Known Limitations

1. PDF 仍为元数据模式（零依赖取舍，读取报清晰错误）。
2. 重试仅覆盖 network_error/timeout；429/5xx 默认不重试——这是刻意保守：Benchmark 场景下自动重试可能改变实验条件，如需 429 退避重试必须作为显式实验配置另行设计。
3. timeout 通过 harness 侧 AbortController 实现；provider 侧原生超时参数不在透传范围（如需可作为 extra_body 由用户显式配置）。
4. Web UI 未为 timeoutMs/maxRetries 提供控件（API/CLI 已支持，payload 字段已就位）；后续如需在 UI 暴露，属配置面板改动，不影响中立性。
5. git commit 记录为尽力而为（无 git 环境时为 null，不影响运行与校验）。

## 十、验收结论

- `npm test`：76/76，0 failed（真实输出见第六节）。
- Web / CLI 验收清单（十六节）逐项由 E2E 覆盖并通过。
- 实验包含：config（requested）、request.json（resolved + 实际 wire 请求脱敏）、files（唯一 stored identity + fileRecords）、rendered messages、raw SSE、哈希链事件、result（completion/attempts/retries/usage/timing）、manifest（版本 + spec 指纹）。
- 安全与中立性增量审计通过，无伪修复（失败测试全部以修复实现/按新契约重定义的方式处理，未删除断言、未降低标准、未改审计文档掩盖——本报告追加于审计文档之后，历史记录原样保留）。

**Phase 1：PASSED**
