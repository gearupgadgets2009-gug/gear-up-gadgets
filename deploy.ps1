Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    GEAR UP GADGETS - FIREBASE HOSTING DEPLOYMENT" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
Set-Location $root

# Step 1: Run build script to bundle all files into public/
& "$root\build.ps1"

# Step 2: Check Firebase CLI availability
$hasFirebase = Get-Command firebase -ErrorAction SilentlyContinue
if (!$hasFirebase) {
    Write-Host "
[!] Firebase CLI not found on system PATH." -ForegroundColor Yellow
    Write-Host "    Please install it using: npm install -g firebase-tools" -ForegroundColor Yellow
    Write-Host "    Or download from: https://firebase.google.com/docs/cli" -ForegroundColor Yellow
    Exit 1
}

# Step 3: Check active project
Write-Host "
[i] Checking active Firebase project..." -ForegroundColor Cyan
firebase projects:list

# Step 4: Run deployment
Write-Host "
[>] Pushing files live to Firebase Hosting..." -ForegroundColor Cyan
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "
[✔] SUCCESS: Gear Up Gadgets is LIVE on Firebase!" -ForegroundColor Green
} else {
    Write-Host "
[!] Deployment error. Make sure you are logged in via 'firebase login' and have selected your project with 'firebase use <project-id>'." -ForegroundColor Red
}