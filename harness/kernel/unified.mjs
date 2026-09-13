/** One shared request builder for EVERY surface (Web, CLI, future ones).
 *
 * P0-2: the model entry is the canonical snake_case shape produced by
 * loadModels() (config.mjs). Surfaces must never re-map field names;
 * this module is the only place where a model entry + payload becomes a
 * unified request, so two surfaces cannot diverge.
 *
 * Phase 2: also maps custom endpoint config (endpoint_path, custom_headers)
 * and model-level defaults for temperature / max tokens.
 */

import { makeRequest } from './schema.mjs';

export function unifiedRequestFromModel(model, payload = {}, files = []) {
  const temperature =
    payload.temperature ?? model.default_temperature ?? null;
  const maxTokens = payload.maxTokens ?? model.default_max_tokens ?? null;
  const temperatureSource =
    payload.temperature != null
      ? 'request'
      : model.default_temperature != null
        ? 'model-default'
        : 'unset';
  return makeRequest({
    modelId: model.id,
    provider: model.provider,
    baseUrl: model.baseUrl,
    apiModelId: model.apiModelId ?? model.api_model_id, // loadModels 产出驼峰；snake 兼容手工构造的 model 对象
    systemPrompt: payload.systemPrompt ?? '',
    messages: payload.messages ?? [],
    temperature,
    topP: payload.topP ?? null,
    maxTokens,
    timeoutMs: payload.timeoutMs ?? null,
    maxRetries: payload.maxRetries ?? 0,
    reasoning: payload.reasoning ?? {},
    endpointPath: model.endpoint_path ?? null,
    customHeaders: model.custom_headers ?? null,
    modelDefaults: {
      temperature: model.default_temperature ?? null,
      maxTokens: model.default_max_tokens ?? null,
    },
    temperatureSource,
    extraBody: model.extra_body ?? {},
    files,
  });
}
