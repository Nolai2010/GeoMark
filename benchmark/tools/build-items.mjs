#!/usr/bin/env node
// 从转写结果构建 GeoMark 条目（problem.md / solution.md / meta.json）
// 题目来源：第一试卷网(www.shijuan1.com) 免费中考真题；答案与评分要点经独立复核（含数值验证）
// 用法：node benchmark/tools/build-items.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE, '..');
const ITEMS = path.join(BENCH, 'items');

const SRC = '第一试卷网 www.shijuan1.com（免费中考真题）';

const items = [
  {
    id: 'GM-0101', title: '圆的切线判定与线段比值：直径、中位线与切线',
    source: '2026年江苏省苏州市中考数学试题 第25题', region: '江苏苏州', year: 2026,
    topics: ['切线的判定', '直径所对圆周角', '垂直平分线', '三角函数'],
    questionType: '解答题', difficulty: 'hard', policy: 'restricted',
    answer: '（1）见解析（PC ⊥ OC）；（2）① $BC=\\dfrac{4\\sqrt{5}}{5}$；② $\\tan\\angle PEC=\\dfrac{24}{7}$',
    figures: ['assets/figure.png'],
    keyPoints: [
      '$AB$ 为直径 $\\Rightarrow \\angle ACB=90^\\circ$，即 $BC\\perp AC$',
      '$BC\\parallel OP$ 且 $O$ 为 $AB$ 中点 $\\Rightarrow OP$ 垂直平分 $AC$，故 $PA=PC$',
      '$\\triangle OAP\\cong\\triangle OCP\\Rightarrow \\angle OCP=\\angle OAP=90^\\circ$，得 $PC$ 是切线',
      '由 $\\triangle OAP$ 求 $OP=2\\sqrt{5}$，用 $\\triangle OAP\\sim\\triangle$ 关系得 $BC=4\\sqrt{5}/5$',
      '建系（$O$ 为原点，半径 $2$，$P(-2,4)$）求 $E=DP\\cap OC$，得 $\\tan\\angle PEC=24/7$',
    ],
    rubric: [
      { point: '证明 $BC\\perp AC$（直径所对圆周角为直角）并用中位线/垂直平分线推出 $OP\\perp AC$', score: 3 },
      { point: '由 $OP$ 垂直平分 $AC$ 得 $PA=PC$，进而证 $\\triangle OAP\\cong\\triangle OCP$，得出 $\\angle OCP=90^\\circ$，即 $PC$ 是切线', score: 4 },
      { point: '由 $OA=2,PA=4$ 得 $OP=2\\sqrt{5}$，并正确推出 $BC=\\dfrac{4\\sqrt{5}}{5}$', score: 4 },
      { point: '求出 $E$ 点位置并算出 $\\tan\\angle PEC=\\dfrac{24}{7}$', score: 5 },
    ],
    visionRubric: [
      { point: '识别出圆 $\\odot O$ 及其圆心 $O$、圆上三点 $A,B,C$', score: 3 },
      { point: '识别出圆外点 $P$，以及从 $P$ 出发的两条切线（切点 $A$、$C$）', score: 3 },
      { point: '指出 $AB$ 是过圆心 $O$ 的直径，$B$、$C$ 在圆上且 $BC$ 为弦', score: 2 },
      { point: '指出 $D$ 在 $OB$ 上（$B$、$D$、$O$ 共线），连线 $DP$ 与 $OC$ 相交于 $E$', score: 2 },
    ],
  },
  {
    id: 'GM-0102', title: '外接圆与切线：圆周角、弦切角与线段长',
    source: '2025年甘肃省兰州市中考数学试题 第24题', region: '甘肃兰州', year: 2025,
    topics: ['外接圆', '切线的性质', '圆周角定理', '解直角三角形'],
    questionType: '解答题', difficulty: 'hard', policy: 'restricted',
    answer: '（1）见解析；（2）$OD=2\\sqrt{6}$',
    figures: ['assets/figure.png'],
    keyPoints: [
      '$AB$ 为直径 $\\Rightarrow \\angle ACB=90^\\circ$；$BD$ 为切线 $\\Rightarrow AB\\perp BD$，$\\angle ABD=90^\\circ$',
      '$\\angle AEC=\\angle ABC$（同弧 $AC$ 所对圆周角）',
      '$\\angle ADB=90^\\circ-\\angle DAB$，$\\angle ABC=90^\\circ-\\angle BAC$，且 $\\angle DAB=\\angle BAC$，故两角相等',
      '由 $\\cos\\angle AEC=\\cos\\angle ABC=\\dfrac{\\sqrt{5}}{3}$ 得 $BC=\\dfrac{4\\sqrt{5}}{3}$，$AC=\\dfrac{8}{3}$',
      '在 $Rt\\triangle ABD$ 中 $BD=AB\\cdot\\tan\\angle BAC=2\\sqrt{5}$，故 $OD=\\sqrt{OB^2+BD^2}=2\\sqrt{6}$',
    ],
    rubric: [
      { point: '由 $AB$ 为直径得 $\\angle ACB=90^\\circ$，由 $BD$ 为切线得 $AB\\perp BD$', score: 3 },
      { point: '证明 $\\angle AEC=\\angle ABC$（同弧 $AC$ 的圆周角相等），并推出 $\\angle ADB=\\angle AEC$', score: 4 },
      { point: '由 $\\cos\\angle ABC=\\dfrac{\\sqrt{5}}{3}$、$AB=4$ 求出 $BC=\\dfrac{4\\sqrt{5}}{3}$ 与 $AC=\\dfrac{8}{3}$', score: 3 },
      { point: '在 $Rt\\triangle ABD$ 中求出 $BD=2\\sqrt{5}$，并用勾股定理得 $OD=2\\sqrt{6}$', score: 4 },
    ],
    visionRubric: [
      { point: '识别出 $\\odot O$ 是 $\\triangle ABC$ 的外接圆，$A,B,C,E$ 在圆上', score: 3 },
      { point: '指出 $AB$ 是直径，$O$ 为圆心；$B$ 处有切线 $BD$', score: 3 },
      { point: '指出 $D$ 在 $AC$ 的延长线上，且 $D,O,E$ 三点共线（$DE$ 过圆心）', score: 2 },
      { point: '识别出弦 $CE$（连接 $C$ 与 $E$）', score: 2 },
    ],
  },
  {
    id: 'GM-0103', title: '尺规作图与切线半径：直角三角形内的切圆',
    source: '2026年江苏省扬州市中考数学试题 第26题', region: '江苏扬州', year: 2026,
    topics: ['尺规作图', '切线的判定与性质', '垂直平分线', '解直角三角形'],
    questionType: '作图+解答题', difficulty: 'hard', policy: 'restricted',
    answer: '（1）见解析（作法与理由）；（2）半径 $r=\\dfrac{3\\sqrt{5}}{4}$',
    figures: ['assets/figure.png'],
    keyPoints: [
      '在射线 $CA$ 上取 $D$ 使 $CD=\\dfrac{BC^2}{AC}$（尺规作第四比例项）',
      '作线段 $AD$ 的垂直平分线交 $AB$ 于 $O$，则 $OA=OD$，$D$ 在 $\\odot O$ 上',
      '$AC=4$、$\\tan\\angle BAC=\\dfrac{1}{2}$ 得 $BC=2$，$AB=2\\sqrt{5}$，$CD=\\dfrac{BC^2}{AC}=1$，故 $AD=3$',
      '设半径 $r$，由 $AD=2r\\cos\\angle BAC$ 得 $r=\\dfrac{AD}{2\\cos\\angle BAC}=\\dfrac{3\\sqrt{5}}{4}$',
      '可用坐标复核：$A(4,0),B(0,2),C(0,0),D(1,0),O(2.5,0.75)$，$OD\\perp BD$ 成立',
    ],
    rubric: [
      { point: '给出可行作法（确定 $D$ 与 $O$），并写出必要文字说明、保留作图痕迹', score: 4 },
      { point: '说明理由：由垂直平分线得 $OA=OD$，即 $D$ 在 $\\odot O$ 上且圆心在 $AB$ 上', score: 3 },
      { point: '由 $AC=4$、$\\tan\\angle BAC=\\dfrac{1}{2}$ 正确求出 $BC=2$、$AB=2\\sqrt{5}$', score: 3 },
      { point: '求出半径 $r=\\dfrac{3\\sqrt{5}}{4}$', score: 4 },
    ],
    visionRubric: [
      { point: '识别出 $Rt\\triangle ABC$（$\\angle ACB=90^\\circ$）', score: 3 },
      { point: '识别出圆 $\\odot O$，圆心 $O$ 在边 $AB$ 上，圆经过 $A$', score: 3 },
      { point: '指出 $D$ 在边 $AC$ 上且也在圆上（$AD$ 为弦）', score: 2 },
      { point: '指出 $BD$ 与圆相切（切点为 $D$）', score: 2 },
    ],
  },
  {
    id: 'GM-0104', title: '尺规作图与二倍角：矩形中的角度关系',
    source: '2026年福建省中考数学真题 第20题', region: '福建', year: 2026,
    topics: ['尺规作图', '矩形的性质', '二倍角', '解直角三角形'],
    questionType: '作图+解答题', difficulty: 'hard', policy: 'restricted',
    answer: '（1）见解析；（2）$AF=3$',
    figures: ['assets/figure.png'],
    keyPoints: [
      '由 $AB=4,BC=6,DE=2$ 得 $\\tan\\angle EBC=\\dfrac{DE}{AB}$ 相关比例，$\\tan\\angle EBC=\\dfrac{1}{2}$',
      '$\\angle AFB=2\\angle EBC$，故 $\\tan\\angle AFB=\\dfrac{2\\tan\\angle EBC}{1-\\tan^2\\angle EBC}=\\dfrac{4}{3}$',
      '在 $Rt\\triangle ABF$ 中 $\\dfrac{AB}{AF}=\\tan\\angle AFB$，得 $AF=\\dfrac{4}{4/3}=3$',
      '复核：$AF=3,AB=4\\Rightarrow FB=5$，$\\cos\\angle AFB=\\dfrac{AF^2+FB^2-AB^2}{2\\cdot AF\\cdot FB}=0.6$，即 $\\angle AFB\\approx53.13^\\circ=2\\angle EBC$',
    ],
    rubric: [
      { point: '正确作出点 $F$（尺规作图，保留痕迹），使其满足 $\\angle AFB=2\\angle EBC$', score: 4 },
      { point: '由已知数据算出 $\\tan\\angle EBC=\\dfrac{1}{2}$', score: 3 },
      { point: '由二倍角公式得 $\\tan\\angle AFB=\\dfrac{4}{3}$', score: 3 },
      { point: '在 $Rt\\triangle ABF$ 中求得 $AF=3$', score: 4 },
    ],
    visionRubric: [
      { point: '识别出矩形 $ABCD$（$AB<BC$）及顶点顺序', score: 3 },
      { point: '识别出点 $E$ 在 $AD$ 的延长线上（$A,D,E$ 共线）', score: 3 },
      { point: '指出 $AB$ 是矩形较短边，$BC$ 为较长边', score: 2 },
      { point: '指出 $DE$ 是 $AD$ 延长线上的一段（矩形外）', score: 2 },
    ],
  },
  {
    id: 'GM-0105', title: '最短路径与费马点：到两点及直线距离之和最小',
    source: '2026年江苏省连云港市中考数学试题 第27题', region: '江苏连云港', year: 2026,
    topics: ['最短路径', '等边三角形与旋转', '圆周角定理', '矩形中的最值'],
    questionType: '解答题', difficulty: 'hard', policy: 'restricted',
    answer: '（1）① $\\angle APD$（即 $60^\\circ$）；② 两点之间线段最短；（2）最小值 $4+3\\sqrt{3}$',
    figures: ['assets/figure-1.png', 'assets/figure-2.png'],
    keyPoints: [
      '① 填 $\\angle APD$：$A,P,C,D$ 共圆，$\\angle APD$ 与 $\\angle ACD$ 同弧 $AD$，$\\triangle ACD$ 为等边三角形故 $\\angle ACD=60^\\circ$',
      '② 填「两点之间线段最短」',
      '(2) 设 $P$ 到 $l$ 的距离为 $y$，由对称性 $x$ 取 $EF$ 中点，令 $PA+PB=2\\sqrt{3^2+(y-4)^2}$',
      '对 $f(y)=2\\sqrt{9+(y-4)^2}+y$ 求导：$\\dfrac{2(4-y)}{\\sqrt{9+(y-4)^2}}=1\\Rightarrow 4-y=\\sqrt{3}$',
      '最小值 $=2\\sqrt{12}+(4-\\sqrt{3})=4+3\\sqrt{3}\\approx9.196$',
    ],
    rubric: [
      { point: '(1) 正确填出 ① $\\angle APD$、② 两点之间线段最短', score: 4 },
      { point: '(2) 指出 $P$ 应取在 $EF$ 的中垂线上（对称性），设出 $P$ 到直线 $l$ 的距离并列出目标函数', score: 4 },
      { point: '正确求出最小值 $4+3\\sqrt{3}$（并说明取等条件）', score: 6 },
    ],
    visionRubric: [
      { point: '识别图1中的锐角三角形 $ABC$ 及以 $AC$ 为边向外作的等边三角形 $ACD$', score: 3 },
      { point: '指出点 $P$ 是 $BD$ 与 $\\odot O$ 的交点（$\\odot O$ 为 $\\triangle ACD$ 的外接圆）', score: 3 },
      { point: '识别图2中的直线 $l$、垂直于 $l$ 的线段 $AE$、$BF$（长度相等）以及 $EF$', score: 3 },
      { point: '指出 $A$、$B$ 位于直线 $l$ 同侧，$E$、$F$ 为垂足', score: 1 },
    ],
  },
  {
    id: 'GM-0106', title: '矩形中的中点与角平分线：定比与线段比',
    source: '2025年江苏省南通市中考数学试卷 第25题', region: '江苏南通', year: 2025,
    topics: ['矩形', '三角形中位线', '角平分线', '比例线段'],
    questionType: '解答题', difficulty: 'hard', policy: 'restricted',
    answer: '（1）见解析（$AG=2GC$）；（2）① $2$；② $\\dfrac{EF}{BC}=\\dfrac{2}{3}$',
    figures: ['assets/figure.png'],
    keyPoints: [
      '$M$ 为 $BC$ 中点，$O$ 为对角线交点（即 $AC$ 中点），在 $\\triangle ABC$ 中 $OM\\parallel AB$，$DM$ 交 $AC$ 于 $G$',
      '由中位线定理与相似，得 $AG:GC=2:1$',
      '① $AB=6,BC=8$：内角平分线交点为内心，由坐标 $A(0,0),B(6,0),C(6,8),D(0,8)$ 求得 $I(4,6)$，故 $I$ 到 $BC$（直线 $x=6$）的距离为 $2$',
      '② $AB+AC=2BC\\Rightarrow AB:BC:AC=3:4:5$；取 $AB=3,BC=4,AC=5$ 得 $I(2,3)$ 与 $G(2,8/3)$，直线 $GI$ 为 $x=2$',
      '由 $x=2$ 与 $BD$、$CD$ 求交点得 $EF=\\dfrac{8}{3}$，故 $\\dfrac{EF}{BC}=\\dfrac{2}{3}$',
    ],
    rubric: [
      { point: '(1) 利用中位线/相似证明 $AG=2GC$', score: 4 },
      { point: '① 由角平分线交点为内心求出 $I(4,6)$，得到 $I$ 到 $BC$ 的距离为 $2$', score: 4 },
      { point: '② 由 $AB+AC=2BC$ 推出三边比 $3:4:5$', score: 3 },
      { point: '② 求出 $E,F$ 位置并算出 $\\dfrac{EF}{BC}=\\dfrac{2}{3}$', score: 4 },
    ],
    visionRubric: [
      { point: '识别出矩形 $ABCD$ 及其对角线 $AC$、$BD$ 交于点 $O$', score: 3 },
      { point: '指出 $M$ 是边 $BC$ 的中点', score: 3 },
      { point: '指出线段 $DM$ 与对角线 $AC$ 交于点 $G$', score: 2 },
      { point: '指出点 $I$ 为角平分线的交点（位于三角形内部）', score: 2 },
    ],
  },
  {
    id: 'GM-0107', title: '最短路径的图形变化：对称与两点间线段最短',
    source: '2026年贵州省中考数学试题 第24题', region: '贵州', year: 2026,
    topics: ['最短路径', '轴对称', '两点之间线段最短', '解三角形'],
    questionType: '解答题', difficulty: 'hard', policy: 'restricted',
    answer: '（1）作点 $A$ 关于 $l$ 的对称点 $A\'$，连 $A\'B$ 交 $l$ 于 $P$；（2）两点之间线段最短；（3）$EF=1$',
    figures: ['assets/figure.png'],
    keyPoints: [
      '(1) 作 $A$ 关于直线 $l$ 的对称点 $A\'$，连接 $A\'B$ 与 $l$ 的交点即为 $P$',
      '(2) 依据：两点之间线段最短',
      '(3) 取 $B$ 为原点、$BC$ 沿 $x$ 轴，$C(2\\sqrt{3},0)$，$E(\\sqrt{3},0)$，$BD$ 方向与 $BC$ 成 $30^\\circ$，设 $F=s(\\cos30^\\circ,\\sin30^\\circ)$',
      '$EF^2=s^2-3s+3$，$CF^2=s^2-6s+12$；令 $f(s)=\\sqrt{s^2-3s+3}+\\sqrt{s^2-6s+12}$，$f\'(s)=0$ 得 $s=2$',
      '$s=2$ 时 $EF+CF=3$ 最小，此时 $EF=\\sqrt{4-6+3}=1$',
    ],
    rubric: [
      { point: '(1) 正确作出点 $P$（作轴对称点后连线取交点）', score: 3 },
      { point: '(2) 填「两点之间线段最短」', score: 2 },
      { point: '(3) 用坐标或几何方法把 $EF+CF$ 化为单变量函数', score: 4 },
      { point: '(3) 求出最小值位置并得到 $EF=1$', score: 5 },
    ],
    visionRubric: [
      { point: '识别图①中直线 $l$ 及其异侧两点 $A$、$B$', score: 3 },
      { point: '识别图②中四边形 $ABCD$ 与对角线 $BD$，指出 $E$ 是 $BC$ 中点', score: 3 },
      { point: '识别图③中的四边形 $ABCD$（$AD\\parallel BC$）、$BD=CD$ 的标记与 $CE\\perp BD$ 的直角记号', score: 3 },
      { point: '指出 $\angle DBC=30^\\circ$ 等角度标注位置', score: 1 },
    ],
  },
  {
    id: 'GM-0108', title: '旋转与面积：直角三角形绕直角顶点旋转',
    source: '2025年江苏省徐州市中考数学真题 第28题', region: '江苏徐州', year: 2025,
    topics: ['旋转', '面积关系', '三点共线', '最值'],
    questionType: '解答题', difficulty: 'hard', policy: 'restricted',
    answer: '（1）$S_{\\triangle AOD}=S_{\\triangle BOC}$（面积相等）；（2）见解析；（3）最大值 $S_{\\max}=25$',
    figures: ['assets/figure.png'],
    keyPoints: [
      '设 $OA=x,OB=y$（$x^2+y^2=25$），旋转角为 $\\varphi$，取 $A(x,0),B(0,y),C(x\\cos\\varphi,x\\sin\\varphi),D(-y\\sin\\varphi,y\\cos\\varphi)$',
      '(1) $S_{\\triangle AOD}=\\dfrac12 xy\\cos\\varphi=S_{\\triangle BOC}$（$|\\sin(90^\\circ\\pm\\varphi)|=|\\cos\\varphi|$），故面积相等',
      '(2) 用向量/中点公式表示 $P,Q,R$，证明 $\\overrightarrow{PQ}$ 与 $\\overrightarrow{PR}$ 共线',
      '(3) 四边形 $ABCD$ 面积 $S=xy(1-\\cos\\varphi)$，故 $S\\le 2xy\\le x^2+y^2=25$',
      '当 $x=y=\\dfrac{5\\sqrt{2}}{2}$ 且 $\\varphi=180^\\circ$ 时取到 $S_{\\max}=25$',
    ],
    rubric: [
      { point: '(1) 得出 $S_{\\triangle AOD}=S_{\\triangle BOC}$ 并说明理由（旋转对应边长相等 + 等角）', score: 4 },
      { point: '(2) 建立坐标或向量表示 $P,Q,R$ 并证明三点共线', score: 4 },
      { point: '(3) 用对角线或坐标导出四边形面积 $S=xy(1-\\cos\\varphi)$', score: 4 },
      { point: '(3) 求出最大值 $S_{\\max}=25$', score: 3 },
    ],
    visionRubric: [
      { point: '识别两个共直角顶点的直角三角形（$Rt\\triangle AOB$ 与旋转后的 $Rt\\triangle COD$）', score: 3 },
      { point: '指出旋转中心是 $O$（直角顶点），$A\\to C$、$B\\to D$ 是对应点', score: 3 },
      { point: '识别出四条连线段 $AD,BC,AC,BD$ 以及它们的交点 $E$', score: 2 },
      { point: '指出 $OA\\perp OB$ 的直角记号位于点 $O$', score: 2 },
    ],
  },
];

const REQ_SOLVE = '**作答要求**：写出完整、严谨的推理过程；每一步须注明所用定理或性质；数值答案须给出精确值（可含根号、分数），不得只给近似小数。';
const REQ_DRAW = '**作答要求**：作图题须保留作图痕迹并写出必要的文字说明；证明与计算须写出完整推理过程，每一步注明所用定理；数值答案须给出精确值。';

const BODIES = {
  'GM-0101': {
    requirement: REQ_SOLVE,
    problemBody: String.raw`如图，$P$ 是以 $AB$ 为直径的 $\odot O$ 外一点，$C$ 为 $\odot O$ 上的一点，$PA$ 是 $\odot O$ 的切线，$BC\parallel OP$，$D$ 为 $OB$ 的中点，连接 $DP$ 交 $OC$ 于 $E$．

（1）求证：$PC$ 是 $\odot O$ 的切线；

（2）若 $OA=2$，$PA=4$．
①求 $BC$ 的长；
②求 $\tan\angle PEC$ 的值．`,
  },
  'GM-0102': {
    requirement: REQ_SOLVE,
    problemBody: String.raw`如图，$\odot O$ 是 $\triangle ABC$ 的外接圆，$AB$ 是 $\odot O$ 的直径，过点 $B$ 的切线交 $AC$ 的延长线于点 $D$，连接 $DO$ 并延长，交 $\odot O$ 于点 $E$，连接 $AE$，$CE$．

（1）求证：$\angle ADB=\angle AEC$；

（2）若 $AB=4$，$\cos\angle AEC=\dfrac{\sqrt{5}}{3}$，求 $OD$ 的长．`,
  },
  'GM-0103': {
    requirement: REQ_DRAW,
    problemBody: String.raw`如图，在 $\triangle ABC$ 中，$\angle ACB=90^\circ$，$\angle ABC>\angle BAC$．以 $AB$ 边上的点 $O$ 为圆心，$OA$ 长为半径的 $\odot O$ 与 $AC$ 边的另一交点为 $D$，$BD$ 为 $\odot O$ 的切线．

（1）请用无刻度的直尺和圆规作出符合条件的 $\odot O$（保留作图痕迹，写出必要的文字说明）；

（2）若 $AC=4$，$\tan\angle BAC=\dfrac{1}{2}$，求 $\odot O$ 的半径．`,
  },
  'GM-0104': {
    requirement: REQ_DRAW,
    problemBody: String.raw`如图，四边形 $ABCD$ 是矩形，$AB<BC$，点 $E$ 在 $AD$ 的延长线上．

（1）求作点 $F$，使点 $F$ 在 $AD$ 边上，且 $\angle AFB=2\angle EBC$；（要求：尺规作图，不写作法，保留作图痕迹）

（2）在（1）的条件下，若 $AB=4$，$BC=6$，$DE=2$，求 $AF$ 的长．`,
  },
  'GM-0105': {
    requirement: REQ_SOLVE,
    problemBody: String.raw`【问题情境】

（1）在锐角 $\triangle ABC$ 中，求作一点 $P$，使 $PA+PB+PC$ 的值最小．

下面是小明对该问题的一种解决方法及简要说理．

如图1，以 $AC$ 为边向外作等边三角形 $ACD$，再作 $\triangle ACD$ 的外接圆 $\odot O$，连接 $BD$，与 $\odot O$ 交于点 $P$．则点 $P$ 即为求作的点．在 $PD$ 上取一点 $P'$，使 $PP'=AP$，连接 $AP'$．在 $\odot O$ 中，根据「同弧所对的圆周角相等」，得 $\angle APP'=$ ① $=60^\circ$，故 $\triangle APP'$ 是等边三角形．所以 $AP=PP'$．进而可证得 $\triangle ADP'\cong\triangle ACP$．所以 $CP=DP'$．所以 $PB+PA+PC=BP+PP'+P'D=BD$．由 ②（从「两点之间线段最短」和「垂线段最短」中选择填空）可得，$BD$ 的长即为 $PA+PB+PC$ 的最小值．

【方法迁移】

（2）如图2，已知点 $A$，$B$ 到直线 $l$ 的距离 $AE=BF=4$，$EF=6$．在图中找一点 $P$，使点 $P$ 到点 $A$、点 $B$、直线 $l$ 的距离之和最小，简要说明作法，并求出最小值．

【拓展应用】

（3）若村庄 $A,B,C,D$ 的连线构成一个矩形，且 $AB=a$，$BC=b$（$a<b<3a$）．现要在矩形区域内铺设天然气管道，使四个村庄能够连接互通起来．请你设计管道路线总长最短的铺设方案（不需要说明理由），并直接写出路线总长（用含 $a,b$ 的代数式表示）．`,
  },
  'GM-0106': {
    requirement: REQ_SOLVE,
    problemBody: String.raw`如图，矩形 $ABCD$ 中，对角线 $AC,BD$ 相交于点 $O$．$M$ 是 $BC$ 的中点，$DM$ 交 $AC$ 于点 $G$．

（1）求证：$AG=2GC$；

（2）设 $\angle BCD,\angle BDC$ 的角平分线交于点 $I$．
①当 $AB=6,BC=8$ 时，求点 $I$ 到 $BC$ 的距离；
②若 $AB+AC=2BC$，作直线 $GI$ 分别交 $BD,CD$ 于 $E,F$ 两点，求 $\dfrac{EF}{BC}$ 的值．`,
  },
  'GM-0107': {
    requirement: REQ_SOLVE,
    problemBody: String.raw`小红学习了最短路径的知识后，对图形的变化探究如下：

【动手操作】如图①，在直线 $l$ 的两侧有两点 $A$，$B$，小红要在直线 $l$ 上确定一点 $P$，使 $AP+BP$ 最短．

（1）请帮小红确定点 $P$ 的位置，并画出图形；

（2）解决该问题的依据是________；

【问题探究】

（3）如图②，在四边形 $ABCD$ 中，点 $E$ 是边 $BC$ 的中点，点 $F$ 是对角线 $BD$ 上一个动点，连接 $EF$，$CF$，$\angle DBC=30^\circ$，$BC=2\sqrt{3}$，当 $EF+CF$ 的值最小时，求线段 $EF$ 的长；

【拓展延伸】

（4）如图③，在四边形 $ABCD$ 中，$AD\parallel BC$，$BD=CD$，$CE\perp BD$，垂足为 $E$，$\angle A=2\angle ADB$，$AD=1$，$AB=3$，若点 $P$ 是线段 $BC$ 垂直平分线上的一个动点，连接 $BP$，$EP$．确定点 $P$ 的位置使 $\triangle BPE$ 周长最小，并求出该周长的最小值．`,
  },
  'GM-0108': {
    requirement: REQ_SOLVE,
    problemBody: String.raw`如图1，将 $Rt\triangle AOB$ 绕直角顶点 $O$ 旋转至 $\triangle COD$，点 $A$，$B$ 的对应点分别为 $C$，$D$．连接 $AD,BC,AC,BD$，直线 $AC$ 与 $BD$ 交于点 $E$．

（1）$\triangle AOD$ 与 $\triangle BOC$ 的面积存在怎样的数量关系？请说明理由；

（2）如图2，连接 $OE$，若 $AB,CD,OE$ 的中点分别为 $P,Q,R$．求证：$P,Q,R$ 三点共线；

（3）已知 $AB=5$，随着 $OA,OB$ 及旋转角的变化，若存在以 $A,B,C,D$ 为顶点的四边形，其面积为 $S$，则 $S$ 的最大值为_______．`,
  },
};

for (const it of items) {
  const b = BODIES[it.id];
  if (!b) throw new Error('缺少题面正文: ' + it.id);
  it.problemBody = b.problemBody;
  it.requirement = b.requirement;
}

let n = 0;
for (const it of items) {
  const dir = path.join(ITEMS, it.id);
  fs.mkdirSync(dir, { recursive: true });

  const problem = [
    `# ${it.id}`,
    '',
    `> 知识范围：初中数学 · ${it.topics.slice(0, 3).join(' / ')}`,
    `> 来源：${it.source}（${SRC}）`,
    '',
    ...it.figures.map(f => `![题目配图](${f})`),
    '',
    it.problemBody,
    '',
    '---',
    '',
    it.requirement,
    '',
  ].join('\n');

  const solution = [
    `# ${it.id} 解析`,
    '',
    '## 答案',
    '',
    it.answer,
    '',
    '## 标准解（关键步骤）',
    '',
    ...it.keyPoints.map((k, i) => `${i + 1}. ${k}`),
    '',
    '## 评分要点',
    '',
    ...it.rubric.map((r, i) => `${i + 1}. （${r.score} 分）${r.point}`),
    '',
    `> 说明：本题答案与关键步骤经独立复核（含数值验证）。来源：${it.source}。`,
    '',
  ].join('\n');

  const meta = {
    id: it.id,
    title: it.title,
    subject: 'math',
    category: 'plane_geometry',
    coordinatePolicy: it.policy,
    knowledgeScope: { stage: '初中', topics: it.topics },
    questionType: it.questionType,
    answer: it.answer,
    answerKey: it.keyPoints,
    difficulty: it.difficulty,
    figure: it.figures,
    source: { site: '第一试卷网', url: 'https://www.shijuan1.com/a/sjsxzk/', paper: it.source, region: it.region, year: it.year, license: '免费资源' },
    dateAdded: '2026-09-18',
    tags: it.topics,
    rubric: it.rubric,
    visionRubric: it.visionRubric,
  };

  fs.writeFileSync(path.join(dir, 'problem.md'), problem);
  fs.writeFileSync(path.join(dir, 'solution.md'), solution);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  n++;
  console.log(`✓ ${it.id} ${it.title}（rubric ${it.rubric.reduce((s, r) => s + r.score, 0)} 分 · 识图 ${it.visionRubric.reduce((s, r) => s + r.score, 0)} 分）`);
}
console.log(`\n共构建 ${n} 个条目 → ${ITEMS}`);
