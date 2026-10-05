# GeoMark 榜单

> AI 几何推理评测 · 25 题全双盲独立对话 · rubric 逐项评分 · 作弊检测（禁止建系仍建系 → 归零）
> 每题拆 5 个独立轨道：PNG识图 / 平面可建系 / 平面纯几何 / 立体可建系 / 立体纯几何
> 详细协议见 [README.zh.md](README.zh.md) · 更新：2026-10-05

## 总榜（按可用轨道均值排序）

| 模型 | PNG识图 | 平面可建系 | 平面纯几何 | 立体可建系 | 作弊归零 | 总分* |
|---|---|---|---|---|---|---|
| deepseek-flash | —† | 86% | 0%‡ | 80% | 13 题 | **55.3** |
| deepseek-chat (V3.2) | 37% | 52% | 29% | 83% | 3 题 | **50.2** |
| gpt-5.6-sol | 待测 | 待测 | 待测 | 待测 | — | — |
| claude (anthropic) | 待测 | 待测 | 待测 | 待测 | — | — |
| 其他模型 | 待测 | 待测 | 待测 | 待测 | — | — |

\* 总分 = 可用轨道均值（0 题轨道不计）。flash 无 vision 轨、chat 有，口径不同，跨行比较请谨慎。
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
