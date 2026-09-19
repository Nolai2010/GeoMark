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
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
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
function benchDir(id) { // 内存优先，磁盘兜底：服务重启后仍可回看历史评测
  if (benchRuns.has(id)) return benchRuns.get(id).outDir;
  const d = path.join(REPO_ROOT, "benchmark", "results", id);
  return fs.existsSync(d) ? d : null;
}
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

function raw(res, code, contentType, buf, filename) {
  const headers = { 'content-type': contentType, 'content-length': buf.length, ...SEC_HEADERS };
  if (filename) headers['content-disposition'] = `attachment; filename="${filename.replace(/[^\w.\-]/g, '_')}"`;
  res.writeHead(code, headers);
  res.end(buf);
}

// ---------- 出题包导出（给 Real-World 赛道在各家网页上跑我们的题） ----------
const BENCH_ITEMS_DIR = path.join(REPO_ROOT, 'benchmark', 'items');
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
function readItem(id) {
  if (!SAFE_ID.test(String(id || ''))) return null; // 防路径穿越
  const dir = path.join(BENCH_ITEMS_DIR, id);
  const metaPath = path.join(dir, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const problem = fs.readFileSync(path.join(dir, 'problem.md'), 'utf8');
  const figures = [].concat(meta.figure || []).map(f => ({ rel: f, abs: path.join(dir, f) })).filter(f => fs.existsSync(f.abs));
  return { id, dir, meta, problem, figures };
}
// 最小 ZIP 写入器（store，不压缩；避免引入任何依赖）
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
  return t;
})();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function makeZip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const crc = crc32(f.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(0, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(f.data.length, 18); lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, nameBuf, f.data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(f.data.length, 20); ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + f.data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, eocd]);
}
function buildItemZip(item) {
  const files = [{ name: `${item.id}/problem.md`, data: Buffer.from(item.problem, 'utf8') }];
  files.push({ name: `${item.id}/作答要求.txt`, data: Buffer.from(
    'GeoMark 评测作答要求：\n1. 只依据题面与配图作答，不要联网检索、不要询问澄清。\n2. 给出完整、严谨的推理过程，每一步注明依据。\n' +
    '3. 数值答案给出精确值（可含根号、分数）。\n4. 本包内含 problem.md（题面）与 assets/（配图）。若平台无法读压缩包，请改用「题卡 PNG」。\n', 'utf8') });
  for (const f of item.figures) files.push({ name: `${item.id}/${f.rel}`, data: fs.readFileSync(f.abs) });
  return makeZip(files);
}
// url 会被交给 `cmd /c start`：即便作为独立 argv 传入，cmd.exe 仍会重新解析整条命令行，
// 所以这里做协议白名单并拒绝空白/引号/shell 元字符，避免配置里的 url 影响命令结构。
// 注意：& 被刻意排除——url 带 query string 时会在运行时抛错（返回 500）而非注入。
// 这是有意取舍：tracks.json 里的 url 都是纯站点首页；未来若确需带参 url，应改用 argv 化启动而非放宽此正则。
const SAFE_URL = /^https?:\/\/[^\s"'`&|^<>()%]+$/i;
function openUrl(url) {
  const u = String(url ?? '');
  if (!SAFE_URL.test(u)) throw new Error(`refusing to open unsafe url: ${u.slice(0, 80)}`);
  const opts = { detached: true, stdio: 'ignore' };
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', u], opts).unref();
  else if (process.platform === 'darwin') spawn('open', [u], opts).unref();
  else spawn('xdg-open', [u], opts).unref();
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

// ---------- 实验赛道（Experimental Tracks） ----------
// 定义在 config/tracks.json。服务端只启动该文件登记过的 bin（白名单），不接受任意命令。
const TRACKS_FILE = path.join(CONFIG_DIR, 'tracks.json');
function loadTracks() {
  try { return JSON.parse(fs.readFileSync(TRACKS_FILE, 'utf8')); } catch { return { tracks: [] }; }
}
const WHICH = process.platform === 'win32' ? 'where' : 'which';
const _probeCache = new Map();

// 先在 PATH 目录里直接找文件，找不到才退回 where/which。
// 目标多起来之后（35+），每次 spawn 一个 where 会让首屏多等好几秒。
function resolveBinOnPath(bin) {
  if (!bin || /[\\/]/.test(bin)) return null;
  const exts = process.platform === 'win32'
    ? ['', ...String(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
    : [''];
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      const cand = path.join(dir, bin + ext);
      try { if (fs.statSync(cand).isFile()) return cand; } catch { /* keep looking */ }
    }
  }
  return null;
}

// 并行探测 + 进程内缓存：几十个目标串行 spawnSync 会让首屏等 9 秒，不可接受
async function probeBinAsync(bin) {
  if (!bin) return { installed: false, path: null };
  if (_probeCache.has(bin)) return _probeCache.get(bin);
  let out = { installed: false, path: null };
  const onPath = resolveBinOnPath(bin);
  if (onPath) {
    out = { installed: true, path: onPath };
  } else {
    try {
      const { stdout } = await execFileAsync(WHICH, [bin], { windowsHide: true, timeout: 4000 });
      const first = String(stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
      out = { installed: true, path: first || bin };
    } catch { /* not installed */ }
  }
  _probeCache.set(bin, out);
  return out;
}

// 路径展开只作用于来自 config/tracks.json 的字符串（请求体永远无法注入路径）。
function expandPath(input) {
  let s = String(input);
  s = s.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, k) => process.env[k] ?? process.env[k.toUpperCase()] ?? m);
  if (s === '~' || s.startsWith('~/') || s.startsWith('~\\')) {
    s = path.join(process.env.USERPROFILE || process.env.HOME || '', s.slice(1));
  }
  return s;
}

// exeGlob：支持单层目录通配（如 D:\Program Files\QClaw\*\QClaw.exe）。
// 版本号目录按字典序倒排取第一个命中的，通常即最新版。
function resolveExeGlob(pattern) {
  const abs = expandPath(pattern);
  const parts = abs.split(/[\\/]/);
  const starAt = parts.indexOf('*');
  if (starAt < 0) return fs.existsSync(abs) ? abs : null;
  const base = parts.slice(0, starAt).join(path.sep) || path.sep;
  const rest = parts.slice(starAt + 1);
  let names = [];
  try { names = fs.readdirSync(base); } catch { return null; }
  names.sort().reverse();
  for (const n of names) {
    const cand = path.join(base, n, ...rest);
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

// 四种形态：cli（终端启动）/ app（本机桌面客户端）/ msix（微软商店分发的打包应用）/ web（仅官网或插件）
async function probeTarget(t) {
  const kind = t.kind || (t.bin ? 'cli' : 'web');
  if (kind === 'cli') {
    const r = await probeBinAsync(t.bin);
    return { kind, installed: r.installed, path: r.path };
  }
  if (kind === 'app') {
    const exe = t.exeGlob ? resolveExeGlob(t.exeGlob) : (t.exe ? expandPath(t.exe) : null);
    return { kind, installed: !!(exe && fs.existsSync(exe)), path: exe || null };
  }
  if (kind === 'msix') {
    // 打包应用无法用 exe 路径判断，改看用户的 Packages 目录是否存在
    const pfn = t.pfn || String(t.appId || '').split('!')[0];
    const dir = pfn ? path.join(process.env.LOCALAPPDATA || '', 'Packages', pfn) : null;
    const ok = !!dir && fs.existsSync(dir);
    return { kind, installed: ok, path: ok ? dir : null };
  }
  return { kind: 'web', installed: false, path: null };
}

// bin 会被拼进 `cmd /c start '' cmd /k <bin>` —— 那是 cmd.exe 的命令行拼接面，不是 execve 语义。
// 配置可编辑，但「可编辑」不等于允许 shell 元字符流进命令行，所以这里限定安全字符集。
const SAFE_BIN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
function launchCli(bin) {
  if (!SAFE_BIN.test(String(bin ?? ''))) throw new Error(`unsafe bin name rejected: ${String(bin).slice(0, 40)}`);
  const opts = { detached: true, stdio: 'ignore', windowsHide: false };
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', 'cmd', '/k', bin], opts).unref();
    return;
  }
  if (process.platform === 'darwin') {
    spawn('osascript', ['-e', 'tell application "Terminal" to activate', '-e', `tell application "Terminal" to do script "${bin}"`], opts).unref();
    return;
  }
  spawn('x-terminal-emulator', ['-e', bin], opts).unref();
}

// 只启动 tracks.json 已登记、且探测确认存在的目标。exe 一律取自配置，不取请求参数。
// GM_LAUNCH_DRY_RUN=1 时不真正拉起进程，只返回将要执行的命令——用于自动化验证，避免弹窗。
function launchTarget(t, probe) {
  const opts = { detached: true, stdio: 'ignore', windowsHide: false };
  const dry = !!process.env.GM_LAUNCH_DRY_RUN;
  if (probe.kind === 'cli' && probe.installed) {
    if (!dry) launchCli(t.bin);
    return { mode: 'terminal', launched: t.bin, path: probe.path, cmd: `cmd /k ${t.bin}`, dryRun: dry };
  }
  if (probe.kind === 'app' && probe.installed && probe.path) {
    if (!dry) spawn(probe.path, [], { detached: true, stdio: 'ignore', cwd: path.dirname(probe.path) }).unref();
    return { mode: 'app', launched: path.basename(probe.path), path: probe.path, cmd: probe.path, dryRun: dry };
  }
  if (probe.kind === 'msix' && probe.installed && t.appId) {
    if (process.platform !== 'win32') throw new Error('msix is Windows-only');
    if (!dry) spawn('explorer.exe', [`shell:AppsFolder\\${t.appId}`], opts).unref();
    return { mode: 'msix', launched: t.appId, path: probe.path, cmd: `explorer shell:AppsFolder\\${t.appId}`, dryRun: dry };
  }
  throw new Error('not-installed');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // HIGH-1 修复：同源守卫 —— 拒绝跨站 Origin 与 DNS-Rebinding Host
  const host = String(req.headers.host ?? '');
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
    return json(res, 403, { error: 'invalid host header' });
  }
  const allowedOrigins = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    return json(res, 403, { error: 'cross-origin request rejected' });
  }
  // 只校验 Origin 挡不住「简单请求」：浏览器对跨站表单 POST / 无自定义头的 GET **不发 Origin**，
  // 这类请求会整条绕过上面的检查。Sec-Fetch-Site 是现代浏览器必发的，用它补上这个缺口。
  // 该头缺失 = 非浏览器客户端（curl / 本地脚本），按本地自身调用处理。
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
    return json(res, 403, { error: 'cross-site request rejected' });
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
    // ---------- 实验赛道 ----------
    if (p === '/api/tracks' && req.method === 'GET') {
      const cfg = loadTracks();
      const tracks = await Promise.all((cfg.tracks || []).map(async t => ({
        id: t.id, order: t.order, label: t.label, subtitle: t.subtitle, desc: t.desc, action: t.action,
        targets: t.action === 'launch-agents'
          ? await Promise.all((t.targets || []).map(async x => {
              const probe = await probeTarget(x);
              return { ...x, ...probe, launchable: probe.installed || !!x.url };
            }))
          : (t.targets || []),
      })));
      return json(res, 200, { tracks });
    }
    if (p === '/api/tracks/launch-agent' && req.method === 'POST') {
      // 只接受 JSON 正文：跨站表单提交（application/x-www-form-urlencoded / text/plain）属「简单请求」，
      // 不触发预检，因此拒绝它们等于给这个端点关掉一整类 CSRF 面。
      if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
        return json(res, 415, { error: 'content-type must be application/json' });
      }
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(String(body || '{}')); } catch { /* ignore */ }
      const cfg = loadTracks();
      const agentTrack = (cfg.tracks || []).find(t => t.id === 'agent');
      const target = (agentTrack?.targets || []).find(x => x.id === String(payload.id || ''));
      if (!target) return json(res, 400, { error: 'unknown agent id' });
      const probe = await probeTarget(target);
      try {
        if (probe.installed) {
          const r = launchTarget(target, probe);
          return json(res, 200, { installed: true, ...r });
        }
        if (target.url) {
          openUrl(target.url);
          return json(res, 200, { installed: false, launched: target.url, mode: 'url', reason: 'not-installed' });
        }
        return json(res, 409, { error: 'not-installed', bin: target.bin || null, exe: target.exe || null, install: target.install || null });
      } catch (e) {
        return json(res, 500, { error: String(e.message || e) });
      }
    }

    // ---------- 出题包导出（Real-World 赛道用） ----------
    if (p === '/api/export/items' && req.method === 'GET') {
      const ids = fs.existsSync(BENCH_ITEMS_DIR) ? fs.readdirSync(BENCH_ITEMS_DIR).filter(d => SAFE_ID.test(d) && fs.existsSync(path.join(BENCH_ITEMS_DIR, d, 'meta.json'))).sort() : [];
      const items = ids.map(id => {
        try {
          const it = readItem(id);
          const m = it.meta;
          return { id, title: m.title || id, difficulty: m.difficulty || null, questionType: m.questionType || null, hasFigure: it.figures.length > 0 };
        } catch { return null; }
      }).filter(Boolean);
      return json(res, 200, { items });
    }
    const expMd = /^\/api\/export\/item\/([^/]+)\/problem\.md$/.exec(p);
    if (expMd && req.method === 'GET') {
      const it = readItem(expMd[1]);
      if (!it) return json(res, 404, { error: 'item not found' });
      return raw(res, 200, 'text/markdown; charset=utf-8', Buffer.from(it.problem, 'utf8'), `${it.id}-problem.md`);
    }
    const expAsset = /^\/api\/export\/item\/([^/]+)\/asset\/(.+)$/.exec(p);
    if (expAsset && req.method === 'GET') {
      const it = readItem(expAsset[1]);
      if (!it) return json(res, 404, { error: 'item not found' });
      const hit = it.figures.find(f => path.basename(f.rel) === path.basename(decodeURIComponent(expAsset[2])));
      if (!hit) return json(res, 404, { error: 'asset not found' });
      const ext = path.extname(hit.abs).toLowerCase();
      const ct = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'application/octet-stream';
      return raw(res, 200, ct, fs.readFileSync(hit.abs));
    }
    const expZip = /^\/api\/export\/item\/([^/]+)\.zip$/.exec(p);
    if (expZip && req.method === 'GET') {
      const it = readItem(expZip[1]);
      if (!it) return json(res, 404, { error: 'item not found' });
      return raw(res, 200, 'application/zip', buildItemZip(it), `${it.id}.zip`);
    }

    if (p === '/api/benchmark/start' && req.method === 'POST') {
      let payload;
      try { payload = JSON.parse((await readBody(req)).toString('utf8')); } catch { return json(res, 400, { error: 'bad json' }); }
      const model = loadModels(path.join(CONFIG_DIR, 'models.json')).find((m) => m.id === payload.modelId);
      if (!model) return json(res, 400, { error: 'unknown model id' });
      const modes = Array.isArray(payload.modes) && payload.modes.length ? payload.modes : ['vision', 'coord', 'pure'];
      const runId = 'web-' + model.id.replace(/[^a-z0-9._-]/gi, '') + '-' + Date.now().toString(36);
      const outDir = path.join(REPO_ROOT, 'benchmark', 'results', runId);
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
      const id = url.searchParams.get('id');
      const outDir = benchDir(id);
      if (!outDir) return json(res, 404, { error: 'unknown run' });
      const rec = benchRuns.get(id);
      const summaryPath = path.join(outDir, 'summary.md');
      if (rec) {
        return json(res, 200, {
          stage: rec.stage, stageInfo: rec.stageInfo || '', exit: rec.exit,
          lines: rec.lines.slice(-40),
          summaryReady: rec.exit === 0 && fs.existsSync(summaryPath),
        });
      }
      // 磁盘兜底：服务重启后历史评测仍可查看
      const done = fs.existsSync(summaryPath);
      return json(res, 200, {
        stage: done ? 'done' : 'archived', exit: done ? 0 : null,
        lines: [], summaryReady: done,
      });
    }
    if (p === '/api/benchmark/detail' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      const item = url.searchParams.get('item');
      const mode = url.searchParams.get('mode');
      const outDir = benchDir(id);
      if (!outDir || !item || !/^[A-Za-z0-9_-]+$/.test(item) || !/^[a-z]+$/.test(mode)) return json(res, 404, { error: 'not found' });
      const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
      const answer = read(path.join(outDir, item + '__' + mode + '.answer.md'));
      const scoreF = read(path.join(outDir, 'scores', item + '__' + mode + '.score.json'));
      const promptMeta = read(path.join(outDir, item + '__' + mode + '.meta.json'));
      if (answer === null) return json(res, 404, { error: 'answer not found' });
      return json(res, 200, {
        item, mode, answer,
        score: scoreF ? JSON.parse(scoreF) : null,
        skipped: /skipped/.test(answer),
        promptMeta: promptMeta ? JSON.parse(promptMeta) : null,
      });
    }
    if (p === '/api/benchmark/raw' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      const outDir = benchDir(id);
      if (!outDir) return json(res, 404, { error: 'unknown run' });
      const f = path.join(outDir, 'summary.md');
      if (!fs.existsSync(f)) return json(res, 404, { error: 'summary not ready' });
      return json(res, 200, { markdown: fs.readFileSync(f, 'utf8') });
    }
    if (p === '/api/benchmark/summary' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      const outDir = benchDir(id);
      if (!outDir) return json(res, 404, { error: 'unknown run' });
      const f = path.join(outDir, 'summary.md');
      if (!fs.existsSync(f)) return json(res, 404, { error: 'summary not ready' });
      return json(res, 200, { markdown: fs.readFileSync(f, 'utf8'), outDir });
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
