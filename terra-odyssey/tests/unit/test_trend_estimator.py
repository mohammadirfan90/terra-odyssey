"""Unit tests and schema validation for linear trend estimator."""

import json
from pathlib import Path
import jsonschema
import numpy as np
import pytest

from src.analysis.trend_estimator import estimate_linear_trend


@pytest.fixture
def analysis_result_schema():
    """Load the JSON schema for AnalysisResult."""
    schema_path = Path(__file__).resolve().parents[2] / "schemas" / "analysis-result.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_known_synthetic_slope(analysis_result_schema):
    """Verify estimator recovers known slope and fitted change on a 25-year series."""
    years = np.arange(2001, 2026)  # 25 years: 2001 to 2025
    true_slope_per_decade = 0.45  # 0.045 degC / year
    true_slope_per_year = true_slope_per_decade / 10.0
    x = years - np.mean(years)

    np.random.seed(42)
    noise = np.random.normal(0, 0.05, len(years))
    values = 14.0 + true_slope_per_year * x + noise

    res = estimate_linear_trend(
        years=years,
        values=values,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
        confidence_level=0.95,
    )

    # 1. Status must be supported
    assert res["status"] == "supported"

    # 2. Estimate recovered near 0.45 degC/decade
    recovered_slope = res["effect"]["estimate"]
    assert pytest.approx(true_slope_per_decade, abs=0.05) == recovered_slope

    # 3. Fitted change must be slope_per_year * (2025 - 2001) = slope_per_year * 24
    expected_span = 2025 - 2001  # 24 years
    expected_fitted_change = (recovered_slope / 10.0) * expected_span
    assert pytest.approx(expected_fitted_change, rel=1e-6) == res["effect"]["fitted_change"]

    # 4. Uncertainty bounds enclose estimate
    assert res["uncertainty"]["lower"] < recovered_slope < res["uncertainty"]["upper"]
    assert res["uncertainty"]["level"] == 0.95

    # 5. Schema validation
    jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_ineligible_short_series(analysis_result_schema):
    """Verify series shorter than 20 years returns status='ineligible'."""
    years = np.arange(2010, 2025)  # 15 years
    values = np.linspace(10.0, 12.0, 15)

    res = estimate_linear_trend(
        years=years,
        values=values,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
    )

    assert res["status"] == "ineligible"
    assert res["effect"]["estimate"] == 0.0
    assert "below minimum inferential threshold" in res["caveats"][0]
    jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_ineligible_non_consecutive(analysis_result_schema):
    """Verify series with temporal gaps returns status='ineligible'."""
    years = np.array([2000, 2001, 2002, 2003, 2005, 2006, 2007, 2008, 2009, 2010,
                      2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021])
    values = np.linspace(10.0, 15.0, len(years))

    res = estimate_linear_trend(
        years=years,
        values=values,
        dataset_id="d2_gpm_imerg",
        variable="precipitationCal",
        units="mm/year",
        unit_per_decade="mm/year/decade",
    )

    assert res["status"] == "ineligible"
    assert "Cannot collapse time" in res["caveats"][0]
    assert "2004" in res["coverage"]["missing_periods"]
    jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_theil_sen_outlier_robustness(analysis_result_schema):
    """Verify Theil-Sen diagnostic identifies outlier divergence from OLS."""
    years = np.arange(2000, 2025)  # 25 years
    values = np.full(25, 20.0)
    # Introduce a massive single-year outlier at index 12 (year 2012)
    values[12] = 100.0

    res = estimate_linear_trend(
        years=years,
        values=values,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
    )

    theil_diag = res["method"]["diagnostics"]["theil_sen"]
    assert "slope_per_decade" in theil_diag
    assert "direction_agreement_with_ols" in theil_diag
    # Theil-Sen is resistant to the single outlier and estimates ~0 slope
    assert abs(theil_diag["slope_per_decade"]) < 0.1
    # OLS is influenced by the outlier
    assert theil_diag["absolute_difference_from_ols"] > 0.0

    jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_lag_sensitivities_present(analysis_result_schema):
    """Verify lag sensitivities for L=1, 3, 5 are recorded in diagnostics."""
    years = np.arange(2001, 2025)  # 24 years
    values = np.linspace(12.0, 14.0, 24)

    res = estimate_linear_trend(
        years=years,
        values=values,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
    )

    sens = res["method"]["diagnostics"]["lag_sensitivities"]
    assert "lag_1" in sens
    assert "lag_3" in sens
    assert "lag_5" in sens
    assert sens["lag_1"]["maxlags"] == 1
    assert sens["lag_3"]["maxlags"] == 3
    assert sens["lag_5"]["maxlags"] == 5

    jsonschema.validate(instance=res, schema=analysis_result_schema)
