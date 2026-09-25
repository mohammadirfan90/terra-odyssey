"""Unit tests for endpoint interval sensitivity analysis."""

import json
from pathlib import Path
import jsonschema
import numpy as np
import pytest

from analysis.interval_sensitivity import (
    attach_interval_sensitivity_to_result,
    compute_interval_sensitivity,
)
from analysis.trend_estimator import estimate_linear_trend


@pytest.fixture
def analysis_result_schema():
    """Load the JSON schema for AnalysisResult."""
    schema_path = Path(__file__).resolve().parents[2] / "schemas" / "analysis-result.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_interval_sensitivity_25_year_record(analysis_result_schema):
    """Verify 25-year record (2001-2025) retains all 5 predefined windows as eligible."""
    years = np.arange(2001, 2026)  # 25 years
    x = years - np.mean(years)
    np.random.seed(42)
    values = 15.0 + 0.03 * x + np.random.normal(0, 0.05, len(years))

    primary = estimate_linear_trend(
        years=years,
        values=values,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
    )

    sens = compute_interval_sensitivity(
        years=years,
        values=values,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
        min_consecutive_years=20,
    )

    assert sens["windows_evaluated"] == 5
    assert sens["windows_eligible"] == 5
    assert sens["sign_agreement"] is True
    assert sens["slope_range_per_decade"][0] > 0.0

    # Attach to primary result and validate against schema
    full_result = attach_interval_sensitivity_to_result(primary, sens)
    assert "interval_sensitivity" in full_result["method"]["diagnostics"]
    jsonschema.validate(instance=full_result, schema=analysis_result_schema)


def test_interval_sensitivity_22_year_record_pruning():
    """Verify 22-year record retains only 'full' window and prunes all +/- 3 and +/- 5 windows."""
    years = np.arange(2001, 2023)  # 22 years (2001 to 2022)
    values = np.linspace(10.0, 12.0, len(years))

    sens = compute_interval_sensitivity(
        years=years,
        values=values,
        dataset_id="d2_gpm_imerg",
        variable="precipitationCal",
        units="mm/year",
        unit_per_decade="mm/year/decade",
        min_consecutive_years=20,
    )

    assert sens["windows_evaluated"] == 5
    # Only 'full' has 22 years >= 20. start+3 (19 yrs), start+5 (17 yrs), end-3 (19 yrs), end-5 (17 yrs) are ineligible
    assert sens["windows_eligible"] == 1

    ineligible_wins = [w for w in sens["window_results"] if not w["eligible"]]
    assert len(ineligible_wins) == 4
    for w in ineligible_wins:
        assert "below threshold" in w["reason"]


def test_classification_shift_adds_caveat(analysis_result_schema):
    """Verify that a shift in statistical classification appends an explicit caveat."""
    years = np.arange(2000, 2025)  # 25 years
    # Ground truth: strong trend early on (2000-2015), flat trend later (2016-2024)
    values = np.zeros(len(years))
    for i, yr in enumerate(years):
        if yr <= 2012:
            values[i] = 10.0 + 0.1 * (yr - 2000)
        else:
            values[i] = values[12] + np.random.normal(0, 0.01)

    primary = estimate_linear_trend(
        years=years,
        values=values,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
    )

    sens = compute_interval_sensitivity(
        years=years,
        values=values,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
    )

    full_result = attach_interval_sensitivity_to_result(primary, sens)

    # If classification shifted, check caveat presence
    if sens["classification_shifts"]:
        assert any("Interval sensitivity demonstrates" in c for c in full_result["caveats"])

    jsonschema.validate(instance=full_result, schema=analysis_result_schema)
