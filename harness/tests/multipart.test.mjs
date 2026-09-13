import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMultipart } from '../surfaces/web/multipart.mjs';

function buildBody() {
  const boundary = '----harness123';
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="几何题.txt"\r\nContent-Type: text/plain\r\n\r\n`,
    '三角形 ABC 中，已知……',
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\n`,
    'plain field',
    `\r\n--${boundary}--\r\n`,
  ];
  return { buffer: Buffer.concat(parts.map((p) => Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8'))), contentType: `multipart/form-data; boundary=${boundary}` };
}

test('multipart parser extracts file parts with UTF-8 filenames', () => {
  const { buffer, contentType } = buildBody();
  const parts = parseMultipart(buffer, contentType);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].filename, '几何题.txt');
  assert.equal(parts[0].data.toString('utf8'), '三角形 ABC 中，已知……');
  assert.equal(parts[1].name, 'note');
  assert.equal(parts[1].data.toString('utf8'), 'plain field');
});

test('multipart parser rejects missing boundary', () => {
  assert.throws(() => parseMultipart(Buffer.alloc(0), 'multipart/form-data'), /boundary/);
});
