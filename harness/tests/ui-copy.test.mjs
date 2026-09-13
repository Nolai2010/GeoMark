import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 产品语言回归（需求三十一 / 三十二）：
 *  1) 静态 UI 文件不得出现过度古风的功能命名；
 *  2) 必须使用正式中文技术术语（词元等），不得出现自创替代词。 */

const STATIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'surfaces', 'web', 'static');
const FILES = ['index.html', 'app.js', 'glossary.js', 'style.css'];

// 过度古风 / 拟武侠的功能命名（界面文案中禁止）
const FORBIDDEN = [
  '择器', '出题', '呈卷', '落卷', '落墨', '拂去', '沉吟', '钥匙', '合上',
  '实验录', '卷宗', '封印', '船夫', '天机', '仙机', '灵台', '符箓',
  '修行', '问道', '心法', '法旨', '奉旨', '众生平等',
];

// 自创替代词（正式术语已有规范译名，禁止自造）
const FORBIDDEN_INVENTED = ['模型读写单位', '模型处理单位', '文字单元', '模型处理量'];

test('UI 文案：无过度古风术语', () => {
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(STATIC_DIR, f), 'utf8');
    for (const word of FORBIDDEN) {
      assert.ok(!src.includes(word), `${f} 出现被禁用的古风文案：「${word}」`);
    }
    for (const word of FORBIDDEN_INVENTED) {
      assert.ok(!src.includes(word), `${f} 出现自创替代词：「${word}」，应使用正式术语「词元」`);
    }
  }
});

test('UI 文案：正式中文技术术语在位', () => {
  const app = fs.readFileSync(path.join(STATIC_DIR, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(STATIC_DIR, 'index.html'), 'utf8');
  const glossary = fs.readFileSync(path.join(STATIC_DIR, 'glossary.js'), 'utf8');
  // 正式术语必须存在
  assert.ok(app.includes('词元'), '运行指标应使用「词元」');
  assert.ok(app.includes('流式输出'), '应使用「流式输出」');
  assert.ok(app.includes('实验记录'), '应使用「实验记录」');
  assert.ok(html.includes('系统提示词'), '应使用「系统提示词」');
  assert.ok(html.includes('API 密钥'), '应使用「API 密钥」');
  assert.ok(html.includes('最大词元数'), '应使用「最大词元数」');
  assert.ok(html.includes('模型配置'), '应提供「模型配置」入口');
  assert.ok(glossary.includes('词元（Token）'), '术语表应给出「词元（Token）」规范条目');
  assert.ok(glossary.includes('首词元延迟'), '应使用「首词元延迟（TTFT）」');
  assert.ok(glossary.includes('服务提供商'), '应使用「服务提供商（Provider）」');
  assert.ok(glossary.includes('自定义接口'), '应提供「自定义接口」条目');
  assert.ok(glossary.includes('预设（Preset）'), '应提供「预设（Preset）」条目');
});

test('UI 文案：核心操作命名现代化', () => {
  const html = fs.readFileSync(path.join(STATIC_DIR, 'index.html'), 'utf8');
  for (const modern of ['发送', '清空对话', '关闭', '保存实验', '管理模型', '测试连接', '实验记录', '模型配置']) {
    assert.ok(html.includes(modern), `缺少现代命名：「${modern}」`);
  }
});
