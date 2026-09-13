/** E2E CLI: prompt + file -> stream -> experiment bundle -> verify (real process). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NODE = process.execPath;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'surfaces', 'cli', 'cli.mjs');

function startMockProvider() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
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
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

test('E2E cli: prompt + file -> stream -> bundle -> verify', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-e2e-cli-'));
  const configDir = path.join(tmp, 'config');
  const dataDir = path.join(tmp, 'data');
  fs.mkdirSync(configDir);

  const { server: mock, port: mockPort } = await startMockProvider();
  try {
    fs.writeFileSync(
      path.join(configDir, 'models.json'),
      JSON.stringify({
        models: [{
          id: 'e2e-model', provider: 'openai-compatible',
          base_url: `http://127.0.0.1:${mockPort}/v1`, api_model_id: 'mock-1',
          display_name: 'E2E', supports_reasoning: true, extra_body: {},
        }],
      }, null, 2)
    );

    const problemFile = path.join(tmp, '题目.txt');
    fs.writeFileSync(problemFile, '三角形内角和是多少度？');

    const env = {
      ...process.env,
      HARNESS_CONFIG_DIR: configDir,
      HARNESS_DATA_DIR: dataDir,
      HARNESS_OPENAI_API_KEY: 'cli-secret-key',
    };

    // async spawn: spawnSync would block this process's event loop and
    // starve the in-process mock provider
    const run = await new Promise((resolve) => {
      const p = spawn(NODE, [
        CLI, '--model', 'e2e-model', '--file', problemFile, '--experiment', '请根据附件解题',
      ], { env });
      let out = '';
      let err = '';
      p.stdout.on('data', (d) => (out += d));
      p.stderr.on('data', (d) => (err += d));
      const killer = setTimeout(() => p.kill(), 20000);
      p.on('close', (status) => {
        clearTimeout(killer);
        resolve({ status, stdout: out, stderr: err });
      });
    });
    assert.equal(run.status, 0, `cli exited ${run.status}: ${run.stderr}`);

    const expRoot = path.join(dataDir, 'experiments');
    const expDirs = fs.readdirSync(expRoot).filter((d) => d.startsWith('exp-'));
    assert.equal(expDirs.length, 1, 'one experiment bundle must be created');
    const expDir = path.join(expRoot, expDirs[0]);

    const result = JSON.parse(fs.readFileSync(path.join(expDir, 'result.json'), 'utf8'));
    assert.equal(result.status, 'ok');
    assert.equal(result.completion, 'completed');
    assert.equal(result.attempts, 1);
    const userRendered = result.renderedMessages.at(-1)?.content ?? '';
    assert.ok(userRendered.includes('<attached-file name="题目.txt"'), 'file representation in rendered messages: ' + userRendered.slice(0, 260));
    assert.ok(userRendered.includes('三角形内角和是多少度？'), 'file content in rendered messages');

    assert.equal(fs.readFileSync(path.join(expDir, 'prompt.txt'), 'utf8'), '请根据附件解题');
    assert.ok(fs.existsSync(path.join(expDir, 'raw', 'response.sse')), 'raw capture present');

    const request = JSON.parse(fs.readFileSync(path.join(expDir, 'request.json'), 'utf8'));
    assert.equal(request.endpoint, '/v1/chat/completions');
    assert.equal(request.headers.authorization, '[REDACTED]');
    assert.ok(!JSON.stringify(request).includes('cli-secret-key'), 'key must not leak into request.json');

    const manifest = JSON.parse(fs.readFileSync(path.join(expDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.harnessVersion, '0.6.0');
    assert.match(manifest.adapterSpec.sha256, /^[0-9a-f]{64}$/);
    assert.equal(manifest.fileRecords[0].originalName, '题目.txt');
    assert.ok(manifest.fileRecords[0].storedName.includes('题目.txt'));

    // every file in the bundle is key-free
    for (const f of fs.readdirSync(expDir, { recursive: true })) {
      const p = path.join(expDir, f.toString());
      if (fs.statSync(p).isFile()) {
        assert.ok(!fs.readFileSync(p, 'utf8').includes('cli-secret-key'), `key leaked into ${f}`);
      }
    }

    // verify subcommand passes on the same bundle
    const verify = spawnSync(NODE, [CLI, '--verify', expDir], { env, encoding: 'utf8', timeout: 20000 });
    assert.equal(verify.status, 0, `verify failed: ${verify.stdout}`);
    assert.match(verify.stdout, /bundle intact/);
  } finally {
    mock.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
