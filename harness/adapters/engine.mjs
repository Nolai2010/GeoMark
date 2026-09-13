/** Generic declarative adapter engine.
 *
 * All provider knowledge lives in specs/*.json. This file contains NO
 * provider-specific branches: it interprets whatever spec it is given.
 * Neutrality audit = read the JSON spec, not the code.
 *
 * Completion semantics (P0-3): a run is 'completed' ONLY when the provider
 * sent an explicit end signal (done marker, finish_reason, or a spec rule
 * with markComplete). Anything else is truncated / network_error / timeout
 * / aborted / provider_error, and the pipeline never fabricates a success.
 */

// ---------------------------------------------------------------------------
// path helpers (dot paths, numeric segments for arrays)
// ---------------------------------------------------------------------------

import { deepClean } from '../kernel/schema.mjs';

export function resolvePath(obj, dotPath) {
  let cur = obj;
  for (const part of dotPath.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

export function pathExists(obj, dotPath) {
  let cur = obj;
  for (const part of dotPath.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(cur, part)) return false;
    cur = cur[part];
  }
  return true;
}

// ---------------------------------------------------------------------------
// rule evaluation -> unified events (no fabrication: rules only)
// ---------------------------------------------------------------------------

export function createStreamState() {
  return {
    messageStarted: false,
    reasoningStarted: false,
    done: false,       // done marker seen
    completed: false,  // provider end signal seen (markComplete rule)
    finishReason: null,
    usage: { inputTokens: null, outputTokens: null, raw: null },
  };
}

function ruleMatches(rule, view) {
  for (const w of rule.when ?? []) {
    if ('present' in w) {
      if (pathExists(view, w.path) !== !!w.present) return false;
    }
    if ('equals' in w && resolvePath(view, w.path) !== w.equals) return false;
    if ('notEquals' in w && resolvePath(view, w.path) === w.notEquals) return false;
  }
  return true;
}

/**
 * Apply one provider chunk against the spec.
 * view: { sseEvent, data }. Returns [] or a list of unified events.
 */
export function applyChunk(spec, { event, data }, state) {
  const out = [];
  const doneMarker = spec.stream?.doneMarker ?? null;
  if (doneMarker !== null && typeof data === 'string' && data.trim() === doneMarker) {
    state.done = true;
    return out;
  }
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return out; // non-JSON chunk (keep-alive / ping) -> ignore, never invent
    }
  }
  if (parsed === null || typeof parsed !== 'object') return out;
  const view = { sseEvent: event ?? null, data: parsed };

  for (const rule of spec.events ?? []) {
    if (!ruleMatches(rule, view)) continue;
    if (rule.markComplete === true) state.completed = true;
    if (rule.text) {
      const t = resolvePath(view, rule.text);
      if (typeof t === 'string' && t.length > 0) {
        if (!state.messageStarted) {
          state.messageStarted = true;
          out.push({ type: 'message_start', data: {} });
        }
        out.push({ type: 'message_delta', data: { text: t } });
      }
    }
    if (rule.reasoningText) {
      const t = resolvePath(view, rule.reasoningText);
      if (typeof t === 'string' && t.length > 0) {
        if (!state.reasoningStarted) {
          state.reasoningStarted = true;
          out.push({ type: 'reasoning_start', data: {} });
        }
        out.push({ type: 'reasoning_delta', data: { text: t } });
      }
    }
    if (rule.finishReason) {
      const v = resolvePath(view, rule.finishReason);
      if (v !== undefined && v !== null) state.finishReason = v;
    }
    if (rule.usage) {
      const i = rule.usage.inputPath ? resolvePath(view, rule.usage.inputPath) : null;
      const o = rule.usage.outputPath ? resolvePath(view, rule.usage.outputPath) : null;
      if (typeof i === 'number') state.usage.inputTokens = i;
      if (typeof o === 'number') state.usage.outputTokens = o;
      if (rule.usage.raw) {
        const r = resolvePath(view, rule.usage.raw);
        if (r !== undefined) state.usage.raw = r;
      }
    }
    if (rule.error) {
      const m = resolvePath(view, rule.error.message) ?? rule.error.fallback ?? 'provider error';
      out.push({ type: 'error', data: { message: String(m), recoverable: false, completion: 'provider_error' } });
      return out;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// SSE parsing
// ---------------------------------------------------------------------------

function parseEventBlock(block) {
  let event = null;
  const dataLines = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

/** Parse a byte stream (web ReadableStream of Uint8Array) into SSE chunks. */
export async function* parseSSE(body, onRaw = null) {
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of body) {
    onRaw?.(chunk);
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const parsed = parseEventBlock(block);
      if (parsed) yield parsed;
    }
  }
}

/** Parse a full SSE text (offline replay) into chunks, in order. */
export function parseSSEText(text) {
  const out = [];
  for (const block of text.split('\n\n')) {
    const parsed = parseEventBlock(block);
    if (parsed) out.push(parsed);
  }
  return out;
}

// ---------------------------------------------------------------------------
// request building from spec template
// ---------------------------------------------------------------------------

function resolveTemplate(node, view) {
  if (typeof node === 'string' && node.startsWith('$.')) {
    return resolvePath(view, node.slice(2));
  }
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    if ('$if' in node) {
      const cond = resolveTemplate(node.$if, view);
      return cond ? resolveTemplate(node.$then ?? null, view) : resolveTemplate(node.$else ?? null, view);
    }
    if ('$from' in node) {
      let v = resolveTemplate(node.$from, view);
      if (v === undefined || v === null) v = node.$default ?? null;
      return v;
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveTemplate(v, view)]));
  }
  if (Array.isArray(node)) return node.map((n) => resolveTemplate(n, view));
  return node;
}

export function buildView(spec, request, renderedMessages) {
  const nonSystem = renderedMessages.filter((m) => m.role !== 'system');
  const reasoning = request.reasoning ?? {};
  return {
    apiModelId: request.apiModelId,
    system: request.systemPrompt || null,
    messages: spec.messagesStyle === 'openai' ? renderedMessages : nonSystem,
    temperature: request.temperature,
    topP: request.topP,
    maxTokens: request.maxTokens,
    reasoning: {
      enabled: !!reasoning.enabled,
      // effort is only meaningful when reasoning is enabled
      effort: reasoning.enabled ? reasoning.effort ?? null : null,
      budgetTokens: reasoning.budgetTokens ?? null,
      hasBudget: !!reasoning.enabled && reasoning.budgetTokens != null,
    },
    extraBody: request.extraBody ?? {},
  };
}

/** Build {url, headers, body}. The API key goes into headers ONLY. */
export function buildHttpRequest(spec, request, renderedMessages, apiKey) {
  const view = buildView(spec, request, renderedMessages);
  const body = resolveTemplate(spec.request.template, view);
  for (const [k, v] of Object.entries(spec.request.optional ?? {})) {
    const val = resolveTemplate(v, view);
    if (val !== undefined && val !== null) body[k] = val;
  }
  const extra = deepClean(request.extraBody ?? {});
  if (typeof extra === 'object' && Object.keys(extra).length > 0) {
    Object.assign(body, extra);
  }
  for (const k of Object.keys(body)) {
    if (body[k] === null) delete body[k]; // documented rule: drop top-level nulls
  }
  const headers = { ...(spec.fixedHeaders ?? {}) };
  if (spec.auth?.type === 'bearer') headers.authorization = `Bearer ${apiKey}`;
  else if (spec.auth?.type === 'header') headers[spec.auth.name] = apiKey;
  else throw new Error(`unsupported auth type: ${spec.auth?.type}`);
  // custom endpoint config: user-declared overrides win; recorded in request.json
  Object.assign(headers, deepClean(request.customHeaders ?? {}));
  const endpointPath = request.endpointPath ?? spec.endpoint.path;
  const url = request.baseUrl.replace(/\/+$/, '') + endpointPath;
  return { url, headers, body };
}

/** Everything the wire body says about the effective configuration
 *  (P1-2: requested vs resolved). Fully generic: derived from the body. */
export function extractResolvedConfig(body) {
  const resolved = structuredClone(body);
  delete resolved.messages;
  delete resolved.system;
  return resolved;
}

// ---------------------------------------------------------------------------
// streaming adapter (transport + rules + completion semantics)
// ---------------------------------------------------------------------------

export async function* streamUnified({
  spec,
  url,
  headers,
  body,
  signal,
  fetchImpl,
  onRaw,
  timeoutMs = null,
}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  let timedOut = false;
  let timer = null;
  let effSignal = signal;
  if (timeoutMs) {
    const internal = new AbortController();
    timer = setTimeout(() => {
      timedOut = true;
      internal.abort();
    }, timeoutMs);
    effSignal = signal ? AbortSignal.any([signal, internal.signal]) : internal.signal;
  }

  const state = createStreamState();
  const end = (completion, finishReason = null) => ({
    type: 'message_end',
    data: { usage: { ...state.usage }, finishReason, completion },
  });

  try {
    const res = await doFetch(url, {
      method: spec.endpoint.method ?? 'POST',
      headers,
      body: JSON.stringify(body),
      signal: effSignal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      yield {
        type: 'error',
        data: {
          message: `HTTP ${res.status}: ${text.slice(0, 2000)}`,
          recoverable: false,
          completion: 'provider_error',
        },
      };
      yield end('provider_error');
      return;
    }
    for await (const chunk of parseSSE(res.body, onRaw)) {
      for (const ev of applyChunk(spec, chunk, state)) {
        yield ev;
        if (ev.type === 'error') {
          yield end(ev.data.completion ?? 'provider_error');
          return;
        }
      }
      if (state.done) break;
    }
    const completed = state.completed || state.done || state.finishReason !== null;
    yield end(completed ? 'completed' : 'truncated', state.finishReason);
  } catch (err) {
    let completion = 'network_error';
    if (timedOut) completion = 'timeout';
    else if (signal?.aborted) completion = 'aborted';
    yield {
      type: 'error',
      data: { message: String(err?.message ?? err), recoverable: false, completion },
    };
    yield end(completion);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
