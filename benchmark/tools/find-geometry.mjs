#!/usr/bin/env node
// 从试卷文本中定位「平面几何」题（压轴题优先）
// 用法：node benchmark/tools/find-geometry.mjs [--top 40]
// 输出：benchmark/sources/candidates.json + 终端候选清单
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'sources');
const TEXT = path.join(SRC, 'text');

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const TOP = opt.top ? Number(opt.top) : 40;

// 平面几何强信号
const GEO = ['切线', '圆', '⊙', '相似', '全等', '菱形', '矩形', '正方形', '平行四边形', '等腰', '等边三角形', '垂直平分线', '角平分线', '求证', '折痕', '翻折', '旋转', '位似', '勾股', '四边形', '证明', '中点', '外接圆', '内切圆', '弦', '弧', '梯形', '对角线', '作图', '尺规'];
// 偏代数/统计信号（降权）
const ALG = ['二次函数', '一次函数', '反比例函数', '抛物线', '概率', '统计', '众数', '中位数', '方差', '频数', '方程', '不等式组', '科学记数', '实数', '因式分解', '化简求值'];

function strip(s) { return s.replace(/\[IMG:\d+ [^\]]+\]/g, '·').replace(/\s+/g, ' '); }

// 把文本切成分题：以 "12." "13." 等在行首或空格后的编号为界
function splitProblems(text) {
  const norm = text.replace(/\r/g, '');
  const out = [];
  const re = /(?:^|\n|\s)(\d{1,2})\s*[.．]\s*/g;
  const marks = [];
  let m;
  while ((m = re.exec(norm))) marks.push({ n: Number(m[1]), idx: m.index + m[0].length });
  for (let i = 0; i < marks.length; i++) {
    const a = marks[i], b = marks[i + 1];
    // 编号需递增（1,2,3…）才可能是题号，避免把 "（1）" 等误切
    if (b && b.n !== a.n + 1 && b.n < a.n) continue;
    const body = norm.slice(a.idx, b ? b.idx : norm.length).trim();
    if (body.length < 30 || body.length > 2600) continue;
    out.push({ no: a.n, body });
  }
  return out;
}

const files = fs.readdirSync(TEXT).filter(f => f.endsWith('.txt'));
const cands = [];
for (const f of files) {
  const paper = f.replace(/\.txt$/, '');
  const text = fs.readFileSync(path.join(TEXT, f), 'utf8');
  const probs = splitProblems(text);
  for (const p of probs) {
    const g = GEO.reduce((s, k) => s + (p.body.includes(k) ? 1 : 0), 0);
    const a = ALG.reduce((s, k) => s + (p.body.includes(k) ? 1 : 0), 0);
    const sub = (p.body.match(/（\d）/g) || []).length;
    const imgN = (p.body.match(/\[IMG:\d+ [^\]]+\.(png|jpg|jpeg|gif|bmp)\]/gi) || []).length;
    const score = g * 2 - a * 3 + sub + (p.no >= 20 ? 3 : 0) + (imgN ? 3 : 0);
    cands.push({ paper, no: p.no, score, geo: g, alg: a, sub, imgs: imgN, body: p.body });
  }
}
cands.sort((x, y) => y.score - x.score);
fs.writeFileSync(path.join(SRC, 'candidates.json'), JSON.stringify(cands, null, 2));
console.log(`候选共 ${cands.length} 条，输出前 ${TOP}：\n`);
for (const c of cands.slice(0, TOP)) {
  console.log(`${String(c.score).padStart(3)} | ${c.paper.slice(0, 26)} 第${c.no}题 | 几何${c.geo} 代数${c.alg} 小问${c.sub} 图${c.imgs}`);
  console.log('     ' + strip(c.body).slice(0, 130));
}
