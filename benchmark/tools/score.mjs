#!/usr/bin/env node
// 评分器：对照 solution.md 的评分细则，对评测作答逐项打分（LLM-as-judge）。
// 本脚本是唯一允许读取 solution.md 的环节；被评模型在作答阶段接触不到它。
//
// 用法：node score.mjs --run benchmark/results/<runid> [--judge-model <id>] [--items ...]
// 输出：<runid>/scores/<item>__<mode>.score.json + <runid>/scores/all.json
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
  // 直连模式：judge 复用 run 的 provider/base_url（--judge-api-key 或同 key 环境变量）
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
  // 流水线冒烟专用：GM_ALLOW_MOCK_JUDGE=1 时用确定性折半评分代替模型 judge（记录会标注 mock-fallback）
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

const outDir = path.join(RUN, 'scores');
fs.mkdirSync(outDir, { recursive: true });
const answers = fs.readdirSync(RUN).filter(f => f.endsWith('.answer.md'));
const only = opt.items ? String(opt.items).split(',') : null;
const all = [];

for (const f of answers) {
  const [gid, rest] = [f.split('__')[0], f.split('__')[1]];
  const mode = rest.replace('.answer.md', '');
  if (only && !only.includes(gid)) continue;
  const meta = JSON.parse(fs.readFileSync(path.join(ITEMS, gid, 'meta.json'), 'utf8'));
  const solution = fs.readFileSync(path.join(ITEMS, gid, 'solution.md'), 'utf8');
  const rubric = meta.rubric || [];
  const max = rubric.reduce((s, r) => s + r.score, 0);
  const answer = fs.readFileSync(path.join(RUN, f), 'utf8');
  const prompt = `${JUDGE_SYSTEM}\n\n【题目】${meta.title}（${gid}）\n\n【评分细则：共 ${max} 分】\n${rubric.map((r, i) => `${i + 1}.（${r.score} 分）${r.point}`).join('\n')}\n\n【参考解析】（仅供理解，不得改变细则分值）\n${solution.slice(0, 4000)}\n\n【考生作答】（mode=${mode}）\n${answer.slice(0, 8000)}\n\n请输出 JSON。`;
  process.stdout.write(`评分 ${gid}/${mode} ... `);
  try {
    let raw = await judge(prompt);
    let parsed;
    if (raw === '__MOCK_JUDGE__') {
      parsed = { lines: rubric.map(r => ({ point: r.point, score: Math.ceil(r.score / 2), comment: 'mock 冒烟评分（折半）' })), total: Math.ceil(max / 2), max };
    } else {
      const m = /\{[\s\S]*\}/.exec(raw);
      parsed = JSON.parse(m[0]);
    }
    const j = parsed;
    const record = { item: gid, mode, judge: raw === '__MOCK_JUDGE__' ? 'mock-fallback' : (JUDGE.id || JUDGE.api_model_id), max, ...j, judgedAt: Date.now() };
    fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.json`), JSON.stringify(record, null, 2));
    all.push(record);
    console.log(`${j.total}/${max}`);
  } catch (e) {
    console.log('失败：' + e.message);
    fs.writeFileSync(path.join(outDir, `${gid}__${mode}.score.error.txt`), String(e.message || e));
  }
}
fs.writeFileSync(path.join(outDir, 'all.json'), JSON.stringify(all, null, 2));
console.log(`\n评分完成：${all.length} 份 → ${outDir}`);
