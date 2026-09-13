import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAdapter } from '../adapters/index.mjs';
import { runExperiment } from '../kernel/pipeline.mjs';
import { makeRequest } from '../kernel/schema.mjs';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function req(overrides = {}) {
  return makeRequest({
    modelId: 'm', provider: 'openai-compatible', baseUrl: 'http://x/v1',
    apiModelId: 'm-1', systemPrompt: '', messages: [{ role: 'user', content: 'Q' }],
    ...overrides,
  });
}

function sse(text, status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      if (text) c.enqueue(encoder.encode(text));
      c.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } });
}

const COMPLETE =
  'data: {"choices":[{"delta":{"content":"A"}}]}\n\n' +
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
  'data: [DONE]\n\n';

async function runWith(fetchImpl, request, signal = null) {
  const adapter = makeAdapter('openai-compatible', 'k', { fetchImpl });
  return { ...(await runExperiment({ request, adapter, signal })), adapter };
}

// ---------------------------------------------------------------------------
// completed
// ---------------------------------------------------------------------------

test('completion: finish_reason present -> completed (even without [DONE])', async () => {
  const sseText =
    'data: {"choices":[{"delta":{"content":"A"},"finish_reason":null}]}\n\n' +
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n';
  const { result } = await runWith(async () => sse(sseText), req());
  assert.equal(result.completion, 'completed');
  assert.equal(result.status, 'ok');
});

test('completion: [DONE] present -> completed', async () => {
  const sseText = 'data: {"choices":[{"delta":{"content":"A"}}]}\n\ndata: [DONE]\n\n';
  const { result } = await runWith(async () => sse(sseText), req());
  assert.equal(result.completion, 'completed');
  assert.equal(result.status, 'ok');
});

// ---------------------------------------------------------------------------
// truncated
// ---------------------------------------------------------------------------

test('completion: clean close WITHOUT provider end signal -> truncated (never ok)', async () => {
  const sseText = 'data: {"choices":[{"delta":{"content":"写到一半"}}]}\n\n';
  const { result, events } = await runWith(async () => sse(sseText), req());
  assert.equal(result.completion, 'truncated');
  assert.equal(result.status, 'error');
  assert.ok(events.some((e) => e.type === 'error'), 'truncated must surface as error event');
  assert.ok(!events.some((e) => e.type === 'message_end' && e.data.completion === 'completed'));
});

// ---------------------------------------------------------------------------
// network error
// ---------------------------------------------------------------------------

test('completion: fetch throws -> network_error', async () => {
  const { result } = await runWith(async () => { throw new Error('ECONNRESET'); }, req());
  assert.equal(result.completion, 'network_error');
  assert.equal(result.status, 'error');
  assert.match(result.error, /ECONNRESET/);
});

// ---------------------------------------------------------------------------
// provider errors (HTTP status matrix)
// ---------------------------------------------------------------------------

for (const status of [400, 401, 429, 500]) {
  test(`completion: HTTP ${status} -> provider_error`, async () => {
    const { result, events } = await runWith(
      async () => new Response('{"error":{"message":"nope"}}', { status }),
      req()
    );
    assert.equal(result.completion, 'provider_error');
    assert.equal(result.status, 'error');
    assert.ok(events.some((e) => e.type === 'error' && e.data.message.includes(`HTTP ${status}`)));
    assert.ok(!events.some((e) => e.type === 'message_delta'), 'no fabricated content');
  });
}

test('completion: provider error payload in 200 stream -> provider_error', async () => {
  const sseText = 'data: {"error":{"message":"rate limited by upstream"}}\n\n';
  const { result } = await runWith(async () => sse(sseText), req());
  assert.equal(result.completion, 'provider_error');
  assert.equal(result.status, 'error');
  assert.match(result.error, /rate limited/);
});

// ---------------------------------------------------------------------------
// timeout
// ---------------------------------------------------------------------------

test('completion: timeoutMs fires -> timeout', async () => {
  const hangingFetch = (url, init) =>
    new Promise((_, reject) => {
      if (init.signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      init.signal?.addEventListener('abort', () =>
        reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
      );
    });
  const { result } = await runWith(hangingFetch, req({ timeoutMs: 60 }));
  assert.equal(result.completion, 'timeout');
  assert.equal(result.status, 'error');
});

// ---------------------------------------------------------------------------
// abort
// ---------------------------------------------------------------------------

test('completion: user abort -> aborted', async () => {
  const controller = new AbortController();
  controller.abort();
  const abortAwareFetch = (url, init) =>
    new Promise((_, reject) => {
      if (init.signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  const { result } = await runWith(abortAwareFetch, req(), controller.signal);
  assert.equal(result.completion, 'aborted');
  assert.equal(result.status, 'error');
});

// ---------------------------------------------------------------------------
// retry (P2): explicit config only, only for retryable completions
// ---------------------------------------------------------------------------

test('retry: maxRetries=1, first attempt network_error, second completed', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) throw new Error('ECONNRESET');
    return sse(COMPLETE);
  };
  const { result, events } = await runWith(fetchImpl, req({ maxRetries: 1 }));
  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.retries, 1);
  assert.equal(result.completion, 'completed');
  assert.equal(result.status, 'ok');
  assert.ok(events.some((e) => e.type === 'retry_start'));
  assert.ok(events.some((e) => e.type === 'retry_end' && e.data.finalCompletion === 'completed'));
});

test('retry: default maxRetries=0 -> a single attempt, no retry events', async () => {
  const { result, events } = await runWith(async () => { throw new Error('ECONNRESET'); }, req());
  assert.equal(result.attempts, 1);
  assert.equal(result.retries, 0);
  assert.ok(!events.some((e) => e.type === 'retry_start'));
});

test('retry: provider_error is NOT retryable even with maxRetries>0', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('{"error":"x"}', { status: 429 });
  };
  const { result } = await runWith(fetchImpl, req({ maxRetries: 3 }));
  assert.equal(calls, 1, '429 must not be auto-retried (would change experiment conditions)');
  assert.equal(result.attempts, 1);
  assert.equal(result.completion, 'provider_error');
});
