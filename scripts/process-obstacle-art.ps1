param(
    [Parameter(Mandatory = $true)][string]$InputFile,
    [Parameter(Mandatory = $true)][string]$OutputFile,
    [int]$MaxSize = 128,
    [switch]$Smooth,
    [double]$TrimBottomRatio = 0.065,
    [int]$LightClean = 232,
    [switch]$LowSatBg,
    [int]$BgTol = 44
)

# Convert AI-generated white-background prop art into a game-ready PNG:
#   1. drop the bottom strip (Pollinations logo)
#   2. flood-fill the background from the border, keeping interior highlights
#   3. crop to the content bbox
#   4. resize to MaxSize (nearest neighbor by default, for pixel art)
Add-Type -AssemblyName System.Drawing

if (-not ('ObstacleArtProcessor' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class ObstacleArtProcessor
{
    private static byte[] _buf;
    private static int _w, _h, _stride, _br, _bg, _bb;
    private static bool[] _vis;
    private static int[] _stack;
    private static bool _lowSatBg;
    private static int _bgTol = 44;

    private static bool IsBg(int x, int y)
    {
        int i = y * _stride + x * 4;
        int b = _buf[i], g = _buf[i + 1], r = _buf[i + 2];
        int mx = Math.Max(r, Math.Max(g, b));
        int mn = Math.Min(r, Math.Min(g, b));
        if (mx >= 240 && mn >= 232) return true;
        if (_lowSatBg && (mx - mn) <= 20 && mx >= 64) return true;
        int dr = r - _br, dg = g - _bg, db = b - _bb;
        return (dr * dr + dg * dg + db * db) <= _bgTol * _bgTol && (mx - mn) <= 60;
    }

    // 1px dark outline around the opaque silhouette, matching the game's pixel sprites.
    private static void AddOutline(Bitmap bmp)
    {
        int w = bmp.Width, h = bmp.Height;
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        int stride = data.Stride;
        byte[] buf = new byte[stride * h];
        Marshal.Copy(data.Scan0, buf, 0, buf.Length);
        byte[] copy = (byte[])buf.Clone();

        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                int i = y * stride + x * 4;
                if (copy[i + 3] <= 8) continue;
                bool edge = false;
                if (x == 0 || y == 0 || x == w - 1 || y == h - 1) edge = true;
                else
                {
                    if (copy[i + 4 + 3] <= 8) edge = true;
                    if (copy[i - 4 + 3] <= 8) edge = true;
                    if (copy[i + stride + 3] <= 8) edge = true;
                    if (copy[i - stride + 3] <= 8) edge = true;
                }
                if (!edge) continue;
                buf[i] = (byte)(buf[i] * 0.5);
                buf[i + 1] = (byte)(buf[i + 1] * 0.5);
                buf[i + 2] = (byte)(buf[i + 2] * 0.5);
                buf[i + 3] = 255;
            }
        }

        Marshal.Copy(buf, 0, data.Scan0, buf.Length);
        bmp.UnlockBits(data);
    }

    private static void Push(int x, int y, ref int sp)
    {
        if (x < 0 || y < 0 || x >= _w || y >= _h) return;
        int idx = y * _w + x;
        if (_vis[idx]) return;
        if (!IsBg(x, y)) return;
        _vis[idx] = true;
        _stack[sp++] = idx;
    }

    public static string Process(string inputPath, string outputPath, int maxSize, bool smooth, double trimRatio, int lightClean, bool lowSatBg, int bgTol)
    {
        _lowSatBg = lowSatBg;
        _bgTol = bgTol;
        using (Bitmap src = new Bitmap(inputPath))
        {
            int trim = (int)(src.Height * trimRatio);
            int w = src.Width;
            int h = Math.Max(1, src.Height - trim);

            using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.InterpolationMode = InterpolationMode.NearestNeighbor;
                    g.PixelOffsetMode = PixelOffsetMode.Half;
                    g.DrawImage(src, new Rectangle(0, 0, w, h), new Rectangle(0, 0, w, h), GraphicsUnit.Pixel);
                }

                BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
                _w = w; _h = h; _stride = data.Stride;
                _buf = new byte[_stride * h];
                Marshal.Copy(data.Scan0, _buf, 0, _buf.Length);

                long sr = 0, sg = 0, sb = 0; int cnt = 0;
                int[] xs = { 2, w - 10, 2, w - 10 };
                int[] ys = { 2, 2, h - 10, h - 10 };
                for (int c = 0; c < 4; c++)
                {
                    for (int y = ys[c]; y < ys[c] + 8 && y < h; y++)
                    {
                        if (y < 0) continue;
                        for (int x = xs[c]; x < xs[c] + 8 && x < w; x++)
                        {
                            if (x < 0) continue;
                            int i = y * _stride + x * 4;
                            sb += _buf[i]; sg += _buf[i + 1]; sr += _buf[i + 2]; cnt++;
                        }
                    }
                }
                if (cnt == 0) cnt = 1;
                _br = (int)(sr / cnt); _bg = (int)(sg / cnt); _bb = (int)(sb / cnt);

                _vis = new bool[w * h];
                _stack = new int[w * h];
                int sp = 0;
                for (int x = 0; x < w; x++) { Push(x, 0, ref sp); Push(x, h - 1, ref sp); }
                for (int y = 0; y < h; y++) { Push(0, y, ref sp); Push(w - 1, y, ref sp); }

                while (sp > 0)
                {
                    int idx = _stack[--sp];
                    int x = idx % w;
                    int y = idx / w;
                    _buf[idx * 4 + 3] = 0;
                    Push(x + 1, y, ref sp);
                    Push(x - 1, y, ref sp);
                    Push(x, y + 1, ref sp);
                    Push(x, y - 1, ref sp);
                }

                // Remove enclosed light-grey background the flood fill could not reach.
                for (int y = 0; y < h; y++)
                {
                    for (int x = 0; x < w; x++)
                    {
                        int i = y * _stride + x * 4;
                        if (_buf[i + 3] == 0) continue;
                        int b = _buf[i], g = _buf[i + 1], r = _buf[i + 2];
                        int mx = Math.Max(r, Math.Max(g, b));
                        int mn = Math.Min(r, Math.Min(g, b));
                        if (mx >= lightClean && (mx - mn) <= 18) _buf[i + 3] = 0;
                    }
                }

                Marshal.Copy(_buf, 0, data.Scan0, _buf.Length);
                bmp.UnlockBits(data);

                int minX = w, minY = h, maxX = -1, maxY = -1;
                for (int y = 0; y < h; y++)
                {
                    for (int x = 0; x < w; x++)
                    {
                        if (_buf[y * _stride + x * 4 + 3] <= 16) continue;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
                if (maxX < minX || maxY < minY)
                {
                    throw new Exception("No opaque content left; background key is too aggressive.");
                }

                int pad = 2;
                minX = Math.Max(0, minX - pad);
                minY = Math.Max(0, minY - pad);
                maxX = Math.Min(w - 1, maxX + pad);
                maxY = Math.Min(h - 1, maxY + pad);
                int cw = maxX - minX + 1;
                int ch = maxY - minY + 1;

                using (Bitmap cropped = bmp.Clone(new Rectangle(minX, minY, cw, ch), PixelFormat.Format32bppArgb))
                {
                    double scale = Math.Min((double)maxSize / cw, (double)maxSize / ch);
                    if (scale > 1.0) scale = 1.0;
                    int dw = Math.Max(1, (int)Math.Round(cw * scale));
                    int dh = Math.Max(1, (int)Math.Round(ch * scale));

                    using (Bitmap output = new Bitmap(dw, dh, PixelFormat.Format32bppArgb))
                    {
                        using (Graphics g = Graphics.FromImage(output))
                        {
                            g.Clear(Color.Transparent);
                            g.CompositingMode = CompositingMode.SourceCopy;
                            g.InterpolationMode = smooth ? InterpolationMode.HighQualityBicubic : InterpolationMode.NearestNeighbor;
                            g.PixelOffsetMode = PixelOffsetMode.Half;
                            g.DrawImage(cropped, new Rectangle(0, 0, dw, dh));
                        }
                        AddOutline(output);
                        output.Save(outputPath, ImageFormat.Png);
                    }
                    return string.Format("{0} ({1}x{2} -> {3}x{4})", outputPath, cw, ch, dw, dh);
                }
            }
        }
    }
}
'@ -ReferencedAssemblies System.Drawing
}

$result = [ObstacleArtProcessor]::Process(
    [System.IO.Path]::GetFullPath($InputFile),
    [System.IO.Path]::GetFullPath($OutputFile),
    $MaxSize,
    [bool]$Smooth,
    $TrimBottomRatio,
    $LightClean,
    [bool]$LowSatBg,
    $BgTol
)
Write-Output $result
