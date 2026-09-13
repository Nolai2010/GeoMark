#!/usr/bin/env node
// GeoMark Benchmark 评测 runner —— 三种模式
//   vision : 纯识图（仅图片，复述内容，不解题）
//   coord  : 解题，允许建立坐标系
//   pure   : 解题，禁止坐标系，纯几何综合法
// 隔离保证（结构性）：作答阶段本脚本只读取 problem.md + meta.json + PNG 图片，
// 代码中不存在任何对 solution.md 的读取路径；评分由 score.mjs 单独执行。
//
// 用法：
//   node run-eval.mjs --model <models.json 中的 id> [--items GM-0006,...] [--modes vision,coord,pure]
//        [--base-url ... --api-key ... --protocol openai|anthropic --api-model-id ...]
//        [--temperature 0] [--out benchmark/results/<runid>] [--dry-run]
// 模型与密钥默认复用 Harness 配置（config/models.json + config/secrets.json 或环境变量）。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const ITEMS = path.join(BENCH, 'items');
const REPO = path.resolve(BENCH, '..', 'harness');

// ---------- args ----------
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i+1].startsWith('--') ? argv[++i] : true; }
}
const MODES = String(opt.modes || 'vision,coord,pure').split(',');
const onlyItems = opt.items ? String(opt.items).split(',') : null;
const temperature = opt.temperature !== undefined ? Number(opt.temperature) : 0;
const DRY = !!opt['dry-run'];

// ---------- model config ----------
const CONFIG_DIR = process.env.HARNESS_CONFIG_DIR || path.join(REPO, 'config');
function loadSecrets() {
  const p = path.join(CONFIG_DIR, 'secrets.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}
function loadModels() {
  const p = path.join(CONFIG_DIR, 'models.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')).models || []; } catch { return []; }
}
const MODELS = loadModels();
const SECRET = loadSecrets();

function resolveModel() {
  if (opt['base-url']) {
    return {
      provider: opt.protocol || 'openai-compatible',
      base_url: opt['base-url'],
      api_model_id: opt['api-model-id'] || 'unknown',
      _key: opt['api-key'] || 'MISSING',
    };
  }
  const m = MODELS.find(m => m.id === opt.model);
  if (!m) { console.error(`models.json 中未找到模型 "${opt.model}"。可用：`, MODELS.map(m => m.id).join(', ')); process.exit(1); }
  const provKey = SECRET.providers?.[m.provider] ?? SECRET[m.provider];
  const modelKey = SECRET.models?.[m.id];
  return { ...m, _key: opt['api-key'] || modelKey || provKey || process.env.HARNESS_OPENAI_API_KEY || process.env.HARNESS_ANTHROPIC_API_KEY };
}
const MODEL = resolveModel();
if (!MODEL._key && !DRY) { console.error('未找到 API 密钥（config/secrets.json 或 --api-key / 环境变量）'); process.exit(1); }

// ---------- prompts ----------
const MODE_INSTRUCTION = {
  vision: '请仔细观察这张数学题配图，用文字完整、准确地复述图中展示的内容：图形类型、结构、各元素与字母标注、数值与已知关系。不要解题，不要推测图外信息。',
  coord: '（评测要求：本题允许建立平面直角坐标系或空间直角坐标系求解。请给出完整、严谨的解答。）\n\n',
  pure: '（评测要求：本题禁止建立任何坐标系，必须使用纯几何综合法——公理、判定定理、性质定理、几何变换——求解或证明。请给出完整、严谨的解答。）\n\n',
};

function loadItem(gid) {
  const dir = path.join(ITEMS, gid);
  // 注意：这里刻意不读取 solution.md —— 作答阶段与评分细则完全隔离
  const problem = fs.readFileSync(path.join(dir, 'problem.md'), 'utf8');
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const images = (meta.figure ? [].concat(meta.figure) : fs.existsSync(path.join(dir, 'assets'))
    ? fs.readdirSync(path.join(dir, 'assets')).filter(f => f.endsWith('.png')).map(f => 'assets/' + f)
    : []).map(f => path.join(dir, f));
  return { gid, problem, meta, images };
}

// ---------- provider call ----------
function b64(p) { return fs.readFileSync(p).toString('base64'); }

// 兼容 JSON 与 SSE 两种响应（部分兼容服务强制流式）
function parseResponse(res, j) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) {
    if (j.choices) return { text: j.choices?.[0]?.message?.content ?? '', usage: j.usage || null };
    return { text: (j.content || []).map(c => c.text || '').join(''), usage: j.usage || null };
  }
  // SSE：res.json() 已经把 body 读掉了——需要调用方传原文，见 callModel
  return null;
}

async function readSSE(res) {
  const text = await res.text();
  let out = '', usage = null;
  for (const line of text.split('\n')) {
    const l = line.trim();
    if (!l.startsWith('data:')) continue;
    const payload = l.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const j = JSON.parse(payload);
      const d = j.choices?.[0]?.delta || j.choices?.[0]?.message || {};
      if (d.content) out += d.content;
      if (j.usage) usage = j.usage;
    } catch { /* 忽略非 JSON 行 */ }
  }
  return { text: out, usage };
}

async function callModel(text, imagePaths) {
  const isAnthropic = MODEL.provider === 'anthropic';
  if (isAnthropic) {
    const content = [];
    for (const img of imagePaths) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64(img) } });
    content.push({ type: 'text', text });
    const res = await fetch(MODEL.base_url.replace(/\/+$/, '') + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': MODEL._key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL.api_model_id, max_tokens: 4096, temperature, messages: [{ role: 'user', content }] }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
    return { text: (j.content || []).map(c => c.text || '').join(''), usage: j.usage || null };
  }
  // openai-compatible
  const content = [];
  for (const img of imagePaths) content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64(img) } });
  content.push({ type: 'text', text });
  const res = await fetch(MODEL.base_url.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + MODEL._key },
    body: JSON.stringify({ model: MODEL.api_model_id, temperature, max_tokens: 4096, messages: [{ role: 'user', content }] }),
  });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) return await readSSE(res);
  const j = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return { text: j.choices?.[0]?.message?.content ?? '', usage: j.usage || null };
}

// ---------- main ----------
const runid = opt.out ? path.basename(String(opt.out)) : new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = opt.out ? path.resolve(String(opt.out)) : path.join(BENCH, 'results', runid);
fs.mkdirSync(OUT, { recursive: true });

const gids = onlyItems || fs.readdirSync(ITEMS).filter(d => d.startsWith('GM-'));
const manifest = { runid, model: MODEL.id || MODEL.api_model_id, provider: MODEL.provider, temperature, modes: MODES, items: [], startedAt: Date.now() };
let n = 0;

for (const gid of gids) {
  let item;
  try { item = loadItem(gid); } catch (e) { console.error('跳过', gid, e.message); continue; }
  for (const mode of MODES) {
    const text = (mode === 'vision' ? '' : item.problem + '\n\n') + MODE_INSTRUCTION[mode];
    const promptFile = path.join(OUT, `${gid}__${mode}.prompt.json`);
    fs.writeFileSync(promptFile, JSON.stringify({ text, images: item.images.map(p => path.basename(p)) }, null, 2));
    if (DRY) { console.log(`[dry] ${gid}/${mode}: 题干 ${item.problem.length} 字 + ${item.images.length} 图`); n++; continue; }
    process.stdout.write(`== ${gid} / ${mode} ... `);
    try {
      const { text: answer, usage } = await callModel(text, item.images);
      fs.writeFileSync(path.join(OUT, `${gid}__${mode}.answer.md`), answer);
      fs.writeFileSync(path.join(OUT, `${gid}__${mode}.meta.json`), JSON.stringify({
        item: gid, mode, model: MODEL.id || MODEL.api_model_id, provider: MODEL.provider,
        temperature, promptHash: createHash('sha256').update(text).digest('hex').slice(0, 16),
        images: item.images.map(p => path.basename(p)), usage, finishedAt: Date.now(),
      }, null, 2));
      console.log(`完成（${answer.length} 字）`);
    } catch (e) {
      console.log('失败：' + e.message);
      fs.writeFileSync(path.join(OUT, `${gid}__${mode}.error.txt`), String(e.message || e));
    }
    n++;
  }
}
manifest.finishedAt = Date.now(); manifest.requests = n;
fs.writeFileSync(path.join(OUT, 'run-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n评测作答完成：${n} 次请求 → ${OUT}${DRY ? '（dry-run，未调用模型）' : ''}`);
