"""Verify that every `gibs_layer` referenced in the dataset registry actually
exists in the live NASA GIBS WMTS Capabilities document.

Run:
    python backend/scripts/verify_gibs.py

Exit code:
    0  – every registered layer ID was found (or is intentionally None)
    1  – one or more layers were not found in the live Capabilities document

Caches the parsed layer set at `backend/scripts/.gibs_cache.json` for 7 days
to avoid hammering the endpoint.
"""

from __future__ import annotations

import json
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import FrozenSet, List, Optional, Tuple

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

SCRIPT_DIR = Path(__file__).resolve().parent
CACHE_PATH = SCRIPT_DIR / ".gibs_cache.json"
CACHE_TTL_SECONDS = 7 * 24 * 3600

GIBS_CAPABILITIES_URL = (
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi"
    "?service=WMTS&request=GetCapabilities"
)


def _load_cache() -> Optional[FrozenSet[str]]:
    if not CACHE_PATH.is_file():
        return None
    try:
        raw = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        ts = raw.get("fetched_at", 0)
        if (time.time() - ts) > CACHE_TTL_SECONDS:
            return None
        return frozenset(raw.get("layers", []))
    except Exception:
        return None


def _save_cache(layers: FrozenSet[str]) -> None:
    CACHE_PATH.write_text(
        json.dumps(
            {
                "fetched_at": int(time.time()),
                "fetched_at_iso": datetime.now(timezone.utc).isoformat(),
                "layers": sorted(layers),
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def fetch_gibs_layers() -> FrozenSet[str]:
    """Fetch and parse the GIBS WMTS Capabilities document."""
    cached = _load_cache()
    if cached is not None:
        return cached

    if httpx is None:
        raise RuntimeError(
            "httpx not installed; `pip install httpx` to use verify_gibs.py"
        )

    print(f"Fetching {GIBS_CAPABILITIES_URL}…", file=sys.stderr)
    with httpx.Client(timeout=60.0) as client:
        resp = client.get(GIBS_CAPABILITIES_URL)
        resp.raise_for_status()
        xml_bytes = resp.content

    root = ET.fromstring(xml_bytes)
    # All <Layer><Identifier>…</Identifier></Layer> text values
    layers: List[str] = []
    for layer_el in root.iter():
        tag = layer_el.tag.rsplit("}", 1)[-1]
        if tag == "Layer":
            for child in layer_el:
                child_tag = child.tag.rsplit("}", 1)[-1]
                if child_tag == "Identifier" and child.text:
                    layers.append(child.text.strip())
    layer_set = frozenset(layers)
    _save_cache(layer_set)
    return layer_set


def _suggest(unknown: str, candidates: FrozenSet[str], k: int = 5) -> List[str]:
    needle = unknown.lower().replace("-", "_").replace(" ", "_")
    scored: List[Tuple[int, str]] = []
    for c in candidates:
        cl = c.lower()
        # Simple substring / shared-token scoring
        score = 0
        if needle in cl or cl in needle:
            score += 5
        score += sum(1 for tok in needle.split("_") if tok and tok in cl)
        if score:
            scored.append((score, c))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [c for _, c in scored[:k]]


def verify_registry_layers(known_layers: FrozenSet[str]) -> List[str]:
    """Walk the registry and report any gibs_layer not in the known set."""
    # Local import so the script can be invoked without the backend package
    # being on PYTHONPATH during simple lint checks.
    repo_root = SCRIPT_DIR.parent.parent
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    from data.registry import _REGISTRY  # type: ignore

    errors: List[str] = []
    for entry in _REGISTRY:
        layer = entry.gibs_layer
        if layer is None:
            continue
        if layer in known_layers:
            continue
        suggestions = _suggest(layer, known_layers)
        msg = f"  ✘ {entry.dataset_id}: gibs_layer '{layer}' not in GIBS Capabilities"
        if suggestions:
            msg += "\n      suggestions: " + ", ".join(suggestions)
        errors.append(msg)
    return errors


def main() -> int:
    try:
        layers = fetch_gibs_layers()
    except Exception as exc:
        print(f"FAILED to fetch GIBS Capabilities: {exc}", file=sys.stderr)
        return 2

    print(f"GIBS Capabilities: {len(layers)} known layers")

    errors = verify_registry_layers(layers)
    if errors:
        print("\nGIBS verification FAILED:\n", file=sys.stderr)
        print("\n".join(errors), file=sys.stderr)
        return 1

    print("GIBS verification OK — all registry layers found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
