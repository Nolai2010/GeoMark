/** ExperimentStore: reproducible, tamper-evident run bundles.
 *
 *  experiment/
 *  ├── config.json     requested config (scrubbed, never contains keys)
 *  ├── prompt.txt      the exact final user prompt text
 *  ├── files/          byte-for-byte copies, unique stored identity per file
 *  ├── request.json    what the adapter ACTUALLY sent (sanitized) + resolved config
 *  ├── events.jsonl    hash-chained unified events
 *  ├── raw/response.sse  raw provider bytes (for offline replay)
 *  ├── result.json     final output / usage / timing / completion / status
 *  └── manifest.json   sha256 of every artifact + chain root + versions
 */

import fs from 'node:fs';
import path from 'node:path';
import { sha256Buf, sha256Hex } from './audit.mjs';
import { HARNESS_VERSION, NODE_VERSION, gitCommit } from './version.mjs';

const REDACT_KEYS = new Set([
  'api_key', 'apikey', 'authorization', 'key', 'token', 'secret', 'password',
  'x-api-key', 'proxy-authorization', 'cookie', 'set-cookie', 'credentials',
]);
// substring matching ONLY for header-name objects (never for body payloads:/n// 'max_tokens' etc. must survive scrubbing untouched)
const REDACT_HEADER_SUBSTRINGS = ['key', 'token', 'secret', 'auth', 'credential', 'cookie', 'password'];
function isRedactedHeaderName(k) {
  const klc = k.toLowerCase();
  return REDACT_HEADER_SUBSTRINGS.some((sub) => klc.includes(sub));
}
export function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, isRedactedHeaderName(k) ? '[REDACTED]' : v])
  );
}

export function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : scrub(v),
      ])
    );
  }
  return value;
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

export function requestToLoggable(request) {
  return {
    modelId: request.modelId,
    provider: request.provider,
    baseUrl: request.baseUrl,
    apiModelId: request.apiModelId,
    systemPrompt: request.systemPrompt,
    messages: request.messages,
    files: (request.files ?? []).map((f) => ({
      fileId: f.fileId, name: f.name, path: f.path,
      size: f.size, sha256: f.sha256, kind: f.kind,
    })),
    temperature: request.temperature,
    topP: request.topP,
    maxTokens: request.maxTokens,
    reasoning: request.reasoning,
    timeoutMs: request.timeoutMs ?? null,
    maxRetries: request.maxRetries ?? 0,
    endpointPath: request.endpointPath ?? null,
    customHeaders: scrubHeaders(request.customHeaders),
    modelDefaults: request.modelDefaults ?? null,
    temperatureSource: request.temperatureSource ?? null,
    extraBody: request.extraBody,
    requestId: request.requestId,
    createdAt: request.createdAt,
  };
}

/** P1-1/P1-2/P1-7: the record of what was ACTUALLY sent over the wire,
 *  with sanitized headers, plus requested vs resolved config and versions.
 *  adapter.lastRequest is produced by the adapter layer (already sanitized). */
export function buildRequestRecord(adapter, request) {
  const b = adapter.lastRequest;
  if (!b) return null;
  let endpoint = b.url;
  try {
    endpoint = new URL(b.url).pathname;
  } catch {
    /* keep full url */
  }
  return {
    provider: request.provider,
    baseUrl: request.baseUrl,
    endpoint,
    method: b.method,
    headers: b.headers,
    body: b.body,
    requestedConfig: {
      temperature: request.temperature,
      topP: request.topP,
      maxTokens: request.maxTokens,
      reasoning: request.reasoning,
      timeoutMs: request.timeoutMs ?? null,
      maxRetries: request.maxRetries ?? 0,
      extraBody: request.extraBody ?? {},
    },
    resolvedConfig: b.resolvedConfig ?? null,
    harnessVersion: HARNESS_VERSION,
    runtime: { node: NODE_VERSION },
    adapterSpec: {
      provider: adapter.provider,
      version: adapter.specVersion,
      sha256: adapter.specSha256,
    },
  };
}

/** Stored identity of an input file inside a bundle.
 *  P1-6: original names may repeat; stored names never collide. */
export function storedFileName(fileMeta) {
  return `${String(fileMeta.fileId).slice(0, 8)}_${fileMeta.name}`;
}

export class ExperimentStore {
  constructor(root) {
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
    this.indexPath = path.join(this.root, 'index.jsonl');
  }

  start(request) {
    const name = `exp-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${request.requestId.slice(0, 8)}`;
    const dir = path.join(this.root, name);
    fs.mkdirSync(dir);
    fs.mkdirSync(path.join(dir, 'files'));
    fs.mkdirSync(path.join(dir, 'raw'));
    writeJson(path.join(dir, 'config.json'), scrub(requestToLoggable(request)));
    for (const f of request.files ?? []) {
      if (fs.existsSync(f.path)) {
        fs.copyFileSync(f.path, path.join(dir, 'files', storedFileName(f)));
      }
    }
    return dir;
  }

  writePrompt(dir, text) {
    fs.writeFileSync(path.join(dir, 'prompt.txt'), text, 'utf8');
  }

  writeEvents(dir, events) {
    const body = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(path.join(dir, 'events.jsonl'), body, 'utf8');
  }

  writeRaw(dir, chunks) {
    if (!chunks?.length) return;
    fs.writeFileSync(path.join(dir, 'raw', 'response.sse'), Buffer.concat(chunks));
  }

  writeRequest(dir, record) {
    if (!record) return;
    writeJson(path.join(dir, 'request.json'), scrub(record));
  }

  finish(dir, result, chainRoot, meta = {}) {
    writeJson(path.join(dir, 'result.json'), scrub(result));
    const artifacts = {};
    for (const rel of ['config.json', 'prompt.txt', 'events.jsonl', 'result.json', 'request.json']) {
      const p = path.join(dir, rel);
      if (fs.existsSync(p)) artifacts[rel] = sha256Buf(fs.readFileSync(p));
    }
    const rawP = path.join(dir, 'raw', 'response.sse');
    if (fs.existsSync(rawP)) artifacts['raw/response.sse'] = sha256Buf(fs.readFileSync(rawP));
    const files = {};
    const filesDir = path.join(dir, 'files');
    for (const f of fs.existsSync(filesDir) ? fs.readdirSync(filesDir) : []) {
      files[f] = sha256Buf(fs.readFileSync(path.join(filesDir, f)));
    }
    // P1-6: original <-> stored identity mapping (from config.json)
    let config = null;
    try {
      config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    } catch {
      config = null;
    }
    const fileRecords = (config?.files ?? []).map((f) => ({
      fileId: f.fileId,
      originalName: f.name,
      storedName: storedFileName(f),
      sha256: f.sha256,
    }));
    writeJson(path.join(dir, 'manifest.json'), {
      experimentId: path.basename(dir),
      chainRoot,
      artifacts,
      files,
      fileRecords,
      // P1-7: which harness produced this bundle
      harnessVersion: meta.harnessVersion ?? HARNESS_VERSION,
      runtime: meta.runtime ?? { node: NODE_VERSION },
      adapterSpec: meta.adapter ?? null,
      gitCommit: meta.gitCommit ?? gitCommit(),
    });
    const summary = {
      experimentId: path.basename(dir),
      requestId: result.requestId,
      status: result.status,
      completion: result.completion ?? null,
      attempts: result.attempts ?? 1,
      retries: result.retries ?? 0,
      finishedAt: result.finishedAt,
      ttftMs: result.ttftMs,
      totalMs: result.totalMs,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      error: (result.error || '').slice(0, 200),
    };
    // v0.5.1: 默认显示名 = 用户提示词前 24 字；用户可随时重命名（meta.json）
    const defaultName = (meta.defaultName ?? '').trim().slice(0, 80) || null;
    if (defaultName && !this.readName(path.basename(dir))) {
      writeJson(path.join(dir, 'meta.json'), { name: defaultName, renamedAt: Date.now() });
    }
    fs.appendFileSync(this.indexPath, JSON.stringify(summary) + '\n', 'utf8');
    return path.basename(dir);
  }

  list() {
    if (!fs.existsSync(this.indexPath)) return [];
    const entries = fs
      .readFileSync(this.indexPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
      .reverse();
    // 已删除的实验不再列出；用户命名（meta.json）优先展示
    return entries
      .filter((e) => fs.existsSync(path.join(this.root, e.experimentId)))
      .map((e) => ({ ...e, name: this.readName(e.experimentId) }));
  }

  readName(experimentId) {
    const safe = path.basename(experimentId);
    if (!safe.startsWith('exp-')) return null;
    const metaPath = path.join(this.root, safe, 'meta.json');
    if (!fs.existsSync(metaPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8')).name ?? null;
    } catch {
      return null;
    }
  }

  /** 用户自定义实验名称（v0.5.1）。写入 meta.json，不触碰受哈希链保护的产物。 */
  rename(experimentId, name) {
    const safe = path.basename(experimentId);
    if (!safe.startsWith('exp-')) throw new Error('bad experiment id');
    const clean = String(name ?? '').trim().slice(0, 80);
    if (!clean) throw new Error('名称不能为空');
    const dir = path.join(this.root, safe);
    if (!fs.existsSync(dir)) throw new Error('experiment not found');
    writeJson(path.join(dir, 'meta.json'), { name: clean, renamedAt: Date.now() });
    return clean;
  }

  /** 删除实验目录（v0.5.1）。index.jsonl 保留历史行，list() 会过滤不存在的目录。 */
  remove(experimentId) {
    const safe = path.basename(experimentId);
    if (!safe.startsWith('exp-')) throw new Error('bad experiment id');
    const dir = path.join(this.root, safe);
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  get(experimentId) {
    const safe = path.basename(experimentId); // no traversal
    if (!safe.startsWith('exp-')) return null;
    const dir = path.join(this.root, safe);
    if (!fs.existsSync(dir)) return null;
    const read = (rel) => {
      const p = path.join(dir, rel);
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    };
    const events = [];
    const evPath = path.join(dir, 'events.jsonl');
    if (fs.existsSync(evPath)) {
      for (const line of fs.readFileSync(evPath, 'utf8').split('\n')) {
        if (line.trim()) events.push(JSON.parse(line));
      }
    }
    const promptPath = path.join(dir, 'prompt.txt');
    return {
      experimentId: safe,
      name: this.readName(safe),
      config: read('config.json'),
      request: read('request.json'),
      result: read('result.json'),
      manifest: read('manifest.json'),
      events,
      prompt: fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '',
      files: fs.existsSync(path.join(dir, 'files'))
        ? fs.readdirSync(path.join(dir, 'files'))
        : [],
    };
  }

  dirOf(experimentId) {
    const safe = path.basename(experimentId);
    if (!safe.startsWith('exp-')) throw new Error('bad experiment id');
    return path.join(this.root, safe);
  }
}

export { sha256Hex };
