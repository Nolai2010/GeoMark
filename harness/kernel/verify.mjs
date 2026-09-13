/** Standalone bundle verifier: independent of any adapter or network.
 *
 * Checks, in order:
 *  1. manifest.json exists and parses
 *  2. every artifact hash matches the manifest
 *  3. files/ copies match the manifest
 *  4. the event hash-chain is intact
 *  5. result.json and config.json refer to the same request
 */

import fs from 'node:fs';
import path from 'node:path';
import { sha256Buf, verifyChain } from './audit.mjs';

export function verifyBundle(dir) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

  const manifestPath = path.join(dir, 'manifest.json');
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    add('manifest.json readable', true);
  } catch (e) {
    add('manifest.json readable', false, String(e));
    return { ok: false, checks };
  }

  for (const [rel, expected] of Object.entries(manifest.artifacts ?? {})) {
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) {
      add(`artifact ${rel}`, false, 'missing');
      continue;
    }
    const actual = sha256Buf(fs.readFileSync(p));
    add(`artifact ${rel}`, actual === expected, actual === expected ? '' : `expected ${expected}, got ${actual}`);
  }

  for (const [name, expected] of Object.entries(manifest.files ?? {})) {
    const p = path.join(dir, 'files', name);
    if (!fs.existsSync(p)) {
      add(`file copy ${name}`, false, 'missing');
      continue;
    }
    add(`file copy ${name}`, sha256Buf(fs.readFileSync(p)) === expected);
  }

  const evPath = path.join(dir, 'events.jsonl');
  if (fs.existsSync(evPath)) {
    const events = fs
      .readFileSync(evPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    const res = verifyChain(events);
    add('event hash chain', res.ok, res.error ?? `${res.count} events, root ${res.root.slice(0, 16)}…`);
  } else {
    add('event hash chain', false, 'events.jsonl missing');
  }

  try {
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    const result = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
    add('request id consistent', config.requestId === result.requestId);
  } catch (e) {
    add('request id consistent', false, String(e));
  }

  return { ok: checks.every((c) => c.ok), checks };
}
