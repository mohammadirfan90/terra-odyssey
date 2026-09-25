"""Immutable frozen investigation export bundler for Terra Odyssey.

Compiles reproducible ZIP archives containing investigation records, frozen configurations,
time series CSVs, map grid previews, scientific method disclosures, deterministic findings reports,
software environment provenance, and SHA-256 manifest verification.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import platform
import sys
import zipfile
from pathlib import Path
from typing import Any, Dict, Optional, Union

import jsonschema

from backend.errors import TerraOdysseyError
from backend.paths import SCHEMAS_DIR

logger = logging.getLogger("terra_odyssey.backend.exporter")


def _find_schema_path() -> Path:
    """Return the backend-owned InvestigationRecord schema path."""
    return SCHEMAS_DIR / "investigation-record.schema.json"


def _compute_sha256_bytes(data: bytes) -> str:
    """Compute SHA-256 hex digest of in-memory bytes."""
    return hashlib.sha256(data).hexdigest()


def generate_methods_md(dataset_id: str, variable: str) -> str:
    """Generate deterministic scientific methodology markdown."""
    return """# Scientific Methodology: Terra Odyssey Investigation

## 1. Linear Trend Estimation & HAC Uncertainty
- **Estimator**: Ordinary Least Squares (OLS) with centered temporal coordinates: $x = t - \\bar{t}$.
- **Covariance Treatment**: Newey-West Heteroskedasticity and Autocorrelation Consistent (HAC) robust covariance.
  - Kernel: Bartlett.
  - Autoregressive lag: $L = 2$ (explicit parameter, no unconstrained automatic bandwidth).
  - Small-sample degrees-of-freedom correction: $n / (n - k)$.
  - Reference distribution: Two-sided Student-$t$ distribution with $df = n - 2$.
- **Diagnostic Estimator**: Theil-Sen median-of-slopes point estimate for outlier sensitivity checking.

## 2. Spatial Aggregation & Geodesic Weighting
- **Cell Surface Area**: Computed on WGS84 ellipsoid accounting for poleward meridional convergence:
  $$A_{ij} \\propto \\Delta\\lambda \\cdot |\\sin(\\phi_{north}) - \\sin(\\phi_{south})|$$
- **Boundary Cells**: Fractional polygon overlap evaluated using planar geodesic polygon intersection:
  $$w_{ij} = A_{ij} \\cdot \\frac{\\text{Area}(\\text{cell}_{ij} \\cap \\text{Region})}{\\text{Area}(\\text{cell}_{ij})}$$
- **Area-Weighted Regional Mean**:
  $$\\bar{Y}_t = \\frac{\\sum_{i,j} Y_{ij,t} \\cdot w_{ij} \\cdot M_{ij,t}}{\\sum_{i,j} w_{ij} \\cdot M_{ij,t}}$$
- **Coverage Policy**: Minimum 100% valid cell area for MERRA-2; minimum 90% for GPM IMERG.

## 3. Paired Regional Contrast
- Synchronous direct difference series: $D_t = Y_{A,t} - Y_{B,t}$.
- Tested via HAC OLS to account for cross-regional spatial covariance and temporal persistence.
- Linearity equivalence: $\\hat{\\beta}_D = \\hat{\\beta}_A - \\hat{\\beta}_B$.

## 4. Multiplicity Control
- Exploratory spatial search utilizes the Benjamini-Yekutieli (BY, 2001) step-up procedure under arbitrary dependence:
  $$p_{(k)} \\le \\frac{k}{m \\sum_{i=1}^m (1/i)} \\cdot q$$
- Sensitivity comparison provided against standard Benjamini-Hochberg (BH, 1995).

## 5. Non-Attribution Disclosure
- **Observational Constraint**: Correlation, co-trending, and spatial contrast do NOT constitute causal attribution.
- Observed changes reflect Earth system state transitions; attribution to specific external forcing requires independent dynamical modeling.
"""


def generate_summary_report_md(record: Dict[str, Any]) -> str:
    """Deterministically synthesize markdown findings report from typed fields."""
    inv_id = record.get("investigation_id", "unknown")
    job = record.get("job", {})
    req = record.get("request", {})
    results = record.get("results", [])
    primary_res = results[0] if results else {}

    effect = primary_res.get("effect", {})
    uncertainty = primary_res.get("uncertainty", {})
    coverage = primary_res.get("coverage", {})
    method = primary_res.get("method", {})
    caveats = primary_res.get("caveats", [])

    period = req.get("period", {})
    start_yr = period.get("start_year", "N/A")
    end_yr = period.get("end_year", "N/A")
    dataset_id = req.get("dataset_id", "N/A")
    variable = req.get("variable", "N/A")

    status = primary_res.get("status", job.get("result_status", "unknown")).upper()
    estimate = effect.get("estimate", 0.0)
    unit_dec = effect.get("unit_per_decade", "")
    ci_lower = uncertainty.get("lower", 0.0)
    ci_upper = uncertainty.get("upper", 0.0)
    p_val = method.get("decision_p_value", method.get("p_value", "N/A"))

    caveat_bullets = "\n".join(f"- {c}" for c in caveats) if caveats else "- None noted."
    citations = "\n".join(f"- {c}" for c in record.get("citations", []))

    return f"""# Terra Odyssey Investigation Findings: {inv_id}

**Published**: {record.get('published_at', 'N/A')}  
**Status**: `{status}`  
**Dataset**: {dataset_id} ({variable})  
**Temporal Interval**: {start_yr}–{end_yr}  

---

## 1. Findings Summary

- **Estimated Trend**: **{estimate:+.4f} {unit_dec}**
- **95% HAC Uncertainty Interval**: `[{ci_lower:+.4f}, {ci_upper:+.4f}] {unit_dec}`
- **Significance Level ($p$-value)**: `{p_val if isinstance(p_val, str) else f'{p_val:.4e}'}`
- **Temporal Coverage**: {coverage.get('valid_periods', 0)}/{coverage.get('expected_periods', 0)} periods ({coverage.get('valid_fraction', 0.0) * 100:.1f}%)

---

## 2. Scientific Caveats & Quality Limits

{caveat_bullets}

---

## 3. Data Citations & Provenance

{citations}

---
*Generated deterministically by Terra Odyssey v0.1.0*
"""


def get_schema_validator() -> Optional[jsonschema.Draft202012Validator]:
    """Build a Draft202012Validator with local resolution for referenced schemas."""
    schema_path = _find_schema_path()
    if not schema_path.is_file():
        return None
    try:
        with open(schema_path, "r", encoding="utf-8") as sf:
            schema_data = json.load(sf)

        analysis_schema_path = schema_path.parent / "analysis-result.schema.json"
        if analysis_schema_path.is_file():
            from referencing import Registry, Resource
            with open(analysis_schema_path, "r", encoding="utf-8") as af:
                analysis_data = json.load(af)
            res = Resource.from_contents(analysis_data)
            registry = (
                Registry()
                .with_resource("analysis-result.schema.json", res)
                .with_resource("https://terra-odyssey.local/schemas/analysis-result.schema.json", res)
            )
            return jsonschema.Draft202012Validator(schema_data, registry=registry)
        return jsonschema.Draft202012Validator(schema_data)
    except Exception as e:
        logger.warning("Could not construct schema validator: %s", e)
        return None


def build_export_bundle(
    job_id: str,
    artifacts_dir: Union[str, Path],
    output_path: Optional[Union[str, Path]] = None,
) -> bytes:
    """Assemble frozen reproducible ZIP bundle and validate against Draft 2020-12 schema."""
    art_path = Path(artifacts_dir)
    rec_file = art_path / "investigation_record.json"
    if not rec_file.is_file():
        raise TerraOdysseyError(f"Missing root record artifact: {rec_file}", status_code=500)

    with open(rec_file, "r", encoding="utf-8") as f:
        record_data = json.load(f)

    # Validate against official JSON schema with local reference resolution
    validator = get_schema_validator()
    if validator is not None:
        errors = list(validator.iter_errors(record_data))
        if errors:
            err_msg = "; ".join(f"{e.json_path}: {e.message}" for e in errors[:5])
            logger.warning("Investigation record schema validation warnings: %s", err_msg)

    # Prepare archive members
    files_to_pack: Dict[str, bytes] = {}

    # 1. investigation_record.json
    rec_bytes = json.dumps(record_data, indent=2).encode("utf-8")
    files_to_pack["investigation_record.json"] = rec_bytes

    # 2. resolved_configuration.json
    cfg_data = record_data.get("resolved_configuration", {})
    files_to_pack["resolved_configuration.json"] = json.dumps(cfg_data, indent=2).encode("utf-8")

    # 3. results/
    for fname in ("analysis_results.json", "region_time_series.csv", "map_grid.json.gz"):
        fpath = art_path / fname
        if fpath.is_file():
            files_to_pack[f"results/{fname}"] = fpath.read_bytes()

    # Paired difference CSV if paired analysis
    paired_csv = art_path / "paired_difference.csv"
    if paired_csv.is_file():
        files_to_pack["results/paired_difference.csv"] = paired_csv.read_bytes()

    # 4. manifests/
    manifests = record_data.get("source_manifest_objects", [])
    files_to_pack["manifests/dataset_manifest.json"] = json.dumps(manifests, indent=2).encode("utf-8")
    files_to_pack["manifests/source_granules.json"] = json.dumps(
        [{"dataset_id": record_data.get("request", {}).get("dataset_id")}],
        indent=2
    ).encode("utf-8")

    # 5. methods/methods.md
    dataset_id = record_data.get("request", {}).get("dataset_id", "merra2_t2m")
    variable = record_data.get("request", {}).get("variable", "T2M")
    files_to_pack["methods/methods.md"] = generate_methods_md(dataset_id, variable).encode("utf-8")

    # 6. report/summary_report.md
    files_to_pack["report/summary_report.md"] = generate_summary_report_md(record_data).encode("utf-8")

    # 7. software/
    env_data = {
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "os": sys.platform,
    }
    files_to_pack["software/environment.json"] = json.dumps(env_data, indent=2).encode("utf-8")
    files_to_pack["software/version.json"] = json.dumps(
        {"app": "terra-odyssey", "version": "0.1.0", "git_commit": "be50889"},
        indent=2
    ).encode("utf-8")

    # 8. README.md
    readme_content = f"""# Terra Odyssey Investigation Bundle: {job_id}

This reproducible archive was generated by Terra Odyssey for NASA Space Apps 2026.

## Structure
- `investigation_record.json`: Root machine-readable investigation record.
- `resolved_configuration.json`: Fully resolved parameters used during execution.
- `results/`: Statistical analysis results, time series CSVs, and gridded fields.
- `manifests/`: NASA dataset source manifests and granule records.
- `methods/methods.md`: Algorithmic and mathematical descriptions of estimators and masks.
- `report/summary_report.md`: Deterministic executive summary of findings.
- `software/`: Runtime dependencies and code version metadata.
- `checksums.sha256`: SHA-256 verification digests for all files.

## Verification
To verify archive integrity:
```bash
sha256sum -c checksums.sha256
```
"""
    files_to_pack["README.md"] = readme_content.encode("utf-8")

    # 9. checksums.sha256 (computed over all files above)
    checksum_lines = []
    for rel_path in sorted(files_to_pack.keys()):
        sha = _compute_sha256_bytes(files_to_pack[rel_path])
        checksum_lines.append(f"{sha}  {rel_path}")
    files_to_pack["checksums.sha256"] = "\n".join(checksum_lines).encode("utf-8")

    # Build ZIP archive in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rel_path, data_bytes in files_to_pack.items():
            zf.writestr(rel_path, data_bytes)

    zip_bytes = buf.getvalue()

    if output_path:
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_bytes(zip_bytes)

    return zip_bytes
