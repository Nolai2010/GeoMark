/** Configuration: model registry (no secrets) + API key resolution (memory only). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '..');

// Env overrides exist ONLY for tests / sandboxed runs; defaults are in-project.
const CONFIG_DIR_OVERRIDE = process.env.HARNESS_CONFIG_DIR
  ? path.resolve(process.env.HARNESS_CONFIG_DIR)
  : null;
const DATA_DIR_OVERRIDE = process.env.HARNESS_DATA_DIR
  ? path.resolve(process.env.HARNESS_DATA_DIR)
  : null;
const DATA_DIR = DATA_DIR_OVERRIDE ?? PROJECT_ROOT;

export const CONFIG_DIR = CONFIG_DIR_OVERRIDE ?? path.join(PROJECT_ROOT, 'config');
export const EXPERIMENTS_DIR = path.join(DATA_DIR, 'experiments');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export const SUPPORTED_PROVIDERS = Object.freeze(['openai-compatible', 'anthropic']);

import { deepClean } from './schema.mjs';

/** Load config/models.json. User-declared; harness never probes providers. */
export function loadModels(configPath = null) {
  const p = configPath ?? path.join(CONFIG_DIR, 'models.json');
  if (!fs.existsSync(p)) return [];
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const models = (raw.models ?? []).map((item) => {
    if (!SUPPORTED_PROVIDERS.includes(item.provider)) {
      throw new Error(`model "${item.id}": unsupported provider "${item.provider}"`);
    }
    return {
      id: item.id,
      provider: item.provider,
      baseUrl: (item.base_url ?? '').replace(/\/+$/, ''),
      apiModelId: item.api_model_id,
      display_name: item.display_name ?? '',
      supports_reasoning: !!item.supports_reasoning,
      supports_vision: !!item.supports_vision,
      extra_body: item.extra_body ?? {},
      // custom endpoint / protocol-level overrides (Phase 2)
      endpoint_path: item.endpoint_path ?? null,
      custom_headers: item.custom_headers ?? null, // write-only: never sent back to the UI
      default_temperature: item.default_temperature ?? null,
      default_max_tokens: item.default_max_tokens ?? null,
    };
  });
  const ids = models.map((m) => m.id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate model ids in models.json');
  return models;
}

/** Load provider presets (config templates ONLY: protocol + URL + model id). */
export function loadPresets(configPath = null) {
  const p = configPath ?? path.join(CONFIG_DIR, 'presets.json');
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8')).presets ?? [];
}

const MODEL_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Persist a user-configured model into config/models.json (upsert by id). */
export function saveModel(input, configPath = null) {
  const p = configPath ?? path.join(CONFIG_DIR, 'models.json');
  const id = String(input.id ?? '').toLowerCase().trim();
  if (!MODEL_ID_RE.test(id)) {
    throw new Error('模型 ID 不合法：仅允许小写字母、数字与 . _ -，长度 1-64');
  }
  if (!SUPPORTED_PROVIDERS.includes(input.provider)) {
    throw new Error(`不支持的协议类型: ${input.provider}`);
  }
  const baseUrl = String(input.base_url ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+/i.test(baseUrl)) throw new Error('API 地址必须以 http(s):// 开头');
  const apiModelId = String(input.api_model_id ?? '').trim();
  if (!apiModelId) throw new Error('模型 ID 不能为空');

  const raw = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { models: [] };
  const entry = {
    id,
    provider: input.provider,
    base_url: baseUrl,
    api_model_id: apiModelId,
    display_name: String(input.display_name ?? '').trim() || id,
    supports_reasoning: !!input.supports_reasoning,
    supports_vision: !!input.supports_vision,
    extra_body: deepClean(input.extra_body ?? {}),
  };
  if (input.endpoint_path) entry.endpoint_path = String(input.endpoint_path).trim();
  if (input.custom_headers && typeof input.custom_headers === 'object' && Object.keys(input.custom_headers).length) {
    entry.custom_headers = deepClean(input.custom_headers);
  } else if (input.custom_headers === undefined) {
    // 编辑时未提供 custom_headers（UI 不可回显该字段）→ 原样保留旧值
    const old = (raw.models ?? []).find((m) => m.id === id);
    if (old?.custom_headers) entry.custom_headers = old.custom_headers;
  }
  if (input.default_temperature != null) entry.default_temperature = Number(input.default_temperature);
  if (input.default_max_tokens != null) entry.default_max_tokens = Number(input.default_max_tokens);

  const idx = raw.models.findIndex((m) => m.id === id);
  if (idx >= 0) raw.models[idx] = entry;
  else raw.models.push(entry);
  fs.writeFileSync(p, JSON.stringify(raw, null, 2), 'utf8');
  return entry;
}

/** Remove a user-configured model by harness id. */
export function deleteModel(id, configPath = null) {
  const p = configPath ?? path.join(CONFIG_DIR, 'models.json');
  if (!fs.existsSync(p)) return false;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const before = raw.models.length;
  raw.models = raw.models.filter((m) => m.id !== id);
  const changed = raw.models.length !== before;
  if (changed) fs.writeFileSync(p, JSON.stringify(raw, null, 2), 'utf8');
  return changed;
}

/** Resolve an API key: env var first, then config/secrets.json. Never logged. */
export function getApiKey(provider, modelId = null, configDir = CONFIG_DIR) {
  const envName =
    provider === 'openai-compatible'
      ? 'HARNESS_OPENAI_API_KEY'
      : provider === 'anthropic'
        ? 'HARNESS_ANTHROPIC_API_KEY'
        : null;
  if (envName && process.env[envName]) return process.env[envName];
  const secretsPath = path.join(configDir, 'secrets.json');
  if (fs.existsSync(secretsPath)) {
    const data = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    // precedence: model-scoped key > provider-scoped key (new shape) > legacy flat
    if (modelId && data.models?.[modelId]) return String(data.models[modelId]);
    if (data.providers?.[provider]) return String(data.providers[provider]);
    if (data[provider]) return String(data[provider]);
  }
  throw new Error(
    '未配置 API 密钥。请在界面右上角「API 密钥」设置，或在模型配置中为该模型单独填写；' +
    `也可通过环境变量 ${envName ?? 'HARNESS_*_API_KEY'} 配置。`
  );
}

/** Which providers have a key configured (booleans only; keys are never returned). */
export function keyStatus(configDir = CONFIG_DIR) {
  const secretsPath = path.join(configDir, 'secrets.json');
  let stored = {};
  if (fs.existsSync(secretsPath)) {
    try {
      stored = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    } catch {
      stored = {};
    }
  }
  const has = (p, envName) =>
    Boolean((envName && process.env[envName]) || stored[p] || stored.providers?.[p]);
  return {
    'openai-compatible': has('openai-compatible', 'HARNESS_OPENAI_API_KEY'),
    anthropic: has('anthropic', 'HARNESS_ANTHROPIC_API_KEY'),
    modelKeys: Object.keys(stored.models ?? {}).length,
  };
}

/** Persist a key from the UI into config/secrets.json (gitignored).
 *  Accepts {provider, key} for a provider-level key, or {modelId, key}
 *  for a key scoped to one custom model. Keys are never returned. */
export function saveApiKey(providerOrOpts, key, configDir = CONFIG_DIR) {
  let provider = null;
  let modelId = null;
  if (typeof providerOrOpts === 'string') {
    provider = providerOrOpts;
  } else {
    provider = providerOrOpts.provider ?? null;
    modelId = providerOrOpts.modelId ?? null;
    key = providerOrOpts.key;
  }
  if (/^(__proto__|constructor|prototype)$/.test(modelId ?? '')) {
    throw new Error('invalid model id');
  }
  if (modelId && !/^[\w.-]{1,64}$/.test(modelId)) {
    throw new Error('invalid model id');
  }
  if (!modelId && !SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`unsupported provider: ${provider}`);
  }
  if (typeof key !== 'string' || key.trim().length === 0 || key.length > 4096) {
    throw new Error('invalid key');
  }
  const secretsPath = path.join(configDir, 'secrets.json');
  let data = {};
  if (fs.existsSync(secretsPath)) {
    data = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  }
  if (modelId) {
    data.models = data.models ?? {};
    data.models[modelId] = key.trim();
  } else {
    data.providers = data.providers ?? {};
    data.providers[provider] = key.trim();
  }
  fs.writeFileSync(secretsPath, JSON.stringify(data, null, 2), 'utf8');
  return keyStatus(configDir);
}
