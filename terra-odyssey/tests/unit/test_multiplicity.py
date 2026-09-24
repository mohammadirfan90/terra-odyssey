"""Unit tests for multiple-testing adjustment and contrast family evidence adjudication."""

import json
from pathlib import Path
import jsonschema
import numpy as np
import pytest

from src.analysis.multiplicity import (
    adjudicate_contrast_family,
    adjust_pvalues,
)
from src.analysis.paired_contrast import estimate_paired_contrast


@pytest.fixture
def analysis_result_schema():
    """Load the JSON schema for AnalysisResult."""
    schema_path = Path(__file__).resolve().parents[2] / "schemas" / "analysis-result.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_by_controls_fdr_under_null():
    """Verify Benjamini-Yekutieli controls false discovery rate under global null (Uniform p-values)."""
    np.random.seed(42)
    n_hypotheses = 100
    p_null = np.random.uniform(0.0, 1.0, n_hypotheses)

    reject_by, adj_p_by = adjust_pvalues(p_null, method="fdr_by", alpha=0.05)
    fdr_observed = np.mean(reject_by)

    # Under global null, false discovery rate should be strictly <= alpha (0.05)
    assert fdr_observed <= 0.05


def test_by_more_conservative_than_bh():
    """Verify Benjamini-Yekutieli adjusted p-values are strictly >= Benjamini-Hochberg."""
    np.random.seed(99)
    p_vals = np.array([0.001, 0.01, 0.03, 0.045, 0.08, 0.15, 0.50])

    _, adj_by = adjust_pvalues(p_vals, method="fdr_by", alpha=0.05)
    _, adj_bh = adjust_pvalues(p_vals, method="fdr_bh", alpha=0.05)

    # BY adjustment factor is sum(1/i) for i in 1..m
    assert np.all(adj_by >= adj_bh)


def test_family_readjudication_downgrades_marginal_significance(analysis_result_schema):
    """Verify that a nominally significant test (p=0.035) in a family of 20 tests is downgraded."""
    years = np.arange(2001, 2026)
    x = years - np.mean(years)
    np.random.seed(42)

    # Region A and B
    val_a = 15.0 + 0.03 * x + np.random.normal(0, 0.05, len(years))
    val_b = 20.0 - 0.02 * x + np.random.normal(0, 0.05, len(years))
    geom = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}

    primary_res = estimate_paired_contrast(
        years_a=years,
        values_a=val_a,
        years_b=years,
        values_b=val_b,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
        geometry_a=geom,
        geometry_b=geom,
    )

    # Manually inject marginal p_value = 0.035
    primary_res["method"]["raw_p_value"] = 0.035
    primary_res["method"]["p_value"] = 0.035
    primary_res["status"] = "supported"
    primary_res["method"]["diagnostics"]["contrast_sub_status"] = "opposite_trend_pair"

    # Embed in a family of M = 20 tests with other p-values
    family = [dict(primary_res)]
    for i in range(1, 20):
        dummy = dict(primary_res)
        dummy["analysis_id"] = f"contrast_hyp_{i}"
        dummy["method"] = dict(primary_res["method"])
        dummy["method"]["raw_p_value"] = min(0.99, 0.05 + 0.04 * i)
        dummy["method"]["p_value"] = dummy["method"]["raw_p_value"]
        dummy["status"] = "inconclusive"
        family.append(dummy)

    adjudicated = adjudicate_contrast_family(family, family_id="amazon_vs_sahara_candidates", fdr_level=0.05)

    # First test should be downgraded because BY-adjusted p > 0.05
    first_res = adjudicated[0]
    assert first_res["status"] == "inconclusive"
    assert first_res["method"]["selection_status"] == "exploratory_map_selected"
    assert first_res["method"]["multiplicity_method"] == "fdr_by"
    assert first_res["method"]["adjusted_p_value"] > 0.05
    assert first_res["method"]["diagnostics"]["contrast_sub_status"] == "contrast_not_supported_after_multiplicity"
    assert any("multiplicity control" in c for c in first_res["caveats"])

    # Schema validation
    for res in adjudicated:
        jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_supported_under_multiplicity_retains_status(analysis_result_schema):
    """Verify strong contrast (p=1e-5) remains supported after BY adjustment across 30 tests."""
    years = np.arange(2001, 2026)
    x = years - np.mean(years)
    np.random.seed(42)

    val_a = 15.0 + 0.06 * x + np.random.normal(0, 0.02, len(years))
    val_b = 20.0 - 0.06 * x + np.random.normal(0, 0.02, len(years))
    geom = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}

    primary_res = estimate_paired_contrast(
        years_a=years,
        values_a=val_a,
        years_b=years,
        values_b=val_b,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
        geometry_a=geom,
        geometry_b=geom,
    )

    primary_res["method"]["raw_p_value"] = 1e-5
    primary_res["method"]["p_value"] = 1e-5
    primary_res["status"] = "supported"
    primary_res["method"]["diagnostics"]["contrast_sub_status"] = "opposite_trend_pair"

    family = [dict(primary_res)]
    for i in range(1, 30):
        dummy = dict(primary_res)
        dummy["analysis_id"] = f"contrast_hyp_{i}"
        dummy["method"] = dict(primary_res["method"])
        dummy["method"]["raw_p_value"] = 0.20 + 0.02 * i
        dummy["status"] = "inconclusive"
        family.append(dummy)

    adjudicated = adjudicate_contrast_family(family, family_id="global_regional_search", fdr_level=0.05)

    assert adjudicated[0]["status"] == "supported"
    assert adjudicated[0]["method"]["diagnostics"]["contrast_sub_status"] == "opposite_trend_pair"
    assert adjudicated[0]["method"]["adjusted_p_value"] < 0.05
    jsonschema.validate(instance=adjudicated[0], schema=analysis_result_schema)
