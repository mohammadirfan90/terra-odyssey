"""Modified Mann-Kendall trend test with autocorrelation correction (Hamed & Rao 1998).

Implements the modified Mann-Kendall non-parametric trend test that accounts for
serial correlation in time series without pre-whitening, preventing false positive
inflation common in standard Mann-Kendall tests on Earth science observations.

Reference:
    Hamed, K. H., & Rao, A. R. (1998). A modified Mann-Kendall trend test for
    autocorrelated data. Journal of Hydrology, 204(1-4), 182-196.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
from scipy import stats


@dataclass(frozen=True)
class MannKendallResult:
    """Result container for modified Mann-Kendall trend estimation."""
    statistic_s: float
    variance_s: float
    variance_s_adjusted: float
    correction_factor_eta: float
    standardized_z: float
    p_value: float
    sens_slope: float
    sens_slope_per_decade: float
    intercept: float
    significant_lags: List[int]
    trend_direction: str  # "increasing", "decreasing", "no_trend"
    sample_size: int


def _compute_ties(ranks: np.ndarray) -> float:
    """Compute tie correction term for variance of S."""
    _, counts = np.unique(ranks, return_counts=True)
    tie_term = np.sum(counts * (counts - 1) * (2 * counts + 5))
    return float(tie_term)


def compute_sens_slope(
    time_series: np.ndarray,
    time_coords: Optional[np.ndarray] = None,
) -> Tuple[float, float]:
    """Compute Sen's non-parametric slope and intercept.

    Args:
        time_series: 1D numerical array of observations.
        time_coords: Optional 1D array of time coordinates (e.g. calendar years).
                     Defaults to indices 0, 1, ..., n-1.

    Returns:
        Tuple of (slope, intercept).
    """
    y = np.asarray(time_series, dtype=np.float64)
    n = len(y)
    if time_coords is None:
        x = np.arange(n, dtype=np.float64)
    else:
        x = np.asarray(time_coords, dtype=np.float64)

    slopes = []
    for i in range(n - 1):
        dx = x[i + 1:] - x[i]
        dy = y[i + 1:] - y[i]
        valid = dx != 0
        if np.any(valid):
            slopes.extend((dy[valid] / dx[valid]).tolist())

    if not slopes:
        return 0.0, float(np.mean(y)) if n > 0 else 0.0

    slope = float(np.median(slopes))
    intercept = float(np.median(y - slope * x))
    return slope, intercept


def modified_mann_kendall_test(
    data: Union[List[float], np.ndarray],
    time_coords: Optional[Union[List[float], np.ndarray]] = None,
    alpha: float = 0.05,
    autocorr_significance_level: float = 0.10,
    max_lag: Optional[int] = None,
) -> MannKendallResult:
    """Execute the Hamed & Rao (1998) Modified Mann-Kendall test.

    Args:
        data: 1D numerical series of observations.
        time_coords: Optional temporal coordinates (e.g. calendar years).
        alpha: Two-sided significance level for trend test (default 0.05).
        autocorr_significance_level: Significance threshold for rank autocorrelation (default 0.10).
        max_lag: Maximum lag to evaluate autocorrelation. Defaults to min(n // 2, 10).

    Returns:
        MannKendallResult containing S, adjusted variance, Z, p-value, Sen's slope, and metadata.

    Raises:
        ValueError: If fewer than 4 valid observations are provided.
    """
    x = np.asarray(data, dtype=np.float64)
    if np.any(np.isnan(x)):
        raise ValueError("Input data contains NaN values; clean or mask missing data before testing.")

    n = len(x)
    if n < 4:
        raise ValueError(f"Sample size n={n} is too small for Mann-Kendall test (minimum 4 required).")

    # 1. Compute Mann-Kendall S statistic
    # S = sum_{i < j} sgn(x_j - x_i)
    diff = x[np.newaxis, :] - x[:, np.newaxis]
    sgn = np.sign(diff)
    # Extract strictly upper triangle (j > i)
    s_stat = float(np.sum(np.triu(sgn, k=1)))

    # 2. Compute theoretical variance under independence V0(S) with tie adjustment
    ranks = stats.rankdata(x)
    tie_term = _compute_ties(ranks)
    v0_s = (n * (n - 1) * (2 * n + 5) - tie_term) / 18.0

    # 3. Compute Sen's slope
    slope, intercept = compute_sens_slope(x, time_coords)
    slope_per_decade = slope * 10.0

    # 4. Detrend series using Sen's slope to isolate residuals for autocorrelation
    # (Hamed & Rao recommend detrending before calculating rank autocorrelation)
    t = np.arange(n, dtype=np.float64) if time_coords is None else np.asarray(time_coords, dtype=np.float64)
    detrended = x - slope * t
    detrended_ranks = stats.rankdata(detrended)
    r_mean = np.mean(detrended_ranks)
    r_denom = np.sum((detrended_ranks - r_mean) ** 2)

    if max_lag is None:
        max_lag = min(n // 2, 10)
    max_lag = max(1, min(max_lag, n - 2))

    significant_lags: List[int] = []
    eta_sum = 0.0

    # Critical value for autocorrelation test at autocorr_significance_level (two-tailed)
    z_autocorr_crit = stats.norm.ppf(1.0 - autocorr_significance_level / 2.0)

    if r_denom > 0:
        for k in range(1, max_lag + 1):
            # Rank autocorrelation r_k
            r_k_num = np.sum((detrended_ranks[:-k] - r_mean) * (detrended_ranks[k:] - r_mean)) / (n - k)
            r_k = float((n * r_k_num) / r_denom)

            # Variance of r_k under null hypothesis of no autocorrelation is approximately 1/n
            var_rk = 1.0 / n
            z_rk = abs(r_k) / np.sqrt(var_rk)

            if z_rk > z_autocorr_crit:
                significant_lags.append(k)
                # Hamed & Rao weight term: (n - k) * (n - k - 1) * (n - k - 2) * r_k
                weight = (n - k) * (n - k - 1) * (n - k - 2)
                eta_sum += weight * r_k

    # Compute variance correction factor eta
    if significant_lags and n > 2:
        eta = 1.0 + (2.0 / (n * (n - 1) * (n - 2))) * eta_sum
    else:
        eta = 1.0

    # Ensure eta does not inappropriately shrink variance below 1.0 (conservative bound)
    eta = max(1.0, float(eta))
    v_adj_s = v0_s * eta

    # 5. Standardized test statistic Z
    if s_stat > 0:
        z = (s_stat - 1.0) / np.sqrt(v_adj_s)
    elif s_stat < 0:
        z = (s_stat + 1.0) / np.sqrt(v_adj_s)
    else:
        z = 0.0

    # Two-sided p-value from standard normal
    p_val = float(2.0 * (1.0 - stats.norm.cdf(abs(z))))

    # Direction adjudication
    if p_val < alpha:
        direction = "increasing" if s_stat > 0 else "decreasing"
    else:
        direction = "no_trend"

    return MannKendallResult(
        statistic_s=float(s_stat),
        variance_s=float(v0_s),
        variance_s_adjusted=float(v_adj_s),
        correction_factor_eta=float(eta),
        standardized_z=float(z),
        p_value=float(p_val),
        sens_slope=float(slope),
        sens_slope_per_decade=float(slope_per_decade),
        intercept=float(intercept),
        significant_lags=significant_lags,
        trend_direction=direction,
        sample_size=n,
    )
