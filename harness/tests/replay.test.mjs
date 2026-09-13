import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayRawSSE } from '../kernel/replay.mjs';
import { makeAdapter } from '../adapters/index.mjs';

const RAW =
  'data: {"choices":[{"delta":{"reasoning_content":"思考"}}]}\n\n' +
  'data: {"choices":[{"delta":{"content":"回答"}}]}\n\n' +
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
  'data: {"choices":[],"usage":{"prompt_tokens":9,"completion_tokens":3}}\n\n' +
  'data: [DONE]\n\n';

function sseResponse(text) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({ start(c) { c.enqueue(encoder.encode(text)); c.close(); } });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

test('replay reproduces the live unified event stream exactly', async () => {
  const rawChunks = [];
  const adapter = makeAdapter('openai-compatible', 'k', {
    fetchImpl: async () => sseResponse(RAW),
    onRaw: (c) => rawChunks.push(c),
  });
  const req = {
    apiModelId: 'm-1', systemPrompt: '', temperature: null, topP: null, maxTokens: null,
    reasoning: { enabled: false, effort: null, budgetTokens: null }, extraBody: {}, baseUrl: 'http://x/v1',
  };
  const live = [];
  for await (const ev of adapter.stream({ request: req, renderedMessages: [{ role: 'user', content: 'Q' }] })) live.push(ev);

  const replayed = replayRawSSE('openai-compatible', Buffer.concat(rawChunks).toString('utf8'));

  const strip = (e) => JSON.stringify({ type: e.type, data: e.data });
  assert.deepEqual(replayed.map(strip), live.map(strip));
});

test('replay is deterministic: two runs, identical bytes', () => {
  const a = replayRawSSE('openai-compatible', RAW).map((e) => JSON.stringify(e));
  const b = replayRawSSE('openai-compatible', RAW).map((e) => JSON.stringify(e));
  assert.deepEqual(a, b);
});

test('replay: provider error chunk surfaces as error event', () => {
  const events = replayRawSSE('openai-compatible', 'data: {"error":{"message":"rate limited"}}\n\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'error');
  assert.match(events[0].data.message, /rate limited/);
});
