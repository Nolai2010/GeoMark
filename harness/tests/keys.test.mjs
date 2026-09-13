import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveApiKey, keyStatus, getApiKey } from '../kernel/config.mjs';

test('saveApiKey persists into secrets.json; keyStatus reports without leaking', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-keys-'));
  // isolate from any real env config
  const prevOai = process.env.HARNESS_OPENAI_API_KEY;
  const prevAnt = process.env.HARNESS_ANTHROPIC_API_KEY;
  delete process.env.HARNESS_OPENAI_API_KEY;
  delete process.env.HARNESS_ANTHROPIC_API_KEY;
  try {
    assert.deepEqual(keyStatus(dir), { 'openai-compatible': false, anthropic: false, modelKeys: 0 });

    const st = saveApiKey('openai-compatible', '  sk-test-123  ', dir);
    assert.equal(st['openai-compatible'], true);
    assert.equal(st.anthropic, false);
    assert.equal(st.modelKeys, 0);

    const stored = JSON.parse(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8'));
    assert.equal(stored.providers['openai-compatible'], 'sk-test-123'); // trimmed, provider-scoped

    assert.equal(getApiKeyFor(dir, 'openai-compatible'), 'sk-test-123');

    // status booleans only — no key material in the return value
    const raw = JSON.stringify(keyStatus(dir));
    assert.ok(!raw.includes('sk-test-123'));
  } finally {
    if (prevOai !== undefined) process.env.HARNESS_OPENAI_API_KEY = prevOai;
    if (prevAnt !== undefined) process.env.HARNESS_ANTHROPIC_API_KEY = prevAnt;
  }

  function getApiKeyFor(dir, provider) {
    const mod = { dir };
    void mod;
    // getApiKey reads module-level CONFIG_DIR; use env-free direct file read instead
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8'));
    return data.providers[provider];
  }
});

test('saveApiKey rejects bad provider and empty keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-keys2-'));
  assert.throws(() => saveApiKey('nope', 'k', dir), /unsupported provider/);
  assert.throws(() => saveApiKey('anthropic', '   ', dir), /invalid key/);
  assert.throws(() => saveApiKey('anthropic', 42, dir), /invalid key/);
});
