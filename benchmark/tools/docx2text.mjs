#!/usr/bin/env node
// 试卷 docx → 可读文本 + 图片按文档顺序编号
// 用法：node benchmark/tools/docx2text.mjs [--dir benchmark/sources/papers/zhongkao]
// 产出：benchmark/sources/text/<name>.txt  与  benchmark/sources/media/<name>/imgNNN.<ext>
// 说明：docx 实为 zip，用 Windows 自带 tar(libarchive) 解；数学公式(OMML)取其文本内容；图片在文中以 [IMG:序号] 原位标记。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const SRC = path.join(BENCH, 'sources');
const TAR = 'C:/Windows/System32/tar.exe';

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const DIRS = String(opt.dir || path.join(SRC, 'papers')).split(',').map(d => path.resolve(d));

const TEXT = path.join(SRC, 'text');
const MEDIA = path.join(SRC, 'media');
fs.mkdirSync(TEXT, { recursive: true });
fs.mkdirSync(MEDIA, { recursive: true });

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function docxToText(xml, rels) {
  // 段落与换行
  let s = xml
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ');
  // 图片原位标记：DrawingML <a:blip r:embed> 与 VML <v:imagedata r:id>（公式/图形）→ [IMG:k file]
  const imgOrder = [];
  const mark = rid => {
    const target = rels[rid] || '';
    const file = target.split('/').pop();
    if (!imgOrder.find(x => x.file === file)) imgOrder.push({ rid, file, target });
    return `[IMG:${imgOrder.findIndex(x => x.file === file) + 1} ${file}]`;
  };
  s = s.replace(/<a:blip[^>]*r:embed="([^"]+)"[^>]*\/?>/g, (_m, rid) => '\n' + mark(rid) + '\n');
  s = s.replace(/<v:imagedata[^>]*r:id="([^"]+)"[^>]*\/?>/g, (_m, rid) => mark(rid));
  // 取文本节点（含公式 m:t）
  s = s.replace(/<[^>]+>/g, '');
  s = decode(s);
  s = s.replace(/[ \t\u00a0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { text: s, imgOrder };
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

let n = 0;
for (const d of DIRS) {
  if (!fs.existsSync(d)) continue;
  for (const f of walk(d).filter(f => /\.docx$/i.test(f))) {
    const base = path.basename(f, '.docx');
    const tmp = path.join(SRC, '.tmp-docx', base);
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.mkdirSync(tmp, { recursive: true });
      execFileSync(TAR, ['-xf', f, '-C', tmp], { stdio: 'pipe' });
      const docXml = path.join(tmp, 'word', 'document.xml');
      if (!fs.existsSync(docXml)) throw new Error('无 word/document.xml');
      // rId → media 目标
      const rels = {};
      const relPath = path.join(tmp, 'word', '_rels', 'document.xml.rels');
      if (fs.existsSync(relPath)) {
        for (const m of fs.readFileSync(relPath, 'utf8').matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rels[m[1]] = m[2];
      }
      const { text, imgOrder } = docxToText(fs.readFileSync(docXml, 'utf8'), rels);
      // 导出图片（按文中出现顺序重命名 imgNNN）
      const mediaSrc = path.join(tmp, 'word', 'media');
      const outMedia = path.join(MEDIA, base);
      fs.mkdirSync(outMedia, { recursive: true });
      let idx = 0;
      const map = [];
      for (const io of imgOrder) {
        // 只批量导出位图（图形）；公式多为 wmf 矢量图，按需再转，避免占用空间
        if (!/\.(png|jpe?g|gif|bmp)$/i.test(io.file)) continue;
        const src = path.join(tmp, 'word', io.target.replace(/^\.\.\//, '').replace(/^\//, ''));
        const cand = fs.existsSync(src) ? src : path.join(mediaSrc, io.file);
        if (!fs.existsSync(cand)) continue;
        idx++;
        const ext = path.extname(cand) || '.png';
        const dst = path.join(outMedia, `img${String(idx).padStart(3, '0')}${ext}`);
        fs.copyFileSync(cand, dst);
        map.push({ inDocIndex: imgOrder.indexOf(io) + 1, srcName: io.file, file: path.basename(dst), size: fs.statSync(dst).size });
      }
      if (!map.length) fs.rmdirSync(outMedia, { recursive: true });
      fs.writeFileSync(path.join(TEXT, base + '.txt'), text);
      fs.writeFileSync(path.join(TEXT, base + '.images.json'), JSON.stringify(map, null, 2));
      fs.rmSync(tmp, { recursive: true, force: true });
      n++;
      process.stdout.write(`✓ ${base}  ${text.length} 字 · ${map.length} 图\n`);
    } catch (e) {
      process.stdout.write(`✗ ${base}: ${e.message}\n`);
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    }
  }
}
console.log(`\n完成 ${n} 份 → ${TEXT}`);
