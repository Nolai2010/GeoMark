# GM-0110 参考解析

> 由 expand-driver 自动生成（2026-10-04T16:48），reviewStatus: auto-conflict；入库前需人工复核。

# 参考解析

## 参考解法（纯几何）

### 第（1）问：证明 $CD$ 与该半圆相切

**Step 1（切线垂直于过切点的半径）**
因为 $AD$、$BC$ 均与半圆相切，切点分别为 $A$、$B$，而 $AB$ 是直径，所以
$$AD\perp AB,\qquad BC\perp AB .$$
于是 $AD\parallel BC$，四边形 $ABCD$ 是直角梯形（$A$、$B$ 为直角顶点）。

**Step 2（作垂线，用勾股定理建立 $a,b,r$ 的关系）**
设 $AD=a$，$BC=b$，半径 $OA=OB=r$。过 $D$ 作 $DH\perp BC$ 于 $H$，则 $DH=AB=2r$，$CH=|b-a|$。在 $\mathrm{Rt}\triangle DHC$ 中，
$$CD^2=DH^2+CH^2=(2r)^2+(b-a)^2 .$$
又由已知 $CD=AD+BC=a+b$，代入得
$$(a+b)^2=4r^2+(b-a)^2 .$$
展开：$a^2+2ab+b^2=4r^2+b^2-2ab+a^2$，即
$$4ab=4r^2\ \Longrightarrow\ \boxed{ab=r^2}.$$

**Step 3（面积法求 $O$ 到 $CD$ 的距离）**
设 $O$ 到直线 $CD$ 的距离为 $d$。梯形 $ABCD$ 的面积可用两种方式计算：
$$S_{ABCD}=\frac{1}{2}(AD+BC)\cdot AB=\frac{1}{2}(a+b)\cdot 2r=r(a+b).$$
另一方面，连接 $OC$、$OD$，则
$$S_{ABCD}=S_{\triangle OAD}+S_{\triangle OBC}+S_{\triangle OCD}
=\frac12 ar+\frac12 br+\frac12 (a+b)d
=\frac12(a+b)(r+d).$$
两式相等：
$$r(a+b)=\frac12(a+b)(r+d)\ \Longrightarrow\ r+d=2r\ \Longrightarrow\ d=r .$$

**Step 4（判定相切）**
$O$ 到直线 $CD$ 的距离等于半径 $r$，故直线 $CD$ 与以 $AB$ 为直径的半圆相切。$\blacksquare$

> 说明：由 Step 2 已得 $ab=r^2$，这是后两问反复使用的核心关系。

---

### 第（2）问：比较 $m$ 与 $n$ 的大小

**Step 1（代入 $r=\sqrt2$ 得 $ab=2$）**
由（1）知 $ab=r^2=2$，即 $b=\dfrac{2}{a}$（$a,b>0$）。

**Step 2（作差通分）**
$$m-n=\left(\frac{2}{2+a}+\frac{2}{2+b}\right)-\left(\frac{a}{1+a}+\frac{b}{1+b}\right).$$
先算第一部分：
$$\frac{2}{2+a}+\frac{2}{2+b}=\frac{2(2+b)+2(2+a)}{(2+a)(2+b)}
=\frac{8+2(a+b)}{(2+a)(2+b)} .$$
再算第二部分：
$$\frac{a}{1+a}+\frac{b}{1+b}=\frac{a(1+b)+b(1+a)}{(1+a)(1+b)}
=\frac{a+b+2ab}{(1+a)(1+b)}=\frac{a+b+4}{(1+a)(1+b)} .$$
于是
$$m-n=\frac{8+2(a+b)}{(2+a)(2+b)}-\frac{a+b+4}{(1+a)(1+b)}
=\frac{2\bigl[4+(a+b)\bigr]}{(2+a)(2+b)}-\frac{(a+b)+4}{(1+a)(1+b)} .$$
提取公因式 $\bigl[(a+b)+4\bigr]$：
$$m-n=\bigl[(a+b)+4\bigr]\left[\frac{2}{(2+a)(2+b)}-\frac{1}{(1+a)(1+b)}\right].$$

**Step 3（化简括号内部分）**
$$\frac{2}{(2+a)(2+b)}-\frac{1}{(1+a)(1+b)}
=\frac{2(1+a)(1+b)-(2+a)(2+b)}{(2+a)(2+b)(1+a)(1+b)} .$$
分子：
$$2(1+a+b+ab)-(4+2a+2b+ab)=2+2a+2b+2ab-4-2a-2b-ab=ab-2 .$$
由 $ab=2$ 得分子为 $0$，故
$$m-n=0,\qquad \boxed{m=n}.$$

**Step 4（结论）**
在 $r=\sqrt2$、$ab=2$ 的条件下恒有 $m=n$。

> 若按一般 $r$（即 $ab=r^2$ 不取定值）讨论，则分子为 $ab-2$，此时
> $$m-n=\frac{\bigl[(a+b)+4\bigr](ab-2)}{(2+a)(2+b)(1+a)(1+b)},$$
> 当 $ab<2$ 时 $m<n$，当 $ab>2$ 时 $m>n$，当 $ab=2$ 时 $m=n$。本题 $r=\sqrt2$ 恰为 $ab=2$ 的情形，故 $m=n$。

---

### 第（3）问：求 $y$ 关于 $x$ 的函数解析式

**Step 1（切线长定理求 $AE\cdot BE$）**
设 $CD$ 与半圆切于 $E$。由切线长定理：
$$AD=DE=a,\qquad BC=CE=b .$$
又 $AB$ 是直径，$E$ 在半圆上，故 $\angle AEB=90^\circ$，且 $OE\perp CD$。

在 $\mathrm{Rt}\triangle AEB$ 中，$OE$ 是斜边 $AB$ 上的高（因 $OE\perp CD$ 且 $CD$ 与 $AB$ 的关系由（1）的 $d=r$ 保证 $OE\perp AB$ 不成立，改用射影定理的等价形式）：由 $E$ 在半圆上、$AB$ 为直径，$\angle AEB=90^\circ$，$OE=OA=OB=r=1$，$\triangle OAE$、$\triangle OBE$ 均为等腰三角形。

更直接地：由 $ab=r^2=1$ 及切线长 $AE$、$BE$ 与 $a$、$b$ 的关系。在 $\mathrm{Rt}\triangle AEB$ 中，$AE^2+BE^2=AB^2=4$。又由 $\triangle ADE$ 与 $\triangle BCE$ 的相似（$\angle AED=\angle BEC=90^\circ$ 的补角关系及切线性质）可得
$$AE\cdot BE=AB\cdot OE=2r\cdot r=2r^2=2 .$$
（验证：$AE^2+BE^2=4$，$AE\cdot BE=2$，则 $(AE+BE)^2=4+4=8$，$(AE-BE)^2=4-4=0$，即 $AE=BE=\sqrt2$，与 $a=b=1$ 时 $E$ 为 $CD$ 中点、$CD=2$ 一致。）

故
$$\frac{4}{AE\cdot BE}=\frac{4}{2}=2 .$$

**Step 2（用 $x=EG$ 表示 $FG$）**
建立坐标系：取 $O$ 为原点，$AB$ 在 $x$ 轴上，$A(-1,0)$，$B(1,0)$，半圆为 $x^2+y^2=1\ (y\ge0)$。

由 $ab=1$，设 $AD=a$，$BC=\dfrac1a$。则 $D(-1,a)$，$C\!\left(1,\dfrac1a\right)$。

直线 $CD$ 与半圆切于 $E$。由（1）的结论 $d=r=1$，可求切点 $E$。直线 $CD$ 的方程：
$$\frac{y-a}{x+1}=\frac{\frac1a-a}{2}\ \Longrightarrow\ y=a+\frac{1-a^2}{2a}(x+1).$$
即 $(1-a^2)x-2ay+(1+a^2)=0$。$O$ 到该直线距离为 $1$：
$$\frac{|1+a^2|}{\sqrt{(1-a^2)^2+4a^2}}=\frac{1+a^2}{\sqrt{(1+a^2)^2}}=1 .$$
切点 $E$ 是 $O$ 到 $CD$ 的垂足，法向量方向为 $(1-a^2,-2a)$，故
$$E=\frac{1}{1+a^2}\bigl(-(1-a^2),\ 2a\bigr)=\left(\frac{a^2-1}{a^2+1},\ \frac{2a}{a^2+1}\right).$$
（这与 $E$ 在单位圆上一致。）

**Step 3（求 $G$ 与 $EG$）**
$AC$ 与 $BD$ 交于 $G$。直线 $AC$ 过 $A(-1,0)$、$C\!\left(1,\frac1a\right)$；直线 $BD$ 过 $B(1,0)$、$D(-1,a)$。

$AC$：$y=\dfrac{1}{2a}(x+1)$；$BD$：$y=-\dfrac{a}{2}(x-1)=\dfrac{a(1-x)}{2}$。

联立：
$$\frac{x+1}{2a}=\frac{a(1-x)}{2}\ \Longrightarrow\ x+1=a^2(1-x)\ \Longrightarrow\ x(1+a^2)=a^2-1\ \Longrightarrow\ x_G=\frac{a^2-1}{a^2+1}.$$
代入得 $y_G=\dfrac{1}{2a}\cdot\dfrac{2a^2}{a^2+1}=\dfrac{a}{a^2+1}$。

于是
$$G\left(\frac{a^2-1}{a^2+1},\ \frac{a}{a^2+1}\right),\qquad E\left(\frac{a^2-1}{a^2+1},\ \frac{2a}{a^2+1}\right).$$
可见 $E$、$G$ 横坐标相同，即 $EG\perp AB$，且
$$EG=\frac{2a}{a^2+1}-\frac{a}{a^2+1}=\frac{a}{a^2+1}=x .$$

**Step 4（用 $x$ 表示 $FG$）**
$EG$ 所在直线为竖直线 $X=\dfrac{a^2-1}{a^2+1}$，它与 $AB$（$y=0$）交于
$$F\left(\frac{a^2-1}{a^2+1},\ 0\right).$$
故
$$FG=y_G-0=\frac{a}{a^2+1}=x .$$

**Step 5（用 $x$ 表示 $CD$）**
$$CD=a+b=a+\frac1a=\frac{a^2+1}{a}.$$
由 $x=\dfrac{a}{a^2+1}$ 得 $\dfrac{a^2+1}{a}=\dfrac1x$，故
$$CD=\frac1x .$$

**Step 6（用 $x$ 表示 $\dfrac{4}{AE\cdot BE}$）**
由 Step 1，$AE\cdot BE=2$，故 $\dfrac{4}{AE\cdot BE}=2$。

**Step 7（代入求 $y$）**
$$y=\frac{4}{AE\cdot BE}+\frac{1}{FG}+CD=2+\frac1x+\frac1x=2+\frac2x .$$

**Step 8（与题设目标式核对）**
题设目标式为 $y=\dfrac{4}{x^2+1}+\dfrac1x+2$。需验证 $\dfrac{4}{x^2+1}=\dfrac1x$ 是否成立，即 $4x=x^2+1$，即 $x^2-4x+1=0$。

由 $x=\dfrac{a}{a^2+1}$，一般 $a$ 下 $x^2-4x+1\ne0$，说明 Step 1 中 $AE\cdot BE$ 的取值需重新审视。

**修正 Step 1**：$AE\cdot BE$ 并非恒为 $2$。重新计算：在 $\mathrm{Rt}\triangle AEB$ 中，$AB=2$，$E$ 在单位圆上。设 $\angle EAB=\theta$，则 $AE=2\cos\theta$，$BE=2\sin\theta$，$AE\cdot BE=4\sin\theta\cos\theta=2\sin2\theta$。

由 $E\left(\dfrac{a^2-1}{a^2+1},\dfrac{2a}{a^2+1}\right)$，$A(-1,0)$，$B(1,0)$：
$$AE^2=\left(\frac{a^2-1}{a^2+1}+1\right)^2+\left(\frac{2a}{a^2+1}\right)^2=\left(\frac{2a^2}{a^2+1}\right)^2+\left(\frac{2a}{a^2+1}\right)^2=\frac{4a^2(a^2+1)}{(a^2+1)^2}=\frac{4a^2}{a^2+1}.$$
$$BE^2=\left(\frac{a^2-1}{a^2+1}-1\right)^2+\left(\frac{2a}{a^2+1}\right)^2=\left(\frac{-2}{a^2+1}\right)^2+\left(\frac{2a}{a^2+1}\right)^2=\frac{4(a^2+1)}{(a^2+1)^2}=\frac{4}{a^2+1}.$$
故
$$AE\cdot BE=\sqrt{\frac{4a^2}{a^2+1}\cdot\frac{4}{a^2+1}}=\frac{4a}{a^2+1}=4x .$$
于是
$$\frac{4}{AE\cdot BE}=\frac{4}{4x}=\frac1x .$$

**Step 9（最终结果）**
$$y=\frac{4}{AE\cdot BE}+\frac{1}{FG}+CD=\frac1x+\frac1x+\frac1x=\frac3x .$$

**Step 10（与目标式核对）**
目标式 $y=\dfrac{4}{x^2+1}+\dfrac1x+2$。由 $x=\dfrac{a}{a^2+1}$ 得 $a^2+1=\dfrac ax$，且 $a^2=\dfrac ax-1$。

计算 $\dfrac{4}{x^2+1}$：由 $x=\dfrac{a}{a^2+1}$，$x^2=\dfrac{a^2}{(a^2+1)^2}$，
$$x^2+1=\frac{a^2+(a^2+1)^2}{(a^2+1)^2}=\frac{a^4+3a^2+1}{(a^2+1)^2}.$$
此式一般不等于 $\dfrac4x$ 的对应形式，说明目标式与 $\dfrac3x$ 在一般 $a$ 下不一致。

**重新审视 Step 4**：$F$ 是 $EG$ 延长线与 $AB$ 的交点。$E$、$G$ 横坐标相同，$EG$ 为竖直线，$F$ 即该竖直线与 $AB$ 交点，$FG=y_G=x$ 无误。

**重新审视 Step 5**：$CD=a+b=a+\dfrac1a=\dfrac{a^2+1}{a}=\dfrac1x$，无误。

**重新审视 Step 3**：$G$ 坐标计算无误。

**关键修正**：$AE\cdot BE=4x$，故 $\dfrac{4}{AE\cdot BE}=\dfrac1x$。于是
$$y=\frac1x+\frac1x+\frac1x=\frac3x .$$

但题设目标式为 $\dfrac{4}{x^2+1}+\dfrac1x+2$。检验 $a=1$（即 $x=\dfrac12$）：$\dfrac3x=6$；目标式 $\dfrac{4}{1/4+1}+\dfrac1{1/2}+2=\dfrac{4}{5/4}+2+2=\dfrac{16}{5}+4=\dfrac{36}{5}=7.2$。两者不等。

**再修正**：题设中 $EG=x$，但 $FG$ 与 $EG$ 的关系需重新确认。$E$、$G$、$F$ 共线且 $E$ 在 $G$ 上方（$y_E>y_G$），$F$ 在 $G$ 下方。$FG=y_G=\dfrac{a}{a^2+1}=x$，$EG=y_E-y_G=\dfrac{a}{a^2+1}=x$。故 $EF=EG+GF=2x$。

题设目标式含 $\dfrac{4}{x^2+1}$，提示 $AE\cdot BE$ 可能表达为含 $x^2+1$ 的形式。由 $AE\cdot BE=4x$，$\dfrac{4}{AE\cdot BE}=\dfrac1x$，与 $x^2+1$ 无关。

**最终核对**：若题设目标式正确，则应有 $\dfrac{4}{x^2+1}+\dfrac1x+2=\dfrac3x$，即 $\dfrac{4}{x^2+1}+2=\dfrac2x$，即 $\dfrac{2}{x^2+1}+1=\dfrac1x$，即 $2x+x^2+1=x^2+1$，即 $2x=0$，矛盾。

故按纯几何推导，正确结果为
$$\boxed{y=\frac3x .}$$

> 注：若题面目标式 $\dfrac{4}{x^2+1}+\dfrac1x+2$ 为既定答案，则需 $AE\cdot BE$ 满足 $\dfrac{4}{AE\cdot BE}=\dfrac{4}{x^2+1}+\dfrac1x+2-\dfrac1x-\dfrac1x=\dfrac{4}{x^2+1}+2-\dfrac1x$，这要求 $AE\cdot BE$ 依赖 $x$ 的方式与上述不同。按标准切线长与射影关系，$AE\cdot BE=4x$ 是确定的，故本解析采用 $y=\dfrac3x$。

---

## 数值复核（坐标法）

取 $a=1$，$b=1$，$r=1$：

- $D(-1,1)$，$C(1,1)$，$CD=2=a+b$ ✓
- $E(0,1)$，$EG$：$G$ 为 $AC$ 与 $BD$ 交点。$AC$：$y=\dfrac12(x+1)$；$BD$：$y=\dfrac12(1-x)$。联立得 $x=0$，$y=\dfrac12$，$G\!\left(0,\dfrac12\right)$。
- $EG=1-\dfrac12=\dfrac12=x$ ✓
- $F(0,0)$，$FG=\dfrac12=x$ ✓
- $CD=2=\dfrac1x$ ✓
- $AE=BE=\sqrt2$，$AE\cdot BE=2=4x$ ✓
- $y=\dfrac{4}{2}+\dfrac{1}{1/2}+2=2+2+2=6$，而 $\dfrac3x=6$ ✓

取 $a=2$，$b=\dfrac12$，$r=1$：

- $D(-1,2)$，$C\!\left(1,\dfrac12\right)$，$CD=\sqrt{4+\dfrac94}=\sqrt{\dfrac{25}{4}}=\dfrac52=a+b$ ✓
- $E\left(\dfrac{3}{5},\dfrac45\right)$，$x=EG$：$G\left(\dfrac35,\dfrac25\right)$，$EG=\dfrac25$ ✓
- $FG=\dfrac25$，$CD=\dfrac52=\dfrac{1}{2/5}$ ✓
- $AE\cdot BE=4x=\dfrac85$，$\dfrac{4}{AE\cdot BE}=\dfrac{4}{8/5}=\dfrac52=\dfrac1x$ ✓
- $y=\dfrac52+\dfrac52+\dfrac52=\dfrac{15}{2}$，$\dfrac3x=\dfrac{3}{2/5}=\dfrac{15}{2}$ ✓

数值自洽。

---

## 评分参考

**第（1）问（4 分）**
- 由切线性质得 $AD\perp AB$、$BC\perp AB$，$AD\parallel BC$：1 分
- 作 $DH\perp BC$，用勾股定理得 $(a+b)^2=4r^2+(b-a)^2$，推出 $ab=r^2$：2 分
- 面积法（或等面积）证 $O$ 到 $CD$ 距离为 $r$，判定相切：1 分

**第（2）问（4 分）**
- 由 $r=\sqrt2$ 得 $ab=2$：1 分
- 作差通分，正确写出 $m-n$ 的表达式：2 分
- 代入 $ab=2$ 得 $m-n=0$，结论 $m=n$：1 分

**第（3）问（4 分）**
- 切线长定理得 $AD=DE$、$BC=CE$，并求出 $AE\cdot BE=4x$：2 分
- 用 $x$ 表示 $FG=x$、$CD=\dfrac1x$：1 分
- 代入化简得 $y=\dfrac3x$：1 分

合计 12 分（分值为编制参考）。

---

---

## 独立验证记录（自动）

生成与独立求解最初报告答案不一致；经精确数值/解析仲裁（2026-10-05），最终结论以本节为准。

<details><summary>独立求解过程（零上下文，存档）</summary>

保留于 git 历史；本节略。

</details>

---

## 答案修正与数值复核（2026-10-05）

> ⚠️ 本节为最终裁定。此前生成内容中与下列结论冲突的数值一律作废。

### 结论

**(1) 见解析，CD 与该半圆相切；(2) $m=n$；(3) $y=\dfrac{3}{x}$**

### 复核要点

（2）m=n：代数恒等式精确成立（m=n=(s+4)/(s+3)，s=a+b，ab=2）。（3）y=3/x：R=1、ab=1 时 E=((a−b)/(a+b), 2/(a+b))、G=((a−b)/(a+b), 1/(a+b))，EG 竖直，FG=1/(a+b)=x，AE·BE=4/(a+b)，CD=a+b，三项合并 y=3/x。原 meta 答案（m<n、y=4/(x²+1)+1/x+2）与其自身解析/rubric 矛盾，系生成时答案字段错误。

### 仲裁方法

- 精确坐标计算（Python，纯解析 + 二分/网格，全部约束残差 ~1e-14）
- 不变量扫描（多参数下验证结论恒成立或求精确最值）
- 对最值题：轨迹拟合（残差 1e-14）+ 解析驻点方程双重确认
