# GM-0003 解析

## 正解

$$
\mu \in \left[\frac{2}{3},\ \frac{5}{6}\right]
$$

## 解析

**第一步：确定外心位置。**

由 $\overrightarrow{AO} = \lambda\overrightarrow{AB} + (1-\lambda)\overrightarrow{AC}$，系数和 $\lambda + (1-\lambda) = 1$，改写为

$$
\overrightarrow{O} = \lambda\,\overrightarrow{B} + (1-\lambda)\,\overrightarrow{C}
$$

即 $O$ 在直线 $BC$ 上。

又 $O$ 是外心，$OB = OC$，即 $O$ 同时在线段 $BC$ 的垂直平分线上；垂直平分线与直线 $BC$ 的交点唯一，故 $O$ 为 $BC$ 的**中点**，$\lambda = \dfrac{1}{2}$。

**第二步：识别直角三角形。**

外心在三角形的边上 $\Leftrightarrow$ 该边为外接圆直径（圆周角定理的逆定理），故 $BC$ 为直径，

$$
\angle A = 90^\circ,\qquad BC = 2R,\qquad OA = OB = OC = R
$$

**第三步：投影向量转化为 $\cos^2\angle ABC$。**

由投影向量定义

$$
\mu = \frac{\overrightarrow{BA}\cdot\overrightarrow{BC}}{\left|\overrightarrow{BC}\right|^2}
= \frac{AB\cdot BC\cos\angle ABC}{BC^2}
$$

在 $\text{Rt}\triangle ABC$（$\angle A = 90^\circ$）中 $\cos\angle ABC = \dfrac{AB}{BC}$，故

$$
\mu = \frac{AB^2}{BC^2} = \cos^2\angle ABC
$$

**第四步：圆心角与二倍角。**

圆心角 $\angle AOC$ 与圆周角 $\angle ABC$ 同对弧 $AC$，故

$$
\angle AOC = 2\angle ABC
\quad\Longrightarrow\quad
\cos\angle AOC = \cos 2\angle ABC = 2\cos^2\angle ABC - 1 = 2\mu - 1
$$

**第五步：解不等式。**

由 $\cos\angle AOC \in \left[\dfrac{1}{3}, \dfrac{2}{3}\right]$：

$$
\frac{1}{3} \le 2\mu - 1 \le \frac{2}{3}
\quad\Longrightarrow\quad
\boxed{\ \frac{2}{3} \le \mu \le \frac{5}{6}\ }
$$

端点可取到：$\mu = \dfrac{2}{3}$ 与 $\mu = \dfrac{5}{6}$ 分别对应 $\angle ABC = \dfrac{1}{2}\arccos\dfrac{2}{3} \approx 24.1^\circ$ 与 $\dfrac{1}{2}\arccos\dfrac{1}{3} \approx 35.3^\circ$ 的直角三角形，均存在，故为闭区间。

## 评分要点

1. 由系数和为 1 判定 $O$ 在直线 $BC$ 上，并结合 $OB=OC$ 论证 $O$ 为中点（**须给出论证**，直接断言"只能是中点"扣一步分）；
2. 外心在边上 $\Rightarrow$ $BC$ 为直径、$\angle A = 90^\circ$；
3. 投影向量正确写出 $\mu = \dfrac{\overrightarrow{BA}\cdot\overrightarrow{BC}}{|\overrightarrow{BC}|^2}$ 并化简为 $\cos^2\angle ABC$；
4. 正确使用圆周角定理 $\angle AOC = 2\angle ABC$ 与二倍角公式得 $2\mu - 1$；
5. 解出闭区间并说明端点可达。

## 严谨性备注（供审题参考）

- $\angle AOC$ 取几何角（$[0,\pi]$）。直角三角形中 $\angle ABC \in (0^\circ, 90^\circ)$，故 $2\angle ABC \in (0^\circ, 180^\circ)$，"$\angle AOC = 2\angle ABC$" 与几何角一致，无优弧歧义。
- 系数和为 1 的共线表达式中 $\lambda \in \mathbb{R}$，$O$ 在**直线** $BC$ 上而非 necessarily 线段上；但外心到 $B,C$ 等距已强制其为中心点，故不需讨论 $\lambda$ 范围。

## 通用技巧

- 看到 $\lambda\vec{a} + (1-\lambda)\vec{b}$：系数和为 1，立即翻译为"终点共线"；
- 看到外心落边：直角三角形 + 斜边为直径（圆周角定理逆定理）；
- 投影向量**分母带平方**：$\text{proj}_{\vec{u}}\vec{v} = \dfrac{\vec{v}\cdot\vec{u}}{|\vec{u}|^2}\,\vec{u}$，与投影长度（不带平方）区分；
- 圆心角 = 2 × 圆周角，是"角的条件"翻译成"边长比"的常用桥梁。
