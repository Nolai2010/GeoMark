/** Agent runtime pipeline: the neutral heart of the harness.
 *
 * 1. read user-attached files (fail-closed, events recorded)
 * 2. render final messages with the ONE shared template
 * 3. freeze + snapshot the rendered input (neutrality guard)
 * 4. stream through the adapter, seal every event into the hash chain
 * 5. verify the frozen input was untouched after the adapter ran
 *
 * Completion semantics (P0-3): result.status is 'ok' ONLY when the stream
 * completed. Everything else maps to an explicit CompletionState, an error
 * event, and result.status='error'. A truncated/broken stream never passes
 * as success.
 *
 * Retry policy (P2): maxRetries defaults to 0. Retries happen only when
 * explicitly configured and only for network_error / timeout. Every attempt
 * and retry decision is recorded as events and in the result.
 */

import { EventChain, canonicalJSON, sha256Hex } from './audit.mjs';
import { deepFreeze, fileBlock, renderMessages } from './assembly.mjs';
import {
  EventTypes,
  makeRunResult,
  validateEvent,
  RETRYABLE_COMPLETIONS,
} from './schema.mjs';

function msSince(t0) {
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

export async function runExperiment({
  request,
  adapter,
  fileRegistry = null,
  onEvent = null,
  signal = null,
}) {
  const t0 = process.hrtime.bigint();
  const events = [];
  const chain = new EventChain();
  const emit = (ev) => {
    const sealed = chain.append(validateEvent(ev));
    events.push(sealed);
    onEvent?.(sealed);
    return sealed;
  };

  // work on a clone: the caller's request object is never touched
  const req = structuredClone(request);
  const maxRetries = Math.max(0, Math.min(10, Number(req.maxRetries ?? 0)));
  const result = makeRunResult(req.requestId);
  result.startedAt = Date.now();

  let frozen = null;
  let snapshot = '';

  try {
    // 1. explicit file reads (fail-closed: any failure aborts the run)
    if (fileRegistry) {
      for (const msg of req.messages) {
        for (const fid of msg.fileIds ?? []) {
          const meta = fileRegistry.get(fid);
          emit({ type: EventTypes.FILE_READ_START, data: { fileId: fid, name: meta.name } });
          const content = fileRegistry.readText(fid);
          emit({
            type: EventTypes.FILE_READ_END,
            data: { fileId: fid, name: meta.name, ok: true, chars: content.length },
          });
          msg.content += fileBlock(meta, content);
        }
      }
    }

    // 2-3. render, snapshot, freeze (identical for every provider/attempt)
    const rendered = renderMessages(req);
    result.renderedMessages = rendered;
    snapshot = sha256Hex(canonicalJSON(rendered));
    frozen = deepFreeze(structuredClone(rendered));

    // 4. attempts: 1 + explicit maxRetries; retry only network_error/timeout
    let attempt = 0;
    let completion = null;
    while (true) {
      attempt += 1;
      emit({
        type: EventTypes.REQUEST_START,
        data: { attempt, maxRetries, model: req.apiModelId, provider: req.provider },
      });

      // fresh attempt: discard partials from a failed previous attempt
      result.text = '';
      result.reasoningText = '';
      result.ttftMs = null;
      let attemptCompletion = null;
      let sawError = false;

      for await (const ev of adapter.stream({
        request: req,
        renderedMessages: frozen,
        signal,
      })) {
        switch (ev.type) {
          case EventTypes.MESSAGE_DELTA:
            result.ttftMs ??= msSince(t0);
            result.text += ev.data.text;
            break;
          case EventTypes.REASONING_DELTA:
            result.reasoningText += ev.data.text;
            break;
          case EventTypes.MESSAGE_END:
            attemptCompletion = ev.data.completion ?? 'completed';
            result.usage = {
              inputTokens: ev.data.usage?.inputTokens ?? null,
              outputTokens: ev.data.usage?.outputTokens ?? null,
              raw: ev.data.usage?.raw ?? null,
            };
            result.finishReason = ev.data.finishReason ?? null;
            emit({
              type: EventTypes.MESSAGE_END,
              data: {
                usage: result.usage,
                finishReason: result.finishReason,
                completion: attemptCompletion,
                attempt,
                timing: { ttftMs: result.ttftMs, totalMs: msSince(t0) },
              },
            });
            continue;
          case EventTypes.ERROR:
            sawError = true;
            result.error = ev.data.message;
            break;
          default:
            break;
        }
        emit(ev);
      }

      completion = attemptCompletion ?? 'harness_error';
      result.completion = completion;

      if (completion !== 'completed') {
        result.status = 'error';
        if (!result.error) result.error = `stream ended without completion: ${completion}`;
        if (!sawError) {
          // e.g. truncated: stream closed cleanly but no provider end signal
          emit({
            type: EventTypes.ERROR,
            data: { message: result.error, recoverable: false, completion },
          });
        }
      }

      const retryable =
        completion !== 'completed' &&
        RETRYABLE_COMPLETIONS.includes(completion) &&
        attempt <= maxRetries;

      if (retryable) {
        emit({
          type: EventTypes.RETRY_START,
          data: { nextAttempt: attempt + 1, reason: completion },
        });
        continue;
      }
      if (result.retries > 0 || attempt > 1) {
        emit({
          type: EventTypes.RETRY_END,
          data: { attempts: attempt, finalCompletion: completion },
        });
      }
      break;
    }

    result.attempts = attempt;
    result.retries = attempt - 1;

    if (completion === 'completed') {
      // 5. neutrality guard: adapter must not have touched the input
      const after = sha256Hex(canonicalJSON(JSON.parse(canonicalJSON(frozen))));
      if (after !== snapshot) {
        throw new Error('NEUTRALITY VIOLATION: adapter modified the rendered request');
      }
      result.status = 'ok';
    }
  } catch (err) {
    result.status = 'error';
    result.error = String(err?.message ?? err);
    if (!result.completion) result.completion = 'harness_error';
    emit({
      type: EventTypes.ERROR,
      data: { message: result.error, recoverable: false, completion: result.completion },
    });
  }

  result.totalMs = msSince(t0);
  result.finishedAt = Date.now();
  return { result, events, chainRoot: chain.root };
}
