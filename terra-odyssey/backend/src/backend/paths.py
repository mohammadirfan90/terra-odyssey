"""Filesystem locations owned by the standalone Terra Odyssey backend."""

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
SCHEMAS_DIR = BACKEND_ROOT / "schemas"
ENV_FILE = BACKEND_ROOT / ".env"


def default_investigations_dir() -> Path:
    """Return the persistent investigation artifact directory."""
    return DATA_DIR / "investigations"
