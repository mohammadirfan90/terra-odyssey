# Terra Odyssey - Codebase Packaging Script
# Archives the /terra-odyssey application directory into terra-odyssey.zip at the repository root.
# Ensures the archive is self-contained with scientific rules, validation plan, and roadmap,
# while strictly excluding __pycache__, .pytest_cache, and *.pyc artifacts.

[CmdletBinding()]
param(
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$SourceDir = Join-Path $RepoRoot "terra-odyssey"
$ZipPath = Join-Path $RepoRoot "terra-odyssey.zip"

if (-not (Test-Path $SourceDir)) {
    Write-Error "Application source directory not found: $SourceDir"
}

if (-not $Quiet) {
    Write-Host ""
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "|        TERRA ODYSSEY -> CODEBASE PACKAGING UTILITY          |" -ForegroundColor Cyan
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "Target directory: " -NoNewline; Write-Host "terra-odyssey/" -ForegroundColor Yellow
    Write-Host "Destination:      " -NoNewline; Write-Host "terra-odyssey.zip" -ForegroundColor Yellow
    Write-Host ""
}

# Remove existing zip if present
if (Test-Path $ZipPath) {
    Remove-Item -Path $ZipPath -Force
}

# Create a temporary clean staging directory
$StageDir = Join-Path ([System.IO.Path]::GetTempPath()) ("terra-odyssey-pkg-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

try {
    # Copy terra-odyssey files, excluding caches and node_modules
    $excludeDirs = @("__pycache__", ".pytest_cache", ".coverage", "htmlcov", "node_modules", ".next", "out")
    $excludeExts = @(".pyc", ".pyo", ".pyd")

    Get-ChildItem -Path $SourceDir -Recurse | ForEach-Object {
        $item = $_
        $relPath = $item.FullName.Substring($SourceDir.Length).TrimStart("\", "/")
        
        # Check if any parent or self matches excluded dirs
        $parts = $relPath.Split([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
        $isExcludedDir = $parts | Where-Object { $excludeDirs -contains $_ }
        
        if ($isExcludedDir) {
            return
        }

        if (-not $item.PSIsContainer) {
            if ($excludeExts -contains $item.Extension) {
                return
            }
            $targetFile = Join-Path $StageDir $relPath
            $targetSubDir = Split-Path -Parent $targetFile
            if (-not (Test-Path $targetSubDir)) {
                New-Item -ItemType Directory -Path $targetSubDir -Force | Out-Null
            }
            Copy-Item -Path $item.FullName -Destination $targetFile -Force
        }
    }

    # Ensure docs directory exists in staging
    $stageDocs = Join-Path $StageDir "docs"
    if (-not (Test-Path $stageDocs)) {
        New-Item -ItemType Directory -Path $stageDocs -Force | Out-Null
    }

    # Add required scientific documents to ensure self-contained distribution
    $docMap = @{
        (Join-Path $RepoRoot "docs\SCIENTIFIC_RULES.md") = (Join-Path $stageDocs "SCIENTIFIC_RULES.md")
        (Join-Path $RepoRoot "docs\VALIDATION_PLAN.md")  = (Join-Path $stageDocs "VALIDATION_PLAN.md")
        (Join-Path $RepoRoot ".gsd\ROADMAP.md")          = (Join-Path $StageDir "ROADMAP.md")
    }

    foreach ($src in $docMap.Keys) {
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $docMap[$src] -Force
            # Also keep a top-level copy if in docs
            if ($docMap[$src].StartsWith($stageDocs)) {
                $rootCopy = Join-Path $StageDir (Split-Path -Leaf $src)
                Copy-Item -Path $src -Destination $rootCopy -Force
            }
        } else {
            Write-Warning "Required documentation source not found: $src"
        }
    }

    # Compress stage directory to zip
    Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal

    if (Test-Path $ZipPath) {
        $zipItem = Get-Item $ZipPath
        $sizeKb = [Math]::Round($zipItem.Length / 1KB, 1)
        $fileCount = (Get-ChildItem -Path $StageDir -Recurse -File).Count

        if (-not $Quiet) {
            Write-Host "SUCCESS: Archive created successfully!" -ForegroundColor Green
            Write-Host "  Archive:     $ZipPath" -ForegroundColor White
            Write-Host "  Files:       $fileCount clean files packaged (caches excluded)" -ForegroundColor White
            Write-Host "  Size:        $sizeKb KB" -ForegroundColor White
            Write-Host ""
        }
    } else {
        Write-Error "Failed to produce $ZipPath"
    }
} finally {
    if (Test-Path $StageDir) {
        Remove-Item -Path $StageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
