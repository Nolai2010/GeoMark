/** 实验赛道自测：真实浏览器（Edge headless + CDP）打开三赛道弹窗并截图。
 * 运行：node tools/tracks-selftest.mjs   （需先启动 server）
 * 产出：docs/screenshots/tracks-dialog.png
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.resolve(HERE, '..');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.error('未找到 Edge'); process.exit(1); }
const APP = 'http://127.0.0.1:7788/';
const PORT = 9334;

const get = (url) => new Promise((res, rej) => http.get(url, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res(s)); }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-tracks-'));
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
  '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore', detached: false });

let ws;
let id = 0;
const pending = new Map();
const consoleErrors = [];
function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res, rej) => {
    pending.set(mid, { res, rej });
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('timeout ' + method)); } }, 30000);
  });
}

try {
  await sleep(1800);
  const targets = JSON.parse(await get(`http://127.0.0.1:${PORT}/json`));
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.exception?.description || 'exception');
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: APP });
  await sleep(2500);

  // 点击「开始测试」并等待弹窗数据渲染
  const clickRes = await send('Runtime.evaluate', { expression: "(()=>{const b=document.getElementById('btn-tracks'); if(!b) return 'no-button'; b.click(); return 'clicked';})()", returnByValue: true });
  console.log('点击结果:', clickRes.result.value);
  await sleep(5000);

  const info = await send('Runtime.evaluate', {
    expression: `(()=>{const d=document.getElementById('tracks-dialog');return JSON.stringify({open:!!(d&&d.open),cards:document.querySelectorAll('.track-card').length,urls:document.querySelectorAll('.track-url-check').length,launchBtns:document.querySelectorAll('.track-launch').length,offChips:document.querySelectorAll('.track-chip.off').length,groupHeads:document.querySelectorAll('.track-group-head').length,kindBadges:document.querySelectorAll('.track-kind').length,kindBreakdown:['cli','app','msix','web'].map(k=>k+':'+document.querySelectorAll('.track-kind.k-'+k).length).join(' '),msg:(document.getElementById('tracks-msg')||{}).textContent||'',listHTML:((document.getElementById('tracks-list')||{}).innerHTML||'').slice(0,300),hasFn:typeof openTracksDialog});})()`,
    returnByValue: true,
  });
  console.log('弹窗状态:', info.result.value);

  const api = await send('Runtime.evaluate', {
    expression: `fetch('/api/tracks').then(r=>r.json()).then(j=>'ok:'+(j.tracks||[]).length).catch(e=>'err:'+e.message)`,
    awaitPromise: true, returnByValue: true,
  });
  console.log('页面内 fetch /api/tracks:', api.result.value);

  // 题目包面板
  const exp = await send('Runtime.evaluate', {
    expression: `(()=>JSON.stringify({select:!!document.getElementById('exp-item'),options:(document.getElementById('exp-item')||{}).length||0,btns:['exp-copy','exp-card','exp-zip'].filter(i=>!!document.getElementById(i)).length,caps:document.querySelectorAll('.cap').length}))()`,
    returnByValue: true,
  });
  console.log('题目包面板:', exp.result.value);

  const outDir = path.join(HARNESS, 'docs', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  // 合成题卡（不触发下载），把 PNG 存盘供人工查验
  const card = await send('Runtime.evaluate', {
    expression: `buildCardCanvas('GM-0102').then(c=>JSON.stringify({w:c.width,h:c.height,data:c.toDataURL('image/png')})).catch(e=>'err:'+e.message)`,
    awaitPromise: true, returnByValue: true, timeout: 60000,
  });
  try {
    const cv = JSON.parse(card.result.value);
    fs.writeFileSync(path.join(outDir, 'item-card-sample.png'), Buffer.from(cv.data.split(',')[1], 'base64'));
    console.log(`题卡合成: ${cv.w}x${cv.h} → item-card-sample.png`);
  } catch (e) { console.log('题卡合成失败:', String(card.result.value).slice(0, 200)); }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const out = path.join(outDir, 'tracks-dialog.png');
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('截图:', out);

  // 滚到题目包 / Agent 赛道再各截一张
  const sc = async (sel, name, block = 'center') => {
    await send('Runtime.evaluate', { expression: `(()=>{const e=document.querySelector('${sel}');if(e)e.scrollIntoView({block:'${block}'});return 1})()`, returnByValue: true });
    await sleep(600);
    const s2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(s2.data, 'base64'));
    console.log('截图:', name);
  };
  await sc('.track-export', 'tracks-export.png');
  await sc('.track-card:last-child .track-group-head', 'tracks-agent.png', 'start');

  console.log('控制台错误:', consoleErrors.length ? consoleErrors.slice(0, 5) : '无');
} catch (e) {
  console.error('自测失败:', e.message);
} finally {
  try { ws && ws.close(); } catch {}
  try { edge.kill(); } catch {}
  await sleep(300);
  // 临时 profile 目录可能被 safe-delete 钩子拦截，失败不影响自测结论
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
}
