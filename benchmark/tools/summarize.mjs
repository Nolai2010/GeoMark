#!/usr/bin/env node
// 汇总：把 run 目录里的评分聚合成对比表格（Markdown + CSV + JSON）
// 用法：node summarize.mjs --run benchmark/results/<runid> [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] ?? true;
const RUN = path.resolve(String(opt.run || ''));
const OUT = opt.out ? path.resolve(String(opt.out)) : RUN;

const allPath = path.join(RUN, 'scores', 'all.json');
if (!fs.existsSync(allPath)) { console.error('未找到 ' + allPath + '（先运行 score.mjs）'); process.exit(1); }
const all = JSON.parse(fs.readFileSync(allPath, 'utf8'));
const manifest = (() => { try { return JSON.parse(fs.readFileSync(path.join(RUN, 'run-manifest.json'), 'utf8')); } catch { return {}; } })();

const MODES = ['vision', 'coord', 'pure'];
const gids = [...new Set(all.map(r => r.item))].sort();
const pct = r => r.max ? Math.round((r.total / r.max) * 100) : null;

// Markdown 表：每行 = 题目，列 = 各模式得分百分比
const lines = [];
lines.push(`# GeoMark Benchmark 评测汇总`);
lines.push('');
lines.push(`- 模型：${manifest.model || 'N/A'} · provider：${manifest.provider || 'N/A'} · temperature：${manifest.temperature ?? 0}`);
lines.push(`- 运行：${manifest.runid || path.basename(RUN)} · 题目 ${gids.length} 道 × 模式 ${MODES.length} · 评分：rubric 逐项`);
lines.push('');
lines.push('| 题目 | 纯识图 | 可建系 | 不可建系 | 解题均分 |');
lines.push('|---|---|---|---|---|');
const csv = ['item,vision,coord,pure,avg(coord,pure)'];
for (const gid of gids) {
  const cells = MODES.map(m => {
    const r = all.find(x => x.item === gid && x.mode === m);
    return r ? `${r.total}/${r.max}（${pct(r)}%）` : '—';
  });
  const s1 = all.find(x => x.item === gid && x.mode === 'coord'), s2 = all.find(x => x.item === gid && x.mode === 'pure');
  const avg = (s1 && s2) ? Math.round(((s1.total/s1.max)+(s2.total/s2.max))/2*100) + '%' : '—';
  lines.push(`| ${gid} | ${cells[0]} | ${cells[1]} | ${cells[2]} | ${avg} |`);
  csv.push([gid, cells[0], cells[1], cells[2], avg].join(','));
}
const modeAvg = MODES.map(m => {
  const rs = all.filter(x => x.mode === m);
  return rs.length ? Math.round(rs.reduce((s, r) => s + (r.total/r.max), 0) / rs.length * 100) + '%' : '—';
});
lines.push(`| **均分** | **${modeAvg[0]}** | **${modeAvg[1]}** | **${modeAvg[2]}** | — |`);
csv.push(`ALL,${modeAvg[0]},${modeAvg[1]},${modeAvg[2]},`);

fs.writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'summary.csv'), csv.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ manifest, table: Object.fromEntries(gids.map(g => [g, Object.fromEntries(MODES.map(m => { const r = all.find(x => x.item === g && x.mode === m); return [m, r ? { total: r.total, max: r.max, pct: pct(r) } : null]; }))])) }, null, 2));
console.log(lines.join('\n'));
console.log(`\n汇总输出 → ${path.join(OUT, 'summary.md')} / .csv / .json`);
