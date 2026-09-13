/** Web surface: static UI + JSON/SSE API. Shares the same kernel as the CLI.
 *
 * Endpoints:
 *   GET    /api/models            model registry (no keys)
 *   GET    /api/files             attached files
 *   POST   /api/files/upload      explicit file attachment (multipart)
 *   DELETE /api/files             clear attachments
 *   POST   /api/chat              SSE: sealed unified events of one run
 *   GET    /api/experiments       run index
 *   GET    /api/experiments/:id   full bundle detail
 *   GET    /api/experiments/:id/verify  offline bundle verification
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadModels, loadPresets, saveModel, deleteModel, getApiKey, keyStatus, saveApiKey, CONFIG_DIR, UPLOADS_DIR, EXPERIMENTS_DIR } from '../../kernel/config.mjs';
import { testConnection } from '../../kernel/test-connection.mjs';
import { FileRegistry } from '../../kernel/files.mjs';
import { ExperimentStore, buildRequestRecord } from '../../kernel/store.mjs';
import { runExperiment } from '../../kernel/pipeline.mjs';
import { unifiedRequestFromModel } from '../../kernel/unified.mjs';
import { HARNESS_VERSION, NODE_VERSION, gitCommit as GIT_COMMIT } from '../../kernel/version.mjs';
import { EventTypes } from '../../kernel/schema.mjs';
import { makeAdapter, supportedProviders } from '../../adapters/index.mjs';
import { verifyBundle } from '../../kernel/verify.mjs';
import { spawn } from 'node:child_process';
import { parseMultipart } from './multipart.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, 'static');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const registry = new FileRegistry({ uploadsDir: UPLOADS_DIR });
const store = new ExperimentStore(EXPERIMENTS_DIR);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const benchRuns = new Map();
const REPO_ROOT = path.resolve(PROJECT_ROOT, ".."); // 仓库根（benchmark/ docs/ 所在）
const PORT = Number(process.env.HARNESS_PORT ?? 7788);

// 安全头（LOW-6）：所有响应统一携带
const SEC_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'",
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...SEC_HEADERS,
  });
  res.end(body);
}

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function publicModel(m) {
  return {
    id: m.id,
    provider: m.provider,
    baseUrl: m.baseUrl,
    apiModelId: m.apiModelId,
    displayName: m.display_name || m.id,
    supportsReasoning: m.supports_reasoning,
    supportsVision: !!m.supports_vision,
    hasExtraBody: Object.keys(m.extra_body ?? {}).length > 0,
    extraBody: m.extra_body ?? {},
    endpointPath: m.endpoint_path ?? null,
    defaultTemperature: m.default_temperature ?? null,
    defaultMaxTokens: m.default_max_tokens ?? null,
    // custom_headers are write-only: never returned to any client
  };
}

function resolveModel(modelId) {
  const models = loadModels(path.join(CONFIG_DIR, 'models.json'));
  const m = models.find((x) => x.id === modelId);
  if (!m) throw new Error(`unknown model: ${modelId}`);
  return m;
}

async function handleChat(req, res) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)).toString('utf8'));
  } catch (e) {
    return json(res, 400, { error: `bad json: ${e.message}` });
  }
  let model;
  try {
    model = resolveModel(payload.modelId ?? '');
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
  if (!supportedProviders().includes(model.provider)) {
    return json(res, 400, { error: `unsupported provider: ${model.provider}` });
  }

  // P0-2: single shared builder — Web and CLI cannot diverge on field names
  const request = unifiedRequestFromModel(model, payload, []);

  // P0-1: bind explicitly authorized file ids to their messages (fail-closed)
  const knownIds = new Set(registry.list().map((f) => f.fileId));
  for (const m of request.messages) {
    for (const fid of m.fileIds ?? []) {
      if (!knownIds.has(fid)) {
        return json(res, 400, { error: `unknown file id: ${fid}` });
      }
    }
  }
  const usedFileIds = new Set(request.messages.flatMap((m) => m.fileIds ?? []));
  request.files = registry.list().filter((f) => usedFileIds.has(f.fileId));

  // P2 run controls: explicit, capped, recorded (default: no timeout, no retry)
  // 注意 Number(null) === 0，若直接判 Number.isFinite 会把"未设置"误判为 0ms 并钳到 1000ms（曾导致每请求 1 秒超时）
  const rawT = payload.timeoutMs;
  const t = rawT === null || rawT === undefined || rawT === '' ? NaN : Number(rawT);
  request.timeoutMs = Number.isFinite(t) && t > 0 ? Math.min(600000, Math.max(1000, t)) : null;
  const r = Number(payload.maxRetries);
  request.maxRetries = Number.isFinite(r) && r > 0 ? Math.min(5, Math.floor(r)) : 0;

  const experimentMode = payload.mode === 'experiment';
  let expDir = null;
  if (experimentMode) {
    expDir = store.start(request);
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-content-type-options': 'nosniff',
  });

  let apiKey;
  try {
    // MEDIUM-2 修复：按模型 ID 解析密钥（模型级 > 协议级 > 环境变量）
    apiKey = getApiKey(model.provider, model.id);
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: EventTypes.ERROR, data: { message: e.message }, ts: Date.now() })}\n\n`);
    res.end();
    return;
  }

  const rawChunks = [];
  const adapter = makeAdapter(model.provider, apiKey, { onRaw: (c) => rawChunks.push(c) });

  const { result, events, chainRoot } = await runExperiment({
    request,
    adapter,
    fileRegistry: registry,
    onEvent: (ev) => {
      try {
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      } catch {
        /* client gone */
      }
    },
  });

  if (expDir) {
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    store.writePrompt(expDir, lastUser?.content ?? '');
    store.writeEvents(expDir, events);
    store.writeRaw(expDir, rawChunks);
    // P1-1: record what the adapter ACTUALLY sent (sanitized) + resolved config
    store.writeRequest(expDir, buildRequestRecord(adapter, request));
    const experimentId = store.finish(expDir, result, chainRoot, {
      defaultName: (lastUser?.content ?? '').slice(0, 24),
      harnessVersion: HARNESS_VERSION,
      runtime: { node: NODE_VERSION },
      adapter: {
        provider: adapter.provider,
        version: adapter.specVersion,
        sha256: adapter.specSha256,
      },
      gitCommit: GIT_COMMIT,
    });
    try {
      res.write(
        `data: ${JSON.stringify({ type: EventTypes.EXPERIMENT_SAVED, data: { experimentId, chainRoot }, ts: Date.now() })}\n\n`
      );
    } catch {
      /* client gone */
    }
  }
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // HIGH-1 修复：同源守卫 —— 拒绝跨站 Origin 与 DNS-Rebinding Host
  const host = String(req.headers.host ?? '');
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
    return json(res, 403, { error: 'invalid host header' });
  }
  const origin = req.headers.origin;
  if (origin && origin !== `http://127.0.0.1:${PORT}` && origin !== `http://localhost:${PORT}`) {
    return json(res, 403, { error: 'cross-origin request rejected' });
  }

  try {
    if (p === '/api/models' && req.method === 'GET') {
      const models = loadModels(path.join(CONFIG_DIR, 'models.json')).map(publicModel);
      return json(res, 200, { models });
    }

    if (p === '/api/files' && req.method === 'GET') {
      return json(res, 200, { files: registry.list() });
    }
    if (p === '/api/files/upload' && req.method === 'POST') {
      const body = await readBody(req);
      const parts = parseMultipart(body, req.headers['content-type']);
      const saved = [];
      for (const part of parts) {
        if (part.filename) saved.push(registry.saveUpload(part.data, part.filename));
      }
      return json(res, 200, { files: saved });
    }
    if (p === '/api/files' && req.method === 'DELETE') {
      return json(res, 200, { cleared: registry.clear() });
    }

    if (p === '/api/keys/status' && req.method === 'GET') {
      return json(res, 200, { providers: keyStatus() });
    }
    if (p === '/api/keys' && req.method === 'POST') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8'));
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      try {
        // MEDIUM-2 修复：透传完整 payload，saveApiKey 支持 {modelId, key} 作用域
        const providers = saveApiKey(payload);
        return json(res, 200, { providers });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (p === '/api/presets' && req.method === 'GET') {
      return json(res, 200, { presets: loadPresets() });
    }
    if (p === '/api/models' && req.method === 'POST') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      try {
        saveModel(payload);
        const models = loadModels(path.join(CONFIG_DIR, 'models.json'));
        return json(res, 200, { ok: true, models: models.map(publicModel) });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }
    const delModel = /^\/api\/models\/([^/]+)$/.exec(p);
    if (delModel && req.method === 'DELETE') {
      const removed = deleteModel(decodeURIComponent(delModel[1]));
      const models = loadModels(path.join(CONFIG_DIR, 'models.json'));
      return json(res, 200, { ok: removed, models: models.map(publicModel) });
    }
    if (p === '/api/models/test' && req.method === 'POST') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      try {
        // HIGH-1 修复：存储密钥仅可用于已注册模型本身的地址；未知地址必须显式携带密钥
        const knownModel = (() => {
          try {
            const m = resolveModel(payload.id ?? '');
            return m.baseUrl === String(payload.baseUrl ?? '').replace(/\/+$/, '');
          } catch {
            return false;
          }
        })();
        const apiKey = payload.apiKey || (knownModel ? getApiKey(payload.provider, payload.id ?? null) : undefined);
        if (!apiKey) {
          return json(res, 400, { error: '连接测试请填写 API 密钥，或先保存模型' });
        }
        const outcome = await testConnection({
          provider: payload.provider,
          baseUrl: payload.baseUrl,
          apiModelId: payload.apiModelId,
          apiKey,
          endpointPath: payload.endpointPath ?? null,
          customHeaders: payload.customHeaders ?? null,
        });
        return json(res, 200, outcome);
      } catch (e) {
        return json(res, 200, { ok: false, status: 0, message: e.message });
      }
    }


    // ---------- AI 评测（benchmark）----------
    if (p === '/api/benchmark/start' && req.method === 'POST') {
      let payload;
      try { payload = JSON.parse((await readBody(req)).toString('utf8')); } catch { return json(res, 400, { error: 'bad json' }); }
      const model = loadModels(path.join(CONFIG_DIR, 'models.json')).find((m) => m.id === payload.modelId);
      if (!model) return json(res, 400, { error: 'unknown model id' });
      const modes = Array.isArray(payload.modes) && payload.modes.length ? payload.modes : ['vision', 'coord', 'pure'];
      const runId = 'web-' + model.id.replace(/[^a-z0-9._-]/gi, '') + '-' + Date.now().toString(36);
      const outDir = path.join(EXPERIMENTS_DIR, '..', 'benchmark', 'results', runId);
      const args = [path.join(REPO_ROOT, 'benchmark', 'tools', 'pipeline.mjs'),
        '--model', model.id, '--out', outDir, '--skip-png'];
      if (Array.isArray(payload.items) && payload.items.length) args.push('--items', payload.items.join(','));
      if (Array.isArray(modes) && modes.length) args.push('--modes', modes.join(','));
      const child = spawn(process.execPath, args, { cwd: PROJECT_ROOT, env: process.env });
      const rec = { stage: 'convert', lines: [], exit: null, startedAt: Date.now(), model: model.id, outDir };
      benchRuns.set(runId, rec);
      let buf = '';
      child.stdout.on('data', (d) => {
        buf += d.toString();
        const lines = buf.split('\n'); buf = lines.pop();
        for (const l of lines) {
          const t = l.trim(); if (!t) continue;
          rec.lines.push(t); if (rec.lines.length > 400) rec.lines.shift();
          const m = /^STAGE (\w+) ?(.*)$/.exec(t);
          if (m) { rec.stage = m[1]; rec.stageInfo = m[2]; }
        }
      });
      child.stderr.on('data', (d) => { rec.lines.push('ERR ' + d.toString().trim()); });
      child.on('close', (code) => { rec.exit = code; rec.stage = code === 0 ? 'done' : 'fail'; });
      return json(res, 200, { runId, outDir });
    }
    if (p === '/api/benchmark/progress' && req.method === 'GET') {
      const rec = benchRuns.get(url.searchParams.get('id'));
      if (!rec) return json(res, 404, { error: 'unknown run' });
      const summaryPath = path.join(rec.outDir, 'summary.md');
      return json(res, 200, {
        stage: rec.stage, stageInfo: rec.stageInfo || '', exit: rec.exit,
        lines: rec.lines.slice(-40),
        summaryReady: rec.exit === 0 && fs.existsSync(summaryPath),
      });
    }
    if (p === '/api/benchmark/summary' && req.method === 'GET') {
      const rec = benchRuns.get(url.searchParams.get('id'));
      if (!rec) return json(res, 404, { error: 'unknown run' });
      const f = path.join(rec.outDir, 'summary.md');
      if (!fs.existsSync(f)) return json(res, 404, { error: 'summary not ready' });
      return json(res, 200, { markdown: fs.readFileSync(f, 'utf8'), outDir: rec.outDir });
    }
    const docFile = /^\/api\/docs\/([A-Za-z0-9._-]+)$/.exec(p);
    if (docFile && req.method === 'GET') {
      const ALLOW = new Set(['GETTING-STARTED.md', 'GETTING-STARTED.zh.md', 'GETTING-STARTED.en.md']);
      if (!ALLOW.has(docFile[1])) return json(res, 404, { error: 'not found' });
      const f = path.join(REPO_ROOT, docFile[1]);
      if (!fs.existsSync(f)) return json(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', ...SEC_HEADERS });
      return void fs.createReadStream(f).pipe(res);
    }

    if (p === '/api/chat' && req.method === 'POST') {
      return await handleChat(req, res);
    }

    if (p === '/api/experiments' && req.method === 'GET') {
      return json(res, 200, { experiments: store.list() });
    }
    const expAction = /^\/api\/experiments\/([^/]+)\/(rename|delete)$/.exec(p);
    if (expAction && req.method === 'POST') {
      const id = decodeURIComponent(expAction[1]);
      try {
        if (expAction[2] === 'rename') {
          const payload = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8'));
          const name = store.rename(id, payload.name);
          return json(res, 200, { ok: true, name });
        }
        const removed = store.remove(id);
        return json(res, 200, { ok: removed });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }
    const expMatch = /^\/api\/experiments\/([^/]+)(\/verify)?$/.exec(p);
    if (expMatch && req.method === 'GET') {
      const id = decodeURIComponent(expMatch[1]);
      if (expMatch[2]) {
        return json(res, 200, verifyBundle(store.dirOf(id)));
      }
      const detail = store.get(id);
      return detail ? json(res, 200, detail) : json(res, 404, { error: 'not found' });
    }

    // 静态文件（LOW-5 修复：解码 + resolve + 分隔符前缀校验）
    let rel = p === '/' ? 'index.html' : p.slice(1);
    let decoded;
    try {
      decoded = decodeURIComponent(rel);
    } catch {
      return json(res, 400, { error: 'bad path' });
    }
    const file = path.resolve(STATIC_DIR, decoded);
    if (!file.startsWith(STATIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return json(res, 404, { error: 'not found' });
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache', // UI 文件改版立即生效，避免旧缓存
      ...SEC_HEADERS,
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: String(e?.message ?? e) });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[GeoMark-Harness] web surface: http://127.0.0.1:${PORT}`);
  console.log('[GeoMark-Harness] providers:', supportedProviders().join(', '));
});
