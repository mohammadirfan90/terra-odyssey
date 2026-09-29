"""Curated taxonomy for the Terra Odyssey dataset registry.

Vocabulary is split into three orthogonal axes:
  - DOMAINS    – scientific discipline (mirrors NASA's Earth Science Disciplines)
  - SUB_TOPICS – narrow sub-discipline (mirrors NASA's Earth Science Sub-Divisions)
  - USE_CASES  – user-facing goal (drives the catalog filter pills)

Every registry entry's `categories` list contains:
  * exactly one "<Domain>:<Sub-topic>" string
  * one or more entries from USE_CASES

`topic` (the legacy single-value field) is derived from `categories[0].split(":")[0]`.

Mirrored on the frontend in `frontend/lib/datasetTaxonomy.ts`.
"""

from __future__ import annotations

from typing import Dict, FrozenSet, List

# ── Domain → Sub-topic map ────────────────────────────────────────────────

DOMAINS: List[str] = [
    "Atmosphere",
    "Ocean",
    "Cryosphere",
    "Land",
    "Hydrology",
    "Biosphere",
    "Radiation",
    "Solid Earth",
]

SUB_TOPICS: Dict[str, List[str]] = {
    "Atmosphere": [
        "Temperature",
        "Precipitation",
        "Composition",
        "Air Quality",
        "Aerosols",
        "Wind",
    ],
    "Ocean": [
        "Sea Surface Temperature",
        "Salinity",
        "Sea Level",
        "Sea Ice",
        "Ocean Color",
    ],
    "Cryosphere": [
        "Sea Ice",
        "Snow",
        "Glaciers",
        "Permafrost",
    ],
    "Land": [
        "Land Cover",
        "Vegetation",
        "Fire",
        "Land Surface Temp",
        "Snow",
    ],
    "Hydrology": [
        "Soil Moisture",
        "Groundwater",
        "Surface Water",
        "Terrestrial Water Storage",
    ],
    "Biosphere": [
        "Biomass",
        "Carbon Cycle",
        "Ecosystems",
        "Vegetation",
    ],
    "Radiation": [
        "TOA Fluxes",
        "Surface Fluxes",
        "Albedo",
        "Shortwave",
    ],
    "Solid Earth": [
        "Gravity",
        "Land Surface",
    ],
}

# ── Cross-cutting use-cases (independent of domain) ───────────────────────

USE_CASES: List[str] = [
    "Climate Monitoring",
    "Air Quality & Health",
    "Water Resources",
    "Agriculture & Food",
    "Disasters",
    "Energy",
]


# ── Validation helpers ────────────────────────────────────────────────────


def _flatten_sub_topics() -> FrozenSet[str]:
    return frozenset(sub for subs in SUB_TOPICS.values() for sub in subs)


_VALID_DOMAINS: FrozenSet[str] = frozenset(DOMAINS)
_VALID_SUB_TOPICS: FrozenSet[str] = _flatten_sub_topics()
_VALID_USE_CASES: FrozenSet[str] = frozenset(USE_CASES)


def validate_categories(categories: List[str]) -> List[str]:
    """Return a list of validation error strings. Empty list = valid.

    Rule: every entry is either "<Domain>:<Sub-topic>" (both halves valid) or
    a USE_CASES value. At least one Domain:Sub-topic must be present.
    """
    errors: List[str] = []
    has_domain_subtopic = False

    for cat in categories:
        if ":" in cat:
            has_domain_subtopic = True
            domain, _, sub = cat.partition(":")
            if domain not in _VALID_DOMAINS:
                errors.append(f"Unknown domain in '{cat}' (expected one of {sorted(_VALID_DOMAINS)})")
            elif sub not in _VALID_SUB_TOPICS:
                errors.append(
                    f"Unknown sub-topic '{sub}' for domain '{domain}' "
                    f"(expected one of {sorted(SUB_TOPICS.get(domain, []))})"
                )
        elif cat in _VALID_USE_CASES:
            continue
        else:
            errors.append(
                f"Category '{cat}' is neither a 'Domain:Sub-topic' pair nor a use-case"
            )

    if not has_domain_subtopic:
        errors.append("At least one 'Domain:Sub-topic' pair is required")

    return errors


def primary_topic(categories: List[str]) -> str:
    """Derive the legacy single-value `topic` field from a categories list."""
    for cat in categories:
        if ":" in cat:
            return cat.split(":", 1)[0]
    return "Atmosphere"
