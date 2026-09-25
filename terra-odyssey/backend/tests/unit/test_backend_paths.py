"""Regression tests for the standalone backend filesystem boundary."""

from pathlib import Path

from backend.api.catalog import find_manifests_dir
from backend.app import create_app
from backend.exporter import _find_schema_path
from backend.paths import (
    BACKEND_ROOT,
    DATA_DIR,
    SCHEMAS_DIR,
    default_investigations_dir,
)
from backend.store import default_db_path


def test_backend_paths_do_not_depend_on_process_cwd(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)

    expected_root = Path(__file__).resolve().parents[2]
    assert BACKEND_ROOT == expected_root
    assert DATA_DIR == expected_root / "data"
    assert SCHEMAS_DIR == expected_root / "schemas"
    assert default_db_path() == expected_root / "data" / "jobs.db"
    assert default_investigations_dir() == expected_root / "data" / "investigations"
    assert find_manifests_dir() == expected_root / "data" / "manifests"
    assert (
        _find_schema_path()
        == expected_root / "schemas" / "investigation-record.schema.json"
    )


def test_fastapi_application_exposes_api_only() -> None:
    paths = {
        path for route in create_app().routes if (path := getattr(route, "path", None))
    }

    assert "/api/health" in paths
    assert "/" not in paths
    assert "/_next" not in paths
