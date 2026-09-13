# GM-0008 解析

## （1）证明 BC ⊥ 平面 SAB

$AB \perp BC$（已知）；$SA \perp$ 平面 $ABC$，$BC \subset$ 平面 $ABC$，故 $SA \perp BC$。$AB \cap SA = A$，故 $BC \perp$ 平面 $SAB$。$\blacksquare$

## （2）二面角 B-SC-A 的余弦值

**法一（三垂线/定义法）**：由（1）$BC \perp$ 平面 $SAB$，$BC \subset$ 平面 $SBC$，故平面 $SBC \perp$ 平面 $SAB$，交线为 $SB$。在平面 $SAB$ 内作 $AH \perp SB$ 于 $H$，则 $AH \perp$ 平面 $SBC$。在平面 $SBC$ 内作 $HK \perp SC$ 于 $K$，连接 $AK$：由三垂线定理 $AK \perp SC$。故 $\angle AKH$ 为二面角 $B\text{-}SC\text{-}A$ 的平面角。

建系 $A(0,0,0),B(1,0,0),C(1,1,0),S(0,0,1)$ 得 $H=(\frac12,0,\frac12)$，$K=(\frac13,\frac13,\frac23)$：

$$\overrightarrow{KH}=\left(\frac16,-\frac13,-\frac16\right),\quad
\overrightarrow{KA}=\left(-\frac13,-\frac13,-\frac23\right)$$

$$\cos\angle AKH = \frac{\overrightarrow{KH}\cdot\overrightarrow{KA}}{|\overrightarrow{KH}||\overrightarrow{KA}|}
= \frac{3/18}{1/3} = \frac{1}{2}$$

**法二（向量法）**：平面 $SBC$ 法向量 $\vec n_1 = (1,0,1)$，平面 $SAC$ 法向量 $\vec n_2 = (1,1,0)$：

$$\cos\theta = \frac{|\vec n_1\cdot\vec n_2|}{|\vec n_1||\vec n_2|} = \frac{1}{\sqrt2\cdot\sqrt2} = \frac{1}{2}$$

$$\boxed{\cos\angle(B\text{-}SC\text{-}A) = \frac{1}{2}}$$

## 评分细则（满分 12 分）

| 步骤 | 得分点 | 分值 |
|---|---|---|
| ① | $BC \perp AB$、$BC \perp SA$，判定 $BC \perp$ 平面 $SAB$ | 4（1+2+1） |
| ② | 识别面面垂直（平面 $SBC \perp$ 平面 $SAB$）并作 $AH \perp SB$，证 $AH \perp$ 平面 $SBC$ | 3 |
| ③ | 三垂线得 $AK \perp SC$，定位平面角 $\angle AKH$（或正确求出两面法向量） | 3 |
| ④ | 计算 $\cos = \frac{1}{2}$ | 2 |

**评分说明**：定义法与向量法等价给分；未定位平面角直接算错的，②③不得分。
