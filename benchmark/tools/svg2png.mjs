#!/usr/bin/env node
// SVG → PNG 批量转换（Edge/Chrome 无头渲染，评分参照保留 SVG 原件）
// 用法：node svg2png.mjs [--items GM-0006,GM-0007] [--force]
// 输出：每个 assets/*.svg 旁生成同名 .png（已存在且未 --force 则跳过）
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ITEMS = path.resolve(HERE, '..', 'items');
const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--items')) || '').split('=')[1] || '';
const force = args.includes('--force');

const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const BROWSER = CANDIDATES.find(p => fs.existsSync(p));
if (!BROWSER) { console.error('未找到 Edge/Chrome'); process.exit(1); }

const gids = only ? only.split(',').map(s => s.trim()).filter(Boolean)
                  : fs.readdirSync(ITEMS).filter(d => d.startsWith('GM-'));

let ok = 0, skip = 0, fail = 0;
for (const gid of gids) {
  const assets = path.join(ITEMS, gid, 'assets');
  if (!fs.existsSync(assets)) continue;
  for (const f of fs.readdirSync(assets).filter(f => f.endsWith('.svg'))) {
    const svgPath = path.join(assets, f);
    const out = svgPath.replace(/\.svg$/, '.png');
    if (fs.existsSync(out) && !force) { skip++; continue; }
    const svg = fs.readFileSync(svgPath, 'utf8');
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    const w = Math.min(1400, Math.max(360, Math.round(+vb?.[1] || 560)));
    const h = Math.min(1400, Math.max(300, Math.round(+vb?.[2] || 420)));
    try {
      execFileSync(BROWSER, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars',
        `--screenshot=${out}`, `--window-size=${w},${h}`,
        '--default-background-color=FAF7F2',
        'file:///' + svgPath.replace(/\\/g, '/'),
      ], { stdio: 'ignore', timeout: 30000 });
      if (fs.existsSync(out) && fs.statSync(out).size > 1000) { ok++; console.log('PNG', path.relative(ITEMS, out)); }
      else { fail++; console.error('FAIL(小文件)', out); }
    } catch (e) { fail++; console.error('FAIL', out, e.message); }
  }
}
console.log(`\n完成：${ok} 转换，${skip} 跳过，${fail} 失败`);
process.exit(fail ? 1 : 0);
