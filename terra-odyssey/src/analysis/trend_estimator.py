"""Core statistical trend estimator with Newey-West HAC covariance and Theil-Sen robustness.

Implements rigorous trend detection for climate time series:
1. Centered year coordinate: x = year - mean(year) for float64 numerical stability.
2. statsmodels OLS with explicit Newey-West HAC robust covariance:
   - Kernel: Bartlett
   - Autoregressive lag: maxlags=2 (explicit, no automatic bandwidth)
   - Small-sample correction: n / (n - k)
   - Reference distribution: Two-sided Student-t with df = n - 2
3. Lag sensitivities for L in {1, 3, 5}.
4. SciPy Theil-Sen estimator as an outlier-resistant point-estimate sensitivity diagnostic.
5. Strict schema serialization conforming to schemas/analysis-result.schema.json.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Optional
import numpy as np
import scipy.stats as stats
import statsmodels.api as sm

from .aggregation import validate_consecutive_series


def estimate_linear_trend(
    years: np.ndarray,
    values: np.ndarray,
    dataset_id: str,
    variable: str,
    units: str,
    unit_per_decade: str,
    geometry: Optional[Dict[str, Any]] = None,
    confidence_level: float = 0.95,
    selection_status: str = "predefined",
    source_release: str = "v1.0",
    manifest_hash: str = "0000000000000000",
) -> Dict[str, Any]:
    """Estimate linear trend with Newey-West HAC standard error diagnostics.

    Parameters
    ----------
    years : np.ndarray
        Array of integer years.
    values : np.ndarray
        Array of corresponding annual values (floats).
    dataset_id : str
        Dataset identifier (e.g. 'd1_merra2', 'd2_gpm_imerg').
    variable : str
        Variable name (e.g. 'T2M', 'precipitationCal').
    units : str
        Physical units of annual value (e.g. 'degC', 'mm/year').
    unit_per_decade : str
        Physical units per decade (e.g. 'degC/decade', 'mm/year/decade').
    geometry : Optional[dict]
        Spatial geometry representation (GeoJSON-like or bounding box).
    confidence_level : float
        Confidence level for uncertainty interval (default: 0.95).
    selection_status : str
        One of 'predefined', 'exploratory_map_selected', 'not_applicable'.
    source_release : str
        Dataset release version tag.
    manifest_hash : str
        SHA-256 or digest of the dataset manifest.

    Returns
    -------
    dict
        Dictionary validating against schemas/analysis-result.schema.json.
    """
    if geometry is None:
        geometry = {"type": "Global", "coordinates": []}

    years = np.asarray(years, dtype=int)
    values = np.asarray(values, dtype=np.float64)

    # 1. Validate consecutive series completeness (minimum 20 consecutive complete years)
    validity = validate_consecutive_series(years, values, min_years=20)
    start_year = int(years[0]) if len(years) > 0 else 0
    end_year = int(years[-1]) if len(years) > 0 else 0
    span_years = end_year - start_year

    period = {
        "start": f"{start_year:04d}-01-01",
        "end": f"{end_year:04d}-12-31",
    }

    config_str = f"{dataset_id}:{variable}:{start_year}:{end_year}:{confidence_level}"
    configuration_hash = hashlib.sha256(config_str.encode("utf-8")).hexdigest()[:16]
    analysis_id = f"trend_{dataset_id}_{variable}_{start_year}_{end_year}"

    if not validity["is_eligible"]:
        # Record is ineligible for trend inference
        caveat_msg = f"Record ineligible for trend inference: {validity['reason']}"
        return {
            "analysis_id": analysis_id,
            "status": "ineligible",
            "estimand": {
                "dataset_id": dataset_id,
                "variable": variable,
                "units": units,
                "period": period,
                "geometry": geometry,
                "temporal_aggregation": "annual",
                "spatial_aggregation": "regional_mean",
            },
            "effect": {
                "estimate": 0.0,
                "unit_per_decade": unit_per_decade,
                "fitted_change": 0.0,
            },
            "uncertainty": {
                "lower": 0.0,
                "upper": 0.0,
                "level": confidence_level,
                "method": "ineligible_record",
            },
            "coverage": {
                "valid_periods": validity["valid_count"],
                "expected_periods": validity["expected_count"],
                "valid_fraction": (
                    float(validity["valid_count"] / validity["expected_count"])
                    if validity["expected_count"] > 0
                    else 0.0
                ),
                "missing_periods": [str(y) for y in validity["missing_years"]],
            },
            "method": {
                "estimator": "ols_linear_trend",
                "dependence_treatment": "newey_west_hac_bartlett_lag2_small_sample",
                "test_family": "single_predefined_test",
                "selection_status": selection_status,
                "p_value": None,
                "diagnostics": {
                    "ineligibility_reason": validity["reason"],
                },
            },
            "provenance": {
                "manifest_hash": manifest_hash,
                "source_release": source_release,
                "configuration_hash": configuration_hash,
            },
            "caveats": [caveat_msg],
            "interpretation": {
                "level": "observed_trend",
                "text": "Data does not meet minimum sample size or continuity criteria for trend estimation.",
            },
        }

    # 2. Centered year coordinates for numerical float64 stability
    valid_mask = ~np.isnan(values)
    y = values[valid_mask]
    t = years[valid_mask]
    n = len(t)
    x = t - np.mean(t)

    # 3. Fit statsmodels OLS with Newey-West HAC covariance
    X = sm.add_constant(x)
    model = sm.OLS(y, X).fit()

    robust = model.get_robustcov_results(
        cov_type="HAC",
        maxlags=2,
        kernel="bartlett",
        use_correction=True,
        use_t=True,
    )

    slope_per_year = float(robust.params[1])
    slope_se_per_year = float(robust.bse[1])
    t_stat = float(robust.tvalues[1])
    p_value = float(robust.pvalues[1])
    df = int(robust.df_resid)  # n - 2

    # Annual CI to decadal CI
    alpha = 1.0 - confidence_level
    ci = robust.conf_int(alpha=alpha)[1]
    ci_lower_annual = float(ci[0])
    ci_upper_annual = float(ci[1])

    # Convert to physical units per decade
    slope_per_decade = slope_per_year * 10.0
    ci_lower_decade = ci_lower_annual * 10.0
    ci_upper_decade = ci_upper_annual * 10.0

    # Fitted total change over the interval (span = last_year - first_year)
    fitted_change = slope_per_year * span_years

    # 4. Lag sensitivities at L in {1, 3, 5}
    lag_sensitivities = {}
    for lag in [1, 3, 5]:
        rob_lag = model.get_robustcov_results(
            cov_type="HAC",
            maxlags=lag,
            kernel="bartlett",
            use_correction=True,
            use_t=True,
        )
        ci_lag = rob_lag.conf_int(alpha=alpha)[1]
        lag_sensitivities[f"lag_{lag}"] = {
            "maxlags": lag,
            "slope_se_per_decade": float(rob_lag.bse[1]) * 10.0,
            "p_value": float(rob_lag.pvalues[1]),
            "ci_lower_decade": float(ci_lag[0]) * 10.0,
            "ci_upper_decade": float(ci_lag[1]) * 10.0,
        }

    # 5. SciPy Theil-Sen slope as robustness point-estimate diagnostic
    theil_res = stats.theilslopes(y, x, alpha=confidence_level)
    theil_slope_per_year = float(theil_res.slope)
    theil_slope_per_decade = theil_slope_per_year * 10.0

    theil_direction_agreement = bool(
        (np.sign(slope_per_year) == np.sign(theil_slope_per_year))
        or (abs(slope_per_year) < 1e-9 and abs(theil_slope_per_year) < 1e-9)
    )
    theil_abs_diff = float(abs(slope_per_decade - theil_slope_per_decade))
    theil_rel_diff = (
        float(theil_abs_diff / abs(slope_per_decade) * 100.0)
        if abs(slope_per_decade) > 1e-9
        else 0.0
    )

    theil_sen_diag = {
        "slope_per_decade": theil_slope_per_decade,
        "direction_agreement_with_ols": theil_direction_agreement,
        "absolute_difference_from_ols": theil_abs_diff,
        "relative_difference_from_ols": theil_rel_diff,
    }

    # 6. Status determination (supported vs inconclusive)
    is_statistically_supported = bool(p_value < alpha)
    status = "supported" if is_statistically_supported else "inconclusive"

    if status == "supported":
        interp_text = (
            f"Statistically supported linear trend of {slope_per_decade:+.3f} {unit_per_decade} "
            f"(95% CI [{ci_lower_decade:+.3f}, {ci_upper_decade:+.3f}], p={p_value:.4e}) "
            f"over {start_year}–{end_year} ({span_years}-year span)."
        )
    else:
        interp_text = (
            f"Trend of {slope_per_decade:+.3f} {unit_per_decade} is not statistically detected "
            f"(95% CI [{ci_lower_decade:+.3f}, {ci_upper_decade:+.3f}], p={p_value:.4e}). "
            f"Note: Lack of statistical detection does not prove zero physical change."
        )

    caveats = [
        "OLS trend with Newey-West HAC covariance accounts for serial autocorrelation (lag=2).",
        "Theil-Sen slope provides outlier-resistant point diagnostic.",
        "Correlation or co-trending does not imply causal attribution.",
    ]

    return {
        "analysis_id": analysis_id,
        "status": status,
        "estimand": {
            "dataset_id": dataset_id,
            "variable": variable,
            "units": units,
            "period": period,
            "geometry": geometry,
            "temporal_aggregation": "annual",
            "spatial_aggregation": "regional_mean",
        },
        "effect": {
            "estimate": float(slope_per_decade),
            "unit_per_decade": unit_per_decade,
            "fitted_change": float(fitted_change),
        },
        "uncertainty": {
            "lower": float(ci_lower_decade),
            "upper": float(ci_upper_decade),
            "level": float(confidence_level),
            "method": "newey_west_hac_bartlett_lag2_small_sample",
        },
        "coverage": {
            "valid_periods": int(n),
            "expected_periods": int(span_years + 1),
            "valid_fraction": 1.0,
            "missing_periods": [],
        },
        "method": {
            "estimator": "ols_linear_trend",
            "dependence_treatment": "newey_west_hac_bartlett_lag2_small_sample",
            "test_family": "single_predefined_test",
            "selection_status": selection_status,
            "p_value": float(p_value),
            "diagnostics": {
                "kernel": "bartlett",
                "maxlags": 2,
                "degrees_of_freedom": df,
                "t_statistic": float(t_stat),
                "slope_se_per_decade": float(slope_se_per_year * 10.0),
                "lag_sensitivities": lag_sensitivities,
                "theil_sen": theil_sen_diag,
            },
        },
        "provenance": {
            "manifest_hash": manifest_hash,
            "source_release": source_release,
            "configuration_hash": configuration_hash,
        },
        "caveats": caveats,
        "interpretation": {
            "level": "observed_trend",
            "text": interp_text,
        },
    }
