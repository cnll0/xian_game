Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'assets\attack'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

function New-SlashTexture([int]$index) {
    $bmp = New-Object System.Drawing.Bitmap 128, 128
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.TranslateTransform(64, 64)
    $g.RotateTransform($index * 45)

    $glow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(55, 70, 225, 255)), 20
    $mid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(170, 120, 235, 255)), 10
    $core = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 252, 220)), 3

    $g.DrawArc($glow, -50, -50, 100, 100, -58, 116)
    $g.DrawArc($mid, -50, -50, 100, 100, -58, 116)
    $g.DrawArc($core, -50, -50, 100, 100, -50, 100)

    for ($i = -52; $i -le 52; $i += 13) {
        $rad = $i * [Math]::PI / 180
        $x = [Math]::Cos($rad) * 50
        $y = [Math]::Sin($rad) * 50
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 200, 250, 255))
        $g.FillEllipse($brush, $x - 1.5, $y - 1.5, 3, 3)
        $brush.Dispose()
    }

    $g.Dispose()
    $path = Join-Path $outDir ('slash_' + $index + '.png')
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function New-ClawTexture([int]$index) {
    $bmp = New-Object System.Drawing.Bitmap 128, 128
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.TranslateTransform(64, 64)
    $g.RotateTransform($index * 45)

    foreach ($offset in @(-20, 0, 20)) {
        $glow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45, 255, 70, 55)), 18
        $mid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 255, 120, 70)), 7
        $core = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, 255, 225, 180)), 2
        $g.DrawArc($glow, -44, -44 + $offset, 88, 88, -62, 124)
        $g.DrawArc($mid, -44, -44 + $offset, 88, 88, -62, 124)
        $g.DrawArc($core, -44, -44 + $offset, 88, 88, -55, 110)
        $glow.Dispose(); $mid.Dispose(); $core.Dispose()
    }

    $g.Dispose()
    $path = Join-Path $outDir ('claw_' + $index + '.png')
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

for ($i = 0; $i -lt 8; $i++) {
    New-SlashTexture $i
    New-ClawTexture $i
}

Get-ChildItem $outDir | Select-Object Name, Length
