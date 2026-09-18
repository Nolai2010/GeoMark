#!/usr/bin/env node
// 生成 GeoMark Benchmark 数据集清单（版本化 + 内容哈希，保证可复现）
// 用法：node benchmark/tools/dataset-manifest.mjs [--version 0.1]
// 产出：benchmark/dataset.json
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const ITEMS = path.join(BENCH, 'items');

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const VERSION = String(opt.version || '0.1');

const sha = buf => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const gids = fs.readdirSync(ITEMS).filter(d => d.startsWith('GM-')).sort();

const items = [];
for (const gid of gids) {
  const dir = path.join(ITEMS, gid);
  const metaPath = path.join(dir, 'meta.json');
  const probPath = path.join(dir, 'problem.md');
  const solPath = path.join(dir, 'solution.md');
  if (!fs.existsSync(metaPath) || !fs.existsSync(probPath)) continue;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const rubricMax = (meta.rubric || []).reduce((s, r) => s + r.score, 0);
  const visionMax = (meta.visionRubric || []).reduce((s, r) => s + r.score, 0);
  const figures = [].concat(meta.figure || []);
  const assets = {};
  for (const f of figures) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) assets[f] = { sha256_16: sha(fs.readFileSync(p)), bytes: fs.statSync(p).size };
  }
  items.push({
    id: gid,
    title: meta.title,
    category: meta.category || 'geometry',
    coordinatePolicy: meta.coordinatePolicy || null,
    difficulty: meta.difficulty || null,
    questionType: meta.questionType || null,
    topics: meta.knowledgeScope?.topics || meta.tags || [],
    source: meta.source || null,
    rubricMax, visionMax,
    hasVisionRubric: visionMax > 0,
    figure: figures,
    assets,
    problemHash: sha(fs.readFileSync(probPath)),
    solutionHash: fs.existsSync(solPath) ? sha(fs.readFileSync(solPath)) : null,
    metaHash: sha(fs.readFileSync(metaPath)),
  });
}

const withFigure = items.filter(i => i.figure.length).length;
const datasetHash = sha(Buffer.from(items.map(i => [i.id, i.problemHash, i.metaHash, i.solutionHash].join(':')).join('\n')));

const out = {
  name: 'GeoMark Benchmark',
  version: VERSION,
  generatedAt: new Date().toISOString(),
  itemCount: items.length,
  withFigure,
  modes: ['vision', 'coord', 'pure'],
  scoring: { solve: 'rubric（LLM-as-judge，逐项）', vision: 'visionRubric（图形复述要点）', constraint: '坐标法违规归零（cheat）' },
  datasetHash,
  items,
};

fs.writeFileSync(path.join(BENCH, 'dataset.json'), JSON.stringify(out, null, 2));
console.log(`GeoMark Benchmark v${VERSION}：${items.length} 题（含配图 ${withFigure}）`);
console.log(`datasetHash: ${datasetHash}`);
for (const it of items) console.log(`  ${it.id} ${it.difficulty || '-'}  rubric ${it.rubricMax}${it.hasVisionRubric ? ' · 识图 ' + it.visionMax : ''}  ${it.title}`);
console.log(`\n→ ${path.join(BENCH, 'dataset.json')}`);
