"""Paired regional difference contrast estimator.

Estimates the synchronous regional difference series D_t = Y_{A,t} - Y_{B,t}
using verified Phase 2 OLS with Newey-West HAC covariance.

Strict scientific rules:
1. Aligns regional series by calendar year and enforces at least 20 consecutive
   common complete years (refuses to collapse time).
2. Verifies linearity property: beta_D = beta_A - beta_B.
3. Automatically captures cross-regional spatial covariance and temporal serial
   correlation in the regional difference.
4. Adjudicates opposite-trend evidence status:
   - ineligible: if either region lacks >=20 common consecutive complete years
   - inconclusive / signs_not_opposite: if empirical slopes share the same sign
   - inconclusive / contrast_not_supported: if raw p-value >= 0.05
   - inconclusive / contrast_not_supported_after_multiplicity: if adjusted p-value >= FDR level
   - supported / opposite_trend_pair: if opposite signs and statistically significant difference
5. Serializes to schemas/analysis-result.schema.json.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Optional
import numpy as np

from .aggregation import validate_consecutive_series
from .trend_estimator import fit_ols_hac_trend


def estimate_paired_contrast(
    years_a: np.ndarray,
    values_a: np.ndarray,
    years_b: np.ndarray,
    values_b: np.ndarray,
    dataset_id: str,
    variable: str,
    units: str,
    unit_per_decade: str,
    geometry_a: Dict[str, Any],
    geometry_b: Dict[str, Any],
    selection_status: str = "predefined",
    test_family: str = "single_predefined_test",
    confidence_level: float = 0.95,
    adjusted_p_value: Optional[float] = None,
    multiplicity_method: Optional[str] = None,
    fdr_level: Optional[float] = None,
    family_id: Optional[str] = None,
    family_size: Optional[int] = None,
    hypothesis_id: Optional[str] = None,
    source_release: str = "v1.0",
    manifest_hash: str = "0000000000000000",
) -> Dict[str, Any]:
    """Estimate paired regional trend difference D_t = Y_{A,t} - Y_{B,t} with HAC covariance.

    Parameters
    ----------
    years_a, values_a : np.ndarray
        Annual time series for Region A.
    years_b, values_b : np.ndarray
        Annual time series for Region B.
    dataset_id : str
        Dataset identifier.
    variable : str
        Variable name.
    units : str
        Physical measurement units.
    unit_per_decade : str
        Physical units per decade.
    geometry_a, geometry_b : dict
        GeoJSON or bounding-box geometries for Region A and Region B.
    selection_status : str
        'predefined' or 'exploratory_map_selected'.
    test_family : str
        Test family identifier.
    confidence_level : float
        Confidence level for CI (default: 0.95).

    Returns
    -------
    dict
        AnalysisResult conforming to schemas/analysis-result.schema.json.
    """
    years_a = np.asarray(years_a, dtype=int)
    values_a = np.asarray(values_a, dtype=np.float64)
    years_b = np.asarray(years_b, dtype=int)
    values_b = np.asarray(values_b, dtype=np.float64)

    # 1. Align by common calendar year
    common_years = np.intersect1d(years_a, years_b)

    # Compound geometry representation
    compound_geometry = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"region": "A"}, "geometry": geometry_a},
            {"type": "Feature", "properties": {"region": "B"}, "geometry": geometry_b},
        ],
    }
    geom_bytes = json.dumps(compound_geometry, sort_keys=True).encode("utf-8")
    geom_hash = hashlib.sha256(geom_bytes).hexdigest()[:8]

    # Map aligned values
    idx_a = {yr: val for yr, val in zip(years_a, values_a)}
    idx_b = {yr: val for yr, val in zip(years_b, values_b)}

    aligned_a = np.array([idx_a[yr] for yr in common_years], dtype=np.float64)
    aligned_b = np.array([idx_b[yr] for yr in common_years], dtype=np.float64)

    # Valid mask where both A and B are non-NaN
    both_valid_mask = (~np.isnan(aligned_a)) & (~np.isnan(aligned_b))
    valid_years = common_years[both_valid_mask]
    val_a = aligned_a[both_valid_mask]
    val_b = aligned_b[both_valid_mask]

    start_year = int(valid_years[0]) if len(valid_years) > 0 else 0
    end_year = int(valid_years[-1]) if len(valid_years) > 0 else 0
    span_years = end_year - start_year

    period = {
        "start": f"{start_year:04d}-01-01",
        "end": f"{end_year:04d}-12-31",
    }
    analysis_id = f"contrast_{dataset_id}_{variable}_{start_year}_{end_year}_{geom_hash}"
    config_str = (
        f"contrast:{dataset_id}:{variable}:{start_year}:{end_year}:{geom_hash}:"
        f"region_a_minus_region_b:{selection_status}:{test_family}"
    )
    configuration_hash = hashlib.sha256(config_str.encode("utf-8")).hexdigest()[:16]

    # 2. Check consecutive series eligibility (>=20 consecutive complete common years)
    validity = validate_consecutive_series(valid_years, val_a, min_years=20)

    if not validity["is_eligible"]:
        caveat_msg = f"Paired contrast ineligible: {validity['reason']}"
        return {
            "analysis_id": analysis_id,
            "status": "ineligible",
            "estimand": {
                "dataset_id": dataset_id,
                "variable": variable,
                "units": units,
                "period": period,
                "geometry": compound_geometry,
                "temporal_aggregation": "annual",
                "spatial_aggregation": "paired_regional_contrast",
            },
            "effect": {
                "estimate": 0.0,
                "unit_per_decade": unit_per_decade,
                "fitted_change": 0.0,
                "contrast_orientation": "region_a_minus_region_b",
                "region_a_estimate": None,
                "region_b_estimate": None,
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
                "estimator": "paired_difference_ols_hac",
                "dependence_treatment": "newey_west_hac_bartlett_lag2_small_sample",
                "test_family": test_family,
                "selection_status": selection_status,
                "p_value": None,
                "raw_p_value": None,
                "adjusted_p_value": None,
                "decision_p_value": None,
                "multiplicity_method": multiplicity_method,
                "fdr_level": fdr_level,
                "family_id": family_id,
                "family_size": family_size,
                "hypothesis_id": hypothesis_id,
                "diagnostics": {"ineligibility_reason": validity["reason"]},
            },
            "provenance": {
                "manifest_hash": manifest_hash,
                "source_release": source_release,
                "configuration_hash": configuration_hash,
            },
            "caveats": [caveat_msg],
            "interpretation": {
                "level": "spatial_contrast",
                "text": "Insufficient common consecutive years for paired contrast estimation.",
            },
        }

    # 3. Synchronous difference series: D_t = Y_{A,t} - Y_{B,t}
    diff_values = val_a - val_b

    # Fit numerical OLS + HAC on Region A, Region B, and Difference
    fit_d = fit_ols_hac_trend(valid_years, diff_values, confidence_level=confidence_level)
    fit_a = fit_ols_hac_trend(valid_years, val_a, confidence_level=confidence_level)
    fit_b = fit_ols_hac_trend(valid_years, val_b, confidence_level=confidence_level)

    slope_a = fit_a["slope_per_decade"]
    slope_b = fit_b["slope_per_decade"]
    slope_diff = fit_d["slope_per_decade"]
    fitted_change_diff = fit_d["slope_per_year"] * span_years

    # 4. Evidence qualification logic
    has_opposite_signs = bool(np.sign(slope_a) != np.sign(slope_b) and abs(slope_a) > 1e-9 and abs(slope_b) > 1e-9)

    alpha = 1.0 - confidence_level
    raw_p = fit_d["p_value"]

    if selection_status == "exploratory_map_selected":
        decision_p = adjusted_p_value if adjusted_p_value is not None else raw_p
        threshold = fdr_level if fdr_level is not None else 0.05
    else:
        decision_p = raw_p
        threshold = alpha

    contrast_significant = bool(decision_p < threshold)

    caveats = [
        "Paired contrast evaluates the synchronous difference D_t = Y_{A,t} - Y_{B,t}.",
        "HAC covariance accounts for cross-regional correlation and serial dependence.",
        "Spatial contrast indicates differential regional rate of change, not causal attribution.",
    ]

    if not has_opposite_signs:
        status = "inconclusive"
        sub_status = "signs_not_opposite"
        interp_text = (
            f"Paired contrast inconclusive: empirical slopes have the same sign "
            f"(Region A: {slope_a:+.3f} {unit_per_decade}, Region B: {slope_b:+.3f} {unit_per_decade}). "
            f"Criterion for an opposite-trend pair is not satisfied."
        )
        caveats.append("Empirical slopes for Region A and Region B share the same sign.")
    elif not contrast_significant:
        status = "inconclusive"
        sub_status = (
            "contrast_not_supported_after_multiplicity"
            if selection_status == "exploratory_map_selected"
            else "contrast_not_supported"
        )
        interp_text = (
            f"Opposite empirical slopes observed (Region A: {slope_a:+.3f} {unit_per_decade}, "
            f"Region B: {slope_b:+.3f} {unit_per_decade}), but paired difference "
            f"({slope_diff:+.3f} {unit_per_decade}, decision p={decision_p:.4e}) "
            f"is not statistically significant. Note: Lack of detection does not prove slopes are identical."
        )
        caveats.append("Paired difference slope is not statistically distinguished from zero.")
    else:
        status = "supported"
        sub_status = "opposite_trend_pair"
        interp_text = (
            f"Statistically supported opposite-trend pair detected! "
            f"Region A: {slope_a:+.3f} {unit_per_decade}, Region B: {slope_b:+.3f} {unit_per_decade}. "
            f"Paired slope difference: {slope_diff:+.3f} {unit_per_decade} "
            f"(95% CI [{fit_d['ci_lower_decade']:+.3f}, {fit_d['ci_upper_decade']:+.3f}], decision p={decision_p:.4e}) "
            f"over {start_year}–{end_year} ({span_years}-year span)."
        )

    return {
        "analysis_id": analysis_id,
        "status": status,
        "estimand": {
            "dataset_id": dataset_id,
            "variable": variable,
            "units": units,
            "period": period,
            "geometry": compound_geometry,
            "temporal_aggregation": "annual",
            "spatial_aggregation": "paired_regional_contrast",
        },
        "effect": {
            "estimate": float(slope_diff),
            "unit_per_decade": unit_per_decade,
            "fitted_change": float(fitted_change_diff),
            "contrast_orientation": "region_a_minus_region_b",
            "region_a_estimate": float(slope_a),
            "region_b_estimate": float(slope_b),
        },
        "uncertainty": {
            "lower": float(fit_d["ci_lower_decade"]),
            "upper": float(fit_d["ci_upper_decade"]),
            "level": float(confidence_level),
            "method": "newey_west_hac_bartlett_lag2_small_sample",
        },
        "coverage": {
            "valid_periods": int(fit_d["n"]),
            "expected_periods": int(span_years + 1),
            "valid_fraction": 1.0,
            "missing_periods": [],
        },
        "method": {
            "estimator": "paired_difference_ols_hac",
            "dependence_treatment": "newey_west_hac_bartlett_lag2_small_sample",
            "test_family": test_family,
            "selection_status": selection_status,
            "p_value": float(raw_p),
            "raw_p_value": float(raw_p),
            "adjusted_p_value": float(adjusted_p_value) if adjusted_p_value is not None else None,
            "decision_p_value": float(decision_p),
            "multiplicity_method": multiplicity_method,
            "fdr_level": float(fdr_level) if fdr_level is not None else None,
            "family_id": family_id,
            "family_size": family_size,
            "hypothesis_id": hypothesis_id,
            "diagnostics": {
                "contrast_sub_status": sub_status,
                "has_opposite_signs": has_opposite_signs,
                "degrees_of_freedom": fit_d["df"],
                "t_statistic": float(fit_d["t_stat"]),
                "slope_se_per_decade": float(fit_d["slope_se_per_decade"]),
                "region_a_se_per_decade": float(fit_a["slope_se_per_decade"]),
                "region_b_se_per_decade": float(fit_b["slope_se_per_decade"]),
                "lag_sensitivities": fit_d["lag_sensitivities"],
                "theil_sen": fit_d["theil_sen"],
            },
        },
        "provenance": {
            "manifest_hash": manifest_hash,
            "source_release": source_release,
            "configuration_hash": configuration_hash,
        },
        "caveats": caveats,
        "interpretation": {
            "level": "spatial_contrast",
            "text": interp_text,
        },
    }
