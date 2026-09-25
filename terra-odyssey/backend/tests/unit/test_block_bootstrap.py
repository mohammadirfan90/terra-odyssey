"""Unit tests for the moving block bootstrap trend uncertainty estimator."""

import numpy as np
import pytest

from analysis.block_bootstrap import moving_block_bootstrap_trend


def test_linear_trend_contained_in_ci():
    """Verify known true slope is bracketed by 95% empirical bootstrap CI."""
    rng = np.random.default_rng(42)
    n = 30
    true_slope = 0.05
    t = np.arange(n, dtype=float)
    y = 10.0 + true_slope * t + rng.normal(0, 0.4, n)

    res = moving_block_bootstrap_trend(y, t, n_bootstraps=500, random_state=42)

    assert res.ci_lower < true_slope < res.ci_upper
    assert res.ci_lower < res.original_slope < res.ci_upper
    assert res.bootstrap_se > 0.0
    assert res.n_bootstraps == 500
    assert res.confidence_level == 0.95


def test_zero_trend_ci_spans_zero():
    """Verify stationary white noise CI contains zero slope."""
    rng = np.random.default_rng(123)
    n = 35
    t = np.arange(n, dtype=float)
    y = rng.normal(0, 1.0, n)

    res = moving_block_bootstrap_trend(y, t, n_bootstraps=500, random_state=123)

    assert res.ci_lower <= 0.0 <= res.ci_upper


def test_block_length_selection():
    """Verify default block length matches ceil(n^(1/3))."""
    n = 27
    y = np.linspace(1, 5, n)
    res = moving_block_bootstrap_trend(y, n_bootstraps=100, random_state=1)
    # 27^(1/3) = 3
    assert res.block_length == 3

    # Custom block length
    res_custom = moving_block_bootstrap_trend(y, block_length=5, n_bootstraps=100, random_state=1)
    assert res_custom.block_length == 5


def test_bootstrap_determinism_with_seed():
    """Verify same random_state produces identical bootstrap estimates."""
    y = np.array([1.2, 1.5, 1.9, 2.1, 2.4, 2.8, 3.1, 3.5, 3.9, 4.2])
    res1 = moving_block_bootstrap_trend(y, n_bootstraps=200, random_state=99)
    res2 = moving_block_bootstrap_trend(y, n_bootstraps=200, random_state=99)

    assert res1.bootstrap_mean_slope == res2.bootstrap_mean_slope
    assert res1.ci_lower == res2.ci_lower
    assert res1.ci_upper == res2.ci_upper
    assert res1.bootstrap_se == res2.bootstrap_se


def test_low_bias():
    """Verify estimation bias is negligible relative to standard error."""
    rng = np.random.default_rng(777)
    n = 40
    y = np.linspace(2, 6, n) + rng.normal(0, 0.2, n)
    res = moving_block_bootstrap_trend(y, n_bootstraps=500, random_state=777)

    assert abs(res.bias) < 0.2 * res.bootstrap_se


def test_invalid_sample_size_raises():
    """Verify series with fewer than 5 observations raises ValueError."""
    with pytest.raises(ValueError, match="too small"):
        moving_block_bootstrap_trend([1.0, 2.0, 3.0, 4.0])


def test_nan_values_raise():
    """Verify NaN values raise ValueError."""
    with pytest.raises(ValueError, match="contains NaN"):
        moving_block_bootstrap_trend([1.0, 2.0, np.nan, 4.0, 5.0, 6.0])
