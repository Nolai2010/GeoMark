#!/usr/bin/env node
// 汇总：把 run 目录里的评分聚合成对比表格（Markdown + CSV + JSON）
// 支持：
//   · 约束合规统计与列（coordinates/cfm/websearch/skillplugin 四类违规）
//   · 失败分类（F01–F08）
//   · 五轨均值（PNG识图 / 平面可建系 / 平面纯几何 / 立体可建系 / 立体纯几何）
//   · 重复运行稳定性与均值：--runs <runA>,<runB>[,<runC>...]（N 轮，愿景书「多次测试取均值」）
// 用法：node summarize.mjs --run benchmark/results/<runid> [--runs a,b,c] [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackOf, TRACK_CN } from './lib/cheat-rules.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] ?? true;
const RUN = path.resolve(String(opt.run || ''));
const OUT = opt.out ? path.resolve(String(opt.out)) : RUN;
const BENCH = path.resolve(HERE, '..');
const ITEMS = path.join(BENCH, 'items');

// 读题目 meta（五轨判定依据：geometryDimension + coordinatePolicy）；导入题库缺失时 trackOf 返回 null
const META_CACHE = new Map();
function metaOf(gid) {
  if (!META_CACHE.has(gid)) {
    try { META_CACHE.set(gid, JSON.parse(fs.readFileSync(path.join(ITEMS, gid, 'meta.json'), 'utf8'))); }
    catch { META_CACHE.set(gid, {}); }
  }
  return META_CACHE.get(gid);
}
function trackOfItem(gid, mode, record) {
  const meta = metaOf(gid);
  return record?.track || trackOf(meta.geometryDimension, mode, meta.coordinatePolicy);
}

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
  F05: '推理链断裂', F06: '约束违规（坐标/编程/联网/插件）', F07: '最终答案错误', F08: '工具/执行失败',
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
lines.push(`- 运行：${manifest.runid || path.basename(RUN)} · 题目 ${gids.length} 道 × 模式 ${MODES.length} · 评分：rubric 逐项 + 约束合规审查（coordinates/cfm/websearch/skillplugin）`);
lines.push(`- 每次请求均为独立对话（无共享上下文）；并发 ${manifest.concurrency ?? 'N/A'}`);
const jr = all.find(r => r.judgeIdentity);
lines.push(`- 评卷人：${jr ? jr.judge + '（' + (jr.judgeIdentity?.zeroContext ? '与被测模型同款，零上下文单轮评审——不携带被测对话历史' : String(jr.judgeIdentity?.note || '')) + '）' : (all.find(r => r.judge)?.judge || 'N/A')}`);
lines.push('');
lines.push('| 题目 | 纯识图 | 可建系 | 不可建系 | 作弊 | 失分类型 |');
lines.push('|---|---|---|---|---|---|');
const csv = ['item,vision,coord,pure,cheat,failure'];
const cheatList = [];
const cheatType = gid => {
  for (const m of MODES) { const r = get(gid, m); if (r?.constraint?.cheat) return r.constraint?.violationType || 'cheat'; }
  return null;
};
for (const gid of gids) {
  const cells = MODES.map(m => { const r = get(gid, m); return r ? `${clamp(r)}/${r.max}（${pct(r)}%）${r.constraint?.cheat ? ' ⚠' : ''}` : '—'; });
  const cheat = cheatType(gid);
  if (cheat) cheatList.push(gid);
  const fails = MODES.map(m => classify(get(gid, m), m)).filter(x => x && x !== 'PASS');
  const failStr = [...new Set(fails)].join(' ') || '—';
  lines.push(`| ${gid} | ${cells[0]} | ${cells[1]} | ${cells[2]} | ${cheat ? '**是（' + cheat + '）**' : '否'} | ${failStr} |`);
  csv.push([gid, `"${cells[0]}"`, `"${cells[1]}"`, `"${cells[2]}"`, cheat ? 'Y:' + cheat : 'N', failStr].join(','));
}
const modeAvg = MODES.map(m => {
  const rs = all.filter(x => x.mode === m && !x.skipped);
  return rs.length ? Math.round(rs.reduce((s, r) => s + (Math.min(r.total, r.max) / r.max), 0) / rs.length * 100) : null;
});
lines.push(`| **均分** | **${modeAvg[0]}%** | **${modeAvg[1]}%** | **${modeAvg[2]}%** | ${cheatList.length ? '**' + cheatList.length + ' 题**' : '0'} | — |`);
csv.push(`ALL,${modeAvg[0]}%,${modeAvg[1]}%,${modeAvg[2]}%,${cheatList.length},`);

// 五轨均值（五个并行对话：PNG识图 / 平面可建系 / 平面纯几何 / 立体可建系 / 立体纯几何）
lines.push('');
lines.push('## 五轨均值（五个并行对话，上下文不互通）');
lines.push('');
lines.push('| 轨道 | 判定 | 题数 | 均分 |');
lines.push('|---|---|---|---|');
const trackStats = [];
for (const t of ['vision', 'planar-coord', 'planar-pure', 'solid-coord', 'solid-pure']) {
  const rs = all.filter(x => !x.skipped && trackOfItem(x.item, x.mode, x) === t);
  const n = rs.length;
  const avg = n ? Math.round(rs.reduce((s, r) => s + (Math.min(r.total, r.max) / r.max), 0) / n * 100) : null;
  trackStats.push({ track: t, n, avg });
  const criteria = t === 'vision' ? 'vision × 有 visionRubric' : (t.startsWith('planar') ? 'planar × ' + (t.endsWith('coord') ? 'coord' : 'pure') : 'solid × ' + (t.endsWith('coord') ? 'coord' : 'pure'));
  lines.push(`| ${TRACK_CN[t]} | ${criteria} | ${n} | ${avg === null ? '—' : '**' + avg + '%**'} |`);
}
csv.push(`TRACKS,${trackStats.map(s => s.avg === null ? '' : s.avg + '%').join(',')}`);

// 作废（归零）明细（四类违规：coordinates 仅 pure 判罚；cfm/websearch/skillplugin 所有模式）
const cheatRecs = all.filter(r => !r.skipped && r.constraint?.cheat);
if (cheatRecs.length) {
  lines.push('');
  lines.push('## 约束违规明细（coordinates/cfm/websearch/skillplugin → 总分归零，按作弊处理）');
  lines.push('');
  lines.push('| 题目 | 模式 | 类型 | rubric 原始分 | 判据 | 证据片段 |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of cheatRecs) {
    const ev = (r?.constraint?.evidence || []).slice(0, 2).map(e => String(e).replace(/\|/g, '/').slice(0, 60)).join('；');
    lines.push(`| ${r.item} | ${MODE_CN[r.mode] || r.mode} | ${r.constraint?.violationType || '—'} | ${r?.rawTotal ?? '—'}/${r?.max ?? '—'} | ${r?.constraint?.method || ''} ${r?.constraint?.reason ? '· ' + String(r.constraint.reason).slice(0, 50) : ''} | ${ev || '—'} |`);
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

// 重复运行稳定性与多轮均值（N 轮，愿景书：多次测试、多轮评分，成绩取各轮均值）
if (opt.runs) {
  const runDirs = String(opt.runs).split(',').map(s => s.trim()).filter(Boolean);
  const load = p => { try { return JSON.parse(fs.readFileSync(path.resolve(p, 'scores', 'all.json'), 'utf8')); } catch { return null; } };
  const runs = runDirs.map(p => ({ name: path.basename(p), data: load(p) })).filter(r => r.data);
  if (runs.length >= 2) {
    lines.push('');
    lines.push(`## 多轮评分（${runs.length} 轮：${runs.map(r => r.name).join('、')}）`);
    lines.push('');
    lines.push('| 题目 | 模式 | ' + runs.map((r, i) => `第${i + 1}轮`).join(' | ') + ' | 均值 | 极差 | 稳定 |');
    lines.push('|---|---|' + runs.map(() => '---').join('|') + '|---|---|---|');
    let stable = 0, total = 0, maxDelta = 0;
    for (const g of gids) for (const m of MODES) {
      const ps = runs.map(r => {
        const rec = r.data.find(x => x.item === g && x.mode === m && !x.skipped);
        return rec ? pct(rec) : null;
      });
      if (ps.some(p => p === null)) continue;
      const mean = Math.round(ps.reduce((s, p) => s + p, 0) / ps.length);
      const d = Math.max(...ps) - Math.min(...ps);
      const isStable = d <= 10;
      stable += isStable ? 1 : 0; total++; maxDelta = Math.max(maxDelta, d);
      lines.push(`| ${g} | ${MODE_CN[m]} | ${ps.map(p => p + '%').join(' | ')} | **${mean}%** | ${d}pp | ${isStable ? '✓' : '✗'} |`);
    }
    lines.push('');
    lines.push(`稳定性：${stable}/${total} 组轮间极差 ≤10pp（最大极差 ${maxDelta}pp）；均值列为各轮算术平均。`);
    // 多轮五轨均值
    lines.push('');
    lines.push(`## 多轮五轨均值（${runs.length} 轮平均）`);
    lines.push('');
    lines.push('| 轨道 | ' + runs.map((r, i) => `第${i + 1}轮`).join(' | ') + ' | 均值 |');
    lines.push('|---|' + runs.map(() => '---').join('|') + '|---|');
    for (const t of ['vision', 'planar-coord', 'planar-pure', 'solid-coord', 'solid-pure']) {
      const per = runs.map(r => {
        const rs = r.data.filter(x => !x.skipped && trackOfItem(x.item, x.mode, x) === t);
        return rs.length ? Math.round(rs.reduce((s, rec) => s + (Math.min(rec.total, rec.max) / rec.max), 0) / rs.length * 100) : null;
      });
      if (per.every(p => p === null)) continue;
      const valid = per.filter(p => p !== null);
      const mean = Math.round(valid.reduce((s, p) => s + p, 0) / valid.length);
      lines.push(`| ${TRACK_CN[t]} | ${per.map(p => p === null ? '—' : p + '%').join(' | ')} | **${mean}%** |`);
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'summary.csv'), csv.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({
  manifest, modeAvg, cheatItems: cheatList, failureCounts: counts,
  trackStats,
  judge: all[0]?.judgeIdentity ? { model: all[0].judgeIdentity.model, zeroContext: !!all[0].judgeIdentity.zeroContext } : null,
  table: Object.fromEntries(gids.map(g => [g, Object.fromEntries(MODES.map(m => {
    const r = get(g, m); return [m, r ? { total: Math.min(r.total, r.max), max: r.max, pct: pct(r), cheat: !!r.constraint?.cheat, violationType: r.constraint?.violationType || null, track: trackOfItem(g, m, r), rawTotal: r.rawTotal, failure: classify(r, m) } : null];
  }))])),
}, null, 2));
console.log(lines.join('\n'));
console.log(`\n汇总输出 → ${path.join(OUT, 'summary.md')} / .csv / .json`);
