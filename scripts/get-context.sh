#!/bin/bash
# Terra Odyssey - Context Chain Builder & Auditor (Bash version)

bundle="${1:-default}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
manifest_path="$repo_root/context-manifest.json"

if [ ! -f "$manifest_path" ]; then
    echo "Error: context-manifest.json not found at $manifest_path" >&2
    exit 1
fi

echo ""
echo "+-------------------------------------------------------------+"
echo "|        TERRA ODYSSEY -> CONTEXT STRING BUILDER              |"
echo "+-------------------------------------------------------------+"
echo "Workstream Target: $bundle"
echo ""

# Extract files using Python or grep/jq fallback
python3 -c "
import json, sys, os

bundle = '$bundle'
repo_root = '$repo_root'
with open('$manifest_path', 'r') as f:
    data = json.load(f)

alias_map = {'data': 'data_adapter', 'review': 'release_review'}
bundle_key = alias_map.get(bundle, bundle)

files = list(data.get('default_context', []))

if bundle_key == 'all':
    for b_files in data.get('task_bundles', {}).values():
        for f in b_files:
            if f not in files:
                files.append(f)
elif bundle_key != 'default':
    for f in data.get('task_bundles', {}).get(bundle_key, []):
        if f not in files:
            files.append(f)

print(f'Chained Context String ({len(files)} files):')
total_bytes = 0
total_lines = 0

for rel in files:
    full = os.path.join(repo_root, rel)
    if os.path.exists(full):
        size = os.path.getsize(full)
        total_bytes += size
        with open(full, 'r', errors='ignore') as cf:
            lines = len(cf.readlines())
        total_lines += lines
        tokens = round(size / 4)
        print(f'  -> {rel} ({lines} lines, {tokens} est tokens)')
    else:
        print(f'  [X] {rel} [FILE NOT FOUND]')

total_tokens = round(total_bytes / 4)
print('')
print('Context Budget Summary:')
print(f'  Total Lines: {total_lines}')
print(f'  Total Size:  {round(total_bytes / 1024, 1)} KB')
print(f'  Est Tokens:  ~{total_tokens} (Ultra-Lean: Optimal for AI focus)')
" 2>/dev/null || echo "Note: Run with python3 for full metrics."
