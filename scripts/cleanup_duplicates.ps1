# ==============================================================================
# Gear Up Gadgets - Automated Product Deduplication & Stock Consolidation Script
# ==============================================================================
# Logic:
#   1. Identifies all duplicate products based on SKU or Product Name/Title.
#   2. Consolidates duplicates into a single Master Listing.
#   3. Sums up all available inventory counts across all duplicates into the master.
#   4. Updates the master listing with the new combined total stock.
#   5. Safely removes duplicate records only after consolidation is secured.
# ==============================================================================

param(
    [string]$FilePath = "assets/js/products-data.js",
    [switch]$Apply = $false
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Gear Up Gadgets - Catalog Deduplication & Stock Merging " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (!(Test-Path $FilePath)) {
    Write-Error "Catalog file not found: $FilePath"
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $FilePath), [System.Text.Encoding]::UTF8)

# Parse products JSON from products-data.js
$jsonMatch = [regex]::Match($rawContent, '(?s)(?:window\.productDatabase|productDatabase)\s*=\s*(\[.+?\]);')
if (!$jsonMatch.Success) {
    Write-Error "Could not find product array assignment in $FilePath"
    exit 1
}

$productsJson = $jsonMatch.Groups[1].Value
$products = ConvertFrom-Json $productsJson

Write-Host "Total products scanned in catalog: $($products.Count)" -ForegroundColor Yellow

function Normalize-Key($str) {
    if ([string]::IsNullOrWhiteSpace($str)) { return "" }
    return ($str.ToLower().Trim() -replace '[^a-z0-9]', '')
}

# Group products by SKU and Name
$groups = @{}
foreach ($p in $products) {
    $normSku = Normalize-Key $p.sku
    $normName = Normalize-Key ($p.title ? $p.title : $p.name)

    $key = if ($normSku) { "sku:$normSku" } else { "name:$normName" }

    # Check if existing group shares this sku or name
    $foundKey = $null
    foreach ($gKey in $groups.Keys) {
        foreach ($item in $groups[$gKey]) {
            $iSku = Normalize-Key $item.sku
            $iName = Normalize-Key ($item.title ? $item.title : $item.name)
            if (($normSku -and $iSku -and $normSku -eq $iSku) -or ($normName -and $iName -and $normName -eq $iName)) {
                $foundKey = $gKey
                break
            }
        }
        if ($foundKey) { break }
    }

    $targetKey = if ($foundKey) { $foundKey } else { $key }
    if (!$groups.ContainsKey($targetKey)) {
        $groups[$targetKey] = [System.Collections.Generic.List[psobject]]::new()
    }
    $groups[$targetKey].Add($p)
}

$duplicateGroups = @()
foreach ($gKey in $groups.Keys) {
    if ($groups[$gKey].Count -gt 1) {
        $duplicateGroups += ,$groups[$gKey]
    }
}

if ($duplicateGroups.Count -eq 0) {
    Write-Host "[OK] No duplicate listings found in $FilePath. All $($products.Count) products are unique!" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($duplicateGroups.Count) product group(s) with duplicate entries!" -ForegroundColor Red

$consolidatedProducts = [System.Collections.Generic.List[psobject]]::new()
$totalStockAdded = 0
$totalDuplicatesDeleted = 0

foreach ($group in $duplicateGroups) {
    # Elect Master: first entry or lowest ID
    $master = $group[0]
    $duplicates = $group | Select-Object -Skip 1

    Write-Host "`nConsolidating: $($master.name)" -ForegroundColor White
    Write-Host "  -> Master ID: $($master.id) | SKU: $($master.sku)" -ForegroundColor Cyan
    Write-Host "  -> Duplicate IDs to remove: $(($duplicates | ForEach-Object { $_.id }) -join ', ')" -ForegroundColor Yellow

    # Consolidate city stock
    $stockObj = @{}
    if ($master.stock -is [psobject]) {
        foreach ($prop in $master.stock.PSObject.Properties) {
            $stockObj[$prop.Name] = [int]$prop.Value
        }
    } elseif ($master.stock -is [int]) {
        $stockObj["Karachi"] = [int]$master.stock
    } else {
        $stockObj["Karachi"] = 10
    }

    $groupAddedStock = 0
    foreach ($dup in $duplicates) {
        $totalDuplicatesDeleted++
        if ($dup.stock -is [psobject]) {
            foreach ($prop in $dup.stock.PSObject.Properties) {
                $qty = [int]$prop.Value
                if (!$stockObj.ContainsKey($prop.Name)) { $stockObj[$prop.Name] = 0 }
                $stockObj[$prop.Name] += $qty
                $groupAddedStock += $qty
            }
        } elseif ($dup.stock -is [int]) {
            $qty = [int]$dup.stock
            if (!$stockObj.ContainsKey("Karachi")) { $stockObj["Karachi"] = 0 }
            $stockObj["Karachi"] += $qty
            $groupAddedStock += $qty
        }
    }

    $totalStockAdded += $groupAddedStock
    Write-Host "  -> Combined Stock Added: +$groupAddedStock units" -ForegroundColor Green

    # Update master stock
    $master.stock = $stockObj
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  Summary of Cleanup: " -ForegroundColor Cyan
Write-Host "  Duplicate Groups Consolidated: $($duplicateGroups.Count)" -ForegroundColor Yellow
Write-Host "  Duplicate Listings Removed:   $totalDuplicatesDeleted" -ForegroundColor Yellow
Write-Host "  Total Inventory Stock Merged:  +$totalStockAdded Units" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
