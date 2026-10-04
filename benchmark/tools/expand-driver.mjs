#!/usr/bin/env node
// GeoMark 扩题 driver —— 从 benchmark/sources/transcribed 生成新题（GM-01XX）
// 流程（每题）：
//   1. GEN    ：DeepSeek 生成 meta（title/topics/rubric/answer）+ solution.md（纯几何主解法 + 坐标复核）
//   2. SOLVE  ：零上下文独立求解（同 run-eval coord 模式口径），防"参考答案幻觉"
//   3. COMPARE：仲裁两份答案是否一致；不一致 → 带提示重试 SOLVE 一次 → 仍不一致标记 conflict
//   4. 写入 items/GM-01XX/（meta.json + problem.md + solution.md + assets/figure.png）
// 进度落盘 benchmark/results/expansion-progress.json，支持 --resume 断点续跑。
// 预算止损：--stop-cost（元，估算），超线即停。
//
// 用法：
//   node expand-driver.mjs [--pool id1,id2,...] [--start GM-0109] [--stop-cost 6] [--dry-run] [--resume] [--concurrency 1]
// 环境要求：node 22+（fetch 全局可用）；密钥在 harness/config/secrets.json providers.openai-compatible
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withRetry } from './lib/retry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const REPO = path.resolve(BENCH, '..', 'harness');
const PROGRESS = path.join(BENCH, 'results', 'expansion-progress.json');

// ---------- args ----------
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
}
const STOP_COST = opt['stop-cost'] !== undefined ? Number(opt['stop-cost']) : 6; // 元
const START_ID = String(opt.start || 'GM-0109');
const DRY = !!opt['dry-run'];
const RESUME = !!opt.resume;
const ONLY = opt.pool ? String(opt.pool).split(',') : null;

// ---------- model config（与 run-eval.mjs 同源解析） ----------
const CONFIG_DIR = process.env.HARNESS_CONFIG_DIR || path.join(REPO, 'config');
const SECRET = (() => { try { return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'secrets.json'), 'utf8')); } catch { return {}; } })();
const MODEL_ID = String(opt.model || 'deepseek-chat');
const MODELS = (() => { try { return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'models.json'), 'utf8')).models || []; } catch { return []; } })();
const M = MODELS.find(m => m.id === MODEL_ID);
if (!M) { console.error(`models.json 未找到 ${MODEL_ID}`); process.exit(1); }
const KEY = SECRET.models?.[M.id] ?? SECRET.providers?.[M.provider] ?? SECRET[M.provider] ?? process.env.HARNESS_OPENAI_API_KEY;
if (!KEY && !DRY) { console.error('未找到 API 密钥'); process.exit(1); }

// ---------- 预算与用量 ----------
let usage = { inMiss: 0, inHit: 0, out: 0, calls: 0 };
// 保守估价（元/1M tokens）：未命中输入 2、命中输入 0.2、输出 4
function estCost() { return (usage.inMiss * 2 + usage.inHit * 0.2 + usage.out * 4) / 1e6; }
function overBudget() { return estCost() >= STOP_COST; }

// ---------- API ----------
async function chat(messages, { json = false, maxTokens = 8192, temperature = 0, label = 'chat' } = {}) {
  const body = { model: M.api_model_id, messages, temperature, max_tokens: maxTokens, stream: false };
  if (json) body.response_format = { type: 'json_object' };
  const res = await withRetry(label, async () => {
    const r = await fetch(M.base_url.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`HTTP ${r.status} ${label}: ${t.slice(0, 300)}`); }
    return r.json();
  }, { tries: 3, baseMs: 3000 });
  usage.calls++;
  if (res.usage) {
    const u = res.usage;
    const hit = u.prompt_cache_hit_tokens || 0;
    const miss = (u.prompt_tokens || 0) - hit;
    usage.inMiss += miss; usage.inHit += hit; usage.out += u.completion_tokens || 0;
  }
  return res.choices[0].message.content;
}

// ---------- 题池 ----------
// 用户指令：排除尺规作图题，只收几何证明/几何计算（2026-10-04）
const EXCLUDED = new Set(['334460', '334467', '334489']); // 无锡24/山西21/浙江21 = 尺规作图题
const INGESTED = new Set(['334459', '333078', '334461', '334442', '334458', '333101', '334448', '333105']);
const POOL = [];
{
  const tdir = path.join(BENCH, 'sources', 'transcribed');
  for (const f of fs.readdirSync(tdir).sort()) {
    const id = f.split('__')[0];
    if (INGESTED.has(id) || EXCLUDED.has(id)) continue;
    const taskId = f.replace(/\.md$/, '');
    const taskPath = path.join(BENCH, 'sources', 'tasks', taskId + '.json');
    if (!fs.existsSync(taskPath)) { console.warn(`跳过 ${id}：无 task json`); continue; }
    const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
    const figures = (task.figures || []).map(x => {
      const w = path.join(BENCH, 'sources', '.work2', `${id}__${x.srcName.replace(/\.png$/, '')}__white.png`);
      const raw = path.join(BENCH, 'sources', '.work2', `${id}__${x.srcName}`);
      const p = fs.existsSync(w) ? w : (fs.existsSync(raw) ? raw : null);
      return p ? { label: x.label, path: p } : null;
    }).filter(Boolean);
    POOL.push({ id, taskId, no: task.no, paper: task.paper, note: task.note, md: path.join(tdir, f), figures });
  }
}
const pool = ONLY ? POOL.filter(p => ONLY.includes(p.id)) : POOL;
console.log(`题池 ${pool.length} 道：`, pool.map(p => `${p.id}#${p.no}`).join(' '));
if (DRY) { console.log('[dry-run] 题池与配置验证通过，未调用任何 API'); process.exit(0); }

// ---------- 生成元数据/解析 ----------
function readProblem(p) {
  let md = fs.readFileSync(p.md, 'utf8');
  md = md.replace(/^<!--[^>]*-->\s*/, '');
  // 剥离转写时混入的下一题题号残留（如结尾孤立的 "27."）
  md = md.replace(/\n\s*\d+\.\s*$/, '').trim();
  return md;
}

const GEN_SYSTEM = `你是 GeoMark 数学基准的命题专家。给定一道初中几何真题题面，产出严格的 JSON（不要输出任何 JSON 之外的内容）。
字段要求：
- title: 简短题目标题（10~20字，概括核心考点与方法）
- knowledgeScope: {"stage":"初中","topics":[3~5个知识点]}
- questionType: "解答题"
- difficulty: "easy"|"medium"|"hard"|"challenge"
- geometryDimension: "planar"（平面）或 "solid"（立体）
- coordinatePolicy: "restricted" 或 "allowed"。判定规则：若本题存在标准的纯几何综合法解法（不建坐标系），且你能给出这样的主解法，则 "restricted"；若题目本质上依赖坐标/向量法才能干净求解，则 "allowed"。
- answer: 各小问最终答案的精炼汇总（一行一问，含精确值：根号/分数，不用小数）
- answerKey: 关键步骤数组（每步一句话，注明所用定理）
- solutionOutline: 参考解法的路线概述（2~4 句：主解法用什么路线、各小问怎么衔接）
- rubric: [{point, score}] 评分点数组，score 合计等于该题标准分值（按小问分值；题面未给分值时合计设 12 分）
- visionRubric: [{point, score}]（若有配图）识图得分点：图中几何对象、位置关系、标注数值，score 合计 10 分；无配图则 []
- confidence: "high"|"medium"|"low"——你对参考解法正确性的自信度
注意：中考真题，解法必须严谨完整；数值必须自洽（各小问互相验证）。若你发现题面信息不足以求解，confidence 用 "low" 并在 solutionOutline 开头注明缺口。`;

const SOLUTION_SYSTEM = `你是 GeoMark 数学基准的解析撰写专家。给定一道初中几何真题题面与解法路线概述，撰写完整参考解析（直接输出 Markdown 正文，不要代码块包裹，不要多余寒暄）。
写作纪律（重要）：
- 只给最终确定的推导，禁止出现"这还不能…需换一条路径""我们试试…"等试探、自我纠错或回溯的过程性废话；
- 每一步必须由上一步严格推出，全篇逻辑单一贯通；
- 先在内部完成全部推理与数值验算，再落笔成文。
结构要求：
1. 第一行一级标题「# 参考解析」。
2. 若题目存在标准纯几何综合法（不建坐标系）：第一小节为「## 参考解法（纯几何）」——逐步编号，每步注明所用定理/性质，覆盖所有小问；随后可加「## 数值复核（坐标/解析法）」小节做数值自洽验证（可省略）。
3. 若题目本质依赖坐标/向量法：第一小节为「## 参考解法」，按该题最标准的路线写。
4. 最后一节「## 评分参考」：按小问列评分点与分值；若题面未给分值，合计 12 分并注明"分值为编制参考"。
要求：严谨完整、数值精确（根号/分数，不用小数）、各小问数值互相自洽。`;

const SOLVE_INSTRUCTION = `（评测要求：请解答这道初中几何题。给出完整、严谨的解答过程，每一步注明所用定理；数值答案给出精确值（可含根号、分数）。最后一行以「最终答案：」开头，逐小问给出最终结果。）\n\n`;

function normalizeAnswer(s) {
  return String(s).toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，、]/g, ',')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/√/g, 'sqrt')
    .replace(/\d+\.\d+/g, m => String(Number(m))); // 1.50 -> 1.5
}

async function processItem(p, gid) {
  const problem = readProblem(p);
  const hasFig = p.figures.length > 0;
  console.log(`\n===== ${gid} | ${p.id} 第${p.no}题 | ${p.note} =====`);

  // 1) GEN-meta（小 JSON，避免长解析导致 JSON 截断）
  const genRaw = await chat([
    { role: 'system', content: GEN_SYSTEM },
    { role: 'user', content: `题面如下（来源：${p.paper} 第${p.no}题）：\n\n${problem}\n\n${hasFig ? `（本题有一张配图，内容概述：${p.note}。visionRubric 请基于典型该类配图结构编写。）` : '（本题无配图，visionRubric 为 []）'}` },
  ], { json: true, label: `gen-${gid}` });
  const gen = (() => { try { return JSON.parse(genRaw); } catch { return JSON.parse(genRaw.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '')); } })();

  // 1b) GEN-solution（独立撰写完整解析，纯文本不走 JSON）
  const solutionMd = await chat([
    { role: 'system', content: SOLUTION_SYSTEM },
    { role: 'user', content: `题面：\n\n${problem}\n\n解法路线概述：\n${gen.solutionOutline || gen.answer}` },
  ], { label: `sol-${gid}` });

  // 2) SOLVE（零上下文，独立求解）
  async function solveOnce(hint = '') {
    const out = await chat([
      { role: 'user', content: SOLVE_INSTRUCTION + (hint ? `（注意：${hint}）\n\n` : '') + problem },
    ], { label: `solve-${gid}` });
    return out;
  }
  const solve1 = await solveOnce();
  // 3) COMPARE（仲裁：参考答案 vs 独立求解）
  async function await2Compare(ans, sol) {
    const cmpRaw = await chat([
      { role: 'system', content: `你是数学答案仲裁员。给出一道题的参考答案与某解题者的最终答案，判断二者是否一致（数值等价、写法不同也算一致）。只输出 JSON：{"match": true|false, "reason": "一句话"}` },
      { role: 'user', content: `题面：\n${problem}\n\n参考答案：\n${ans}\n\n解题者最终答案（截取末尾）：\n${String(sol).slice(-1500)}` },
    ], { json: true, maxTokens: 512, label: `cmp-${gid}` });
    try { return JSON.parse(cmpRaw); } catch { return { match: false, reason: '仲裁输出解析失败' }; }
  }
  let cmp = await await2Compare(gen.answer, solve1);
  let solveFinal = solve1;
  let verified = cmp.match;
  if (!verified) {
    console.log(`  答案不一致（${cmp.reason}）→ 重试求解一次`);
    const solve2 = await solveOnce('首次求解与标准答案不一致，请重新审视每一步，特别注意小问间的数值自洽');
    const cmp2 = await await2Compare(gen.answer, solve2);
    if (cmp2.match) { verified = true; solveFinal = solve2; }
  }

  // 4) 组装并写入
  const itemDir = path.join(BENCH, 'items', gid);
  const assetsDir = path.join(itemDir, 'assets');
  if (DRY) { console.log(`  [dry-run] ${gid} 组装完成（不落盘）| conf=${gen.confidence}`); return { status: 'dry-ok', meta: null }; }
  fs.mkdirSync(assetsDir, { recursive: true });
  if (hasFig) fs.copyFileSync(p.figures[0].path, path.join(assetsDir, 'figure.png'));

  const policy = (gen.coordinatePolicy === 'restricted' && (gen.confidence === 'high' || gen.confidence === 'medium')) ? 'restricted' : 'allowed';
  const meta = {
    id: gid,
    title: gen.title,
    subject: 'math',
    category: 'plane_geometry',
    coordinatePolicy: policy,
    reviewStatus: verified ? 'auto-verified' : 'auto-conflict',
    knowledgeScope: gen.knowledgeScope,
    questionType: gen.questionType || '解答题',
    answer: gen.answer,
    answerKey: gen.answerKey || [],
    difficulty: gen.difficulty || 'hard',
    figure: hasFig ? ['assets/figure.png'] : [],
    source: { site: '第一试卷网', url: 'https://www.shijuan1.com/a/sjsxzk/', paper: `${p.paper.replace(/^\d+__/, '')} 第${p.no}题`, region: p.paper.replace(/^\d+__/, '').replace(/第\d+题$/, ''), license: '免费资源' },
    dateAdded: new Date().toISOString().slice(0, 10),
    tags: gen.knowledgeScope?.topics || [],
    rubric: gen.rubric || [],
    visionRubric: gen.visionRubric || [],
    geometryDimension: gen.geometryDimension || 'planar',
    generation: { driver: 'expand-driver.mjs', genConfidence: gen.confidence || 'low', verified, conflictReason: verified ? null : cmp.reason },
  };
  if (!DRY) {
    fs.writeFileSync(path.join(itemDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    const region = meta.source.region;
    fs.writeFileSync(path.join(itemDir, 'problem.md'), `# ${gid}\n\n> 知识范围：初中数学 · ${(gen.knowledgeScope?.topics || []).join(' / ')}\n> 来源：${p.paper.replace(/^\d+__/, '')} 第${p.no}题（第一试卷网 www.shijuan1.com 免费中考真题）\n${hasFig ? '\n![题目配图](assets/figure.png)\n' : ''}\n${problem}\n\n---\n\n**作答要求**：写出完整、严谨的推理过程；每一步须注明所用定理或性质；数值答案须给出精确值（可含根号、分数），不得只给近似小数。\n`);
    const solBody = solutionMd || '';
    const solveAppend = `\n\n---\n\n## 独立验证记录（自动）\n\n生成与独立求解${verified ? '**答案一致**' : '**答案不一致：' + cmp.reason + '**'}。\n\n<details><summary>独立求解过程（零上下文）</summary>\n\n${solveFinal}\n\n</details>\n`;
    fs.writeFileSync(path.join(itemDir, 'solution.md'), `# ${gid} 参考解析\n\n> 由 expand-driver 自动生成（${new Date().toISOString().slice(0, 16)}），reviewStatus: ${meta.reviewStatus}；入库前需人工复核。\n\n${solBody}${solveAppend}`);
  }
  const status = verified ? 'written' : 'written-conflict';
  console.log(`  → ${status} | policy=${policy} | conf=${gen.confidence} | rubric=${(gen.rubric || []).reduce((s, r) => s + (r.score || 0), 0)}分`);
  return { status, meta };
}

// ---------- 主流程 ----------
function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS, 'utf8')); } catch { return { startedAt: new Date().toISOString(), items: {}, usage: null }; }
}
let prog = loadProgress();
let nextSeq = (() => {
  const m = START_ID.match(/GM-(\d+)/);
  let n = Number(m[1]);
  // 若断点续跑且目录已存在，顺延
  while (fs.existsSync(path.join(BENCH, 'items', `GM-${String(n).padStart(4, '0')}`))) n++;
  return n;
})();

for (const p of pool) {
  const gid = `GM-${String(nextSeq).padStart(4, '0')}`;
  const prev = prog.items[p.id];
  if (RESUME && prev && (prev.status === 'written' || prev.status === 'written-conflict')) {
    console.log(`跳过 ${p.id}（已完成 ${prev.status}）`);
    nextSeq++;
    continue;
  }
  if (overBudget()) { console.log(`预算止损（估算 ${estCost().toFixed(2)} 元 ≥ ${STOP_COST} 元），停止`); break; }
  try {
    const r = await processItem(p, gid);
    prog.items[p.id] = { gid, ...r, at: new Date().toISOString() };
    nextSeq++;
  } catch (e) {
    console.error(`处理 ${p.id} 失败：${e.message}`);
    prog.items[p.id] = { gid, status: 'error', error: String(e.message).slice(0, 300), at: new Date().toISOString() };
  }
  prog.usage = { ...usage, estCostYuan: Number(estCost().toFixed(3)) };
  if (!DRY) { fs.mkdirSync(path.dirname(PROGRESS), { recursive: true }); fs.writeFileSync(PROGRESS, JSON.stringify(prog, null, 2)); }
}
prog.usage = { ...usage, estCostYuan: Number(estCost().toFixed(3)) };
prog.finishedAt = new Date().toISOString();
if (!DRY) fs.writeFileSync(PROGRESS, JSON.stringify(prog, null, 2));
console.log(`\n完成。用量：${usage.calls} 次调用，in-miss ${usage.inMiss} / in-hit ${usage.inHit} / out ${usage.out} tokens，估算成本 ${estCost().toFixed(3)} 元（止损线 ${STOP_COST} 元）`);
const written = Object.values(prog.items).filter(x => x.status === 'written').length;
const conflict = Object.values(prog.items).filter(x => x.status === 'written-conflict').length;
console.log(`入库 ${written} 道，冲突待复核 ${conflict} 道`);
