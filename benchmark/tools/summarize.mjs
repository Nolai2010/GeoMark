#!/usr/bin/env node
// 汇总：把 run 目录里的评分聚合成对比表格（Markdown + CSV + JSON）
// 支持：
//   · 约束合规（坐标作弊）统计与列
//   · 失败分类（F01–F08）
//   · 重复运行稳定性：--runs <runA>,<runB>
// 用法：node summarize.mjs --run benchmark/results/<runid> [--runs a,b] [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
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
const MODE_CN = { vision: '纯识图', coord: '可建系', pure: '不可建系' };
const gids = [...new Set(all.map(r => r.item))].sort();
const clamp = r => (r && r.max ? Math.min(r.total, r.max) : r?.total);
const pct = r => r.max ? Math.round((Math.min(r.total, r.max) / r.max) * 100) : null;
const get = (g, m) => all.find(x => x.item === g && x.mode === m && !x.skipped);

// ---- 失败分类 F01–F08 ----
const TAXONOMY = {
  F01: '图形理解失败', F02: '几何关系失败', F03: '错误假设', F04: '计算错误',
  F05: '推理链断裂', F06: '约束违规（坐标作弊）', F07: '最终答案错误', F08: '工具/执行失败',
};
function classify(rec, mode) {
  if (!rec || rec.skipped) return null; // 未参与该模式（如无 visionRubric）不计入失败统计
  if (mode === 'vision' && (pct(rec) ?? 0) < 40) return 'F01';
  if (rec.constraint?.cheat) return 'F06';
  const p = pct(rec) ?? 0;
  if (p < 40) return 'F07';
  if (p < 70) return 'F05';
  if (p < 100) return 'F04';
  return 'PASS';
}

const lines = [];
lines.push('# GeoMark Benchmark 评测汇总');
lines.push('');
lines.push(`- 模型：${manifest.model || 'N/A'} · provider：${manifest.provider || 'N/A'} · temperature：${manifest.temperature ?? 0} · max_tokens：${manifest.maxTokens ?? 'N/A'}`);
lines.push(`- 运行：${manifest.runid || path.basename(RUN)} · 题目 ${gids.length} 道 × 模式 ${MODES.length} · 评分：rubric 逐项 + 约束合规审查`);
lines.push(`- 每次请求均为独立对话（无共享上下文）；并发 ${manifest.concurrency ?? 'N/A'}`);
lines.push('');
lines.push('| 题目 | 纯识图 | 可建系 | 不可建系 | 作弊 | 失分类型 |');
lines.push('|---|---|---|---|---|---|');
const csv = ['item,vision,coord,pure,cheat,failure'];
const cheatList = [];
for (const gid of gids) {
  const cells = MODES.map(m => { const r = get(gid, m); return r ? `${clamp(r)}/${r.max}（${pct(r)}%）${r.constraint?.cheat ? ' ⚠' : ''}` : '—'; });
  const cheat = MODES.some(m => get(gid, m)?.constraint?.cheat);
  if (cheat) cheatList.push(gid);
  const fails = MODES.map(m => classify(get(gid, m), m)).filter(x => x && x !== 'PASS');
  const failStr = [...new Set(fails)].join(' ') || '—';
  lines.push(`| ${gid} | ${cells[0]} | ${cells[1]} | ${cells[2]} | ${cheat ? '**是**' : '否'} | ${failStr} |`);
  csv.push([gid, `"${cells[0]}"`, `"${cells[1]}"`, `"${cells[2]}"`, cheat ? 'Y' : 'N', failStr].join(','));
}
const modeAvg = MODES.map(m => {
  const rs = all.filter(x => x.mode === m && !x.skipped);
  return rs.length ? Math.round(rs.reduce((s, r) => s + (Math.min(r.total, r.max) / r.max), 0) / rs.length * 100) : null;
});
lines.push(`| **均分** | **${modeAvg[0]}%** | **${modeAvg[1]}%** | **${modeAvg[2]}%** | ${cheatList.length ? '**' + cheatList.length + ' 题**' : '0'} | — |`);
csv.push(`ALL,${modeAvg[0]}%,${modeAvg[1]}%,${modeAvg[2]}%,${cheatList.length},`);

// 作废（归零）明细
if (cheatList.length) {
  lines.push('');
  lines.push('## 约束违规明细（不可建系模式使用坐标法 → 总分归零，按作弊处理）');
  lines.push('');
  lines.push('| 题目 | rubric 原始分 | 判据 | 证据片段 |');
  lines.push('|---|---|---|---|');
  for (const gid of cheatList) {
    const r = get(gid, 'pure');
    const ev = (r?.constraint?.evidence || []).slice(0, 2).map(e => String(e).replace(/\|/g, '/').slice(0, 60)).join('；');
    lines.push(`| ${gid} | ${r?.rawTotal ?? '—'}/${r?.max ?? '—'} | ${r?.constraint?.method || ''} ${r?.constraint?.reason ? '· ' + String(r.constraint.reason).slice(0, 50) : ''} | ${ev || '—'} |`);
  }
}

// 失败分类统计
lines.push('');
lines.push('## 失败分类统计（F01–F08）');
lines.push('');
const counts = {};
for (const r of all) { if (r.skipped) continue; const c = classify(r, r.mode); counts[c] = (counts[c] || 0) + 1; }
lines.push('| 代码 | 含义 | 次数 |');
lines.push('|---|---|---|');
for (const k of Object.keys(TAXONOMY)) lines.push(`| ${k} | ${TAXONOMY[k]} | ${counts[k] || 0} |`);
lines.push(`| PASS | 满分 | ${counts.PASS || 0} |`);

// 重复运行稳定性
if (opt.runs) {
  const [a, b] = String(opt.runs).split(',');
  const load = p => { try { return JSON.parse(fs.readFileSync(path.resolve(p, 'scores', 'all.json'), 'utf8')); } catch { return null; } };
  const A = load(a), B = load(b);
  if (A && B) {
    lines.push('');
    lines.push(`## 重复运行稳定性（${path.basename(a)} vs ${path.basename(b)}）`);
    lines.push('');
    lines.push('| 题目 | 模式 | 运行A | 运行B | 差值 | 稳定 |');
    lines.push('|---|---|---|---|---|---|');
    let stable = 0, total = 0, maxDelta = 0;
    for (const g of gids) for (const m of MODES) {
      const ra = A.find(x => x.item === g && x.mode === m), rb = B.find(x => x.item === g && x.mode === m);
      if (!ra || !rb) continue;
      const pa = pct(ra), pb = pct(rb), d = Math.abs((pa ?? 0) - (pb ?? 0));
      const isStable = d <= 10;
      stable += isStable ? 1 : 0; total++; maxDelta = Math.max(maxDelta, d);
      lines.push(`| ${g} | ${MODE_CN[m]} | ${pa}% | ${pb}% | ${d}pp | ${isStable ? '✓' : '✗'} |`);
    }
    lines.push('');
    lines.push(`稳定性：${stable}/${total} 组差值 ≤10pp（最大差值 ${maxDelta}pp）`);
  }
}

fs.writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'summary.csv'), csv.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({
  manifest, modeAvg, cheatItems: cheatList, failureCounts: counts,
  table: Object.fromEntries(gids.map(g => [g, Object.fromEntries(MODES.map(m => {
    const r = get(g, m); return [m, r ? { total: Math.min(r.total, r.max), max: r.max, pct: pct(r), cheat: !!r.constraint?.cheat, rawTotal: r.rawTotal, failure: classify(r, m) } : null];
  }))])),
}, null, 2));
console.log(lines.join('\n'));
console.log(`\n汇总输出 → ${path.join(OUT, 'summary.md')} / .csv / .json`);
