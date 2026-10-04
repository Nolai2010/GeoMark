> **方法中立性说明**：本题 coordinatePolicy 为 restricted，以下**主参考路线为纯几何综合法**；
> 文末附坐标写法，仅用于数值复核，**不是评分标准**。评分只看是否得出相应几何量与判定依据，
> 不得因作答未使用坐标系而扣分。

# GM-0106 解析

## 答案

（1）见解析（$AG=2GC$）；（2）① $2$；② $\dfrac{EF}{BC}=\dfrac{2}{3}$

## 标准解（纯几何综合法）

（1）
1. $M$ 为 $BC$ 中点，$O$ 为对角线交点（即 $AC$ 中点），在 $\triangle ABC$ 中 $OM$ 为中位线 $\Rightarrow OM\parallel AB$
2. $DM$ 交 $AC$ 于 $G$：由 $OM\parallel AB$ 与平行线分线段成比例（或 $\triangle OGD\sim\triangle CGM$ 类似构造）
   得 $AG:GC=2:1$

（2）①
3. $I$ 是 $\angle BCD$ 与 $\angle BDC$ 的平分线交点 $\Rightarrow I$ 是 $\triangle BCD$ 的**内心**
4. $AB=6,BC=8$ $\Rightarrow CD=AB=6$，$BD=\sqrt{6^2+8^2}=10$（$\angle BCD=90^\circ$）
5. 直角三角形内切圆半径 $r=\dfrac{BC+CD-BD}{2}=\dfrac{8+6-10}{2}=2$
   $\Rightarrow$ 点 $I$ 到 $BC$ 的距离为 $2$

（2）②（核心：距离 + 比例，全程不用坐标）
6. 设 $AB=CD=3t,\ BC=4t$：由 $AB+AC=2BC$ 与 $AC^2=AB^2+BC^2$
   $\Rightarrow (2\cdot4t-3t)^2=(3t)^2+(4t)^2$ 成立，即三边比 $CD:BC:BD=3:4:5$，$\triangle BCD$ 直角于 $C$
7. 内切圆半径 $r=\dfrac{3t+4t-5t}{2}=t$ $\Rightarrow$ $I$ 到 $CD$ 的距离为 $t$（$I$ 在 $\angle BCD$ 内部）
   $\Rightarrow I$ 到 $AD$ 的距离 $=CD-t=3t-t=2t$
8. 由（1）$AG:GC=2:1$，平行线分线段成比例 $\Rightarrow G$ 到 $AD$ 的距离 $=\dfrac{AG}{AC}\cdot CD=\dfrac23\cdot 3t=2t$
9. $G$、$I$ 到 $AD$ 等距（同侧）$\Rightarrow GI\parallel AD$，即 $GI\perp CD$，垂足 $F$ 在 $CD$ 上
10. $E$ 在 $BD$ 上且 $E$ 到 $AD$ 的距离为 $2t$ $\Rightarrow$ 由平行线分线段成比例
    $\dfrac{DE}{DB}=\dfrac{2t}{3t}=\dfrac23$
11. $F$ 在 $CD$ 上 $\Rightarrow$ $F$ 到 $AB$ 的距离 $=BC=4t$；$E$ 到 $AB$ 的距离 $=BC\cdot\left(1-\dfrac{DE}{DB}\right)=4t\cdot\dfrac13=\dfrac{4t}{3}$
    $\Rightarrow EF=4t-\dfrac{4t}{3}=\dfrac{8t}{3}$
12. $\dfrac{EF}{BC}=\dfrac{8t/3}{4t}=\dfrac23$

## 纯几何路线的数值自洽验证

坐标复核（非评分标准）：取 $A(0,0),B(3,0),C(3,4),D(0,4)$。
$G=DM\cap AC=(2,\tfrac83)$（$AG:GC=2:1$ ✅）；内心 $I=(3-1,4-1)=(2,3)$（$r=1$ ✅）；
直线 $GI$：$x=2$，交 $BD$（$y=-\tfrac43(x-3)$）于 $E=(2,\tfrac43)$，交 $CD$ 于 $F=(2,4)$
$\Rightarrow EF=\tfrac83$，$\dfrac{EF}{BC}=\dfrac{8/3}{4}=\dfrac23$，与纯几何路线一致。

## 评分要点

1. （4 分）(1) 利用中位线/相似证明 $AG=2GC$
2. （4 分）① 由角平分线交点为内心、直角三角形内切圆半径公式（或等价的切线长/面积法）得到 $I$ 到 $BC$ 的距离为 $2$
3. （3 分）② 由 $AB+AC=2BC$ 推出三边比 $3:4:5$
4. （4 分）② 求出 $E,F$ 位置并算出 $\dfrac{EF}{BC}=\dfrac{2}{3}$（距离/比例路线或任何不建系的等价路线均可得分）

> 说明：本题答案与关键步骤经独立复核（含数值验证）。来源：2025年江苏省南通市中考数学试卷 第25题。
