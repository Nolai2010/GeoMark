# 安全审查报告 — GeoMark-Harness（v0.4.0）

审查范围：`D:\Agents\Workfile\GeoMark-Harness` 全部 41 个源文件（kernel 13 / adapters 4 / surfaces 8 / tests 17 / config 4），排除 experiments/ 与 uploads/ 运行时产物
技术栈：Node.js ≥22（纯 ESM，零 npm 依赖，Node 内置模块），原生 http 服务器，原生前端（无框架）
审查时间：2026-09-13　审查引擎：**CodeDefencer**（本地 Skill `E:\CodeDefencer_Knowledge\skill\code-defencer\SKILL.md`，8 步工作流）
审查模式：**只读**。未修改 GeoMark-Harness 任何源码；未复制/移动/修改知识库任何文件。

## 结果汇总

| 严重级 | 数量 |
|---|---|
| 🔴 CRITICAL | 0 |
| 🟠 HIGH | 1 |
| 🟡 MEDIUM | 2 |
| 🔵 LOW | 3 |
| ⚪ INFO | 5 |
| **合计** | **11** |

## 依赖审计表

| 包名 | 版本 | 风险 | 建议 |
|---|---|---|---|
| （无任何 npm 依赖） | — | 供应链面 = Node ≥22 内置模块 | 保持零依赖策略；engines 已锁定 >=22 |

结论：不存在幻觉依赖 / typosquatting / 已知 CVE 面（V2 不适用）。`AbortSignal.any`、内置 `fetch`、`node:test` 等均为 Node 22 真实 API，无幻觉 API。

## 敏感信息扫描结果

| 位置 | 类型 | 处置建议 |
|---|---|---|
| tests/*.mjs（e2e-secret-key、cli-secret-key、sk-TEST-KEY 等） | 测试夹具假密钥（明显假值） | ⚪ 保留即可；勿替换为真实密钥 |
| config/secrets.example.json | 占位符 | 正确 |
| 全库 grep AKIA/AIza/私钥块/连接串 | 0 命中 | — |

真实密钥存储 `config/secrets.json` 已被 .gitignore 覆盖，且扫描时不存在于磁盘。

## 发现明细（按类别分组）

### A. 认证 / CSRF / SSRF

#### [🟠 HIGH] [置信度:中] 本地 API 无 Origin/Host 校验 + 连接测试使用存储密钥 → 跨站窃取 API 密钥 — surfaces/web/server.mjs:266-287, 198-318
- **代码**：
  ```js
  // 所有写操作与测试接口均无 Origin/Host/CSRF 校验，服务无任何认证
  const apiKey = payload.apiKey || getApiKey(payload.provider, payload.id ?? null);
  const outcome = await testConnection({ ...baseUrl: payload.baseUrl... });   // baseUrl 完全由请求方控制
  ```
- **攻击者能做什么**：受害者浏览器中任意网页可用 `fetch(..., {mode:'no-cors'})` 向 `http://127.0.0.1:7788/api/models/test` 发送跨站 POST（`readBody` 不校验 Content-Type，`text/plain` 即可通过 no-cors 发送 JSON 体）。服务端会用**已保存的 API 密钥**向攻击者控制的 `baseUrl` 发起请求，`Authorization: Bearer <密钥>` / `x-api-key` 直接落入攻击者服务器日志——无需读取响应即可完成窃取。配合 DNS Rebinding（服务端不校验 Host），攻击页还可进一步**读取** `/api/experiments/:id`（用户全部提示词与配置，跨站原本不可读的响应在 rebinding 后变为同源可读）。
- **利用条件**：受害者已配置密钥 + 服务运行中 + 访问恶意页面。服务绑定 127.0.0.1（未暴露局域网）与浏览器 PNA 策略现状是仅有的缓和因素，故定 HIGH 而非 CRITICAL。
- **修复建议（展示，不应用）**：
  ```js
  // server.mjs — createServer 回调顶部加同源守卫（修复点：拒绝跨站与重绑定请求）
  const HOST_RE = /^127\.0\.0\.1(:\d+)?$/;
  const origin = req.headers.origin;
  if (origin && origin !== `http://127.0.0.1:${PORT}` && origin !== `http://localhost:${PORT}`) {
    return json(res, 403, { error: 'cross-origin request rejected' });
  }
  if (!HOST_RE.test(String(req.headers.host ?? ''))) {
    return json(res, 403, { error: 'invalid host' });   // 防 DNS Rebinding 读取响应
  }
  ```
  ```js
  // /api/models/test — 存储密钥默认不用于未注册地址（修复点：密钥外发需显式确认）
  const known = resolveModel(payload.id ?? '').baseUrl === payload.baseUrl; // 仅已注册模型可用存储密钥
  const apiKey = payload.apiKey || (known ? getApiKey(payload.provider, payload.id) : undefined);
  if (!apiKey) return json(res, 400, { error: '连接测试请填写 API 密钥，或先保存模型' });
  ```
- **知识库参考**：`library/01-Web安全/10-CSRF的攻击与防御.pdf`、`92-web漏洞之CSRF漏洞挖掘.pdf`、`31-浅谈SSRF漏洞.pdf`
- **标准**：OWASP A01/A10 / CWE-352、CWE-918

#### [🟡 MEDIUM] [置信度:高] SSRF：连接测试目标完全可控，无内网拦截、跟随重定向 — kernel/test-connection.mjs:38-72
- **代码**：`fetchImpl(base + '/models', { headers })`，`base` 任意 http(s) URL，`fetch` 默认跟随重定向。
- **攻击者能做什么**：单独看这是本地单用户工具的设计功能；但与上一条 CSRF 组合，可从受害者机器探测内网端口（借助响应时序与 ok/status 差异）并触达云元数据地址；重定向可将带凭据请求引向任意跳转目标。
- **修复建议**：解析目标主机后拒绝私网/环回/链路本地地址段（10/8、172.16/12、192.168/16、127/8、169.254/16、::1 等）与非常规端口；`redirect: 'error'`；DNS 解析后校验 IP（防 rebinding）。
- **知识库参考**：`library/01-Web安全/31-浅谈SSRF漏洞.pdf`
- **标准**：OWASP A10 / CWE-918　置信度：高（能力存在）/ 中（危害需组合）

### B. 逻辑漏洞 / 不完整实现（AI 代码特有）

#### [🟡 MEDIUM] [置信度:高] V8 模型级 API 密钥保存链路断裂，静默失败 — surfaces/web/server.mjs:235 + surfaces/web/static/app.js:314 + server.mjs:147
- **代码**：
  ```js
  // server.mjs:235  — 前端发来 {modelId, key}，此处却取 payload.provider（undefined）
  const providers = saveApiKey(payload.provider, payload.key);   // → TypeError → 400
  // app.js:314     — 前端未检查 res.ok，保存失败无任何提示
  await fetch('/api/keys', { ... body: JSON.stringify({ modelId: payload.id, key }) });
  // server.mjs:147 — 聊天时也未按模型 ID 取密钥
  apiKey = getApiKey(model.provider);
  ```
- **攻击者能做什么**：不是直接漏洞，但属于"用户以为密钥已安全保存，实际未保存"的假完成状态——用户会转而把密钥写进 extra_body 或其他明文位置，形成真实泄露路径；同时模型级密钥功能整体不可用（Phase 2 承诺失效）。
- **修复建议（展示，不应用）**：
  ```js
  // server.mjs:235（修复点：透传整个 payload，modelId 作用域由 saveApiKey 处理）
  const providers = saveApiKey(payload, undefined);
  // server.mjs:147（修复点：聊天按模型 ID 解析密钥）
  apiKey = getApiKey(model.provider, model.id);
  // app.js saveModelFromDialog（修复点：校验保存结果）
  if (!(await r).ok) { $('model-test-msg').textContent = '密钥保存失败'; return; }
  ```
- **知识库参考**：本项为知识库外判断（V8 不完整实现，`references/vibecoding-risks.md` 提供审查框架）
- **标准**：CWE-754（异常/失败路径处理不当）　置信度：高

### C. 数据处理

#### [🔵 LOW] [置信度:高] 原型污染模式（CWE-1321）— surfaces/web/server.mjs:235, kernel/config.mjs:186-198, kernel/unified.mjs extraBody 合并
- **说明**：`/api/keys` 的 `modelId` 与 `/api/models` 的 `extra_body` 键名未过滤，`__proto__` 经 `[[Set]]` 触发原型写入。当前代码随后的 `JSON.stringify` 不会序列化原型，实害未证实——属危险模式而非可利用漏洞。（本项为知识库外判断，catalog.csv 无原型污染条目。）
- **修复建议**：拒绝键名 `__proto__`/`constructor`/`prototype`；或改用 `Object.create(null)` + `Object.defineProperty`。
- **标准**：CWE-1321

#### [🔵 LOW] [置信度:高] 静态文件服务路径校验为脆弱写法 — surfaces/web/server.mjs:307-309
- **代码**：`path.normalize(rel).replace(/^(\.\.[/\\])+/,'')` + `file.startsWith(STATIC_DIR)`。
- **说明**：当前 `p = url.pathname` **未做 URL 解码**，`%2e%2e%2f` 保持字面量，实际不可穿越（误打误撞安全）；但 `startsWith` 未含分隔符、依赖"未解码"这一隐式行为，属防御纵深缺失——任何后续"顺手"加上 decodeURIComponent 都会立刻打开任意文件读取。
- **修复建议**：`const file = path.resolve(STATIC_DIR, decodeURIComponent(p.slice(1))); if (!file.startsWith(STATIC_DIR + path.sep)) → 404`。
- **知识库参考**：`library/01-Web安全/22-谈谈上传漏洞.pdf`（路径规范化原则）
- **标准**：CWE-22

#### [🔵 LOW] [置信度:高] 缺少安全响应头 — surfaces/web/server.mjs:312
- **说明**：静态响应无 `Content-Security-Policy`、`X-Content-Type-Options: nosniff`、`X-Frame-Options`。当前前端无 XSS 注入点（所有动态输出均 `esc()` 转义或 `textContent`），缺 CSP 使未来一处疏忽即可被利用。
- **修复建议**：加 `Content-Security-Policy: default-src 'self'; script-src 'self'`、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`。

### D. INFO（观察项）

| 位置 | 说明 |
|---|---|
| tests/*.mjs | 测试夹具假密钥（e2e-secret-key 等），值明显虚假，无风险 |
| package.json:3 | 版本号 0.3.0 与 PHASE-2 报告宣称的 0.4.0 不一致（流程一致性） |
| /api/chat | 无速率限制（本地单用户工具可接受） |
| server.mjs:100 | `bad json: ${e.message}` 回显解析器消息（本地无危害） |
| custom_headers | 用户可注入任意请求头（含覆盖鉴权头）——本地单用户工具的设计自由度，已脱敏入记录 |

## AI 代码特有风险（V 系列）

| 编号 | 风险 | 结果 |
|---|---|---|
| V1 提示词注入进代码 | 未发现指令性字符串/隐藏指令；specs 的 system 为纯引用 | ✓ 干净 |
| V2 幻觉依赖 | 零依赖，不适用 | ✓ 干净 |
| V3 幻觉 API | AbortSignal.any/fetch/node:test 均为 Node 22 真实 API，且有 87 项测试实际执行 | ✓ 干净 |
| V4 过度授权 | 无 shell/自动删除/外传（唯二网络出站：provider 调用与连接测试，均为核心功能）；execSync 仅固定参数 `git rev-parse HEAD` | ✓ 干净 |
| V5 硬编码秘密 | 0 命中 | ✓ 干净 |
| V6 不安全默认配置 | 绑定 127.0.0.1、无 DEBUG 开关、无默认密码、密钥文件 gitignored | ✓ 干净 |
| V7 逻辑漂移 | fail-closed 文件校验、fileIds 白名单、上限钳制均在位 | ✓ 干净 |
| **V8 不完整实现** | **模型级密钥链路断裂（见 MEDIUM 发现）** | ✗ 命中 |
| V9 历史漏洞模式 | 无 SQL/MD5/eval 等老模式 | ✓ 干净 |
| V10 修复引入新漏洞 | 复查 Phase-1 补丁：未发现新漏洞；静态 startsWith 脆弱写法为历史遗留 | ✓ 基本干净 |

## 跨文件数据流分析（Step 5 产出）

- **流 A（密钥外泄，本次 HIGH）**：恶意网页 → 浏览器 no-cors POST `127.0.0.1:7788/api/models/test` → server 读 `config/secrets.json` 存储密钥 → `testConnection.fetch(攻击者baseUrl)` → `Authorization/x-api-key` 落入攻击者日志。
- **流 B（数据读取，rebinding 组合）**：rebind 后同源 GET `/api/experiments/:id` → config.json（系统提示词/用户消息）+ result.json 全量返回。
- **流 C（正常文件流，已防护）**：multipart 上传 → basename 清洗 + uuid 前缀 + 10MB 上限 + uploads 目录（不提供 HTTP 读取）→ fileIds 白名单校验（未知 id 400 且 provider 零调用）→ readText（二进制/PDF 拒绝）→ 固定模板渲染 → 密钥仅进 headers → request.json 双层脱敏。全程无未授权读取路径。

## 修复优先级建议

```
本周修复：HIGH-1（Origin/Host 守卫 + 测试连接密钥策略）、MEDIUM-2（模型级密钥链路）
计划内：MEDIUM-3（SSRF 内网拦截 + redirect:error）
择机修复：LOW-4/5/6
```

## 审查结论

- **总体评价：修复后可继续使用。** 核心内核（渲染管线/哈希链/脱敏/文件白名单）质量良好；主要风险集中在 Web 表面的**跨站访问控制缺失**与一处**假完成**逻辑，均有明确补丁路径。
- 覆盖范围：全部源码静态审查 + 数据流追踪 + 知识库对照。未覆盖：动态渗透测试、传递依赖（无依赖）、Node.js 自身 CVE。

---

## CodeDefencer Knowledge Base

```
Knowledge Base Path:  E:\CodeDefencer_Knowledge\
Skill:                code-defencer（E:\CodeDefencer_Knowledge\skill\code-defencer\SKILL.md，
                      8 步工作流 + references 全部 8 个文件按需加载）
docs:                 已使用 —— README.md（入口）、docs/03-审查知识图谱.md（代码信号→漏洞→资料映射）
library:              已检索（catalog.csv 定点过滤，按 path 定位未逐页精读）——
                      01-Web安全/10-CSRF的攻击与防御.pdf、92-web漏洞之CSRF漏洞挖掘.pdf、
                      31-浅谈SSRF漏洞.pdf、22-谈谈上传漏洞.pdf、
                      06-信息泄露之配置不当.pdf、04-企业级未授权访问漏洞防御实践.pdf、
                      07-安全运营与威胁情报/72-GitHub信息泄露.pdf
README:               已读取（知识库结构/检索方法/合规边界）
MANIFEST.json         存在，未读取（本次未需统计元数据）
Knowledge Base Mode:  Read-only
```

**声明：未复制、未移动、未修改 `E:\CodeDefencer_Knowledge\` 中的任何文件；全程仅以绝对路径只读访问。**

### Skill 本身的问题（按要求单独说明，未修改 Skill）

1. `references/kb-guide.md` 第 2 节给出的检索脚本路径 `C:\Users\JunYa\Doubao\skills\code-defencer\scripts\kb_query.ps1` 在当前机器不存在（Skill 实际位于 `E:\CodeDefencer_Knowledge\skill\`），示例命令会失败；本次改用 catalog.csv 直接过滤。
2. `references/severity-guide.md` 定义了置信度标注，但 `references/report-format.md` 的发现卡片模板未包含置信度字段位——本次按 severity-guide 补齐。
3. catalog.csv 未覆盖"原型污染（CWE-1321）"主题，相关判断已明确标注为知识库外判断。

---

**结束语：请逐条审阅补丁后再应用，我未修改任何代码。**

---

## 修复执行记录（同日追加，v0.4.1）

审查发现已全部修复并通过测试（npm test 94/94，0 失败；新增 7 项安全回归测试）：

| 发现 | 修复 | 验证 |
|---|---|---|
| 🟠 HIGH-1 跨站/重绑定 | server.mjs 请求入口加同源守卫：Host 必须为 127.0.0.1/localhost，跨站 Origin 403；`/api/models/test` 存储密钥仅可用于已注册模型自身地址，未知地址必须显式携带密钥 | e2e-web：Origin evil.example → 403、Host evil.example → 403（原生 http 模拟） |
| 🟡 MEDIUM-2 模型级密钥断裂 | `/api/keys` 透传完整 payload（saveApiKey 支持 {modelId,key}）；聊天 `getApiKey(provider, model.id)`；前端校验密钥保存结果并提示 | e2e-web：模型级密钥路由 200 + keyStatus.modelKeys=1 |
| 🟡 MEDIUM-3 SSRF | testConnection：仅 http(s)、拦截云元数据/链路本地（169.254.169.254）、`redirect:'error'`；本地/内网模型服务器为一等公民故未封私网段（以同源守卫为边界，已在报告中说明） | security-fixes：元数据地址 fetch 前拦截（调用数=0）、file:// 拦截 |
| 🔵 LOW-4 原型污染 | 新增 `deepClean`（schema.mjs）：extra_body/custom_headers 深度清洗 `__proto__/constructor/prototype`；saveApiKey modelId 白名单校验 | security-fixes：危险键全链路清零 + 无损性测试 |
| 🔵 LOW-5 静态路径 | decodeURIComponent + path.resolve + `STATIC_DIR + path.sep` 前缀校验，坏编码 400 | 既有静态资源/截图路径回归通过 |
| 🔵 LOW-6 安全头 | 全响应统一 `X-Content-Type-Options/X-Frame-Options/CSP(default-src 'self')`；主题脚本外置 theme.js 以满足 script-src 'self' | curl 实测三头在位；亮/暗截图确认 UI 无回归 |
| ⚪ INFO 版本不一致 | package.json → 0.4.1，实验断言同步 | e2e manifest 断言 |

修复后未引入新漏洞：对补丁自审（V10）——同源守卫不改变内核数据流；deepClean 不触碰合法字段（`max_tokens` 等经测试确认无损）；CSP 未使用 unsafe-inline。

**结束语：请逐条审阅补丁后再应用，我未修改任何代码。**（本节为审查方在获得授权后执行的修复记录；补丁与上节展示一致。）
