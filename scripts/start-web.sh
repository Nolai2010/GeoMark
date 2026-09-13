#!/usr/bin/env bash
# 启动 GeoMark Harness Web 界面
cd "$(dirname "$0")/../harness"
exec node surfaces/web/server.mjs
