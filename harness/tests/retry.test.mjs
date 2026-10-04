/** 瞬时错误重试：判定 + 退避行为（多模型大规模跑批的可靠性基础）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTransientError, withRetry } from '../../benchmark/tools/lib/retry.mjs';

test('isTransientError：429/5xx/网络错误命中；4xx 语义错误不命中', () => {
  for (const m of ['HTTP 429', 'HTTP 500', 'HTTP 502', 'HTTP 503', 'HTTP 504', 'fetch failed', 'ECONNRESET', 'ETIMEDOUT', 'socket hang up']) {
    assert.equal(isTransientError(new Error(m)), true, m);
  }
  for (const m of ['HTTP 400', 'HTTP 401', 'HTTP 403', 'HTTP 404', 'Unexpected token < in JSON']) {
    assert.equal(isTransientError(new Error(m)), false, m);
  }
});

test('withRetry：瞬时失败后重试成功，返回值正确', async () => {
  let calls = 0;
  const r = await withRetry('t', async () => {
    calls++;
    if (calls < 3) throw new Error('HTTP 429');
    return 'ok';
  }, { baseMs: 1, jitter: 0 });
  assert.equal(r, 'ok');
  assert.equal(calls, 3);
});

test('withRetry：瞬时错误耗尽次数后抛出最后一次错误', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry('t', async () => { calls++; throw new Error('HTTP 503'); }, { attempts: 2, baseMs: 1, jitter: 0 }),
    /HTTP 503/,
  );
  assert.equal(calls, 2);
});

test('withRetry：非瞬时错误立即抛出，不重试', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry('t', async () => { calls++; throw new Error('HTTP 401'); }, { attempts: 3, baseMs: 1 }),
    /HTTP 401/,
  );
  assert.equal(calls, 1);
});
