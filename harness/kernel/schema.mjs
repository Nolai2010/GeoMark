/** Unified schema: the single vocabulary of the harness. */

import { randomUUID } from 'node:crypto';

export const EventTypes = Object.freeze({
  MESSAGE_START: 'message_start',
  MESSAGE_DELTA: 'message_delta',
  REASONING_START: 'reasoning_start',
  REASONING_DELTA: 'reasoning_delta',
  FILE_READ_START: 'file_read_start',
  FILE_READ_END: 'file_read_end',
  MESSAGE_END: 'message_end',
  ERROR: 'error',
  // harness-side run lifecycle events (never fabricated by adapters)
  REQUEST_START: 'request_start',
  RETRY_START: 'retry_start',
  RETRY_END: 'retry_end',
  // harness-side: experiment bundle was persisted
  EXPERIMENT_SAVED: 'experiment_saved',
});

/** Stream completion states. Only 'completed' counts as a real finish. */
export const CompletionStates = Object.freeze([
  'completed',       // provider sent its explicit end signal
  'provider_error',  // provider returned an HTTP error or error payload
  'network_error',   // connection failed / broke mid-stream
  'timeout',         // harness-side timeout fired
  'aborted',         // user cancelled
  'truncated',       // stream ended cleanly WITHOUT the provider end signal
  'harness_error',   // failed before/at assembly (e.g. file read)
]);

export const RETRYABLE_COMPLETIONS = Object.freeze(['network_error', 'timeout']);

/** Build a fully-defaulted unified request. Never contains API keys. */
export function makeRequest(partial) {
  return {
    modelId: partial.modelId ?? '',
    provider: partial.provider ?? '',
    baseUrl: (partial.baseUrl ?? '').replace(/\/+$/, ''),
    apiModelId: partial.apiModelId ?? '',
    systemPrompt: partial.systemPrompt ?? '',
    messages: (partial.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      fileIds: m.fileIds ?? [],
    })),
    files: partial.files ?? [], // FileMeta[] (see kernel/files.mjs)
    temperature: partial.temperature ?? null,
    topP: partial.topP ?? null,
    maxTokens: partial.maxTokens ?? null,
    reasoning: {
      enabled: false,
      effort: null,
      budgetTokens: null,
      ...(partial.reasoning ?? {}),
    },
    // harness-side run controls (never sent to the provider as prompt context)
    timeoutMs: partial.timeoutMs ?? null,
    maxRetries: partial.maxRetries ?? 0,
    // custom endpoint / protocol-level overrides (user-declared, recorded)
    endpointPath: partial.endpointPath ?? null,
    customHeaders: partial.customHeaders ?? null,
    modelDefaults: partial.modelDefaults ?? null,
    temperatureSource: partial.temperatureSource ?? 'unset',
    // user-configured, user-visible passthrough; logged verbatim
    extraBody: partial.extraBody ?? {},
    requestId: partial.requestId ?? randomUUID().replaceAll('-', ''),
    createdAt: partial.createdAt ?? Date.now(),
  };
}

/** Validate a unified event. Throws on unknown types / malformed data. */
export function validateEvent(ev) {
  if (!ev || typeof ev !== 'object') throw new Error('event must be an object');
  if (!Object.values(EventTypes).includes(ev.type)) {
    throw new Error(`unknown event type: ${ev.type}`);
  }
  const needsText = ev.type === EventTypes.MESSAGE_DELTA || ev.type === EventTypes.REASONING_DELTA;
  if (needsText && typeof ev.data?.text !== 'string') {
    throw new Error(`${ev.type} requires string data.text`);
  }
  if (ev.type === EventTypes.ERROR && typeof ev.data?.message !== 'string') {
    throw new Error('error event requires string data.message');
  }
  return ev;
}

export function makeRunResult(requestId) {
  return {
    requestId,
    status: 'ok', // 'ok' ONLY when completion === 'completed'
    completion: null, // one of CompletionStates, set by the stream outcome
    attempts: 0,
    retries: 0,
    text: '',
    reasoningText: '',
    finishReason: null,
    usage: { inputTokens: null, outputTokens: null, raw: null },
    ttftMs: null,
    totalMs: null,
    error: '',
    startedAt: 0,
    finishedAt: 0,
    renderedMessages: [],
  };
}

/** Strip prototype-pollution keys (__proto__/constructor/prototype) recursively.
 *  用于 extra_body / custom_headers 等用户可控对象的合并前清洗（LOW-4）。 */
const UNSAFE_KEY = /^(__proto__|constructor|prototype)$/;
export function deepClean(value) {
  if (Array.isArray(value)) return value.map(deepClean);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (UNSAFE_KEY.test(k)) continue;
      out[k] = deepClean(v);
    }
    return out;
  }
  return value;
}
