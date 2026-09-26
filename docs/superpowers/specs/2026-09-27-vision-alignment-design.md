# GeoMark 愿景对齐设计（2026-09-27）

状态：已获用户四项关键决策确认（2026-09-27 凌晨 AskUserQuestion），按「Agent 模式自主推进到收尾」授权执行。
范围：**仅 Benchmark + Harness**。GeoMark Agent 层（跨平台 Skill/Pkg/SCP）本轮不做，用户明确「那是以后的事」。

## 一、用户已确认的决策

| # | 决策点 | 结论 |
|---|---|---|
| 1 | CFM 作弊判定边界 | **代码块即作弊**：作答/思考中出现 ``` 围栏代码块（无论语言标注与否）→ CFM 违规，全题 0 分。纯文本算式/伪代码不算 |
| 2 | 五对话矩阵 | 先探明题库再定（本设计给出探明结果与映射） |
| 3 | 独立 judge | **同模型零上下文会话**：judge 与被测同款模型，但每次评审都是单轮全新请求，不携带被测对话上下文；manifest/文档明确披露 |
| 4 | 范围 | 不做 Agent 层 |

预算约束：DeepSeek 余额 ¥8（≈8M tokens @99% 缓存命中）。**本轮不做全量真实多轮评测**；只做 dry-run 全量验证 + 单请求真实冒烟（≈¥0.1）。全量 3 轮命令写入文档备用。

## 二、题库探明结果（五轨映射的依据）

18 题，配图 16（GM-0001/0003 无图），visionRubric 仅真题 8 道（GM-0101..0108），restricted 8 道（全部平面），allowed 3 道（GM-0007/0009/0010），无政策 7 道。立体几何 5 道：GM-0006/0007/0008/0009/0010。平面 13 道。

**GM-0006 本轮补标 `coordinatePolicy: "allowed"`**：其评分说明明确提供空间向量法按三步给分（建系 3 + 验证 6 + 结论 3），与 GM-0007/0009/0010 被标 allowed 的情形完全一致。

### 五轨矩阵（track = f(geometryDimension, mode)，是对 item×mode 的视图，不新增请求模式）

| 轨道 | 判定 | 当前题数 |
|---|---|---|
| T1 PNG 识图 | mode=vision × 有 visionRubric | 8 |
| T2 平面可建系 | dimension=planar × mode=coord | 13 |
| T3 平面纯几何 | dimension=planar × mode=pure | 8 |
| T4 立体可建系 | dimension=solid × mode=coord | 5 |
| T5 立体纯几何 | dimension=solid × mode=pure | **0（缺口，待补题）** |

「五个并行对话，上下文不互通」由现有结构性隔离保证（run-eval 每题×每模式一次独立请求，无共享历史），文档表述对齐即可。

## 三、CFM / Skill Plugin / Web Search 作弊检测

信号与判罚（所有模式生效，含 vision）：

1. **确定性预扫描（零成本，主判据）**：正则检出 Markdown 围栏代码块（``` 开始）。有 CFM 语言标注（python/c/c++/c#/java/node/js/rust/go/php/ruby/perl/matlab…）或无标注围栏均计违规。证据取首块摘录。否定语境保护：仅在评分说明引用类文本不出现于作答，无需 NEG；作答中出现「我不能用编程解题」这类**否定句不计**（沿用坐标检测的 NEG 机制）。
2. **LLM 审查兜底（与现有坐标审查合并为一次调用，控预算）**：AUDIT_SYSTEM 扩展为四类审查 `used_coordinates / cfm / web_search / skill_plugin`，输出单 JSON。web_search/skill_plugin 主要靠 LLM 判（强信号正则仅辅助：联网/搜索引擎/网页检索/插件加载）。
3. **判罚取更严**：正则与 LLM 任一指认即违规（与现有坐标逻辑一致）。
4. 违规类型记录 `violationType: coordinates | cfm | websearch | skillplugin`，总分归零，rubric 原始分保留。失败分类沿用 **F06 约束违规**（措辞扩展为「坐标法/编程/联网/插件」）。

实现：抽公共模块 `benchmark/tools/lib/cheat-rules.mjs`（导出围栏检测、坐标正则组、NEG、regexScan、detectCfm），score.mjs 与测试共用，避免脚本内函数不可测。

## 四、独立 judge（同模型零上下文）

现状已结构性成立：judge() 每次评审都是单条 user 消息的全新请求，不含被测对话历史；audit 与 rubric 评审互相独立。本轮将其**显式化**：
- score record 增加 `judgeIdentity: { model, zeroContext: true, note }`；
- summarize 头部披露评卷身份；EVALUATION-PROTOCOL.md 增加「评审独立性」一节（零上下文定义、与被测模型同款的事实、为何可接受：rubric 锚定 + 方法中立性硬规则 + 抽检）。
- 未来升级路径（异厂商 judge / 双 judge）留文档注记，本轮不实现。

## 五、多轮均值

- run-eval 增加 `--rounds N`（默认 1）：跑 N 轮，输出目录自动加 `-r<k>` 后缀，manifest 记 `round`。每轮内部仍是 42 任务队列（vision 16 实跑 + coord 18 + pure 8）。
- summarize `--runs` 从只支持 2 个扩展为 N 个：输出 per item×mode 的均值/极差、五轨均值、稳定性（≤10pp 占比、最大极差）。不新增工具文件。
- 验证方式：dry-run 两轮核对请求计数；用临时 fixture 分数跑 summarize 验证聚合公式。真实 N 轮数据待用户充值后执行（命令见 README）。

## 六、SVG 标准答案识图对齐（机制先行，绘制待办）

- meta.json 增加可选 `answerSvg`（相对路径，SVG 源码文本）。score.mjs 识图评审时，若存在则把 SVG 源码作为【SVG 标准答案】附入 judge prompt（截断 6000 字符），与 visionRubric 共同锚定复述完整性。
- prompt 构建抽为 `benchmark/tools/lib/prompts.mjs:buildVisionJudgePrompt()`，可测。
- dataset-manifest 记录 answerSvg 存在性与内容哈希。
- **本轮不绘制 8 道真题的 SVG 标准答案**（需要人工视觉核验，列入待办清单交用户审阅后补）。

## 七、文件变更清单

| 文件 | 变更 |
|---|---|
| `benchmark/tools/lib/cheat-rules.mjs` | 新增：围栏/坐标/联网/插件检测纯函数 |
| `benchmark/tools/lib/prompts.mjs` | 新增：识图/解题 judge prompt 构建 |
| `benchmark/tools/score.mjs` | 接入上述模块；AUDIT_SYSTEM 四类审查；violationType；judgeIdentity；answerSvg 注入 |
| `benchmark/tools/run-eval.mjs` | `--rounds N`，manifest.round |
| `benchmark/tools/summarize.mjs` | N 轮均值 + 五轨均值表 + 违规类型统计 + 评审身份披露 |
| `benchmark/tools/dataset-manifest.mjs` | geometryDimension / answerSvg / trackSummary |
| `benchmark/items/*/meta.json` | 18 处 geometryDimension；GM-0006 补 allowed |
| `benchmark/dataset.json` | 重新生成（哈希更新） |
| `harness/tests/cheat-rules.test.mjs` | 新增：检测函数 + 轨道映射 + prompt 构建 + 题库完整性 |
| `README.md` / `README.zh.md` / `benchmark/docs/EVALUATION-PROTOCOL.md` / `FAILURE-TAXONOMY.md` / `GETTING-STARTED.*` | 五轨矩阵、作弊规则、评审独立性、多轮用法、计数更新 |

## 八、测试与验证策略

- 单测（进程内，规避本会话 spawn=EBUSY 环境限制）：cheat-rules 全分支、trackOf 映射、buildVisionJudgePrompt 有/无 SVG、18 题 meta 完整性（dimension 合法、allowed/restricted 与评分说明一致性抽查由既有审计流程覆盖）。
- dry-run：`run-eval --dry-run --rounds 2` 计数核对（2×42 任务、2×12 跳过）。
- summarize：Temp 下 fixture 三轮分数 → 均值/极差/五轨公式核对。
- 真实冒烟：1 题单模式 1 请求 + mock judge 评分（≈¥0.05）。
- 全量回归：既有 114 测试不回退（e2e-cli 因本会话 spawn 限制可能无法运行，另行重试并记录）。

## 九、错误处理

- 围栏检测在无 language 标注时仍判违规（用户决策），evidence 记录 lang=null。
- LLM audit JSON 解析失败 → 退回正则（沿用现状）；四类字段缺失按 false 处理并在 reason 标注。
- answerSvg 文件缺失/不可读 → 忽略该字段并在 score record 记 `answerSvgLoaded: false`，不中断评分。
- rounds 中某轮失败 → 已有 per-request error 文件机制 + resume 续跑，不重跑整轮。

## 十、预算护栏

- 全部新测试/mock 路径零 API 成本；LLM audit 仍为每份作答一次（不因四类审查增加调用数）。
- 真实冒烟 ≤2 请求。全量 3 轮（126 作答 + 252 评审）预计输出 ~40 万 tokens，留待充值后由用户触发。
