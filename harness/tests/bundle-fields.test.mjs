// 回归：实验包必须稳定记录 README 承诺的全部 13 类字段。
// 任何字段缺失或改名，本测试立即失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

import { unifiedRequestFromModel } from '../kernel/unified.mjs';
import { makeAdapter } from '../adapters/index.mjs';
import { runExperiment } from '../kernel/pipeline.mjs';
import { ExperimentStore, buildRequestRecord } from '../kernel/store.mjs';

function writeModels(dir, body) {
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'config', 'models.json'),
    JSON.stringify({ models: [body] })
  );
}

test('bundle fields: 13 类承诺字段全部落盘且可复原', async () => {
  // 本地 mock provider（回显 usage 的最终块）
  const mock = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: '好' } }] }) + '\n\n');
      res.write('data: ' + JSON.stringify({
        choices: [{ delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 7, completion_tokens: 3 },
      }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const port = mock.address().port;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fields-'));
  try {
    writeModels(tmp, {
      id: 'vm', provider: 'openai-compatible',
      base_url: 'http://127.0.0.1:' + port + '/v1',
      api_model_id: 'vm-1', display_name: 'Verify',
      supports_reasoning: true, extra_body: {},
    });
    const SECRET = 'sk-field-verify-0123456789abcdef';
    process.env.HARNESS_OPENAI_API_KEY = SECRET;
    const { loadModels } = await import('../kernel/config.mjs');
    const { getApiKey } = await import('../kernel/config.mjs');
    const model = loadModels(path.join(tmp, 'config', 'models.json'))[0];

    const request = unifiedRequestFromModel(model, {
      systemPrompt: '系统提示词-验证',
      messages: [{ role: 'user', content: '用户提示词-验证' }],
      reasoning: { enabled: true, effort: 'high', budgetTokens: null },
    }, []);
    request.timeoutMs = null;
    request.maxRetries = 0;

    const store = new ExperimentStore(path.join(tmp, 'experiments'));
    const expDir = store.start(request);
    const adapter = makeAdapter(model.provider, getApiKey(model.provider, null, path.join(tmp, 'config')));
    const { result, events, rawChunks } = await runExperiment({
      request, adapter, fileRegistry: null, onEvent: () => {},
    });
    store.writePrompt(expDir, '用户提示词-验证');
    store.writeEvents(expDir, events);
    store.writeRaw(expDir, rawChunks ?? []);
    store.writeRequest(expDir, buildRequestRecord(adapter, request));
    store.finish(expDir, result, null, { defaultName: '用户提示词-验证' });

    const read = (f) => JSON.parse(fs.readFileSync(path.join(expDir, f), 'utf8'));
    const cfg = read('config.json');
    const res = read('result.json');
    const reqRec = read('request.json');

    // 1 Model / 2 Provider
    assert.equal(cfg.modelId, 'vm');
    assert.equal(cfg.provider, 'openai-compatible');
    // 3 Endpoint（baseUrl + endpoint 路径可完整复原实际发送的 URL）
    assert.equal(reqRec.baseUrl, model.baseUrl);
    assert.equal(reqRec.endpoint, '/v1/chat/completions');
    assert.equal(reqRec.method, 'POST');
    // 4 System Prompt / 5 User Prompt（config + prompt.txt 双落点）
    assert.equal(cfg.systemPrompt, '系统提示词-验证');
    assert.equal(cfg.messages.at(-1).content, '用户提示词-验证');
    assert.equal(fs.readFileSync(path.join(expDir, 'prompt.txt'), 'utf8'), '用户提示词-验证');
    // 6 Reasoning Config
    assert.deepEqual(cfg.reasoning, { enabled: true, effort: 'high', budgetTokens: null });
    // 7 TTFT / 8 Total Latency
    assert.equal(typeof res.ttftMs, 'number');
    assert.ok(res.ttftMs >= 0);
    assert.equal(typeof res.totalMs, 'number');
    assert.ok(res.totalMs >= res.ttftMs);
    // 9/10 Input/Output Tokens（provider 提供 usage 时必须如实记录）
    assert.equal(res.usage.inputTokens, 7);
    assert.equal(res.usage.outputTokens, 3);
    // 11 Termination Reason / 12 Status
    assert.equal(res.finishReason, 'stop');
    assert.equal(res.status, 'ok');
    assert.equal(res.completion, 'completed');
    // 13 Timestamp（起止均可复原）
    assert.equal(typeof res.startedAt, 'number');
    assert.equal(typeof res.finishedAt, 'number');
    assert.ok(res.finishedAt >= res.startedAt);

    // 密钥绝不出现在任何 bundle 文件中
    for (const f of fs.readdirSync(expDir)) {
      const p = path.join(expDir, f);
      if (fs.statSync(p).isFile()) {
        assert.ok(!fs.readFileSync(p, 'utf8').includes(SECRET), `secrets must not leak into ${f}`);
      }
    }
  } finally {
    mock.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.HARNESS_CONFIG_DIR;
    delete process.env.HARNESS_OPENAI_API_KEY;
  }
});
