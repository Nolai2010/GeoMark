// GeoMark judge prompt 构建 —— score.mjs 与测试共用
// 抽出为纯函数的原因：识图模式需按 meta.answerSvg 注入 SVG 标准答案，
// 该逻辑必须可脱离真实 API 测试。

import fs from 'node:fs';
import path from 'node:path';

export const JUDGE_SYSTEM = `你是严格、中立、可复现的数学阅卷专家。依据给定的【评分细则】对【考生作答】逐项打分。
规则：
1. 严格按细则逐项判分：作答覆盖了该得分点给满分，部分覆盖给部分分，未覆盖或错误给 0 分；不得凭空给细则之外的分数。
2. 数学错误必须扣分；结论对但过程缺失的按细则对应步骤给分。
3. 只输出如下 JSON（不要任何其他文字）：
{"lines":[{"point":"细则原文","score":<数>,"comment":"一句话理由"}],"total":<数>,"max":<细则总分>}

【方法中立性——必须遵守】
细则描述的是「应得出的几何量与判定依据」，不是「必须走的解题路线」。
- 不得因为作答没有使用坐标系、没有出现某个点的坐标，而扣任何分。
- 不得要求作答采用与参考解析相同的路线；不同证法只要得出同样的几何量即可给满分。
- 参考解析可能包含坐标法/解析几何写法，那只是帮助理解数值，不是评分标准。
- 若细则里出现某个具体表达式（某点坐标、某条直线方程），应理解成「该几何对象已被确定」，
  作答以几何语言指明同一对象即算覆盖。`;

export const AUDIT_SYSTEM = `你是数学评测的约束合规审查员。对【考生作答】逐项审查以下四类违规（愿景书评分标准）：
1. used_coordinates —— 是否使用「坐标法（解析几何/建立坐标系）」。判定信号（出现任一即为使用）：
   - 建立坐标系 / 建系 / 以某点为原点 / 以某直线为 x 轴
   - 给点赋予坐标，如 A(0,0)、设 B(x,y)、坐标为 (…)
   - 直线方程、斜率 k、解析式
   - 两点间距离公式、点到直线距离公式、中点坐标公式
   - 把向量写成坐标形式，如 向量AB=(x2-x1, y2-y1)，并用坐标做数量积/线性运算
   不属于坐标法（不要判为违规）：纯几何综合法（全等、相似、圆的性质、几何变换）；向量基底法（设 AB = a、AC = b，
   用基向量线性表示其它向量，用 |a||b|cosθ 或向量恒等式求数量积，全程不给任何点赋坐标）。
2. cfm —— 是否出现「编程解题（Coding for Maths）」痕迹：Markdown 围栏代码块（\`\`\` 开头，无论语言）、
   可执行的伪代码块、声明运行程序/脚本求解。注意：作答声明「我不能/不允许使用编程」不算；
   【思考过程】中的围栏代码块属于模型内部演算草稿，不是调用编程工具，不要据此判 cfm——
   cfm 只看【最终作答】部分。
3. web_search —— 是否声称联网检索、引用搜索结果、打开网页获取资料。声明「不需要联网」不算。
4. skill_plugin —— 是否声称加载/调用外部 Skill Plugin、插件或外部工具链（几何画板、GeoGebra 等）。声明未使用不算。
只输出如下 JSON（不要其他文字）：
{"used_coordinates":<true|false>,"cfm":<true|false>,"web_search":<true|false>,"skill_plugin":<true|false>,
"method":"coordinate|vector_basis|synthetic|mixed|none","cfm_lang":"代码语言或空","evidence":["作答中的原文片段"],"reason":"一句话理由"}
若某项无法判断，该字段取 false 但在 reason 中说明。`;

const SVG_LIMIT = 6000;

/** 读 SVG 标准答案，读不到返回 null（不抛错，评分不中断） */
export function loadAnswerSvg(itemDir, answerSvg) {
  if (!answerSvg) return null;
  try {
    const p = path.join(itemDir, answerSvg);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8').slice(0, SVG_LIMIT);
  } catch { return null; }
}

/** 识图评审 prompt：meta.answerSvg 存在且可读时，附 SVG 标准答案供 judge 对照 */
export function buildVisionJudgePrompt({ meta, gid, rubric, max, full, svgContent }) {
  const rubricText = rubric.map((r, i) => `${i + 1}.（${r.score} 分）${r.point}`).join('\n');
  const svgBlock = svgContent
    ? `\n\n【SVG 标准答案】（本题配图的标准答案矢量图，作答应与此图在结构、元素、标注上一致）\n${svgContent}`
    : '';
  return `${JUDGE_SYSTEM}\n\n【任务】这是一次「纯识图」考核：应考生只看到配图，要求用文字复述图中内容，不得解题。请按细则判断其对图形的复述是否完整准确。\n\n【题目】${meta.title}（${gid}）\n\n【复述要点：共 ${max} 分】\n${rubricText}${svgBlock}\n\n【考生复述】\n${full.slice(0, 12000)}\n\n请输出 JSON。`;
}

/** 解题评审 prompt */
export function buildSolveJudgePrompt({ meta, gid, rubric, max, solution, full, mode }) {
  const rubricText = rubric.map((r, i) => `${i + 1}.（${r.score} 分）${r.point}`).join('\n');
  return `${JUDGE_SYSTEM}\n\n【题目】${meta.title}（${gid}）\n\n【评分细则：共 ${max} 分】\n${rubricText}\n\n【参考解析】（仅供理解，不得改变细则分值）\n${solution.slice(0, 4000)}\n\n【考生作答】（mode=${mode}）\n${full.slice(0, 12000)}\n\n请输出 JSON。`;
}
