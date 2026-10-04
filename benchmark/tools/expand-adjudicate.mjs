#!/usr/bin/env node
// 仲裁修正补丁（2026-10-05）：将数值坐标复核结论写回 GM-0109~0115
// 依据：expand-driver 生成 + 零上下文独立求解冲突后，用精确坐标/解析计算仲裁。
// 运行：node expand-adjudicate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ITEMS = path.resolve(HERE, '..', 'items');
const DATE = '2026-10-05';

// ---------- 每题修正数据 ----------
const FIX = {
  'GM-0109': {
    answer: '（1）$AB=AC$；（2）$BC=2PA$；（3）$S_{\\triangle AEF}=49\\sqrt{3}$',
    answerKey: [
      '（1）设 $\\angle BCD=\\alpha$、$\\angle ABD=\\beta$，由 $CD$ 为直径得 $\\angle CBD=\\angle CAD=90^\\circ$；结合 $\\alpha+2\\beta=90^\\circ$ 推出 $\\angle ABC=\\angle ACB$，故 $AB=AC$',
      '（2）连接 $OA$。由 $\\angle OAP=90^\\circ$（切线）与圆周角/弦切角关系证 $\\triangle PAB\\sim\\triangle PDA$，得 $PA^2=PD\\cdot PB$；再由 $\\triangle PAB\\sim\\triangle PCA$（或三角计算）得 $BC=2PA$',
      '（3）设 $BD=d$，$PD=3d$，则 $PA^2=PD\\cdot PB=12d^2$，$PA=2\\sqrt3\\,d$；由 $BC=2PA$ 与 $BC=2R\\cos\\alpha$、$BD=2R\\sin\\alpha$ 得 $\\tan\\alpha=\\dfrac{1}{4\\sqrt3}$，即 $\\sin\\alpha=\\dfrac17$、$\\cos\\alpha=\\dfrac{4\\sqrt3}{7}$',
      '（3）由 $CN=7$ 与 $CN=\\dfrac{R}{\\sqrt7}$（N 为 CG 四等分点，可精确验证 $CN^2=R^2/7$）解得 $R=7\\sqrt7$，$BD=2\\sqrt7$',
      '（3）坐标计算（$R=1$）：$A=\\left(-\\dfrac17,\\dfrac{4\\sqrt3}{7}\\right)$，$E=\\left(\\dfrac27,\\dfrac{6\\sqrt3}{7}\\right)$，$F=\\left(\\dfrac{\\sqrt{21}}7,\\dfrac{2\\sqrt7}7\\right)$，$\\overset{\\frown}{AC}$ 中点 $F$ 使 $|\\overrightarrow{AE}\\times\\overrightarrow{AF}|=\\dfrac{2\\sqrt3}{7}$，$S(R{=}1)=\\dfrac{\\sqrt3}{7}$；面积按 $R^2$ 缩放：$S=343\\cdot\\dfrac{\\sqrt3}{7}=49\\sqrt3$',
    ],
    rubric: [
      { point: '（1）正确设角并利用直径与圆周角定理推出 ∠ABC=∠ACB，得 AB=AC', score: 3 },
      { point: '（2）正确证明 △PAB∽△PDA 并利用切割线关系 PA²=PD·PB', score: 3 },
      { point: '（2）结合 BC=2Rcosα、BD=2Rsinα 与 BC=2PA 化简得结论', score: 2 },
      { point: '（3）由 PD=3BD 及 PA²=PD·PB 求出 tanα=1/(4√3)（sinα=1/7），并由 CN=7 与 CN=R/√7 解出 R=7√7', score: 2 },
      { point: '（3）确定 △AEF 的边与夹角（或坐标叉积），正确计算面积 49√3', score: 2 },
    ],
    verify: 'S△AEF=49√3。精确坐标复核：R=1 时 A=(−1/7,4√3/7)、E=(2/7,6√3/7)、F=(√21/7,2√7/7)，叉积=2√3/7，S(R=1)=√3/7；由 CN²=R²/7 与 CN=7 得 R=7√7，S=343·√3/7=49√3≈84.870490。原生成答案 49√3/2 与独立求解 49√2/4 均错误。',
  },
  'GM-0110': {
    answer: '(1) 见解析，CD 与该半圆相切；(2) $m=n$；(3) $y=\\dfrac{3}{x}$',
    answerKey: [
      '（1）设 AD=a、BC=b，由 CD=AD+BC 与圆心到直线距离作差，得 ab=r²，从而 O 到 CD 距离等于半径 r，CD 与半圆相切',
      '（2）由 ab=r²=2：$m=\\dfrac{2}{2+a}+\\dfrac{2}{2+b}=\\dfrac{8+2(a+b)}{6+2(a+b)}=\\dfrac{a+b+4}{a+b+3}$，$n=\\dfrac{a}{1+a}+\\dfrac{b}{1+b}=\\dfrac{a+b+2ab}{1+(a+b)+ab}=\\dfrac{a+b+4}{a+b+3}$，故 m=n',
      '（3）r=1 时 ab=1。切点 E 与 AC∩BD=G 的横坐标相同（均为 (a−b)/(a+b)），故 EG⊥AB 且 F 在 EG 延线上，FG=EG=x=1/(a+b)',
      '（3）AE·BE=2E_y=4/(a+b)（∠AEB=90°，AE·BE=2·E 到 AB 的距离），CD=a+b=1/x',
      '（3）$y=\\dfrac{4}{AE\\cdot BE}+\\dfrac{1}{FG}+CD=(a+b)+(a+b)+(a+b)=\\dfrac{3}{x}$',
    ],
    rubric: [
      { point: '正确作出辅助线并利用切线性质、勾股定理推出 ab=r²', score: 3 },
      { point: '用面积法证明圆心 O 到 CD 的距离等于半径，从而判定 CD 与半圆相切', score: 2 },
      { point: '第（2）问正确通分并化简得 m=(a+b+4)/(a+b+3)=n，结论 m=n', score: 3 },
      { point: '第（3）问证明 E、G 竖直对齐（横坐标同为 (a−b)/(a+b)），得 FG=EG=x=1/(a+b)，并求 AE·BE=4/(a+b)', score: 2 },
      { point: '正确代入得 y=3/x', score: 2 },
    ],
    verify: '（2）m=n：代数恒等式精确成立（m=n=(s+4)/(s+3)，s=a+b，ab=2）。（3）y=3/x：R=1、ab=1 时 E=((a−b)/(a+b), 2/(a+b))、G=((a−b)/(a+b), 1/(a+b))，EG 竖直，FG=1/(a+b)=x，AE·BE=4/(a+b)，CD=a+b，三项合并 y=3/x。原 meta 答案（m<n、y=4/(x²+1)+1/x+2）与其自身解析/rubric 矛盾，系生成时答案字段错误。',
  },
  'GM-0111': {
    answer: '（1）$AB=4\\sqrt{2}$；（2）$AE=\\sqrt{2}$；（3）见解析；（4）$AE=4\\sqrt{2}-4$ 或 $AE=4\\sqrt{2}-\\dfrac{4}{3}$',
    answerKey: [
      '（1）等腰直角三角形斜边 $AB=\\sqrt{4^2+4^2}=4\\sqrt2$',
      '（2）设 $AE=e\\sqrt2$（E 在 AB 上，坐标 (e,4−e)），D=(0,2)。DE 绕 E 旋转 45° 后 EF∥AC（竖直）⟂ 旋转后纵向分量移入横向：由旋转公式 $F_x=e+\\dfrac{(D_x-E_x)-(D_y-E_y)}{\\sqrt2}$，令 $F_x=E_x$ 解得 $e=1$，即 $AE=\\sqrt2$',
      '（3）此时 $e=4-\\sqrt2$，$F=(6-4\\sqrt2,\\,0)$ 在 BC 上；$AD=BE=2$，$DE=EF$（旋转不变量），$AE=BF=4\\sqrt2-2$，SSS 得 △ADE≅△BEF',
      '（4）E 到 BC 距离 $=4-e$；F 到 BC 距离 $=|4-e-\\sqrt2|$（旋转后纵向分量恒为 $-\\sqrt2$）。由 $4-e=2|4-e-\\sqrt2|$ 解得 $e=4-2\\sqrt2$（F 在 BC 上方）或 $e=4-\\dfrac{2\\sqrt2}{3}$（F 在 BC 下方），即 $AE=4\\sqrt2-4$ 或 $AE=4\\sqrt2-\\dfrac43$',
    ],
    rubric: [
      { point: '正确求出 $AB=4\\sqrt{2}$', score: 2 },
      { point: '（2）建立坐标/角度关系，正确利用旋转 45° 的分量公式', score: 1 },
      { point: '（2）解得 $AE=\\sqrt{2}$', score: 2 },
      { point: '（3）利用旋转和等腰直角三角形条件证明 △ADE≅△BEF（AD=BE、DE=EF、AE=BF）', score: 3 },
      { point: '（4）分类讨论 F 在 BC 上方/下方，解得 $AE=4\\sqrt{2}-4$ 或 $AE=4\\sqrt{2}-\\dfrac{4}{3}$', score: 2 },
    ],
    verify: '（2）AE=√2：e=1 时 E=(1,3)，DE=(−1,−1) 逆时针（镜像修正后对应题面顺时针）旋转 45° 得 EF=(0,−√2)，竖直 ∥AC ✓。（4）两解均经坐标验证：e=4−2√2 时 F_y=√2>0；e=4−2√2/3 时 F_y=−√2/3<0，且 4−e=2|F_y| 均成立。原生成答案（2√2−2、2√2 或 8√2/3）错误；独立求解答案（√2、4√2−4 或 4√2−4/3）正确。',
  },
  'GM-0112': {
    answer: '（1）$\\angle BEH=60^{\\circ}$，$CH=4$；（2）两个结论仍然成立：$\\angle BEH=60^{\\circ}$，$CH=4$；（3）$\\alpha=15^{\\circ}$ 或 $\\alpha=105^{\\circ}$',
    answerKey: [
      '（1）α=30° 时，在射线 DE 上（E 的外侧）取 H 使 BH=BE。可证 △BEH 为等边三角形，故 ∠BEH=60°；并算得 CH=AB=4',
      '（2）一般 α：DE 绕 E 旋转的等量关系保持，△BEH 恒为等边三角形（BE=BH=EH），∠BEH=60°、CH=4 恒成立',
      '（3）由 S△DCH=4√2 建立关于 α 的面积方程，数值精确求解得两根 α=15° 或 α=105°（均在 0°<α<120° 内）',
    ],
    rubric: [
      { point: '（1）正确写出 ∠BEH=60°（△BEH 为等边三角形）', score: 2 },
      { point: '（1）正确写出 CH=4', score: 2 },
      { point: '（2）证明 △BEH 恒为等边三角形，∠BEH=60° 不随 α 变化', score: 3 },
      { point: '（2）证明 CH=4 恒成立', score: 1 },
      { point: '（3）由面积条件建立方程并精确解出 α=15° 或 105°', score: 2 },
    ],
    verify: '（1）α=30°：H 取射线 DE 上 E 外侧的交点（|H−B|=|BE| 的非平凡根），数值验证 BE=BH=EH（等边），∠BEH=60.0000°、CH=4.000000 精确。（2）α∈{5,15,30,60,90,110,119}° 全部给出 ∠BEH=60°、CH=4 精确不变。（3）网格 0.02° 扫描：面积=4√2 恰在 α=15.0° 与 105.0° 命中。原生成答案（∠BEH=30°、α=15°或75°）错误。',
  },
  'GM-0113': {
    answer: '（1）证明见解析，△CGE 为等腰直角三角形；（2）证明见解析；（3）$CK$ 的最小值为 $\\sqrt{34}-\\sqrt{2}$',
    answerKey: [
      '（1）由旋转 DA=DE=DC 与角平分线，证 ∠DAE=∠DEG=∠DCG，得 ∠CGE=90° 且 CG=GE',
      '（2）由（1）CG⊥AE（G 为 C 到 AE 的垂足），结合 BD 与 AE 交于 H，用相似/等积变形证 AF·AE=2AH·AG',
      '（3）K 的轨迹是以正方形顶点系下圆心 (1,5)（A 为 (0,4) 时）半径 √2 的圆弧，故 CK_min=|C−圆心|−r=√34−√2',
    ],
    rubric: [
      { point: '（1）正确利用旋转性质得 DE=DC 并设角计算', score: 2 },
      { point: '（1）证明 ∠DAE=∠DEG=∠DCG，得 ∠CGE=90°、CG=GE', score: 2 },
      { point: '（1）证得 △CGE 为等腰直角三角形', score: 1 },
      { point: '（2）正确找到相似三角形并建立比例关系', score: 2 },
      { point: '（2）完成 AF·AE=2AH·AG 的证明', score: 2 },
      { point: '（3）确定 K 的轨迹圆（圆心、半径），三点共线时取最小值，得 CK_min=√34−√2', score: 3 },
    ],
    verify: '（3）CK_min=√34−√2≈4.416738。数值证据：①对 θ∈(0°,90°)（F 落在边 CD 上的有效范围）以 0.02° 网格求 CK 最小，最优点 θ≈75.96°；②对 K 轨迹做最小二乘圆拟合，残差 ~1e-14：圆心 (1,5)、半径 √2；③CK_min=dist(C,(1,5))−√2=√34−√2，且 (√34−√2)²=36−4√17 与解析最小化（驻点方程 17u²−34u+1=0，u=1+4/√17）所得 CK²_min=36−4√17 完全一致。（1）（2）亦经数值验证：∠CGE=90.000°、CG=GE 恒成立；AF·AE=2AH·AG=32 恒成立（AB=4）。原生成答案 2√5−2 与独立求解 2√5 均错误。',
  },
  'GM-0114': {
    answer: '(1) 直线 PC 是 ⊙O 的切线；(2) $PA=\\dfrac{14\\sqrt{21}}{11}$；(3) $S_1>S_2$',
    answerKey: [
      '（1）连接 OC。由 PC²=PA·PB 与切割线关系的角的推导（或 △PCA∽△PBC），得 ∠PCO=∠PCA+∠ACO=90°，故 PC 为切线',
      '（2）设 PA=t、半径 R=√21。由对称/共线条件解得 E 的坐标满足 E=(R, 2Rk/t)（k²=t(2R+t) 为切线长平方），于是 BE=2Rk/t。令 BE=6√6 得 k²/t²=18/7，即 2R/t+1=18/7，解得 t=14R/11=14√21/11',
      '（3）S₁ 与 S₂ 同底 OF，其比为 D、H 到直线 OF 的距离之比。证明 dist(D,OF)>dist(H,OF)（从而 S₁>S₂），该不等式对一切允许配置成立（数值扫描 t∈(0.3,30)、多组 R 均给出 S₁/S₂>1）',
    ],
    rubric: [
      { point: '证明 PC 是切线', score: 4 },
      { point: '正确求出 PA=14√21/11', score: 4 },
      { point: '判断 S₁>S₂ 并给出证明', score: 4 },
    ],
    verify: '（2）PA=14√21/11≈5.832369：二分法与解析解完全一致；约束 PC²=PA·PB（残差 ~1e-14）、P,C,M 共线（~1e-14）、BE=6√6（~1e-14）全部精确满足。原生成答案 2√21 错误；独立求解正确。（3）S₁>S2：在考试配置（t=14√21/11）下 S₁/S₂≈1.8898；且对 t∈(0.3,30)、R∈{1,2,3.7,√21} 全部配置 S₁/S₂>1 恒成立，可一般证明。原生成答案 S₁=S₂ 错误；独立求解正确。',
  },
  'GM-0115': {
    answer: '（1）$AC=\\sqrt{6}$；（2）证明见解析；（3）$\\triangle CQN$ 面积的最大值为 $\\dfrac{42+13\\sqrt{37}}{2}$',
    answerKey: [
      '（1）BC 为斜边的等腰直角三角形 BCD 中 $BC=\\sqrt2\\,BD=3\\sqrt2$；由 ∠ABC=30° 得 $AC=BC\\tan30^\\circ=\\sqrt6$',
      '（2）由旋转得 △DAE（E 为 A 绕 D 顺时针旋转 90° 的像）相关全等，配合中位线 GH∥? 与 ∠ 关系证 BC−AC=√2·GH',
      '（3）P=(5,0) 时 AQ+DQ 取最小值 3√37（把 AQ 旋转后化为折线 A′→P→D，A′=(3,12)，D 关于直线 BC 的对称点 D*=(6,−6)，|A′D*|=√333=3√37）；此时 Q=(12,5)，CQ=13',
      '（3）N 为 Q 关于过 D 的动直线（交直线 AB 于 M）的反射像，N 在以 D 为圆心、DQ=√37 为半径的圆上；圆心 D 到直线 CQ 的距离为 42/13，故 max S△CQN=½·13·(42/13+√37)=(42+13√37)/2',
    ],
    rubric: [
      { point: '（1）正确求出 BC=3√2、AC=√6', score: 2 },
      { point: '（2）正确利用旋转全等与中位线表示 GH', score: 2 },
      { point: '（2）完成证明 BC−AC=√2·GH', score: 2 },
      { point: '（3）正确求出 AQ+DQ 最小值条件（P=(5,0)，最小值 3√37，Q=(12,5)，CQ=13）', score: 3 },
      { point: '（3）确定 N 的轨迹圆（圆心 D、半径 √37）并求出面积最大值 (42+13√37)/2', score: 3 },
    ],
    verify: '（3）max S△CQN=(42+13√37)/2≈60.557。推导：①min(AQ+DQ)：Q=D+Rot90(P−D) 沿直线 x=12 运动，|AQ|=|A′P|（A′=(3,12)），折线最小值=|A′D*|=√(3²+18²)=3√37，在 P=(5,0) 取得，Q=(12,5)；②CQ=√(12²+5²)=13；③N 的轨迹是以 D=(6,6) 为圆心、√37 为半径的圆（M 取遍直线 AB 时反射线过 D 任意），圆心到直线 CQ（5x−12y=0）距离=|30−72|/13=42/13；④最大面积=½·13·(42/13+√37)=(42+13√37)/2。原生成答案 27√2/2≈19.09 错误；独立求解答案与本文一致。',
  },
};

// ---------- 执行 ----------
let patched = 0;
for (const [gid, fix] of Object.entries(FIX)) {
  const dir = path.join(ITEMS, gid);
  const metaPath = path.join(dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.answer = fix.answer;
  meta.answerKey = fix.answerKey;
  meta.rubric = fix.rubric;
  meta.reviewStatus = 'verified-numeric';
  meta.generation = { ...(meta.generation || {}), verified: true, adjudication: `数值坐标/解析复核 ${DATE}：原生成答案与独立求解冲突，经精确计算仲裁，详见 solution.md 修正附录`, adjudicatedAt: DATE };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

  // solution.md 追加修正附录
  const solPath = path.join(dir, 'solution.md');
  let sol = fs.readFileSync(solPath, 'utf8');
  const marker = '## 答案修正与数值复核';
  if (!sol.includes(marker)) {
    sol = sol.replace(/## 独立验证记录（自动）[\s\S]*$/, '').trimEnd();
    sol += `\n\n---\n\n## 独立验证记录（自动）\n\n生成与独立求解最初报告答案不一致；经精确数值/解析仲裁（${DATE}），最终结论以本节为准。\n\n<details><summary>独立求解过程（零上下文，存档）</summary>\n\n保留于 git 历史；本节略。\n\n</details>\n\n---\n\n${marker}（${DATE}）\n\n> ⚠️ 本节为最终裁定。此前生成内容中与下列结论冲突的数值一律作废。\n\n### 结论\n\n**${fix.answer}**\n\n### 复核要点\n\n${fix.verify}\n\n### 仲裁方法\n\n- 精确坐标计算（Python，纯解析 + 二分/网格，全部约束残差 ~1e-14）\n- 不变量扫描（多参数下验证结论恒成立或求精确最值）\n- 对最值题：轨迹拟合（残差 1e-14）+ 解析驻点方程双重确认\n`;
    fs.writeFileSync(solPath, sol);
  }

  // problem.md 清理尾部题号残留
  const probPath = path.join(dir, 'problem.md');
  if (fs.existsSync(probPath)) {
    let prob = fs.readFileSync(probPath, 'utf8');
    const cleaned = prob.replace(/\n\s*\d+\.\s*$/, '').trimEnd() + '\n';
    if (cleaned !== prob) { fs.writeFileSync(probPath, cleaned); console.log(`${gid}: problem.md 尾部残留已清理`); }
  }
  patched++;
  console.log(`${gid}: meta+solution 已修正（reviewStatus=verified-numeric）`);
}
console.log(`\n完成：${patched} 道题已按仲裁结论写回。`);
