"""Unit tests and schema validation for paired regional difference contrast estimator."""

import json
from pathlib import Path
import jsonschema
import numpy as np
import pytest

from src.analysis.paired_contrast import estimate_paired_contrast


@pytest.fixture
def analysis_result_schema():
    """Load the JSON schema for AnalysisResult."""
    schema_path = Path(__file__).resolve().parents[2] / "schemas" / "analysis-result.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_opposite_trend_pair_supported(analysis_result_schema):
    """Verify statistically supported opposite trend pair when signs differ and contrast is significant."""
    years = np.arange(2001, 2026)  # 25 years
    x = years - np.mean(years)
    np.random.seed(42)

    # Region A warming at +0.40 degC/decade (0.04/yr)
    val_a = 15.0 + 0.04 * x + np.random.normal(0, 0.03, len(years))
    # Region B cooling at -0.30 degC/decade (-0.03/yr)
    val_b = 22.0 - 0.03 * x + np.random.normal(0, 0.03, len(years))

    geom_a = {"type": "Polygon", "coordinates": [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]]}
    geom_b = {"type": "Polygon", "coordinates": [[[10, 10], [15, 10], [15, 15], [10, 15], [10, 10]]]}

    res = estimate_paired_contrast(
        years_a=years,
        values_a=val_a,
        years_b=years,
        values_b=val_b,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
        geometry_a=geom_a,
        geometry_b=geom_b,
    )

    # 1. Status must be supported opposite trend pair
    assert res["status"] == "supported"
    assert res["method"]["diagnostics"]["contrast_sub_status"] == "opposite_trend_pair"

    # 2. Recovered slope difference should be near (+0.40 - (-0.30)) = +0.70 degC/decade
    diff_estimate = res["effect"]["estimate"]
    assert pytest.approx(0.70, abs=0.08) == diff_estimate

    # 3. Individual estimates reported
    assert res["effect"]["region_a_estimate"] > 0
    assert res["effect"]["region_b_estimate"] < 0
    assert res["effect"]["contrast_orientation"] == "region_a_minus_region_b"

    # 4. Schema validation
    jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_same_sign_slopes_inconclusive(analysis_result_schema):
    """Verify that same-sign empirical slopes yield status='inconclusive' even if contrast p < 0.05."""
    years = np.arange(2001, 2026)
    x = years - np.mean(years)
    np.random.seed(99)

    # Region A warming at +0.50 degC/decade
    val_a = 10.0 + 0.05 * x + np.random.normal(0, 0.02, len(years))
    # Region B warming at +0.10 degC/decade (difference is +0.40, highly significant)
    val_b = 20.0 + 0.01 * x + np.random.normal(0, 0.02, len(years))

    geom_a = {"type": "Polygon", "coordinates": [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]]}
    geom_b = {"type": "Polygon", "coordinates": [[[10, 10], [15, 10], [15, 15], [10, 15], [10, 10]]]}

    res = estimate_paired_contrast(
        years_a=years,
        values_a=val_a,
        years_b=years,
        values_b=val_b,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
        geometry_a=geom_a,
        geometry_b=geom_b,
    )

    # Contrast slope difference is significant, but signs are both positive!
    assert res["status"] == "inconclusive"
    assert res["method"]["diagnostics"]["contrast_sub_status"] == "signs_not_opposite"
    assert any("share the same sign" in c for c in res["caveats"])
    jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_opposite_signs_nonsignificant_contrast(analysis_result_schema):
    """Verify that opposite empirical signs with nonsignificant contrast yield status='inconclusive'."""
    years = np.arange(2001, 2026)
    x = years - np.mean(years)
    np.random.seed(2)

    # Slopes are weak (+0.05 vs -0.05 degC/decade) with noise yielding p = 0.0568 >= 0.05
    val_a = 15.0 + 0.005 * x + np.random.normal(0, 0.15, len(years))
    val_b = 15.0 - 0.005 * x + np.random.normal(0, 0.15, len(years))

    geom_a = {"type": "Polygon", "coordinates": [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]]}
    geom_b = {"type": "Polygon", "coordinates": [[[10, 10], [15, 10], [15, 15], [10, 15], [10, 10]]]}

    res = estimate_paired_contrast(
        years_a=years,
        values_a=val_a,
        years_b=years,
        values_b=val_b,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
        geometry_a=geom_a,
        geometry_b=geom_b,
    )

    assert res["status"] == "inconclusive"
    assert res["method"]["diagnostics"]["contrast_sub_status"] == "contrast_not_supported"
    jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_insufficient_common_years_ineligible(analysis_result_schema):
    """Verify series with fewer than 20 common years returns status='ineligible'."""
    years_a = np.arange(2000, 2015)  # 15 years
    years_b = np.arange(2000, 2015)
    val_a = np.linspace(10, 12, 15)
    val_b = np.linspace(20, 18, 15)

    geom_a = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}
    geom_b = {"type": "Polygon", "coordinates": [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]]}

    res = estimate_paired_contrast(
        years_a=years_a,
        values_a=val_a,
        years_b=years_b,
        values_b=val_b,
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
        geometry_a=geom_a,
        geometry_b=geom_b,
    )

    assert res["status"] == "ineligible"
    assert "below minimum inferential threshold" in res["caveats"][0]
    jsonschema.validate(instance=res, schema=analysis_result_schema)


def test_linearity_equivalence():
    """Verify exact algebraic linearity: beta_D == beta_A - beta_B."""
    years = np.arange(2000, 2025)
    np.random.seed(77)
    val_a = np.random.normal(10, 2, len(years))
    val_b = np.random.normal(15, 3, len(years))

    geom = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}

    res = estimate_paired_contrast(
        years_a=years,
        values_a=val_a,
        years_b=years,
        values_b=val_b,
        dataset_id="d2_gpm_imerg",
        variable="precipitationCal",
        units="mm/year",
        unit_per_decade="mm/year/decade",
        geometry_a=geom,
        geometry_b=geom,
    )

    diff_est = res["effect"]["estimate"]
    a_est = res["effect"]["region_a_estimate"]
    b_est = res["effect"]["region_b_estimate"]

    assert pytest.approx(a_est - b_est, rel=1e-10) == diff_est
