# GM-0004 解析

## （1）求 AB

黄金矩形定义：$\dfrac{AB}{AD} = \dfrac{\sqrt{5}-1}{2}$，故

$$
AB = \frac{\sqrt{5}-1}{2}\cdot(\sqrt{5}+1) = \frac{(\sqrt{5})^2-1^2}{2} = \frac{5-1}{2} = 2
$$

## （2）证明四边形 CDEF 是黄金矩形

折叠性质：$B \to E$，故 $AE = AB = 2$，$\angle AEF = \angle B = 90^\circ$；且 $F$ 为折痕与 $BC$ 交点，$BF$ 的像为 $EF$，故 $EF = BF$。

- $ABFE$：$\angle B = \angle BAD = \angle AEF = 90°$ 且邻边 $AB = AE = 2$，故为正方形，$BF = EF = 2$；
- $DE = AD - AE = (\sqrt{5}+1) - 2 = \sqrt{5}-1$；$CF = BC - BF = (\sqrt{5}+1) - 2 = \sqrt{5}-1$；
- $\angle C = \angle D = \angle DEF = 90^\circ$，故 $CDEF$ 是矩形；

$$
\frac{DE}{EF} = \frac{\sqrt{5}-1}{2}
$$

即宽与长之比为黄金比，四边形 $CDEF$ 是黄金矩形。$\blacksquare$

## （3）四边形 BFQP 是黄金矩形

**① 矩形判定。** $PQ \parallel AD$ 且 $AD \parallel BF$，故 $PQ \parallel BF$；$EF \perp BF$ 故 $\angle BFQ = 90^\circ$；加上 $\angle B = 90^\circ$，三个角为直角，四边形 $BFQP$ 是矩形，记 $BP = x$（$0 < x < 2$），则宽 $BP = x$、长 $BF = 2$。

**② 折叠性质。** 沿 $PF$ 折叠 $B \to H$（$H$ 在射线 $FG$ 上）：

$$
FH = FB = 2,\qquad PH = PB = x,\qquad \angle PHF = \angle PBF = 90^\circ
$$

**③ 求 FG。** $G$ 为 $AE$ 中点，$AG = 1$。在 $\mathrm{Rt}\triangle EGF$ 中（$EG \perp EF$）：

$$
FG = \sqrt{EG^2 + EF^2} = \sqrt{1 + 4} = \sqrt{5}
$$

**④ 面积法求 x。** 关键一步：因 $H$ 在射线 $FG$ 上且 $\angle PHF = 90^\circ$，故 $PH \perp FG$——$PH$ 恰为 $\triangle PGF$ 中 $FG$ 边上的高。梯形 $ABFG$（$AG \parallel BF$）被 $P$ 与 $G$、$F$ 的连线分割为三个三角形：

$$
S_{ABFG} = S_{\triangle APG} + S_{\triangle PBF} + S_{\triangle PGF}
$$

$$
\underbrace{\frac{1}{2}(1+2)\cdot 2}_{3}
= \underbrace{\frac{1}{2}\cdot 1\cdot(2-x)}_{\triangle APG}
+ \underbrace{\frac{1}{2}\cdot 2\cdot x}_{\triangle PBF}
+ \underbrace{\frac{1}{2}\cdot \sqrt{5}\cdot x}_{\triangle PGF}
$$

$$
3 = 1 - \frac{x}{2} + x + \frac{\sqrt{5}}{2}x
\quad\Longrightarrow\quad
2 = \frac{1+\sqrt{5}}{2}x
\quad\Longrightarrow\quad
x = \frac{4}{\sqrt{5}+1} = \sqrt{5}-1
$$

**⑤ 验证黄金比。**

$$
\frac{BP}{BF} = \frac{\sqrt{5}-1}{2}
$$

宽与长之比恰为黄金比，故四边形 $BFQP$ 是黄金矩形。$\blacksquare$

## 评分要点

1. （1）共轭根式运算得 $AB=2$；
2. （2）论证 $ABFE$ 为正方形（折叠等长 + 三个直角），再算 $DE$、判定 $CDEF$ 矩形并验证比例；
3. （3）矩形判定 + 正确使用折叠三性质（$FH=FB$、$PH=PB$、$\angle PHF=90^\circ$）；
4. 由 $\angle PHF = 90^\circ$ 且 $H \in FG$ 识别 $PH$ 为 $\triangle PGF$ 的高（本题最关键的一步）；
5. 面积方程解出 $x=\sqrt{5}-1$ 并完成黄金比验证。

## 严谨性备注（供审题参考）

- "沿 $AF$ 折叠使 $B$ 落在 $AD$ 上"要求 $\angle BAF = 45^\circ$，此时 $F$ 恰在 $BC$ 上距 $B$ 为 $2$ 处，与 $AE=2$ 自洽；落点记为 $E$（在 $AD$ 上）、折痕与 $BC$ 交点记为 $F$，勿与题面字母混淆。
- 面积法中 $PH$ 作高的合法性：$H \in$ 射线 $FG$ 且 $\angle PHF = 90^\circ \Rightarrow PH \perp FG$。这不是对任意 $x$ 成立，而是"恰好落在 $FG$ 上"这一约束选出 $x=\sqrt{5}-1$ 后的必然结构。
- 数值交叉验证（坐标法）：取 $A(0,0),B(0,2),C(\sqrt5+1,2),D(\sqrt5+1,0)$，解得 $H=(2-\frac{2}{\sqrt5},\,2-\frac{4}{\sqrt5})$，$P=(0,\,3-\sqrt5)$，满足 $|PH|=|PB|=\sqrt5-1$、$|HF|=2$、$\vec{PH}\cdot\vec{HF}=0$，且 $H$ 在线段 $FG$ 内（参数 $t=1-\frac{2}{\sqrt5}\approx0.106$）。

## 通用技巧

- **折叠 = 轴对称**：折痕是垂直平分线；立刻抄下三件事——对应线段相等、对应角相等、折痕上任一点到对应点等距。
- **"恰好落在某线上"是定方程**：落点约束（本题 $H \in FG$）把折叠的等长等角翻译成几何位置关系，往往就是辅助高或辅助角的来源。
- **梯形面积分割**：动点三角形面积和 = 整体面积，是求"折叠型"线段长的常用手段；识别高（本题 $PH \perp FG$）是成败关键。
- 黄金比 $\frac{\sqrt5-1}{2}$ 满足 $\varphi^2 = 1-\varphi$，凡算出 $x^2+x-1=0$ 型方程即可能是黄金比伪装。
