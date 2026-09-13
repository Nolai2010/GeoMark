import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPresets, loadModels, saveModel, deleteModel, getApiKey, saveApiKey } from '../kernel/config.mjs';
import { unifiedRequestFromModel } from '../kernel/unified.mjs';
import { loadSpec } from '../adapters/index.mjs';
import { buildHttpRequest } from '../adapters/engine.mjs';
import { testConnection } from '../kernel/test-connection.mjs';

const RENDERED = [{ role: 'system', content: '统一提示词' }, { role: 'user', content: '同一道题' }];

/** 需求二十九：全部 Preset 只做协议映射——同输入下除协议差异外条件一致，无任何提示词注入。 */

test('presets: 全部预设可通过协议映射生成正确 wire 请求，且不含任何密钥/提示词', () => {
  const presets = loadPresets();
  assert.ok(presets.length >= 7, '至少提供 7 个预设');
  const ids = new Set(presets.map((p) => p.id));
  for (const required of ['deepseek', 'qwen', 'kimi', 'minimax', 'chatglm', 'openai', 'anthropic']) {
    assert.ok(ids.has(required), `缺少预设 ${required}`);
  }
  for (const p of presets) {
    const model = {
      id: p.id, provider: p.provider, baseUrl: p.baseUrl, api_model_id: p.apiModelId,
      extra_body: {}, endpoint_path: p.endpointPath ?? null,
    };
    const request = unifiedRequestFromModel(model, { systemPrompt: '统一提示词', messages: [{ role: 'user', content: '同一道题' }] }, []);
    const spec = loadSpec(p.provider);
    const { url, headers, body } = buildHttpRequest(spec, request, RENDERED, 'sk-TEST-KEY');
    // URL = 预设 Base URL + 协议/自定义接口路径
    assert.ok(url.startsWith(p.baseUrl), `${p.id}: URL 必须以预设 Base URL 开头`);
    assert.ok(url.endsWith(p.endpointPath ?? spec.endpoint.path));
    // 密钥只在 headers，且不进入 body
    assert.ok(!JSON.stringify(body).includes('sk-TEST-KEY'), `${p.id}: 密钥不得进入请求体`);
    if (p.provider === 'openai-compatible') {
      assert.equal(headers.authorization, 'Bearer sk-TEST-KEY');
      assert.deepEqual(body.messages, RENDERED);
      assert.equal(body.messages[0].content, '统一提示词');
    } else {
      assert.equal(headers['x-api-key'], 'sk-TEST-KEY');
      assert.equal(body.system, '统一提示词');
      assert.deepEqual(body.messages, [{ role: 'user', content: '同一道题' }]);
    }
    assert.equal(body.model, p.apiModelId);
  }
});

/** 自定义接口：接口路径 / 自定义请求头 / 默认参数。 */

test('custom endpoint: endpoint_path 与 custom_headers 透传并被记录脱敏', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-custom-'));
  const modelsPath = path.join(tmp, 'models.json');
  saveModel({
    id: 'my-relay', provider: 'openai-compatible',
    base_url: 'https://relay.example.com/v9', api_model_id: 'relay-large',
    display_name: '自建中转',
    endpoint_path: '/v9/chat', // 自定义接口路径
    custom_headers: { 'x-org-id': 'team-1', 'x-api-key': 'sk-CUSTOM-SECRET' },
    default_temperature: 0.3,
    default_max_tokens: 777,
    extra_body: { presence_penalty: 0.2 },
  }, modelsPath);
  const [model] = loadModels(modelsPath);
  assert.equal(model.endpoint_path, '/v9/chat');
  assert.deepEqual(model.custom_headers, { 'x-org-id': 'team-1', 'x-api-key': 'sk-CUSTOM-SECRET' });

  const request = unifiedRequestFromModel(model, { systemPrompt: 'S', messages: [{ role: 'user', content: 'Q' }] }, []);
  // 模型级默认参数在未显式指定时生效，并标记来源
  assert.equal(request.temperature, 0.3);
  assert.equal(request.temperatureSource, 'model-default');
  assert.equal(request.maxTokens, 777);

  const { url, headers, body } = buildHttpRequest(loadSpec('openai-compatible'), request, RENDERED, 'sk-STORED');
  assert.equal(url, 'https://relay.example.com/v9/v9/chat');
  assert.equal(headers['x-org-id'], 'team-1'); // 自定义头生效
  assert.equal(body.temperature, 0.3);
  assert.equal(body.max_tokens, 777);

  // 显式 payload 优先于模型默认，来源标记为 request
  const r2 = unifiedRequestFromModel(model, { temperature: 0.9, systemPrompt: '', messages: [] }, []);
  assert.equal(r2.temperature, 0.9);
  assert.equal(r2.temperatureSource, 'request');
});

/** 模型 CRUD + 密钥作用域。 */

test('models: saveModel upsert / deleteModel / 校验', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-crud-'));
  const modelsPath = path.join(tmp, 'models.json');
  saveModel({ id: 'model-a', provider: 'openai-compatible', base_url: 'http://x/v1', api_model_id: 'ma' }, modelsPath);
  saveModel({ id: 'model-a', provider: 'openai-compatible', base_url: 'http://x/v2', api_model_id: 'ma2' }, modelsPath);
  const models = loadModels(modelsPath);
  assert.equal(models.length, 1, '同 id 应为更新而非新增');
  assert.equal(models[0].baseUrl, 'http://x/v2');
  assert.equal(deleteModel('model-a', modelsPath), true);
  assert.equal(loadModels(modelsPath).length, 0);
  assert.throws(() => saveModel({ id: 'bad id!', provider: 'openai-compatible', base_url: 'http://x', api_model_id: 'm' }, modelsPath), /模型 ID/);
  assert.throws(() => saveModel({ id: 'ok', provider: 'nope', base_url: 'http://x', api_model_id: 'm' }, modelsPath), /不支持的协议/);
  assert.throws(() => saveModel({ id: 'ok', provider: 'openai-compatible', base_url: 'ftp://x', api_model_id: 'm' }, modelsPath), /API 地址/);
});

test('keys: 模型级密钥优先于协议级密钥；环境变量最高', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-scope-'));
  // 与并行的 keys.test 隔离环境变量
  const prevOai = process.env.HARNESS_OPENAI_API_KEY;
  delete process.env.HARNESS_OPENAI_API_KEY;
  const prevOaiKeysScope = process.env.HARNESS_OPENAI_API_KEY;
  delete process.env.HARNESS_OPENAI_API_KEY;
  try {
    saveApiKey({ provider: 'openai-compatible', key: 'provider-level' }, undefined, tmp);
    saveApiKey({ modelId: 'my-relay', key: 'model-level' }, undefined, tmp);
    assert.equal(getApiKey('openai-compatible', 'my-relay', tmp), 'model-level');
    assert.equal(getApiKey('openai-compatible', 'other-model', tmp), 'provider-level');
    assert.equal(getApiKey('openai-compatible', null, tmp), 'provider-level');
    process.env.HARNESS_OPENAI_API_KEY = 'env-level';
    try { assert.equal(getApiKey('openai-compatible', 'my-relay', tmp), 'env-level'); } finally {
      if (prevOaiKeysScope !== undefined) process.env.HARNESS_OPENAI_API_KEY = prevOaiKeysScope;
      else delete process.env.HARNESS_OPENAI_API_KEY;
    }
  } finally {
    if (prevOai !== undefined) process.env.HARNESS_OPENAI_API_KEY = prevOai;
    else delete process.env.HARNESS_OPENAI_API_KEY;
  }
});

/** 连接测试：只报状态与 HTTP 码，绝不回显密钥。 */

function mockFetch(handler) {
  return async (url, init) => {
    const res = handler(new URL(url), init ?? {});
    return typeof res === 'object' && res instanceof Response
      ? res
      : new Response(res?.body ?? '', res ?? {});
  };
}

test('test connection: openai-compatible 200 -> 连接成功', async () => {
  const out = await testConnection({
    provider: 'openai-compatible', baseUrl: 'https://api.x.com/v1', apiModelId: 'm', apiKey: 'sk-SECRET',
    fetchImpl: mockFetch(() => ({ status: 200, body: '[]' })),
  });
  assert.equal(out.ok, true);
  assert.equal(out.message, '连接成功');
});

test('test connection: /models 404 时回退到最小补全调用', async () => {
  const urls = [];
  const out = await testConnection({
    provider: 'openai-compatible', baseUrl: 'https://api.x.com/v1', apiModelId: 'm', apiKey: 'sk-SECRET',
    fetchImpl: mockFetch((u) => {
      urls.push(u.pathname);
      if (u.pathname.endsWith('/models')) return { status: 404, body: '' };
      return { status: 200, body: '{}' };
    }),
  });
  assert.deepEqual(urls, ['/v1/models', '/v1/chat/completions']);
  assert.equal(out.ok, true);
});

test('test connection: 401/404/429 分类文案不含密钥', async () => {
  for (const status of [401, 404, 429]) {
    const out = await testConnection({
      provider: 'openai-compatible', baseUrl: 'https://api.x.com/v1', apiModelId: 'm', apiKey: 'sk-SECRET-XYZ',
      fetchImpl: mockFetch(() => ({ status, body: '' })),
    });
    assert.equal(out.ok, false);
    assert.match(out.message, new RegExp(`HTTP ${status}`));
    assert.ok(!out.message.includes('sk-SECRET-XYZ'), '错误信息绝不能包含密钥');
  }
});

test('test connection: 网络错误 / 缺少密钥 / anthropic 最小调用', async () => {
  const net = await testConnection({
    provider: 'openai-compatible', baseUrl: 'https://api.x.com/v1', apiModelId: 'm', apiKey: 'k',
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  assert.equal(net.ok, false);
  assert.match(net.message, /网络错误/);

  const noKey = await testConnection({
    provider: 'openai-compatible', baseUrl: 'https://api.x.com/v1', apiModelId: 'm', apiKey: '',
    fetchImpl: mockFetch(() => ({ status: 200, body: '[]' })),
  });
  assert.equal(noKey.ok, false);
  assert.match(noKey.message, /尚未配置 API 密钥/);

  const bodies = [];
  const ant = await testConnection({
    provider: 'anthropic', baseUrl: 'https://api.x.com', apiModelId: 'm-1', apiKey: 'k',
    fetchImpl: mockFetch((u, init) => {
      bodies.push({ path: u.pathname, body: JSON.parse(init.body) });
      return { status: 200, body: '{}' };
    }),
  });
  assert.equal(ant.ok, true);
  assert.equal(bodies[0].path, '/v1/messages');
  assert.equal(bodies[0].body.max_tokens, 1);
});

test('编辑模型：未提供 custom_headers 时原样保留（UI 不可回显字段不被冲掉）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-keep-'));
  const modelsPath = path.join(tmp, 'models.json');
  saveModel({ id: 'keep-h', provider: 'openai-compatible', base_url: 'http://x/v1', api_model_id: 'k1', custom_headers: { 'x-api-key': 'old-secret' } }, modelsPath);
  saveModel({ id: 'keep-h', provider: 'openai-compatible', base_url: 'http://x/v2', api_model_id: 'k2' }, modelsPath);
  const [m] = loadModels(modelsPath);
  assert.deepEqual(m.custom_headers, { 'x-api-key': 'old-secret' });
  assert.equal(m.baseUrl, 'http://x/v2');
  // 显式提供空对象 = 清除
  saveModel({ id: 'keep-h', provider: 'openai-compatible', base_url: 'http://x/v2', api_model_id: 'k2', custom_headers: {} }, modelsPath);
  assert.equal(loadModels(modelsPath)[0].custom_headers, null);
});
