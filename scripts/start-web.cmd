@echo off
rem 启动 GeoMark Harness Web 界面
cd /d "%~dp0..\harness"
node surfaces/web/server.mjs
