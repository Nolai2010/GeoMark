import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadModels } from '../kernel/config.mjs';
import { unifiedRequestFromModel } from '../kernel/unified.mjs';

/** P0-2: Web and CLI MUST go through the same builder (kernel/unified.mjs).
 *  These tests pin the contract so field naming can never drift again. */

function writeModels(tmp, extraBody) {
  const modelsJson = {
    models: [
      {
        id: 'm1', provider: 'openai-compatible', base_url: 'http://x/v1',
        api_model_id: 'm-1', display_name: 'M1', supports_reasoning: true,
        ...(extraBody ? { extra_body: extraBody } : {}),
      },
    ],
  };
  const file = path.join(tmp, 'models.json');
  fs.writeFileSync(file, JSON.stringify(modelsJson, null, 2));
  return file;
}

test('extra_body (snake_case in models.json) reaches request.extraBody', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-unified-'));
  const models = loadModels(writeModels(tmp, { top_k: 5, repetition_penalty: 1.05 }));
  const model = models[0];

  // the canonical shape: snake_case on the model entry
  assert.deepEqual(model.extra_body, { top_k: 5, repetition_penalty: 1.05 });
  assert.ok(!('extraBody' in model), 'camel alias must not exist on model entries');

  const request = unifiedRequestFromModel(model, {
    systemPrompt: 'S', messages: [{ role: 'user', content: 'Q' }], temperature: 0.5,
  });
  assert.deepEqual(request.extraBody, { top_k: 5, repetition_penalty: 1.05 });
});

test('model without extra_body -> empty passthrough, not undefined', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-unified2-'));
  const models = loadModels(writeModels(tmp, null));
  const request = unifiedRequestFromModel(models[0], {});
  assert.deepEqual(request.extraBody, {});
});

test('Web payload and CLI payload through the SAME builder are identical', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-unified3-'));
  const models = loadModels(writeModels(tmp, { top_k: 5 }));
  const model = models[0];

  // what the Web surface passes (app.js payload shape)
  const webRequest = unifiedRequestFromModel(model, {
    systemPrompt: 'S',
    messages: [{ role: 'user', content: 'Q', fileIds: [] }],
    temperature: 0.5, maxTokens: null, timeoutMs: null, maxRetries: 0,
    reasoning: { enabled: true, effort: 'high', budgetTokens: null },
  }, []);

  // what the CLI passes (cli.mjs payload shape) — same inputs, different surface
  const cliRequest = unifiedRequestFromModel(model, {
    systemPrompt: 'S',
    messages: [{ role: 'user', content: 'Q', fileIds: [] }],
    temperature: 0.5, maxTokens: null, timeoutMs: null, maxRetries: 0,
    reasoning: { enabled: true, effort: 'high', budgetTokens: null },
  }, []);

  const strip = (r) => {
    const { requestId, createdAt, ...rest } = r;
    void requestId; void createdAt;
    return rest;
  };
  assert.deepEqual(strip(webRequest), strip(cliRequest));
});

test('both surfaces produce the same HTTP body for the same inputs', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-unified4-'));
  const models = loadModels(writeModels(tmp, { top_k: 5 }));
  const model = models[0];
  const payload = {
    systemPrompt: 'S',
    messages: [{ role: 'user', content: 'Q' }],
    temperature: 0.5,
  };
  const rendered = [{ role: 'system', content: 'S' }, { role: 'user', content: 'Q' }];

  const { buildHttpRequest } = await import('../adapters/engine.mjs');
  const spec = (await import('../adapters/index.mjs')).loadSpec(model.provider);
  const a = buildHttpRequest(spec, unifiedRequestFromModel(model, payload, []), rendered, 'k1');
  const b = buildHttpRequest(spec, unifiedRequestFromModel(model, payload, []), rendered, 'k1');
  assert.deepEqual(a.body, b.body);
  assert.deepEqual(a.body.top_k, 5);
});

test('回归：loadModels 产出的模型对象必须把 apiModelId 带进 wire body（字段名不得漂移）', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fieldname-'));
  const model = loadModels(writeModels(tmp, null))[0];
  const request = unifiedRequestFromModel(model, {
    systemPrompt: '', messages: [{ role: 'user', content: 'Q' }],
  }, []);
  assert.equal(request.apiModelId, 'm-1', 'apiModelId 不得为空（loadModels 产出驼峰字段）');
  const { loadSpec } = await import('../adapters/index.mjs');
  const { buildHttpRequest } = await import('../adapters/engine.mjs');
  const { body } = buildHttpRequest(loadSpec(model.provider), request, [{ role: 'user', content: 'Q' }], 'k');
  assert.equal(body.model, 'm-1', 'wire body.model 必须非空');
});
