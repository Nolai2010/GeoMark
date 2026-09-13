# GM-0010 解析

## 正解（空间向量法）

建系：$A(0,0,0)$，$B(2,0,0)$，$C(2,2,0)$，$D(0,2,0)$，$A_1(0,0,2)$，$B_1(2,0,2)$，$C_1(2,2,2)$，$D_1(0,2,2)$。

由中点条件：$E = (0,2,1)$，$F = (2,1,0)$。

$\overrightarrow{B_1E} = (-2,2,-1)$，$\overrightarrow{B_1F} = (0,1,-2)$，平面 $B_1EF$ 法向量：

$$\vec n = \overrightarrow{B_1E}\times\overrightarrow{B_1F} = (-3,-4,-2)$$

$\overrightarrow{AE} = (0,2,1)$，$|\overrightarrow{AE}| = \sqrt5$，$|\vec n| = \sqrt{29}$：

$$\sin\theta = \frac{|\overrightarrow{AE}\cdot\vec n|}{|\overrightarrow{AE}||\vec n|}
= \frac{|0-8-2|}{\sqrt5\cdot\sqrt{29}} = \frac{10}{\sqrt{145}} = \frac{10\sqrt{145}}{145}$$

$$\boxed{\sin\theta = \frac{10\sqrt{145}}{145} \approx 0.831}$$

**法二（等体积法）**：$V_{A\text{-}B_1EF} = V_{E\text{-}AB_1F}$。$S_{\triangle AB_1F} = \frac12|\overrightarrow{AB_1}\times\overrightarrow{AF}| = \frac12|(-6,-4,-4)| = \sqrt{17}$；底面高……（略，结果相同）求得 $d(A, \text{平面 } B_1EF) = \frac{10}{\sqrt{29}}$，故 $\sin\theta = \frac{d}{AE} = \frac{10/\sqrt{29}}{\sqrt5} = \frac{10}{\sqrt{145}}$。

## 评分细则（满分 12 分）

| 步骤 | 得分点 | 分值 |
|---|---|---|
| ① | 建系并写全 8 个顶点（至少含 $A,E,F,B_1$）坐标 | 3 |
| ② | 求出平面 $B_1EF$ 法向量 $\vec n = (-3,-4,-2)$（倍数均可） | 3 |
| ③ | $\overrightarrow{AE}\cdot\vec n = -10$ 与模长 $|\overrightarrow{AE}|=\sqrt5$、$|\vec n|=\sqrt{29}$ | 3 |
| ④ | $\sin\theta = \frac{10\sqrt{145}}{145}$ | 3 |

**评分说明**：等体积法按"距离框架 3 分、$d=\frac{10}{\sqrt{29}}$ 4 分、$\sin\theta=\frac{d}{AE}$ 3 分、结果 2 分"等价给分。
