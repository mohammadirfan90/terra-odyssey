#!/bin/bash
# Terra Odyssey - Codebase Packaging Script (Bash version)
# Archives the /terra-odyssey application directory into terra-odyssey.zip at the repository root.

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
source_dir="$repo_root/terra-odyssey"
zip_path="$repo_root/terra-odyssey.zip"

if [ ! -d "$source_dir" ]; then
    echo "Error: Application source directory not found: $source_dir" >&2
    exit 1
fi

echo ""
echo "+-------------------------------------------------------------+"
echo "|        TERRA ODYSSEY -> CODEBASE PACKAGING UTILITY          |"
echo "+-------------------------------------------------------------+"
echo "Target directory: terra-odyssey/"
echo "Destination:      terra-odyssey.zip"
echo ""

# Remove old zip if present
rm -f "$zip_path"

# Create zip from inside terra-odyssey
(cd "$source_dir" && zip -r -q "$zip_path" .)

if [ -f "$zip_path" ]; then
    size=$(du -h "$zip_path" | cut -f1)
    echo "SUCCESS: Archive created successfully!"
    echo "  Archive: $zip_path"
    echo "  Size:    $size"
    echo ""
else
    echo "Error: Failed to produce $zip_path" >&2
    exit 1
fi
