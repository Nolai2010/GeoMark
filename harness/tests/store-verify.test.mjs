import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExperimentStore, scrub } from '../kernel/store.mjs';
import { verifyBundle } from '../kernel/verify.mjs';
import { makeRequest } from '../kernel/schema.mjs';
import { EventChain } from '../kernel/audit.mjs';

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-store-'));
}

function fakeRequest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-src-'));
  const file = path.join(dir, 'problem.txt');
  fs.writeFileSync(file, '题目内容');
  return makeRequest({
    modelId: 'm', provider: 'openai-compatible', baseUrl: 'http://x/v1', apiModelId: 'm-1',
    systemPrompt: 'SYS', messages: [{ role: 'user', content: 'Q' }], files: [
      { fileId: 'f1', name: 'problem.txt', path: file, size: 12, sha256: 'x', kind: 'text' },
    ],
  });
}

test('scrub removes secret-named fields at any depth', () => {
  const out = scrub({ api_key: 'K', nested: { token: 'T', keep: 1 }, arr: [{ password: 'P' }] });
  assert.equal(out.api_key, '[REDACTED]');
  assert.equal(out.nested.token, '[REDACTED]');
  assert.equal(out.nested.keep, 1);
  assert.equal(out.arr[0].password, '[REDACTED]');
});

test('store: complete bundle layout + index entry', () => {
  const root = tmpRoot();
  const store = new ExperimentStore(root);
  const req = fakeRequest();
  const dir = store.start(req);
  store.writePrompt(dir, 'Q');
  const chain = new EventChain();
  const events = [chain.append({ type: 'message_start', data: {} }), chain.append({ type: 'message_delta', data: { text: 'A' } })];
  store.writeEvents(dir, events);
  store.writeRaw(dir, [Buffer.from('data: x\n\n')]);
  const result = {
    requestId: req.requestId, status: 'ok', text: 'A', reasoningText: '', finishReason: 'stop',
    usage: { inputTokens: 1, outputTokens: 1, raw: null }, ttftMs: 5, totalMs: 10,
    error: '', startedAt: 1, finishedAt: 2, renderedMessages: [],
  };
  const id = store.finish(dir, result, chain.root);

  for (const rel of ['config.json', 'prompt.txt', 'events.jsonl', 'result.json', 'manifest.json', 'raw/response.sse', 'files/f1_problem.txt']) {
    assert.ok(fs.existsSync(path.join(root, id, rel)), `missing ${rel}`);
  }
  assert.equal(store.list().length, 1);
  const detail = store.get(id);
  assert.equal(detail.config.requestId, req.requestId);
  assert.equal(detail.events.length, 2);
});

test('verify: intact bundle passes; any tampering fails', () => {
  const root = tmpRoot();
  const store = new ExperimentStore(root);
  const req = fakeRequest();
  const dir = store.start(req);
  store.writePrompt(dir, 'Q');
  const chain = new EventChain();
  const events = [chain.append({ type: 'message_delta', data: { text: 'A' } })];
  store.writeEvents(dir, events);
  const result = { requestId: req.requestId, status: 'ok', text: 'A', usage: {}, renderedMessages: [] };
  const id = store.finish(dir, result, chain.root);

  assert.equal(verifyBundle(path.join(root, id)).ok, true);

  // tamper with the final answer
  const resultPath = path.join(root, id, 'result.json');
  const obj = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  obj.text = '被篡改的回答';
  fs.writeFileSync(resultPath, JSON.stringify(obj, null, 2));
  const res = verifyBundle(path.join(root, id));
  assert.equal(res.ok, false);
  assert.ok(res.checks.some((c) => c.name === 'artifact result.json' && !c.ok));
});

test('verify: event-chain tampering detected', () => {
  const root = tmpRoot();
  const store = new ExperimentStore(root);
  const req = fakeRequest();
  const dir = store.start(req);
  store.writePrompt(dir, 'Q');
  const chain = new EventChain();
  const events = [chain.append({ type: 'message_delta', data: { text: 'A' } })];
  store.writeEvents(dir, events);
  const result = { requestId: req.requestId, status: 'ok', text: 'A', usage: {}, renderedMessages: [] };
  const id = store.finish(dir, result, chain.root);

  const evPath = path.join(root, id, 'events.jsonl');
  fs.writeFileSync(evPath, JSON.stringify({ ...events[0], data: { text: '换一个回答' } }) + '\n');
  const res = verifyBundle(path.join(root, id));
  assert.equal(res.ok, false);
  assert.ok(res.checks.some((c) => c.name === 'event hash chain' && !c.ok));
});

test('store.get rejects path traversal', () => {
  const store = new ExperimentStore(tmpRoot());
  assert.equal(store.get('../../etc'), null);
});
