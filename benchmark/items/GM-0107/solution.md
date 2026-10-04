> **方法中立性说明**：本题 coordinatePolicy 为 restricted，以下**主参考路线为纯几何综合法**；
> 文末附坐标写法，仅用于数值复核，**不是评分标准**。评分只看是否得出相应几何量与判定依据，
> 不得因作答未使用坐标系而扣分。

# GM-0107 解析

## 答案

（1）作点 $A$ 关于 $l$ 的对称点 $A'$，连 $A'B$ 交 $l$ 于 $P$；（2）两点之间线段最短；（3）$EF=1$
（(4) 拓展题：参考解法与评分要点待补——已知缺口，见文末）

## 标准解（纯几何综合法）

（1）作 $A$ 关于直线 $l$ 的对称点 $A'$，连接 $A'B$ 与 $l$ 的交点即为 $P$；

（2）依据：两点之间线段最短（$AP=A'P$，故 $AP+BP=A'P+BP\ge A'B$）；

（3）核心构造：**等边三角形 + 将军饮马**
1. 作点 $C$ 关于直线 $BD$ 的对称点 $C'$。由 $\angle DBC=30^\circ$ 得 $\angle CBC'=60^\circ$，且 $BC'=BC=2\sqrt3$
   $\Rightarrow \triangle BCC'$ 为**等边三角形**
2. $EF+CF=EF+C'F\ge EC'$（两点之间线段最短），等号成立当且仅当 $F$ 为 $EC'$ 与 $BD$ 的交点
3. $E$ 为等边 $\triangle BCC'$ 的边 $BC$ 中点 $\Rightarrow EC'$ 为中线 $\Rightarrow EC'\perp BC$ 且
   $EC'=\dfrac{\sqrt3}{2}\cdot BC=\dfrac{\sqrt3}{2}\cdot 2\sqrt3=3$
   $\Rightarrow (EF+CF)_{\min}=3$
4. $F$ 在 $BD$ 上、$EC'\perp BC$ $\Rightarrow \triangle BEF$ 为直角三角形（$\angle FEB=90^\circ$），
   $\angle EBF=\angle DBC=30^\circ$
   $\Rightarrow EF=BE\cdot\tan30^\circ=\sqrt3\cdot\dfrac{1}{\sqrt3}=1$

## 纯几何路线的数值自洽验证

坐标复核（非评分标准）：取 $B(0,0)$、$C(2\sqrt3,0)$、$E(\sqrt3,0)$、$BD$ 方向 $30^\circ$。
$C$ 关于 $BD$ 的对称点 $C'=(\sqrt3,3)$（$\triangle BCC'$ 等边）✅；$EC'$ 为竖直线段长 $3$ ✅；
$EC'$（$x=\sqrt3$）与 $BD$（$y=\tfrac{x}{\sqrt3}$）交于 $F=(\sqrt3,1)$，$EF=1$、$CF=2$、$EF+CF=3$ ✅，
与纯几何路线一致（原坐标+求导路线保留在 git 历史，数值结论相同）。

## 评分要点

1. （3 分）(1) 正确作出点 $P$（作轴对称点后连线取交点）
2. （2 分）(2) 填「两点之间线段最短」
3. （4 分）(3) 用纯几何构造（等边三角形 + 轴对称化归）或任何不建系的等价路线把 $EF+CF$ 化为可求最小值的形态
4. （5 分）(3) 求出最小值位置并得到 $EF=1$

## 已知缺口

**(4) 拓展延伸**（$AD\parallel BC$，$BD=CD$，$CE\perp BD$，$\angle A=2\angle ADB$，$AD=1$，$AB=3$，
$P$ 在 $BC$ 垂直平分线上，求 $\triangle BPE$ 周长最小值）目前**没有参考解法与评分要点**。
当前评分只覆盖 (1)(2)(3)；(4) 的作答内容暂不参与判分。补齐 (4) 前本条目分值口径保持 14 分。

> 说明：本题答案与关键步骤经独立复核（含数值验证）。来源：2026年贵州省中考数学试题 第24题。
