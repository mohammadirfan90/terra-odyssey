"""Pytest configuration for Terra Odyssey test suite."""

import sys
from pathlib import Path

# Add terra-odyssey directory to sys.path so 'src' and 'tests' can be imported anywhere
codebase_dir = Path(__file__).resolve().parent
if str(codebase_dir) not in sys.path:
    sys.path.insert(0, str(codebase_dir))
