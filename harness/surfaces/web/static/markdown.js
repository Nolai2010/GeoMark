/* 安全的 Markdown + LaTeX 渲染器（零依赖）
 *
 * 安全设计：先对原始文本做 HTML 转义，再在其上做语法替换——
 * 模型输出中的 <script> 等内容只会以转义文本形式出现，不存在注入路径。
 * 链接仅允许 http(s)/mailto。LaTeX 由本地 KaTeX 渲染（trust 关闭）。
 * 无 KaTeX 环境时公式原样保留（转义文本）。
 */
(function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderInline(text) {
    let out = text;
    // 行内代码（先处理，内部不做其他语法）
    out = out.replace(/`([^`\n]+)`/g, (_, c) => `<code class="md-code">${c}</code>`);
    // 链接：仅 http(s)/mailto
    out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
      (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    // 加粗 / 斜体 / 删除线
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    return out;
  }

  function renderMarkdown(escapedText) {
    const lines = escapedText.split('\n');
    const html = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // 围栏代码块
      if (/^```/.test(line)) {
        const lang = esc(line.slice(3).trim());
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // 跳过结束 ```
        const cls = lang ? ` class="md-code lang-${lang}"` : ' class="md-code"';
        html.push(`<pre class="md-pre"><code${cls}>${buf.join('\n')}</code></pre>`);
        continue;
      }
      // 标题
      const h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) { html.push(`<h${h[1].length + 2} class="md-h">${renderInline(h[2])}</h${h[1].length + 2}>`); i++; continue; }
      // 分隔线
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { html.push('<hr class="md-hr">'); i++; continue; }
      // 引用
      if (/^&gt;\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^&gt;\s?/.test(lines[i])) { buf.push(lines[i].replace(/^&gt;\s?/, '')); i++; }
        html.push(`<blockquote class="md-quote">${renderInline(buf.join('<br>'))}</blockquote>`);
        continue;
      }
      // 表格：| a | b |  +  |---|---|
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => renderInline(c.trim()));
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        html.push(`<table class="md-table"><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${
          rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
        continue;
      }
      // 无序 / 有序列表（含缩进续行）
      const ul = /^\s*[-*+]\s+/.test(line);
      const ol = /^\s*\d+[.、]\s+/.test(line);
      if (ul || ol) {
        const tag = ul ? 'ul' : 'ol';
        const items = [];
        while (i < lines.length && (ul ? /^\s*[-*+]\s+/ : /^\s*\d+[.、]\s+/).test(lines[i])) {
          items.push(`<li>${renderInline(lines[i].replace(/^\s*([-*+]|\d+[.、])\s+/, ''))}</li>`);
          i++;
        }
        html.push(`<${tag} class="md-list">${items.join('')}</${tag}>`);
        continue;
      }
      // 空行
      if (line.trim() === '') { i++; continue; }
      // 普通段落（单行即段，聊天场景不聚合）
      html.push(`<p class="md-p">${renderInline(line)}</p>`);
      i++;
    }
    return html.join('\n');
  }

  /** 提取数学段 → 占位符；随后恢复为 KaTeX HTML。 */
  function render(text) {
    if (text == null) return '';
    const mathSegs = [];
    let src = String(text);

    // 1) 先保护围栏代码块与行内代码（其中的 $ 与语法都不处理）
    const codeSegs = [];
    src = src.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => {
      codeSegs.push(m);
      return `\x00CODE${codeSegs.length - 1}\x00`;
    });

    // 2) 提取数学段：$$…$$ / \[…\] / \(…\) / $…$
    src = src.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\w$])\$(?!\s)((?:[^$\n\\]|\\.)+?)(?<!\s)\$(?![\w$])/g,
      (m, dd, br, pr, inl) => {
        const tex = dd ?? br ?? pr ?? inl;
        mathSegs.push({ tex: tex.trim(), display: Boolean(dd || br) });
        return `\x00MATH${mathSegs.length - 1}\x00`;
      });

    // 3) HTML 转义 + Markdown 渲染
    let html = renderMarkdown(esc(src));

    // 4) 恢复代码块（内容已在占位前转义）
    html = html.replace(/\x00CODE(\d+)\x00/g, (_, n) => {
      let seg = codeSegs[Number(n)];
      if (/^```/.test(seg)) {
        const nl = seg.indexOf('\n');
        const body = esc(seg.slice(nl + 1, seg.lastIndexOf('```')));
        return `<pre class="md-pre"><code class="md-code">${body}</code></pre>`;
      }
      return `<code class="md-code">${esc(seg.slice(1, -1))}</code>`;
    });

    // 5) 恢复数学段（KaTeX 本地渲染；不可用时保留转义原文）
    html = html.replace(/\x00MATH(\d+)\x00/g, (_, n) => {
      const seg = mathSegs[Number(n)];
      const katex = globalThis.katex;
      if (katex && typeof katex.renderToString === 'function') {
        try {
          return katex.renderToString(seg.tex, {
            displayMode: seg.display,
            throwOnError: false,
            trust: false,
            output: 'html',
          });
        } catch {
          return `<code class="md-code">${esc(seg.tex)}</code>`;
        }
      }
      return `<code class="md-code">${esc(seg.display ? `$$${seg.tex}$$` : `$${seg.tex}$`)}</code>`;
    });

    return html;
  }

  globalThis.MDRender = { render };
})();
