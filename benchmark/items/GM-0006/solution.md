# GM-0006 解析

## 正解

**第一步：证明 $AC \perp BD_1$。**
正方形 $ABCD$ 中对角线 $AC \perp BD$；直棱柱侧棱 $BB_1 \perp$ 底面 $ABCD$，故 $AC \perp BB_1$。
$AC$ 垂直于平面 $BDD_1B_1$ 内两条相交直线，故 $AC \perp$ 平面 $BDD_1B_1$；又 $BD_1 \subset$ 平面 $BDD_1B_1$，故 $AC \perp BD_1$。

**第二步：证明 $AB_1 \perp BD_1$。**
正方形 $ABB_1A_1$ 中对角线 $AB_1 \perp A_1B$；又 $A_1D_1 \perp$ 平面 $ABB_1A_1$（$A_1D_1 \perp A_1A$、$A_1D_1 \perp A_1B_1$），故 $A_1D_1 \perp AB_1$。
$AB_1$ 垂直于平面 $A_1BCD_1$ 内两条相交直线 $A_1B$、$A_1D_1$，故 $AB_1 \perp$ 平面 $A_1BCD_1$；$BD_1 \subset$ 平面 $A_1BCD_1$，故 $AB_1 \perp BD_1$。

**第三步：证明 $CB_1 \perp BD_1$。** 同理（正方形 $BCC_1B_1$ 中 $CB_1 \perp BC_1$；$AB \perp$ 平面 $BCC_1B_1$ 故 $AB \perp CB_1$；$CB_1 \perp$ 平面 $A_1BCD_1$），得 $CB_1 \perp BD_1$。

**第四步：** $AC \cap AB_1 = A$，且 $AC$、$AB_1 \subset$ 平面 $AB_1C$。$BD_1$ 垂直于平面内两条相交直线，故

$$BD_1 \perp \text{平面 } AB_1C \qquad \blacksquare$$

## 评分细则（满分 12 分）

| 步骤 | 得分点 | 分值 |
|---|---|---|
| ① | $AC \perp BD$、$AC \perp BB_1$ 各 1 分 | 2 |
| ② | 线面垂直判定得 $AC \perp$ 平面 $BDD_1B_1$，进而 $AC \perp BD_1$ | 2 |
| ③ | $AB_1 \perp A_1B$、$A_1D_1 \perp AB_1$，得 $AB_1 \perp$ 平面 $A_1BCD_1$，进而 $AB_1 \perp BD_1$ | 3 |
| ④ | 同理得 $CB_1 \perp BD_1$ | 2 |
| ⑤ | 指出 $AC \cap AB_1 = A$，线面垂直判定得 $BD_1 \perp$ 平面 $AB_1C$ | 3 |

**评分说明**：使用空间向量法（建系求法向量 $\vec n=(1,-1,1)$ 与 $\overrightarrow{BD_1}$ 平行）按三步给分：建系写坐标 3 分、验证 $BD_1$ 与平面内两向量垂直 6 分、结论 3 分。
