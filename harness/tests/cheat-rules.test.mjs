/** 愿景对齐：CFM/联网/插件作弊检测、五轨映射、SVG 识图对齐、题库完整性。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectCfm, scanCoordinates, scanWebSearch, scanPlugin, trackOf,
} from '../../benchmark/tools/lib/cheat-rules.mjs';
import { JUDGE_SYSTEM, AUDIT_SYSTEM, buildVisionJudgePrompt, buildSolveJudgePrompt, loadAnswerSvg } from '../../benchmark/tools/lib/prompts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ---------- CFM（代码块即作弊） ----------
test('detectCfm：python 围栏代码块 → 违规并记录语言', () => {
  const r = detectCfm('先分析图形。\n```python\nimport math\nprint(math.sqrt(2))\n```\n所以角度为 45°。');
  assert.equal(r.used, true);
  assert.deepEqual(r.langs, ['python']);
  assert.ok(r.evidence[0].includes('python'));
});

test('detectCfm：无语言标注的围栏也算违规（用户决策：代码块即作弊）', () => {
  const r = detectCfm('用如下方法计算：\n```\nx = 二分求根\n```\n');
  assert.equal(r.used, true);
  assert.deepEqual(r.langs, []);
});

test('detectCfm：多种语言只记录一次且按出现顺序', () => {
  const r = detectCfm('```c\nint a;\n```\n中间文字\n```js\nvar b;\n```\n```c\nint c;\n```');
  assert.deepEqual(r.langs, ['c', 'js']);
});

test('detectCfm：否定语境（我不能用编程）不算违规', () => {
  const r = detectCfm('评测要求禁止编程解题，我不能使用编程，以下用纯几何方法。');
  assert.equal(r.used, false);
});

test('detectCfm：纯文本算式与伪代码描述不算违规', () => {
  const r = detectCfm('由勾股定理得 AB = √(3²+4²) = 5，再用余弦定理求出 cos∠ACB = 1/5。');
  assert.equal(r.used, false);
});

// ---------- 坐标法（pure 判罚，回归保护） ----------
test('scanCoordinates：建系强信号命中；否定语境不命中', () => {
  assert.ok(scanCoordinates('以 A 为原点建立平面直角坐标系').length > 0);
  assert.equal(scanCoordinates('本题不使用坐标法，用纯几何综合法证明如下').length, 0);
});

// ---------- 联网 / 插件 ----------
test('scanWebSearch：联网检索声明命中；「无需联网」不命中', () => {
  assert.ok(scanWebSearch('我先联网搜索一下这道题的解析').length > 0);
  assert.equal(scanWebSearch('本题无需联网，仅凭题面条件即可求解').length, 0);
});

test('scanPlugin：插件/工具链声明命中', () => {
  assert.ok(scanPlugin('调用 Python 求解这个方程组').length > 0);
  assert.ok(scanPlugin('用 GeoGebra 验证').length > 0);
});

// ---------- 四类审查提示词 ----------
test('AUDIT_SYSTEM 覆盖四类违规，JUDGE_SYSTEM 保持方法中立性硬规则', () => {
  for (const k of ['used_coordinates', 'cfm', 'web_search', 'skill_plugin']) assert.ok(AUDIT_SYSTEM.includes(k));
  assert.ok(JUDGE_SYSTEM.includes('方法中立性'));
  assert.ok(JUDGE_SYSTEM.includes('不得因为作答没有使用坐标系'));
});

// ---------- 五轨映射 ----------
test('trackOf：五轨判定（含 restricted 政策约束）', () => {
  assert.equal(trackOf('planar', 'vision', undefined), 'vision');
  assert.equal(trackOf('solid', 'vision', undefined), 'vision');
  assert.equal(trackOf('planar', 'coord', undefined), 'planar-coord');
  assert.equal(trackOf('solid', 'coord', undefined), 'solid-coord');
  assert.equal(trackOf('planar', 'pure', 'restricted'), 'planar-pure');
  assert.equal(trackOf('planar', 'pure', 'allowed'), null, 'pure 只适用 restricted');
  assert.equal(trackOf('solid', 'pure', undefined), null, '未声明政策时 pure 不适用');
  assert.equal(trackOf(null, 'coord', undefined), null, '导入数据集无维度不计轨');
  assert.equal(trackOf(undefined, 'pure', 'restricted'), null, '有政策无维度也不计轨');
});

// ---------- SVG 识图对齐 ----------
test('buildVisionJudgePrompt：有 SVG 注入标准答案块；无 SVG 不注入', () => {
  const base = { meta: { title: '测试题' }, gid: 'GM-TEST', rubric: [{ point: '说出三角形', score: 5 }], max: 5, full: '考生复述内容' };
  const withSvg = buildVisionJudgePrompt({ ...base, svgContent: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>' });
  const noSvg = buildVisionJudgePrompt({ ...base, svgContent: null });
  assert.ok(withSvg.includes('【SVG 标准答案】'));
  assert.ok(withSvg.includes('<circle'));
  assert.ok(!noSvg.includes('【SVG 标准答案】'));
  assert.ok(noSvg.includes('【复述要点：共 5 分】'));
});

test('buildSolveJudgePrompt：包含细则与参考解析', () => {
  const p = buildSolveJudgePrompt({ meta: { title: '解题题' }, gid: 'GM-TEST', rubric: [{ point: '第一步', score: 6 }], max: 6, solution: '参考：用相似三角形', full: '考生作答', mode: 'coord' });
  assert.ok(p.includes('评分细则：共 6 分'));
  assert.ok(p.includes('参考解析'));
  assert.ok(p.includes('mode=coord'));
});

test('loadAnswerSvg：读到内容；缺失/不存在返回 null 不抛错', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-svg-'));
  try {
    fs.writeFileSync(path.join(tmp, 'answer.svg'), '<svg></svg>');
    assert.equal(loadAnswerSvg(tmp, 'answer.svg'), '<svg></svg>');
    assert.equal(loadAnswerSvg(tmp, 'nope.svg'), null);
    assert.equal(loadAnswerSvg(tmp, null), null);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------- 题库完整性：geometryDimension 全覆盖 + 五轨计数 ----------
test('18 题 meta 全部声明 geometryDimension；GM-0006 补标 allowed；dataset trackSummary 与实况一致', () => {
  const itemsDir = path.join(ROOT, 'benchmark', 'items');
  const gids = fs.readdirSync(itemsDir).filter(d => d.startsWith('GM-')).sort();
  assert.equal(gids.length, 18);
  let planar = 0, solid = 0, planarPure = 0, solidPure = 0;
  for (const gid of gids) {
    const meta = JSON.parse(fs.readFileSync(path.join(itemsDir, gid, 'meta.json'), 'utf8'));
    assert.ok(meta.geometryDimension === 'planar' || meta.geometryDimension === 'solid', `${gid} 缺 geometryDimension`);
    if (meta.geometryDimension === 'planar') planar++; else solid++;
    if (meta.geometryDimension === 'planar' && meta.coordinatePolicy === 'restricted') planarPure++;
    if (meta.geometryDimension === 'solid' && meta.coordinatePolicy === 'restricted') solidPure++;
  }
  assert.equal(planar, 13); assert.equal(solid, 5);
  assert.equal(planarPure, 7, 'GM-0108 审计后改标 allowed（题目本质依赖坐标/向量法）');
  assert.equal(solidPure, 0, '立体纯几何轨当前为缺口');
  const g6 = JSON.parse(fs.readFileSync(path.join(itemsDir, 'GM-0006', 'meta.json'), 'utf8'));
  assert.equal(g6.coordinatePolicy, 'allowed', 'GM-0006 评分说明提供向量法给分，必须为 allowed');
  const ds = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmark', 'dataset.json'), 'utf8'));
  assert.deepEqual(ds.trackSummary, {
    'vision': 8, 'planar-coord': 13, 'planar-pure': 7, 'solid-coord': 5, 'solid-pure': 0,
  });
  for (const it of ds.items) assert.ok(it.geometryDimension === 'planar' || it.geometryDimension === 'solid');
});
