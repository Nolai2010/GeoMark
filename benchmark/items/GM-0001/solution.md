# GM-0001 解析

## 正解

**B（内心）**

## 解析

**条件①**：展开数量积

$$
\frac{\left|\overrightarrow{AO}\right|\left|\overrightarrow{AB}\right|\cos\left\langle\overrightarrow{AO},\overrightarrow{AB}\right\rangle}{\left|\overrightarrow{AB}\right|}
=\frac{\left|\overrightarrow{AO}\right|\left|\overrightarrow{AC}\right|\cos\left\langle\overrightarrow{AO},\overrightarrow{AC}\right\rangle}{\left|\overrightarrow{AC}\right|}
$$

约分（模长非零）得

$$
\cos\left\langle\overrightarrow{AO},\overrightarrow{AB}\right\rangle
=\cos\left\langle\overrightarrow{AO},\overrightarrow{AC}\right\rangle
$$

**条件②**：同理得

$$
\cos\left\langle\overrightarrow{CO},\overrightarrow{CA}\right\rangle
=\cos\left\langle\overrightarrow{CO},\overrightarrow{CB}\right\rangle
$$

由余弦函数在 $[0,\pi]$ 上单射，两式分别说明：$AO$ 在 $\angle BAC$ 的平分线上，$CO$ 在 $\angle BCA$ 的平分线上。$O$ 为两条角平分线的公共点，故 $O$ 为 $\triangle ABC$ 的**内心**。

## 评分要点

1. 识别 $\dfrac{\overrightarrow{AO}\cdot\overrightarrow{AB}}{|\overrightarrow{AB}|}$ 为 $\overrightarrow{AO}$ 在 $\overrightarrow{AB}$ 方向上的**投影**（或写出模长×余弦后约分）——核心步骤；
2. 指出余弦相等 ⇒ 夹角相等（利用 $[0,\pi]$ 上的单调性）；
3. 由"角平分线交点 = 内心"得出结论。

三者齐备给满分；仅凭记忆给出"B（内心）"而无推理过程不给满分。

## 严谨性备注（供审题参考）

条件①实际确定的是 $\overrightarrow{AO}$ 落在 **∠A 平分线所在的直线**上（射线方向也可以是内角平分线的反向延长线，此时与两边的夹角同为 $\pi-\frac{\theta}{2}$，余弦仍相等）。但 ∠A 平分线与 ∠C 平分线是两条不重合的直线，交点唯一且为内心，故不影响结论。题面条件充分。

另注：外角平分线方向与两边射线的夹角分别为 $\frac{\pi}{2}\pm\frac{\theta}{2}$，并不相等，故不存在"外角平分线"歧义。

## 通用技巧

遇到**数量积 + 模长**的组合，第一反应就是展开：$\overrightarrow{u}\cdot\overrightarrow{v} = |\overrightarrow{u}||\overrightarrow{v}|\cos\theta$，模长能约就约。本题约分后暴露出"余弦相等"这一角平分线特征，属于"数量积投影 ⇔ 角平分线"的经典模型。
