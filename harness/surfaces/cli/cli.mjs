/** CLI surface: the same kernel, terminal shell.
 *
 * Examples:
 *   node surfaces/cli/cli.mjs --list-models
 *   node surfaces/cli/cli.mjs --model example-openai-compat --experiment "你的问题"
 *   node surfaces/cli/cli.mjs --model example-anthropic --system "你是裁判" --file 题目.txt --experiment "解题"
 *   node surfaces/cli/cli.mjs --replay experiments/exp-xxx          # offline replay
 *   node surfaces/cli/cli.mjs --verify experiments/exp-xxx          # tamper check
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { loadModels, getApiKey, CONFIG_DIR, EXPERIMENTS_DIR, UPLOADS_DIR, PROJECT_ROOT } from '../../kernel/config.mjs';
import { FileRegistry } from '../../kernel/files.mjs';
import { ExperimentStore, buildRequestRecord } from '../../kernel/store.mjs';
import { runExperiment } from '../../kernel/pipeline.mjs';
import { unifiedRequestFromModel } from '../../kernel/unified.mjs';
import { HARNESS_VERSION, NODE_VERSION, gitCommit as GIT_COMMIT } from '../../kernel/version.mjs';
import { makeAdapter } from '../../adapters/index.mjs';
import { replayRawSSE } from '../../kernel/replay.mjs';
import { verifyBundle } from '../../kernel/verify.mjs';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';

function parseArgs(argv) {
  const args = { _: [] };
  const BOOLEAN_FLAGS = new Set(['experiment', 'reasoning', 'list-models']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    } else args._.push(a);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args['list-models']) {
  for (const m of loadModels()) {
    console.log(`${m.id.padEnd(28)} ${m.provider.padEnd(18)} ${m.apiModelId}  ${m.baseUrl}`);
  }
  process.exit(0);
}

if (args.replay) {
  const dir = path.resolve(args.replay);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  const raw = fs.readFileSync(path.join(dir, 'raw', 'response.sse'), 'utf8');
  const events = replayRawSSE(config.provider, raw);
  for (const ev of events) {
    if (ev.type === 'message_delta') process.stdout.write(ev.data.text);
    else if (ev.type === 'reasoning_delta') process.stdout.write(DIM + ev.data.text + RESET);
  }
  console.log(`\n${DIM}[replay] ${events.length} events, identical rule engine as live${RESET}`);
  process.exit(0);
}

if (args.verify) {
  const res = verifyBundle(path.resolve(args.verify));
  for (const c of res.checks) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  console.log(res.ok ? 'bundle intact.' : 'BUNDLE TAMPERED OR CORRUPT.');
  process.exit(res.ok ? 0 : 1);
}

const models = loadModels();
if (models.length === 0) {
  console.error('config/models.json not found. Copy config/models.example.json first.');
  process.exit(1);
}
const model = models.find((m) => m.id === args.model) ?? models[0];
const registry = new FileRegistry({ uploadsDir: UPLOADS_DIR });
const store = new ExperimentStore(EXPERIMENTS_DIR);

for (const f of [].concat(args.file ?? [])) {
  registry.registerPath(path.resolve(f));
}

let apiKey;
try {
  apiKey = getApiKey(model.provider);
} catch (e) {
  console.error(String(e.message));
  process.exit(1);
}
const rawChunks = [];
const adapter = makeAdapter(model.provider, apiKey, { onRaw: (c) => rawChunks.push(c) });

const baseOpts = {
  systemPrompt: typeof args.system === 'string' ? args.system : '',
  temperature: args.temperature != null ? Number(args.temperature) : null,
  maxTokens: args['max-tokens'] != null ? Number(args['max-tokens']) : null,
  timeoutMs: args['timeout-ms'] != null ? Number(args['timeout-ms']) : null,
  maxRetries: args.retries != null ? Number(args.retries) : 0,
  reasoning: {
    enabled: !!(args.reasoning || args.effort || args.budget),
    effort: typeof args.effort === 'string' ? args.effort : null,
    budgetTokens: args.budget != null ? Number(args.budget) : null,
  },
};

async function send(text) {
  // P0-2: same shared builder as the Web surface — no field-name drift
  const payload = {
    ...baseOpts,
    messages: [{ role: 'user', content: text, fileIds: registry.list().map((f) => f.fileId) }],
  };
  const request = unifiedRequestFromModel(model, payload, registry.list());

  const experimentMode = !!args.experiment;
  const expDir = experimentMode ? store.start(request) : null;
  rawChunks.length = 0;

  const { result, events, chainRoot } = await runExperiment({
    request,
    adapter,
    fileRegistry: registry,
    onEvent: (ev) => {
      if (ev.type === 'reasoning_delta') process.stdout.write(DIM + ev.data.text + RESET);
      else if (ev.type === 'message_delta') process.stdout.write(ev.data.text);
      else if (ev.type === 'error') process.stdout.write(`\n[error] ${ev.data.message}\n`);
    },
  });

  if (expDir) {
    store.writePrompt(expDir, text);
    store.writeEvents(expDir, events);
    store.writeRaw(expDir, rawChunks);
    // P1-1: record what the adapter ACTUALLY sent (sanitized) + resolved config
    store.writeRequest(expDir, buildRequestRecord(adapter, request));
    const id = store.finish(expDir, result, chainRoot, {
      harnessVersion: HARNESS_VERSION,
      runtime: { node: NODE_VERSION },
      adapter: {
        provider: adapter.provider,
        version: adapter.specVersion,
        sha256: adapter.specSha256,
      },
      gitCommit: GIT_COMMIT,
    });
    console.log(`\n${CYAN}[experiment] ${id}  (${result.totalMs?.toFixed(0)}ms, completion=${result.completion}, in=${result.usage.inputTokens} out=${result.usage.outputTokens})${RESET}`);
  } else {
    console.log(`\n${DIM}[chat] ${result.totalMs?.toFixed(0)}ms completion=${result.completion}${RESET}`);
  }
}

if (args._.length > 0) {
  await send(args._.join(' '));
  process.exit(0);
}

// interactive loop
console.log(`${CYAN}GeoMark-Harness CLI${RESET} — model: ${model.id} (${model.provider})`);
if (registry.list().length) console.log('files:', registry.list().map((f) => f.name).join(', '));
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
rl.prompt();
rl.on('line', async (line) => {
  const text = line.trim();
  if (!text) return rl.prompt();
  if (text === '/exit' || text === '/quit') return rl.close();
  if (text === '/files') {
    console.log(registry.list().map((f) => `${f.fileId.slice(0, 8)} ${f.name} (${f.size}B)`).join('\n') || '(none)');
    return rl.prompt();
  }
  try {
    await send(text);
  } catch (e) {
    console.error(String(e));
  }
  rl.prompt();
});
rl.on('close', () => process.exit(0));
