// QA-only mock OpenAI-compatible SSE provider (NOT part of the harness core).
import http from 'node:http';

http
  .createServer((req, res) => {
    if (req.url !== '/v1/chat/completions') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      // echo back what the harness sent, so QA can assert neutrality end-to-end
      const echo = JSON.stringify(parsed.messages.map((m) => ({ r: m.role, c: m.content })));
      const modelName = parsed.model ?? '';
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      chunk({ choices: [{ delta: { reasoning_content: 'QA思考中…' } }] });
      chunk({ choices: [{ delta: { content: '收到 ' + echo + ' | ' + (parsed.reasoning_effort ?? 'no-effort') + ' | max_tokens=' + (parsed.max_tokens ?? 'unset') } }] });
      chunk({ choices: [{ delta: {}, finish_reason: 'stop' }] });
      chunk({ choices: [], usage: { prompt_tokens: 5, completion_tokens: 9 } });
      res.write('data: [DONE]\n\n');
      res.end();
    });
  })
  .listen(9911, '127.0.0.1', () => console.log('mock provider on 9911'));
