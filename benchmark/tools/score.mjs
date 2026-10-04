#!/usr/bin/env node
// GeoMark 评分器：rubric 逐项打分（LLM-as-judge）+ 四类约束合规审查（愿景书评分标准 3/4 条）
// 本脚本是唯一允许读取 solution.md 的环节；被评模型在作答阶段接触不到它。
//
// 用法：node score.mjs --run benchmark/results/<runid> [--judge-model <id>] [--items ...] [--concurrency 4]
// 输出：<runid>/scores/<item>__<mode>.score.json + <runid>/scores/all.json
//
// 约束合规四类（任一指认 → 总分归零 cheat，rubric 原始分保留复核）：
//   coordinates : 仅 mode=pure 判罚（细则按坐标法给分的题在 pure 下正确路线必然 0 分，不参与）
//   cfm         : 围栏代码块即作弊（``` 无论语言），所有模式（用户决策 2026-09-27）
//   websearch   : 联网检索声明，所有模式
//   skillplugin : Skill Plugin / 外部插件声明，所有模式
// 评审独立性：judge 与被测模型同款，但每次评审均为单轮全新请求（零上下文），
// 不携带被测对话历史；record.judgeIdentity 显式披露。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectCfm, scanWebSearch, scanPlugin, scanCoordinates, trackOf } from './lib/cheat-rules.mjs';
import { JUDGE_SYSTEM, AUDIT_SYSTEM, buildVisionJudgePrompt, buildSolveJudgePrompt, loadAnswerSvg } from './lib/prompts.mjs';
import { withRetry } from './lib/retry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const REPO = path.resolve(BENCH, '..', 'harness');

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i+1].startsWith('--') ? argv[++i] : true;
const RUN = path.resolve(String(opt.run || ''));
if (!fs.existsSync(RUN)) { console.error('run 目录不存在: ' + RUN); process.exit(1); }
const CONCURRENCY = Math.max(1, opt.concurrency !== undefined ? Number(opt.concurrency) : 4);
// 题库根目录：默认核心题库 benchmark/items；用 --items-dir a,b 可追加导入题库
const ITEMS_DIRS = String(opt['items-dir'] || path.join(BENCH, 'items')).split(',').map(s => path.resolve(s.trim()));
const ITEMS = ITEMS_DIRS[0];
function itemDir(gid) {
  for (const d of ITEMS_DIRS) { const p = path.join(d, gid); if (fs.existsSync(path.join(p, 'meta.json'))) return p; }
  return path.join(ITEMS, gid);
}

// judge 模型：默认与被评模型同款（零上下文评审）；可 --judge-model 指定其它
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
  // 429/5xx/网络抖动指数退避重试（默认 3 次），评审大规模跑批不再因瞬时错误缺分
  return withRetry('judge', async () => {
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
  });
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
      const dir = itemDir(gid);
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
      const solution = fs.readFileSync(path.join(dir, 'solution.md'), 'utf8');
      // 识图考核必须有 visionRubric（图形复述要点）；缺失则跳过打分，避免误用解题 rubric
      if (mode === 'vision' && !(Array.isArray(meta.visionRubric) && meta.visionRubric.length)) {
        const rec = { item: gid, mode, skipped: true, reason: 'no-vision-rubric', max: 0, total: null, judgedAt: Date.now() };
        fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.json`), JSON.stringify(rec, null, 2));
        all.push(rec);
        console.log(`  ${gid}/${mode} 跳过（该题无 visionRubric）`);
        continue;
      }
      // pure 只对声明了 restricted 的题有意义：细则按坐标法给分的题（如空间向量法）在 pure 下
      // 正确路线必然 0 分，混进均值只会制造「方法不许、细则又只认这个方法」的假阴性。
      if (mode === 'pure' && meta.coordinatePolicy !== 'restricted') {
        const rec = { item: gid, mode, skipped: true, reason: 'not-restricted', max: 0, total: null, judgedAt: Date.now() };
        fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.json`), JSON.stringify(rec, null, 2));
        all.push(rec);
        console.log(`  ${gid}/${mode} 跳过（coordinatePolicy 非 restricted，pure 不适用）`);
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

      // 1) rubric 打分（识图模式下按 meta.answerSvg 注入 SVG 标准答案）
      const isVision = mode === 'vision';
      const svgContent = isVision ? loadAnswerSvg(dir, meta.answerSvg) : null;
      const prompt = isVision
        ? buildVisionJudgePrompt({ meta, gid, rubric, max, full, svgContent })
        : buildSolveJudgePrompt({ meta, gid, rubric, max, solution, full, mode });
      let raw = await judge(prompt);
      let parsed;
      if (raw === '__MOCK_JUDGE__') {
        parsed = { lines: rubric.map(r => ({ point: r.point, score: Math.ceil(r.score / 2), comment: 'mock 冒烟评分（折半）' })), total: Math.ceil(max / 2), max };
      } else {
        parsed = JSON.parse(/\{[\s\S]*\}/.exec(raw)[0]);
      }
      const rawTotal = Math.max(0, Math.min(Number(parsed.total) || 0, max)); // judge 越界分一律夹到 [0, max]

      // 2) 四类约束合规审查（确定性预扫描 + LLM，取更严）
      //    coordinates 仅在 pure 判罚；cfm/websearch/skillplugin 所有模式判罚
      const coordHits = (mode === 'pure' || mode === 'vision') ? scanCoordinates(full) : [];
      const cfm = detectCfm(full);
      const webHits = scanWebSearch(full);
      const pluginHits = scanPlugin(full);
      let audit = { used_coordinates: false, cfm: false, web_search: false, skill_plugin: false, method: 'none', cfm_lang: '', evidence: [], reason: '未审查' };
      if (raw === '__MOCK_JUDGE__') {
        audit = {
          used_coordinates: coordHits.length > 0,
          cfm: cfm.used, web_search: webHits.length > 0, skill_plugin: pluginHits.length > 0,
          method: coordHits.length ? 'coordinate' : 'none',
          cfm_lang: cfm.langs.join(',') || '', evidence: [...coordHits.slice(0, 2), ...cfm.evidence.slice(0, 1)].map(h => typeof h === 'string' ? h : h.snippet),
          reason: 'mock 冒烟：仅用正则',
        };
      } else {
        try {
          const constraintNote = mode === 'pure' ? '本题明令禁止建立坐标系，必须纯几何综合法。'
            : (isVision ? '本题为纯识图复述，正常不应出现坐标/坐标系、代码或联网内容。' : '本题允许建系，但编程解题/联网/插件仍属作弊。');
          const araw = await judge(`${AUDIT_SYSTEM}\n\n【模式约束】${constraintNote}\n\n【考生作答】\n${full.slice(0, 12000)}\n\n请输出 JSON。`);
          const a = JSON.parse(/\{[\s\S]*\}/.exec(araw)[0]);
          audit = {
            used_coordinates: !!a.used_coordinates, cfm: !!a.cfm, web_search: !!a.web_search, skill_plugin: !!a.skill_plugin,
            method: a.method || 'unknown', cfm_lang: a.cfm_lang || '', evidence: a.evidence || [], reason: a.reason || '',
          };
        } catch { /* 审查失败则退回正则 */ }
        // 取更严：任一路指认即判违规（避免模型 judge 漏判）
        if (coordHits.length >= 2 && !audit.used_coordinates) {
          audit.used_coordinates = true;
          audit.method = 'coordinate';
          audit.reason = (audit.reason || '') + ' | 正则强信号命中：' + coordHits.slice(0, 3).map(h => h.pattern).join('、');
          audit.evidence = [...(audit.evidence || []), ...coordHits.slice(0, 3).map(h => h.snippet)];
        }
        if (cfm.used && !audit.cfm) {
          audit.cfm = true;
          audit.cfm_lang = audit.cfm_lang || cfm.langs.join(',') || 'plain';
          audit.reason = (audit.reason || '') + ' | 围栏代码块正则命中';
          audit.evidence = [...(audit.evidence || []), ...cfm.evidence];
        }
        if (webHits.length > 0 && !audit.web_search) {
          audit.web_search = true;
          audit.reason = (audit.reason || '') + ' | 联网信号正则命中';
          audit.evidence = [...(audit.evidence || []), ...webHits.slice(0, 2).map(h => h.snippet)];
        }
        if (pluginHits.length > 0 && !audit.skill_plugin) {
          audit.skill_plugin = true;
          audit.reason = (audit.reason || '') + ' | 插件/外部工具信号正则命中';
          audit.evidence = [...(audit.evidence || []), ...pluginHits.slice(0, 2).map(h => h.snippet)];
        }
      }

      // 3) 判罚：coordinates 仅 pure；其余三类所有模式
      const violationType = (mode === 'pure' && audit.used_coordinates === true) ? 'coordinates'
        : (audit.cfm ? 'cfm' : (audit.web_search ? 'websearch' : (audit.skill_plugin ? 'skillplugin' : null)));
      const violation = violationType !== null;
      const record = {
        item: gid, mode,
        track: trackOf(meta.geometryDimension, mode, meta.coordinatePolicy),
        judge: raw === '__MOCK_JUDGE__' ? 'mock-fallback' : (JUDGE.id || JUDGE.api_model_id),
        judgeIdentity: { model: JUDGE.id || JUDGE.api_model_id || 'direct', zeroContext: true, note: '与被测模型同款；每次评审均为单轮全新请求，不携带被测对话上下文' },
        max, lines: parsed.lines, total: violation ? 0 : rawTotal, rawTotal,
        constraint: {
          policy: mode === 'pure' ? 'coordinate-restricted' : (mode === 'vision' ? 'recount-only' : 'coordinate-allowed'),
          used_coordinates: !!audit.used_coordinates, method: audit.method || 'unknown',
          cfm: { used: !!audit.cfm, langs: cfm.langs || [], declaredLang: audit.cfm_lang || '' },
          web_search: !!audit.web_search, skill_plugin: !!audit.skill_plugin,
          violation, cheat: violation, violationType,
          evidence: (audit.evidence || []).slice(0, 5), reason: audit.reason || '',
          regexHits: [...coordHits.slice(0, 8)],
          answerSvgLoaded: isVision ? !!svgContent : undefined,
        },
        judgedAt: Date.now(),
      };
      fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.json`), JSON.stringify(record, null, 2));
      all.push(record);
      done++;
      const flag = violation ? ` ⚠${violationType}作弊归零(原始${rawTotal})` : '';
      const vflag = audit.used_coordinates && mode === 'vision' ? ' ⚠识图含坐标' : '';
      console.log(`  [${all.length}] ${gid}/${mode}${record.track ? '/' + record.track : ''} ${record.total}/${max}${flag}${vflag}`);
    } catch (e) {
      console.log(`  ${gid}/${mode} 失败：${e.message}`);
      fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.error.txt`), String(e.message || e));
    }
  }
}
console.log(`评分 ${jobs.length} 份（并发 ${CONCURRENCY}）...`);
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
fs.writeFileSync(path.join(outDir, 'all.json'), JSON.stringify(all, null, 2));
const cheats = all.filter(r => r.constraint?.cheat);
const byType = {};
for (const c of cheats) { const t = c.constraint?.violationType || 'unknown'; byType[t] = (byType[t] || 0) + 1; }
console.log(`\n评分完成：${all.length} 份 → ${outDir}（作弊归零 ${cheats.length} 份${Object.keys(byType).length ? '：' + Object.entries(byType).map(([k, v]) => `${k}×${v}`).join('、') : ''}）`);
