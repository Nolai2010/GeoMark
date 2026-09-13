# GM-0007 解析

## （1）证明 BD ⊥ 平面 PAC

正方形 $ABCD$ 中对角线 $BD \perp AC$；$PA \perp$ 底面 $ABCD$，故 $BD \perp PA$。$AC \cap PA = A$，且都在平面 $PAC$ 内，故 $BD \perp$ 平面 $PAC$。$\blacksquare$

## （2）直线 PC 与平面 PBD 所成角

**法一（向量法）**：建系 $A(0,0,0),B(2,0,0),C(2,2,0),D(0,2,0),P(0,0,2)$。
$\overrightarrow{PB}=(2,0,-2)$，$\overrightarrow{PD}=(0,2,-2)$，平面 $PBD$ 法向量

$$\vec n = \overrightarrow{PB}\times\overrightarrow{PD} = (4,4,4) \parallel (1,1,1)$$

$\overrightarrow{PC}=(2,2,-2)$，故

$$\sin\theta = \frac{|\overrightarrow{PC}\cdot\vec n|}{|\overrightarrow{PC}||\vec n|} = \frac{|2+2-2|}{2\sqrt3 \cdot \sqrt3} = \frac{2}{6} = \frac{1}{3}$$

**法二（等体积法）**：设 $C$ 到平面 $PBD$ 距离为 $d$。$V_{P\text{-}BCD}=\frac13\cdot(2\cdot2/2)\cdot 2=\frac43$；$S_{\triangle PBD}=\frac12|\overrightarrow{PB}\times\overrightarrow{PD}|=\frac12\cdot4\sqrt3=2\sqrt3$。由 $V_{C\text{-}PBD}=\frac13 S_{\triangle PBD}\, d$ 得 $d=\frac{4}{2\sqrt3}=\frac{2\sqrt3}{3}$。又 $PC=\sqrt{2^2+2^2+(-2)^2}=2\sqrt3$，故

$$\sin\theta = \frac{d}{PC} = \frac{2\sqrt3/3}{2\sqrt3} = \frac{1}{3}$$

$$\boxed{\sin\theta = \frac{1}{3}}$$

## 评分细则（满分 12 分）

| 步骤 | 得分点 | 分值 |
|---|---|---|
| ① | $BD \perp AC$（对角线） | 2 |
| ② | $BD \perp PA$（线面垂直性质）+ 判定得 $BD \perp$ 平面 $PAC$ | 2 |
| ③ | 建系写出全部坐标（或等体积法框架与 $S_{\triangle PBD}$） | 3 |
| ④ | 求出法向量 $\vec n=(1,1,1)$（或 $d=\frac{2\sqrt3}{3}$） | 2 |
| ⑤ | $\sin\theta = \frac{1}{3}$ | 3 |

**评分说明**：两法任一满分；混合使用按对应步骤给分。
