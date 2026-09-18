#!/usr/bin/env node
// 导入 GeoLaux（西安交大，ACL 2026）中考平面几何数据集为 GeoMark 条目格式
// 数据：benchmark/sources/geolaux/extracted/GeoLaux-main/data/
//   GeoLaux_alldata.json（2186 题：题面/类型/答案/逐步解/步长/辅助线标注）
//   all_original_images/（原图） all_allauxiliary_images/（含辅助线图）
// 用法：node benchmark/tools/import-geolaux.mjs [--limit N] [--type proving|calculation] [--min-steps K] [--with-aux]
// 产出：benchmark/datasets/geolaux/items/GL-XXXX/
//
// ⚠️ 协议：仓库 LICENSE/README 声明 MIT；论文正文声明「MIT and CC BY-NC-SA 4.0, strictly prohibiting
//    commercial use」。两者冲突，此处如实双记入 meta.source.license，供下游自行判断。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const SRC = path.join(BENCH, 'sources', 'geolaux');
const OUT_ROOT = path.join(BENCH, 'datasets', 'geolaux', 'items');

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const WITH_AUX = !!opt['with-aux'];

// 定位解压后的 data 目录
const rootDir = fs.existsSync(path.join(SRC, 'extracted', 'GeoLaux-main'))
  ? path.join(SRC, 'extracted', 'GeoLaux-main')
  : fs.readdirSync(path.join(SRC, 'extracted')).map(d => path.join(SRC, 'extracted', d)).find(d => fs.existsSync(path.join(d, 'data', 'GeoLaux_alldata.json')));
if (!rootDir) { console.error('未找到 GeoLaux data 目录，请先解压 geolaux.zip 到 sources/geolaux/extracted/'); process.exit(1); }
const DATA = path.join(rootDir, 'data');
const IMG_ORIG = path.join(DATA, 'all_original_images');
const IMG_AUX = path.join(DATA, 'all_allauxiliary_images');

const isNull = v => v === null || v === undefined || v === 'null' || v === '';
const all = JSON.parse(fs.readFileSync(path.join(DATA, 'GeoLaux_alldata.json'), 'utf8'));
let entries = Object.entries(all);
if (opt.type) entries = entries.filter(([, v]) => v.type === String(opt.type));
if (opt['min-steps']) entries = entries.filter(([, v]) => Number(v.step_length) >= Number(opt['min-steps']));
if (opt.limit) entries = entries.slice(0, Number(opt.limit));

function findImg(dir, name) {
  if (isNull(name)) return null;
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const p = path.join(dir, String(name) + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function difficultyOf(steps) {
  const n = Number(steps) || 0;
  return n >= 10 ? 'hard' : (n >= 5 ? 'medium' : 'easy');
}

fs.mkdirSync(OUT_ROOT, { recursive: true });
const manifest = [];
let n = 0, missFig = 0, auxCopied = 0;

for (const [gid, v] of entries) {
  const id = 'GL-' + String(++n).padStart(4, '0');
  const dir = path.join(OUT_ROOT, id);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });

  const steps = Number(v.step_length) || 0;
  const isProving = v.type === 'proving';
  const hasAux = Number(v.auxiliary_type) > 0 && !isNull(v.auxiliary_text);
  const auxLevel = { 1: '简单（仅连接点）', 2: '复杂（作垂线/角平分线/内切圆等）' }[Number(v.auxiliary_type)] || '无';

  // 配图
  let figure = null;
  const orgSrc = findImg(IMG_ORIG, v.original_image_name);
  if (orgSrc) { fs.copyFileSync(orgSrc, path.join(dir, 'assets', 'figure.png')); figure = 'assets/figure.png'; }
  else missFig++;

  let auxFigure = null;
  if (WITH_AUX && !isNull(v.auxiliary_image_name)) {
    const auxSrc = findImg(IMG_AUX, v.auxiliary_image_name);
    if (auxSrc) { fs.copyFileSync(auxSrc, path.join(dir, 'assets', 'auxiliary.png')); auxFigure = 'assets/auxiliary.png'; auxCopied++; }
  }

  // 评分要点：10 分制，有辅助线时单列 2 分（这是 GeoLaux 的独特维度）
  const rubric = isProving
    ? (hasAux
      ? [{ point: '证明结论正确', score: 4 }, { point: '证明过程逻辑严谨：每一步有依据，无循环论证或跳步', score: 4 },
         { point: `构造出所需的辅助线（${v.auxiliary_text}）`, score: 2 }]
      : [{ point: '证明结论正确', score: 5 }, { point: '证明过程逻辑严谨：每一步有依据，无循环论证或跳步', score: 5 }])
    : (hasAux
      ? [{ point: '最终答案正确（与标准答案一致）', score: 5 }, { point: '解题过程正确：关键步骤完整、无跳步或计算错误', score: 3 },
         { point: `构造出所需的辅助线（${v.auxiliary_text}）`, score: 2 }]
      : [{ point: '最终答案正确（与标准答案一致）', score: 6 }, { point: '解题过程正确：关键步骤完整、无跳步或计算错误', score: 4 }]);

  const choices = Array.isArray(v.choices) && v.choices.length ? v.choices : null;
  const answer = isNull(v.number_answer) ? (isProving ? '见 solution.md（证明题无唯一数值答案）' : '见 solution.md') : String(v.number_answer);

  const problem = [
    `# ${id}`,
    '',
    `> 知识范围：初中数学 · 平面几何（${isProving ? '证明题' : '计算题'}）`,
    `> 来源：GeoLaux（西安交通大学，ACL 2026）· 题干 id ${gid} · 解题步长 ${steps} 步 · 难度（按步长推定）：${difficultyOf(steps)}`,
    hasAux ? `> 本题需要辅助线：${auxLevel}` : '> 本题无需辅助线',
    '',
    ...(figure ? [`![题目配图](${figure})`, ''] : ['> 注：本题原始配图缺失。', '']),
    v.problem_text,
    '',
    ...(choices ? [choices.map(c => `- ${c}`).join('\n'), ''] : []),
    '---',
    '',
    isProving
      ? '**作答要求**：给出完整、严谨的证明；每一步须注明依据（定理或性质），不得跳步。'
      : `**作答要求**：给出完整、严谨的解答过程，最后明确写出最终答案${choices ? '（并指出所选选项）' : ''}。`,
    '',
  ].join('\n');

  const solution = [
    `# ${id} 解析`,
    '',
    '## 答案',
    '',
    answer,
    '',
    '## 标准解（数据集提供）',
    '',
    String(v.solution || '').trim(),
    '',
    ...(v.steps_explanation ? ['## 解题步骤（数据集标注）', '', String(v.steps_explanation).trim(), ''] : []),
    ...(hasAux ? [`## 辅助线`, '', `**类型**：${auxLevel}`, '', `**作法**：${v.auxiliary_text}`, '', ...(auxFigure ? [`![含辅助线的图形](${auxFigure})`, ''] : [])] : []),
    '## 评分要点',
    '',
    ...rubric.map((r, i) => `${i + 1}. （${r.score} 分）${r.point}`),
    '',
    `> 步长 ${steps} 步（GeoLaux 标注；平均 6.51、最长 24）。`,
    '',
  ].join('\n');

  const meta = {
    id,
    title: `${isProving ? '平面几何证明' : '平面几何计算'}·${steps} 步${hasAux ? '·需辅助线' : ''}`,
    subject: 'math',
    category: 'plane_geometry',
    coordinatePolicy: 'restricted',
    knowledgeScope: { stage: '初中', topics: ['平面几何', isProving ? '证明' : '计算', ...(hasAux ? ['辅助线构造'] : [])] },
    questionType: isProving ? 'proof' : (choices ? 'choice-calculation' : 'calculation'),
    answer,
    difficulty: difficultyOf(steps),
    difficultyBasis: 'derived-from-step-length（GeoLaux 未提供难度标签）',
    figure: figure ? [figure] : [],
    geolaux: { key: gid, type: v.type, stepLength: steps, auxiliaryType: Number(v.auxiliary_type), auxiliaryLevel: auxLevel, auxiliaryText: isNull(v.auxiliary_text) ? null : v.auxiliary_text, unit: isNull(v.unit) ? null : v.unit },
    source: {
      dataset: 'GeoLaux',
      datasetUrl: 'https://github.com/Candice-yu/GeoLaux',
      paper: 'https://arxiv.org/abs/2508.06226',
      license: 'MIT (repository LICENSE / README) ⚠ 与论文声明冲突',
      licenseConflict: '论文正文声明："we release the dataset and associated scripts under MIT and CC BY-NC-SA 4.0 licenses, strictly prohibiting commercial use." 仓库 LICENSE 与 README 仅称 MIT。若用于商业用途，须先向作者澄清。',
    },
    dateAdded: '2026-09-19',
    tags: ['平面几何', isProving ? '证明' : '计算', ...(hasAux ? ['辅助线'] : []), `步长${steps}`],
    rubric,
    visionRubric: [],
  };

  fs.writeFileSync(path.join(dir, 'problem.md'), problem);
  fs.writeFileSync(path.join(dir, 'solution.md'), solution);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  manifest.push({ id, key: gid, type: v.type, steps, hasAux, difficulty: meta.difficulty, figure: !!figure });
}

fs.mkdirSync(path.join(BENCH, 'datasets', 'geolaux'), { recursive: true });
fs.writeFileSync(path.join(BENCH, 'datasets', 'geolaux', 'import-manifest.json'), JSON.stringify({
  importedAt: new Date().toISOString(),
  source: 'GeoLaux (github.com/Candice-yu/GeoLaux)',
  license: 'MIT（仓库）⚠ 论文侧声明 CC BY-NC-SA 4.0 且禁止商用，冲突已记录于每题 meta.source',
  filter: { type: opt.type || null, minSteps: opt['min-steps'] || null, limit: opt.limit || null, withAux: WITH_AUX },
  total: manifest.length, missingFigure: missFig, auxiliaryImages: auxCopied,
  byType: manifest.reduce((a, m) => (a[m.type] = (a[m.type] || 0) + 1, a), {}),
  byDifficulty: manifest.reduce((a, m) => (a[m.difficulty] = (a[m.difficulty] || 0) + 1, a), {}),
  items: manifest,
}, null, 2));

console.log(`GeoLaux 导入完成：${manifest.length} 题 → ${OUT_ROOT}`);
console.log(`  类型：${JSON.stringify(manifest.reduce((a, m) => (a[m.type] = (a[m.type] || 0) + 1, a), {}))}`);
console.log(`  难度（按步长推定）：${JSON.stringify(manifest.reduce((a, m) => (a[m.difficulty] = (a[m.difficulty] || 0) + 1, a), {}))}`);
console.log(`  缺图 ${missFig} · 辅助线图 ${auxCopied}（${WITH_AUX ? '已包含' : '未包含，用 --with-aux 开启'}）`);
