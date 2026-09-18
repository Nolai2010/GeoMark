# GeoMark Benchmark

> 与 `harness/` 配套的标准化题目集：同一题库，同一条件，跨模型公平评测。

## 目录结构

```text
benchmark/
├── README.md            本说明
├── dataset.json         数据集清单（版本 + 每题 problem/meta/solution 哈希 + 图片哈希）
├── docs/
│   ├── EVALUATION-PROTOCOL.md   评测协议（模式、隔离、评分、约束合规）
│   ├── FAILURE-TAXONOMY.md      失败分类 F01–F08
│   ├── EXTERNAL-DATASETS.md     外部题库评估（ZhongkaoGeo / GeoLaux / MM-MATH）
│   └── RESULTS.md               最近一次运行的结果快照
├── items/GM-XXXX/       核心题库（手工核验答案与 rubric）
│   ├── problem.md       题面（含作答要求）
│   ├── solution.md      标准解、答案、评分要点
│   ├── meta.json        结构化元数据（answer / rubric / visionRubric / difficulty / coordinatePolicy / source）
│   └── assets/          配图（PNG）
├── datasets/            导入的外部题库（与核心题库隔离，默认不参与运行）
│   ├── mm-math/items/MM-XXXX    MM-MATH hard 几何 507 题（MIT）
│   └── geolaux/items/GL-XXXX    GeoLaux 2186 题（含辅助线标注）
├── sources/             采集与转写中间产物（gitignore）
└── tools/               采集、转写、导入、作答、评分、汇总
```

## 条目规范

- **编号**：`GM-XXXX`，四位递增，一经发布不复用。
- **`meta.json`** 必填：`id / title / subject / category / coordinatePolicy / knowledgeScope / questionType / answer / rubric / difficulty / source / tags`。
- **`rubric`**：解题评分细则（逐项分值之和 = 满分），必须可判分，纯记忆性答案不给满分。
- **`visionRubric`**：识图模式的「图形复述要点」。**缺失的条目不参与识图统计**（避免用解题 rubric 误判复述质量）。
- **题面**：Markdown + LaTeX（`$…$` 行内、`$$…$$` 块级），与 Harness 渲染管线一致。
- **作答要求**：题面末尾统一注明输出格式，保证跨模型输入一致。
- **中立性**：题面不得包含针对特定模型的提示、示例或引导。

## 题库来源

题面取自公开**免费真题**（来源、年份、地区写入 `meta.json.source`），经 docx 解析 + 公式图视觉转写还原为 Markdown/LaTeX，答案与评分要点经独立复核（含数值验证）。

## 三类模式

| 模式 | 输入 | 约束 | 考核目标 |
|---|---|---|---|
| `vision` | 仅配图 | 不得解题 | 图形理解（按 `visionRubric` 判分） |
| `coord` | 题面 + 配图 | 允许建系 | 通用解题能力 |
| `pure` | 题面 + 配图 | 禁止建系 | 约束遵循 + 几何综合推理 |

详见 [`docs/EVALUATION-PROTOCOL.md`](docs/EVALUATION-PROTOCOL.md)。

## 评测流水线（`benchmark/tools/`）

```text
fetch-sources.mjs   采集免费真题直链（第一试卷网）
      ↓
fetch-papers.mjs    下载 RAR → 解压 → 只保留试卷文档（删除压缩包与垃圾文件）
      ↓
docx2text.mjs       解析 docx：文本 + 配图（公式为 MathType OLE 图，按原位标记）
      ↓
find-geometry.mjs   按关键词打分，定位平面几何题
      ↓
prepare-problems.mjs 生成「待转写任务」+ 需转公式清单
   wmf2png.ps1       把 MathType 公式图转 PNG（限长边、24bpp）
      ↓
transcribe-problems.mjs  视觉模型把公式图还原为 LaTeX，输出完整题面
      ↓
build-items.mjs     生成 items/GM-XXXX（problem.md / solution.md / meta.json）
      ↓
dataset-manifest.mjs  生成 dataset.json（版本化 + 哈希）

run-eval.mjs        并发作答（每题独立请求、无共享上下文）→ results/<runid>/
      ↓
score.mjs           rubric 逐项打分 + 约束合规审查（坐标作弊归零）→ scores/
      ↓
summarize.mjs       对比表 + 作弊明细 + 失败分类 + 重复运行稳定性 → summary.md/.csv/.json
```

**隔离保证**：`run-eval.mjs` 作答阶段只读取 `problem.md + meta.json + PNG`，代码中不存在读取 `solution.md` 的路径；`score.mjs` 是唯一读取 `solution.md` 的环节。

## 常用命令

```bash
# 采集某分类的免费真题直链（zhongkao=中考706 / gaokao=高考728）
node benchmark/tools/fetch-sources.mjs --cat zhongkao --pages 1-6

# 下载 + 解压（只留试卷文档）
node benchmark/tools/fetch-papers.mjs --manifest benchmark/sources/manifest.zhongkao.json --max 40
#   也可用 --picks 334490,334489 精确指定条目

# docx → 文本 + 配图；定位几何题；准备转写任务
node benchmark/tools/docx2text.mjs
node benchmark/tools/find-geometry.mjs --top 40
node benchmark/tools/prepare-problems.mjs
#   公式图转换（PowerShell）
powershell -File benchmark/tools/wmf2png.ps1 -List benchmark/sources/.work/needed-wmf.txt -OutDir benchmark/sources/.work/formula-png
node benchmark/tools/transcribe-problems.mjs --concurrency 3

# 生成题库与清单
node benchmark/tools/build-items.mjs
node benchmark/tools/dataset-manifest.mjs --version 0.1

# 作答（并发、断点续跑）
node benchmark/tools/run-eval.mjs --model deepseek-chat --temperature 0 --concurrency 6 --out benchmark/results/run1
#   可选：--items GM-0101,GM-0102 --modes coord,pure --resume --dry-run --vision/--no-vision

# 评分（含坐标作弊检测）
node benchmark/tools/score.mjs --run benchmark/results/run1 --concurrency 4

# 汇总
node benchmark/tools/summarize.mjs --run benchmark/results/run1
#   重复运行稳定性：--runs benchmark/results/run1,benchmark/results/run2
```

- 每次请求记录 `promptHash`（SHA-256 前 16 位）、`temperature`、`max_tokens`、usage、时间戳，写入 `run-manifest.json`。
- `results/`、`sources/` 已 gitignore；科研复现 = 相同 `datasetHash` + 相同 `promptHash` + 相同 rubric + 相同 judge 配置。
- 冒烟：`GM_ALLOW_MOCK_JUDGE=1` 允许确定性折半评分（仅流水线验证用，记录标注 mock-fallback）。

## 外部题库导入

评估结论与协议冲突说明见 [`docs/EXTERNAL-DATASETS.md`](docs/EXTERNAL-DATASETS.md)。

```bash
# MM-MATH（THU-KEG，MIT）：几何子集；不带 --difficulty 即为全部 4,335 题
node benchmark/tools/import-mm-math.mjs --difficulty hard

# GeoLaux（ACL 2026）：全量 2,186 题；--with-aux 附带含辅助线的图形
node benchmark/tools/import-geolaux.mjs --with-aux
#   可选：--type proving|calculation  --min-steps 10  --limit N

# 对导入题库做评测（默认只跑核心题库，需显式指定 --items-dir）
node benchmark/tools/run-eval.mjs --model deepseek-chat \
  --items-dir benchmark/items,benchmark/datasets/geolaux/items \
  --out benchmark/results/gl-test
node benchmark/tools/score.mjs --run benchmark/results/gl-test \
  --items-dir benchmark/items,benchmark/datasets/geolaux/items
```

导入库条目的 `meta.json.source` 保留原始出处与协议信息；GeoLaux 的协议冲突（仓库写 MIT / 论文写 CC BY-NC-SA 且禁止商用）已双记，供下游自行判断。
