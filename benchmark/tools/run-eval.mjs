#!/usr/bin/env node
// GeoMark Benchmark 评测 runner —— 三种模式
//   vision : 纯识图（仅图片，复述内容，不解题）
//   coord  : 解题，允许建立坐标系
//   pure   : 解题，禁止坐标系，纯几何综合法
// 隔离保证（结构性）：作答阶段本脚本只读取 problem.md + meta.json + PNG 图片，
// 代码中不存在任何对 solution.md 的读取路径；评分由 score.mjs 单独执行。
//
// 每题一次独立请求，互不携带上下文（无 conversation history），并发推送。
//
// 用法：
//   node run-eval.mjs --model <models.json 中的 id> [--items GM-0006,...] [--modes vision,coord,pure]
//        [--base-url ... --api-key ... --protocol openai|anthropic --api-model-id ...]
//        [--temperature 0] [--concurrency 6] [--max-tokens 8192] [--out benchmark/results/<runid>] [--dry-run]
//        [--resume]  跳过已存在且非空的作答文件（断点续跑）
// 模型与密钥默认复用 Harness 配置（config/models.json + config/secrets.json 或环境变量）。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
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
const maxTokens = opt['max-tokens'] !== undefined ? Number(opt['max-tokens']) : 8192;
const CONCURRENCY = Math.max(1, opt.concurrency !== undefined ? Number(opt.concurrency) : 6);
const DRY = !!opt['dry-run'];
const RESUME = !!opt.resume;
// 题库根目录：默认核心题库 benchmark/items；用 --items-dir a,b 可追加导入题库（如 MM-MATH）
const ITEMS_DIRS = String(opt['items-dir'] || path.join(BENCH, 'items')).split(',').map(s => path.resolve(s.trim()));
const ITEMS = ITEMS_DIRS[0];
function itemDir(gid) {
  for (const d of ITEMS_DIRS) { const p = path.join(d, gid); if (fs.existsSync(path.join(p, 'meta.json'))) return p; }
  return path.join(ITEMS, gid);
}
function listItems() {
  const out = new Set();
  for (const d of ITEMS_DIRS) { try { for (const x of fs.readdirSync(d)) if (fs.existsSync(path.join(d, x, 'meta.json'))) out.add(x); } catch {} }
  return [...out].sort();
}

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
      supports_vision: !!opt.vision,
    };
  }
  const m = MODELS.find(m => m.id === opt.model);
  if (!m) { console.error(`models.json 中未找到模型 "${opt.model}"。可用：`, MODELS.map(m => m.id).join(', ')); process.exit(1); }
  const provKey = SECRET.providers?.[m.provider] ?? SECRET[m.provider];
  const modelKey = SECRET.models?.[m.id];
  // --vision / --no-vision 可覆盖配置，便于实验条件显式化
  const vision = opt.vision !== undefined ? true : (opt['no-vision'] !== undefined ? false : !!m.supports_vision);
  return { ...m, supports_vision: vision, _key: opt['api-key'] || modelKey || provKey || process.env.HARNESS_OPENAI_API_KEY || process.env.HARNESS_ANTHROPIC_API_KEY };
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
  const dir = itemDir(gid);
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

async function readSSE(res) {
  const text = await res.text();
  let out = '', thinking = '', usage = null;
  for (const line of text.split('\n')) {
    const l = line.trim();
    if (!l.startsWith('data:')) continue;
    const payload = l.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const j = JSON.parse(payload);
      const d = j.choices?.[0]?.delta || j.choices?.[0]?.message || {};
      if (d.content) out += d.content;
      if (d.reasoning_content) thinking += d.reasoning_content;
      if (j.usage) usage = j.usage;
    } catch { /* 忽略非 JSON 行 */ }
  }
  return { text: out, thinking, usage };
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
      body: JSON.stringify({ model: MODEL.api_model_id, max_tokens: maxTokens, temperature, messages: [{ role: 'user', content }] }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
    const blocks = j.content || [];
    return {
      text: blocks.filter(c => c.type === 'text').map(c => c.text || '').join(''),
      thinking: blocks.filter(c => c.type === 'thinking').map(c => c.thinking || '').join(''),
      usage: j.usage || null,
    };
  }
  // openai-compatible
  const content = [];
  for (const img of imagePaths) content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64(img) } });
  content.push({ type: 'text', text });
  const res = await fetch(MODEL.base_url.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + MODEL._key },
    body: JSON.stringify({ model: MODEL.api_model_id, temperature, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) return await readSSE(res);
  const j = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const msg = j.choices?.[0]?.message || {};
  return { text: msg.content ?? '', thinking: msg.reasoning_content ?? '', usage: j.usage || null };
}

// ---------- main ----------
const runid = opt.out ? path.basename(String(opt.out)) : new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = opt.out ? path.resolve(String(opt.out)) : path.join(BENCH, 'results', runid);
fs.mkdirSync(OUT, { recursive: true });

const gids = onlyItems || listItems();
const manifest = {
  runid, model: MODEL.id || MODEL.api_model_id, provider: MODEL.provider,
  base_url: MODEL.base_url || null, api_model_id: MODEL.api_model_id || null,
  temperature, maxTokens, concurrency: CONCURRENCY,
  modes: MODES, visionOk: !!MODEL.supports_vision, items: gids, startedAt: Date.now(), requests: 0, skipped: 0, failed: 0,
};

// 构建任务队列：每题 × 每模式 = 一次完全独立的请求
const tasks = [];
for (const gid of gids) {
  let item;
  try { item = loadItem(gid); } catch (e) { console.error('跳过', gid, e.message); continue; }
  const visionOk = !!MODEL.supports_vision;
  for (const mode of MODES) {
    if (mode === 'vision' && !visionOk) {
      fs.writeFileSync(path.join(OUT, `${gid}__${mode}.answer.md`), '[skipped: model has no vision capability — 纯识图模式需要支持图像输入的模型]');
      fs.writeFileSync(path.join(OUT, `${gid}__${mode}.meta.json`), JSON.stringify({ item: gid, mode, skipped: true, reason: 'no-vision' }, null, 2));
      manifest.skipped++;
      continue;
    }
    // 无配图 → 无法做纯识图考核，跳过（避免模型凭空编造）
    if (mode === 'vision' && visionOk && item.images.length === 0) {
      fs.writeFileSync(path.join(OUT, `${gid}__${mode}.answer.md`), '[skipped: item has no figure — 纯识图模式需要配图]');
      fs.writeFileSync(path.join(OUT, `${gid}__${mode}.meta.json`), JSON.stringify({ item: gid, mode, skipped: true, reason: 'no-figure' }, null, 2));
      manifest.skipped++;
      continue;
    }
    const outAns = path.join(OUT, `${gid}__${mode}.answer.md`);
    if (RESUME && fs.existsSync(outAns) && fs.statSync(outAns).size > 0) { manifest.skipped++; continue; }
    const imgs = visionOk ? item.images : [];
    const text = (mode === 'vision' ? '' : item.problem + '\n\n') + MODE_INSTRUCTION[mode] + (visionOk ? '' : '\n\n（注：当前模型不支持图像输入，本题配图无法提供，请按题面文字作答。）');
    tasks.push({ gid, mode, text, imgs, item, visionOk });
  }
}

console.log(`GeoMark 作答：${tasks.length} 个独立请求（${gids.length} 题 × ${MODES.length} 模式），并发 ${CONCURRENCY}`);
let done = 0;
async function worker() {
  while (tasks.length) {
    const t = tasks.shift();
    if (!t) break;
    if (DRY) { done++; continue; }
    fs.writeFileSync(path.join(OUT, `${t.gid}__${t.mode}.prompt.json`), JSON.stringify({ text: t.text, images: t.imgs.map(p => path.basename(p)) }, null, 2));
    try {
      const { text: answer, thinking, usage } = await callModel(t.text, t.imgs);
      fs.writeFileSync(path.join(OUT, `${t.gid}__${t.mode}.answer.md`), answer);
      if (thinking) fs.writeFileSync(path.join(OUT, `${t.gid}__${t.mode}.thinking.md`), thinking);
      fs.writeFileSync(path.join(OUT, `${t.gid}__${t.mode}.meta.json`), JSON.stringify({
        item: t.gid, mode: t.mode, model: MODEL.id || MODEL.api_model_id, provider: MODEL.provider,
        temperature, maxTokens, promptHash: createHash('sha256').update(t.text).digest('hex').slice(0, 16),
        images: t.imgs.map(p => path.basename(p)), hasThinking: !!thinking,
        answerChars: answer.length, thinkingChars: thinking.length, usage, finishedAt: Date.now(),
      }, null, 2));
      done++; manifest.requests++;
      console.log(`  [${done}/${done + tasks.length}] ${t.gid}/${t.mode} ✓ ${answer.length}${thinking ? '+' + thinking.length : ''} 字`);
    } catch (e) {
      done++; manifest.failed++;
      fs.writeFileSync(path.join(OUT, `${t.gid}__${t.mode}.error.txt`), String(e.message || e));
      console.log(`  [${done}] ${t.gid}/${t.mode} ✗ ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

manifest.finishedAt = Date.now();
fs.writeFileSync(path.join(OUT, 'run-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n评测作答完成：成功 ${manifest.requests} · 失败 ${manifest.failed} · 跳过 ${manifest.skipped} → ${OUT}${DRY ? '（dry-run，未调用模型）' : ''}`);
