"""Package proxy for terra-odyssey to allow import terra_odyssey."""
import os
import sys

_pkg_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "terra-odyssey"))
if _pkg_dir not in sys.path:
    sys.path.insert(0, _pkg_dir)

__path__ = [_pkg_dir]
