import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderMessages, deepFreeze, fileBlock } from '../kernel/assembly.mjs';
import { FileRegistry } from '../kernel/files.mjs';
import { makeRequest } from '../kernel/schema.mjs';

test('renderMessages: system first, roles validated', () => {
  const req = makeRequest({
    systemPrompt: 'SYS',
    messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }],
  });
  assert.deepEqual(renderMessages(req), [
    { role: 'system', content: 'SYS' },
    { role: 'user', content: 'q' },
    { role: 'assistant', content: 'a' },
  ]);
  assert.throws(() => renderMessages(makeRequest({ messages: [{ role: 'tool', content: 'x' }] })));
});

test('empty system prompt omitted', () => {
  const out = renderMessages(makeRequest({ systemPrompt: '', messages: [{ role: 'user', content: 'q' }] }));
  assert.equal(out.length, 1);
});

test('file block is deterministic and content-complete', () => {
  const meta = { name: '题.txt', sha256: 'deadbeef' };
  const a = fileBlock(meta, '正文A');
  const b = fileBlock(meta, '正文A');
  assert.equal(a, b);
  assert.ok(a.includes('<attached-file name="题.txt" sha256="deadbeef">'));
  assert.ok(a.includes('正文A'));
});

test('deepFreeze blocks nested mutation (strict mode throws)', () => {
  const obj = deepFreeze({ a: { b: [1] } });
  assert.throws(() => { obj.a.b[0] = 2; });
});

// ---------------------------------------------------------------------------
// FileRegistry
// ---------------------------------------------------------------------------

function tmpFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-files-'));
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

test('registry: text file read back byte-identical', () => {
  const reg = new FileRegistry();
  const meta = reg.registerPath(tmpFile('a.txt', '几何内容'));
  assert.equal(reg.readText(meta.fileId), '几何内容');
  assert.equal(meta.kind, 'text');
  assert.equal(meta.size, Buffer.byteLength('几何内容'));
});

test('registry: binary rejected on read', () => {
  const reg = new FileRegistry();
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-bin-')), 'x.bin');
  fs.writeFileSync(p, Buffer.from([1, 0, 2, 0]));
  const meta = reg.registerPath(p);
  assert.equal(meta.kind, 'binary');
  assert.throws(() => reg.readText(meta.fileId), /binary/);
});

test('registry: pdf is metadata-only with clear error', () => {
  const reg = new FileRegistry();
  const p = tmpFile('x.pdf', '%PDF-1.4 fake');
  const meta = reg.registerPath(p);
  assert.equal(meta.kind, 'pdf');
  assert.throws(() => reg.readText(meta.fileId), /PDF/);
});

test('registry: no implicit registration; unknown id throws', () => {
  const reg = new FileRegistry();
  assert.throws(() => reg.get('nope'), /unknown file id/);
});

test('registry: saveUpload sanitizes filename', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-up-'));
  const reg = new FileRegistry({ uploadsDir: dir });
  const meta = reg.saveUpload(Buffer.from('hi'), '..\\..\\evil.txt');
  assert.equal(meta.name, 'evil.txt');
  assert.ok(meta.path.startsWith(dir));
  assert.equal(reg.readText(meta.fileId), 'hi');
});
