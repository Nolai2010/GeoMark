/** Model connection test (Phase 2).
 *
 * Verifies Base URL / API key / model ID / protocol reachability.
 * NEVER includes the API key in any returned message; failures report
 * HTTP status or a generic network error only.
 */

const TIMEOUT_MS = 8000;

function classify(status) {
  if (status === 401) return '连接失败：API 密钥无效或未授权（HTTP 401）';
  if (status === 403) return '连接失败：该密钥无权访问此资源（HTTP 403）';
  if (status === 404) return '连接失败：接口地址不存在，请检查 API 地址与接口路径（HTTP 404）';
  if (status === 429) return '连接失败：请求过于频繁（HTTP 429）';
  return `连接失败：HTTP ${status}`;
}

export async function testConnection({
  provider,
  baseUrl,
  apiModelId,
  apiKey,
  endpointPath = null,
  customHeaders = null,
  fetchImpl = globalThis.fetch,
}) {
  const base = String(baseUrl ?? '').replace(/\/+$/, '');
  // MEDIUM-3 修复：仅允许 http(s)，拦截云元数据/链路本地地址；禁止重定向跟随
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    return { ok: false, status: 0, message: '连接失败：API 地址格式无效' };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { ok: false, status: 0, message: '连接失败：仅允许 http(s) 协议' };
  }
  if (parsed.hostname === '169.254.169.254' || parsed.hostname.endsWith('.169.254.169.254')) {
    return { ok: false, status: 0, message: '连接失败：该目标地址不允许测试' };
  }
  if (!/^https?:\/\/.+/i.test(base)) {
    return { ok: false, status: 0, message: '连接失败：API 地址必须以 http(s):// 开头' };
  }
  if (!apiKey) {
    return { ok: false, status: 0, message: '连接失败：尚未配置 API 密钥' };
  }
  if (!String(apiModelId ?? '').trim()) {
    return { ok: false, status: 0, message: '连接失败：请先填写模型 ID' };
  }
  const headers = {
    ...(provider === 'anthropic'
      ? { 'anthropic-version': '2023-06-01', 'x-api-key': apiKey }
      : { authorization: `Bearer ${apiKey}` }),
    ...(customHeaders ?? {}),
  };
  try {
    let res;
    if (provider === 'anthropic') {
      // Anthropic has no key-verifying GET; a minimal 1-token call is used.
      res = await fetchImpl(base + (endpointPath ?? '/v1/messages'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({
          model: apiModelId,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'error',
      });
    } else {
      // OpenAI-compatible: try GET /models first (costs no tokens)
      res = await fetchImpl(base + '/models', {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'error',
      });
      if (res.status === 404) {
        // some compatible services do not implement /models; fall back to
        // a minimal completion call
        res = await fetchImpl(base + (endpointPath ?? '/chat/completions'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({
            model: apiModelId,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'error',
        });
      }
    }
    if (res.ok) return { ok: true, status: res.status, message: '连接成功' };
    return { ok: false, status: res.status, message: classify(res.status) };
  } catch {
    return { ok: false, status: 0, message: '网络错误：无法连接到 API 地址（超时或不可达）' };
  }
}
