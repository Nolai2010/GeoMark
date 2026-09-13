// supports_vision 持久化回归：模型管理界面勾选"支持图像输入"后必须落盘并回读
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveModel, loadModels } from '../kernel/config.mjs';

test('config: supports_vision 标记保存与回读（视觉门控依据）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-vision-'));
  const modelsPath = path.join(tmp, 'models.json');
  saveModel({ id: 'vision-m', provider: 'openai-compatible', base_url: 'http://x/v1', api_model_id: 'v1', supports_vision: true }, modelsPath);
  saveModel({ id: 'text-m', provider: 'openai-compatible', base_url: 'http://x/v1', api_model_id: 't1' }, modelsPath);
  const models = loadModels(modelsPath);
  assert.equal(models.find((m) => m.id === 'vision-m').supports_vision, true);
  assert.equal(models.find((m) => m.id === 'text-m').supports_vision, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});
