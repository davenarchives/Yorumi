Add-Type -AssemblyName System.Drawing

$srcIconPath = (Resolve-Path "public/yorumi-icon.png").Path
$srcAppIconPath = (Resolve-Path "website/public/yorumi-app-icon.png").Path

$srcIcon = [System.Drawing.Bitmap]::FromFile($srcIconPath)
$srcAppIcon = [System.Drawing.Bitmap]::FromFile($srcAppIconPath)

function Resize-Image {
    param(
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height
    )
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
    $destImage = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $destImage.SetResolution($Image.HorizontalResolution, $Image.VerticalResolution)

    $graphics = [System.Drawing.Graphics]::FromImage($destImage)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $graphics.DrawImage($Image, $destRect, 0, 0, $Image.Width, $Image.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    return $destImage
}

function Create-AdaptiveForeground {
    param(
        [System.Drawing.Image]$Image,
        [int]$CanvasSize,
        [double]$IconRatio = 0.68
    )
    $iconSize = [int]($CanvasSize * $IconRatio)
    $offset = [int](($CanvasSize - $iconSize) / 2)
    $destRect = New-Object System.Drawing.Rectangle($offset, $offset, $iconSize, $iconSize)
    $destImage = New-Object System.Drawing.Bitmap($CanvasSize, $CanvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    $graphics = [System.Drawing.Graphics]::FromImage($destImage)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $graphics.DrawImage($Image, $destRect, 0, 0, $Image.Width, $Image.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    return $destImage
}

function Create-RoundIcon {
    param(
        [System.Drawing.Image]$Image,
        [int]$Size
    )
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $destImage = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    $graphics = [System.Drawing.Graphics]::FromImage($destImage)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $Size, $Size)
    $graphics.SetClip($path)

    $graphics.DrawImage($Image, $destRect, 0, 0, $Image.Width, $Image.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    $path.Dispose()
    return $destImage
}

function Create-Splash {
    param(
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height
    )
    $destImage = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($destImage)
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#0a0a0a"))
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $minDim = [Math]::Min($Width, $Height)
    $logoSize = [int]($minDim * 0.45)
    $x = [int](($Width - $logoSize) / 2)
    $y = [int](($Height - $logoSize) / 2)
    $destRect = New-Object System.Drawing.Rectangle($x, $y, $logoSize, $logoSize)

    $graphics.DrawImage($Image, $destRect, 0, 0, $Image.Width, $Image.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    return $destImage
}

$densities = @(
    @{ Name = "mipmap-mdpi"; LegacySize = 48; FgSize = 108 },
    @{ Name = "mipmap-hdpi"; LegacySize = 72; FgSize = 162 },
    @{ Name = "mipmap-xhdpi"; LegacySize = 96; FgSize = 216 },
    @{ Name = "mipmap-xxhdpi"; LegacySize = 144; FgSize = 324 },
    @{ Name = "mipmap-xxxhdpi"; LegacySize = 192; FgSize = 432 }
)

$baseRes = "android/app/src/main/res"

foreach ($d in $densities) {
    $dir = Join-Path $baseRes $d.Name
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    # 1. ic_launcher.png (legacy full icon with background)
    $legacy = Resize-Image -Image $srcAppIcon -Width $d.LegacySize -Height $d.LegacySize
    $legacy.Save((Join-Path $dir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $legacy.Dispose()

    # 2. ic_launcher_round.png (legacy round icon)
    $round = Create-RoundIcon -Image $srcAppIcon -Size $d.LegacySize
    $round.Save((Join-Path $dir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $round.Dispose()

    # 3. ic_launcher_foreground.png (adaptive foreground transparent centered logo)
    $fg = Create-AdaptiveForeground -Image $srcIcon -CanvasSize $d.FgSize
    $fg.Save((Join-Path $dir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $fg.Dispose()

    Write-Output "Generated icons for $($d.Name)"
}

# Generate splash screens
$splashSizes = @(
    @{ Path = "drawable/splash.png"; W = 480; H = 320 },
    @{ Path = "drawable-land-mdpi/splash.png"; W = 480; H = 320 },
    @{ Path = "drawable-land-hdpi/splash.png"; W = 800; H = 480 },
    @{ Path = "drawable-land-xhdpi/splash.png"; W = 1280; H = 720 },
    @{ Path = "drawable-land-xxhdpi/splash.png"; W = 1600; H = 960 },
    @{ Path = "drawable-land-xxxhdpi/splash.png"; W = 1920; H = 1280 },
    @{ Path = "drawable-port-mdpi/splash.png"; W = 320; H = 480 },
    @{ Path = "drawable-port-hdpi/splash.png"; W = 480; H = 800 },
    @{ Path = "drawable-port-xhdpi/splash.png"; W = 720; H = 1280 },
    @{ Path = "drawable-port-xxhdpi/splash.png"; W = 960; H = 1600 },
    @{ Path = "drawable-port-xxxhdpi/splash.png"; W = 1280; H = 1920 }
)

foreach ($s in $splashSizes) {
    $fullPath = Join-Path $baseRes $s.Path
    $parent = Split-Path $fullPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $sp = Create-Splash -Image $srcIcon -Width $s.W -Height $s.H
    $sp.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $sp.Dispose()
    Write-Output "Generated splash for $($s.Path)"
}

$srcIcon.Dispose()
$srcAppIcon.Dispose()

Write-Output "Done generating all icons!"
