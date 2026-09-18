#!/usr/bin/env node
// 为选中的题目准备「待转写任务」：文本占位 + 公式图 + 配图
// 用法：node benchmark/tools/prepare-problems.mjs
// 产出：benchmark/sources/tasks/*.json ；需转公式清单 benchmark/sources/.work/needed-wmf.txt
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'sources');
const TEXT = path.join(SRC, 'text');
const MEDIA = path.join(SRC, 'media');
const WORK = path.join(SRC, '.work');
const TASKS = path.join(SRC, 'tasks');
const TAR = 'C:/Windows/System32/tar.exe';
const PAPERS = path.join(SRC, 'papers');

fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(TASKS, { recursive: true });

const sel = JSON.parse(fs.readFileSync(path.join(SRC, 'selection.json'), 'utf8'));

function splitProblems(text) {
  const norm = text.replace(/\r/g, '');
  const out = [];
  const re = /(?:^|\n|\s)(\d{1,2})\s*[.．]\s*/g;
  const marks = [];
  let m;
  while ((m = re.exec(norm))) marks.push({ n: Number(m[1]), idx: m.index + m[0].length });
  for (let i = 0; i < marks.length; i++) {
    const a = marks[i], b = marks[i + 1];
    const body = norm.slice(a.idx, b ? b.idx : norm.length).trim();
    if (body.length < 20) continue;
    out.push({ no: a.n, body });
  }
  return out;
}
function pickProblem(text, no) {
  const probs = splitProblems(text);
  // 取编号等于 no 且正文最长的一段（避免误切）
  const hits = probs.filter(p => p.no === no);
  if (!hits.length) return null;
  return hits.sort((a, b) => b.body.length - a.body.length)[0];
}

const needed = new Set();
const manifest = [];
for (const s of sel) {
  const paper = s.paper;
  const txtPath = path.join(TEXT, paper + '.txt');
  if (!fs.existsSync(txtPath)) { console.log(`✗ 缺文本 ${paper}`); continue; }
  const text = fs.readFileSync(txtPath, 'utf8');
  const prob = pickProblem(text, s.no);
  if (!prob) { console.log(`✗ ${paper} 第${s.no}题 未定位`); continue; }

  // 取该题的图片标记（含跨行）
  const marks = [...prob.body.matchAll(/\[IMG:(\d+) ([^\]]+)\]/g)].map(mm => ({ idx: mm.index, name: mm[2].trim() }));
  // 唯一化并编号
  const formulas = [], figures = [];
  const seenF = new Map(), seenG = new Map();
  for (const mk of marks) {
    if (/\.(png|jpe?g|gif|bmp)$/i.test(mk.name)) { if (!seenG.has(mk.name)) seenG.set(mk.name, figures.length + 1), figures.push({ label: `图${seenG.size}`, srcName: mk.name }); }
    else { if (!seenF.has(mk.name)) seenF.set(mk.name, formulas.length + 1), formulas.push({ label: `F${seenF.size}`, srcName: mk.name }); }
  }
  // 生成带占位的文本
  let masked = prob.body.replace(/\[IMG:(\d+) ([^\]]+)\]/g, (_a, _i, name) => {
    name = name.trim();
    if (/\.(png|jpe?g|gif|bmp)$/i.test(name)) return `〔图${seenG.get(name)}〕`;
    return `〔F${seenF.get(name)}〕`;
  });

  // 解出 docx 里的原始 media（公式 wmf 需要它）
  const docx = path.join(PAPERS, 'zhongkao', paper + '.docx');
  const relBase = paper.replace(/[\\/:*?"<>|]/g, '_');
  const tmpDir = path.join(WORK, relBase);
  if (!fs.existsSync(tmpDir) && fs.existsSync(docx)) {
    fs.mkdirSync(tmpDir, { recursive: true });
    try { execFileSync(TAR, ['-xf', docx, '-C', tmpDir], { stdio: 'pipe' }); } catch (e) { console.log('解压失败', paper, e.message); }
  }

  // 图片清单：figure 用已抽取的 media，formula 用 docx 原始 wmf
  const figJson = path.join(TEXT, paper + '.images.json');
  const figMap = fs.existsSync(figJson) ? Object.fromEntries(JSON.parse(fs.readFileSync(figJson, 'utf8')).map(x => [x.srcName, x.file])) : {};
  const resolvedFigures = figures.map(f => ({ ...f, path: figMap[f.srcName] ? path.join(MEDIA, paper, figMap[f.srcName]) : null }));
  const resolvedFormulas = formulas.map(f => {
    const wmf = path.join(tmpDir, 'word', 'media', f.srcName);
    // 目标路径按试卷分目录，避免不同试卷同名 media 互相覆盖
    const pngPath = path.join(WORK, 'formula-png', relBase, f.srcName.replace(/\.[^.]+$/, '') + '.png');
    if (fs.existsSync(wmf)) needed.add(`${wmf}|${pngPath}`);
    return { ...f, srcPath: wmf, pngPath };
  });

  const task = { paper, no: s.no, note: s.note, masked, formulas: resolvedFormulas, figures: resolvedFigures };
  fs.writeFileSync(path.join(TASKS, `${paper}__${s.no}.json`), JSON.stringify(task, null, 2));
  manifest.push({ paper, no: s.no, note: s.note, formulas: formulas.length, figures: figures.length, chars: masked.length });
  console.log(`✓ ${paper} 第${s.no}题：公式 ${formulas.length} 图 ${figures.length} 文本 ${masked.length} 字 — ${s.note}`);
}
fs.writeFileSync(path.join(WORK, 'needed-wmf.txt'), [...needed].join('\n'));
fs.writeFileSync(path.join(SRC, 'task-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n任务 ${manifest.length} 个 → ${TASKS}；待转公式 ${needed.size} 个 → ${path.join(WORK, 'needed-wmf.txt')}`);
