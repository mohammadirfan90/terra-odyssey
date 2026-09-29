"""Unit tests for linear trend estimator — scientific correctness and policy enforcement.

Coverage targets
----------------
* D1 — TREND_MIN_YEARS=20 policy: 3-19 year series must be ineligible.
* D2 — FDR guard: exploratory result without adjusted_p_value must raise ValueError.
* D3 — Coverage: missing endpoint years must appear in missing_periods, not 1.0 valid_fraction.
* D4 — maxlags label: reported maxlags must equal the effective lag used, not always 2.
* D5 — CI text: interpretation must reference the actual confidence level, not hard-coded 95%.
* D6 — Inf rejection: positive/negative infinity must raise ValueError before OLS.
* D7 — Input validation: duplicate years, unsorted years, mismatched shapes must raise ValueError.
* Known-slope recovery on 25-year series.
* Theil-Sen diagnostic near-zero slope.
* Lag sensitivity keys present for full-length series.
* Schema validation for supported, inconclusive, and ineligible results.
"""

import json
from pathlib import Path
import jsonschema
import numpy as np
import pytest

from analysis.aggregation import TREND_MIN_YEARS
from analysis.trend_estimator import (
    _validate_fit_inputs,
    adjudicate_trend_evidence,
    estimate_linear_trend,
    fit_ols_hac_trend,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def analysis_result_schema():
    """Load the JSON schema for AnalysisResult."""
    schema_path = Path(__file__).resolve().parents[2] / "schemas" / "analysis-result.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _make_years(n: int, start: int = 2000) -> np.ndarray:
    return np.arange(start, start + n, dtype=int)


def _trend_call(years, values, **kwargs):
    defaults = dict(
        dataset_id="d1_merra2",
        variable="T2M",
        units="degC",
        unit_per_decade="degC/decade",
    )
    defaults.update(kwargs)
    return estimate_linear_trend(years=years, values=values, **defaults)


# ---------------------------------------------------------------------------
# D1 — min_years policy (TREND_MIN_YEARS = 20)
# ---------------------------------------------------------------------------

class TestEligibilityPolicy:
    """D1: No series shorter than TREND_MIN_YEARS may yield status='supported' or 'inconclusive'."""

    @pytest.mark.parametrize("n", [3, 5, 10, 15, 19])
    def test_short_series_ineligible(self, n, analysis_result_schema):
        """Series with n < TREND_MIN_YEARS years must be ineligible."""
        years = _make_years(n)
        values = np.linspace(10.0, 12.0, n)
        res = _trend_call(years, values)
        assert res["status"] == "ineligible", (
            f"Expected ineligible for n={n} (TREND_MIN_YEARS={TREND_MIN_YEARS}), got {res['status']}"
        )
        assert "below minimum inferential threshold" in res["caveats"][0]
        assert res["effect"]["estimate"] == 0.0
        jsonschema.validate(instance=res, schema=analysis_result_schema)

    def test_exact_min_years_eligible(self, analysis_result_schema):
        """Series with exactly TREND_MIN_YEARS years must pass the gate."""
        n = TREND_MIN_YEARS
        years = _make_years(n)
        np.random.seed(7)
        values = 14.0 + 0.02 * (years - years.mean()) + np.random.normal(0, 0.1, n)
        res = _trend_call(years, values)
        assert res["status"] in {"supported", "inconclusive"}, (
            f"Expected eligible for n={n}, got {res['status']}"
        )
        jsonschema.validate(instance=res, schema=analysis_result_schema)

    def test_two_year_ineligible(self, analysis_result_schema):
        """2-year series: ineligible (was the old explicit test, kept for regression)."""
        years = _make_years(2, start=2023)
        values = np.linspace(10.0, 12.0, 2)
        # 2 years triggers _validate_fit_inputs (only 2 valid points → DoF < 1)
        # after the input-validation guard the series must be rejected cleanly
        with pytest.raises((ValueError, Exception)):
            _trend_call(years, values)

    def test_policy_constant_is_20(self):
        """TREND_MIN_YEARS must be 20 — the authoritative project value."""
        assert TREND_MIN_YEARS == 20, (
            f"TREND_MIN_YEARS changed from 20 to {TREND_MIN_YEARS}; update this test only if "
            f"you have a documented scientific justification."
        )


# ---------------------------------------------------------------------------
# D2 — FDR guard for exploratory results
# ---------------------------------------------------------------------------

class TestFDRGuard:
    """D2: exploratory_map_selected without adjusted_p_value must raise ValueError."""

    def test_exploratory_without_adjusted_p_raises(self):
        """adjudicate_trend_evidence must raise when metadata is missing."""
        with pytest.raises(ValueError, match="adjusted_p_value"):
            adjudicate_trend_evidence(
                raw_p_value=0.01,
                selection_status="exploratory_map_selected",
                adjusted_p_value=None,   # missing
                family_id="fam_xyz",
                family_size=10,
                hypothesis_id="hyp_1",
                multiplicity_method="fdr_by",
            )

    def test_exploratory_missing_family_id_raises(self):
        with pytest.raises(ValueError, match="family_id"):
            adjudicate_trend_evidence(
                raw_p_value=0.01,
                selection_status="exploratory_map_selected",
                adjusted_p_value=0.03,
                family_id=None,           # missing
                family_size=10,
                hypothesis_id="hyp_1",
                multiplicity_method="fdr_by",
            )

    def test_exploratory_missing_multiplicity_method_raises(self):
        with pytest.raises(ValueError, match="multiplicity_method"):
            adjudicate_trend_evidence(
                raw_p_value=0.01,
                selection_status="exploratory_map_selected",
                adjusted_p_value=0.03,
                family_id="fam_xyz",
                family_size=10,
                hypothesis_id="hyp_1",
                multiplicity_method=None,  # missing
            )

    def test_exploratory_with_full_metadata_passes(self):
        """Complete metadata must not raise and must use adjusted_p_value for decision."""
        result = adjudicate_trend_evidence(
            raw_p_value=0.20,           # raw would be inconclusive
            selection_status="exploratory_map_selected",
            adjusted_p_value=0.03,      # adjusted → supported
            fdr_level=0.05,
            family_id="fam_xyz",
            family_size=10,
            hypothesis_id="hyp_1",
            multiplicity_method="fdr_by",
        )
        assert result["status"] == "supported"
        assert result["decision_p_value"] == pytest.approx(0.03)

    def test_predefined_does_not_need_adjusted_p(self):
        """Predefined hypothesis must work without any multiplicity metadata."""
        result = adjudicate_trend_evidence(
            raw_p_value=0.03,
            selection_status="predefined",
        )
        assert result["status"] == "supported"

    def test_estimate_linear_trend_exploratory_without_adjusted_p_raises(self, analysis_result_schema):
        """estimate_linear_trend must propagate the ValueError for bad exploratory input."""
        years = _make_years(TREND_MIN_YEARS)
        values = np.linspace(10.0, 12.0, TREND_MIN_YEARS)
        with pytest.raises(ValueError, match="adjusted_p_value"):
            _trend_call(
                years,
                values,
                selection_status="exploratory_map_selected",
                adjusted_p_value=None,
            )


# ---------------------------------------------------------------------------
# D3 — Coverage reporting from validator (no hard-coded 1.0)
# ---------------------------------------------------------------------------

class TestCoverageReporting:
    """D3: valid_fraction and missing_periods must reflect actual data gaps."""

    def test_missing_last_year_appears_in_coverage(self, analysis_result_schema):
        """If the last declared year is NaN the reported missing_periods must include it."""
        n = TREND_MIN_YEARS + 2
        years = _make_years(n)
        values = np.linspace(10.0, 14.0, n)
        values[-1] = np.nan      # last year missing
        # Series has a gap at the end → not consecutive → ineligible
        res = _trend_call(years, values)
        # Gap at end: series is ineligible due to temporal gap
        assert res["status"] == "ineligible"
        assert str(years[-1]) in res["coverage"]["missing_periods"]
        jsonschema.validate(instance=res, schema=analysis_result_schema)

    def test_missing_first_year_appears_in_coverage(self, analysis_result_schema):
        """If the first declared year is NaN the reported missing_periods must include it."""
        n = TREND_MIN_YEARS + 2
        years = _make_years(n)
        values = np.linspace(10.0, 14.0, n)
        values[0] = np.nan      # first year missing
        res = _trend_call(years, values)
        assert res["status"] == "ineligible"
        assert str(years[0]) in res["coverage"]["missing_periods"]
        jsonschema.validate(instance=res, schema=analysis_result_schema)

    def test_complete_series_has_no_missing_periods(self, analysis_result_schema):
        """Complete series must have empty missing_periods and valid_fraction = 1.0."""
        n = TREND_MIN_YEARS
        years = _make_years(n)
        np.random.seed(11)
        values = 14.0 + 0.02 * (years - years.mean()) + np.random.normal(0, 0.1, n)
        res = _trend_call(years, values)
        assert res["status"] in {"supported", "inconclusive"}
        assert res["coverage"]["missing_periods"] == []
        assert res["coverage"]["valid_fraction"] == pytest.approx(1.0)
        jsonschema.validate(instance=res, schema=analysis_result_schema)

    def test_valid_fraction_not_hardcoded(self, analysis_result_schema):
        """valid_fraction must be computed, not hard-coded to 1.0."""
        # Build a series with an internal gap to force ineligible, check fraction
        n = TREND_MIN_YEARS + 5
        years = _make_years(n)
        values = np.linspace(10.0, 14.0, n)
        values[10] = np.nan  # internal gap
        res = _trend_call(years, values)
        assert res["status"] == "ineligible"
        # valid_fraction should be < 1.0 because one year is missing
        assert res["coverage"]["valid_fraction"] < 1.0
        jsonschema.validate(instance=res, schema=analysis_result_schema)


# ---------------------------------------------------------------------------
# D4 — Actual maxlags in diagnostics
# ---------------------------------------------------------------------------

class TestMaxlagsLabel:
    """D4: reported maxlags must equal effective_maxlags used in the HAC fit."""

    def test_full_series_maxlags_is_2(self, analysis_result_schema):
        """For n >= 4, effective_maxlags = min(2, n-2) = 2; diagnostic must say 2."""
        years = _make_years(TREND_MIN_YEARS)
        np.random.seed(3)
        values = 14.0 + 0.02 * (years - years.mean()) + np.random.normal(0, 0.1, TREND_MIN_YEARS)
        res = _trend_call(years, values)
        assert res["method"]["diagnostics"]["maxlags"] == 2
        jsonschema.validate(instance=res, schema=analysis_result_schema)

    def test_fit_ols_hac_effective_lag_returned(self):
        """fit_ols_hac_trend must return 'effective_maxlags' in its output."""
        years = _make_years(25)
        values = np.linspace(10.0, 14.0, 25)
        result = fit_ols_hac_trend(years, values)
        assert "effective_maxlags" in result
        assert result["effective_maxlags"] == min(2, max(0, 25 - 2))  # = 2


# ---------------------------------------------------------------------------
# D5 — Confidence level in interpretation text
# ---------------------------------------------------------------------------

class TestCITextMatchesLevel:
    """D5: interpretation text must reflect the actual confidence_level, not always '95%'."""

    @pytest.mark.parametrize("ci_level,expected_str", [
        (0.95, "95% CI"),
        (0.90, "90% CI"),
        (0.99, "99% CI"),
    ])
    def test_ci_text_matches_level(self, ci_level, expected_str, analysis_result_schema):
        years = _make_years(TREND_MIN_YEARS)
        np.random.seed(42)
        values = 14.0 + 0.05 * (years - years.mean()) + np.random.normal(0, 0.1, TREND_MIN_YEARS)
        res = _trend_call(years, values, confidence_level=ci_level)
        interp = res["interpretation"]["text"]
        assert expected_str in interp, (
            f"Expected '{expected_str}' in interpretation for confidence_level={ci_level}, "
            f"got: '{interp}'"
        )
        assert res["uncertainty"]["level"] == pytest.approx(ci_level)
        jsonschema.validate(instance=res, schema=analysis_result_schema)


# ---------------------------------------------------------------------------
# D6 — Infinity rejection
# ---------------------------------------------------------------------------

class TestInfinityRejection:
    """D6: positive and negative infinity in values must raise ValueError before OLS."""

    def test_positive_inf_raises(self):
        years = _make_years(25)
        values = np.linspace(10.0, 14.0, 25)
        values[5] = np.inf
        with pytest.raises(ValueError, match="infinite"):
            _validate_fit_inputs(years.astype(int), values)

    def test_negative_inf_raises(self):
        years = _make_years(25)
        values = np.linspace(10.0, 14.0, 25)
        values[12] = -np.inf
        with pytest.raises(ValueError, match="infinite"):
            _validate_fit_inputs(years.astype(int), values)

    def test_nan_is_admissible(self):
        """NaN is the only admissible missing-value sentinel; must not raise."""
        years = _make_years(25)
        values = np.linspace(10.0, 14.0, 25)
        values[5] = np.nan
        # Should not raise
        _validate_fit_inputs(years.astype(int), values)

    def test_inf_in_estimate_linear_trend_raises(self):
        """estimate_linear_trend must propagate the ValueError for inf input."""
        years = _make_years(TREND_MIN_YEARS)
        values = np.linspace(10.0, 14.0, TREND_MIN_YEARS)
        values[3] = np.inf
        with pytest.raises(ValueError, match="infinite"):
            _trend_call(years, values)


# ---------------------------------------------------------------------------
# D7 — Input shape and ordering validation
# ---------------------------------------------------------------------------

class TestInputValidation:
    """D7: malformed inputs must raise ValueError with a clear message."""

    def test_mismatched_lengths_raises(self):
        years = _make_years(10)
        values = np.linspace(10.0, 14.0, 8)
        with pytest.raises(ValueError, match="same length"):
            _validate_fit_inputs(years.astype(int), values)

    def test_duplicate_years_raises(self):
        years = np.array([2000, 2001, 2001, 2002], dtype=int)
        values = np.array([10.0, 11.0, 12.0, 13.0])
        with pytest.raises(ValueError, match="strictly increasing"):
            _validate_fit_inputs(years, values)

    def test_unsorted_years_raises(self):
        years = np.array([2003, 2001, 2002, 2000], dtype=int)
        values = np.array([10.0, 11.0, 12.0, 13.0])
        with pytest.raises(ValueError, match="strictly increasing"):
            _validate_fit_inputs(years, values)

    def test_too_few_valid_values_raises(self):
        years = _make_years(5)
        values = np.full(5, np.nan)
        values[0] = 10.0   # only 1 finite value
        with pytest.raises(ValueError):
            _validate_fit_inputs(years.astype(int), values)


# ---------------------------------------------------------------------------
# Known-slope recovery (regression test)
# ---------------------------------------------------------------------------

class TestKnownSlope:
    """Verify the estimator recovers a known synthetic slope on a 25-year series."""

    def test_known_synthetic_slope(self, analysis_result_schema):
        years = np.arange(2001, 2026, dtype=int)  # 25 years
        true_slope_per_decade = 0.45
        true_slope_per_year = true_slope_per_decade / 10.0
        x = years - np.mean(years)

        np.random.seed(42)
        noise = np.random.normal(0, 0.05, len(years))
        values = 14.0 + true_slope_per_year * x + noise

        res = _trend_call(years, values)
        assert res["status"] == "supported"

        recovered_slope = res["effect"]["estimate"]
        assert pytest.approx(true_slope_per_decade, abs=0.05) == recovered_slope

        expected_span = 2025 - 2001  # 24 years
        expected_fitted_change = (recovered_slope / 10.0) * expected_span
        assert pytest.approx(expected_fitted_change, rel=1e-6) == res["effect"]["fitted_change"]

        assert res["uncertainty"]["lower"] < recovered_slope < res["uncertainty"]["upper"]
        assert res["uncertainty"]["level"] == pytest.approx(0.95)

        jsonschema.validate(instance=res, schema=analysis_result_schema)

    def test_null_trend_series(self, analysis_result_schema):
        """A flat series should be inconclusive (near-zero slope, high p-value)."""
        years = _make_years(TREND_MIN_YEARS)
        np.random.seed(99)
        values = np.full(TREND_MIN_YEARS, 15.0) + np.random.normal(0, 0.05, TREND_MIN_YEARS)
        res = _trend_call(years, values)
        assert res["status"] in {"supported", "inconclusive"}
        assert abs(res["effect"]["estimate"]) < 0.2
        jsonschema.validate(instance=res, schema=analysis_result_schema)


# ---------------------------------------------------------------------------
# Non-consecutive series (temporal gap)
# ---------------------------------------------------------------------------

class TestNonConsecutiveSeries:
    """Series with temporal gaps must be ineligible and report correct missing years."""

    def test_internal_gap_is_ineligible(self, analysis_result_schema):
        years = np.array(
            [2000, 2001, 2002, 2003, 2005, 2006, 2007, 2008, 2009, 2010,
             2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
            dtype=int,
        )
        values = np.linspace(10.0, 15.0, len(years))
        res = _trend_call(years, values)
        assert res["status"] == "ineligible"
        assert "temporal gaps" in res["caveats"][0]
        assert "2004" in res["coverage"]["missing_periods"]
        jsonschema.validate(instance=res, schema=analysis_result_schema)


# ---------------------------------------------------------------------------
# Theil-Sen outlier robustness diagnostic
# ---------------------------------------------------------------------------

class TestTheilSen:
    """Theil-Sen diagnostic must flag OLS sensitivity to outliers."""

    def test_outlier_divergence(self, analysis_result_schema):
        years = _make_years(25)
        values = np.full(25, 20.0)
        values[12] = 100.0   # massive single-year outlier

        res = _trend_call(years, values)
        theil_diag = res["method"]["diagnostics"]["theil_sen"]
        assert "slope_per_decade" in theil_diag
        assert "direction_agreement_with_ols" in theil_diag
        # Theil-Sen is resistant; OLS is influenced
        assert abs(theil_diag["slope_per_decade"]) < 0.1
        assert theil_diag["absolute_difference_from_ols"] > 0.0
        jsonschema.validate(instance=res, schema=analysis_result_schema)

    def test_near_zero_slope_theil_rel_diff(self):
        """Relative difference must not blow up when OLS slope ≈ 0 (denominator guard)."""
        years = _make_years(25)
        np.random.seed(5)
        values = np.full(25, 15.0) + np.random.normal(0, 0.01, 25)
        result = fit_ols_hac_trend(years, values)
        rel_diff = result["theil_sen"]["relative_difference_from_ols"]
        # Must be finite and non-negative
        assert np.isfinite(rel_diff)
        assert rel_diff >= 0.0


# ---------------------------------------------------------------------------
# Lag sensitivity keys
# ---------------------------------------------------------------------------

class TestLagSensitivities:
    """Lag sensitivity entries must be present and use the capped effective lag."""

    def test_lag_keys_present_for_full_series(self, analysis_result_schema):
        years = _make_years(24, start=2001)
        values = np.linspace(12.0, 14.0, 24)
        res = _trend_call(years, values)
        sens = res["method"]["diagnostics"]["lag_sensitivities"]
        assert "lag_1" in sens
        assert "lag_3" in sens
        assert "lag_5" in sens
        # For n=24, all requested lags fit: effective = min(lag, n-2) = min(lag, 22)
        assert sens["lag_1"]["maxlags"] == 1
        assert sens["lag_3"]["maxlags"] == 3
        assert sens["lag_5"]["maxlags"] == 5
        jsonschema.validate(instance=res, schema=analysis_result_schema)
