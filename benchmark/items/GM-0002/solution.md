# GM-0002 解析

## 证明（标准解）

基底：$\vec{a} = \overrightarrow{AB}$，$\vec{b} = \overrightarrow{AC}$。

**第一步：表示 $\overrightarrow{BE}$。**

由 $AE = 2EC$ 得 $AE = \dfrac{2}{3}AC$，故

$$
\overrightarrow{BE} = \overrightarrow{AE} - \overrightarrow{AB} = \frac{2}{3}\vec{b} - \vec{a}
$$

**第二步：表示 $\overrightarrow{BF}$。**

$D$ 为 $BC$ 中点，由中点公式

$$
\overrightarrow{AD} = \frac{1}{2}\left(\vec{a} + \vec{b}\right)
$$

又 $\overrightarrow{AF} = \dfrac{4}{5}\overrightarrow{AD}$，故

$$
\overrightarrow{AF} = \frac{4}{5}\cdot\frac{1}{2}\left(\vec{a}+\vec{b}\right) = \frac{2}{5}\vec{a} + \frac{2}{5}\vec{b}
$$

于是

$$
\overrightarrow{BF} = \overrightarrow{AF} - \overrightarrow{AB} = \frac{2}{5}\vec{a} + \frac{2}{5}\vec{b} - \vec{a} = -\frac{3}{5}\vec{a} + \frac{2}{5}\vec{b}
$$

**第三步：共线判定。**

$$
\overrightarrow{BF} = -\frac{3}{5}\vec{a} + \frac{2}{5}\vec{b}
= \frac{3}{5}\left(-\vec{a} + \frac{2}{3}\vec{b}\right)
= \frac{3}{5}\,\overrightarrow{BE}
$$

由共线向量定理（$\overrightarrow{BE} \neq \vec{0}$，因 $E$ 在 $AC$ 上且 $E \neq A$），$\overrightarrow{BF} = \dfrac{3}{5}\overrightarrow{BE}$，故 $B$、$E$、$F$ 三点共线。

又 $\lambda = \dfrac{3}{5} \in (0,1)$，故 $F$ 在线段 $BE$ 内部，与图形一致；同时 $\overrightarrow{EF} = -\dfrac{2}{5}\overrightarrow{BE}$。

## 评分要点

1. 由比例条件正确写出 $AE = \frac{2}{3}\vec{b}$ 并得到 $\overrightarrow{BE} = \frac{2}{3}\vec{b} - \vec{a}$；
2. 正确使用中点公式 $\overrightarrow{AD} = \frac{1}{2}(\vec{a}+\vec{b})$ 与 $\overrightarrow{AF} = \frac{4}{5}\overrightarrow{AD}$；
3. 求出 $\overrightarrow{BF}$，并验证 $\overrightarrow{BF} = \lambda\,\overrightarrow{BE}$（$\lambda = \frac{3}{5}$）；
4. 引用共线向量定理下结论（须说明 $\overrightarrow{BE} \neq \vec 0$ 或等价条件）。

（1）（2）（3）各约占总分四分之一，（4）为收尾必需；只写"$\overrightarrow{BF}=\frac{3}{5}\overrightarrow{BE}$"而无分解过程，按（4）给分。

## 系数比对法（快速验算）

在基底 $\{\vec a, \vec b\}$ 下（$\vec a,\vec b$ 不共线），两向量共线 $\Leftrightarrow$ 系数成比例：

$$
\overrightarrow{BF}:\ \left(-\frac{3}{5},\ \frac{2}{5}\right),
\qquad
\overrightarrow{BE}:\ \left(-1,\ \frac{2}{3}\right)
$$

$$
\frac{-3/5}{-1} = \frac{3}{5},
\qquad
\frac{2/5}{2/3} = \frac{3}{5}
$$

比值相等，共线成立。此法适合快速检验，正式书写仍建议写出 $\overrightarrow{BF} = \lambda\overrightarrow{BE}$ 的完整形式。

## 通用技巧

**未知向量大胆表示**：凡出现"中点、定比分点"，立刻用基底把相关向量全部显式写出（中点公式 $\overrightarrow{AD} = \frac{1}{2}(\overrightarrow{AB}+\overrightarrow{AC})$ 要形成条件反射），共线问题随之化为"系数是否成比例"的代数运算。
