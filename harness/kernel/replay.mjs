/** Deterministic offline replay: raw provider bytes -> unified events.
 *
 * Uses the exact same spec + rule engine as the live path. A run captured
 * once can be re-driven forever without calling any API.
 */

import { loadSpec } from '../adapters/index.mjs';
import { applyChunk, createStreamState, parseSSEText } from '../adapters/engine.mjs';

export function replayRawSSE(provider, rawText) {
  const spec = loadSpec(provider);
  const state = createStreamState();
  const events = [];
  for (const chunk of parseSSEText(rawText)) {
    for (const ev of applyChunk(spec, chunk, state)) {
      events.push(ev);
      if (ev.type === 'error') return events;
    }
  }
  events.push({
    type: 'message_end',
    data: { usage: state.usage, finishReason: state.finishReason, completion: 'completed' },
  });
  return events;
}
