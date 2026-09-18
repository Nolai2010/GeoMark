# 外部题库评估（External Datasets）

> 评估对象：ZhongkaoGeo / GeoLaux / MM-MATH。
> 结论先行：**三个都是真实存在的学术数据集**，但**只有 MM-MATH 是干净的 MIT**；GeoLaux 协议存在自相矛盾的声明；ZhongkaoGeo 未公开数据。
> 评估时间：2026-09-18。所有结论均附可复核的来源与原文引用。

## 汇总

| 数据集 | 真实存在 | 规模（与描述是否吻合） | 数据可获取 | 协议 | 与 GeoMark 的契合度 | 处置 |
|---|---|---|---|---|---|---|
| **ZhongkaoGeo** | ✅ 论文真实 | ✅ 89 + 83 + 105 = **277**，完全吻合 | ❌ **未找到任何公开下载** | ❓ 未声明（因未发布） | ★★★★★ 中考平面几何，L3 用中考官方评分细则算分 | **不能拿**：无数据 |
| **GeoLaux** | ✅ 论文真实 | ✅ **2186**，平均 6.51 步、34 个省级区域，吻合 | ✅ GitHub `Candice-yu/GeoLaux` | ⚠️ **自相矛盾**：仓库 LICENSE 与 README 写 MIT，论文写 MIT + **CC BY-NC-SA 4.0，禁止商用** | ★★★★★ 中考平面几何 + 辅助线标注 + 过程分 | **已拿**（按你的裁定），但协议冲突已如实标注 |
| **MM-MATH** | ✅ 论文真实 | ✅ 论文 5,929；发布版 jsonl **5,901** 行（少 28） | ✅ HF `THU-KEG/MM_Math` + GitHub | ✅ **MIT**（GitHub API 与 HF cardData 双重确认） | ★★★☆☆ 仅计算题（不含证明/作图），含代数 | **已拿**：导入 hard 几何 507 题 |

---

## 1. ZhongkaoGeo（不能拿）

**出处**：*From Symbolic Perception to Logical Deduction: A Framework for Guiding Language Models in Geometric Reasoning*（arXiv `2609.10335`，另有 OpenReview 版本）。

**内容**（与原描述逐项吻合）：

| 层级 | 来源 | 题量 |
|---|---|---|
| L1 | 2023 年及以前的官方卷与模拟卷 | 89 |
| L2 | 2024 – 2025 年初的考试 | 83 |
| L3 | 2025 年**省会与直辖市**官方中考卷（全新数据，防污染最强） | 105 |
| 合计 | | **277** |

**它的设计恰好就是我们要的**：三层按年份切分来**防数据污染**；L1/L2 用严格准确率，**L3 改用中考官方评分细则的 Scoring Rate**——即「按中考评分细则算分」，与你的诉求一致。

**为什么不能拿**：论文正文与 HTML 版中**没有数据或代码的公开链接**。检索该关键词只返回无关结果（地理 GeoJSON 等）。全文 grep 到的 GitHub 链接只有它引用的工具 TexTeller 与 LaTeXML 的样板链接。结论：**数据集未公开**。

**可行路径**：联系作者索取；或由我们按同样方法自建 L1/L2/L3（我们已有中考真题采集流水线，可复刻这个分层设计）。

## 2. GeoLaux（已拿，但协议必须留痕）

**出处**：*GeoLaux: A Benchmark for Evaluating MLLMs' Geometry Performance on Long-Step Problems Requiring Auxiliary Lines*（arXiv `2508.06226`，**ACL 2026 main**）。

**内容**（与原描述逐项吻合）：2,186 题（1,418 计算 + 768 证明），取自中国 **34 个省级区域**近两年中考卷；**平均 6.51 步**、最长 24 步；**41.8%** 需要辅助线（334 复杂 + 580 简单）。

**最大价值不是题量，是它的评测维度**——五维框架：

- **ACS** 答案正确性
- **PCS** 过程正确性（比只比答案严格）
- **PQS** 过程质量（步权重函数 + 激活函数，越早出错扣得越重）
- **辅助线影响**（业界首个对辅助线构造给出完整多模态标注的基准）
- **错误类型**

这几点直接补上了我们目前只有「rubric + 约束合规」的空白。

**⚠️ 协议冲突（必须留痕，不得掩盖）**：

- 仓库 `LICENSE` 文件与 README 写的是：`Our dataset and code are distributed under the MIT license.`
- 论文正文写的是：`we release the dataset and associated scripts under MIT and CC BY-NC-SA 4.0 licenses, strictly prohibiting commercial use.`
- GitHub API 探测到的仓库协议：`MIT`。

**处置**：按你的裁定采用（GeoMark 本身开源非商用）。但为不误导下游使用者，导入条目的 `meta.json.source` 中**同时记录两种声明**，并注明数据部分按论文口径为 CC BY-NC-SA 4.0。若日后要商用，需先向作者澄清。

## 3. MM-MATH（已拿，MIT）

**出处**：*MM-MATH: Advancing Multimodal Math Evaluation with Process Evaluation and Fine-grained Classification*（**EMNLP 2024 Findings**，清华 THU-KEG）。

**协议（双重确认，干净 MIT）**：

- GitHub `kge-sun/MM-Math`：`LICENSE` 为 MIT，API 探测 `license.spdx_id = MIT`
- HuggingFace `THU-KEG/MM_Math`：`cardData.license = "mit"`，公开未设门禁，jsonl 5.86MB + 图片包 82MB

**内容**：论文称 5,929 题，**发布版 jsonl 实际 5,901 行**（少 28，以实际发布版为准）。

| 维度 | 分布 |
|---|---|
| 难度 | easy 372 / medium 4,468 / hard 1,061 |
| 年级 | 七年级 669 / 八年级 2,581 / 九年级 2,651 |
| 知识（level_1） | Properties of Shapes 2,666 / Transformations of Shapes 1,669 / Functions 1,566 |

**局限（必须说清）**：MM-MATH 明确**只收计算型开放题，不含证明与作图**；且题面是数据集提供的**英文版**。所以它补的是「计算 + 识图」的体量，不是我们证明/作图赛道的替代品。

**已导入**：几何类（Shapes 两大类）共 4,335 题中的 **hard 507 题**，落在 `benchmark/datasets/mm-math/items/`。可通过 `--difficulty` 参数调整范围（去掉即为全部 4,335 题）。

---

## 交叉重叠提醒

GeoLaux（近两年 34 省中考卷）与 ZhongkaoGeo-L3（2025 省会/直辖市）**都取自中考真题**；我们已有的 `GM-0101..GM-0108` 也来自 2025/2026 中考卷。**三者合并入库前必须按题干做去重**，否则会出现同一道题在不同题号下重复计分，污染统计。

## 借鉴（不受版权保护的部分）

无论是否采用其数据，以下**方法**都可安全吸收：

1. **ZhongkaoGeo 的分层防污染设计**：按年份切 L1/L2/L3，把「模型没见过的题」单列一层。
2. **GeoLaux 的 PCS/PQS**：把「过程分」从我们的粗粒度 rubric 升级为逐步打分 + 步权重递减。
3. **GeoLaux 的辅助线维度**：为几何题额外标注「是否需要辅助线、辅助线文本、辅助线图」，并单列辅助线得分。

---

## 实际导入结果

| 数据集 | 导入位置 | 题量 | 占用 | 说明 |
|---|---|---|---|---|
| MM-MATH | `benchmark/datasets/mm-math/items/MM-XXXX` | **507**（hard 几何） | 18MB | 全部含配图；`--difficulty` 去掉即为几何全量 4,335 题 |
| GeoLaux | `benchmark/datasets/geolaux/items/GL-XXXX` | **2,186**（全量） | 116MB | 计算 1,418 / 证明 768；辅助线题 914 题含辅助线图 |
| ZhongkaoGeo | — | 0 | — | 无公开数据，未导入 |

**两种数据集的条目与核心题库隔离**：核心题库在 `benchmark/items/`（`GM-*`），导入库在 `benchmark/datasets/`（`MM-*` / `GL-*`）。
默认运行只跑核心题库；要跑导入库需显式指定：

```bash
node benchmark/tools/run-eval.mjs --model deepseek-chat \
  --items-dir benchmark/items,benchmark/datasets/geolaux/items \
  --items GL-0001,GL-0002 --out benchmark/results/gl-test

node benchmark/tools/score.mjs --run benchmark/results/gl-test \
  --items-dir benchmark/items,benchmark/datasets/geolaux/items
```

**难度说明**：MM-MATH 自带 easy/medium/hard 标签；**GeoLaux 没有难度标签**，导入时按其 `step_length` 推定（1–4 easy / 5–9 medium / ≥10 hard），该字段在 `meta.json` 中标注为 `difficultyBasis: derived-from-step-length`，引用时须注意。

**仍未落地的两件事**（需要时可继续）：
1. 导入库的条目暂无 `visionRubric`，因此不参与「纯识图」统计（流水线会自动跳过而非误判）。
2. 三个来源（GeoLaux / MM-MATH 几何 / 我们的 GM-0101..0108）都取材于中考真题，**合并统计前需按题干去重**。
