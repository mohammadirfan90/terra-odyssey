# Terra Odyssey - Codebase Packaging Script
# Archives the /terra-odyssey application directory into terra-odyssey.zip at the repository root.

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

# Compress the entire terra-odyssey directory
Compress-Archive -Path (Join-Path $SourceDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal

if (Test-Path $ZipPath) {
    $zipItem = Get-Item $ZipPath
    $sizeKb = [Math]::Round($zipItem.Length / 1KB, 1)
    $fileCount = (Get-ChildItem -Path $SourceDir -Recurse -File).Count

    if (-not $Quiet) {
        Write-Host "SUCCESS: Archive created successfully!" -ForegroundColor Green
        Write-Host "  Archive:     $ZipPath" -ForegroundColor White
        Write-Host "  Files:       $fileCount files packaged" -ForegroundColor White
        Write-Host "  Size:        $sizeKb KB" -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Error "Failed to produce $ZipPath"
}
