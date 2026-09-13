/** P0-1 E2E: web upload -> message.fileIds -> kernel read -> provider receives the file.
 *  Spawns the real HTTP server + a local mock provider; no mocks inside kernel. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function rawRequest(base, pathStr, headers = {}) {
  return new Promise((resolve) => {
    const u = new URL(base + pathStr);
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'GET', headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}
import { fileURLToPath } from 'node:url';

const NODE = process.execPath;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'surfaces', 'web', 'server.mjs');

function startMockProvider() {
  return new Promise((resolve) => {
    const hits = { count: 0 };
    const server = http.createServer((req, res) => {
      hits.count += 1;
      if (!req.url.startsWith('/v1/chat/completions')) {
        res.writeHead(404).end();
        return;
      }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const parsed = JSON.parse(body);
        const echo = JSON.stringify(parsed.messages.map((m) => ({ r: m.role, c: m.content })));
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const chunk = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
        chunk({ choices: [{ delta: { content: '收到 ' + echo } }] });
        chunk({ choices: [{ delta: {}, finish_reason: 'stop' }] });
        chunk({ choices: [], usage: { prompt_tokens: 5, completion_tokens: 9 } });
        res.write('data: [DONE]\n\n');
        res.end();
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, hits }));
  });
}

function startHarness(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE, [SERVER], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    const base = `http://127.0.0.1:${env.HARNESS_PORT}`;
    const t0 = Date.now();
    const poll = async () => {
      while (Date.now() - t0 < 8000) {
        try {
          const r = await fetch(`${base}/api/models`);
          if (r.ok) return resolve({ child, base });
        } catch {
          /* not up yet */
        }
        await new Promise((r) => setTimeout(r, 120));
      }
      reject(new Error(`harness server did not start: ${err}`));
    };
    poll();
  });
}

test('E2E web: upload -> fileIds -> file_read events -> provider receives file -> bundle verified', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-e2e-web-'));
  const configDir = path.join(tmp, 'config');
  const dataDir = path.join(tmp, 'data');
  fs.mkdirSync(configDir);

  const { server: mock, port: mockPort } = await startMockProvider();
  const harness = { child: null };
  try {
    fs.writeFileSync(
      path.join(configDir, 'models.json'),
      JSON.stringify({
        models: [{
          id: 'e2e-model', provider: 'openai-compatible',
          base_url: `http://127.0.0.1:${mockPort}/v1`, api_model_id: 'mock-1',
          display_name: 'E2E', supports_reasoning: true,
          extra_body: { top_k: 7 },
        }],
      }, null, 2)
    );

    const port = 30000 + (process.pid % 20000);
    const { child, base } = await startHarness({
      HARNESS_PORT: String(port),
      HARNESS_CONFIG_DIR: configDir,
      HARNESS_DATA_DIR: dataDir,
      HARNESS_OPENAI_API_KEY: 'e2e-secret-key',
    });
    harness.child = child;

    // 1. upload a file through the real HTTP API
    const fd = new FormData();
    fd.append('file', new Blob(['三角形的内角和等于180度。']), '几何题.txt');
    const up = await fetch(`${base}/api/files/upload`, { method: 'POST', body: fd });
    assert.equal(up.status, 200);
    const { files } = await up.json();
    const fileId = files[0].fileId;
    assert.equal(files[0].kind, 'text');

    // 2. chat: the client binds the fileId to the user message (the P0-1 fix)
    const chat = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modelId: 'e2e-model',
        systemPrompt: '统一SYS',
        messages: [{ role: 'user', content: '请解题', fileIds: [fileId] }],
        mode: 'experiment',
        maxRetries: 0,
      }),
    });
    assert.equal(chat.status, 200);
    const sseText = await chat.text();

    // 3. the file read is evented and fail-closed
    assert.ok(sseText.includes('"file_read_start"'), 'file_read_start must be in the event stream');
    assert.ok(sseText.includes('"file_read_end"'), 'file_read_end must be in the event stream');
    assert.ok(sseText.includes('"request_start"'), 'run lifecycle must be evented');

    // 4. THE provider actually received the file content (mock echoes messages)
    const evs = sseText
      .split('\n\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => JSON.parse(l.slice(5)));
    const echoed = evs
      .filter((e) => e.type === 'message_delta')
      .map((e) => e.data.text)
      .join('');
    assert.ok(echoed.length > 0, 'provider echoed content must exist');
    // the mock echoes the received messages as a JSON string; unwrap it
    const inner = JSON.parse(echoed.replace(/^收到 /, ''));
    const userMsg = inner.find((m) => m.r === 'user').c;
    assert.ok(userMsg.includes('<attached-file name="几何题.txt"'), 'file representation must reach the provider');
    assert.ok(userMsg.includes('三角形的内角和等于180度'), 'file CONTENT must reach the provider');
    assert.ok(sseText.includes('"completion":"completed"'));

    // 5. bundle: saved, verified, request.json present, key never on disk
    const expId = evs.find((e) => e.type === 'experiment_saved')?.data.experimentId;
    assert.ok(expId, 'experiment must be saved');
    const verify = await (await fetch(`${base}/api/experiments/${expId}/verify`)).json();
    assert.equal(verify.ok, true, `bundle verification: ${JSON.stringify(verify.checks)}`);

    const detail = await (await fetch(`${base}/api/experiments/${expId}`)).json();
    assert.equal(detail.request.endpoint, '/v1/chat/completions');
    assert.equal(detail.request.requestedConfig.maxTokens, null);
    assert.equal(detail.request.requestedConfig.timeoutMs, null, 'timeoutMs=null 不得被钳成 1000ms');
    assert.equal(detail.result.completion, 'completed');
    assert.equal(detail.request.resolvedConfig.top_k, 7);
    assert.ok(detail.request.body.messages.at(-1).content.includes('三角形的内角和等于180度'));
    assert.equal(detail.manifest.harnessVersion, '0.6.0');
    assert.match(detail.manifest.adapterSpec.sha256, /^[0-9a-f]{64}$/);
    assert.equal(detail.manifest.fileRecords[0].originalName, '几何题.txt');
    assert.ok(detail.manifest.fileRecords[0].storedName.includes('几何题.txt'));

    const expDir = path.join(dataDir, 'experiments', expId);
    for (const f of fs.readdirSync(expDir, { recursive: true })) {
      const p = path.join(expDir, f.toString());
      if (fs.statSync(p).isFile()) {
        assert.ok(!fs.readFileSync(p, 'utf8').includes('e2e-secret-key'), `API key leaked into ${f}`);
      }
    }
  } finally {
    harness.child?.kill();
    mock.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('E2E web: unknown fileId is rejected fail-closed BEFORE any model call', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-e2e-web2-'));
  const configDir = path.join(tmp, 'config');
  fs.mkdirSync(configDir);

  const { server: mock, port: mockPort, hits } = await startMockProvider();
  const harness = { child: null };
  try {
    fs.writeFileSync(
      path.join(configDir, 'models.json'),
      JSON.stringify({ models: [{ id: 'e2e-model', provider: 'openai-compatible', base_url: `http://127.0.0.1:${mockPort}/v1`, api_model_id: 'mock-1' }] })
    );

    const port = 30000 + ((process.pid + 7) % 20000);
    const { child, base } = await startHarness({
      HARNESS_PORT: String(port),
      HARNESS_CONFIG_DIR: configDir,
      HARNESS_DATA_DIR: path.join(tmp, 'data'),
      HARNESS_OPENAI_API_KEY: 'k',
    });
    harness.child = child;

    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modelId: 'e2e-model',
        messages: [{ role: 'user', content: 'x', fileIds: ['ghost-id'] }],
        mode: 'experiment',
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /unknown file id/);
    assert.equal(hits.count, 0, 'the provider must never be called with unauthorized file ids');

    // 安全修复回归：跨站 Origin 被拒（HIGH-1）。undici 会剥离 Origin 头，
    // 故用原生 http 请求模拟浏览器跨站行为。
    const corsStatus = await rawRequest(base, '/api/models', { origin: 'https://evil.example' });
    assert.equal(corsStatus, 403, 'cross-origin Origin must be rejected');

    // 安全修复回归：模型级密钥路由（MEDIUM-2）
    const mk = await fetch(base + '/api/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modelId: 'e2e-model', key: 'scoped-key-1' }),
    });
    assert.equal(mk.status, 200);
    const ks = await (await fetch(base + '/api/keys/status')).json();
    assert.equal(ks.providers.modelKeys, 1, 'model-scoped key must be persisted');

    // 安全修复回归：错误 Host（DNS rebinding 面被拒）
    const rebStatus = await rawRequest(base, '/api/models', { host: 'evil.example' });
    assert.equal(rebStatus, 403, 'rebinded host must be rejected');
  } finally {
    harness.child?.kill();
    mock.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
