# run-deepseek-chat-2026-09-18（唯一一次真实完整运行）

- 模型 = judge = `deepseek-chat`，temperature 0，max_tokens 8192，2026-09-18
- 18 题 × 3 模式 = 54 次独立请求

**⚠️ 本结果早于 2026-09-19 的两次题库修订，不可与修订后的运行直接比较：**

1. 评分细则中立化（6 道 restricted 题的 rubric/answerKey 原用坐标法表述）
2. **pure 模式作用域收紧**：修订前 pure 跑在全部 18 题上，其中 3 道（GM-0007/0009/0010，现
   `coordinatePolicy: "allowed"`）的细则按坐标法给分，pure 下的均分混入了「方法被禁、细则只认
   该方法」的假阴性；修订后 pure 只对 8 道 restricted 题生效

当时的 datasetHash 为 `f73bdf36559c6e29`；现行清单为 `9750f94d6146dd40`。
仅提交 summary 三件套与 run-manifest（原始作答不入库，见根 .gitignore）。
