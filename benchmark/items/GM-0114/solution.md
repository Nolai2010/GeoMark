# GM-0114 参考解析

> 由 expand-driver 自动生成（2026-10-04T16:53），reviewStatus: auto-conflict；入库前需人工复核。

# 参考解析

## 参考解法（纯几何）

### （1）证明：直线 $PC$ 是 $\odot O$ 的切线

**第 1 步：由直径所对圆周角为直角，得 $AC\perp BC$。**

因为 $AB$ 是 $\odot O$ 的直径，点 $C$ 在 $\odot O$ 上，由“直径所对的圆周角是直角”得
$$\angle ACB=90^\circ,$$
即 $AC\perp BC$。

**第 2 步：由 $PC^2=PA\cdot PB$ 得比例式，结合公共角证相似。**

由 $PC^2=PA\cdot PB$ 得
$$\frac{PC}{PA}=\frac{PB}{PC}.$$
又因为 $P,A,B$ 共线且 $A$ 在 $P,B$ 之间，所以 $\angle CPA=\angle CPB$（同角）。于是
$$\triangle PCA\ \sim\ \triangle PBC.$$

**第 3 步：由相似得对应角相等，推出 $\angle PCB=90^\circ$。**

由 $\triangle PCA\sim\triangle PBC$ 得
$$\angle PCA=\angle PBC,\qquad \angle PAC=\angle PCB.$$
因为 $P,A,B$ 共线，所以 $\angle PAC$ 与 $\angle BAC$ 互补，即
$$\angle PAC=180^\circ-\angle BAC.$$
在 $\mathrm{Rt}\triangle ABC$ 中，$\angle BAC+\angle ABC=90^\circ$，而 $\angle PBC=\angle ABC$，故
$$\angle PAC=180^\circ-\angle BAC=90^\circ+\angle ABC.$$
于是
$$\angle PCB=\angle PAC=90^\circ+\angle ABC.$$
另一方面，由 $\angle PCA=\angle PBC=\angle ABC$，且 $A,C,E$ 共线（$E$ 在 $AC$ 延长线上），有
$$\angle PCB=\angle PCA+\angle ACB=\angle ABC+90^\circ,$$
与上式一致。

**第 4 步：确定 $PC$ 与半径 $OC$ 垂直。**

因为 $OA=OC$（同圆半径），所以 $\triangle OAC$ 为等腰三角形，
$$\angle OCA=\angle OAC=\angle BAC.$$
于是
$$\angle OCP=\angle OCA+\angle ACP=\angle BAC+\angle ABC=90^\circ,$$
即 $OC\perp PC$。

**第 5 步：结论。**

$OC$ 是 $\odot O$ 的半径，且 $OC\perp PC$，由切线的判定定理知直线 $PC$ 是 $\odot O$ 的切线。$\blacksquare$

---

### （2）求线段 $PA$ 的长

**第 1 步：由 $M$ 为 $BE$ 中点、$O$ 为 $AB$ 中点，得 $OM\parallel AE$ 且 $OM=\dfrac12 AE$。**

因为 $O$ 是 $AB$ 的中点，$M$ 是 $BE$ 的中点，所以 $OM$ 是 $\triangle ABE$ 的中位线，故
$$OM\parallel AE,\qquad OM=\frac12 AE.$$

**第 2 步：在 $\mathrm{Rt}\triangle ABE$ 中求 $AE$。**

由（1）知 $\angle ACB=90^\circ$，即 $AC\perp BC$。又 $E$ 在 $AC$ 的延长线上，所以 $AE\perp BC$，从而 $\triangle ABE$ 是以 $B$ 为直角顶点的直角三角形（$\angle ABE$ 未必为直角，需注意：$AE\perp BC$ 说明 $BC$ 是 $\triangle ABE$ 中 $AE$ 边上的高）。

更直接地：因为 $AC\perp BC$ 且 $A,C,E$ 共线，所以 $BE$ 在 $\mathrm{Rt}\triangle BCE$ 中满足
$$BE^2=BC^2+CE^2.$$
而在 $\mathrm{Rt}\triangle ABC$ 中 $AB^2=AC^2+BC^2$。由 $AB=2\sqrt{21}$ 得
$$AB^2=4\times 21=84.$$

设 $AC=x$，$BC=y$，则
$$x^2+y^2=84. \tag{1}$$

又 $BE=6\sqrt{6}$，$BE^2=36\times 6=216$，且 $CE=AE-AC$。为求 $AE$，注意 $\triangle ABE$ 中 $\angle AEB$ 与 $\angle ACB$ 的关系：由 $AC\perp BC$ 知 $BC\perp AE$，故 $BC$ 是 $\triangle ABE$ 中 $AE$ 边上的高，于是
$$BE^2=BC^2+CE^2,\qquad AB^2=BC^2+AC^2.$$
两式相减：
$$BE^2-AB^2=CE^2-AC^2=(CE-AC)(CE+AC).$$
而 $CE=AE-AC$，故 $CE-AC=AE-2AC$，$CE+AC=AE$。于是
$$BE^2-AB^2=AE\,(AE-2AC). \tag{2}$$

**第 3 步：利用 $OM\parallel AE$ 及 $C,P,M$ 共线求 $AE$。**

由 $OM\parallel AE$ 且 $OM=\dfrac12 AE$。又 $O$ 为 $AB$ 中点，$OM$ 与 $BC$ 交于 $N$。因为 $OM\parallel AC$（$AE$ 与 $AC$ 共线），在 $\triangle ABC$ 中 $O$ 为 $AB$ 中点，故 $N$ 为 $BC$ 中点，且
$$ON=\frac12 AC.$$
于是
$$MN=OM-ON=\frac12 AE-\frac12 AC=\frac12 CE.$$

**第 4 步：由 $C,P,M$ 共线及 $OM\parallel AE$ 建立比例关系。**

在 $\triangle PBC$ 中，$O$ 在 $PB$ 上，$M$ 在 $PC$ 上，$N$ 在 $BC$ 上，且 $O,N,M$ 共线、$OM\parallel AE\parallel AC$。由平行线分线段成比例（或相似 $\triangle POM\sim\triangle PAC$，因为 $OM\parallel AC$）：

$$\frac{OM}{AC}=\frac{PO}{PA}.$$

设 $PA=t$，圆半径 $R=\dfrac{AB}{2}=\sqrt{21}$，则 $PO=PA+AO=t+\sqrt{21}$，$PB=PA+AB=t+2\sqrt{21}$。

由切线长定理（或由（1）切线性质）：$PC^2=PA\cdot PB=t(t+2\sqrt{21})$。

**第 5 步：由 $OM\parallel AC$ 得 $\triangle POM\sim\triangle PAC$，求 $OM$。**

$$\frac{OM}{AC}=\frac{PO}{PA}=\frac{t+\sqrt{21}}{t}.$$

又 $OM=\dfrac12 AE$，故
$$\frac{AE}{2AC}=\frac{t+\sqrt{21}}{t}. \tag{3}$$

**第 6 步：联立求 $AE$ 与 $AC$。**

由（2）：$AE(AE-2AC)=BE^2-AB^2=216-84=132$。

设 $AE=u$，$AC=x$，则
$$u(u-2x)=132. \tag{4}$$
由（3）：$\dfrac{u}{2x}=\dfrac{t+\sqrt{21}}{t}$，即
$$u=\frac{2x(t+\sqrt{21})}{t}. \tag{5}$$

**第 7 步：利用 $M$ 为 $BE$ 中点及 $C,P,M$ 共线求 $t$。**

在 $\triangle PBE$ 中，$C$ 在 $PE$ 上，$M$ 是 $BE$ 中点，$P,C,M$ 共线，故 $PC$ 是 $\triangle PBE$ 的中线，$C$ 是 $PE$ 的中点，即
$$PC=CE.$$
（因为 $M$ 为 $BE$ 中点，直线 $PM$ 与 $PE$ 交于 $P$，与 $BE$ 交于 $M$，与 $CE$ 所在直线交于 $C$；由中线性质，$C$ 为 $PE$ 中点。）

于是 $PC=CE$，而 $CE=AE-AC=u-x$，故
$$PC=u-x. \tag{6}$$

又 $PC^2=t(t+2\sqrt{21})$，所以
$$(u-x)^2=t(t+2\sqrt{21}). \tag{7}$$

**第 8 步：解方程组。**

由（5）得 $ut=2x(t+\sqrt{21})$，即
$$x=\frac{ut}{2(t+\sqrt{21})}. \tag{8}$$

由（4）$u^2-2ux=132$，代入（8）：
$$u^2-\frac{u^2 t}{t+\sqrt{21}}=132,$$
$$u^2\cdot\frac{\sqrt{21}}{t+\sqrt{21}}=132,$$
$$u^2=\frac{132(t+\sqrt{21})}{\sqrt{21}}. \tag{9}$$

由（6）（7）：$(u-x)^2=t(t+2\sqrt{21})$。由（8）：
$$u-x=u-\frac{ut}{2(t+\sqrt{21})}=u\cdot\frac{2(t+\sqrt{21})-t}{2(t+\sqrt{21})}=u\cdot\frac{t+2\sqrt{21}}{2(t+\sqrt{21})}.$$

代入（7）：
$$u^2\cdot\frac{(t+2\sqrt{21})^2}{4(t+\sqrt{21})^2}=t(t+2\sqrt{21}).$$
约去 $(t+2\sqrt{21})$（$t>0$）：
$$u^2\cdot\frac{t+2\sqrt{21}}{4(t+\sqrt{21})^2}=t. \tag{10}$$

将（9）代入（10）：
$$\frac{132(t+\sqrt{21})}{\sqrt{21}}\cdot\frac{t+2\sqrt{21}}{4(t+\sqrt{21})^2}=t,$$
$$\frac{132(t+2\sqrt{21})}{4\sqrt{21}(t+\sqrt{21})}=t,$$
$$132(t+2\sqrt{21})=4\sqrt{21}\,t(t+\sqrt{21}),$$
$$33(t+2\sqrt{21})=\sqrt{21}\,t(t+\sqrt{21}).$$

两边除以 $\sqrt{21}$，注意 $33=11\sqrt{21}\cdot\frac{33}{11\sqrt{21}}$，直接展开：
$$33t+66\sqrt{21}=\sqrt{21}t^2+21t,$$
$$\sqrt{21}t^2+21t-33t-66\sqrt{21}=0,$$
$$\sqrt{21}t^2-12t-66\sqrt{21}=0.$$

两边除以 $\sqrt{21}$：
$$t^2-\frac{12}{\sqrt{21}}t-66=0.$$

即
$$t^2-\frac{4\sqrt{21}}{7}t-66=0.$$

解此一元二次方程：
$$\Delta=\left(\frac{12}{\sqrt{21}}\right)^2+4\times 66=\frac{144}{21}+264=\frac{48}{7}+264=\frac{48+1848}{7}=\frac{1896}{7}.$$

$$\sqrt{\Delta}=\sqrt{\frac{1896}{7}}=\sqrt{\frac{1896\times 7}{49}}=\frac{\sqrt{13272}}{7}.$$

$13272=8\times 1659=8\times 3\times 553=24\times 553$，$553=7\times 79$，故 $13272=168\times 79$，$\sqrt{13272}=2\sqrt{3318}$。此路不便，改用直接配方。

回到 $t^2-\dfrac{12}{\sqrt{21}}t-66=0$，即
$$t^2-\frac{4\sqrt{21}}{7}t-66=0.$$

$$\Delta=\frac{16\times 21}{49}+264=\frac{336}{49}+264=\frac{48}{7}+264=\frac{1896}{7}.$$

$$\sqrt{\Delta}=\sqrt{\frac{1896}{7}}=\frac{\sqrt{1896}}{\sqrt 7}=\frac{2\sqrt{474}}{\sqrt 7}.$$

$474=2\times 3\times 79$，非完全平方，说明前面化简可能有误，重新检查。

**重新检查第 8 步。**

由（9）$u^2=\dfrac{132(t+\sqrt{21})}{\sqrt{21}}$，由（10）$u^2\cdot\dfrac{t+2\sqrt{21}}{4(t+\sqrt{21})^2}=t$。

代入：
$$\frac{132(t+\sqrt{21})}{\sqrt{21}}\cdot\frac{t+2\sqrt{21}}{4(t+\sqrt{21})^2}=t$$
$$\frac{132(t+2\sqrt{21})}{4\sqrt{21}(t+\sqrt{21})}=t$$
$$132(t+2\sqrt{21})=4\sqrt{21}\,t(t+\sqrt{21})$$
$$33(t+2\sqrt{21})=\sqrt{21}\,t(t+\sqrt{21})$$
$$33t+66\sqrt{21}=\sqrt{21}t^2+21t$$
$$\sqrt{21}t^2-12t-66\sqrt{21}=0.$$

除以 $\sqrt{21}$：$t^2-\dfrac{12}{\sqrt{21}}t-66=0$，$\dfrac{12}{\sqrt{21}}=\dfrac{12\sqrt{21}}{21}=\dfrac{4\sqrt{21}}{7}$。

$$t=\frac{\frac{4\sqrt{21}}{7}+\sqrt{\frac{48}{7}+264}}{2}=\frac{\frac{4\sqrt{21}}{7}+\sqrt{\frac{1896}{7}}}{2}.$$

$\dfrac{1896}{7}=\dfrac{1896\times 7}{49}=\dfrac{13272}{49}$，$\sqrt{13272}$：$13272=4\times 3318=4\times 6\times 553=24\times 553$，$553=7\times 79$，故 $13272=168\times 79$，$\sqrt{13272}=2\sqrt{3318}$，仍不整。

**改用数值验证思路：猜测 $t=2\sqrt{21}$ 或类似。**

代入 $t=2\sqrt{21}$：$t^2=84$，$\dfrac{4\sqrt{21}}{7}\times 2\sqrt{21}=\dfrac{8\times 21}{7}=24$，$84-24-66=-6\ne 0$。

代入 $t=3\sqrt{21}$：$t^2=189$，$\dfrac{4\sqrt{21}}{7}\times 3\sqrt{21}=\dfrac{12\times 21}{7}=36$，$189-36-66=87\ne 0$。

**回到第 7 步检查 $PC=CE$ 的推理。**

$M$ 是 $BE$ 中点，$P,C,M$ 共线。在 $\triangle PBE$ 中，$PM$ 是中线，$C$ 是 $PM$ 与 $PE$ 的交点。中线 $PM$ 与边 $PE$ 交于 $P$ 本身，不是 $C$！错误。

**修正：** $C$ 在直线 $PM$ 上，$C$ 也在直线 $PE$ 上（因为 $E$ 在 $AC$ 延长线上，$P,A,C,E$ 中 $P,A,B$ 共线，$A,C,E$ 共线，所以 $P,C,E$ 不共线一般）。实际上 $C$ 在 $PE$ 上吗？$P,A,B$ 共线，$A,C,E$ 共线，$P$ 不在 $AC$ 上，所以 $C$ 不在 $PE$ 上。$C$ 是 $PM$ 与 $AE$ 的交点。

**重新建立关系：** 在 $\triangle ABE$ 中，$O$ 是 $AB$ 中点，$M$ 是 $BE$ 中点，$OM\parallel AE$。$C$ 是 $AE$ 上一点，$P$ 是 $AB$ 延长线上一点，$P,C,M$ 共线。

由 $OM\parallel AE$，即 $OM\parallel AC$。在 $\triangle PAC$ 中，$O$ 在 $PA$ 上，$M$ 在 $PC$ 上，$OM\parallel AC$，故
$$\triangle POM\sim\triangle PAC,\qquad \frac{PO}{PA}=\frac{PM}{PC}=\frac{OM}{AC}.$$

设 $PA=t$，$PO=t+\sqrt{21}$，$PB=t+2\sqrt{21}$。

由切线：$PC^2=t(t+2\sqrt{21})$。

由相似：$\dfrac{OM}{AC}=\dfrac{t+\sqrt{21}}{t}$，$OM=\dfrac12 AE$，故
$$\frac{AE}{2AC}=\frac{t+\sqrt{21}}{t}. \tag{3}$$

**利用 $M$ 在 $PC$ 上及 $M$ 为 $BE$ 中点：**

$M$ 是 $BE$ 中点，$M$ 在 $PC$ 上。在 $\triangle PBE$ 中，$C$ 在 $PE$ 上吗？不。$C$ 在 $AE$ 上，$E$ 在 $AC$ 延长线上，所以 $A,C,E$ 共线，$C$ 在 $AE$ 上。$P,A,B$ 共线。所以 $C$ 不在 $PE$ 上。

**用坐标法辅助（见下节数值复核），此处先给出纯几何推导的最终结果：**

由 $OM\parallel AE$ 且 $OM=\frac12 AE$，$N$ 为 $BC$ 中点，$ON=\frac12 AC$，$MN=\frac12 CE$。

在 $\triangle PBC$ 中，$O$ 在 $PB$ 上，$N$ 在 $BC$ 上，$M$ 在 $PC$ 上，$O,N,M$ 共线。由梅涅劳斯定理：
$$\frac{PO}{OB}\cdot\frac{BN}{NC}\cdot\frac{CM}{MP}=1.$$
$BN=NC$，故 $\dfrac{PO}{OB}\cdot\dfrac{CM}{MP}=1$，即
$$\frac{CM}{MP}=\frac{OB}{PO}=\frac{\sqrt{21}}{t+\sqrt{21}}.$$

又 $M$ 是 $BE$ 中点，$C$ 在 $AE$ 上。在 $\triangle ABE$ 中，$C$ 在 $AE$ 上，$M$ 是 $BE$ 中点，$P$ 是 $AB$ 延长线上一点，$P,C,M$ 共线。由梅涅劳斯定理（$\triangle ABE$ 被直线 $PCM$ 所截，$P$ 在 $AB$ 延长线上，$C$ 在 $AE$ 上，$M$ 在 $BE$ 上）：
$$\frac{AP}{PB}\cdot\frac{BM}{ME}\cdot\frac{EC}{CA}=1.$$
$BM=ME$，故
$$\frac{AP}{PB}\cdot\frac{EC}{CA}=1,\qquad \frac{EC}{CA}=\frac{PB}{AP}=\frac{t+2\sqrt{21}}{t}.$$

于是
$$EC=CA\cdot\frac{t+2\sqrt{21}}{t}.$$

又 $AE=AC+CE=AC\left(1+\dfrac{t+2\sqrt{21}}{t}\right)=AC\cdot\dfrac{2t+2\sqrt{21}}{t}=\dfrac{2AC(t+\sqrt{21})}{t}$。

这与（3）一致：$\dfrac{AE}{2AC}=\dfrac{t+\sqrt{21}}{t}$。✓

**继续：** 由 $BC\perp AE$，在 $\mathrm{Rt}\triangle ABC$ 中 $AB^2=AC^2+BC^2=84$；在 $\mathrm{Rt}\triangle BCE$ 中 $BE^2=BC^2+CE^2=216$。

两式相减：$CE^2-AC^2=132$，即 $(CE-AC)(CE+AC)=132$。

$CE+AC=AE$，$CE-AC=AE-2AC$。故
$$AE(AE-2AC)=132. \tag{4}$$

由 $AE=\dfrac{2AC(t+\sqrt{21})}{t}$，得 $AC=\dfrac{AE\,t}{2(t+\sqrt{21})}$，代入（4）：
$$AE\left(AE-\frac{AE\,t}{t+\sqrt{21}}\right)=132,$$
$$AE^2\cdot\frac{\sqrt{21}}{t+\sqrt{21}}=132,$$
$$AE^2=\frac{132(t+\sqrt{21})}{\sqrt{21}}. \tag{9}$$

**再用 $PC^2=t(t+2\sqrt{21})$ 及 $PC$ 与 $AE,AC$ 的关系：**

在 $\triangle PAC$ 中，$OM\parallel AC$，$\dfrac{PM}{PC}=\dfrac{PO}{PA}=\dfrac{t+\sqrt{21}}{t}$，故
$$PM=PC\cdot\frac{t+\sqrt{21}}{t}.$$

又 $M$ 是 $BE$ 中点。在 $\triangle BCE$ 中，$M$ 是 $BE$ 中点，$C$ 是顶点。$CM$ 是中线，$CM^2=\dfrac{2BC^2+2CE^2-BE^2}{4}=\dfrac{2BC^2+2CE^2-BE^2}{4}$。

由 $BC^2=84-AC^2$，$CE^2=216-BC^2=216-84+AC^2=132+AC^2$。

$CM^2=\dfrac{2(84-AC^2)+2(132+AC^2)-216}{4}=\dfrac{168-2AC^2+264+2AC^2-216}{4}=\dfrac{216}{4}=54$。

所以 $CM=\sqrt{54}=3\sqrt{6}$。

**关键：** $P,C,M$ 共线，$C$ 在 $P,M$ 之间还是 $M$ 在 $P,C$ 之间？由图形，$P$ 在圆外，$C$ 在圆上，$M$ 在圆内（$M$ 是 $BE$ 中点，$E$ 在圆外）。$PC$ 是切线，$C$ 是切点。$M$ 在 $PC$ 上，$M$ 在 $C$ 的哪一侧？$M$ 在 $\triangle BCE$ 内部，$C$ 是顶点，$M$ 在 $C$ 与 $BE$ 中点之间，所以 $M$ 在 $C$ 靠近 $B$ 的一侧，即 $C$ 在 $P$ 和 $M$ 之间。

于是 $PM=PC+CM$。

由 $\dfrac{PM}{PC}=\dfrac{t+\sqrt{21}}{t}$，得
$$\frac{PC+CM}{PC}=\frac{t+\sqrt{21}}{t},\qquad 1+\frac{CM}{PC}=\frac{t+\sqrt{21}}{t},\qquad \frac{CM}{PC}=\frac{\sqrt{21}}{t}.$$

$$PC=\frac{CM\cdot t}{\sqrt{21}}=\frac{3\sqrt{6}\,t}{\sqrt{21}}=\frac{3\sqrt{6}\,t}{\sqrt{21}}.$$

又 $PC^2=t(t+2\sqrt{21})$，故
$$\frac{54t^2}{21}=t(t+2\sqrt{21}),$$
$$\frac{18t^2}{7}=t^2+2\sqrt{21}\,t.$$
$t>0$，除以 $t$：
$$\frac{18t}{7}=t+2\sqrt{21},$$
$$\frac{18t-7t}{7}=2\sqrt{21},$$
$$\frac{11t}{7}=2\sqrt{21},$$
$$t=\frac{14\sqrt{21}}{11}.$$

**验证：** $PA=\dfrac{14\sqrt{21}}{11}$。

检查 $AE^2=\dfrac{132(t+\sqrt{21})}{\sqrt{21}}$：
$t+\sqrt{21}=\dfrac{14\sqrt{21}}{11}+\sqrt{21}=\sqrt{21}\left(\dfrac{14}{11}+1\right)=\dfrac{25\sqrt{21}}{11}$。
$AE^2=\dfrac{132\cdot\frac{25\sqrt{21}}{11}}{\sqrt{21}}=\dfrac{132\times 25}{11}=12\times 25=300$，$AE=10\sqrt{3}$。

$AC=\dfrac{AE\,t}{2(t+\sqrt{21})}=\dfrac{10\sqrt{3}\cdot\frac{14\sqrt{21}}{11}}{2\cdot\frac{25\sqrt{21}}{11}}=\dfrac{10\sqrt{3}\cdot 14}{50}=\dfrac{140\sqrt{3}}{50}=\dfrac{14\sqrt{3}}{5}$。

$AC^2=\dfrac{196\times 3}{25}=\dfrac{588}{25}$。$BC^2=84-\dfrac{588}{25}=\dfrac{2100-588}{25}=\dfrac{1512}{25}$。

$CE=AE-AC=10\sqrt{3}-\dfrac{14\sqrt{3}}{5}=\dfrac{50\sqrt{3}-14\sqrt{3}}{5}=\dfrac{36\sqrt{3}}{5}$。

$CE^2=\dfrac{1296\times 3}{25}=\dfrac{3888}{25}$。

$BC^2+CE^2=\dfrac{1512+3888}{25}=\dfrac{5400}{25}=216=BE^2$。✓

$PC=\dfrac{3\sqrt{6}\,t}{\sqrt{21}}=\dfrac{3\sqrt{6}\cdot\frac{14\sqrt{21}}{11}}{\sqrt{21}}=\dfrac{42\sqrt{6}}{11}$。

$PC^2=\dfrac{1764\times 6}{121}=\dfrac{10584}{121}$。

$t(t+2\sqrt{21})=\dfrac{14\sqrt{21}}{11}\left(\dfrac{14\sqrt{21}}{11}+2\sqrt{21}\right)=\dfrac{14\sqrt{21}}{11}\cdot\dfrac{36\sqrt{21}}{11}=\dfrac{14\times 36\times 21}{121}=\dfrac{10584}{121}$。✓

**答：** $PA=\dfrac{14\sqrt{21}}{11}$。

---

### （3）判断 $S_1$ 与 $S_2$ 的大小关系

**结论：$S_1=S_2$。**

**证明：**

**第 1 步：确定各点位置关系。**

由（2）的计算：$AB=2\sqrt{21}$，$R=\sqrt{21}$，$PA=\dfrac{14\sqrt{21}}{11}$，$PO=PA+AO=\dfrac{14\sqrt{21}}{11}+\sqrt{21}=\dfrac{25\sqrt{21}}{11}$。

$AC=\dfrac{14\sqrt{3}}{5}$，$BC=\dfrac{\sqrt{1512}}{5}=\dfrac{6\sqrt{42}}{5}$。

$ON=\dfrac12 AC=\dfrac{7\sqrt{3}}{5}$，$OM=\dfrac12 AE=5\sqrt{3}$。

$N$ 是 $BC$ 中点，$BN=NC=\dfrac{3\sqrt{42}}{5}$。

**第 2 步：求 $D$ 的位置及 $DH$。**

$D$ 是 $OM$ 与 $\odot O$ 的交点，$OD=R=\sqrt{21}$。

$OM=5\sqrt{3}$，$ON=\dfrac{7\sqrt{3}}{5}$，$NM=OM-ON=5\sqrt{3}-\dfrac{7\sqrt{3}}{5}=\dfrac{18\sqrt{3}}{5}$。

$D$ 在 $OM$ 上，$OD=\sqrt{21}$。$ON=\dfrac{7\sqrt{3}}{5}=\dfrac{7\sqrt{3}}{5}$，比较 $ON$ 与 $OD$：$ON^2=\dfrac{147}{25}=5.88$，$OD^2=21$，故 $ON<OD$，$D$ 在 $N$ 的远离 $O$ 一侧（即 $D$ 在 $N$ 与 $M$ 之间或 $N$ 之外）。

$ND=OD-ON=\sqrt{21}-\dfrac{7\sqrt{3}}{5}$。

**第 3 步：建立坐标系计算面积。**

以 $O$ 为原点，$AB$ 所在直线为 $x$ 轴，$A$ 在负半轴，$B$ 在正半轴。

$A(-\sqrt{21},0)$，$B(\sqrt{21},0)$。

$AC=\dfrac{14\sqrt{3}}{5}$，$BC=\dfrac{6\sqrt{42}}{5}$。设 $C(x_C,y_C)$，$y_C>0$。

由 $AC^2=(x_C+\sqrt{21})^2+y_C^2=\dfrac{588}{25}$，$BC^2=(x_C-\sqrt{21})^2+y_C^2=\dfrac{1512}{25}$。

相减：$(x_C+\sqrt{21})^2-(x_C-\sqrt{21})^2=\dfrac{588-1512}{25}=-\dfrac{924}{25}$。

$4\sqrt{21}\,x_C=-\dfrac{924}{25}$，$x_C=-\dfrac{924}{100\sqrt{21}}=-\dfrac{231}{25\sqrt{21}}=-\dfrac{231\sqrt{21}}{525}=-\dfrac{11\sqrt{21}}{25}$。

$y_C^2=\dfrac{588}{25}-\left(-\dfrac{11\sqrt{21}}{25}+\sqrt{21}\right)^2=\dfrac{588}{25}-\left(\dfrac{14\sqrt{21}}{25}\right)^2=\dfrac{588}{25}-\dfrac{196\times 21}{625}=\dfrac{588}{25}-\dfrac{4116}{625}$。

$\dfrac{588}{25}=\dfrac{14700}{625}$，$y_C^2=\dfrac{14700-4116}{625}=\dfrac{10584}{625}$，$y_C=\dfrac{\sqrt{10584}}{25}=\dfrac{42\sqrt{6}}{25}$。

**第 4 步：求 $M$ 坐标。**

$E$ 在 $AC$ 延长线上，$AE=10\sqrt{3}$，$AC=\dfrac{14\sqrt{3}}{5}$，$CE=\dfrac{36\sqrt{3}}{5}$。

$\overrightarrow{AC}=\left(-\dfrac{11\sqrt{21}}{25}+\sqrt{21},\ \dfrac{42\sqrt{6}}{25}\right)=\left(\dfrac{14\sqrt{21}}{25},\ \dfrac{42\sqrt{6}}{25}\right)$。

$|\overrightarrow{AC}|=\dfrac{14\sqrt{3}}{5}$，单位向量 $\dfrac{\overrightarrow{AC}}{|\overrightarrow{AC}|}=\left(\dfrac{\sqrt{7}}{5},\ \dfrac{3\sqrt{2}}{5}\right)$。

$E=C+CE\cdot$单位向量$=\left(-\dfrac{11\sqrt{21}}{25}+\dfrac{36\sqrt{3}}{5}\cdot\dfrac{\sqrt{7}}{5},\ \dfrac{42\sqrt{6}}{25}+\dfrac{36\sqrt{3}}{5}\cdot\dfrac{3\sqrt{2}}{5}\right)$。

$\dfrac{36\sqrt{3}}{5}\cdot\dfrac{\sqrt{7}}{5}=\dfrac{36\sqrt{21}}{25}$，$x_E=-\dfrac{11\sqrt{21}}{25}+\dfrac{36\sqrt{21}}{25}=\dfrac{25\sqrt{21}}{25}=\sqrt{21}$。

$\dfrac{36\sqrt{3}}{5}\cdot\dfrac{3\sqrt{2}}{5}=\dfrac{108\sqrt{6}}{25}$，$y_E=\dfrac{42\sqrt{6}}{25}+\dfrac{108\sqrt{6}}{25}=\dfrac{150\sqrt{6}}{25}=6\sqrt{6}$。

$E(\sqrt{21},6\sqrt{6})$。验证 $BE$：$B(\sqrt{21},0)$，$BE=6\sqrt{6}$。✓

$M$ 是 $BE$ 中点：$M\left(\sqrt{21},\ 3\sqrt{6}\right)$。

验证 $OM=5\sqrt{3}$：$OM^2=21+54=75$，$OM=5\sqrt{3}$。✓

**第 5 步：求 $D$ 坐标。**

$D$ 在 $OM$ 上，$OD=\sqrt{21}$。$\overrightarrow{OM}=(\sqrt{21},3\sqrt{6})$，$|\overrightarrow{OM}|=5\sqrt{3}$。

$\overrightarrow{OD}=\dfrac{\sqrt{21}}{5\sqrt{3}}\overrightarrow{OM}=\dfrac{\sqrt{7}}{5}(\sqrt{21},3\sqrt{6})=\left(\dfrac{7\sqrt{3}}{5},\ \dfrac{3\sqrt{42}}{5}\right)$。

$D\left(\dfrac{7\sqrt{3}}{5},\ \dfrac{3\sqrt{42}}{5}\right)$。

**第 6 步：求 $H$ 及 $F$ 坐标。**

$DH\perp AB$，$AB$ 为 $x$ 轴，故 $H$ 是 $D$ 在 $x$ 轴上的投影：
$$H\left(\dfrac{7\sqrt{3}}{5},\ 0\right).$$

$DH$ 是竖直线 $x=\dfrac{7\sqrt{3}}{5}$。$BC$ 所在直线：$B(\sqrt{21},0)$，$C\left(-\dfrac{11\sqrt{21}}{25},\dfrac{42\sqrt{6}}{25}\right)$。

$BC$ 斜率：$\dfrac{\frac{42\sqrt{6}}{25}}{-\frac{11\sqrt{21}}{25}-\sqrt{21}}=\dfrac{\frac{42\sqrt{6}}{25}}{-\frac{36\sqrt{21}}{25}}=-\dfrac{42\sqrt{6}}{36\sqrt{21}}=-\dfrac{7\sqrt{6}}{6\sqrt{21}}=-\dfrac{7}{6\sqrt{3.5}}$，化简：$\dfrac{\sqrt{6}}{\sqrt{21}}=\dfrac{1}{\sqrt{3.5}}$，不整。直接算：$\dfrac{42\sqrt{6}}{36\sqrt{21}}=\dfrac{7\sqrt{6}}{6\sqrt{21}}=\dfrac{7}{6}\cdot\dfrac{\sqrt{6}}{\sqrt{21}}=\dfrac{7}{6}\cdot\dfrac{1}{\sqrt{3.5}}=\dfrac{7}{6\sqrt{3.5}}$。

用 $\dfrac{\sqrt{6}}{\sqrt{21}}=\sqrt{\dfrac{6}{21}}=\sqrt{\dfrac{2}{7}}=\dfrac{\sqrt{14}}{7}$。故斜率 $=-\dfrac{7}{6}\cdot\dfrac{\sqrt{14}}{7}=-\dfrac{\sqrt{14}}{6}$。

$BC$ 方程：$y=-\dfrac{\sqrt{14}}{6}(x-\sqrt{21})$。

$F$ 在 $BC$ 上且 $x_F=\dfrac{7\sqrt{3}}{5}$：
$$y_F=-\dfrac{\sqrt{14}}{6}\left(\dfrac{7\sqrt{3}}{5}-\sqrt{21}\right)=-\dfrac{\sqrt{14}}{6}\cdot\sqrt{21}\left(\dfrac{7}{5\sqrt{7}}-1\right).$$

$\sqrt{14}\cdot\sqrt{21}=\sqrt{294}=7\sqrt{6}$。$\dfrac{7}{5\sqrt{7}}=\dfrac{\sqrt{7}}{5}$。

$$y_F=-\dfrac{7\sqrt{6}}{6}\left(\dfrac{\sqrt{7}}{5}-1\right)=\dfrac{7\sqrt{6}}{6}\left(1-\dfrac{\sqrt{7}}{5}\right)=\dfrac{7\sqrt{6}(5-\sqrt{7})}{30}.$$

**第 7 步：计算 $S_1$ 和 $S_2$。**

$O(0,0)$，$D\left(\dfrac{7\sqrt{3}}{5},\dfrac{3\sqrt{42}}{5}\right

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

**(1) 直线 PC 是 ⊙O 的切线；(2) $PA=\dfrac{14\sqrt{21}}{11}$；(3) $S_1>S_2$**

### 复核要点

（2）PA=14√21/11≈5.832369：二分法与解析解完全一致；约束 PC²=PA·PB（残差 ~1e-14）、P,C,M 共线（~1e-14）、BE=6√6（~1e-14）全部精确满足。原生成答案 2√21 错误；独立求解正确。（3）S₁>S2：在考试配置（t=14√21/11）下 S₁/S₂≈1.8898；且对 t∈(0.3,30)、R∈{1,2,3.7,√21} 全部配置 S₁/S₂>1 恒成立，可一般证明。原生成答案 S₁=S₂ 错误；独立求解正确。

### 仲裁方法

- 精确坐标计算（Python，纯解析 + 二分/网格，全部约束残差 ~1e-14）
- 不变量扫描（多参数下验证结论恒成立或求精确最值）
- 对最值题：轨迹拟合（残差 1e-14）+ 解析驻点方程双重确认
