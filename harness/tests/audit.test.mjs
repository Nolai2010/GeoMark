import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventChain, verifyChain, canonicalJSON, sha256Hex } from '../kernel/audit.mjs';

test('canonicalJSON is order-stable', () => {
  assert.equal(canonicalJSON({ b: 1, a: [2, { z: 1, y: 2 }] }), canonicalJSON({ a: [2, { y: 2, z: 1 }], b: 1 }));
});

test('event chain seals and verifies', () => {
  const chain = new EventChain();
  const events = [
    chain.append({ type: 'message_start', data: {} }),
    chain.append({ type: 'message_delta', data: { text: 'a' } }),
    chain.append({ type: 'message_end', data: {} }),
  ];
  const res = verifyChain(events);
  assert.equal(res.ok, true);
  assert.equal(res.count, 3);
  assert.equal(res.root, chain.root);
});

test('tampering any byte breaks verification', () => {
  const chain = new EventChain();
  const events = [
    chain.append({ type: 'message_start', data: {} }),
    chain.append({ type: 'message_delta', data: { text: '原始回答' } }),
  ];
  const tampered = structuredClone(events);
  tampered[1].data.text = '篡改后的回答';
  const res = verifyChain(tampered);
  assert.equal(res.ok, false);
  assert.match(res.error, /hash mismatch/);
});

test('reordering events breaks verification', () => {
  const chain = new EventChain();
  const events = [
    chain.append({ type: 'message_start', data: {} }),
    chain.append({ type: 'message_delta', data: { text: 'x' } }),
    chain.append({ type: 'message_delta', data: { text: 'y' } }),
  ];
  const reordered = [events[0], events[2], events[1]];
  assert.equal(verifyChain(reordered).ok, false);
});

test('sha256Hex known vector', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
