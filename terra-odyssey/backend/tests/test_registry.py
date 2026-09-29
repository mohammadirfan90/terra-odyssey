"""Registry integrity tests — ensures every entry in `_REGISTRY` is well-formed.

Run: `pytest backend/tests/test_registry.py -v`

Checks:
  * every entry validates as a DatasetRegistryEntry dataclass
  * every `categories` string passes `validate_categories()`
  * every `dataset_id` is unique
  * every `manifest_name` points to an existing JSON file
  * every `adapter_class` is either None or importable
  * every `topic` value matches the first domain in `categories`
"""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pytest

# ── Make the backend package importable ───────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = REPO_ROOT / "backend" / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from backend.schemas import DatasetCapabilities  # noqa: E402
from data.registry import _REGISTRY, DatasetRegistryEntry  # noqa: E402
from data.topics import primary_topic, validate_categories  # noqa: E402

DATA_DIR = REPO_ROOT / "backend" / "data" / "manifests"


def test_registry_is_non_empty() -> None:
    assert len(_REGISTRY) >= 10, "Expected at least the original 10 datasets"


def test_no_duplicate_dataset_ids() -> None:
    seen: set[str] = set()
    dupes: list[str] = []
    for entry in _REGISTRY:
        if entry.dataset_id in seen:
            dupes.append(entry.dataset_id)
        seen.add(entry.dataset_id)
    assert not dupes, f"Duplicate dataset_ids: {dupes}"


def test_every_entry_is_a_dataclass_instance() -> None:
    for entry in _REGISTRY:
        assert isinstance(entry, DatasetRegistryEntry)


def test_every_categories_list_is_valid() -> None:
    for entry in _REGISTRY:
        errs = validate_categories(entry.categories)
        assert not errs, f"{entry.dataset_id} has invalid categories: {errs}"


def test_topic_matches_first_category_domain() -> None:
    for entry in _REGISTRY:
        if entry.categories:
            assert primary_topic(entry.categories) == entry.topic, (
                f"{entry.dataset_id}: topic='{entry.topic}' disagrees with "
                f"primary_topic(categories)='{primary_topic(entry.categories)}'"
            )


def test_every_manifest_file_exists() -> None:
    missing: list[str] = []
    for entry in _REGISTRY:
        path = DATA_DIR / entry.manifest_name
        if not path.is_file():
            missing.append(f"{entry.dataset_id} → {entry.manifest_name}")
    assert not missing, f"Missing manifest files:\n  " + "\n  ".join(missing)


def test_every_manifest_is_valid_json() -> None:
    for entry in _REGISTRY:
        path = DATA_DIR / entry.manifest_name
        if not path.is_file():
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            pytest.fail(f"{entry.manifest_name}: invalid JSON ({exc})")


def test_every_adapter_class_is_importable() -> None:
    for entry in _REGISTRY:
        cls = entry.adapter_class
        if cls is None:
            continue
        module_name = cls.__module__
        # Just ensure the module imports without error
        importlib.import_module(module_name)


def test_capabilities_are_consistent() -> None:
    for entry in _REGISTRY:
        caps = entry.capabilities
        if caps.trend_supported:
            assert caps.series_supported, (
                f"{entry.dataset_id}: trend_supported requires series_supported"
            )
        if caps.contrast_supported:
            assert caps.series_supported, (
                f"{entry.dataset_id}: contrast_supported requires series_supported"
            )
        if not caps.discoverable:
            pytest.fail(f"{entry.dataset_id}: discoverable must always be true")


def test_gibs_layer_is_none_or_string() -> None:
    for entry in _REGISTRY:
        if entry.gibs_layer is not None:
            assert isinstance(entry.gibs_layer, str)
            assert entry.gibs_layer.strip(), f"{entry.dataset_id}: empty gibs_layer"


def test_capabilities_is_pydantic_instance() -> None:
    for entry in _REGISTRY:
        assert isinstance(entry.capabilities, DatasetCapabilities)
