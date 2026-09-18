#!/usr/bin/env node
// GeoMark 题库采集器 —— 第一试卷网(www.shijuan1.com) 免费真题
// 用法：
//   node benchmark/tools/fetch-sources.mjs --cat zhongkao --pages 1-6
//   node benchmark/tools/fetch-sources.mjs --cat gaokao   --pages 1-5
// 产出：benchmark/sources/manifest.json （题目来源清单，供下载器消费）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const SRC = path.join(BENCH, 'sources');
fs.mkdirSync(SRC, { recursive: true });

const CATS = {
  zhongkao: { seg: 'sjsxzk', listId: 706, name: '中考试卷' },
  gaokao: { seg: 'sjsxgk', listId: 728, name: '高考试卷' },
};

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
}
const cat = String(opt.cat || 'zhongkao');
const C = CATS[cat];
if (!C) { console.error('未知分类，可选：' + Object.keys(CATS).join(', ')); process.exit(1); }
const [p1, p2] = String(opt.pages || '1-3').split('-').map(Number);
const PAGES = [];
for (let p = p1; p <= (p2 || p1); p++) PAGES.push(p);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ORIGIN = 'https://www.shijuan1.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, referer) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, referer: referer || ORIGIN + '/', accept: 'text/html,*/*' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      return new TextDecoder('gb18030').decode(buf);
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(800 * (attempt + 1));
    }
  }
}

const listUrl = p => p === 1 ? `${ORIGIN}/a/${C.seg}/` : `${ORIGIN}/a/${C.seg}/list_${C.listId}_${p}.html`;

function parseList(html, page) {
  const out = [];
  const re = new RegExp(`<a\\s+href="(/a/${C.seg}/(\\d+)\\.html)"[^>]*class="title"[^>]*>([^<]*)<`, 'g');
  let m;
  while ((m = re.exec(html))) out.push({ url: ORIGIN + m[1], sid: m[2], title: m[3].trim(), page });
  // 同页还有"文件类型/版本/大小/上传日期"表格，按顺序抽取行内信息
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(r => r[1]);
  const info = [];
  for (const r of rows) {
    const a = new RegExp(`href="/a/${C.seg}/(\\d+)\\.html"`).exec(r);
    if (!a) continue;
    const tds = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());
    info.push({ sid: a[1], cells: tds });
  }
  for (const e of out) {
    const hit = info.find(i => i.sid === e.sid);
    if (hit) {
      e.fileType = hit.cells[1] || '';
      e.size = hit.cells[4] || '';
      e.date = hit.cells[5] || '';
    }
  }
  return out;
}

function parseDetail(html) {
  const rarM = /href="(\/uploads\/soft\/[^"']+\.rar)"/i.exec(html);
  const authM = /授权方式[：:]\s*<\/?[^>]*>?\s*([^<\s]+)/.exec(html);
  const auth = authM ? authM[1] : (/免费资源/.test(html) ? '免费资源' : '');
  const introM = /试卷介绍[\s\S]{0,80}?<[^>]*>([\s\S]{0,200}?)</.exec(html);
  return {
    rar: rarM ? ORIGIN + rarM[1] : null,
    free: /免费资源/.test(html) || /免费/.test(auth),
    auth,
    intro: introM ? introM[1].replace(/\s+/g, ' ').trim() : '',
  };
}

const all = [];
for (const p of PAGES) {
  const html = await get(listUrl(p));
  const items = parseList(html, p);
  process.stdout.write(`列表第 ${p} 页：${items.length} 条\n`);
  for (const it of items) {
    await sleep(350);
    try {
      const d = await get(it.url, listUrl(p));
      const det = parseDetail(d);
      all.push({ cat, catName: C.name, ...it, ...det });
      process.stdout.write(`  ${det.free ? '[免费]' : '[?]'} ${it.title} ${it.size || ''} ${det.rar ? '✓直链' : '✗无直链'}\n`);
    } catch (e) {
      all.push({ cat, catName: C.name, ...it, error: e.message });
      process.stdout.write(`  [错误] ${it.title}: ${e.message}\n`);
    }
  }
  await sleep(500);
}

const outFile = path.join(SRC, `manifest.${cat}.json`);
fs.writeFileSync(outFile, JSON.stringify({ cat, catName: C.name, pages: PAGES, fetchedAt: new Date().toISOString(), count: all.length, items: all }, null, 2));
console.log(`\n采集完成：${all.length} 条 → ${outFile}（免费且有直链 ${all.filter(x => x.free && x.rar).length} 条）`);
