import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSpec, makeAdapter } from '../adapters/index.mjs';
import { applyChunk, createStreamState, parseSSEText, buildHttpRequest } from '../adapters/engine.mjs';

// ---------------------------------------------------------------------------
// openai-compatible rules
// ---------------------------------------------------------------------------

test('openai: content deltas -> message_start + message_delta', () => {
  const spec = loadSpec('openai-compatible');
  const state = createStreamState();
  const chunk = { choices: [{ delta: { content: '你好' } }] };
  const evs = applyChunk(spec, { event: null, data: JSON.stringify(chunk) }, state);
  assert.deepEqual(evs.map((e) => e.type), ['message_start', 'message_delta']);
  assert.equal(evs[1].data.text, '你好');
});

test('openai: content null chunk emits NOTHING (no fabrication)', () => {
  const spec = loadSpec('openai-compatible');
  const state = createStreamState();
  const evs = applyChunk(spec, { event: null, data: JSON.stringify({ choices: [{ delta: { content: null } }] }) }, state);
  assert.deepEqual(evs, []);
});

test('openai: reasoning_content -> reasoning events; absent -> no reasoning events', () => {
  const spec = loadSpec('openai-compatible');
  const s1 = createStreamState();
  const evs = applyChunk(spec, { event: null, data: JSON.stringify({ choices: [{ delta: { reasoning_content: '想一下' } }] }) }, s1);
  assert.deepEqual(evs.map((e) => e.type), ['reasoning_start', 'reasoning_delta']);
  assert.equal(evs[1].data.text, '想一下');

  const s2 = createStreamState();
  const evs2 = applyChunk(spec, { event: null, data: JSON.stringify({ choices: [{ delta: { content: 'plain' } }] }) }, s2);
  assert.ok(!evs2.some((e) => e.type.startsWith('reasoning')));
});

test('openai: finish_reason + usage captured; [DONE] terminates', () => {
  const spec = loadSpec('openai-compatible');
  const state = createStreamState();
  applyChunk(spec, { event: null, data: JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) }, state);
  applyChunk(spec, { event: null, data: JSON.stringify({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 7 } }) }, state);
  const evs = applyChunk(spec, { event: null, data: '[DONE]' }, state);
  assert.equal(state.done, true);
  assert.equal(state.finishReason, 'stop');
  assert.equal(state.usage.inputTokens, 11);
  assert.equal(state.usage.outputTokens, 7);
  assert.deepEqual(evs, []);
});

test('openai: error chunk -> error event', () => {
  const spec = loadSpec('openai-compatible');
  const state = createStreamState();
  const evs = applyChunk(spec, { event: null, data: JSON.stringify({ error: { message: 'boom' } }) }, state);
  assert.equal(evs[0].type, 'error');
  assert.equal(evs[0].data.message, 'boom');
});

// ---------------------------------------------------------------------------
// anthropic rules
// ---------------------------------------------------------------------------

test('anthropic: text_delta and thinking_delta mapped', () => {
  const spec = loadSpec('anthropic');
  const state = createStreamState();
  const t = applyChunk(spec, { event: 'content_block_delta', data: JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: '答' } }) }, state);
  const r = applyChunk(spec, { event: 'content_block_delta', data: JSON.stringify({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: '思' } }) }, state);
  assert.deepEqual(t.map((e) => e.type), ['message_start', 'message_delta']);
  assert.deepEqual(r.map((e) => e.type), ['reasoning_start', 'reasoning_delta']);
  assert.equal(r[1].data.text, '思');
});

test('anthropic: message_start usage + message_delta stop_reason', () => {
  const spec = loadSpec('anthropic');
  const state = createStreamState();
  applyChunk(spec, { event: 'message_start', data: JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 5, output_tokens: 1 } } }) }, state);
  applyChunk(spec, { event: 'message_delta', data: JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 9 } }) }, state);
  assert.equal(state.usage.inputTokens, 5);
  assert.equal(state.usage.outputTokens, 9);
  assert.equal(state.finishReason, 'end_turn');
});

// ---------------------------------------------------------------------------
// request building (neutrality: body exactly mirrors rendered input)
// ---------------------------------------------------------------------------

const RENDERED = [
  { role: 'system', content: 'SYS' },
  { role: 'user', content: 'Q' },
];
const REQ = {
  apiModelId: 'm-1', systemPrompt: 'SYS', temperature: 0.5, topP: null, maxTokens: 100,
  reasoning: { enabled: true, effort: 'high', budgetTokens: null }, extraBody: {},
  baseUrl: 'http://x/v1',
};

test('openai body: exact messages, optional only when set, key only in headers', () => {
  const spec = loadSpec('openai-compatible');
  const { url, headers, body } = buildHttpRequest(spec, REQ, RENDERED, 'sk-SECRET');
  assert.equal(url, 'http://x/v1/chat/completions');
  assert.deepEqual(body.messages, RENDERED);
  assert.equal(body.model, 'm-1');
  assert.equal(body.temperature, 0.5);
  assert.equal(body.max_tokens, 100);
  assert.equal(body.reasoning_effort, 'high');
  assert.ok(!('top_p' in body));
  assert.ok(!JSON.stringify(body).includes('sk-SECRET'));
  assert.equal(headers.authorization, 'Bearer sk-SECRET');
});

test('openai body: temperature omitted when null; effort omitted when disabled', () => {
  const spec = loadSpec('openai-compatible');
  const { body } = buildHttpRequest(spec, { ...REQ, temperature: null, reasoning: { enabled: false, effort: 'high', budgetTokens: null } }, RENDERED, 'k');
  assert.ok(!('temperature' in body));
  assert.ok(!('reasoning_effort' in body));
});

test('anthropic body: system extracted, thinking transform, default max_tokens', () => {
  const spec = loadSpec('anthropic');
  const { headers, body } = buildHttpRequest(spec, { ...REQ, maxTokens: null, reasoning: { enabled: true, effort: null, budgetTokens: 8192 } }, RENDERED, 'K');
  assert.equal(headers['x-api-key'], 'K');
  assert.equal(body.system, 'SYS');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'Q' }]);
  assert.deepEqual(body.thinking, { type: 'enabled', budget_tokens: 8192 });
  assert.equal(body.max_tokens, 4096);
  assert.ok(!('reasoning_effort' in body));
});

test('anthropic: no thinking field when reasoning disabled', () => {
  const spec = loadSpec('anthropic');
  const { body } = buildHttpRequest(spec, { ...REQ, reasoning: { enabled: false, effort: null, budgetTokens: 8192 } }, RENDERED, 'K');
  assert.ok(!('thinking' in body));
});

// ---------------------------------------------------------------------------
// SSE text parsing (shared with replay)
// ---------------------------------------------------------------------------

test('parseSSEText handles event: lines and multi-line data', () => {
  const text = 'event: foo\ndata: {"a":1}\n\ndata: [DONE]\n\n: keepalive\n\n';
  const chunks = parseSSEText(text);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].event, 'foo');
  assert.equal(chunks[1].data, '[DONE]');
});

// ---------------------------------------------------------------------------
// live stream via mock fetch
// ---------------------------------------------------------------------------

function sseResponse(text) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(encoder.encode(text));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

test('streamUnified: full openai SSE -> ordered unified events + message_end', async () => {
  const spec = loadSpec('openai-compatible');
  const sse =
    'data: {"choices":[{"delta":{"content":"He"}}]}\n\n' +
    'data: {"choices":[{"delta":{"reasoning_content":"hmm"}}]}\n\n' +
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
    'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\n' +
    'data: [DONE]\n\n';
  const raw = [];
  const evs = [];
  const adapter = makeAdapter('openai-compatible', 'k', {
    fetchImpl: async () => sseResponse(sse),
    onRaw: (c) => raw.push(c),
  });
  for await (const ev of adapter.stream({ request: REQ, renderedMessages: RENDERED })) evs.push(ev);
  assert.deepEqual(evs.map((e) => e.type), [
    'message_start', 'message_delta', 'reasoning_start', 'reasoning_delta', 'message_end',
  ]);
  assert.equal(evs.at(-1).data.usage.inputTokens, 3);
  assert.equal(evs.at(-1).data.finishReason, 'stop');
  assert.ok(raw.length > 0);
});

test('streamUnified: HTTP 401 -> error + message_end(provider_error), no fabricated content', async () => {
  const spec = loadSpec('openai-compatible');
  const evs = [];
  const adapter = makeAdapter('openai-compatible', 'bad', {
    fetchImpl: async () => new Response('{"error":"unauthorized"}', { status: 401 }),
  });
  for await (const ev of adapter.stream({ request: REQ, renderedMessages: RENDERED })) evs.push(ev);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].type, 'error');
  assert.match(evs[0].data.message, /HTTP 401/);
  assert.equal(evs[0].data.completion, 'provider_error');
  assert.equal(evs[1].type, 'message_end');
  assert.equal(evs[1].data.completion, 'provider_error');
  assert.ok(!evs.some((e) => e.type === 'message_delta'), 'no content may be fabricated');
});
