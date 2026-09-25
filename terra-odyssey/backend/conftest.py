"""Pytest configuration for the Terra Odyssey backend test suite."""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
source_dir = backend_dir / "src"

for path in (source_dir, backend_dir):
    path_string = str(path)
    if path_string not in sys.path:
        sys.path.insert(0, path_string)
