# Terra Odyssey - Context Chain Builder & Auditor
# Resolves and chains task-specific context from context-manifest.json

[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [ValidateSet("default", "frontend", "data", "data_adapter", "analysis", "api", "review", "release_review", "all")]
    [string]$Bundle = "default",

    [switch]$EmitText,
    [switch]$Detailed
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ManifestPath = Join-Path $RepoRoot "context-manifest.json"

if (-not (Test-Path $ManifestPath)) {
    Write-Error "context-manifest.json not found at $ManifestPath"
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json

# Normalize alias
$bundleKey = switch ($Bundle) {
    "data" { "data_adapter" }
    "review" { "release_review" }
    default { $Bundle }
}

$filesToInclude = [System.Collections.Generic.List[string]]::new()

# Always include default context (The Anchor String)
foreach ($file in $manifest.default_context) {
    if (-not $filesToInclude.Contains($file)) {
        $filesToInclude.Add($file)
    }
}

# Add bundle-specific files
if ($bundleKey -eq "all") {
    foreach ($prop in $manifest.task_bundles.PSObject.Properties) {
        foreach ($file in $prop.Value) {
            if (-not $filesToInclude.Contains($file)) {
                $filesToInclude.Add($file)
            }
        }
    }
} elseif ($bundleKey -ne "default") {
    $bundleFiles = $manifest.task_bundles.$bundleKey
    if ($bundleFiles) {
        foreach ($file in $bundleFiles) {
            if (-not $filesToInclude.Contains($file)) {
                $filesToInclude.Add($file)
            }
        }
    } else {
        Write-Warning "Bundle '$Bundle' not found in task_bundles."
    }
}

if (-not $EmitText) {
    Write-Host ""
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "|        TERRA ODYSSEY -> CONTEXT STRING BUILDER              |" -ForegroundColor Cyan
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "Workstream Target: " -NoNewline
    Write-Host "$Bundle" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Chained Context String (" -NoNewline
    Write-Host "$($filesToInclude.Count) files" -ForegroundColor Green -NoNewline
    Write-Host "):"
}

$totalBytes = 0
$totalLines = 0

foreach ($relPath in $filesToInclude) {
    $fullPath = Join-Path $RepoRoot $relPath
    if (Test-Path $fullPath) {
        $fileItem = Get-Item $fullPath
        $content = Get-Content $fullPath -Raw
        $lineCount = ($content -split "`r?`n").Count
        $byteCount = $fileItem.Length
        $totalBytes += $byteCount
        $totalLines += $lineCount
        $estTokens = [Math]::Round($byteCount / 4)

        if (-not $EmitText) {
            Write-Host "  -> " -NoNewline -ForegroundColor DarkGray
            Write-Host "$relPath" -NoNewline -ForegroundColor White
            Write-Host " ($lineCount lines, $estTokens est tokens)" -ForegroundColor DarkCyan
        } else {
            Write-Output "================================================================================"
            Write-Output "CONTEXT FILE: $relPath"
            Write-Output "================================================================================"
            Write-Output $content
            Write-Output ""
        }
    } else {
        if (-not $EmitText) {
            Write-Host "  [X] " -NoNewline -ForegroundColor Red
            Write-Host "$relPath" -NoNewline -ForegroundColor White
            Write-Host " [FILE NOT FOUND]" -ForegroundColor Red
        }
    }
}

if (-not $EmitText) {
    $totalTokens = [Math]::Round($totalBytes / 4)
    Write-Host ""
    Write-Host "Context Budget Summary:" -ForegroundColor Cyan
    Write-Host "  Total Lines: " -NoNewline; Write-Host "$totalLines" -ForegroundColor White
    Write-Host "  Total Size:  " -NoNewline; Write-Host "$([Math]::Round($totalBytes / 1KB, 1)) KB" -ForegroundColor White
    Write-Host "  Est Tokens:  " -NoNewline
    if ($totalTokens -lt 4000) {
        Write-Host "~$totalTokens (Ultra-Lean: Optimal for AI focus)" -ForegroundColor Green
    } elseif ($totalTokens -lt 10000) {
        Write-Host "~$totalTokens (Lean: Safe)" -ForegroundColor Yellow
    } else {
        Write-Host "~$totalTokens (Heavy: Consider trimming)" -ForegroundColor Red
    }
    Write-Host ""
}
