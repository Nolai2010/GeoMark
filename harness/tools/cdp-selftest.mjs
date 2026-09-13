/** v0.6.0 交付自测：真实浏览器（Edge headless + CDP）驱动格物台。
 *
 * 覆盖：页面锁定滚动、聊天区独立滚动、真实 AI 调用（本地密钥）、
 * 跳底悬浮按钮出现/跳底/隐藏、Markdown 渲染、无 JS 异常。
 * 运行：node tools/cdp-selftest.mjs   （需先启动 server + 配置密钥）
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = 'http://127.0.0.1:7788/?theme=dark';
const PORT_CDP = 9333;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

// ---------- 启动 Edge（CDP 模式） ----------
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-edge-'));
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT_CDP}`, `--user-data-dir=${userDataDir}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitCDP() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not ready */ }
    await sleep(200);
  }
  throw new Error('CDP 未就绪');
}

// ---------- 极简 CDP 客户端（Node 22 内置 WebSocket） ----------
let ws;
let msgId = 0;
const pending = new Map();
const jsErrors = [];

function cdpSend(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await cdpSend('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 300));
  return r.result?.value;
}

async function main() {
  const wsUrl = await waitCDP();
  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      jsErrors.push(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text ?? 'unknown');
    }
  };
  await cdpSend('Runtime.enable');
  await cdpSend('Page.enable');
  await cdpSend('Page.navigate', { url: APP });
  await sleep(1500);

  // 1. 页面锁定滚动（顶栏/侧栏不飞）
  const pageScroll = await evaluate(
    `({ bodyOverflow: getComputedStyle(document.body).overflow, docSH: document.scrollingElement.scrollHeight, docCH: document.scrollingElement.clientHeight })`
  );
  check('页面整体不可滚动（侧栏/顶栏常驻）',
    pageScroll.bodyOverflow === 'hidden' && pageScroll.docSH <= pageScroll.docCH + 1,
    `overflow=${pageScroll.bodyOverflow}`);

  // 2. 聊天区独立可滚动：注入一段超长演示内容后 scrollHeight 必须大于 clientHeight
  await evaluate(`
    (function(){
      const chat = document.getElementById('chat');
      chat.innerHTML = '';
      for (let i = 0; i < 40; i++) {
        const d = document.createElement('div');
        d.className = 'msg assistant';
        d.innerHTML = '<div class="who">模型</div><div class="bubble">第 ' + i + ' 段长文本……</div>';
        chat.appendChild(d);
      }
      chat.dispatchEvent(new Event('scroll'));
    })()
  `);
  const scrollable = await evaluate(
    `(() => { const c = document.getElementById('chat');
      return { sh: c.scrollHeight, ch: c.clientHeight, top: c.scrollTop }; })()`
  );
  check('聊天区独立滚动（内容超高后 scrollHeight > clientHeight）',
    scrollable.sh > scrollable.ch, `scrollHeight=${scrollable.sh} clientHeight=${scrollable.ch}`);

  // 3. 用户上翻 → SVG 跳底按钮出现
  await evaluate(`
    (function(){
      const c = document.getElementById('chat');
      c.scrollTop = 0;
      c.dispatchEvent(new Event('scroll'));
    })()
  `);
  await sleep(300);
  const btnShown = await evaluate(
    `document.getElementById('btn-to-bottom').classList.contains('show')`
  );
  check('上翻后 SVG 跳底按钮出现', btnShown === true);

  // 4. 点按钮 → 回到底部 → 按钮隐藏
  await evaluate(`document.getElementById('btn-to-bottom').click()`);
  for (let i = 0; i < 10; i++) {
    await sleep(200);
    const okNow = await evaluate(`(() => { const c = document.getElementById('chat'); return c.scrollHeight - c.scrollTop - c.clientHeight < 48; })()`);
    if (okNow) break;
  }
  const after = await evaluate(
    `(() => { const c = document.getElementById('chat');
      const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 48;
      return { atBottom, btnHidden: !document.getElementById('btn-to-bottom').classList.contains('show') }; })()`
  );
  check('点按钮回到最新内容且按钮隐藏', after.atBottom && after.btnHidden);

  // 5. 真实 AI 调用（本地已配置的密钥）——与界面完全同路径
  await evaluate(`
    (function(){
      document.getElementById('chat').innerHTML = '';
      window.__userMsgs = [{ role: 'user', content: '用一句话说明微积分基本定理，并写出牛顿-莱布尼茨公式（LaTeX）。' }];
      // 通过内部 fetch 直接走 /api/chat，等价于界面发送
      window.__chatDone = fetch('/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          modelId: 'deepseek-flash', systemPrompt: '你是简洁的数学助教。',
          messages: window.__userMsgs, maxTokens: 512, timeoutMs: null, maxRetries: 0,
          reasoning: { enabled: false }, mode: 'chat',
        }),
      }).then(r => r.text()).then(t => { window.__chatText = t; });
    })()
  `);
  let chatText = '';
  for (let i = 0; i < 60; i++) {
    chatText = await evaluate(`window.__chatText ?? ''`);
    if (chatText) break;
    await sleep(500);
  }
  const completed = String(chatText).includes('"completion":"completed"');
  const hasContent = /"message_delta","data":{"text":"[^"]+/ .test(String(chatText));
  const noError = !String(chatText).includes('"type":"error"');
  check('真实 DeepSeek 调用成功（界面同路径 SSE）', noError && completed && hasContent,
    String(chatText).includes('message_end') ? 'stream completed' : String(chatText).slice(0, 120));

  // 6. 渲染管线：markdown/latex 渲染器存在且产出结构化 HTML
  const md = await evaluate(`
    (function(){
      if (!window.MDRender) return { ok: false };
      const html = MDRender.render('**加粗** 与 $E=mc^2$\\n\\n\\\`code\\\`');
      return { ok: true, bold: html.includes('<strong>'), math: html.includes('katex'), code: html.includes('md-code') };
    })()
  `);
  check('Markdown + LaTeX 渲染管线在线', md.ok && md.bold && md.math && md.code);

  // 7. 无未捕获 JS 异常
  check('无未捕获页面异常', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | ').slice(0, 200));

  // 截图留档
  const shot = await cdpSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('docs/screenshots/v060-cdp.png', Buffer.from(shot.data, 'base64'));
  console.log('截图: docs/screenshots/v060-cdp.png');
}

main()
  .catch((e) => { console.error('SELFTEST ERROR:', e.message); process.exitCode = 1; })
  .finally(async () => {
    try { ws?.close(); } catch { /* ignore */ }
    edge.kill();
    fs.rmSync(userDataDir, { recursive: true, force: true });
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n自测结果: ${results.length - failed}/${results.length} 通过`);
    if (failed > 0) process.exitCode = 1;
  });
