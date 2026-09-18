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
  sessionId: null, sessionName: '', currentExpId: null, lang: 'zh',
};

// ================= i18n（中文默认，EN 可切换；覆盖静态界面与状态徽标） =================
const I18N = {
  zh: {
    doc_title: '格物台 · GeoMark Harness', brand: '格物台', seal: '格物', poem: '同题共答　千帆竞渡',
    empty_sub: '同一个问题、同一份文件、同一套配置，交给不同的模型。<br>实验环境只负责把条件原样送达每个模型，不做任何偏袒。',
    modelagnostic_note: '（<a class="term" data-term="modelagnostic">模型无关</a>，可随时切换）', sysprompt_note: '（对所有模型完全一致）',
    btn_theme: '主题', theme_light: '亮色', theme_dark: '暗色', theme_system: '主题',
    brand_sub: 'GeoMark Harness · 模型无关的实验环境', btn_keys: 'API 密钥',
    manage_models: '管理模型', sysprompt: '系统提示词', temperature: '温度', maxtokens: '最大词元数',
    legend_reasoning: '推理（模型原生，直接透传）', effort_label: '推理力度 Effort（OpenAI 风格）',
    budget_label: '思考词元预算 Budget（Anthropic 风格）', budget_ph: '如 8192', legend_files: '文件（显式附加，仅读取所选文件）',
    reasoning_enabled: '启用推理（若模型支持）', save_experiment: '保存实验', clear_chat: '清空对话',
    group_model: '模型', group_files: '文件', advanced: '高级参数',
    attach_file: '添加附件', chat_head_note: '同一输入 · 同一配置 · 公平对比', deep_think: '深度思考',
    card_config: '实验配置', card_run: '运行结果', expbundle_word: '实验包',
    run_status: '状态', run_ttft: '首词元延迟', run_total: '总耗时', run_in: '输入词元', run_out: '输出词元',
    set: '已设置', none: '无',
    btn_bench: 'AI 评测', btn_guide: '新手教程', dlg_bench: 'AI 评测（Benchmark）',
    bench_intro: '对当前模型运行题库三模式评测：纯识图 / 可建系 / 不可建系。作答完成后由 judge 模型按评分细则逐项打分，生成对比表。过程需要一些时间与词元消耗。',
    bench_model: '评测模型', bench_modes: '评测模式', m_vision: '纯识图', needs_vision: '需视觉模型',
    m_coord: '可建系', m_pure: '不可建系', bench_scope: '题目范围', scope_all: '全部 10 题',
    scope_plane: '平面几何 GM-0001~0005', scope_solid: '立体几何 GM-0006~0010',
    bench_start: '开始评测', bench_running: '评测进行中…', bench_failed: '评测失败', bench_done: '评测完成',
    onboard_title: '欢迎使用 GeoMark Harness',
    onboard_1: '右上角「API 密钥」粘贴你的密钥（只存本机）',
    onboard_2: '左侧「管理模型」从预设添加模型并测试连接',
    onboard_3: '输入问题发送——每轮对话自动保存为可复现的实验包',
    onboard_4: '想系统了解？打开下方新手教程；想批量评测模型？点击顶栏「AI 评测」。',
    open_guide: '打开新手教程', onboard_ok: '开始使用',
    tut_title: '新手教程', tut_loaded: '加载中…', loading: '加载中…',
    view_table: '对比表', view_raw: 'summary 原文',
    bench_answer: '模型作答全文', bench_score: 'judge 逐项评分', bench_close_detail: '收起详情',
    detail_btn: '查看作答与评分', detail_hint: '提示：点击表格中的分数可查看该题的模型作答全文与 judge 逐项评分理由。',
    skipped_note: '（已跳过：当前模型不支持图像输入）',
    no_vision_hint: '无视觉', pick_mode: '请至少选择一种评测模式',
    rubric_point: '得分点', rubric_score: '得分', rubric_comment: '理由',
    send: '发送', sessions: '对话记录', experiments: '实验记录',
    dlg_keys: 'API 密钥', dlg_model: '模型配置', dlg_exp: '实验详情', close: '关闭',
    save: '保存', delete_model: '删除此模型', test_connection: '测试连接', save_model: '保存模型',
    restore_chat: '恢复为当前对话', exp_default_title: '实验详情',
    sysprompt_ph: '留空则不发送系统提示词', prompt_ph: '输入提示词…（Enter 发送，Shift+Enter 换行）',
    status_idle: '就绪', status_connecting: '连接中…', status_failed: '失败',
    status_streaming: '流式输出中…', status_reasoning: '推理中…', status_done: '已完成', status_aborted: '已停止',
    key_openai_label: 'OpenAI Compatible 协议密钥', key_anthropic_label: 'Anthropic 协议密钥',
    keys_fineprint: '密钥只保存在本机 config/secrets.json（已被 git 忽略），只进内存，绝不写入日志与实验记录。',
    existing_label: '已有模型（选中即编辑其配置）', new_model: '＋ 新建模型',
    preset_label: '从预设开始（仅填充协议、地址与模型 ID，可自由修改）', custom_endpoint: '自定义接口',
    provider_label: '协议类型', name_label: '显示名称', name_ph: '如 DeepSeek', baseurl_label: 'API 地址（Base URL）',
    endpoint_label: '接口路径（可选，默认按协议）', modelid_label: '模型 ID',
    modelkey_label: 'API 密钥（可留空使用全局密钥；只保存在本机）', def_temp: '默认温度', def_max: '默认最大词元数',
    unset_ph: '默认', omit_opt: '（不发送）', supports_reasoning: '该模型支持原生推理',
    extra_label: 'Extra Body（JSON，可选；会原样并入请求体并记录）', rename: '重命名', delete_exp: '删除实验',
    term_footer: '术语说明 · 固定文案，非模型生成',
    unnamed_chat: '未命名对话', unnamed_exp: '未命名实验',
    act_open: '恢复', act_details: '详情', act_restore: '恢复为对话', act_rename: '重命名', act_delete: '删除',
    no_sessions: '暂无对话记录（发送第一条消息后自动保存）',
    no_experiments: '暂无实验。发送消息时勾选「保存实验」即生成可复现的实验包。',
    configured: '已配置', not_configured: '未配置', native_reasoning: ' · 支持原生推理',
    no_models_hint: '尚未配置模型：点击「管理模型」从预设添加',
    finish_reason: '结束原因', ttft: '首词元延迟（TTFT）', total_time: '总耗时', tokens_in: '输入词元', tokens_out: '输出词元', tokens_unit: '词元',
    confirm_del_session: '删除这条对话记录？（不影响已保存的实验包）',
    confirm_del_model: '确定删除模型「{id}」？此操作不会删除已有实验记录。',
    confirm_del_exp: '删除这个实验包？其全部文件（含原始字节与哈希链）将被移除，不可恢复。',
    rename_failed: '重命名失败', delete_failed: '删除失败', nothing_to_restore: '该实验没有可恢复的对话内容',
    verify_ok: '✓ 校验通过，记录完整', verify_bad: '✗ 校验失败，记录可能被改动', chain_root: '链根', produced_by: '由 Harness v{v} 产生',
    h_sysprompt: '系统提示词（发送给模型的原文）', h_rendered: '模型实际看到的输入', h_resolved: '模型与实际生效配置',
    h_final: '最终回答', h_metrics: '运行指标', h_events: '事件流（{n} 条，哈希成链）', h_verify: '完整性校验明细',
    m_status: '状态', m_completion: '完成状态', m_finish: '结束原因', m_ttft: '首词元延迟', m_total: '总耗时',
    m_usage: '词元用量', m_in: '输入', m_out: '输出', m_attempts: '尝试次数', m_retries: '重试',
  },
  en: {
    doc_title: 'GeoMark Studio · GeoMark Harness', brand: 'GeoMark Studio', seal: 'GM', poem: 'Same question, shared answers — a thousand sails race.',
    empty_sub: 'The same question, the same files, the same configuration — handed to different models.<br>The harness only delivers conditions verbatim; it favors no one.',
    modelagnostic_note: ' (Model-agnostic — switch any time)', sysprompt_note: ' (identical for every model)',
    btn_theme: 'Theme', theme_light: 'Light', theme_dark: 'Dark', theme_system: 'Theme',
    brand_sub: 'GeoMark Harness · Model-agnostic experiment environment', btn_keys: 'API Keys',
    manage_models: 'Manage Models', sysprompt: 'System Prompt', temperature: 'Temperature', maxtokens: 'Max Tokens',
    legend_reasoning: 'Reasoning (native, passed through)', effort_label: 'Reasoning effort (OpenAI style)',
    budget_label: 'Thinking budget (Anthropic style)', budget_ph: 'e.g. 8192', legend_files: 'Files (explicit attachments only)',
    reasoning_enabled: 'Enable reasoning (if supported)', save_experiment: 'Save experiment', clear_chat: 'Clear Chat',
    group_model: 'Model', group_files: 'Files', advanced: 'Advanced',
    attach_file: 'Attach files', chat_head_note: 'Same input · same config · fair comparison', deep_think: 'Deep think',
    card_config: 'Configuration', card_run: 'Run results', expbundle_word: 'bundle',
    run_status: 'Status', run_ttft: 'TTFT', run_total: 'Total time', run_in: 'Input tokens', run_out: 'Output tokens',
    set: 'Set', none: 'None',
    btn_bench: 'Benchmark', btn_guide: 'Guide', dlg_bench: 'AI Evaluation (Benchmark)',
    bench_intro: 'Run the item bank against the current model in three modes: vision / coordinate / pure geometry. A judge model then grades each rubric line and produces a comparison table. This takes time and tokens.',
    bench_model: 'Evaluation model', bench_modes: 'Modes', m_vision: 'Vision', needs_vision: 'vision model required',
    m_coord: 'Coordinate', m_pure: 'Pure geometry', bench_scope: 'Scope', scope_all: 'All 10 items',
    scope_plane: 'Plane geometry GM-0001~0005', scope_solid: 'Solid geometry GM-0006~0010',
    bench_start: 'Start', bench_running: 'Running…', bench_failed: 'Failed', bench_done: 'Done',
    onboard_title: 'Welcome to GeoMark Harness',
    onboard_1: 'Paste your key under "API Keys" (top right; stored locally only)',
    onboard_2: 'Add a model from presets in "Manage Models" and test the connection',
    onboard_3: 'Send a prompt — every turn is saved as a reproducible experiment bundle',
    onboard_4: 'Open the guide below to learn more; use "Benchmark" in the top bar for batch evaluation.',
    open_guide: 'Open the Guide', onboard_ok: 'Get started',
    tut_title: 'Getting Started', tut_loaded: 'Loading…', loading: 'Loading…',
    view_table: 'Comparison table', view_raw: 'Raw summary',
    bench_answer: 'Full model answer', bench_score: 'Judge rubric scores', bench_close_detail: 'Hide details',
    detail_btn: 'View answer & scores', detail_hint: 'Tip: click any score in the table to inspect the full model answer and the judge per-line reasoning.',
    skipped_note: '(skipped: current model has no vision input)',
    no_vision_hint: 'no vision', pick_mode: 'Pick at least one mode',
    rubric_point: 'Rubric line', rubric_score: 'Score', rubric_comment: 'Comment',
    send: 'Send', sessions: 'Chat History', experiments: 'Experiment Records',
    dlg_keys: 'API Keys', dlg_model: 'Model Configuration', dlg_exp: 'Experiment Details', close: 'Close',
    save: 'Save', delete_model: 'Delete Model', test_connection: 'Test Connection', save_model: 'Save Model',
    restore_chat: 'Restore as Chat', exp_default_title: 'Experiment Details',
    sysprompt_ph: 'Leave empty to omit the system prompt', prompt_ph: 'Type your prompt… (Enter to send, Shift+Enter for newline)',
    status_idle: 'Ready', status_connecting: 'Connecting…', status_failed: 'Failed',
    status_streaming: 'Streaming…', status_reasoning: 'Reasoning…', status_done: 'Completed', status_aborted: 'Stopped',
    key_openai_label: 'OpenAI-compatible API key', key_anthropic_label: 'Anthropic API key',
    keys_fineprint: 'Keys are stored only in local config/secrets.json (git-ignored), kept in memory, and never written to logs or experiment records.',
    existing_label: 'Existing models (select to edit)', new_model: '＋ New model',
    preset_label: 'Start from a preset (fills protocol, URL and model ID — edit freely)', custom_endpoint: 'Custom endpoint',
    provider_label: 'Protocol', name_label: 'Display name', name_ph: 'e.g. DeepSeek', baseurl_label: 'API address (Base URL)',
    endpoint_label: 'Endpoint path (optional, defaults per protocol)', modelid_label: 'Model ID',
    modelkey_label: 'API key (leave empty to use the global key; stored locally only)', def_temp: 'Default temperature', def_max: 'Default max tokens',
    unset_ph: 'default', omit_opt: '(omit)', supports_reasoning: 'This model supports native reasoning',
    extra_label: 'Extra Body (JSON, optional; merged into the request body and recorded)', rename: 'Rename', delete_exp: 'Delete experiment',
    term_footer: 'Glossary · fixed copy, not model-generated',
    unnamed_chat: 'Untitled chat', unnamed_exp: 'Untitled experiment',
    act_open: 'Restore', act_details: 'Details', act_restore: 'Restore as chat', act_rename: 'Rename', act_delete: 'Delete',
    no_sessions: 'No chat history yet (auto-saved after your first message)',
    no_experiments: 'No experiments yet. Tick "Save experiment" when sending a message to produce a reproducible bundle.',
    configured: 'configured', not_configured: 'not configured', native_reasoning: ' · native reasoning',
    no_models_hint: 'No models yet: click "Manage Models" to add from presets',
    finish_reason: 'Finish', ttft: 'TTFT', total_time: 'Total time', tokens_in: 'In tokens', tokens_out: 'Out tokens', tokens_unit: 'tok',
    confirm_del_session: 'Delete this chat history? (Saved experiment bundles are not affected)',
    confirm_del_model: 'Delete model "{id}"? Existing experiment records are not affected.',
    confirm_del_exp: 'Delete this experiment bundle? All files (raw bytes and hash chain) will be removed. This cannot be undone.',
    rename_failed: 'Rename failed', delete_failed: 'Delete failed', nothing_to_restore: 'This experiment has no restorable conversation',
    verify_ok: '✓ Verification passed, records intact', verify_bad: '✗ Verification failed, records may have been altered', chain_root: 'Chain root', produced_by: 'produced by Harness v{v}',
    h_sysprompt: 'System prompt (verbatim, as sent to the model)', h_rendered: 'What the model actually saw', h_resolved: 'Model & effective configuration',
    h_final: 'Final answer', h_metrics: 'Run metrics', h_events: 'Event stream ({n} entries, hash-chained)', h_verify: 'Integrity verification details',
    m_status: 'Status', m_completion: 'Completion', m_finish: 'Finish reason', m_ttft: 'TTFT', m_total: 'Total time',
    m_usage: 'Token usage', m_in: 'in', m_out: 'out', m_attempts: 'Attempts', m_retries: 'Retries',
  },
};
state.lang = (() => { try { const q = new URLSearchParams(location.search).get('lang'); return q || localStorage.getItem('gm-lang') || 'zh'; } catch { return 'zh'; } })();
// DOM 就绪后应用语言（脚本位于 body 末尾）
function t(key) { return I18N[state.lang]?.[key] ?? I18N.zh[key] ?? ''; }
applyLang();
function fmt(key, map) { return Object.entries(map || {}).reduce((s, [k, v]) => s.split('{' + k + '}').join(v), t(key)); }
function applyLang() {
  document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-CN';
  document.title = t('doc_title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  try { renderSessionList(); showModelInfo(); refreshKeyDots(); refreshExperiments(); } catch { /* boot 期忽略 */ }
  const btn = $('btn-lang');
  if (btn) btn.textContent = state.lang === 'zh' ? 'EN' : '中文';
  const st = $('run-status');
  if (st && st.dataset.textRaw !== undefined) setRunStatus(st.dataset.state, st.dataset.textRaw);
  try { localStorage.setItem('gm-lang', state.lang); } catch { /* ignore */ }
  const g = $('onboard-docs'); if (g) g.href = guideHref();
  const tl = $('btn-guide'); if (tl) tl.textContent = t('btn_guide');
}
$('btn-lang').addEventListener('click', () => { state.lang = state.lang === 'zh' ? 'en' : 'zh'; applyLang(); });

// ================= 新手引导 =================
try {
  if (!localStorage.getItem('gm-onboarded')) {
    setTimeout(() => { try { $('onboard-dialog').showModal(); } catch { /* ignore */ } }, 600);
  }
  $('onboard-docs').addEventListener('click', () => { $('onboard-dialog').close(); openTutorial(); });
$('onboard-ok').addEventListener('click', () => {
    try { localStorage.setItem('gm-onboarded', '1'); } catch { /* ignore */ }
    $('onboard-dialog').close();
  });
} catch { /* ignore */ }
function guideHref() { return '/api/docs/' + (state.lang === 'en' ? 'GETTING-STARTED.en.md' : 'GETTING-STARTED.zh.md'); }

// ================= AI 评测（benchmark） =================
const BENCH_SCOPE_ITEMS = { plane: ['GM-0001','GM-0002','GM-0003','GM-0004','GM-0005'], solid: ['GM-0006','GM-0007','GM-0008','GM-0009','GM-0010'] };
let benchTimer = null;
function openBenchDialog() {
  const opts = state.models.map((m) => `<option value="${esc(m.id)}">${esc(m.displayName)}${m.supportsVision ? '' : ' · ' + t('no_vision_hint')}</option>`).join('');
  $('bench-model').innerHTML = opts;
  const cur = currentModel();
  if (cur) $('bench-model').value = cur.id;
  syncVisionHint();
  $('bench-log').hidden = true; $('bench-result').hidden = true; $('bench-result').innerHTML = '';
  $('bench-msg').textContent = '';
  $('bench-start').disabled = false;
  $('bench-dialog').showModal();
}
function syncVisionHint() {
  const m = state.models.find((x) => x.id === $('bench-model').value);
  $('bench-m-vision').disabled = !m?.supportsVision;
}
$('bench-model').addEventListener('change', syncVisionHint);
$('btn-bench').addEventListener('click', openBenchDialog);
$('bench-close').addEventListener('click', () => $('bench-dialog').close());
$('btn-guide').addEventListener('click', openTutorial);
async function openTutorial() {
  $('tut-dialog').showModal();
  $('tut-content').innerHTML = '<p class="fineprint">…</p>';
  try {
    const md = await (await fetch(guideHref())).text();
    $('tut-content').innerHTML = simpleMd(md);
  } catch (e) {
    $('tut-content').innerHTML = '<p class="fineprint">' + esc(String(e.message || e)) + '</p>';
  }
}
$('tut-close').addEventListener('click', () => $('tut-dialog').close());

$('bench-start').addEventListener('click', async () => {
  const modelId = $('bench-model').value;
  const modes = ['vision', 'coord', 'pure'].filter((m) => $('bench-m-' + m).checked && !$('bench-m-' + m).disabled);
  if (!modes.length) { $('bench-msg').textContent = t('pick_mode'); return; }
  const scope = document.querySelector('input[name="bench-scope"]:checked').value;
  const items = BENCH_SCOPE_ITEMS[scope] || null;
  $('bench-start').disabled = true;
  $('bench-msg').textContent = t('bench_running');
  $('bench-log').hidden = false;
  $('bench-result').hidden = true;
  try {
    const res = await fetch('/api/benchmark/start', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modelId, modes, items }),
    });
    const j = await res.json();
    if (!res.ok) { $('bench-msg').textContent = j.error ?? 'error'; $('bench-start').disabled = false; return; }
    const runId = j.runId;
    window.__benchRunId = runId;
    clearInterval(benchTimer);
    benchTimer = setInterval(async () => {
      const pr = await (await fetch('/api/benchmark/progress?id=' + encodeURIComponent(runId))).json();
      const log = $('bench-log');
      log.textContent = pr.lines.join('\n');
      log.scrollTop = log.scrollHeight;
      if (pr.stage === 'done' || pr.stage === 'fail' || pr.exit !== null) {
        clearInterval(benchTimer);
        $('bench-start').disabled = false;
        if (pr.summaryReady) {
          $('bench-msg').textContent = t('bench_done');
          const s = await (await fetch('/api/benchmark/summary?id=' + encodeURIComponent(runId))).json();
          window.__benchSummary = s;
          $('bench-viewbar').hidden = false;
          $('bench-result').hidden = false;
          $('bench-result').innerHTML = mdTableToHtml(s.markdown) +
            `<p class="fineprint">${t('bench_open_summary')} ${esc(s.outDir)}</p>
             <p class="fineprint">${t('detail_hint')}</p>`;
          const gids = gidsOfSummary(s);
          $('bench-result').querySelectorAll('tr').forEach((row, ri) => {
            if (row.querySelector('th')) return;
            const gid = gids[ri - 1];
            if (!gid) return;
            row.querySelectorAll('td').forEach((td, ci) => {
              if (ci > 2 || td.textContent === '—') return;
              td.dataset.detail = '1'; td.dataset.item = gid; td.dataset.mode = ['vision', 'coord', 'pure'][ci];
              td.style.cursor = 'pointer'; td.title = t('detail_btn');
            });
          });
        } else {
          $('bench-msg').textContent = t('bench_failed');
        }
      }
    }, 1500);
  } catch (e) {
    $('bench-msg').textContent = String(e.message || e);
    $('bench-start').disabled = false;
  }
});

$('bench-v-table').addEventListener('click', () => {
  $('bench-result').hidden = false; $('bench-raw').hidden = true; $('bench-detail').hidden = true;
});
$('bench-v-raw').addEventListener('click', () => {
  $('bench-result').hidden = true; $('bench-detail').hidden = true;
  $('bench-raw').hidden = false;
  $('bench-raw').textContent = window.__benchSummary?.markdown ?? '';
});
$('bench-result').addEventListener('click', async (e) => {
  const cell = e.target.closest('[data-detail]');
  if (!cell) return;
  const { item, mode } = cell.dataset;
  const runId = window.__benchRunId;
  $('bench-detail').hidden = false;
  $('bench-detail').innerHTML = `<p class="fineprint">${t('loading')}</p>`;
  $('bench-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    const d = await (await fetch('/api/benchmark/detail?id=' + encodeURIComponent(runId) +
      '&item=' + encodeURIComponent(item) + '&mode=' + encodeURIComponent(mode))).json();
    const lines = (d.score?.lines || []).map((l) =>
      `<tr><td>${esc(l.point)}</td><td>${esc(String(l.score))}</td><td>${esc(l.comment || '')}</td></tr>`).join('');
    $('bench-detail').innerHTML = `
      <h4>${t('bench_answer')} — ${esc(item)} / ${esc(mode)} <button id="bench-detail-close" class="btn ghost small-btn" type="button">${t('bench_close_detail')}</button></h4>
      <pre>${esc(d.answer || '')}</pre>
      <h4>${t('bench_score')}：${esc(String(d.score?.total ?? '?'))} / ${esc(String(d.score?.max ?? '?'))}</h4>
      <table><tr><th style="width:55%">${t('rubric_point')}</th><th>${t('rubric_score')}</th><th>${t('rubric_comment')}</th></tr>${lines}</table>`;
    $('bench-detail-close').addEventListener('click', () => { $('bench-detail').hidden = true; });
  } catch (err) {
    $('bench-detail').innerHTML = '<p class="fineprint">' + esc(String(err.message || err)) + '</p>';
  }
});

// 极简 Markdown 渲染（教程与 summary 用；输出经转义，无注入路径）
function simpleMd(md) {
  const out = [];
  let inCode = false, code = [];
  for (const line of md.split('\n')) {
    if (/^\`\`\`/.test(line)) {
      if (inCode) { out.push('<pre>' + esc(code.join('\n')) + '</pre>'); code = []; }
      inCode = !inCode; continue;
    }
    if (inCode) { code.push(line); continue; }
    if (/^\|/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (/^\|[\s:|-]+\|?$/.test(line)) continue;
      out.push('<tr>' + cells.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>');
      continue;
    }
    if (out.length && out[out.length - 1] === '</table>') { /* table auto-closed below */ }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); continue; }
    if (/^[-*]\s/.test(line)) { out.push('<li>' + inline(line.replace(/^[-*]\s/, '')) + '</li>'); continue; }
    if (/^\d+\.\s/.test(line)) { out.push('<li>' + inline(line.replace(/^\d+\.\s/, '')) + '</li>'); continue; }
    if (!line.trim()) { out.push(''); continue; }
    out.push('<p>' + inline(line) + '</p>');
  }
  // 包裹连续表格行
  const wrapped = [];
  let tbl = [];
  for (const seg of out) {
    if (seg.startsWith('<tr>')) tbl.push(seg);
    else { if (tbl.length) { wrapped.push('<table>' + tbl.join('') + '</table>'); tbl = []; } wrapped.push(seg); }
  }
  if (tbl.length) wrapped.push('<table>' + tbl.join('') + '</table>');
  return wrapped.filter((x) => x !== '').join('\n');
  function inline(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
}

function gidsOfSummary(s) {
  return Object.keys(s.table || {});
}

// 极简 Markdown 表格渲染（仅用于 summary 呈现）
function mdTableToHtml(md) {
  const lines = md.split('\n').filter((l) => l.trim());
  const out = [];
  let inTable = false;
  for (const l of lines) {
    if (/^\|/.test(l)) {
      const cells = l.split('|').slice(1, -1).map((c) => c.trim());
      if (/^\|[s:|-]+\|?$/.test(l)) continue; // 分隔行
      if (!inTable) { out.push('<table>'); inTable = true; out.push('<tr>' + cells.map((c) => '<th>' + c + '</th>').join('') + '</tr>'); continue; }
      out.push('<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>');
    } else {
      if (inTable) { out.push('</table>'); inTable = false; }
      out.push('<p>' + l.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) + '</p>');
    }
  }
  if (inTable) out.push('</table>');
  return out.join('');
}
// 新手教程链接随语言切换
const _applyLang = applyLang;
applyLang = function (...args2) { _applyLang(...args2); const g = $('onboard-docs'); if (g) g.href = guideHref(); };

/* =========================================================================
 * 会话持久化：刷新后可回到上次对话；对话记录保存在本机 localStorage
 * ========================================================================= */
const SESSION_KEY = 'gm-session';
const SESSIONS_KEY = 'gm-sessions';

function readSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]'); } catch { return []; }
}

function sessionNameOf(s) {
  return s.name || (s.messages.find((m) => m.role === 'user')?.content ?? t('unnamed_chat')).slice(0, 24);
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
  updateConfigSummary();
  renderRunCard();
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
  // v0.6.2：默认打开即新建对话；历史对话从右栏「对话记录」手动恢复
  renderSessionList();
  updateConfigSummary();
  renderRunCard();
}

function renderSessionList() {
  const list = readSessions();
  $('session-list').innerHTML = list.length
    ? list.map((s) => {
      const d = new Date(s.updatedAt).toLocaleString();
      const n = esc(sessionNameOf(s));
      return `<li data-id="${esc(s.id)}" title="${esc(n)}">
        <span class="rname">${n}</span> <span class="fineprint">${esc(d)}</span>
        <div class="acts"><a data-act="open">${t('act_open')}</a><a data-act="rename">${t('act_rename')}</a><a data-act="del" class="danger">${t('act_delete')}</a></div>
      </li>`;
    }).join('')
    :  `<li class="fineprint">${t('no_sessions')}</li>`;
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
      if (!confirm(t('confirm_del_session'))) return;
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
  $('btn-theme').textContent = t('theme_' + theme.mode) || LABELS[theme.mode];
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
      `<i class="${providers['openai-compatible'] ? 'on' : ''}" title="OpenAI Compatible：${providers['openai-compatible'] ? t('configured') : t('not_configured')}"></i>` +
      `<i class="${providers.anthropic ? 'on' : ''}" title="Anthropic：${providers.anthropic ? t('configured') : t('not_configured')}"></i>`;
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
    ? `${m.apiModelId} · ${m.baseUrl}${m.supportsReasoning ? t('native_reasoning') : ''}`
    : t('no_models_hint');
  updateConfigSummary();
}
function updateConfigSummary() {
  const el = $('config-summary');
  if (!el) return;
  const m = currentModel();
  const temp = $('temperature').value;
  const reasoning = $('reasoning-enabled').checked || $('think-toggle').checked;
  const nFiles = $('file-list').children.length;
  const row = (k, v, c) => `<span class="k">${k}</span><span class="v ${c || ''}">${v}</span>`;
  el.innerHTML =
    row(t('model'), esc(m ? (m.displayName || m.id) : t('none'))) +
    row('Provider', esc(m ? m.provider : t('none'))) +
    row(t('temperature'), esc(temp === '' ? t('unset_ph') : temp)) +
    row(t('legend_reasoning'), reasoning ? t('set') : t('omit_opt')) +
    row(t('sysprompt'), $('system-prompt').value.trim() ? t('set') : t('none')) +
    row(t('group_files'), nFiles ? String(nFiles) : t('none'));
}
$('think-toggle').addEventListener('change', () => {
  $('reasoning-enabled').checked = $('think-toggle').checked;
  updateConfigSummary();
});
$('reasoning-enabled').addEventListener('change', () => {
  $('think-toggle').checked = $('reasoning-enabled').checked;
  updateConfigSummary();
});
$('model').addEventListener('change', updateConfigSummary);
$('system-prompt').addEventListener('input', updateConfigSummary);
$('temperature').addEventListener('input', updateConfigSummary);
$('max-tokens').addEventListener('input', updateConfigSummary);
new MutationObserver(updateConfigSummary).observe($('file-list'), { childList: true });

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
  if (!confirm(fmt('confirm_del_model', { id: state.editingModelId }))) return;
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

const STATUS_KEY = { '就绪': 'status_idle', '连接中…': 'status_connecting', '失败': 'status_failed', '流式输出中…': 'status_streaming', '推理中…': 'status_reasoning', '已完成': 'status_done', '已停止': 'status_aborted' };
const runCard = { statusKey: 'status_idle', metrics: null };
function renderRunCard() {
  const el = $('run-summary');
  if (!el) return;
  const m = runCard.metrics || {};
  const cls = runCard.statusKey === 'status_failed' ? 'err' : (runCard.statusKey === 'status_done' ? 'ok' : '');
  const row = (k, v, c) => `<span class="k">${k}</span><span class="v ${c || ''}">${v}</span>`;
  el.innerHTML =
    row(t('run_status'), t(runCard.statusKey) || runCard.statusText || t('status_idle'), cls) +
    row(t('run_ttft'), m.ttft ?? '—') +
    row(t('run_total'), m.total ?? '—') +
    row(t('run_in'), m.in ?? '—') +
    row(t('run_out'), m.out ?? '—');
}
function setRunStatus(stateName, text) {
  const el = $('run-status');
  el.dataset.state = stateName;
  el.className = `chip status-${stateName}`;
  el.dataset.textRaw = text;
  el.textContent = t(STATUS_KEY[text] || '') || text;
  runCard.statusKey = STATUS_KEY[text] || '';
  runCard.statusText = text;
  if (stateName === 'connecting') runCard.metrics = null;
  renderRunCard();
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
  updateConfigSummary();
  renderRunCard();
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
              `${t('finish_reason')}=${ev.data.finishReason ?? '-'} · ${t('ttft')}=${t.ttftMs?.toFixed(0) ?? '-'}ms · ${t('total_time')}=${t.totalMs?.toFixed(0) ?? '-'}ms · ${t('tokens_in')}=${u.inputTokens ?? '-'} / ${t('tokens_out')}=${u.outputTokens ?? '-'}`;
            runCard.metrics = {
              ttft: (t.ttftMs?.toFixed(0) ?? '-') + 'ms',
              total: (t.totalMs?.toFixed(0) ?? '-') + 'ms',
              in: u.inputTokens ?? '—', out: u.outputTokens ?? '—',
            };
            renderRunCard();
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
      const stateText = x.completion ?? (x.status === 'ok' ? t('status_done') : t('status_failed'));
      const name = esc(x.name || t('unnamed_exp'));
      const st = x.status === 'ok' ? '<span class="st ok">●</span>' : '<span class="st error">✖</span>';
      return `<li data-id="${esc(x.experimentId)}">
        ${st} <span class="rname" title="${esc(x.experimentId)}">${name}</span> <span class="fineprint">${stateText}</span><br>
        <span class="muted">${esc(d)} · ${x.totalMs?.toFixed(0) ?? '?'}ms · ${x.inputTokens ?? '?'}/${x.outputTokens ?? '?'} ${t('tokens_unit')}</span>
        <div class="acts"><a data-act="open">${t('act_details')}</a><a data-act="restore">${t('act_restore')}</a><a data-act="rename">${t('act_rename')}</a><a data-act="del" class="danger">${t('act_delete')}</a></div>
      </li>`;
    }).join('')
    :  `<li class="fineprint">${t('no_experiments')}</li>`;
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
  if (!res.ok) return alert((await res.json()).error ?? t('rename_failed'));
  refreshExperiments();
}

async function deleteExperiment(id) {
  if (!confirm(t('confirm_del_exp'))) return false;
  const res = await fetch(`/api/experiments/${encodeURIComponent(id)}/delete`, { method: 'POST' });
  if (!res.ok) { alert(t('delete_failed')); return false; }
  refreshExperiments();
  return true;
}

async function restoreFromExperiment(id) {
  const d = await (await fetch(`/api/experiments/${encodeURIComponent(id)}`)).json();
  const msgs = (d.config?.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content, fileIds: [] })); // 附件需重新上传
  if (!msgs.length) return alert(t('nothing_to_restore'));
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
  $('exp-title').textContent = d.name || t('exp_default_title');
  $('exp-body').innerHTML = `
    <p><span class="${v.ok ? 'verify-ok' : 'verify-bad'}">${v.ok ? t('verify_ok') : t('verify_bad')}</span>
       <span class="fineprint">${t('chain_root')} ${(d.manifest?.chainRoot ?? '').slice(0, 16)}… · ${fmt('produced_by', { v: esc(d.manifest?.harnessVersion ?? '?') })}</span></p>
    <h4>${t('h_sysprompt')}</h4><pre>${esc(d.config?.systemPrompt ?? '')}</pre>
    <h4>${t('h_rendered')}</h4><pre>${esc(JSON.stringify(d.result?.renderedMessages ?? [], null, 2))}</pre>
    <h4>${t('h_resolved')}</h4><pre>${esc(JSON.stringify({ model: d.config?.modelId, provider: d.config?.provider, apiModelId: d.config?.apiModelId, requested: { temperature: d.request?.requestedConfig?.temperature, maxTokens: d.request?.requestedConfig?.maxTokens }, resolved: d.request?.resolvedConfig, temperatureSource: d.config?.temperatureSource }, null, 2))}</pre>
    <h4>${t('h_final')}</h4><pre>${esc(d.result?.text ?? '')}</pre>
    <h4>${t('h_metrics')}</h4><pre>${t('m_status')}=${esc(d.result?.status)} ${t('m_completion')}=${esc(d.result?.completion)} ${t('m_finish')}=${esc(d.result?.finishReason)} ${t('m_ttft')}=${esc(d.result?.ttftMs)}ms ${t('m_total')}=${esc(d.result?.totalMs)}ms ${t('m_usage')}=${esc(JSON.stringify({ [t('m_in')]: d.result?.usage?.inputTokens, [t('m_out')]: d.result?.usage?.outputTokens }))} ${t('m_attempts')}=${esc(d.result?.attempts)} ${t('m_retries')}=${esc(d.result?.retries)}</pre>
    <h4>${fmt('h_events', { n: (d.events ?? []).length })}</h4><pre>${esc((d.events ?? []).map((e) => `${e.seq} ${e.type}`).join('\n'))}</pre>
    <h4>${t('h_verify')}</h4><pre>${esc(v.checks.map((c) => `${c.ok ? 'OK  ' : 'FAIL'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`).join('\n'))}</pre>`;
  termify($('exp-body'));
  $('exp-dialog').showModal();
}

/* =========================================================================
 * 启动
 * ========================================================================= */

init();
function init() {
  initTheme();
  // 数据刷新各自隔离：任一 refresh 抛错都不应连累事件监听注册（否则关闭按钮等会失效）
  for (const fn of [refreshModels, refreshPresets, refreshFiles, refreshExperiments, refreshKeyDots]) {
    try { fn(); } catch (e) { console.error('refresh failed:', e); }
  }

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
  // 关闭按钮兜底：任何带 .close 的按钮关闭其所在 <dialog>，
  // 即使个别专属监听器因故未注册也能正常关闭
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button.close');
    if (b) { const d = b.closest('dialog'); if (d) d.close(); }
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
  meta.textContent = `${t('finish_reason')}=stop · ${t('ttft')}=412ms · ${t('total_time')}=2210ms · ${t('tokens_in')}=37 / ${t('tokens_out')}=89`;
  a.parentElement.appendChild(meta);
  termify($('chat'));
}
