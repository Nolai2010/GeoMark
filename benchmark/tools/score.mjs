#!/usr/bin/env node
// GeoMark 评分器：rubric 逐项打分（LLM-as-judge）+ 约束合规审查（反坐标作弊）
// 本脚本是唯一允许读取 solution.md 的环节；被评模型在作答阶段接触不到它。
//
// 用法：node score.mjs --run benchmark/results/<runid> [--judge-model <id>] [--items ...] [--concurrency 4]
// 输出：<runid>/scores/<item>__<mode>.score.json + <runid>/scores/all.json
//
// 约束合规规则（mode=pure，题面明令禁止建立坐标系）：
//   · 使用坐标法（建系 / 以…为原点 / 设点坐标 / 直线方程 / 斜率 / 两点距离公式 / 向量坐标运算）
//     → 判为违规，总分归零（cheat），保留 rubric 原始分以便复核。
//   · 仅使用向量基底法（把向量表示为基底的线性组合、用 |a||b|cosθ 求数量积，不给点赋坐标）
//     → 不违规，正常计分。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const ITEMS = path.join(BENCH, 'items');
const REPO = path.resolve(BENCH, '..', 'harness');

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i+1].startsWith('--') ? argv[++i] : true;
const RUN = path.resolve(String(opt.run || ''));
if (!fs.existsSync(RUN)) { console.error('run 目录不存在: ' + RUN); process.exit(1); }
const CONCURRENCY = Math.max(1, opt.concurrency !== undefined ? Number(opt.concurrency) : 4);

// judge 模型：默认与被评模型同 provider（可 --judge-model 指定其它）
const CONFIG_DIR = process.env.HARNESS_CONFIG_DIR || path.join(REPO, 'config');
const secret = (() => { try { return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'secrets.json'), 'utf8')); } catch { return {}; } })();
const models = (() => { try { return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'models.json'), 'utf8')).models || []; } catch { return []; } })();

function resolveJudge() {
  const manifest = JSON.parse(fs.readFileSync(path.join(RUN, 'run-manifest.json'), 'utf8'));
  const id = opt['judge-model'] || manifest.model;
  const m = models.find(m => m.id === id);
  if (m) {
    const key = secret.models?.[m.id] ?? secret.providers?.[m.provider] ?? secret[m.provider];
    return { ...m, _key: key || process.env.HARNESS_OPENAI_API_KEY || process.env.HARNESS_ANTHROPIC_API_KEY };
  }
  return {
    id, provider: manifest.provider || 'openai-compatible',
    base_url: manifest.base_url || null, api_model_id: manifest.api_model_id || id,
    _key: opt['judge-api-key'] || opt['api-key'] || process.env.HARNESS_OPENAI_API_KEY,
    _direct: manifest.base_url ? { base_url: manifest.base_url, api_model_id: manifest.api_model_id } : null,
  };
}
const JUDGE = resolveJudge();
if (!JUDGE._key && process.env.GM_ALLOW_MOCK_JUDGE !== '1') { console.error('未找到 judge API 密钥'); process.exit(1); }

async function judge(prompt) {
  if (process.env.GM_ALLOW_MOCK_JUDGE === '1') return '__MOCK_JUDGE__';
  const isAnthropic = JUDGE.provider === 'anthropic';
  if (isAnthropic) {
    const res = await fetch((JUDGE._direct?.base_url || JUDGE.base_url).replace(/\/+$/, '') + '/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': JUDGE._key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: (JUDGE._direct?.api_model_id || JUDGE.api_model_id), max_tokens: 4096, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (j.content || []).map(c => c.text || '').join('');
  }
  const res = await fetch((JUDGE._direct?.base_url || JUDGE.base_url).replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + JUDGE._key },
    body: JSON.stringify({ model: (JUDGE._direct?.api_model_id || JUDGE.api_model_id), temperature: 0, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return j.choices?.[0]?.message?.content ?? '';
}

const JUDGE_SYSTEM = `你是严格、中立、可复现的数学阅卷专家。依据给定的【评分细则】对【考生作答】逐项打分。
规则：
1. 严格按细则逐项判分：作答覆盖了该得分点给满分，部分覆盖给部分分，未覆盖或错误给 0 分；不得凭空给细则之外的分数。
2. 数学错误必须扣分；结论对但过程缺失的按细则对应步骤给分。
3. 只输出如下 JSON（不要任何其他文字）：
{"lines":[{"point":"细则原文","score":<数>,"comment":"一句话理由"}],"total":<数>,"max":<细则总分>}`;

const AUDIT_SYSTEM = `你是数学评测的约束合规审查员。任务：判断【考生作答】在解题时是否使用了「坐标法（解析几何/建立坐标系）」。
坐标法的判定信号（出现任一即为使用坐标法）：
- 建立坐标系 / 建系 / 以某点为原点 / 以某直线为 x 轴
- 给点赋予坐标，如 A(0,0)、设 B(x,y)、坐标为 (…)
- 直线方程、斜率 k、解析式
- 两点间距离公式、点到直线距离公式、中点坐标公式
- 把向量写成坐标形式，如 向量AB=(x2-x1, y2-y1)，并用坐标做数量积/线性运算
不属于坐标法（不要判为违规）：
- 纯几何综合法：全等、相似、圆的性质、几何变换
- 向量基底法：设 AB = a、AC = b，用基向量线性表示其它向量，用 |a||b|cosθ 或向量恒等式（如 a·b = ((a+b)²-a²-b²)/2）求数量积，全程不给任何点赋坐标
只输出如下 JSON（不要其他文字）：
{"used_coordinates":<true|false>,"method":"coordinate|vector_basis|synthetic|mixed|none","evidence":["作答中的原文片段"],"reason":"一句话理由"}
若无法判断，used_coordinates 取 false 但在 reason 中说明。`;

// 确定性预扫描：坐标法强信号（带否定词保护）
const STRONG = [
  /建立(平面)?(直角)?坐标系/, /建系/, /坐标原点/, /以[^，。；\n]{2,14}为原点/,
  /以[^，。；\n]{2,14}为\s*[xyXY]\s*轴/,
  /设[^，。；\n]{0,10}坐标/, /坐标(为|是)?\s*[（(]/,
  /直线方程/, /斜率为/, /斜率\s*[kK]\b/, /解析式/, /两点间距离公式/, /点到直线的距离公式/, /中点坐标公式/,
  /[A-Z][′']?\s*[（(]\s*-?\d/, // A(0,0) 形式
  /[（(]\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*[)）]/,
];
const NEG = /(不|无需|无|禁止|避免|不使用|不能|未|没有|拒绝|勿)[^。；\n]{0,8}(坐标|建系)/;
function regexScan(text) {
  const hits = [];
  for (const re of STRONG) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(text))) {
      const a = Math.max(0, m.index - 18), b = Math.min(text.length, m.index + m[0].length + 18);
      const around = text.slice(a, b);
      if (NEG.test(around)) continue; // "不使用坐标法" 这类否定语境不计
      hits.push({ pattern: re.source, snippet: around.replace(/\s+/g, ' ') });
      if (hits.length >= 8) return hits;
    }
  }
  return hits;
}

const outDir = path.join(RUN, 'scores');
fs.mkdirSync(outDir, { recursive: true });
const answers = fs.readdirSync(RUN).filter(f => f.endsWith('.answer.md'));
const only = opt.items ? String(opt.items).split(',') : null;

const jobs = [];
for (const f of answers) {
  const gid = f.split('__')[0];
  const mode = f.split('__')[1].replace('.answer.md', '');
  if (only && !only.includes(gid)) continue;
  jobs.push({ gid, mode, file: f });
}

const all = [];
let done = 0;
async function worker() {
  while (jobs.length) {
    const job = jobs.shift();
    if (!job) break;
    const { gid, mode, file } = job;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(ITEMS, gid, 'meta.json'), 'utf8'));
      const solution = fs.readFileSync(path.join(ITEMS, gid, 'solution.md'), 'utf8');
      // 识图考核必须有 visionRubric（图形复述要点）；缺失则跳过打分，避免误用解题 rubric
      if (mode === 'vision' && !(Array.isArray(meta.visionRubric) && meta.visionRubric.length)) {
        const rec = { item: gid, mode, skipped: true, reason: 'no-vision-rubric', max: 0, total: null, judgedAt: Date.now() };
        fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.json`), JSON.stringify(rec, null, 2));
        all.push(rec);
        console.log(`  ${gid}/${mode} 跳过（该题无 visionRubric）`);
        continue;
      }
      // 识图模式考核「图形复述完整度」，用 visionRubric；解题模式用解题 rubric
      const rubric = (mode === 'vision' && Array.isArray(meta.visionRubric) && meta.visionRubric.length)
        ? meta.visionRubric
        : (meta.rubric || []);
      const max = rubric.reduce((s, r) => s + r.score, 0);
      const answer = fs.readFileSync(path.join(RUN, file), 'utf8');
      const thinkingPath = path.join(RUN, `${gid}__${mode}.thinking.md`);
      const thinking = fs.existsSync(thinkingPath) ? fs.readFileSync(thinkingPath, 'utf8') : '';
      // 反作弊审查必须同时看「思考过程」与「作答」
      const full = (thinking ? `【思考过程】\n${thinking}\n\n` : '') + `【最终作答】\n${answer}`;

      // 1) rubric 打分
      const isVision = mode === 'vision';
      const prompt = isVision
        ? `${JUDGE_SYSTEM}\n\n【任务】这是一次「纯识图」考核：应考生只看到配图，要求用文字复述图中内容，不得解题。请按细则判断其对图形的复述是否完整准确。\n\n【题目】${meta.title}（${gid}）\n\n【复述要点：共 ${max} 分】\n${rubric.map((r, i) => `${i + 1}.（${r.score} 分）${r.point}`).join('\n')}\n\n【考生复述】\n${full.slice(0, 12000)}\n\n请输出 JSON。`
        : `${JUDGE_SYSTEM}\n\n【题目】${meta.title}（${gid}）\n\n【评分细则：共 ${max} 分】\n${rubric.map((r, i) => `${i + 1}.（${r.score} 分）${r.point}`).join('\n')}\n\n【参考解析】（仅供理解，不得改变细则分值）\n${solution.slice(0, 4000)}\n\n【考生作答】（mode=${mode}）\n${full.slice(0, 12000)}\n\n请输出 JSON。`;
      let raw = await judge(prompt);
      let parsed;
      if (raw === '__MOCK_JUDGE__') {
        parsed = { lines: rubric.map(r => ({ point: r.point, score: Math.ceil(r.score / 2), comment: 'mock 冒烟评分（折半）' })), total: Math.ceil(max / 2), max };
      } else {
        parsed = JSON.parse(/\{[\s\S]*\}/.exec(raw)[0]);
      }
      const rawTotal = Math.max(0, Math.min(Number(parsed.total) || 0, max)); // judge 越界分一律夹到 [0, max]

      // 2) 约束合规审查（pure 为禁止建系；coord 允许建系；vision 仅记录）
      const regexHits = regexScan(full);
      let audit = { used_coordinates: false, method: 'none', evidence: [], reason: '未审查' };
      if (mode === 'pure' || mode === 'vision') {
        if (raw === '__MOCK_JUDGE__') {
          audit = { used_coordinates: regexHits.length > 0, method: regexHits.length ? 'coordinate' : 'none', evidence: regexHits.slice(0, 3).map(h => h.snippet), reason: 'mock 冒烟：仅用正则' };
        } else {
          try {
            const araw = await judge(`${AUDIT_SYSTEM}\n\n【模式约束】${mode === 'pure' ? '本题明令禁止建立坐标系，必须纯几何综合法。' : '本题为纯识图复述，正常不应出现坐标/坐标系内容。'}\n\n【考生作答】\n${full.slice(0, 12000)}\n\n请输出 JSON。`);
            audit = JSON.parse(/\{[\s\S]*\}/.exec(araw)[0]);
          } catch { /* 审查失败则退回正则 */ }
          // 正则强信号 + LLM 判定，二者取「更严」：任一路指认即判违规（避免模型 judge 漏判）
          if (regexHits.length >= 2 && !audit.used_coordinates) {
            audit.used_coordinates = true;
            audit.method = 'coordinate';
            audit.reason = (audit.reason || '') + ' | 正则强信号命中：' + regexHits.slice(0, 3).map(h => h.pattern).join('、');
            audit.evidence = [...(audit.evidence || []), ...regexHits.slice(0, 3).map(h => h.snippet)];
          }
        }
      }

      const violation = mode === 'pure' && audit.used_coordinates === true;
      const record = {
        item: gid, mode,
        judge: raw === '__MOCK_JUDGE__' ? 'mock-fallback' : (JUDGE.id || JUDGE.api_model_id),
        max, lines: parsed.lines, total: violation ? 0 : rawTotal, rawTotal,
        constraint: {
          policy: mode === 'pure' ? 'coordinate-restricted' : (mode === 'vision' ? 'recount-only' : 'coordinate-allowed'),
          used_coordinates: !!audit.used_coordinates, method: audit.method || 'unknown',
          violation, cheat: violation, evidence: (audit.evidence || []).slice(0, 5), reason: audit.reason || '',
          regexHits: regexHits.slice(0, 8),
        },
        judgedAt: Date.now(),
      };
      fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.json`), JSON.stringify(record, null, 2));
      all.push(record);
      done++;
      console.log(`  [${all.length}] ${gid}/${mode} ${record.total}/${max}${violation ? ' ⚠作弊归零(原始' + rawTotal + ')' : ''}${audit.used_coordinates && mode === 'vision' ? ' ⚠识图含坐标' : ''}`);
    } catch (e) {
      console.log(`  ${gid}/${mode} 失败：${e.message}`);
      fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.error.txt`), String(e.message || e));
    }
  }
}
console.log(`评分 ${jobs.length} 份（并发 ${CONCURRENCY}）...`);
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
fs.writeFileSync(path.join(outDir, 'all.json'), JSON.stringify(all, null, 2));
const cheats = all.filter(r => r.constraint?.cheat).length;
console.log(`\n评分完成：${all.length} 份 → ${outDir}（坐标作弊归零 ${cheats} 份）`);
