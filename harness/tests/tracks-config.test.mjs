/** 实验赛道配置的静态校验。
 *
 * 这些命题不依赖网络、不启动任何进程，因此可以在 CI 里无条件运行。
 * 它们防的是「手工编辑 tracks.json 时悄悄写坏」这类错误：
 * 重复 id、漏字段、exe 路径写串（复制粘贴事故）、协议形态不合法。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(HERE, '..', 'config', 'tracks.json');
const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

const ACTIONS = new Set(['open-urls', 'open-benchmark', 'launch-agents']);
const KINDS = new Set(['cli', 'app', 'msix', 'web']);
const REGIONS = new Set(['cn', 'intl']);
const ACCEPTS = new Set(['text', 'image', 'document', 'archive']);

const tracks = cfg.tracks || [];
const agent = tracks.find((t) => t.id === 'agent');
const agentTargets = agent?.targets || [];

test('赛道配置：结构合法', () => {
  assert.ok(Array.isArray(tracks) && tracks.length >= 3, '应至少声明三条赛道');
  const ids = tracks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, `赛道 id 重复：${ids.join(',')}`);
  for (const t of tracks) {
    assert.ok(ACTIONS.has(t.action), `action 非法：${t.id} -> ${t.action}`);
    for (const lang of ['zh', 'en']) {
      assert.ok(t.label?.[lang], `${t.id} 缺少 label.${lang}`);
      assert.ok(t.subtitle?.[lang], `${t.id} 缺少 subtitle.${lang}`);
      assert.ok(t.desc?.[lang], `${t.id} 缺少 desc.${lang}`);
    }
    assert.equal(typeof t.order, 'number', `${t.id} 缺少 order`);
  }
  assert.equal(typeof cfg.dataNote, 'string', '缺少 dataNote（须声明 accepts 为最佳判断）');
});

test('赛道配置：Agent 目标的 id 与形态合法', () => {
  assert.ok(agentTargets.length > 0, 'agent 赛道应有目标');
  const ids = agentTargets.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, `目标 id 重复：${ids.filter((v, i) => ids.indexOf(v) !== i).join(',')}`);
  for (const x of agentTargets) {
    assert.ok(x.name, `${x.id} 缺少 name`);
    assert.ok(x.vendor, `${x.id} 缺少 vendor`);
    assert.ok(KINDS.has(x.kind), `${x.id} 的 kind 非法：${x.kind}`);
    if (x.region !== undefined) assert.ok(REGIONS.has(x.region), `${x.id} 的 region 非法：${x.region}`);
  }
});

test('赛道配置：每种形态的必填字段齐备', () => {
  for (const x of agentTargets) {
    if (x.kind === 'cli') assert.ok(x.bin, `cli 目标 ${x.id} 缺少 bin`);
    if (x.kind === 'app') assert.ok(x.exe || x.exeGlob, `app 目标 ${x.id} 缺少 exe / exeGlob`);
    if (x.kind === 'msix') {
      assert.ok(x.appId, `msix 目标 ${x.id} 缺少 appId`);
      assert.ok(x.pfn || String(x.appId).includes('!'), `msix 目标 ${x.id} 需要 pfn 或含 ! 的 appId`);
    }
    // 未安装时的兜底：要么能打开官网，要么给出安装方式（否则用户无从下手）
    if (x.kind !== 'app' && x.kind !== 'msix') {
      assert.ok(x.url || x.install, `${x.id} 既无 url 也无 install，未安装时无法引导用户`);
    }
  }
});

test('赛道配置：app 目标的 exe 路径互不重复', () => {
  const exes = agentTargets.filter((x) => x.exe).map((x) => x.exe.toLowerCase());
  const dupes = exes.filter((v, i) => exes.indexOf(v) !== i);
  assert.equal(dupes.length, 0, `exe 路径重复（疑似复制粘贴事故）：${dupes.join(', ')}`);
  for (const x of agentTargets.filter((y) => y.exe)) {
    assert.ok(/^([A-Za-z]:\\|%[A-Za-z_]+%\\|~)/.test(x.exe), `${x.id} 的 exe 应为绝对路径或环境变量开头：${x.exe}`);
    assert.ok(/\.exe$/i.test(x.exe), `${x.id} 的 exe 应指向 .exe 文件：${x.exe}`);
  }
});

test('赛道配置：真实世界目标为 https 且能力标签合法', () => {
  const rw = tracks.find((t) => t.id === 'real-world');
  assert.ok(rw?.targets?.length >= 10, 'real-world 赛道目标过少');
  const ids = rw.targets.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'real-world 目标 id 重复');
  for (const x of rw.targets) {
    assert.match(x.url, /^https:\/\//, `${x.id} 的 url 必须为 https`);
    assert.ok(Array.isArray(x.accepts) && x.accepts.length > 0, `${x.id} 缺少 accepts`);
    for (const a of x.accepts) assert.ok(ACCEPTS.has(a), `${x.id} 的 accepts 含未知能力：${a}`);
  }
  // 国内与国外都应被标注，否则前端无法分组
  assert.ok(rw.targets.some((x) => x.region === 'cn'), 'real-world 应标注国内目标');
  assert.ok(rw.targets.some((x) => x.region === 'intl'), 'real-world 应标注国外目标');
});

test('赛道配置：允许启动的目标都经过白名单登记', () => {
  // 服务端只按 config 里的 id 查找目标；此处确认不存在「无 id 但会被启动」的条目
  for (const x of agentTargets) {
    assert.match(x.id, /^[a-z0-9-]+$/, `${x.id} 应为小写连字符 id（否则前端 data-agent 会失配）`);
  }
  assert.equal(agentTargets.filter((x) => x.kind === 'web' && x.bin).length, 0,
    'web 形态不应带 bin（会让人误以为能终端启动）');
});
