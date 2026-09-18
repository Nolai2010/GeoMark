#!/usr/bin/env node
// GeoMark 试卷下载+解压器
// 用法：
//   node benchmark/tools/fetch-papers.mjs --manifest benchmark/sources/manifest.zhongkao.json [--max 40] [--picks 334490,334489] [--dry]
// 行为：下载 RAR → 解压 → 只保留试卷文档(.doc/.docx/.pdf) → 删除 RAR 与其它解压产物（如 第一试卷网.url）
// 产出：benchmark/sources/papers/<cat>/<sid>__<title>.docx ；台账 benchmark/sources/fetched.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const SRC = path.join(BENCH, 'sources');
const RAW = path.join(SRC, 'raw');
const PAPERS = path.join(SRC, 'papers');
const TAR = 'C:/Windows/System32/tar.exe'; // Windows 自带 libarchive，可读 RAR

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
}
const DRY = !!opt.dry;
const MAX = opt.max ? Number(opt.max) : Infinity;
const PICKS = opt.picks ? String(opt.picks).split(',') : null;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const manifests = String(opt.manifest || '').split(',').filter(Boolean);
if (!manifests.length) { console.error('需要 --manifest <路径>'); process.exit(1); }

const KEEP = /\.(docx?|pdf|pptx?)$/i;
const JUNK = /\.(url|txt|lnk|ini|db|thumbs\.db)$/i;

let items = [];
for (const mf of manifests) {
  const j = JSON.parse(fs.readFileSync(path.resolve(mf), 'utf8'));
  items.push(...j.items);
}
items = items.filter(x => x.free && x.rar && !x.error);
if (PICKS) items = items.filter(x => PICKS.includes(String(x.sid)));
items = items.slice(0, MAX);

function safe(s) { return String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '').slice(0, 60); }

fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(PAPERS, { recursive: true });

const ledger = [];
let kept = 0, dropped = 0, bytesIn = 0, bytesOut = 0;

for (const it of items) {
  const base = `${it.sid}__${safe(it.title)}`;
  const rarPath = path.join(RAW, base + '.rar');
  const destDir = path.join(PAPERS, it.cat);
  fs.mkdirSync(destDir, { recursive: true });
  process.stdout.write(`↓ ${it.title} ... `);
  try {
    if (DRY) { console.log('(dry)'); continue; }
    // 1) 下载
    const res = await fetch(it.rar, { headers: { 'user-agent': UA, referer: it.url, accept: '*/*' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(rarPath, buf);
    bytesIn += buf.length;

    // 2) 解压到临时目录
    const tmp = path.join(SRC, '.tmp', base);
    fs.mkdirSync(tmp, { recursive: true });
    execFileSync(TAR, ['-xf', rarPath, '-C', tmp], { stdio: 'pipe' });

    // 3) 只保留试卷文档；其余（第一试卷网.url 等）连临时目录一起清掉
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
      const p = path.join(d, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
    const files = walk(tmp);
    const docFiles = files.filter(f => KEEP.test(path.basename(f)) && !JUNK.test(f));
    const saved = [];
    for (const f of docFiles) {
      const ext = path.extname(f);
      const target = path.join(destDir, `${base}${ext}`);
      fs.renameSync(f, target);
      saved.push(path.relative(BENCH, target));
      bytesOut += fs.statSync(target).size;
    }
    dropped += files.length - docFiles.length;
    // 4) 清临时目录 + 压缩包（省空间）
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(rarPath, { force: true });
    if (!saved.length) throw new Error('包内无试卷文档');
    kept++;
    ledger.push({ sid: it.sid, cat: it.cat, title: it.title, date: it.date, size: it.size, source: it.url, files: saved });
    console.log(`✓ 保留 ${saved.map(s => path.basename(s)).join(', ')}`);
  } catch (e) {
    console.log('✗ ' + e.message);
    try { fs.rmSync(rarPath, { force: true }); } catch {}
    try { fs.rmSync(path.join(SRC, '.tmp', base), { recursive: true, force: true }); } catch {}
    ledger.push({ sid: it.sid, cat: it.cat, title: it.title, error: String(e.message) });
  }
}

if (!DRY) {
  fs.writeFileSync(path.join(SRC, 'fetched.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), kept, dropped, papers: ledger }, null, 2));
}
const mb = n => (n / 1024 / 1024).toFixed(1) + 'MB';
console.log(`\n完成：${kept} 份试卷落地，丢弃垃圾文件 ${dropped} 个；下载 ${mb(bytesIn)} → 仅保留 ${mb(bytesOut)}（节省 ${mb(bytesIn - bytesOut + (bytesIn - bytesOut >= 0 ? 0 : 0))}）`);
console.log(`试卷目录：${PAPERS}`);
