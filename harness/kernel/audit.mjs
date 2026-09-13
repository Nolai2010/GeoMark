/** Hash-chained event ledger: tamper-evident audit trail for every run. */

import { createHash } from 'node:crypto';

export const ZERO_HASH = '0'.repeat(64);

/** Deterministic JSON: sorted keys, no whitespace. Same input -> same bytes, always. */
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
}

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function sha256Buf(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Append-only chain. Every event is sealed with seq | prevHash | hash. */
export class EventChain {
  constructor() {
    this.prev = ZERO_HASH;
    this.seq = 0;
  }
  /** ev: {type, data, ts?}. Returns sealed event. */
  append(ev) {
    const sealed = {
      type: ev.type,
      data: ev.data ?? {},
      ts: ev.ts ?? Date.now(),
      seq: this.seq,
      prevHash: this.prev,
      hash: '',
    };
    sealed.hash = sha256Hex(
      `${sealed.seq}|${sealed.prevHash}|${canonicalJSON({ type: sealed.type, data: sealed.data, ts: sealed.ts })}`
    );
    this.prev = sealed.hash;
    this.seq += 1;
    return sealed;
  }
  get root() {
    return this.prev;
  }
}

/** Recompute the whole chain; detect any tampering. */
export function verifyChain(events) {
  let prev = ZERO_HASH;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.seq !== i) return { ok: false, error: `seq mismatch at ${i}`, count: i, root: prev };
    if (ev.prevHash !== prev) return { ok: false, error: `prevHash mismatch at ${i}`, count: i, root: prev };
    const h = sha256Hex(`${ev.seq}|${ev.prevHash}|${canonicalJSON({ type: ev.type, data: ev.data, ts: ev.ts })}`);
    if (h !== ev.hash) return { ok: false, error: `hash mismatch at ${i}`, count: i, root: prev };
    prev = ev.hash;
  }
  return { ok: true, count: events.length, root: prev };
}
