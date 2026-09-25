"""Moving Block Bootstrap trend uncertainty estimator for autocorrelated series.

Implements the Moving Block Bootstrap (Künsch 1989; Liu & Singh 1992) to compute
empirical, non-parametric confidence intervals and standard errors for linear trend
slopes under serial dependence, fulfilling SPEC.md Goal 1.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union
import numpy as np


@dataclass(frozen=True)
class BlockBootstrapResult:
    """Result container for block bootstrap trend slope uncertainty."""
    original_slope: float
    original_slope_per_decade: float
    bootstrap_mean_slope: float
    bootstrap_se: float
    bootstrap_se_per_decade: float
    ci_lower: float
    ci_upper: float
    ci_lower_per_decade: float
    ci_upper_per_decade: float
    block_length: int
    n_bootstraps: int
    confidence_level: float
    bias: float


def compute_moving_blocks(
    residuals: np.ndarray,
    block_length: int,
    target_length: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """Resample overlapping blocks of residuals with replacement."""
    n = len(residuals)
    num_blocks_needed = int(np.ceil(target_length / block_length))
    # Number of possible starting positions for overlapping blocks
    max_start = n - block_length + 1
    if max_start <= 0:
        # Fallback if block_length exceeds n
        return rng.choice(residuals, size=target_length, replace=True)

    start_indices = rng.integers(0, max_start, size=num_blocks_needed)
    resampled_blocks = [residuals[idx : idx + block_length] for idx in start_indices]
    concatenated = np.concatenate(resampled_blocks)
    return concatenated[:target_length]


def moving_block_bootstrap_trend(
    y: Union[List[float], np.ndarray],
    time_coords: Optional[Union[List[float], np.ndarray]] = None,
    block_length: Optional[int] = None,
    n_bootstraps: int = 1000,
    confidence_level: float = 0.95,
    random_state: Optional[int] = 42,
) -> BlockBootstrapResult:
    """Compute empirical confidence intervals for linear trend slope using moving block bootstrap.

    Args:
        y: 1D array of observed values.
        time_coords: Optional 1D array of temporal coordinates (e.g. calendar years).
        block_length: Optimal block length b. Defaults to max(2, int(np.ceil(n ** (1/3)))).
        n_bootstraps: Number of bootstrap iterations B (default 1000).
        confidence_level: Desired coverage probability (default 0.95 for 95% CI).
        random_state: Seed for NumPy random number generator.

    Returns:
        BlockBootstrapResult containing empirical CI, bootstrap SE, bias, and parameters.

    Raises:
        ValueError: If n < 5 or NaN values exist.
    """
    obs = np.asarray(y, dtype=np.float64)
    if np.any(np.isnan(obs)):
        raise ValueError("Input series contains NaN values.")

    n = len(obs)
    if n < 5:
        raise ValueError(f"Sample size n={n} is too small for block bootstrapping (minimum 5 required).")

    if time_coords is None:
        x = np.arange(n, dtype=np.float64)
    else:
        x = np.asarray(time_coords, dtype=np.float64)

    # 1. Fit initial OLS
    x_mean = np.mean(x)
    x_centered = x - x_mean
    denom = np.sum(x_centered ** 2)
    if denom == 0:
        raise ValueError("Time coordinates have zero variance.")

    original_slope = float(np.sum(x_centered * (obs - np.mean(obs))) / denom)
    intercept = float(np.mean(obs) - original_slope * x_mean)
    fitted = intercept + original_slope * x
    residuals = obs - fitted

    # 2. Determine block length b
    if block_length is None:
        block_length = max(2, int(np.ceil(n ** (1.0 / 3.0))))
    block_length = min(max(2, block_length), n - 1)

    # 3. Resample residuals in blocks and re-estimate slope
    rng = np.random.default_rng(random_state)
    boot_slopes = np.empty(n_bootstraps, dtype=np.float64)

    for b_idx in range(n_bootstraps):
        resampled_residuals = compute_moving_blocks(residuals, block_length, n, rng)
        # Center resampled residuals to prevent artificial mean drift
        resampled_residuals -= np.mean(resampled_residuals)
        y_boot = fitted + resampled_residuals
        # Re-estimate slope
        boot_slope = np.sum(x_centered * (y_boot - np.mean(y_boot))) / denom
        boot_slopes[b_idx] = boot_slope

    # 4. Compute empirical percentiles for confidence interval
    alpha = 1.0 - confidence_level
    q_lower = alpha / 2.0 * 100.0
    q_upper = (1.0 - alpha / 2.0) * 100.0
    ci_lower = float(np.percentile(boot_slopes, q_lower))
    ci_upper = float(np.percentile(boot_slopes, q_upper))

    boot_mean = float(np.mean(boot_slopes))
    boot_se = float(np.std(boot_slopes, ddof=1))
    bias = float(boot_mean - original_slope)

    return BlockBootstrapResult(
        original_slope=original_slope,
        original_slope_per_decade=original_slope * 10.0,
        bootstrap_mean_slope=boot_mean,
        bootstrap_se=boot_se,
        bootstrap_se_per_decade=boot_se * 10.0,
        ci_lower=ci_lower,
        ci_upper=ci_upper,
        ci_lower_per_decade=ci_lower * 10.0,
        ci_upper_per_decade=ci_upper * 10.0,
        block_length=block_length,
        n_bootstraps=n_bootstraps,
        confidence_level=confidence_level,
        bias=bias,
    )
