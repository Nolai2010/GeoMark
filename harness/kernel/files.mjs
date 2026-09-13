/** Explicit file registry: files enter ONLY when the user attaches them.
 *
 * Guarantees (phase 1):
 * - no directory scanning, no auto-discovery, no network reads
 * - text-like files -> UTF-8 text; PDFs -> metadata-only (clear error on read)
 * - every read is reflected into the event stream by the pipeline
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const TEXT_SUFFIXES = new Set([
  '.txt', '.md', '.markdown', '.json', '.jsonl', '.csv', '.tsv', '.yaml', '.yml',
  '.xml', '.html', '.htm', '.py', '.js', '.mjs', '.ts', '.java', '.c', '.cpp',
  '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.sh', '.bat', '.ps1', '.sql',
  '.toml', '.ini', '.cfg', '.log', '.tex', '.srt', '.ass',
]);

export class FileRegistry {
  constructor({ maxBytes = MAX_FILE_BYTES, uploadsDir = null } = {}) {
    this.maxBytes = maxBytes;
    this.uploadsDir = uploadsDir;
    this.files = new Map(); // file_id -> meta
  }

  registerPath(p, displayName = null) {
    const abs = path.resolve(p);
    const st = fs.statSync(abs);
    if (!st.isFile()) throw new Error(`not a file: ${p}`);
    if (st.size > this.maxBytes) throw new Error(`file too large (${st.size} > ${this.maxBytes} bytes)`);
    const meta = {
      fileId: randomUUID().replaceAll('-', ''),
      name: displayName || path.basename(abs),
      path: abs,
      size: st.size,
      sha256: sha256File(abs),
      kind: classify(abs),
      registeredAt: Date.now(),
    };
    this.files.set(meta.fileId, meta);
    return meta;
  }

  saveUpload(data, filename) {
    if (!Buffer.isBuffer(data)) throw new Error('upload must be a Buffer');
    if (data.length > this.maxBytes) throw new Error(`upload too large (${data.length} bytes)`);
    if (!this.uploadsDir) throw new Error('uploadsDir not configured');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    const safe = sanitizeFileName(filename);
    const target = path.join(this.uploadsDir, `${randomUUID().replaceAll('-', '').slice(0, 8)}_${safe}`);
    fs.writeFileSync(target, data);
    return this.registerPath(target, safe);
  }

  list() {
    return [...this.files.values()];
  }

  get(fileId) {
    const meta = this.files.get(fileId);
    if (!meta) throw new Error(`unknown file id: ${fileId}`);
    return meta;
  }

  clear() {
    const n = this.files.size;
    this.files.clear();
    return n;
  }

  /** Text content the model will receive. Throws for binary/pdf. */
  readText(fileId) {
    const meta = this.get(fileId);
    if (meta.kind === 'pdf') {
      throw new Error(
        `file "${meta.name}" is a PDF; this zero-dependency harness reads it as metadata only. ` +
        'Convert it to .txt/.md first so every model receives identical bytes.'
      );
    }
    if (meta.kind === 'binary') {
      throw new Error(`file "${meta.name}" is binary and cannot be attached as text`);
    }
    return fs.readFileSync(meta.path, 'utf8');
  }
}

function classify(p) {  const ext = path.extname(p).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (TEXT_SUFFIXES.has(ext)) return 'text';
  const fd = fs.openSync(p, 'r');
  try {
    const head = Buffer.alloc(8192);
    const read = fs.readSync(fd, head, 0, 8192, 0);
    return head.subarray(0, read).includes(0) ? 'binary' : 'text';
  } finally {
    fs.closeSync(fd);
  }
}

function sha256File(p) {
  const h = createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

/** Filename sanitizer contract (P1-5):
 *  1. the stored name is ONLY the final path segment after normalizing
 *     both separators ('/' and '\') -> path traversal is impossible;
 *  2. Windows-illegal characters and control characters become '_';
 *  3. trailing dots/spaces are trimmed (Windows resolves them away);
 *  4. an empty result falls back to 'file';
 *  5. the final write target always lives inside the uploads dir
 *     (uuid prefix + path.join guarantees it). */
export function sanitizeFileName(filename) {
  let name = String(filename ?? '');
  const segments = name.split(/[\\/]/).filter((s) => s.length > 0);
  name = segments.length > 0 ? segments[segments.length - 1] : '';
  name = name.replace(/[\x00-\x1f<>:"|?*]/g, '_');
  name = name.replace(/[. ]+$/g, '').trim();
  if (name === '' || name === '.' || name === '..') name = 'file';
  return name;
}
