import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runExperiment } from '../kernel/pipeline.mjs';
import { makeRequest } from '../kernel/schema.mjs';
import { makeAdapter } from '../adapters/index.mjs';
import { FileRegistry } from '../kernel/files.mjs';

function sseResponse(text) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(c) { c.enqueue(encoder.encode(text)); c.close(); },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const OPENAI_SSE =
  'data: {"choices":[{"delta":{"content":"答案"}}]}\n\n' +
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
  'data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2}}\n\n' +
  'data: [DONE]\n\n';

function baseReq(overrides = {}) {
  return makeRequest({
    modelId: 'm', provider: 'openai-compatible', baseUrl: 'http://x/v1',
    apiModelId: 'm-1', systemPrompt: 'SYS', messages: [{ role: 'user', content: 'Q' }],
    ...overrides,
  });
}

test('pipeline: happy path — text, usage, timing, sealed chain', async () => {
  const adapter = makeAdapter('openai-compatible', 'k', { fetchImpl: async () => sseResponse(OPENAI_SSE) });
  const seen = [];
  const { result, events, chainRoot } = await runExperiment({
    request: baseReq(), adapter, onEvent: (ev) => seen.push(ev.type),
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.text, '答案');
  assert.equal(result.usage.inputTokens, 4);
  assert.equal(result.finishReason, 'stop');
  assert.ok(result.ttftMs >= 0 && result.totalMs >= 0);
  assert.deepEqual(seen, ['request_start', 'message_start', 'message_delta', 'message_end']);
  assert.equal(result.completion, 'completed');
  assert.equal(result.attempts, 1);
  assert.equal(result.retries, 0);
  assert.equal(events.at(-1).seq, events.length - 1);
  assert.ok(chainRoot && chainRoot.length === 64);
  // rendered input recorded verbatim — "模型到底看到了什么"
  assert.deepEqual(result.renderedMessages, [
    { role: 'system', content: 'SYS' },
    { role: 'user', content: 'Q' },
  ]);
});

test('pipeline: NEUTRALITY — adapter attempting input mutation is caught', async () => {
  const evilAdapter = {
    async *stream({ renderedMessages }) {
      renderedMessages[0].content = '被篡改的 System Prompt'; // frozen -> throws
      yield { type: 'message_delta', data: { text: 'x' } };
      yield { type: 'message_end', data: { usage: {}, finishReason: 'stop' } };
    },
  };
  const { result, events } = await runExperiment({ request: baseReq(), adapter: evilAdapter });
  assert.equal(result.status, 'error');
  assert.ok(!events.some((e) => e.type === 'message_end'));
  assert.ok(events.some((e) => e.type === 'error'));
});

test('pipeline: NEUTRALITY — caller request object untouched after run', async () => {
  const adapter = makeAdapter('openai-compatible', 'k', { fetchImpl: async () => sseResponse(OPENAI_SSE) });
  const req = baseReq();
  const before = JSON.stringify(req);
  await runExperiment({ request: req, adapter });
  assert.equal(JSON.stringify(req), before);
});

test('pipeline: network failure -> error event, status error, no fake content', async () => {
  const adapter = makeAdapter('openai-compatible', 'k', {
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  const { result, events } = await runExperiment({ request: baseReq(), adapter });
  assert.equal(result.status, 'error');
  assert.match(result.error, /ECONNREFUSED/);
  assert.equal(result.text, '');
  assert.equal(result.completion, 'network_error');
  assert.ok(events.some((e) => e.type === 'error'));
  const last = events.at(-1);
  assert.equal(last.type, 'message_end');
  assert.equal(last.data.completion, 'network_error');
});

test('pipeline: file read is fail-closed and fully evented', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-pl-'));
  const file = path.join(dir, '题.txt');
  fs.writeFileSync(file, '三角形内角和?');
  const registry = new FileRegistry();
  const meta = registry.registerPath(file);

  const adapter = makeAdapter('openai-compatible', 'k', { fetchImpl: async () => sseResponse(OPENAI_SSE) });
  const { result, events } = await runExperiment({
    request: baseReq({ messages: [{ role: 'user', content: '解题', fileIds: [meta.fileId] }] }),
    adapter,
    fileRegistry: registry,
  });
  assert.equal(result.status, 'ok');
  const start = events.find((e) => e.type === 'file_read_start');
  const end = events.find((e) => e.type === 'file_read_end');
  assert.equal(end.data.chars, '三角形内角和?'.length);
  // the file content reached the model through the ONE shared template
  const userMsg = result.renderedMessages.at(-1).content;
  assert.ok(userMsg.includes('<attached-file name="题.txt"'));
  assert.ok(userMsg.includes('三角形内角和?'));
});

test('pipeline: unknown file id aborts the run before any model call', async () => {
  let called = 0;
  const adapter = makeAdapter('openai-compatible', 'k', {
    fetchImpl: async () => { called++; return sseResponse(OPENAI_SSE); },
  });
  const registry = new FileRegistry();
  const { result } = await runExperiment({
    request: baseReq({ messages: [{ role: 'user', content: 'x', fileIds: ['ghost'] }] }),
    adapter, fileRegistry: registry,
  });
  assert.equal(result.status, 'error');
  assert.equal(called, 0, 'model API must not be called');
});
