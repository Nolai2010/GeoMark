# GeoMark-Harness Final Release Report

## Release

```text
Version: 0.6.0
Package: GeoMark-Harness-v0.6.0.zip
```

## Test

```bash
npm test
```

实际输出（2026-09-13 发布前运行）：

```text
# tests 102
# pass 102
# fail 0
# cancelled 0
# skipped 0
```

## Secret Scan

```text
Real credentials found: 0
```

- 全工作区扫描 `sk-[A-Za-z0-9_-]{16,}`、`Bearer <token>`、`Authorization: <scheme>`、password/secret/token 模式：真实凭据 0 命中。
- 命中样本均为测试假密钥（`sk-SECRET`、`sk-TEST-KEY`、`'Bearer x'`）与安全报告中的攻击路径描述文字。
- ZIP 解包后二次扫描：真实凭据 0 命中。

### Previously exposed credential detected

发布前发现 `config/secrets.json` 中存在**疑似真实可用的 DeepSeek API Key**（本轮此前开发期间由用户通过 UI 配置）。

处置：

- `config/secrets.json` 已从工作区与发布包中删除，未做任何"隐藏"处理；
- 本报告不打印该 Key 的任何内容；
- **Credential should be rotated / revoked**：该 Key 曾在开发机上以明文形式存在并被多轮会话读取，建议用户尽快在 DeepSeek 控制台吊销并更换新 Key，之后通过 Web UI「API 密钥」重新配置（写入本机 `config/secrets.json`，已被 `.gitignore` 覆盖且不再进入任何发布包）。

## Packaging

```text
config/secrets.json: removed（工作区与 ZIP 均不存在）
secrets.example.json: present（仅含 YOUR_API_KEY 占位符）
config/models.json（ZIP 内）: 已替换为纯示例配置（与 models.example.json 同源，不含用户自建模型）
experiments/ uploads/（用户本地数据）: 不进入 ZIP
```

ZIP 内容：源码（kernel/adapters/surfaces/tests/tools）、README、配置示例、全部文档与报告、docs/screenshots。
ZIP 排除：`config/secrets.json`（双重保险）、`config/models.json` 用户本地配置（以示例替换）、`experiments/`、`uploads/`、日志与临时文件。
确认不包含 `E:\CodeDefencer_Knowledge\` 的任何副本。

## Documentation

```text
Version references synchronized
Historical reports preserved where applicable
```

- `README.md`：测试数更新为 102，标注当前版本 v0.6.0；
- `PHASE-1-REPAIR-REPORT.md`：保留历史事实，顶部加注 `Historical report · Version: 0.3.0 · Historical test baseline: 76/76`；
- `PHASE-2-PRODUCT-REPORT.md`：保留历史事实，顶部加注 `Historical report · Version: 0.4.0 · Historical test baseline: 87/87`；
- `docs/NEUTRALITY-SECURITY-AUDIT.md`：顶部加阅读说明——各节为追加式历史记录，测试数字对应各自版本基线（76/76@v0.3.0、87/87@v0.4.0、102/102@v0.6.0 起），最终状态以本报告为准；
- `RELEASE-v0.6.0.md`：即为当前版本发布说明；
- `experiments/` 历史实验包内的 `harnessVersion: 0.4.1` 为**用户实验数据的原始记录**（受完整性校验约束），不做改写，且不进入 ZIP。

## Final Status

```text
PASS
```

依据：npm test 实际 102/102/0/0；真实凭据扫描 0 命中（工作区 + ZIP 二次扫描）；secrets.json 已移除、示例配置就位；版本与测试数字已同步且历史报告明确标注；ZIP 不含敏感信息与知识库副本。
