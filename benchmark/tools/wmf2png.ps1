param(
  [string]$InDir,
  [string]$List,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [int]$MaxSide = 1500
)
Add-Type -AssemblyName System.Drawing
if (!(Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$log = Join-Path $OutDir '_convert.log'
$n = 0; $fail = 0

function Convert-One([string]$Src, [string]$Dst, [int]$MaxSide) {
  $dir = Split-Path -Parent $Dst
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $img = [System.Drawing.Image]::FromFile($Src)
  try {
    $w0 = $img.Width; $h0 = $img.Height
    $scale = 2.0
    $w = [int]([Math]::Max(1, $w0 * $scale))
    $h = [int]([Math]::Max(1, $h0 * $scale))
    $long = [Math]::Max($w, $h)
    if ($long -gt $MaxSide) {
      $f = $MaxSide / $long
      $w = [int]([Math]::Max(1, $w * $f)); $h = [int]([Math]::Max(1, $h * $f))
    }
    # 24bpp（无 alpha），白底
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $bmp.SetResolution(200, 200)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $bmp.Save($Dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
  } finally { $img.Dispose() }
}

if ($List) {
  if (!(Test-Path $List)) { "list-not-found" | Set-Content -Path $log -Encoding UTF8; exit 1 }
  $pairs = @()
  foreach ($line in (Get-Content -Path $List -Encoding UTF8)) {
    if (-not $line) { continue }
    $parts = $line -split '\|'
    if ($parts.Count -lt 2) { continue }
    if (Test-Path $parts[0]) { $pairs += [pscustomobject]@{ Src = $parts[0]; Dst = $parts[1] } }
  }
  foreach ($p in $pairs) {
    try { Convert-One $p.Src $p.Dst $MaxSide; $n++ }
    catch { $fail++; Add-Content -Path $log -Value ("FAIL " + $p.Src + " :: " + $_.Exception.Message) }
  }
  ("converted=$n failed=$fail total=" + $pairs.Count + " maxSide=$MaxSide") | Add-Content -Path $log -Encoding UTF8
  exit 0
}

$files = Get-ChildItem -Path $InDir -File | Where-Object { $_.Extension -match '^\.(wmf|emf)$' }
foreach ($f in $files) {
  try { Convert-One $f.FullName (Join-Path $OutDir ($f.BaseName + '.png')) $MaxSide; $n++ }
  catch { $fail++; Add-Content -Path $log -Value ("FAIL " + $f.Name + " :: " + $_.Exception.Message) }
}
("converted=$n failed=$fail total=" + $files.Count + " maxSide=$MaxSide") | Add-Content -Path $log -Encoding UTF8
