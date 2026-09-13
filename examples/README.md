# Examples / 示例

## sample-experiment/ — 示例实验包

由 Harness 对本地 mock 服务真实运行一次后原样拷贝而来（回答内容为 mock 回显，仅作**结构演示**）。

一个实验包 = 一次可复现的完整实验证据：

```text
sample-experiment/
├── config.json      本次请求的完整配置（模型 / 推理 / 运行控制）
├── prompt.txt       用户提示词原文
├── files/           附件（本示例无附件，目录保留）
├── request.json     适配器实际发送的 HTTP 请求（密钥脱敏）+ requestedConfig / resolvedConfig
├── events.jsonl     统一事件流（request_start → message_start → … → message_end，SHA-256 哈希成链）
├── raw/response.sse 服务端返回的原始字节流
├── result.json      最终回答 / 词元用量 / TTFT / 完成状态 / 渲染后的消息
└── manifest.json    版本三元组（Harness 版本 / 适配器规范 SHA-256 / 运行时）
```

## 自己生成

任何一次勾选「保存实验」的对话，或任意一次 CLI `--experiment` 运行，都会在 `harness/experiments/`（或 `$HARNESS_DATA_DIR/experiments/`）下生成同样结构的目录。离线校验：

```bash
node harness/surfaces/cli/cli.mjs --verify <实验包目录>
```

> 注意：请勿手工修改实验包内的任何文件——哈希链会让篡改立即暴露（这正是它的用途）。
