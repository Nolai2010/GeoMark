# scripts / 便捷脚本

> 一键入口。所有脚本均可从仓库任意位置执行（内部自动定位）。

| 脚本 | 平台 | 作用 |
|---|---|---|
| `start-web.cmd` / `start-web.sh` | Win / Unix | 启动 Harness Web 界面（http://127.0.0.1:7788） |
| `benchmark.cmd` / `benchmark.sh` | Win / Unix | 完整跑一遍 benchmark 流水线（转图 → 作答 → 评分 → 汇总），模型 id 通过环境变量 `GM_MODEL` 指定 |

## 示例

```bash
# Linux / macOS
./scripts/start-web.sh
GM_MODEL=deepseek-flash ./scripts/benchmark.sh
```

```cmd
:: Windows
scripts\start-web.cmd
set GM_MODEL=deepseek-flash && scripts\benchmark.cmd
```

前置条件：模型与密钥已按 [GETTING-STARTED](../GETTING-STARTED.md) 配好（Web 界面或 `harness/config/`）。
