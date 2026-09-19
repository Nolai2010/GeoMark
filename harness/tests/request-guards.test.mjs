/** 请求守卫回归测试：跨站来源、DNS-Rebinding Host、端点正文类型。
 *
 * 这些断言锁定的是「远程网页无法驱使本机 Harness 做事」这条边界。
 * 之所以要单独测，是因为守卫的写法很容易退化成一个看似安全实则放行的条件：
 *   if (origin && origin !== allowed) reject;      ← 缺 Origin 时直接放行
 * 而浏览器对跨站的「简单请求」（表单 POST、无自定义头的 GET）恰恰不发 Origin。
 * 所以本文件既测「跨站会被拒」，也测「正常同源与本地客户端仍然可用」。
 *
 * 全程不联网、不调用真实模型，只启动本机 server.mjs 并打几个 HTTP 请求。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NODE = process.execPath;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'surfaces', 'web', 'server.mjs');

function freePort() {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function request(port, method, pathStr, { headers = {}, body = null } = {}) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathStr, method, headers }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', () => resolve({ status: 0, text: '' }));
    if (body !== null) req.write(body);
    req.end();
  });
}

async function withServer(fn) {
  const port = await freePort();
  const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-guard-cfg-'));
  // 不提供 tracks.json：守卫在查表之前就该生效，正好用来证明「拒绝不是靠查不到目标」
  const child = spawn(NODE, [SERVER], {
    env: { ...process.env, HARNESS_PORT: String(port), HARNESS_CONFIG_DIR: cfgDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${port}`;
  const t0 = Date.now();
  let up = false;
  while (Date.now() - t0 < 10000) {
    const r = await request(port, 'GET', '/api/models');
    if (r.status === 200) { up = true; break; }
    await new Promise((r2) => setTimeout(r2, 120));
  }
  try {
    assert.ok(up, 'server did not come up');
    await fn({ port, base });
  } finally {
    try { child.kill(); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
    try { fs.rmSync(cfgDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

test('请求守卫：跨站来源被拒，同源与本地客户端放行', async () => {
  await withServer(async ({ port }) => {
    // 1) 本地客户端（curl / 脚本），不带 Origin、不带 Sec-Fetch-Site —— 必须可用
    const local = await request(port, 'GET', '/api/models');
    assert.equal(local.status, 200, '本地无来源头的请求应放行');

    // 2) 同源浏览器请求 —— 必须可用
    const same = await request(port, 'GET', '/api/models', {
      headers: { origin: `http://127.0.0.1:${port}`, 'sec-fetch-site': 'same-origin' },
    });
    assert.equal(same.status, 200, '同源请求应放行');

    // 3) 跨站带 Origin —— 拒绝
    const cross = await request(port, 'GET', '/api/models', {
      headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    });
    assert.equal(cross.status, 403, '带外站 Origin 的请求应 403');

    // 4) 跨站的「简单请求」：浏览器不发 Origin，只有 Sec-Fetch-Site —— 这是关键回归点
    const simple = await request(port, 'GET', '/api/models', {
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    assert.equal(simple.status, 403, '缺 Origin 但 Sec-Fetch-Site=cross-site 的请求应 403');

    // 5) DNS-Rebinding：伪造 Host
    const rebind = await request(port, 'GET', '/api/models', { headers: { host: 'evil.example' } });
    assert.equal(rebind.status, 403, '非法 Host 头应 403');
  });
});

test('请求守卫：启动端点只接受 JSON 正文', async () => {
  await withServer(async ({ port }) => {
    // 跨站表单提交属「简单请求」，不触发预检 —— 必须由正文类型挡住
    const form = await request(port, 'POST', '/api/tracks/launch-agent', {
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' },
      body: 'id=zcode',
    });
    assert.equal(form.status, 415, '表单正文类型应被拒绝');

    const plain = await request(port, 'POST', '/api/tracks/launch-agent', {
      headers: { 'content-type': 'text/plain' },
      body: '{"id":"zcode"}',
    });
    assert.equal(plain.status, 415, 'text/plain 正文类型应被拒绝');

    // 正确的 JSON 请求应当穿过守卫，走到「查不到这个 id」为止
    const unknown = await request(port, 'POST', '/api/tracks/launch-agent', {
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ id: '__not_declared__' }),
    });
    assert.equal(unknown.status, 400, 'JSON 正文应放行到白名单查询，未登记 id 返回 400');
    assert.match(unknown.text, /unknown agent id/);

    // 缺 id 同样不应触发任何启动
    const empty = await request(port, 'POST', '/api/tracks/launch-agent', {
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(empty.status, 400);
  });
});

test('请求守卫：静态首页仍可正常访问', async () => {
  await withServer(async ({ port }) => {
    const home = await request(port, 'GET', '/');
    assert.equal(home.status, 200);
    assert.match(home.text, /<html/i);
  });
});
