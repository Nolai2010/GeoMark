/* 格物台 · 前端逻辑（无框架、无依赖、无遥测）
 *
 * 机制：
 * 1. termify()：把页面里出现的术语自动包成与正文同貌的链接，点击弹原生 <dialog> 术语说明（打字机流式呈现固定文案）；
 * 2. 主题管理：亮色 / 暗色 / 跟随系统，无刷新切换；
 * 3. 模型配置：预设 + 自定义接口 + 测试连接，全部通过 API 持久化，密钥不回显；
 * 4. 运行状态：就绪 → 连接中 → 流式输出中 → 已完成 / 失败。
 */

const $ = (id) => document.getElementById(id);
const state = {
  models: [], files: [], messages: [], running: false, presets: [], editingModelId: null,
  sessionId: null, sessionName: '', currentExpId: null,
};

/* =========================================================================
 * 会话持久化：刷新后可回到上次对话；对话记录保存在本机 localStorage
 * ========================================================================= */
const SESSION_KEY = 'gm-session';
const SESSIONS_KEY = 'gm-sessions';

function readSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]'); } catch { return []; }
}

function sessionNameOf(s) {
  return s.name || (s.messages.find((m) => m.role === 'user')?.content ?? '未命名对话').slice(0, 24);
}

function persistSession() {
  if (!state.messages.length) return;
  if (!state.sessionId) state.sessionId = 'sess-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const cur = {
    id: state.sessionId,
    name: state.sessionName,
    systemPrompt: $('system-prompt').value,
    messages: state.messages.map((m) => ({ role: m.role, content: m.content, fileIds: [] })), // 附件不持久化，需重新上传
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(cur));
    const list = readSessions().filter((x) => x.id !== cur.id);
    list.unshift(cur);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 30)));
  } catch { /* 存储异常不阻断对话 */ }
  renderSessionList();
}

function renderSession(messages) {
  $('chat').innerHTML = '';
  for (const m of messages) {
    const b = addBubble(m.role);
    if (m.role === 'assistant') b.innerHTML = renderMD(m.content);
    else b.textContent = m.content;
  }
  termify($('chat'));
}

function restoreSession(sess) {
  state.sessionId = sess.id;
  state.sessionName = sess.name ?? '';
  state.messages = (sess.messages ?? []).map((m) => ({ role: m.role, content: m.content, fileIds: [] })); // 附件需重新上传
  $('system-prompt').value = sess.systemPrompt ?? '';
  renderSession(state.messages);
  setRunStatus('idle', '就绪');
}

function loadSessionOnBoot() {
  try {
    const cur = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    if (cur?.messages?.length) {
      state.sessionId = cur.id;
      state.sessionName = cur.name ?? '';
      state.messages = cur.messages.map((m) => ({ role: m.role, content: m.content, fileIds: [] }));
      $('system-prompt').value = cur.systemPrompt ?? '';
      renderSession(state.messages);
    }
  } catch { /* ignore */ }
  renderSessionList();
}

function renderSessionList() {
  const list = readSessions();
  $('session-list').innerHTML = list.length
    ? list.map((s) => {
      const d = new Date(s.updatedAt).toLocaleString();
      const n = esc(sessionNameOf(s));
      return `<li data-id="${esc(s.id)}" title="${esc(n)}">
        <span class="rname">${n}</span> <span class="fineprint">${esc(d)}</span>
        <div class="acts"><a data-act="open">恢复</a><a data-act="rename">重命名</a><a data-act="del" class="danger">删除</a></div>
      </li>`;
    }).join('')
    : '<li class="fineprint">暂无对话记录（发送第一条消息后自动保存）</li>';
  $('session-list').querySelectorAll('li[data-id]').forEach((li) => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.acts')) return;
      const sess = readSessions().find((x) => x.id === li.dataset.id);
      if (sess) restoreSession(sess);
    });
    li.querySelector('[data-act="rename"]').addEventListener('click', () => {
      const list2 = readSessions();
      const sess = list2.find((x) => x.id === li.dataset.id);
      const name = prompt('给这次对话起个名字：', sessionNameOf(sess));
      if (name === null) return;
      sess.name = name.trim().slice(0, 80);
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(list2));
        if (state.sessionId === sess.id) {
          state.sessionName = sess.name;
          const cur = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
          if (cur) { cur.name = sess.name; localStorage.setItem(SESSION_KEY, JSON.stringify(cur)); }
        }
      } catch { /* ignore */ }
      renderSessionList();
    });
    li.querySelector('[data-act="del"]').addEventListener('click', () => {
      if (!confirm('删除这条对话记录？（不影响已保存的实验包）')) return;
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(readSessions().filter((x) => x.id !== li.dataset.id)));
        if (state.sessionId === li.dataset.id) localStorage.removeItem(SESSION_KEY);
      } catch { /* ignore */ }
      renderSessionList();
    });
  });
}

/* =========================================================================
 * 术语说明
 * ========================================================================= */

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TERM_INDEX = window.GLOSSARY
  .flatMap((g) => g.match.map((alias) => [alias, g.key]))
  .sort((a, b) => b[0].length - a[0].length);
const TERM_RE = new RegExp(`(${TERM_INDEX.map(([m]) => escRe(m)).join('|')})`, 'g');
const TERM_TEST_RE = new RegExp(`(${TERM_INDEX.map(([m]) => escRe(m)).join('|')})`);
const TERM_BY_KEY = Object.fromEntries(window.GLOSSARY.map((g) => [g.key, g]));
const termKeyFor = (alias) => {
  const hit = TERM_INDEX.find(([m]) => m === alias);
  return hit ? hit[1] : null;
};

const SKIP_TAGS = 'a.term,script,style,textarea,select,input,pre,dialog,option';

/** 扫描 root 下的文本节点，把术语包成同貌链接（幂等）。 */
function termify(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p || p.closest(SKIP_TAGS)) return NodeFilter.FILTER_REJECT;
      return TERM_TEST_RE.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let last = 0;
    TERM_RE.lastIndex = 0;
    let m;
    while ((m = TERM_RE.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = document.createElement('a');
      a.className = 'term';
      a.dataset.term = termKeyFor(m[0]);
      a.textContent = m[0];
      a.tabIndex = 0;
      a.setAttribute('role', 'button');
      frag.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }
}

/* 术语说明弹窗：原生 <dialog> + 打字机（固定文案） */
const termTyper = { timer: null, full: '', pos: 0, el: null };

function openTerm(key) {
  const g = TERM_BY_KEY[key];
  if (!g) return;
  $('term-title').textContent = g.title;
  const body = $('term-body');
  body.textContent = '';
  termTyper.full = g.body;
  termTyper.pos = 0;
  termTyper.el = body;
  $('term-dialog').showModal();
  termTyper.timer = setInterval(() => {
    termTyper.pos = Math.min(termTyper.full.length, termTyper.pos + 2 + Math.floor(Math.random() * 2));
    body.textContent = termTyper.full.slice(0, termTyper.pos);
    if (termTyper.pos >= termTyper.full.length) {
      clearInterval(termTyper.timer);
      termTyper.timer = null;
    }
  }, 26);
}

function finishTerm() {
  if (termTyper.timer) {
    clearInterval(termTyper.timer);
    termTyper.timer = null;
    termTyper.el.textContent = termTyper.full; // 点击正文 = 跳过，立即显示全部
  } else {
    $('term-dialog').close();
  }
}

/* =========================================================================
 * 主题：亮色 / 暗色 / 跟随系统
 * ========================================================================= */

const THEME_KEY = 'gm-theme';
const theme = { mode: 'system' };
const LABELS = { light: '主题：亮色', dark: '主题：暗色', system: '主题：跟随系统' };

function applyTheme() {
  let dark;
  if (theme.mode === 'system') {
    dark = matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    dark = theme.mode === 'dark';
  }
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('btn-theme').textContent = LABELS[theme.mode];
  try { localStorage.setItem(THEME_KEY, theme.mode); } catch { /* ignore */ }
}

function cycleTheme() {
  theme.mode = theme.mode === 'light' ? 'dark' : theme.mode === 'dark' ? 'system' : 'light';
  applyTheme();
}

function initTheme() {
  let saved = 'system';
  try {
    saved = localStorage.getItem(THEME_KEY) || 'system';
  } catch { /* ignore */ }
  const q = new URLSearchParams(location.search).get('theme'); // 演示/截图钩子
  theme.mode = q || saved;
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.mode === 'system') applyTheme();
  });
}

/* =========================================================================
 * API 密钥（协议级）
 * ========================================================================= */

async function refreshKeyDots() {
  try {
    const { providers } = await (await fetch('/api/keys/status')).json();
    $('key-dots').innerHTML =
      `<i class="${providers['openai-compatible'] ? 'on' : ''}" title="OpenAI Compatible：${providers['openai-compatible'] ? '已配置' : '未配置'}"></i>` +
      `<i class="${providers.anthropic ? 'on' : ''}" title="Anthropic：${providers.anthropic ? '已配置' : '未配置'}"></i>`;
  } catch {
    $('key-dots').innerHTML = '';
  }
}

function openKeys(hint = '') {
  $('keys-msg').textContent = hint;
  $('keys-dialog').showModal();
}

async function saveKeys() {
  const payload = [];
  const oai = $('key-openai').value.trim();
  const ant = $('key-anthropic').value.trim();
  if (oai) payload.push({ provider: 'openai-compatible', key: oai });
  if (ant) payload.push({ provider: 'anthropic', key: ant });
  if (!payload.length) {
    $('keys-msg').textContent = '两个输入框都为空，请先填写。';
    return;
  }
  for (const p of payload) {
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(p),
    });
    if (!res.ok) {
      $('keys-msg').textContent = (await res.json()).error ?? '保存失败';
      return;
    }
  }
  $('key-openai').value = '';
  $('key-anthropic').value = '';
  $('keys-msg').textContent = '已保存。';
  refreshKeyDots();
}

/* =========================================================================
 * 模型配置（预设 + 自定义接口 + 测试连接）
 * ========================================================================= */

async function refreshModels() {
  const { models } = await (await fetch('/api/models')).json();
  state.models = models;
  $('model').innerHTML = models
    .map((m) => `<option value="${esc(m.id)}">${esc(m.displayName)} · ${esc(m.provider)}</option>`)
    .join('');
  $('model-existing').innerHTML =
    '<option value="">＋ 新建模型</option>' +
    models.map((m) => `<option value="${esc(m.id)}">${esc(m.displayName)}（${esc(m.id)}）</option>`).join('');
  if (state.editingModelId) $('model-existing').value = state.editingModelId;
  showModelInfo();
}

async function refreshPresets() {
  const { presets } = await (await fetch('/api/presets')).json();
  state.presets = presets;
  $('model-preset').innerHTML =
    '<option value="">自定义接口</option>' +
    presets.map((p) => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
}

function currentModel() {
  return state.models.find((m) => m.id === $('model').value);
}

function showModelInfo() {
  const m = currentModel();
  $('model-info').textContent = m
    ? `${m.apiModelId} · ${m.baseUrl}${m.supportsReasoning ? ' · 支持原生推理' : ''}`
    : '尚未配置模型：点击「管理模型」从预设添加';
}

function openModelDialog(modelId = null) {
  state.editingModelId = modelId;
  if (!modelId && $('model').value) modelId = $('model').value; // 默认编辑当前选中的模型
  state.editingModelId = modelId;
  const m = modelId ? state.models.find((x) => x.id === modelId) : null;
  $('model-existing').value = modelId ?? '';
  $('model-preset').value = '';
  $('model-provider').value = m?.provider ?? 'openai-compatible';
  $('model-name').value = m?.displayName ?? '';
  $('model-baseurl').value = m?.baseUrl ?? '';
  $('model-endpoint').value = m?.endpointPath ?? '';
  $('model-id').value = m?.apiModelId ?? '';
  $('model-key').value = ''; // 密钥不回显
  $('model-def-temp').value = m?.defaultTemperature ?? '';
  $('model-def-max').value = m?.defaultMaxTokens ?? '';
  $('model-reasoning').checked = !!m?.supportsReasoning;
  $('model-extra').value = m?.extraBody && Object.keys(m.extraBody).length ? JSON.stringify(m.extraBody, null, 2) : '';
  $('model-test-msg').textContent = '';
  $('model-delete').style.display = m ? '' : 'none';
  $('model-dialog').showModal();
}

function applyPreset() {
  const p = state.presets.find((x) => x.id === $('model-preset').value);
  if (!p) return;
  $('model-provider').value = p.provider;
  $('model-name').value = p.label;
  $('model-baseurl').value = p.baseUrl;
  $('model-endpoint').value = p.endpointPath ?? '';
  $('model-id').value = p.apiModelId;
}

function collectModelPayload() {
  let extra = {};
  const extraRaw = $('model-extra').value.trim();
  if (extraRaw) {
    try {
      extra = JSON.parse(extraRaw);
      if (typeof extra !== 'object' || Array.isArray(extra) || extra === null) throw new Error('必须是 JSON 对象');
    } catch (e) {
      throw new Error(`Extra Body JSON 无效：${e.message}`);
    }
  }
  const idRaw = $('model-id').value.trim();
  if (!idRaw) throw new Error('请填写模型 ID');
  // harness 内部 id 从模型 ID 派生，保证稳定且可读
  const derived = idRaw.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'model';
  const id = state.editingModelId || derived; // 编辑既有模型时保持身份不变
  return {
    id,
    provider: $('model-provider').value,
    base_url: $('model-baseurl').value.trim(),
    api_model_id: idRaw,
    display_name: $('model-name').value.trim(),
    endpoint_path: $('model-endpoint').value.trim() || undefined,
    supports_reasoning: $('model-reasoning').checked,
    default_temperature: $('model-def-temp').value === '' ? null : Number($('model-def-temp').value),
    default_max_tokens: $('model-def-max').value === '' ? null : Number($('model-def-max').value),
    extra_body: extra,
  };
}

async function testModelConnection() {
  const msg = $('model-test-msg');
  msg.textContent = '正在测试连接…';
  try {
    const payload = collectModelPayload();
    const res = await fetch('/api/models/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: payload.provider,
        baseUrl: payload.base_url,
        apiModelId: payload.api_model_id,
        apiKey: $('model-key').value.trim() || undefined, // 留空则用已保存密钥
        endpointPath: payload.endpoint_path ?? null,
      }),
    });
    const out = await res.json();
    msg.textContent = out.message ?? (out.ok ? '连接成功' : '连接失败');
  } catch (e) {
    msg.textContent = String(e.message);
  }
}

async function saveModelFromDialog() {
  try {
    const payload = collectModelPayload();
    const res = await fetch('/api/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await res.json();
    if (!res.ok) {
      $('model-test-msg').textContent = out.error ?? '保存失败';
      return;
    }
    const key = $('model-key').value.trim();
    if (key) {
      const kr = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelId: payload.id, key }),
      });
      if (!kr.ok) {
        $('model-test-msg').textContent = '模型已保存，但密钥保存失败：' + ((await kr.json()).error ?? kr.status);
        return;
      }
      refreshKeyDots();
    }
    state.editingModelId = payload.id;
    $('model-dialog').close();
    await refreshModels();
    $('model').value = payload.id;
    showModelInfo();
  } catch (e) {
    $('model-test-msg').textContent = String(e.message);
  }
}

async function deleteModelFromDialog() {
  if (!state.editingModelId) return;
  if (!confirm(`确定删除模型「${state.editingModelId}」？此操作不会删除已有实验记录。`)) return;
  await fetch(`/api/models/${encodeURIComponent(state.editingModelId)}`, { method: 'DELETE' });
  $('model-dialog').close();
  await refreshModels();
}

/* =========================================================================
 * 文件
 * ========================================================================= */

async function refreshFiles() {
  const { files } = await (await fetch('/api/files')).json();
  state.files = files;
  $('file-list').innerHTML = files
    .map((f) => `<li><span class="fname" title="${esc(f.name)}">${esc(f.name)} <span class="fineprint">(${f.size}B · ${f.kind})</span></span><a data-id="${f.fileId}">移除</a></li>`)
    .join('');
  $('file-list').querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', async () => {
      await fetch('/api/files', { method: 'DELETE' }); // 第一阶段：一次性移除全部附件
      refreshFiles();
    })
  );
}

async function onUpload(e) {
  const list = $('file-list');
  for (const f of e.target.files) {
    const li = document.createElement('li');
    li.className = 'uploading';
    li.textContent = `上传中… ${f.name}`;
    list.appendChild(li);
    const fd = new FormData();
    fd.append('file', f, f.name);
    const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      li.classList.remove('uploading');
      li.textContent = `上传失败 ${f.name}`;
      li.style.color = 'var(--err)';
    }
  }
  e.target.value = '';
  refreshFiles();
}

/* =========================================================================
 * 对话与实验
 * ========================================================================= */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* 聊天区滚动管理：跟随模式 + 跳到最新回复悬浮按钮 */
const scrollState = { follow: true };

function chatAtBottom() {
  const c = $('chat');
  return c.scrollHeight - c.scrollTop - c.clientHeight < 48;
}

function updateScrollBtn() {
  const far = !chatAtBottom();
  $('btn-to-bottom').classList.toggle('show', far);
}

function scrollChat(force = false) {
  const c = $('chat');
  if (force) scrollState.follow = true;
  if (scrollState.follow) c.scrollTop = c.scrollHeight;
  updateScrollBtn();
}

// Markdown + LaTeX 实时渲染（markdown.js 先转义再渲染，无注入路径）
function renderMD(text) {
  try { return globalThis.MDRender ? MDRender.render(text) : esc(text); }
  catch { return esc(text); }
}

function setRunStatus(stateName, text) {
  const el = $('run-status');
  el.dataset.state = stateName;
  el.className = `chip status-${stateName}`;
  el.textContent = text;
}

function clearChat() {
  persistSession();          // 旧对话自动存入「对话记录」，随时恢复
  state.sessionId = null;
  state.sessionName = '';
  state.messages = [];
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  $('chat').innerHTML = '';
  setRunStatus('idle', '就绪');
  renderSessionList();
}

function addBubble(role) {
  const empty = $('chat').querySelector('.empty-state');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const who = role === 'user' ? '你' : role === 'assistant' ? '模型' : '错误';
  div.innerHTML = `<div class="who">${who}</div><div class="bubble"></div>`;
  $('chat').appendChild(div);
  scrollChat(true);
  termify(div);
  return div.querySelector('.bubble');
}

function addThinking(beforeEl) {
  const details = document.createElement('details');
  details.className = 'thinking';
  details.open = true;
  details.innerHTML = '<summary>思考过程（模型原生推理，原文照录）</summary><div class="tcontent"></div>';
  beforeEl.before(details); // 挂在模型消息内部：who 之后、回答之前
  return details.querySelector('.tcontent');
}

async function onSend(e) {
  e.preventDefault();
  if (state.running) return;
  const text = $('prompt').value.trim();
  if (!text) return;
  const model = currentModel();
  if (!model) {
    openModelDialog();
    return;
  }

  const payload = {
    modelId: model.id,
    systemPrompt: $('system-prompt').value,
    // 文件显式绑定到本条消息
    messages: [...state.messages, { role: 'user', content: text, fileIds: state.files.map((f) => f.fileId) }],
    temperature: $('temperature').value === '' ? null : Number($('temperature').value),
    maxTokens: $('max-tokens').value === '' ? null : Number($('max-tokens').value),
    timeoutMs: null,
    maxRetries: 0,
    reasoning: {
      enabled: $('reasoning-enabled').checked,
      effort: $('reasoning-effort').value || null,
      budgetTokens: $('reasoning-budget').value === '' ? null : Number($('reasoning-budget').value),
    },
    mode: $('experiment-mode').checked ? 'experiment' : 'chat',
  };

  $('prompt').value = '';
  state.running = true;
  $('btn-send').disabled = true;
  state.messages.push({ role: 'user', content: text, fileIds: state.files.map((f) => f.fileId) });
  persistSession();
  addBubble('user').textContent = text;

  const bubble = addBubble('assistant');
  bubble.classList.add('typing');
  let reasoningEl = null;
  let acc = '';
  const expMeta = [];
  setRunStatus('connecting', '连接中…');

  const handleError = (msg) => {
    bubble.classList.remove('typing');
    bubble.parentElement.classList.add('error');
    bubble.textContent += `\n${msg}`;
    setRunStatus('failed', '失败');
    if (/no API key|未配置 API 密钥|密钥/i.test(msg)) openKeys('还缺少 API 密钥：可在下方填写，或到「管理模型」里为单个模型配置。');
  };

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? String(res.status));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = block.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const ev = JSON.parse(line.slice(5));
        switch (ev.type) {
          case 'message_start':
            setRunStatus('streaming', '流式输出中…');
            break;
          case 'message_delta':
            acc += ev.data.text;
            bubble.innerHTML = renderMD(acc);
            break;
          case 'reasoning_delta':
            setRunStatus('streaming', '推理中…');
            if (!reasoningEl) reasoningEl = addThinking(bubble.parentElement);
            reasoningEl.innerHTML = renderMD((reasoningEl.dataset.raw ?? '') + ev.data.text);
            reasoningEl.dataset.raw = (reasoningEl.dataset.raw ?? '') + ev.data.text;
            break;
          case 'file_read_end':
            if (!ev.data.ok) bubble.textContent += `\n[文件读取失败] ${ev.data.name}: ${ev.data.error}`;
            break;
          case 'error':
            handleError(ev.data.message);
            break;
          case 'message_end': {
            bubble.classList.remove('typing');
            bubble.innerHTML = renderMD(acc);
            const u = ev.data.usage ?? {};
            const t = ev.data.timing ?? {};
            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.textContent =
              `结束原因=${ev.data.finishReason ?? '-'} · 首词元延迟（TTFT）=${t.ttftMs?.toFixed(0) ?? '-'}ms · 总耗时=${t.totalMs?.toFixed(0) ?? '-'}ms · 输入词元=${u.inputTokens ?? '-'} / 输出词元=${u.outputTokens ?? '-'}`;
            bubble.parentElement.appendChild(meta);
            termify(meta);
            state.messages.push({ role: 'assistant', content: acc });
            persistSession();
            setRunStatus(ev.data.completion === 'completed' ? 'done' : 'failed',
              ev.data.completion === 'completed' ? '已完成' : `未完成（${ev.data.completion}）`);
            break;
          }
          case 'experiment_saved':
            expMeta.push(ev.data);
            break;
        }
        scrollChat(); // 跟随模式才滚动；用户上翻时停止跟随并显示悬浮按钮
      }
    }
  } catch (err) {
    handleError(String(err.message ?? err));
  } finally {
    bubble.classList.remove('typing');
    termify($('chat'));
    if (expMeta.length) {
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `实验已保存：<a href="#" data-exp="${esc(expMeta[0].experimentId)}" class="exp-id">${esc(expMeta[0].experimentId)}</a>`;
      meta.querySelector('a').addEventListener('click', (e2) => {
        e2.preventDefault();
        openExperiment(expMeta[0].experimentId);
      });
      bubble.parentElement.appendChild(meta);
    }
    state.running = false;
    $('btn-send').disabled = false;
    refreshExperiments();
  }
}

/* =========================================================================
 * 实验记录
 * ========================================================================= */

async function refreshExperiments() {
  const { experiments } = await (await fetch('/api/experiments')).json();
  try { window.__expCache = experiments; } catch { /* ignore */ }
  $('exp-list').innerHTML = experiments.length
    ? experiments.map((x) => {
      const d = new Date(x.finishedAt * 1000).toLocaleString();
      const stateText = x.completion ?? (x.status === 'ok' ? '已完成' : '失败');
      const name = esc(x.name || '未命名实验');
      const st = x.status === 'ok' ? '<span class="st ok">●</span>' : '<span class="st error">✖</span>';
      return `<li data-id="${esc(x.experimentId)}">
        ${st} <span class="rname" title="${esc(x.experimentId)}">${name}</span> <span class="fineprint">${stateText}</span><br>
        <span class="muted">${esc(d)} · ${x.totalMs?.toFixed(0) ?? '?'}ms · ${x.inputTokens ?? '?'}/${x.outputTokens ?? '?'} 词元</span>
        <div class="acts"><a data-act="open">详情</a><a data-act="restore">恢复为对话</a><a data-act="rename">重命名</a><a data-act="del" class="danger">删除</a></div>
      </li>`;
    }).join('')
    : '<li class="fineprint">暂无实验。发送消息时勾选「保存实验」即生成可复现的实验包。</li>';
  $('exp-list').querySelectorAll('li[data-id]').forEach((li) => {
    li.querySelector('[data-act="open"]').addEventListener('click', () => openExperiment(li.dataset.id));
    li.querySelector('[data-act="restore"]').addEventListener('click', () => restoreFromExperiment(li.dataset.id));
    li.querySelector('[data-act="rename"]').addEventListener('click', () => renameExperiment(li.dataset.id));
    li.querySelector('[data-act="del"]').addEventListener('click', () => deleteExperiment(li.dataset.id));
  });
}

async function renameExperiment(id) {
  const cur = (window.__expCache ?? []).find((x) => x.experimentId === id);
  const name = prompt('给这次实验起个名字：', cur?.name ?? '');
  if (name === null) return;
  const res = await fetch(`/api/experiments/${encodeURIComponent(id)}/rename`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return alert((await res.json()).error ?? '重命名失败');
  refreshExperiments();
}

async function deleteExperiment(id) {
  if (!confirm('删除这个实验包？其全部文件（含原始字节与哈希链）将被移除，不可恢复。')) return false;
  const res = await fetch(`/api/experiments/${encodeURIComponent(id)}/delete`, { method: 'POST' });
  if (!res.ok) { alert('删除失败'); return false; }
  refreshExperiments();
  return true;
}

async function restoreFromExperiment(id) {
  const d = await (await fetch(`/api/experiments/${encodeURIComponent(id)}`)).json();
  const msgs = (d.config?.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content, fileIds: [] })); // 附件需重新上传
  if (!msgs.length) return alert('该实验没有可恢复的对话内容');
  state.sessionId = 'sess-exp-' + id.slice(-10);
  state.sessionName = d.name || (d.prompt ?? '').slice(0, 24);
  state.messages = msgs;
  $('system-prompt').value = d.config?.systemPrompt ?? '';
  renderSession(state.messages);
  setRunStatus('idle', '就绪');
  persistSession();
  $('exp-dialog').close();
}

async function openExperiment(id) {
  const d = await (await fetch(`/api/experiments/${encodeURIComponent(id)}`)).json();
  state.currentExpId = id;
  const v = await (await fetch(`/api/experiments/${encodeURIComponent(id)}/verify`)).json();
  $('exp-title').textContent = d.name || '实验详情';
  $('exp-body').innerHTML = `
    <p><span class="${v.ok ? 'verify-ok' : 'verify-bad'}">${v.ok ? '✓ 校验通过，记录完整' : '✗ 校验失败，记录可能被改动'}</span>
       <span class="fineprint">链根 ${(d.manifest?.chainRoot ?? '').slice(0, 16)}… · 由 Harness v${esc(d.manifest?.harnessVersion ?? '?')} 产生</span></p>
    <h4>系统提示词（发送给模型的原文）</h4><pre>${esc(d.config?.systemPrompt ?? '')}</pre>
    <h4>模型实际看到的输入</h4><pre>${esc(JSON.stringify(d.result?.renderedMessages ?? [], null, 2))}</pre>
    <h4>模型与实际生效配置</h4><pre>${esc(JSON.stringify({ model: d.config?.modelId, provider: d.config?.provider, apiModelId: d.config?.apiModelId, requested: { temperature: d.request?.requestedConfig?.temperature, maxTokens: d.request?.requestedConfig?.maxTokens }, resolved: d.request?.resolvedConfig, temperatureSource: d.config?.temperatureSource }, null, 2))}</pre>
    <h4>最终回答</h4><pre>${esc(d.result?.text ?? '')}</pre>
    <h4>运行指标</h4><pre>状态=${esc(d.result?.status)} 完成状态=${esc(d.result?.completion)} 结束原因=${esc(d.result?.finishReason)} 首词元延迟=${esc(d.result?.ttftMs)}ms 总耗时=${esc(d.result?.totalMs)}ms 词元用量=${esc(JSON.stringify({ 输入: d.result?.usage?.inputTokens, 输出: d.result?.usage?.outputTokens }))} 尝试次数=${esc(d.result?.attempts)} 重试=${esc(d.result?.retries)}</pre>
    <h4>事件流（${(d.events ?? []).length} 条，哈希成链）</h4><pre>${esc((d.events ?? []).map((e) => `${e.seq} ${e.type}`).join('\n'))}</pre>
    <h4>完整性校验明细</h4><pre>${esc(v.checks.map((c) => `${c.ok ? 'OK  ' : 'FAIL'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`).join('\n'))}</pre>`;
  termify($('exp-body'));
  $('exp-dialog').showModal();
}

/* =========================================================================
 * 启动
 * ========================================================================= */

init();
function init() {
  initTheme();
  loadSessionOnBoot();
  refreshModels();
  refreshPresets();
  refreshFiles();
  refreshExperiments();
  refreshKeyDots();

  $('composer').addEventListener('submit', onSend);
  $('chat').addEventListener('scroll', () => {
    scrollState.follow = chatAtBottom(); // 用户上翻 → 暂停自动跟随，显示悬浮按钮
    updateScrollBtn();
  });
  $('btn-to-bottom').addEventListener('click', () => scrollChat(true));
  $('file-input').addEventListener('change', onUpload);
  $('btn-clear').addEventListener('click', clearChat);
  $('model').addEventListener('change', showModelInfo);
  $('system-prompt').addEventListener('change', persistSession);
  $('btn-model-manage').addEventListener('click', () => openModelDialog());
  $('btn-keys').addEventListener('click', () => openKeys());
  $('btn-theme').addEventListener('click', cycleTheme);
  $('keys-save').addEventListener('click', saveKeys);
  $('keys-close').addEventListener('click', () => $('keys-dialog').close());
  $('term-close').addEventListener('click', () => $('term-dialog').close());
  $('exp-close').addEventListener('click', () => $('exp-dialog').close());
  $('exp-restore').addEventListener('click', () => state.currentExpId && restoreFromExperiment(state.currentExpId));
  $('exp-rename').addEventListener('click', () => state.currentExpId && renameExperiment(state.currentExpId));
  $('exp-delete').addEventListener('click', async () => { if (state.currentExpId && (await deleteExperiment(state.currentExpId))) $('exp-dialog').close(); });
  $('term-body').addEventListener('click', finishTerm);
  $('model-close').addEventListener('click', () => $('model-dialog').close());
  $('model-preset').addEventListener('change', applyPreset);
  $('model-existing').addEventListener('change', () => openModelDialog($('model-existing').value || null));
  $('model-test').addEventListener('click', testModelConnection);
  $('model-save').addEventListener('click', saveModelFromDialog);
  $('model-delete').addEventListener('click', deleteModelFromDialog);

  // 术语链接：事件委托，动态内容同样生效
  document.addEventListener('click', (e) => {
    const t = e.target.closest('a.term');
    if (t?.dataset.term) openTerm(t.dataset.term);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList?.contains('term')) {
      e.preventDefault();
      openTerm(e.target.dataset.term);
    }
  });

  $('prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('composer').requestSubmit();
    }
  });

  termify(document.body);

  // 演示钩子（录屏用）：#qa-term 术语说明；#qa-keys 密钥弹窗；#qa-demo 对话形态（纯本地画面）
  const hook = new URLSearchParams(location.hash.slice(1)).get('demo') ?? location.hash.slice(1);
  if (hook === 'qa-term') {
    openTerm('hashchain');
    finishTerm();
  } else if (hook === 'qa-keys') {
    openKeys();
  } else if (hook === 'qa-demo') {
    demoRun();
  }
}

function demoRun() {
  const u = addBubble('user');
  u.textContent = '请用一句话说明：哈希链为什么能发现篡改。';
  const th = document.createElement('details');
  th.className = 'thinking';
  th.open = true;
  th.innerHTML = '<summary>思考过程（模型原生推理，原文照录）</summary><div class="tcontent">演示画面：这里是模型原生推理流的展示位。正式使用时，这里的每一个字都来自模型本身，实验环境不改一字。</div>';
  const a = addBubble('assistant');
  th.remove();
  a.before(th);
  a.innerHTML = renderMD([
    '演示 **Markdown + LaTeX** 实时渲染：',
    '',
    '- 行内公式：质能方程 $E=mc^2$ 与欧拉公式 $e^{i\\pi}+1=0$',
    '- 勾股定理：$a^2 + b^2 = c^2$',
    '',
    '$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$',
    '',
    '| 特性 | 状态 |',
    '|---|---|',
    '| 流式输出 | ✓ |',
    '| 公式渲染 | ✓ |',
  ].join('\n'));
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = '结束原因=stop · 首词元延迟（TTFT）=412ms · 总耗时=2210ms · 输入词元=37 / 输出词元=89';
  a.parentElement.appendChild(meta);
  termify($('chat'));
}
