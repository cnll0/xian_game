param(
    [string]$OutputFile = 'assets/obstacles/obstacle_nether.png'
)

# Fallback pixel-art sprite for the nether map: a bone totem with purple ghostfire.
# Used because the free image API was rate-limited before a fourth generation.
Add-Type -AssemblyName System.Drawing

$W = 128
$H = 128
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g.Clear([System.Drawing.Color]::Transparent)

function Brush([string]$hex) {
    $c = [System.Drawing.ColorTranslator]::FromHtml($hex)
    return New-Object System.Drawing.SolidBrush $c
}
function Poly([object[]]$pts, [string]$hex) {
    $points = New-Object 'System.Drawing.Point[]' $pts.Count
    for ($i = 0; $i -lt $pts.Count; $i++) {
        $points[$i] = New-Object System.Drawing.Point ([int]$pts[$i][0]), ([int]$pts[$i][1])
    }
    $g.FillPolygon((Brush $hex), $points)
}
function Ell([double]$x, [double]$y, [double]$rx, [double]$ry, [string]$hex) {
    $g.FillEllipse((Brush $hex), [single]($x - $rx), [single]($y - $ry), [single]($rx * 2), [single]($ry * 2))
}
function Rect([int]$x, [int]$y, [int]$w, [int]$h, [string]$hex) {
    $g.FillRectangle((Brush $hex), $x, $y, $w, $h)
}
function Line([int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$w, [string]$hex) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($hex)), ([single]$w)
    $g.DrawLine($pen, $x1, $y1, $x2, $y2)
}

# ground shadow + bone mound
Ell 64 114 43 12 '#160f1e'
Ell 64 110 37 10 '#261b34'
Ell 64 106 30 8 '#3b2b4c'

# crossed bones on the base
Line 40 106 60 116 6 '#160f1e'
Line 88 106 68 116 6 '#160f1e'
Line 40 106 60 116 4 '#cdbf9d'
Line 88 106 68 116 4 '#cdbf9d'
Ell 40 105 4 4 '#cdbf9d'
Ell 88 105 4 4 '#cdbf9d'

# ghostfire (behind skull)
Poly @(@(64, 0), @(48, 20), @(56, 18), @(50, 34), @(62, 26), @(67, 36), @(74, 20), @(80, 24)) '#3a2058'
Poly @(@(64, 6), @(54, 24), @(60, 22), @(56, 34), @(64, 28), @(72, 34), @(68, 22), @(74, 24)) '#7a42ad'
Poly @(@(64, 14), @(58, 26), @(62, 24), @(60, 32), @(64, 27), @(68, 32), @(66, 24), @(70, 26)) '#c79aef'
Ell 64 23 3 5 '#f0dcff'

# spine
Poly @(@(66, 42), @(75, 42), @(79, 104), @(61, 104)) '#160f1e'
Poly @(@(60, 42), @(70, 42), @(74, 104), @(56, 104)) '#d6c9a8'
Poly @(@(60, 42), @(64, 42), @(60, 104), @(56, 104)) '#efe6c8'
Poly @(@(68, 44), @(70, 44), @(73, 102), @(71, 102)) '#9c8d6d'
foreach ($y in @(54, 66, 78, 90, 100)) {
    Line 57 $y 73 $y 2 '#6b5f4a'
}

# ribs
foreach ($yy in @(60, 74, 88)) {
    Poly @(@(58, $yy), @(44, ($yy - 9)), @(33, ($yy - 3)), @(35, ($yy + 6)), @(50, ($yy + 4)), @(58, ($yy + 2))) '#160f1e'
    Poly @(@(58, $yy), @(45, ($yy - 7)), @(36, ($yy - 2)), @(38, ($yy + 4)), @(51, ($yy + 2)), @(58, ($yy + 1))) '#c9bb98'
    Poly @(@(70, $yy), @(84, ($yy - 9)), @(95, ($yy - 3)), @(93, ($yy + 6)), @(78, ($yy + 4)), @(70, ($yy + 2))) '#160f1e'
    Poly @(@(70, $yy), @(83, ($yy - 7)), @(92, ($yy - 2)), @(90, ($yy + 4)), @(77, ($yy + 2)), @(70, ($yy + 1))) '#c9bb98'
}

# horns
Poly @(@(48, 24), @(34, 3), @(54, 16)) '#160f1e'
Poly @(@(49, 22), @(37, 6), @(53, 17)) '#d6c9a8'
Poly @(@(80, 24), @(94, 3), @(74, 16)) '#160f1e'
Poly @(@(79, 22), @(91, 6), @(75, 17)) '#d6c9a8'

# skull
Ell 64 33 22 20 '#160f1e'
Ell 64 33 19 18 '#d6c9a8'
Ell 57 28 9 7 '#efe6c8'
Rect 50 44 28 12 '#160f1e'
Rect 52 43 24 11 '#cdbf9d'
foreach ($x in @(55, 61, 67, 73)) { Rect $x 46 2 7 '#6b5f4a' }

# eye sockets + glow
Ell 56 32 7 8 '#160f1e'
Ell 72 32 7 8 '#160f1e'
Ell 56 32 3 4 '#b388e8'
Ell 72 32 3 4 '#b388e8'
Rect 55 30 2 2 '#f0dcff'
Rect 71 30 2 2 '#f0dcff'
Poly @(@(64, 36), @(60, 43), @(68, 43)) '#160f1e'

# floating soul wisps
foreach ($p in @(@(30, 52), @(98, 46), @(24, 82), @(104, 72), @(40, 16), @(88, 12))) {
    Rect $p[0] $p[1] 2 2 '#b388e8'
    Rect ($p[0] + 1) ($p[1] - 2) 1 1 '#e8ccff'
}

$g.Dispose()

# 1px dark outline around the silhouette
$rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$buf = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
$copy = [byte[]]$buf.Clone()
for ($y = 0; $y -lt $H; $y++) {
    for ($x = 0; $x -lt $W; $x++) {
        $i = $y * $stride + $x * 4
        if ($copy[$i + 3] -le 8) { continue }
        $edge = $false
        if ($x -eq 0 -or $y -eq 0 -or $x -eq $W - 1 -or $y -eq $H - 1) { $edge = $true }
        else {
            if ($copy[$i + 4 + 3] -le 8) { $edge = $true }
            if ($copy[$i - 4 + 3] -le 8) { $edge = $true }
            if ($copy[$i + $stride + 3] -le 8) { $edge = $true }
            if ($copy[$i - $stride + 3] -le 8) { $edge = $true }
        }
        if (-not $edge) { continue }
        $buf[$i] = [byte]([math]::Floor($buf[$i] * 0.45))
        $buf[$i + 1] = [byte]([math]::Floor($buf[$i + 1] * 0.45))
        $buf[$i + 2] = [byte]([math]::Floor($buf[$i + 2] * 0.45))
    }
}
[System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $buf.Length)
$bmp.UnlockBits($data)

$outPath = [System.IO.Path]::GetFullPath($OutputFile)
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output $outPath
