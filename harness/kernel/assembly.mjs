/** Request assembly: the ONLY place user input + files become model input.
 *
 * The rendering template is fixed and shared by every provider. No adapter
 * may re-render, extend or trim what this module produces.
 */

export const FILE_BLOCK_TEMPLATE =
  '\n\n<attached-file name="{name}" sha256="{sha256}">\n{content}\n</attached-file>';

export function fileBlock(meta, content) {
  return FILE_BLOCK_TEMPLATE
    .replaceAll('{name}', meta.name)
    .replaceAll('{sha256}', meta.sha256)
    .replaceAll('{content}', content);
}

/** Render final messages: optional system first, then conversation. */
export function renderMessages(request) {
  const out = [];
  if (request.systemPrompt && request.systemPrompt.length > 0) {
    out.push({ role: 'system', content: request.systemPrompt });
  }
  for (const m of request.messages) {
    if (m.role !== 'user' && m.role !== 'assistant') {
      throw new Error(`invalid message role: ${m.role}`);
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

export function deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) deepFreeze(v);
    Object.freeze(obj);
  }
  return obj;
}
