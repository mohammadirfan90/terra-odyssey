"""Unit tests for the Hamed & Rao (1998) Modified Mann-Kendall estimator."""

import numpy as np
import pytest

from src.analysis.modified_mann_kendall import (
    compute_sens_slope,
    modified_mann_kendall_test,
)


def test_positive_linear_trend_detected():
    """Verify strong positive trend yields positive S, high Z, and p < 0.01."""
    rng = np.random.default_rng(42)
    n = 30
    x = np.linspace(0, 10, n) + rng.normal(0, 0.5, n)
    res = modified_mann_kendall_test(x)

    assert res.statistic_s > 0
    assert res.standardized_z > 2.5
    assert res.p_value < 0.01
    assert res.trend_direction == "increasing"
    assert res.sens_slope > 0.2
    assert res.sample_size == n


def test_negative_linear_trend_detected():
    """Verify strong negative trend yields negative S, negative Z, and p < 0.01."""
    rng = np.random.default_rng(101)
    n = 30
    x = np.linspace(10, 0, n) + rng.normal(0, 0.5, n)
    res = modified_mann_kendall_test(x)

    assert res.statistic_s < 0
    assert res.standardized_z < -2.5
    assert res.p_value < 0.01
    assert res.trend_direction == "decreasing"
    assert res.sens_slope < -0.2


def test_stationary_noise_no_trend():
    """Verify stationary white noise yields no statistically significant trend."""
    rng = np.random.default_rng(999)
    n = 50
    x = rng.normal(0, 1, n)
    res = modified_mann_kendall_test(x)

    assert res.p_value > 0.05
    assert res.trend_direction == "no_trend"


def test_autocorrelated_series_variance_expansion():
    """Verify positive AR(1) autocorrelation triggers eta >= 1.0 and variance expansion."""
    rng = np.random.default_rng(555)
    n = 60
    # Generate AR(1) process with phi = 0.6
    x = np.zeros(n)
    for i in range(1, n):
        x[i] = 0.6 * x[i - 1] + rng.normal(0, 1)

    res = modified_mann_kendall_test(x, autocorr_significance_level=0.15)
    assert res.correction_factor_eta >= 1.0
    assert res.variance_s_adjusted >= res.variance_s


def test_tied_observations_handled():
    """Verify series with numerous ties computes without numerical breakdown."""
    x = np.array([1.0, 2.0, 2.0, 2.0, 3.0, 3.0, 4.0, 5.0, 5.0, 6.0])
    res = modified_mann_kendall_test(x)

    assert res.sample_size == 10
    assert res.trend_direction == "increasing"
    assert np.isfinite(res.variance_s)
    assert np.isfinite(res.p_value)


def test_constant_series_zero_slope():
    """Verify constant series yields S=0, slope=0, and p=1.0."""
    x = np.ones(20) * 5.0
    res = modified_mann_kendall_test(x)

    assert res.statistic_s == 0.0
    assert res.standardized_z == 0.0
    assert res.p_value == 1.0
    assert res.sens_slope == 0.0
    assert res.trend_direction == "no_trend"


def test_sens_slope_accuracy():
    """Verify Sen's slope recovers known mathematical slope."""
    t = np.arange(2000, 2025, dtype=float)
    true_slope = 0.035  # e.g. +0.035 degC/year
    y = 14.0 + true_slope * (t - 2000)
    slope, intercept = compute_sens_slope(y, t)

    assert pytest.approx(slope, rel=1e-6) == true_slope


def test_invalid_sample_size_raises():
    """Verify fewer than 4 points raises ValueError."""
    with pytest.raises(ValueError, match="too small"):
        modified_mann_kendall_test([1.0, 2.0, 3.0])


def test_nan_values_raise():
    """Verify input with NaNs raises ValueError."""
    with pytest.raises(ValueError, match="contains NaN"):
        modified_mann_kendall_test([1.0, 2.0, np.nan, 4.0, 5.0])
