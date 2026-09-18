<#
.SYNOPSIS
  清点本机已安装的 AI Agent 客户端，供 harness/config/tracks.json 填写 exe 路径。

.DESCRIPTION
  依次采集五类证据，全部原样落盘（不做关键词过滤——过滤交给读文件的人，
  避免因为关键词表过时而漏掉新产品）：

    1. 开始菜单快捷方式，并解析出 .lnk 的真实 TargetPath 与 Arguments
    2. Get-StartApps 的 AppID（MSIX 打包应用只能靠它启动，格式 <PFN>!<AppId>）
    3. 卸载表（注册表）里的 DisplayName / InstallLocation / DisplayIcon
    4. 正在运行的进程及其可执行文件完整路径（最可靠——进程路径不会撒谎）
    5. 用户目录下的工具配置目录（.* 目录，如 .trae-cn / .qoder-cn）

  脚本本身保持纯 ASCII：PowerShell 5.1 读取无 BOM 的 UTF-8 中文脚本会乱码，
  而输出文件用 UTF8 编码写出，中文名称不会丢失。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File harness/tools/scan-agents.ps1
  然后读取 .scan/apps.txt
#>
param(
  [string]$OutFile = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) '.scan\apps.txt')
)

$ErrorActionPreference = 'SilentlyContinue'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutFile) | Out-Null
$lines = @()

$lines += '=== [1] Start Menu shortcuts (resolved) ==='
$sh = New-Object -ComObject WScript.Shell
$menuDirs = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
)
foreach ($d in $menuDirs) {
  Get-ChildItem -Path $d -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    $target = ''
    $arguments = ''
    try {
      $sc = $sh.CreateShortcut($_.FullName)
      $target = $sc.TargetPath
      $arguments = $sc.Arguments
    } catch { }
    $lines += ("LNK`t" + $_.Name + "`t" + $target + "`t" + $arguments)
  }
}

$lines += ''
$lines += '=== [2] Start Apps (AppID, needed for MSIX launch) ==='
Get-StartApps | ForEach-Object { $lines += ("APPID`t" + $_.Name + "`t" + $_.AppID) }

$lines += ''
$lines += '=== [3] Uninstall registry entries ==='
$uninstallKeys = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($k in $uninstallKeys) {
  Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | ForEach-Object {
    $lines += ("UNINST`t" + $_.DisplayName + "`t" + $_.InstallLocation + "`t" + $_.DisplayIcon)
  }
}

$lines += ''
$lines += '=== [4] Running processes with full path ==='
Get-Process | ForEach-Object {
  $exe = $null
  try { $exe = $_.Path } catch { }
  if ($exe) { $lines += ("PROC`t" + $_.ProcessName + "`t" + $exe) }
}

$lines += ''
$lines += '=== [5] User profile tool dirs ==='
Get-ChildItem $env:USERPROFILE -Directory -Force | Where-Object { $_.Name -like '.*' } | ForEach-Object {
  $lines += ("UDIR`t" + $_.Name + "`t" + $_.FullName)
}

$lines | Set-Content -Path $OutFile -Encoding UTF8
Write-Output ("written: " + $OutFile + "  lines=" + $lines.Count)
exit 0
