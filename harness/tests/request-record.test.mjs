import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAdapter } from '../adapters/index.mjs';
import { runExperiment } from '../kernel/pipeline.mjs';
import { buildRequestRecord } from '../kernel/store.mjs';
import { makeRequest } from '../kernel/schema.mjs';
import { HARNESS_VERSION } from '../kernel/version.mjs';

function sse(text) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({ start(c) { c.enqueue(encoder.encode(text)); c.close(); } });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const OK_SSE =
  'data: {"choices":[{"delta":{"content":"A"}}]}\n\n' +
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
  'data: [DONE]\n\n';

async function run(provider, apiKey, request) {
  const adapter = makeAdapter(provider, apiKey, { fetchImpl: async () => sse(OK_SSE) });
  const { result } = await runExperiment({ request, adapter });
  return { adapter, result };
}

test('P1-1: lastRequest records the ACTUAL wire request, key redacted (openai)', async () => {
  const request = makeRequest({
    modelId: 'm', provider: 'openai-compatible', baseUrl: 'http://x/v1', apiModelId: 'm-1',
    systemPrompt: 'SYS', messages: [{ role: 'user', content: 'Q' }], temperature: 0.3, maxTokens: 555,
  });
  const { adapter, result } = await run('openai-compatible', 'sk-LIVE-KEY-123', request);
  assert.equal(result.status, 'ok');
  const b = adapter.lastRequest;
  assert.equal(b.method, 'POST');
  assert.equal(b.headers.authorization, '[REDACTED]');
  assert.ok(!JSON.stringify(b).includes('sk-LIVE-KEY-123'), 'key must never appear in the record');
  assert.equal(b.body.max_tokens, 555);
  assert.equal(b.body.temperature, 0.3);
  // resolved config mirrors the body minus message payloads
  assert.equal(b.resolvedConfig.max_tokens, 555);
  assert.ok(!('messages' in b.resolvedConfig));
});

test('P1-2: resolved config shows effective defaults (anthropic max_tokens 4096)', async () => {
  const request = makeRequest({
    modelId: 'm', provider: 'anthropic', baseUrl: 'http://x', apiModelId: 'm-1',
    systemPrompt: 'SYS', messages: [{ role: 'user', content: 'Q' }],
    maxTokens: null, // user left it empty
    reasoning: { enabled: true, effort: null, budgetTokens: 8192 },
  });
  const { adapter } = await run('anthropic', 'sk-ant-LIVE', request);
  const b = adapter.lastRequest;
  // requested was null; the wire carried the protocol default
  assert.equal(b.resolvedConfig.max_tokens, 4096);
  assert.deepEqual(b.resolvedConfig.thinking, { type: 'enabled', budget_tokens: 8192 });
  assert.equal(b.headers['x-api-key'], '[REDACTED]');
  assert.ok(!JSON.stringify(b).includes('sk-ant-LIVE'));
});

test('P1-7: buildRequestRecord carries versions and spec identity', async () => {
  const request = makeRequest({
    modelId: 'm', provider: 'openai-compatible', baseUrl: 'http://x/v1', apiModelId: 'm-1',
    systemPrompt: '', messages: [{ role: 'user', content: 'Q' }], temperature: null,
  });
  const { adapter } = await run('openai-compatible', 'k', request);
  const record = buildRequestRecord(adapter, request);
  assert.equal(record.provider, 'openai-compatible');
  assert.equal(record.endpoint, '/v1/chat/completions');
  assert.equal(record.method, 'POST');
  assert.equal(record.requestedConfig.maxTokens, null);
  assert.equal(record.resolvedConfig.model, 'm-1');
  assert.ok(typeof record.harnessVersion === 'string' && record.harnessVersion.length > 0);
  assert.equal(record.runtime.node, process.version);
  assert.match(record.adapterSpec.sha256, /^[0-9a-f]{64}$/);
  assert.equal(record.adapterSpec.provider, 'openai-compatible');
});

test('sanitizeHeaders: any suspicious header name is redacted', async () => {
  const { sanitizeHeaders } = await import('../adapters/index.mjs');
  const out = sanitizeHeaders({
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    authorization: 'Bearer x',
    'x-api-key': 'y',
    'my-custom-token': 'z',
    cookie: 'session=1',
  });
  assert.equal(out['content-type'], 'application/json');
  assert.equal(out['anthropic-version'], '2023-06-01');
  assert.equal(out.authorization, '[REDACTED]');
  assert.equal(out['x-api-key'], '[REDACTED]');
  assert.equal(out['my-custom-token'], '[REDACTED]');
  assert.equal(out.cookie, '[REDACTED]');
});
