import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMessages } from '../kernel/assembly.mjs';
import { makeRequest } from '../kernel/schema.mjs';
import { loadSpec, makeAdapter } from '../adapters/index.mjs';
import { buildHttpRequest } from '../adapters/engine.mjs';

/** 中立性回归（需求十四）：静态扫描 + 跨模型一致性。
 *  这些测试失败 = 出现了按模型身份改变行为的代码。 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CORE_FILES = [
  'kernel/schema.mjs', 'kernel/audit.mjs', 'kernel/assembly.mjs', 'kernel/files.mjs',
  'kernel/store.mjs', 'kernel/replay.mjs', 'kernel/verify.mjs', 'kernel/pipeline.mjs',
  'kernel/config.mjs', 'kernel/unified.mjs', 'kernel/version.mjs',
  'adapters/engine.mjs', 'adapters/index.mjs',
];

const BRAND_RE = /\b(gpt|claude|deepseek|qwen|doubao|gemini|grok|llama|mistral|o1|o3)\b/i;
const GEOMETRY_RE = /\bgeometry\b|\bgeometric\b|几何/i;
const BRANCH_RE = /if\s*\([^)]*\b(provider|modelId|apiModelId|model_id)\b[^)]*===/i;

test('静态扫描：核心模块无模型品牌分支、无几何专用逻辑、无身份条件分支', () => {
  for (const rel of CORE_FILES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!BRAND_RE.test(src), `${rel} 包含模型品牌名: ${BRAND_RE.exec(src)?.[0]}`);
    assert.ok(!GEOMETRY_RE.test(src), `${rel} 包含几何专用逻辑`);
    assert.ok(!BRANCH_RE.test(src), `${rel} 包含按 provider/modelId 的条件分支`);
  }
});

test('静态扫描：通用引擎不含 provider-specific transform 分支', () => {
  const engine = fs.readFileSync(path.join(ROOT, 'adapters/engine.mjs'), 'utf8');
  assert.ok(!/\$transform/.test(engine), 'engine 不应再有 $transform 机制');
  assert.ok(!/applyTransform/.test(engine), 'engine 不应再有命名 transform 分支');
  assert.ok(!/Thinking|thinking/.test(engine.replace(/reasoning/g, '')), 'engine 不应内建 thinking 结构');
});

test('规范文件本身不含隐藏提示词：system 只来自用户输入', () => {
  const anthropic = loadSpec('anthropic');
  assert.equal(anthropic.request.template.system, '$.system', 'system 必须是纯引用，不能夹带文本');
  const openai = JSON.stringify(loadSpec('openai-compatible'));
  assert.ok(!openai.includes('"system"'), 'openai 规范不应出现任何 system 字面量');
  // 两份规范都不得包含像提示词一样的长句子
  for (const spec of [anthropic, loadSpec('openai-compatible')]) {
    for (const [k, v] of Object.entries(spec.request.template)) {
      if (typeof v === 'string') {
        assert.ok(v.startsWith('$.'), `template 字段 ${k} 必须是引用，不能是内联文本`);
      }
    }
  }
});

test('跨模型：完全相同的输入渲染出逐字节相同的消息，且各协议收到的语义一致', () => {
  const request = makeRequest({
    modelId: 'anything', provider: 'whatever', baseUrl: 'http://x', apiModelId: 'any-id',
    systemPrompt: '统一的规矩',
    messages: [{ role: 'user', content: '同一道题' }],
    temperature: 0.7, maxTokens: null,
    reasoning: { enabled: true, effort: 'high', budgetTokens: 8192 },
  });

  const rendered1 = renderMessages(request);
  const rendered2 = renderMessages(request);
  assert.equal(JSON.stringify(rendered1), JSON.stringify(rendered2), '渲染必须是确定性的');

  const openai = loadSpec('openai-compatible');
  const anthropic = loadSpec('anthropic');
  const bodyA = buildHttpRequest(openai, request, rendered1, 'k1').body;
  const bodyB = buildHttpRequest(anthropic, request, rendered1, 'k2').body;

  // 用户内容与系统提示词在两个协议下逐字相同
  assert.equal(bodyA.messages.at(-1).content, '同一道题');
  assert.equal(bodyB.messages.at(-1).content, '同一道题');
  assert.equal(bodyA.messages[0].content, '统一的规矩');
  assert.equal(bodyB.system, '统一的规矩');
  // 用户 prompt 只出现一次，无任何附加指令
  assert.equal(bodyA.messages.length, 2);
  assert.equal(bodyB.messages.length, 1);
});

test('跨模型：适配器流不因 provider 不同而改变统一事件语义', async () => {
  const sseOpenai =
    'data: {"choices":[{"delta":{"content":"同"}}]}\n\n' +
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' + 'data: [DONE]\n\n';
  const sseAnthropic =
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"同"}}\n\n' +
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n\n' +
    'event: message_stop\ndata: {"type":"message_stop"}\n\n';

  const encoder = new TextEncoder();
  const mkResp = (text) =>
    new Response(
      new ReadableStream({ start(c) { c.enqueue(encoder.encode(text)); c.close(); } }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );

  const req = makeRequest({
    modelId: 'm', provider: 'x', baseUrl: 'http://x', apiModelId: 'm-1',
    systemPrompt: '', messages: [{ role: 'user', content: 'Q' }],
  });
  const rendered = renderMessages(req);

  const a1 = makeAdapter('openai-compatible', 'k', { fetchImpl: async () => mkResp(sseOpenai) });
  const a2 = makeAdapter('anthropic', 'k', { fetchImpl: async () => mkResp(sseAnthropic) });
  const evs1 = [];
  const evs2 = [];
  for await (const e of a1.stream({ request: req, renderedMessages: rendered })) evs1.push(e);
  for await (const e of a2.stream({ request: req, renderedMessages: rendered })) evs2.push(e);
  assert.deepEqual(evs1.map((e) => e.type), evs2.map((e) => e.type));
  const text1 = evs1.filter((e) => e.type === 'message_delta').map((e) => e.data.text).join('');
  const text2 = evs2.filter((e) => e.type === 'message_delta').map((e) => e.data.text).join('');
  assert.equal(text1, text2, '两个协议收到的回答文本必须一致');
});
