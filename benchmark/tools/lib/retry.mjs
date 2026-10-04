// 瞬时错误重试 —— run-eval / score 共用
// 目标：多模型大规模跑批时，429/5xx/网络抖动不再直接变成 error.txt，
// 而是指数退避重试（默认 3 次尝试），仍失败才落盘为可 --resume 补跑的错误记录。

/** 判定是否为值得重试的瞬时错误：HTTP 429/5xx、fetch 网络层错误、常见 socket 错误码 */
export function isTransientError(e) {
  const s = String(e?.message || e);
  return (
    /HTTP 429\b/.test(s) ||
    /HTTP 5\d\d\b/.test(s) ||
    /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|terminated/i.test(s)
  );
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * withRetry(label, fn, opts) —— 指数退避执行 async fn。
 * opts.attempts 总尝试次数（默认 3）；opts.baseMs 首次退避毫秒（默认 2000）；opts.jitter 抖动比例（默认 0.3）
 * 非瞬时错误立即抛出；瞬时错误重试耗尽后抛出最后一次错误。
 */
export async function withRetry(label, fn, opts = {}) {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseMs = Math.max(0, opts.baseMs ?? 2000);
  const jitter = Math.min(1, Math.max(0, opts.jitter ?? 0.3));
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (i === attempts || !isTransientError(e)) throw e;
      const wait = Math.round(baseMs * 2 ** (i - 1) * (1 + jitter * (Math.random() * 2 - 1)));
      console.log(`  [retry] ${label} 第 ${i} 次失败（${String(e.message || e).slice(0, 80)}），${wait}ms 后重试`);
      await sleep(wait);
    }
  }
  throw lastErr;
}
