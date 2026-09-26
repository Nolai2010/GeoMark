// GeoMark 作弊检测纯函数库 —— score.mjs 与测试共用
// 四类违规（愿景书评分标准第 3/4 条）：
//   coordinates : 坐标法（仅 pure 模式判罚）
//   cfm         : Coding for Maths —— 作答/思考中出现围栏代码块（```），代码块即作弊（所有模式）
//   websearch   : 声称联网检索（所有模式）
//   skillplugin : 声称加载 Skill Plugin / 外部插件（所有模式）
// 判罚原则：确定性正则与 LLM 审查「取更严」，任一指认即违规；违规 → 总分归零（cheat），
// rubric 原始分保留以便复核。

// ---------- 围栏代码块（CFM） ----------
// 匹配 ``` 开头的围栏块（3 个以上反引号），记录语言标注
const FENCE = /```+\s*([A-Za-z0-9+#.\-]*)[ \t]*\n/g;
const CFM_LANGS = new Set([
  'python', 'py', 'c', 'cpp', 'c++', 'c#', 'cs', 'java', 'node', 'nodejs', 'js', 'javascript',
  'ts', 'typescript', 'rust', 'go', 'golang', 'php', 'ruby', 'perl', 'matlab', 'r', 'swift',
  'kotlin', 'scala', 'bash', 'shell', 'sh', 'powershell', 'ps1',
]);
// 否定语境：作答声明「我不能/不允许使用编程」不是作弊
const NEG_CODE = /(不|无法|不能|不得|禁止|拒绝|没|未|勿|并非|并非是)[^。；\n]{0,12}(编程|代码|程序|计算机求解|用代码)/;

/** 检测围栏代码块。返回 { used, langs, evidence }；langs 为空数组时表示存在无语言标注围栏 */
export function detectCfm(text) {
  const langs = [];
  const evidence = [];
  let m;
  FENCE.lastIndex = 0;
  while ((m = FENCE.exec(text))) {
    const a = Math.max(0, m.index - 12);
    const around = text.slice(a, m.index + m[0].length + 40).replace(/\s+/g, ' ').slice(0, 70);
    if (NEG_CODE.test(text.slice(Math.max(0, m.index - 60), m.index + 60))) continue;
    const lang = (m[1] || '').toLowerCase();
    if (lang && !langs.includes(lang)) langs.push(lang);
    if (evidence.length < 3) evidence.push(around);
    if (langs.length >= 5) break;
  }
  return { used: evidence.length > 0, langs, evidence };
}

/** 无语言标注的围栏也算 CFM 信号（用户决策：代码块即作弊） */
export function hasAnyFence(text) {
  return detectCfm(text).used;
}

// ---------- 联网 / 插件强信号（辅助 LLM 判定） ----------
const STRONG_WEB = [
  /联网(搜索|查询|检索|核实)/, /(web|网络)搜索(结果|引擎)?/, /搜索引擎/,
  /(打开|浏览|访问)(了?)(网页|网站|链接)/, /(搜索|检索)(到|了)[^。；\n]{0,10}(结果|资料|信息)/,
];
const STRONG_PLUGIN = [
  /skill\s*plugin/i, /(加载|调用|启用)(了?)插件/, /外部工具(链)?/, /(调用|运行)(了?)\s*(python|脚本|代码)\s*(求解|计算|验算)?/i,
  /(geogebra|几何画板|desmos)/i,
];
const NEG_WEB = /(不|无需|不能|禁止|没有|无法|未)[^。；\n]{0,10}(联网|搜索|上网|访问|插件|工具)/;

function scanGroup(text, patterns) {
  const hits = [];
  for (const re of patterns) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(text))) {
      const a = Math.max(0, m.index - 18), b = Math.min(text.length, m.index + m[0].length + 18);
      const around = text.slice(a, b).replace(/\s+/g, ' ');
      if (NEG_WEB.test(around)) continue;
      hits.push({ pattern: re.source, snippet: around });
      if (hits.length >= 5) return hits;
    }
  }
  return hits;
}

export function scanWebSearch(text) { return scanGroup(text, STRONG_WEB); }
export function scanPlugin(text) { return scanGroup(text, STRONG_PLUGIN); }

// ---------- 坐标法确定性预扫描（自 score.mjs 迁入，行为不变） ----------
export const STRONG_COORD = [
  /建立(平面)?(直角)?坐标系/, /建系/, /坐标原点/, /以[^，。；\n]{2,14}为原点/,
  /以[^，。；\n]{2,14}为\s*[xyXY]\s*轴/,
  /设[^，。；\n]{0,10}坐标/, /坐标(为|是)?\s*[（(]/,
  /直线方程/, /斜率为/, /斜率\s*[kK]\b/, /解析式/, /两点间距离公式/, /点到直线的距离公式/, /中点坐标公式/,
  /[A-Z][′']?\s*[（(]\s*-?\d/, // A(0,0) 形式
  /[（(]\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*[)）]/,
];
const NEG_COORD = /(不|无需|无|禁止|避免|不使用|不能|未|没有|拒绝|勿)[^。；\n]{0,8}(坐标|建系)/;

export function scanCoordinates(text) {
  const hits = [];
  for (const re of STRONG_COORD) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(text))) {
      const a = Math.max(0, m.index - 18), b = Math.min(text.length, m.index + m[0].length + 18);
      const around = text.slice(a, b);
      if (NEG_COORD.test(around)) continue; // "不使用坐标法" 这类否定语境不计
      hits.push({ pattern: re.source, snippet: around.replace(/\s+/g, ' ') });
      if (hits.length >= 8) return hits;
    }
  }
  return hits;
}

// ---------- 五轨映射（track = f(geometryDimension, mode)） ----------
export const TRACKS = ['vision', 'planar-coord', 'planar-pure', 'solid-coord', 'solid-pure'];
export const TRACK_CN = {
  'vision': 'PNG识图', 'planar-coord': '平面可建系', 'planar-pure': '平面纯几何',
  'solid-coord': '立体可建系', 'solid-pure': '立体纯几何',
};

/** 五个并行对话的轨道判定。dimension 缺失（导入数据集）返回 null，不计入五轨统计。
 *  pure 轨仅对声明 restricted 的题成立（coordinatePolicy !== 'restricted' 的题 pure 不适用，返回 null） */
export function trackOf(dimension, mode, policy) {
  if (mode === 'vision') return 'vision';
  if (mode === 'pure' && policy !== 'restricted') return null;
  if (dimension !== 'planar' && dimension !== 'solid') return null;
  if (mode === 'coord') return `${dimension}-coord`;
  if (mode === 'pure') return `${dimension}-pure`;
  return null;
}
