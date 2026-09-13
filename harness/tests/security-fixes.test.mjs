import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveApiKey, saveModel, loadModels } from '../kernel/config.mjs';
import { deepClean } from '../kernel/schema.mjs';
import { testConnection } from '../kernel/test-connection.mjs';
import { unifiedRequestFromModel } from '../kernel/unified.mjs';
import { loadSpec } from '../adapters/index.mjs';
import { buildHttpRequest } from '../adapters/engine.mjs';
import { buildHttpRequest as build } from '../adapters/engine.mjs';

/** 安全修复回归（对应 SECURITY-REVIEW-CODEDEFENCER.md 的发现清单）。 */

test('fix HIGH-1/MEDIUM-2: /api/keys 支持模型级密钥（saveApiKey 整包透传）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fix1-'));
  const prev = process.env.HARNESS_OPENAI_API_KEY;
  delete process.env.HARNESS_OPENAI_API_KEY;
  try {
    const st = saveApiKey({ modelId: 'my-relay', key: 'model-key-1' }, undefined, tmp);
    assert.equal(st.modelKeys, 1);
    assert.equal(getKey(tmp, 'my-relay'), 'model-key-1');
    assert.equal(getKey(tmp, undefined), undefined, '协议级未配置时无键');
  } finally {
    if (prev !== undefined) process.env.HARNESS_OPENAI_API_KEY = prev;
  }
  function getKey(dir, modelId) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8'));
    return modelId ? data.models?.[modelId] : data.providers?.['openai-compatible'];
  }
});

test('fix LOW-4: modelId 危险键名被拒绝（原型污染）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fix2-'));
  assert.throws(() => saveApiKey({ modelId: '__proto__', key: 'x' }, undefined, tmp), /invalid model id/);
  assert.throws(() => saveApiKey({ modelId: 'constructor', key: 'x' }, undefined, tmp), /invalid model id/);
});

test('fix LOW-4: extra_body / custom_headers 深度清洗危险键', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fix3-'));
  const modelsPath = path.join(tmp, 'models.json');
  saveModel({
    id: 'evil-test', provider: 'openai-compatible', base_url: 'http://x/v1', api_model_id: 'e1',
    extra_body: { top_k: 3, __proto__: { injected: true }, nested: { constructor: 'x', ok: 1 } },
    custom_headers: { 'x-api-key': 'secret-header', ok: 'y' },
  }, modelsPath);
  const [m] = loadModels(modelsPath);
  assert.equal(m.extra_body.top_k, 3);
  assert.ok(!('injected' in m.extra_body));
  assert.ok(!Object.hasOwn(JSON.parse(JSON.stringify(m.extra_body)), '__proto__'));
  assert.equal(m.extra_body.nested.ok, 1);
  assert.ok(!Object.hasOwn(m.extra_body.nested, 'constructor'));
  const raw = JSON.stringify(m);
  assert.ok(!raw.includes('"injected"'), '序列化后不得包含被清洗的注入键');
  assert.ok(raw.includes('secret-header'), 'custom_headers 为写入侧配置，按原值存储（实验记录侧另有脱敏）');
});

test('fix LOW-4: engine 合并 wire body 时不传播危险键', () => {
  const request = unifiedRequestFromModel(
    { id: 'm', provider: 'openai-compatible', baseUrl: 'http://x/v1', api_model_id: 'm-1', extra_body: JSON.parse('{"__proto__":{"x":1},"keep":2}') },
    { systemPrompt: '', messages: [{ role: 'user', content: 'Q' }] }, []
  );
  const rendered = [{ role: 'user', content: 'Q' }];
  const { body } = buildHttpRequest(loadSpec('openai-compatible'), request, rendered, 'k');
  assert.equal(body.keep, 2);
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes('"x"'), '原型对象不得传播进 wire body');
});

test('fix MEDIUM-3: 云元数据地址被拦截且不发起任何请求', async () => {
  let called = 0;
  const out = await testConnection({
    provider: 'openai-compatible', baseUrl: 'http://169.254.169.254/latest/meta-data/', apiModelId: 'm', apiKey: 'k',
    fetchImpl: async () => { called += 1; return { ok: true, status: 200 }; },
  });
  assert.equal(out.ok, false);
  assert.equal(called, 0, '元数据地址必须在 fetch 前拦截');
  assert.match(out.message, /不允许测试/);
});

test('fix MEDIUM-3: 非 http(s) 协议被拦截', async () => {
  const out = await testConnection({
    provider: 'openai-compatible', baseUrl: 'file:///etc/passwd', apiModelId: 'm', apiKey: 'k',
    fetchImpl: async () => { throw new Error('SHOULD NOT BE CALLED'); },
  });
  assert.equal(out.ok, false);
  assert.match(out.message, /仅允许 http\(s\)/);
});

test('fix LOW-5: deepClean 对普通数据无损', () => {
  const data = { a: 1, b: ['x', { c: 2 }], d: null, e: '词元' };
  assert.deepEqual(deepClean(data), data);
});
