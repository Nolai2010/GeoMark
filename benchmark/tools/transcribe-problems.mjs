#!/usr/bin/env node
// 用视觉模型把「公式图片占位」的题面还原成 Markdown + LaTeX
// 用法：node benchmark/tools/transcribe-problems.mjs [--only 334454__...__23] [--concurrency 3] [--model deepseek-chat]
// 产出：benchmark/sources/transcribed/<task>.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'sources');
const TASKS = path.join(SRC, 'tasks');
const OUT = path.join(SRC, 'transcribed');
const REPO = path.resolve(HERE, '..', '..', 'harness');
fs.mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const CONC = Math.max(1, opt.concurrency !== undefined ? Number(opt.concurrency) : 3);
const MODEL = String(opt.model || 'deepseek-chat');

const secrets = JSON.parse(fs.readFileSync(path.join(REPO, 'config', 'secrets.json'), 'utf8'));
const KEY = secrets.providers?.['openai-compatible'];
if (!KEY) { console.error('缺少 API key'); process.exit(1); }

const SYS = `你是数学试卷的数字化专家。用户会给出一道题的题面文本，其中 〔F1〕…〔Fk〕 是公式图片占位符，每张公式图随后附上；〔图1〕… 是几何配图占位符。
要求：
1. 输出完整题面，使用 Markdown + LaTeX：行内公式用 $…$，独立公式用 $$…$$。
2. 把每个 〔Fk〕 替换为该公式图对应的正确 LaTeX；同一个占位符出现多次表示同一符号，须保持一致。
3. 〔图k〕 替换为「（图k）」，并保持其在题面中的位置。
4. 题面中除公式占位符外的中文文字必须一字不改地保留，不要改写、不要补充、不要解答。
5. 只输出题面本身，不要任何解释、前言或后记。`;

function b64(p) { return fs.readFileSync(p).toString('base64'); }

async function transcribe(task) {
  const content = [];
  let prompt = `【待还原题面】\n${task.masked}\n\n`;
  if (task.formulas.length) prompt += `【公式图片】按顺序给出，占位符 〔F1〕…〔F${task.formulas.length}〕 与图片一一对应：\n`;
  content.push({ type: 'text', text: prompt });
  for (const f of task.formulas) {
    content.push({ type: 'text', text: `〔F${f.label.slice(1)}〕= 下图：` });
    if (fs.existsSync(f.pngPath)) content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64(f.pngPath) } });
    else content.push({ type: 'text', text: '(该公式图缺失，请依据上下文推断)' });
  }
  for (const g of task.figures) {
    content.push({ type: 'text', text: `${g.label}= 下图（几何配图）：` });
    if (g.path && fs.existsSync(g.path)) content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64(g.path) } });
  }
  content.push({ type: 'text', text: '\n请输出还原后的完整题面（Markdown + LaTeX）。' });

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 4096, messages: [{ role: 'system', content: SYS }, { role: 'user', content }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  const m = j.choices?.[0]?.message || {};
  return { text: m.content || '', thinking: m.reasoning_content || '', usage: j.usage };
}

let files = fs.readdirSync(TASKS).filter(f => f.endsWith('.json')).sort();
if (opt.only) { const k = String(opt.only); files = files.filter(f => f.includes(k)); }
const jobs = [...files];
let ok = 0, bad = 0;
async function worker() {
  while (jobs.length) {
    const f = jobs.shift();
    if (!f) break;
    const task = JSON.parse(fs.readFileSync(path.join(TASKS, f), 'utf8'));
    const outFile = path.join(OUT, f.replace(/\.json$/, '.md'));
    try {
      const r = await transcribe(task);
      const body = r.text && r.text.trim() ? r.text : (r.thinking || '(空)');
      fs.writeFileSync(outFile, `<!-- source: ${task.paper} 第${task.no}题 | ${task.note} -->\n\n` + body.trim() + '\n');
      ok++;
      console.log(`  [${ok + bad}] ${task.paper.slice(0, 24)} 第${task.no}题 ✓ ${body.length} 字`);
    } catch (e) {
      bad++;
      console.log(`  [${ok + bad}] ${task.paper.slice(0, 24)} 第${task.no}题 ✗ ${e.message}`);
    }
  }
}
console.log(`转写 ${jobs.length} 道题（并发 ${CONC}）...`);
await Promise.all(Array.from({ length: CONC }, () => worker()));
console.log(`\n完成：成功 ${ok} · 失败 ${bad} → ${OUT}`);
