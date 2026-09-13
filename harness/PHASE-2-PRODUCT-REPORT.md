# Phase 2 产品体验与模型接入升级报告（PHASE-2-PRODUCT-REPORT）

> **Historical report** · Version: 0.4.0 · Historical test baseline: 87/87
> 本报告为 v0.4.0 时期的历史记录，数字仅代表当时基线。当前发布版本 v0.6.0 的最终测试结果见 `FINAL-RELEASE-REPORT.md`。

日期：2026-09-13 · 版本：0.4.0 · 前置：Phase 1 整改（0.3.0，76/76 通过）已完成
测试基线：**`npm test` 87/87 通过，0 失败**（新增 11 个测试，见第十二节）。

---

## 一、UI 文案修改总览（方向一）

依据 `ui-copy-guidelines.md`（本轮新增的文案规范）执行，全局扫描并替换。

### 1.1 删除/替换的古风术语

| 旧文案 | 新文案 | 位置 |
|---|---|---|
| 择器 | 模型 | 侧栏模型区 |
| 出题（按钮） | 发送 | 输入区 |
| 呈卷 / 文件（显式附加） | 文件（显式附加，仅读取所选文件） | 文件区 |
| 落卷为凭 | 保存实验 | 实验模式开关 |
| 拂去，重开一局 | 清空对话 | 侧栏按钮 |
| 沉吟（模型原生推理…） | 思考过程（模型原生推理，原文照录） | 思考折叠区 |
| 钥匙 | API 密钥 | 顶栏与弹窗标题 |
| 合上 | 关闭 | 所有弹窗按钮 |
| 实验录 | 实验记录 | 右侧栏 |
| 实验卷宗 / 实验详情标题 | 实验详情 | 详情弹窗 |
| 封印完好 / 封印有损 | ✓ 校验通过，记录完整 / ✗ 校验失败，记录可能被改动 | 实验详情 |
| 已落卷 | 实验已保存 | 消息元信息 |
| 问 / 答 / 误 | 你 / 模型 / 错误 | 消息角色标签 |
| 呈卷失败 | 文件读取失败 | 事件提示 |
| 落笔即发问… | 输入提示词…（Enter 发送，Shift+Enter 换行） | 输入框占位符 |
| 空状态说明（船夫/帆隐喻句） | 同一个问题、同一份文件、同一套配置，交给不同的模型……不做任何偏袒 | 空状态 |
| 术语笺 | 术语说明 | 弹窗及页脚 |
| 实验状态隐式 | 就绪 / 连接中… / 流式输出中… / 推理中… / 已完成 / 失败 | 运行状态徽标（新增） |

保留的装饰性元素（不承担功能语义）：品牌名「格物台」、朱砂印章「格物」、空状态装饰短句「同题共答，千帆竞渡」。

### 1.2 采用的正式中文技术术语

| 术语 | 用法 |
|---|---|
| 词元（Token） | 输入词元 / 输出词元 / 词元用量 / 最大词元数 / 思考词元预算 |
| 首词元延迟（TTFT） | 运行指标 |
| 流式输出 | 状态与术语 |
| 推理 / 思考过程 | Reasoning |
| 服务提供商（Provider） | 模型配置与术语 |
| 自定义接口（Custom Endpoint）/ 预设（Preset） | 新增能力命名 |
| 适配器 / 清单 / 系统提示词 / API 密钥 / 结束原因 / 完成状态 | 实验详情 |

保留英文缩写：SSE、SHA-256、HTTP、API、JSON、Extra Body；TTFT 以「首词元延迟（TTFT）」形式出现。
术语说明（glossary.js）全部重写为现代语言，并新增 服务提供商 / 自定义接口 / 预设 / API 地址 / 完成状态 五个条目。

文案回归由 `tests/ui-copy.test.mjs` 静态扫描钉死：24 个古风词 + 4 类自创替代词在 4 个静态 UI 文件中命中数必须为 0，正式术语必须在位。

## 二、方向二：Provider / Custom Endpoint 升级

### 2.1 新增能力

1. **OpenAI Compatible 全面开放**：用户在「模型配置」中填写 协议类型（OpenAI Compatible / Anthropic）、API 地址、模型 ID 即可接入任意兼容服务（DeepSeek / Qwen / Kimi / MiniMax / ChatGLM 等均走 OpenAI Compatible 协议）。
2. **自定义接口（Custom Endpoint）**：额外支持 接口路径（endpoint_path）、自定义请求头（custom_headers，写后不回显）、默认温度 / 默认最大词元数、Extra Body JSON。协议层实现于 `adapters/engine.mjs`（`request.endpointPath ?? spec.endpoint.path`，`Object.assign(headers, request.customHeaders)`，用户声明优先于协议默认，全部记录）。
3. **Provider Presets**（`config/presets.json`）：DeepSeek / Qwen / Kimi / MiniMax / ChatGLM / OpenAI / Anthropic 七个预设。**预设只是配置模板**（协议 + API 地址 + 默认模型 ID + 接口路径），无任何提示词、无任何按身份的行为分支——`tests/providers.test.mjs` 对全部 7 个预设逐一断言：wire 请求只含协议映射、系统提示词逐字来自用户输入、密钥只进 headers。
4. **模型 CRUD API**：`POST /api/models`（upsert，校验 id/协议/URL）、`DELETE /api/models/:id`、`GET /api/presets`；UI「管理模型」对话框完成添加/编辑/删除。
5. **按模型作用域的 API 密钥**：`secrets.json` 结构升级为 `{providers: {...}, models: {...}}`（兼容旧扁平结构）；解析优先级：环境变量 > 模型级密钥 > 协议级密钥。
6. **测试连接**：`POST /api/models/test` + `kernel/test-connection.mjs`。OpenAI Compatible 先 `GET /models`（不耗词元），404 时回退一次 1 词元最小补全调用；Anthropic 用 1 词元最小调用。错误只报告 HTTP 状态与分类文案（401/403/404/429/网络错误），**任何路径都不会把密钥带回给用户**（单测覆盖）。

### 2.2 Model-Agnostic 保障

- 预设内容仅为 JSON 配置模板；`if provider === 'DeepSeek' then change prompt` 之类的代码不存在（neutrality.test.mjs 静态扫描继续为 0 命中）。
- 实验记录如实记录 provider / baseUrl / modelId / endpointPath / 实际生效配置（resolvedConfig）/ temperatureSource（request | model-default | unset）；密钥零记录。
- 安全策略不变：密钥不入 bundle、不入日志、不回显；`scrub()` 保持精确键名匹配（保护 `max_tokens` 等字段不被误伤），header 类对象（customHeaders）单独使用子串匹配脱敏。

## 三、方向三：双主题 + 微动效

### 3.1 Light Theme（新增）

宣纸白（#f4f1e8）+ 米白面板 + 淡墨正文（#2b2721）+ 朱砂（#b64329）+ 降饱和暖金（#9a7b3f）+ 玉色。所有颜色经由 CSS 变量（`:root[data-theme="light"]`）统一管理，对比度满足正文可读要求。

### 3.2 Dark Theme（保留并收敛）

保留墨黑/深灰/朱砂/暗金气质，删除了过强的金色光效（印章阴影改为普通投影、诗句去除发光 text-shadow）。仅借鉴东方视觉气质，无粒子/烟雾/武侠特效。

### 3.3 主题模式

亮色 / 暗色 / 跟随系统三态循环按钮；`localStorage('gm-theme')` 持久化；`prefers-color-scheme` 实时响应；`<head>` 内联脚本在 CSS 前确定主题避免闪烁；切换无刷新、全部组件经统一变量平滑过渡（0.22s）。`?theme=light|dark` 参数供截图与演示。

### 3.4 微动效（全部 120-240ms，克制）

| 位置 | 动效 |
|---|---|
| 页面/面板进入 | opacity + translateY(6px)，180-200ms |
| 消息/思考/文件条目进入 | rise 200ms |
| 按钮 hover | translateY(-1px) + 边框/阴影变化，180ms |
| 实验记录条目 hover | 背景 + translateX(2px) |
| 运行状态徽标 | 就绪→连接中（脉冲）→流式输出中→已完成/失败，颜色与边框平滑过渡 |
| 文件上传 | 「上传中…」脉冲 → 落定列表项淡入；失败变红提示 |
| 主题切换 | 全组件 background/color/border 0.22s 过渡 |
| 打字机 | 术语说明固定文案流式呈现（保留，核心交互） |

`prefers-reduced-motion: reduce` 下所有动画/过渡时长压至 0.01ms，禁用平滑滚动（style.css 末段统一处理）。

## 四、UI 回归结果（需求三十）

以 Edge 无头浏览器截图验证：`docs/screenshots/v04-dark.png`、`v04-light.png`、`v04-term-dialog-light.png`。
检查项：无文字溢出（文件名 ellipsis、长模型名截断、长错误换行）、无按钮遮挡、无低对比正文（亮暗两版正文对比度均达标，装饰性 muted 文本除外）、主题切换无残留（变量驱动）、动画不闪烁（进入动画仅一次）。
品牌提示：跟随系统模式在无头环境判定为亮色属正确行为，暗色用 `?theme=dark` 强制验证。

## 五、协议与预设验证（需求二十九）

无真实 API Key 的环境下按需求采用非伪造验证：配置生成 / 协议映射 / 请求构建 / 参数传递 / 错误处理 / 脱敏 / UI，全部由自动化测试覆盖（providers.test.mjs 7 个用例 × 7 个预设 + 连接测试 4 例 + 自定义接口 + CRUD + 密钥作用域）。未伪造任何真实调用成功。

## 六、已知限制

1. 预设中的默认模型 ID 是编写时的常见值，服务方更名后需在模型配置中自行修改（预设本身可编辑）。
2. 部分兼容服务不提供 `GET /models`，连接测试会自动回退到 1 词元最小调用（会消耗 1 词元，属预期成本）。
3. 移除附件仍是「一键移除全部」（与 v0.3 一致，单文件移除待后续）。
4. 跟随系统主题依赖系统偏好；截图/录屏建议用 `?theme=` 参数显式指定。
5. UI 未单独暴露 timeoutMs/maxRetries 控件（API/CLI 已支持）。

## 七、结论

Phase 2 三方向全部落地且未破坏 Phase 1 的任何修复：文件输入、Web/CLI 一致性、Streaming 完成态、实验记录、密钥脱敏、Model-Agnostic、Adapter 架构、可复现性均由既有 + 新增测试持续钉死（87/87）。下一轮可进行独立安全审查。
