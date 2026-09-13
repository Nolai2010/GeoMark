/** Adapter registry: provider -> declarative spec + generic engine. */

import fs from 'node:fs';
import { buildHttpRequest, extractResolvedConfig, streamUnified } from './engine.mjs';
import { sha256Hex } from '../kernel/audit.mjs';

const SPEC_FILES = {
  'openai-compatible': 'openai-compatible.json',
  anthropic: 'anthropic.json',
};

export function supportedProviders() {
  return Object.keys(SPEC_FILES);
}

export function loadSpec(provider) {
  return loadSpecInfo(provider).spec;
}

/** Spec + its audit identity (version + content hash) for experiment records. */
export function loadSpecInfo(provider) {
  const file = SPEC_FILES[provider];
  if (!file) throw new Error(`no adapter spec for provider: ${provider}`);
  const raw = fs.readFileSync(new URL(`./specs/${file}`, import.meta.url), 'utf8');
  const spec = JSON.parse(raw);
  return { spec, specSha256: sha256Hex(raw), specVersion: spec.specVersion ?? 0 };
}

/** Headers safe to write into request.json. Sensitive names are redacted. */
const SENSITIVE_HEADER = /^(authorization|x-api-key|cookie|set-cookie|proxy-authorization)$/i;
const SUSPICIOUS_HEADER = /(api[-_]?key|token|secret|credential|password)/i;
export function sanitizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    out[k] = SENSITIVE_HEADER.test(k) || SUSPICIOUS_HEADER.test(k) ? '[REDACTED]' : v;
  }
  return out;
}

/** An adapter is: spec + transport options. No other behavior exists. */
export function makeAdapter(provider, apiKey, opts = {}) {
  const { spec, specSha256, specVersion } = loadSpecInfo(provider);
  return {
    provider,
    spec,
    specSha256,
    specVersion,
    lastRequest: null, // sanitized record of the HTTP request actually sent
    async *stream({ request, renderedMessages, signal }) {
      const { url, headers, body } = buildHttpRequest(spec, request, renderedMessages, apiKey);
      this.lastRequest = {
        url,
        method: spec.endpoint.method ?? 'POST',
        headers: sanitizeHeaders(headers),
        body: structuredClone(body),
        resolvedConfig: extractResolvedConfig(body),
      };
      yield* streamUnified({
        spec,
        url,
        headers,
        body,
        signal,
        fetchImpl: opts.fetchImpl,
        onRaw: opts.onRaw,
        timeoutMs: request.timeoutMs ?? null,
      });
    },
  };
}
