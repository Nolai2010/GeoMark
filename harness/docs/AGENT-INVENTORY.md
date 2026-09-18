# 本机 Agent 清点（Agent Inventory）

`harness/config/tracks.json` 的 Agent 赛道里，带 `kind: "app"` / `kind: "msix"` 的条目
写死了本机可执行文件路径。**这些路径不是猜的**，来自一次实际扫描。

## 为什么要清点

桌面客户端的启动方式和命令行完全不同：

| 形态 | 判定方式 | 启动方式 |
|---|---|---|
| `cli` | `PATH` 里能否找到该命令 | 新开终端窗口执行 |
| `app` | 配置里的 `exe` / `exeGlob` 指向的文件是否存在 | 直接拉起该 exe（分离进程） |
| `msix` | `%LOCALAPPDATA%\Packages\<PackageFamilyName>` 是否存在 | `explorer.exe shell:AppsFolder\<AppID>` |
| `web` | 永不判定为已安装 | 打开官网（或提示安装方式） |

`msix` 是微软商店/打包分发的应用，**没有可执行文件路径**，只能通过 AppID 启动；
这也是它必须单列一类的原因。

## 如何重新清点

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File harness/tools/scan-agents.ps1
```

输出写到 `.scan/apps.txt`，包含五类证据：

1. 开始菜单快捷方式（已解析出真实 `TargetPath`）
2. `Get-StartApps` 的 AppID（MSIX 启动必需）
3. 卸载表注册表项
4. **正在运行的进程及其完整路径** —— 最可靠的一类，进程路径不会撒谎
5. 用户目录下的工具配置目录（`.trae-cn`、`.qoder-cn` 这类）

拿到路径后填进 `tracks.json`，再跑 `npm test`：`tests/tracks-config.test.mjs`
会检查必填字段、重复 id、exe 是否绝对路径、以及路径是否被复制粘贴串行。

## 2026-09-19 清点结果

本机共登记 **35 个 Agent 目标**，自动检测到 **21 个已安装**
（国内 20 个 / 国外 15 个）。

### 桌面应用（kind: app，15 个已安装）

| 名称 | 厂商 | 区域 | 可执行文件 |
|---|---|---|---|
| ZCode | 智谱 AI | 国内 | `D:\Program Files\ZCode\ZCode.exe` |
| 智谱清言 | 智谱 AI | 国内 | `D:\Program Files\ChatGLM\智谱清言.exe` |
| TraeWork CN | 字节跳动 | 国内 | `D:\Program Files\TRAE SOLO CN\TRAE SOLO CN.exe` |
| Kimi | 月之暗面 | 国内 | `D:\Program Files\Kimi\Kimi.exe` |
| Qoder CN | 阿里巴巴 | 国内 | `D:\Program Files\Qoder CN\Qoder CN.exe` |
| MiniMax Code | MiniMax | 国内 | `D:\Program Files\MiniMax\MiniMax Code\MiniMax Code.exe` |
| MiniMax Design | MiniMax | 国内 | `%LOCALAPPDATA%\com.minimax.hub\current\MiniMax Design.exe` |
| WorkBuddy | 腾讯 | 国内 | `D:\Program Files\WorkBuddy\WorkBuddy.exe` |
| ChatCut | 腾讯 | 国内 | `D:\Program Files\ChatCut\ChatCut.exe` |
| QClaw | 腾讯 | 国内 | `D:\Program Files\QClaw\*\QClaw.exe`（带版本号目录，用通配解析） |
| ima | 腾讯 | 国内 | `D:\Program Files\IMA COPILOT\ima.copilot\ima.copilot.exe` |
| 豆包 | 字节跳动 | 国内 | `D:\Program Files\doubao\app\Doubao.exe` |
| 腾讯元宝 | 腾讯 | 国内 | `D:\Yuanbao\yuanbao.exe` |
| 千问 | 阿里巴巴 | 国内 | `D:\Program Files\Qianwen\QianwenApp\qianwen.exe` |
| Tuanjie Cowork | 团结引擎 | 国内 | `%LOCALAPPDATA%\Programs\Tuanjie Cowork\cowork.exe` |

其中 `TraeWork CN` 的安装目录名是 `TRAE SOLO CN` —— 目录名与产品名不一致，
所以 `tracks.json` 里用 `note` 记了这个对应关系，避免下次误判为「未安装」。

`QClaw` 的安装路径带版本号（`v0.2.36.628`），升级后目录名会变。因此支持
`exeGlob`：按字典序倒排取第一个命中的目录，通常即最新版。

### 商店应用（kind: msix，2 个已安装）

| 名称 | 厂商 | AppID |
|---|---|---|
| Claude 桌面版 | Anthropic | `Claude_pzs8sxrjxfjjc!Claude` |
| ChatGPT 桌面版 | OpenAI | `OpenAI.Codex_2p2nqsd0c76g0!App` |

`ChatGPT` 那条的 AppID 前缀是 `OpenAI.Codex` —— 包名和显示名不一致，
照 Chat 页面上显示的名字去猜 AppID 会写错，必须以 `Get-StartApps` 为准。

另有两个国外桌面应用：`Cursor`（`E:\Program Files\cursor\Cursor.exe`）与
`Antigravity`（`%LOCALAPPDATA%\Programs\agy\antigravity.exe`，目录名是 `agy`，
与产品名 Antigravity 不同）。

### 命令行（kind: cli，2 个已安装）

`claude`、`codex`，均在 `D:\Agents\npm-global`。其余 10 个（Gemini CLI、
Copilot CLI、opencode、Aider、Goose、Crush、Amp、Cursor Agent、Cline、
Qwen Code）本机未安装，未安装时会给出官网与安装命令。

### 仅有网页/插件形态（kind: web，0 个已安装）

TRAE CN、通义灵码（IDE 插件）、CodeBuddy、文心快码 Comate。
本机存在 `.trae-cn`、`.lingma` 配置目录，说明装过或配置过，
但找不到独立可执行文件，因此不按「已安装」处理 —— **宁可少报，也不要在用户点击时失败**。

## 安全约束

- 服务端**只启动 `tracks.json` 里登记过的 id**，请求体只能传 id，不能传路径
- `exe` 一律取自配置文件，且启动前必须通过存在性校验（`probeTarget`）
- 白名单之外一律 400 `unknown agent id`
- 路径里的 `%VAR%` 与 `~` 展开**只作用于配置字符串**，请求参数无法注入

## 验证方式

`GM_LAUNCH_DRY_RUN=1` 启动服务时，`launchAgent` 不真正拉起进程，只返回将要执行的命令。
这样可以自动化验证全部 35 个目标的分派是否正确，而不会在用户桌面上弹出一堆窗口：

```bash
GM_LAUNCH_DRY_RUN=1 node surfaces/web/server.mjs
# 然后逐个 POST /api/tracks/launch-agent {"id":"..."}，检查返回的 mode 与 cmd
```
