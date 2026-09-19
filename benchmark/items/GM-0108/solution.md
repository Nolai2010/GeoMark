> **方法中立性说明**：以下解析含解析几何/坐标写法，仅用于确认结论与数值，**不是评分标准**。
> 本题 coordinatePolicy 为 restricted：评分只看是否得出相应几何量与判定依据，
> 不得因作答未使用坐标系而扣分。

# GM-0108 解析

## 答案

（1）$S_{\triangle AOD}=S_{\triangle BOC}$（面积相等）；（2）见解析；（3）最大值 $S_{\max}=25$

## 标准解（关键步骤）

1. 设 $OA=x,OB=y$（$x^2+y^2=25$），旋转角为 $\varphi$，取 $A(x,0),B(0,y),C(x\cos\varphi,x\sin\varphi),D(-y\sin\varphi,y\cos\varphi)$
2. (1) $S_{\triangle AOD}=\dfrac12 xy\cos\varphi=S_{\triangle BOC}$（$|\sin(90^\circ\pm\varphi)|=|\cos\varphi|$），故面积相等
3. (2) 用向量/中点公式表示 $P,Q,R$，证明 $\overrightarrow{PQ}$ 与 $\overrightarrow{PR}$ 共线
4. (3) 四边形 $ABCD$ 面积 $S=xy(1-\cos\varphi)$，故 $S\le 2xy\le x^2+y^2=25$
5. 当 $x=y=\dfrac{5\sqrt{2}}{2}$ 且 $\varphi=180^\circ$ 时取到 $S_{\max}=25$

## 评分要点

1. （4 分）(1) 得出 $S_{\triangle AOD}=S_{\triangle BOC}$ 并说明理由（旋转对应边长相等 + 等角）
2. （4 分）(2) 建立坐标或向量表示 $P,Q,R$ 并证明三点共线
3. （4 分）(3) 用对角线或坐标导出四边形面积 $S=xy(1-\cos\varphi)$
4. （3 分）(3) 求出最大值 $S_{\max}=25$

> 说明：本题答案与关键步骤经独立复核（含数值验证）。来源：2025年江苏省徐州市中考数学真题 第28题。
