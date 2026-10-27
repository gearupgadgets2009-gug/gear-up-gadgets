Write-Host "=== Bundling Gear Up Gadgets static assets into public/ ===" -ForegroundColor Cyan
$root = $PSScriptRoot
$publicDir = Join-Path $root "public"

if (!(Test-Path $publicDir)) {
    New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
}

# Copy all HTML files to public
$htmlFiles = Get-ChildItem -Path "$root\*.html"
foreach ($f in $htmlFiles) {
    Copy-Item $f.FullName -Destination $publicDir -Force
}

# Copy assets folder to public/assets
$assetsDir = Join-Path $root "assets"
if (Test-Path $assetsDir) {
    Copy-Item -Path $assetsDir -Destination $publicDir -Recurse -Force
}

# Copy favicon.ico to public root
$faviconPath = Join-Path $root "favicon.ico"
if (Test-Path $faviconPath) {
    Copy-Item -Path $faviconPath -Destination $publicDir -Force
}

$count = (Get-ChildItem -Path "$publicDir\*.html").Count
$assetCount = (Get-ChildItem -Recurse -Path "$publicDir\assets").Count
Write-Host "Build complete! $count HTML pages and $assetCount asset files bundled into public/" -ForegroundColor Green