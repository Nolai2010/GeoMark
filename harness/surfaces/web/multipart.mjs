/** Minimal multipart/form-data parser (zero dependencies). */

export function parseMultipart(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw new Error('missing multipart boundary');
  const boundary = '--' + (m[1] || m[2]).trim();
  const parts = [];
  let idx = buffer.indexOf(boundary);
  while (idx !== -1) {
    const afterBoundary = idx + boundary.length;
    if (buffer.toString('utf8', afterBoundary, afterBoundary + 2) === '--') break; // closing
    const headEnd = buffer.indexOf('\r\n\r\n', afterBoundary);
    if (headEnd === -1) break;
    const next = buffer.indexOf(boundary, headEnd);
    if (next === -1) break;
    const head = buffer.toString('utf8', afterBoundary, headEnd);
    const body = buffer.subarray(headEnd + 4, next - 2); // strip trailing \r\n
    const nameM = /name="([^"]*)"/.exec(head);
    const fileM = /filename="([^"]*)"/.exec(head);
    parts.push({ name: nameM?.[1] ?? null, filename: fileM?.[1] ?? null, data: body });
    idx = next;
  }
  return parts;
}
