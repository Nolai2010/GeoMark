#!/usr/bin/env node
// 导入 MM-MATH（THU-KEG，MIT 协议）几何子集为 GeoMark 条目格式
// 数据：benchmark/sources/mm-math/MM_Math.jsonl（问题+标准解+难度+年级+知识点）
//      图片：benchmark/sources/mm-math/images/*.png（从 MM_Math.zip 解开）
// 用法：node benchmark/tools/import-mm-math.mjs [--difficulty hard] [--grade nine] [--limit 300]
// 产出：benchmark/datasets/mm-math/items/MM-XXXX/{problem.md,solution.md,meta.json,assets/figure.png}
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const SRC = path.join(BENCH, 'sources', 'mm-math');
const OUT_ROOT = path.join(BENCH, 'datasets', 'mm-math', 'items');

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;

const jsonl = path.join(SRC, 'MM_Math.jsonl');
if (!fs.existsSync(jsonl)) { console.error('缺少 ' + jsonl); process.exit(1); }
const IMG_DIRS = [
  path.join(SRC, 'images'),
  path.join(SRC, 'extracted', 'MM_Math'),
  path.join(SRC, 'extracted'),
  path.join(SRC, 'MM_Math'),
].filter(d => fs.existsSync(d));
if (!IMG_DIRS.length) console.warn('⚠ 未找到图片目录，将只导入文本（请先解压 MM_Math.zip 到 sources/mm-math/images/）');

const GEO = /Properties of Shapes|Transformations of Shapes/;
const rows = fs.readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l, i) => { try { return { ...JSON.parse(l), _i: i }; } catch { return null; } }).filter(Boolean);
let sel = rows.filter(r => GEO.test(r.knowledge?.level_1 || ''));
if (opt.difficulty) sel = sel.filter(r => r.difficult === String(opt.difficulty));
if (opt.grade) sel = sel.filter(r => r.year === String(opt.grade));
if (opt.limit) sel = sel.slice(0, Number(opt.limit));

function findImage(name) {
  for (const d of IMG_DIRS) {
    const p = path.join(d, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function extractAnswer(solution) {
  const boxed = [...String(solution).matchAll(/\\boxed\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)].map(m => m[1]);
  if (boxed.length) return boxed[boxed.length - 1].trim();
  const ans = /(?:answer|Answer)\s*[:：]\s*(.+)/.exec(String(solution));
  return ans ? ans[1].trim().slice(0, 120) : '见 solution.md';
}

fs.mkdirSync(OUT_ROOT, { recursive: true });
const manifest = [];
let n = 0, noImg = 0;

for (const r of sel) {
  const id = 'MM-' + String(++n).padStart(4, '0');
  const dir = path.join(OUT_ROOT, id);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });

  const k = r.knowledge || {};
  const topics = [k.level_1, k.level_2].filter(Boolean);
  const answer = extractAnswer(r.solution);
  const gradeCN = { seven: '七年级', eight: '八年级', nine: '九年级' }[r.year] || r.year;

  // 配图
  let figure = null;
  const src = r.file_name ? findImage(r.file_name) : null;
  if (src) { fs.copyFileSync(src, path.join(dir, 'assets', 'figure.png')); figure = 'assets/figure.png'; }
  else if (r.file_name) noImg++;

  const problem = [
    `# ${id}`,
    '',
    `> 知识范围：初中数学 · ${topics.join(' / ')}`,
    `> 年级：${gradeCN} · 难度：${r.difficult}`,
    `> 来源：MM-MATH（清华大学 THU-KEG，MIT 协议）· 原图 ${r.file_name || 'N/A'}`,
    '',
    ...(figure ? [`![题目配图](${figure})`, ''] : ['> 注：本题原始配图缺失。', '']),
    r.question,
    '',
    '---',
    '',
    '**作答要求**：给出完整、严谨的解答过程，最后把最终答案写在 \\boxed{} 中；每一步须注明依据。',
    '',
  ].join('\n');

  const solution = [
    `# ${id} 解析`,
    '',
    '## 答案',
    '',
    answer,
    '',
    '## 标准解（数据集提供，英文原文）',
    '',
    r.solution,
    '',
    '## 评分要点',
    '',
    '1. （6 分）最终答案正确：与标准答案（\\boxed{} 内）一致（等价形式、约分、化简到位均算正确）。',
    '2. （4 分）解题过程正确：关键步骤完整、推理链无断裂、计算无错误；结论对但过程缺失酌情给分。',
    '',
  ].join('\n');

  const meta = {
    id,
    title: `${topics.join(' · ')}（${gradeCN}·${r.difficult}）`,
    subject: 'math',
    category: 'plane_geometry',
    coordinatePolicy: 'allowed',
    knowledgeScope: { stage: '初中', grade: gradeCN, topics, mmMathLevel1: k.level_1, mmMathLevel2: k.level_2 },
    questionType: 'calculation',
    answer,
    difficulty: r.difficult,
    figure: figure ? [figure] : [],
    source: {
      dataset: 'MM-MATH',
      datasetUrl: 'https://huggingface.co/datasets/THU-KEG/MM_Math',
      repo: 'https://github.com/kge-sun/MM-Math',
      license: 'MIT',
      originalImage: r.file_name || null,
      note: 'MM-MATH 仅含计算型开放题（不含证明与作图），题面为数据集提供的英文版。',
    },
    dateAdded: '2026-09-19',
    tags: topics,
    rubric: [
      { point: '最终答案正确（与标准答案一致）', score: 6 },
      { point: '解题过程正确：关键步骤完整、推理链无断裂、计算无错误', score: 4 },
    ],
    visionRubric: [],
  };

  fs.writeFileSync(path.join(dir, 'problem.md'), problem);
  fs.writeFileSync(path.join(dir, 'solution.md'), solution);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  manifest.push({ id, mmIndex: r._i, file: r.file_name, level2: k.level_2, difficulty: r.difficult, grade: r.year, hasFigure: !!figure });
}

fs.writeFileSync(path.join(BENCH, 'datasets', 'mm-math', 'import-manifest.json'), JSON.stringify({
  importedAt: new Date().toISOString(),
  source: 'MM-MATH (THU-KEG/MM_Math, MIT)',
  filter: { difficulty: opt.difficulty || null, grade: opt.grade || null, limit: opt.limit || null, category: 'geometry (Properties/Transformations of Shapes)' },
  total: manifest.length, missingFigure: noImg, items: manifest,
}, null, 2));

console.log(`MM-MATH 导入完成：${manifest.length} 题 → ${OUT_ROOT}`);
console.log(`  难度：${[...new Set(manifest.map(m => m.difficulty))].join('/')} · 缺图 ${noImg}`);
console.log(`  清单：benchmark/datasets/mm-math/import-manifest.json`);
