# GeoMark 榜单

> AI 几何推理评测 · 25 题全双盲独立对话 · rubric 逐项评分 · 作弊检测（禁止建系仍建系 → 归零）
> 每题拆 5 个独立轨道：PNG识图 / 平面可建系 / 平面纯几何 / 立体可建系 / 立体纯几何
> 详细协议见 [README.zh.md](README.zh.md) · 更新：2026-10-05

## ⚠ v1 口径说明（发图差异）

评测协议定义 coord/pure 轨为「题面 + 配图」。**本轮实测**：支持图像输入的模型（deepseek-chat）在 coord/pure 收到了配图；deepseek-flash 因模型配置误标 `supports_vision=false` 而只收到纯文字题干（事后核实其 V4.1-Flash 原生支持图像输入，配置已修正）。因此**跨行总分不可直接比较**，flash 的分数应理解为「无图裸考」成绩。

**v1.1 roadmap**：所有模式统一向 API 发送配图，消除该差异；届时 flash 等模型将带图重测。

## 总榜（按可用轨道均值排序）

| 模型 | PNG识图 | 平面可建系 | 平面纯几何 | 立体可建系 | 作弊归零 | 总分* |
|---|---|---|---|---|---|---|
| deepseek-flash | —† | 86% | 0%‡ | 80% | 13 题 | **55.3** |
| deepseek-chat (V3.2) | 37% | 52% | 29% | 83% | 3 题 | **50.2** |

## 待测名单（2026-10-05 联网核实，标注 ✓ 为已验证在售）

| 厂商 | 旗舰档 | 平衡档 | 低成本档 | 图像输入 |
|---|---|---|---|---|
| OpenAI ✓ | gpt-6-astra（$10/$50） | gpt-6.1-sol（$2/$10，官方主推；gpt-6-sol 仍在售） | gpt-6-luna（$0.10/$0.50） | 全系支持 |
| OpenAI 上代 ✓ | gpt-5.6-sol | gpt-5.6-terra | gpt-5.6-luna | 全系支持 |
| Anthropic ✓ | claude-fable-5-1（$10/$50） | claude-opus-5-5（$4/$20） | claude-sonnet-5-5（$2/$10）、claude-haiku-4-5（$1/$5） | 全系支持 |
| Google ✓ | gemini-3.1-pro-preview | gemini-3.8-flash（$0.75/$3.75 促销）、gemini-3.7-flash | gemini-3.5-flash-lite 等 | 全系支持 |
| DeepSeek ✓ | deepseek-v4-pro | deepseek-flash（=V4.1-Flash，原生图像输入） | — | 仅 flash |
| 阿里 ✓ | qwen3.8-max（¥12/¥36） | qwen3.7-plus | qwen3.8-flash | 部分 |
| 月之暗面 ✓ | kimi-k3（$3/$15，2.8T 开源权重） | — | — | ✓ |
| 字节 ✓ | doubao-seed-2.1-pro | doubao-seed-2.1-turbo | doubao-seed-2.1-lite、doubao-seed-evolving | 部分 |
| 智谱 ✓ | glm-5.3（743B 开源 MIT）、glm-5.2 | glm-5.1 / glm-5 | glm-5.3-flash、glm-4-flash | glm-4v-plus 等 |
| MiniMax ✓ | minimax-m3 | minimax-m2.7 | minimax-m2.5-lightning | ✓ |
| 百度 | ernie-5.1、ernie-5.0 | ernie-x1.1-preview | ernie-4.5-turbo 系列 | ernie-4.5-turbo-vl |
| 腾讯/阶跃/讯飞/百川/书生/小米 | hunyuan-turbos、step-5-preview、spark-x2.5、Baichuan4、Intern-S2、mimo-v2.5-pro | — | — | 部分 vision 后缀型号 |

未逐一验证的行仅收录公开报道中出现过的型号，接入前请以各厂商官方文档为准。另注意：DeepSeek 官方已宣布 `deepseek-chat`/`deepseek-reasoner` 别名进入退役流程（现仍可用）；阿里 DashScope 2026-10-10 将下线 30+ 旧模型 ID。

\* 总分 = 可用轨道均值（0 题轨道不计）。flash 无 vision 轨、chat 有，口径不同，跨行比较请谨慎（另见上方 v1 口径说明）。
† flash 不支持图像输入，vision 轨未测。
‡ 13 道 restricted 题**全部**因「思考过程中出现坐标草稿」被判 coordinates 归零（多数原始分满分）。评测规则：禁止建系 = 全程不建，思维链草稿也算。该分数反映的是规则口径下的 0%，而非模型纯几何能力上限。

## 已确认的可传播发现

1. **「明确禁止建系，模型仍偷偷建系」**：deepseek-chat 3 题在作答中建系被文本证据抓获归零；deepseek-flash 更极端——13 道 restricted 题的思维链里**全部**出现坐标草稿（哪怕最终作答走纯几何），按规则全数归零。思维链让「偷跑坐标校验」无处遁形，这是纯文本 benchmark 抓不到的。
2. **思维链不等于更强几何**：flash 可建系 86% 高于 chat 52%，但禁掉坐标后归零到 0%——速度型模型的纯几何底子反而更薄。
3. **识图是最短板**：chat 看图做（37%）远差于读题做（52%），模型"看不懂"几何图。
4. **评分器也曾被思维链骗过**：flash 思维链里的 ``` 演算草稿一度触发「代码块=作弊」规则、正文干净却被归零 14 份——已修复（cfm 只审最终作答），修复记录见评测协议。

## 运行明细

- [deepseek-chat 完整报告](benchmark/docs/results/lb-deepseek-chat/summary.md)（25 题 × 3 模式逐题得分、失败分类 F01–F08、作弊证据片段）
- [deepseek-flash 完整报告](benchmark/docs/results/lb-deepseek-flash/summary.md)
- 复现：`node benchmark/tools/run-eval.mjs --model <id> --modes vision,coord,pure` → `score.mjs` → `summarize.mjs`
