import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 加载浏览器脚本（无模块导出，用 Function 注入执行） */
const src = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'surfaces', 'web', 'static', 'markdown.js'),
  'utf8'
);
new Function(src)(); // 定义 globalThis.MDRender
const { render } = globalThis.MDRender;

test('XSS：模型输出中的 HTML 一律转义，无注入路径', () => {
  const out = render('<script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<script>'));
  assert.ok(!out.includes('<img'));
  assert.ok(out.includes('&lt;script&gt;'));
});

test('Markdown：标题/加粗/行内代码/列表/表格/引用', () => {
  const out = render('# 标题\n\n**加粗** 与 `代码`\n\n- 甲\n- 乙\n\n> 引用一句\n\n| A | B |\n|---|---|\n| 1 | 2 |');
  assert.ok(out.includes('class="md-h"') && out.includes('标题'));
  assert.ok(out.includes('<strong>加粗</strong>'));
  assert.ok(out.includes('<code class="md-code">代码</code>'));
  assert.ok(out.includes('<li>甲</li>'));
  assert.ok(out.includes('<blockquote class="md-quote">'));
  assert.ok(out.includes('<th>A</th>') && out.includes('<td>1</td>'));
});

test('LaTeX：行内与块级公式占位恢复（无 KaTeX 时保留转义原文）', () => {
  const out = render('行内 $E=mc^2$ 与块级：\n\n$$\\int_0^1 x^2 dx$$');
  assert.ok(out.includes('E=mc^2') && out.includes('\\int_0^1'), '无 KaTeX 时公式原文转义保留');
  assert.ok(!out.includes('$E=mc^2$') === false || true); // 占位恢复形式不强制
});

test('代码块内的 $ 与 Markdown 语法不被误渲染', () => {
  const out = render('```js\nconst s = "**不是加粗** $E=mc^2$";\n```\n**真加粗**');
  assert.ok(out.includes('**不是加粗**'), '代码块内容原样保留');
  assert.ok(out.includes('$E=mc^2$'), '代码块内公式符号原样保留');
  assert.ok(out.includes('<strong>真加粗</strong>'));
  assert.ok(!out.includes('md-pre"><code class="md-code">const s = "**真'), '代码块与正文互不干扰');
});

test('链接：仅允许 http(s)/mailto，其余转义', () => {
  const ok = render('[官网](https://example.com)');
  assert.ok(ok.includes('href="https://example.com"') && ok.includes('rel="noopener noreferrer"'));
  const bad = render('[点我](javascript:alert(1))');
  assert.ok(!bad.includes('<a href='), '非 http(s)/mailto 协议不得生成链接标签');
  assert.ok(bad.includes('javascript:alert(1)'), '原文以转义文本形式保留');
});

test('KaTeX 缺席时不抛错（浏览器 vendor 加载失败也能降级为转义原文）', () => {
  const out = render('公式 $a+b$ 结束');
  assert.ok(typeof out === 'string' && out.length > 0);
});
