> **方法中立性说明**：本题 coordinatePolicy 为 restricted，以下**主参考路线为纯几何综合法**；
> 文末附坐标写法，仅用于数值复核，**不是评分标准**。评分只看是否得出相应几何量与判定依据，
> 不得因作答未使用坐标系（或使用了坐标系之外的其他合法方法）而扣分。

# GM-0101 解析

## 答案

（1）见解析（PC ⊥ OC）；（2）① $BC=\dfrac{4\sqrt{5}}{5}$；② $\tan\angle PEC=\dfrac{24}{7}$

## 标准解（纯几何综合法）

（1）
1. $AB$ 为直径 $\Rightarrow \angle ACB=90^\circ$，即 $BC\perp AC$
2. $BC\parallel OP$ 且 $O$ 为 $AB$ 中点 $\Rightarrow OP$ 垂直平分 $AC$，故 $PA=PC$
3. $\triangle OAP\cong\triangle OCP$（SSS：$OA=OC$、$PA=PC$、$OP$ 公共）$\Rightarrow \angle OCP=\angle OAP=90^\circ$，得 $PC$ 是切线

（2）①
4. Rt$\triangle OAP$ 中 $OA=2,PA=4\Rightarrow OP=2\sqrt5$；$D$ 为 $OB$ 中点 $\Rightarrow OD=1$
5. $BC\parallel OP$，截线为 $AB$：$\angle OBC$ 与 $\angle AOP$ 为同位角 $\Rightarrow \cos\angle OBC=\cos\angle AOP=\dfrac{OA}{OP}=\dfrac{1}{\sqrt5}$
6. $\triangle OBC$ 中 $OB=OC=2$（等腰），$\angle BOC=180^\circ-2\angle OBC$
   $\Rightarrow \cos\angle BOC=1-2\cos^2\angle OBC=1-\dfrac{2}{5}=\dfrac35$
   $\Rightarrow BC=2\cdot OB\cdot\sin\dfrac{\angle BOC}{2}$ 或由相似 $BC=\dfrac{4\sqrt5}{5}$

（2）②（核心：角 chase，全程不用坐标）
7. $\triangle ODP$ 中：$OD=1$、$OP=2\sqrt5$、$\cos\angle DOP=\cos(180^\circ-\angle AOP)=-\dfrac{1}{\sqrt5}$
   $\Rightarrow$ 余弦定理 $DP^2=1+20-2\cdot1\cdot2\sqrt5\cdot\left(-\tfrac{1}{\sqrt5}\right)=25\Rightarrow DP=5$
8. 正弦定理 $\sin\angle ODP=\dfrac{OP\cdot\sin\angle DOP}{DP}=\dfrac{2\sqrt5\cdot\frac{2}{\sqrt5}}{5}=\dfrac45$
   （$\angle ODP$ 为锐角）$\Rightarrow \cos\angle ODP=\dfrac35$
9. $BC\parallel OP$（同位角同理）$\Rightarrow \cos\angle DOE=\cos\angle BOC=\dfrac35$；又 $E$ 在 $DP$ 上
   $\Rightarrow \angle ODE=\angle ODP$，$\cos\angle ODE=\dfrac35$
10. $\triangle ODE$ 中 $\angle DOE=\angle ODE\Rightarrow EO=ED$（等角对等边）
11. $\angle OED=180^\circ-2\angle DOE$，$\tan\angle DOE=\dfrac{4}{3}$
    $\Rightarrow \tan\angle OED=-\tan(2\angle DOE)=\dfrac{2\cdot\frac43}{\frac{16}{9}-1}=\dfrac{24}{7}$
12. $E$ 为 $DP$ 与 $OC$ 交点 $\Rightarrow \angle PEC$ 与 $\angle OED$ 为对顶角
    $\Rightarrow \tan\angle PEC=\dfrac{24}{7}$

## 纯几何路线的数值自洽验证

坐标复核（非评分标准）：取 $O(0,0)$、$A(-2,0)$、$B(2,0)$、$P(-2,4)$，
$BC\parallel OP$ 得 $C\left(\tfrac65,\tfrac85\right)$，$D(1,0)$，
$E=DP\cap OC=\left(\tfrac12,\tfrac23\right)$（$OE=\tfrac56=ED$，等腰成立）；
$\overrightarrow{EP}=(-\tfrac52,\tfrac{10}{3})$，$\overrightarrow{EC}=(\tfrac7{10},\tfrac{14}{15})$，
$\tan\angle PEC=\dfrac{|\mathrm{cross}|}{\mathrm{dot}}=\dfrac{14/3}{49/36}=\dfrac{24}{7}$，与纯几何路线一致。

## 评分要点

1. （3 分）证明 $BC\perp AC$（直径所对圆周角为直角）并用中位线/垂直平分线推出 $OP\perp AC$
2. （4 分）由 $OP$ 垂直平分 $AC$ 得 $PA=PC$，进而证 $\triangle OAP\cong\triangle OCP$，得出 $\angle OCP=90^\circ$，即 $PC$ 是切线
3. （4 分）由 $OA=2,PA=4$ 得 $OP=2\sqrt{5}$，并正确推出 $BC=\dfrac{4\sqrt{5}}{5}$
4. （5 分）求出 $E$ 点位置并算出 $\tan\angle PEC=\dfrac{24}{7}$（纯几何角 chase、相似/比例线段或任何不建系的等价路线均可得分）

> 说明：本题答案与关键步骤经独立复核（含数值验证）。来源：2026年江苏省苏州市中考数学试题 第25题。
