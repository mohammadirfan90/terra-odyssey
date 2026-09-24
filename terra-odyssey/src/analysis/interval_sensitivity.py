"""Endpoint interval sensitivity analyzer for climate time series.

Analyzes stability of trend estimates and statistical classifications across
5 predefined start/end year perturbation windows:
1. 'full': start -> end
2. 'start_plus_3': start + 3 -> end
3. 'start_plus_5': start + 5 -> end
4. 'end_minus_3': start -> end - 3
5. 'end_minus_5': start -> end - 5

Enforces non-negotiable scientific constraints:
- Discards any window with fewer than 20 consecutive complete years.
- Treats sensitivity windows as diagnostic stability tests, not independent confirmations.
- Appends explicit caveats if statistical support status shifts between endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np

from .trend_estimator import estimate_linear_trend


def compute_interval_sensitivity(
    years: np.ndarray,
    values: np.ndarray,
    dataset_id: str,
    variable: str,
    units: str,
    unit_per_decade: str,
    geometry: Optional[Dict[str, Any]] = None,
    confidence_level: float = 0.95,
    min_consecutive_years: int = 20,
) -> Dict[str, Any]:
    """Compute trend estimates across 5 predefined start/end interval windows.

    Parameters
    ----------
    years : np.ndarray
        Array of integer years.
    values : np.ndarray
        Array of corresponding annual values (floats).
    dataset_id : str
        Dataset identifier.
    variable : str
        Variable name.
    units : str
        Physical measurement units.
    unit_per_decade : str
        Physical units per decade.
    geometry : Optional[dict]
        Spatial footprint or bounding box.
    confidence_level : float
        Confidence level for CI (default: 0.95).
    min_consecutive_years : int
        Minimum unbroken years required for an eligible window (default: 20).

    Returns
    -------
    dict
        Interval sensitivity diagnostic dictionary.
    """
    years = np.asarray(years, dtype=int)
    values = np.asarray(values, dtype=np.float64)

    valid_mask = ~np.isnan(values)
    valid_years = years[valid_mask]

    if len(valid_years) == 0:
        return {
            "windows_evaluated": 5,
            "windows_eligible": 0,
            "slope_range_per_decade": [0.0, 0.0],
            "sign_agreement": False,
            "classification_shifts": False,
            "window_results": [],
        }

    start_year = int(valid_years[0])
    end_year = int(valid_years[-1])

    # 5 predefined one-endpoint-at-a-time windows
    predefined_windows = [
        ("full", start_year, end_year),
        ("start_plus_3", start_year + 3, end_year),
        ("start_plus_5", start_year + 5, end_year),
        ("end_minus_3", start_year, end_year - 3),
        ("end_minus_5", start_year, end_year - 5),
    ]

    window_results = []
    eligible_slopes = []
    eligible_statuses = []

    for win_id, w_start, w_end in predefined_windows:
        w_span = w_end - w_start
        mask = (years >= w_start) & (years <= w_end)
        w_years = years[mask]
        w_values = values[mask]

        # Count valid consecutive years
        valid_in_win = np.sum(~np.isnan(w_values))
        expected_in_win = w_span + 1

        if valid_in_win < min_consecutive_years or valid_in_win < expected_in_win:
            window_results.append(
                {
                    "window_id": win_id,
                    "start_year": w_start,
                    "end_year": w_end,
                    "span_years": w_span,
                    "eligible": False,
                    "reason": (
                        f"Span ({valid_in_win} valid years) below threshold ({min_consecutive_years}) "
                        f"or has missing years."
                    ),
                    "slope_per_decade": None,
                    "slope_se_per_decade": None,
                    "p_value": None,
                    "status": "ineligible",
                }
            )
            continue

        # Fit trend model on this window
        trend_res = estimate_linear_trend(
            years=w_years,
            values=w_values,
            dataset_id=dataset_id,
            variable=variable,
            units=units,
            unit_per_decade=unit_per_decade,
            geometry=geometry,
            confidence_level=confidence_level,
        )

        slope_dec = trend_res["effect"]["estimate"]
        se_dec = trend_res["method"]["diagnostics"]["slope_se_per_decade"]
        p_val = trend_res["method"]["p_value"]
        w_status = trend_res["status"]

        eligible_slopes.append(slope_dec)
        eligible_statuses.append(w_status)

        window_results.append(
            {
                "window_id": win_id,
                "start_year": w_start,
                "end_year": w_end,
                "span_years": w_span,
                "eligible": True,
                "slope_per_decade": float(slope_dec),
                "slope_se_per_decade": float(se_dec),
                "p_value": float(p_val),
                "status": w_status,
            }
        )

    windows_eligible = len(eligible_slopes)

    if windows_eligible > 0:
        slope_min = float(np.min(eligible_slopes))
        slope_max = float(np.max(eligible_slopes))
        sign_agreement = bool(np.all(np.array(eligible_slopes) > 0) or np.all(np.array(eligible_slopes) < 0))
        classification_shifts = len(set(eligible_statuses)) > 1
    else:
        slope_min, slope_max = 0.0, 0.0
        sign_agreement = False
        classification_shifts = False

    return {
        "windows_evaluated": len(predefined_windows),
        "windows_eligible": windows_eligible,
        "slope_range_per_decade": [slope_min, slope_max],
        "sign_agreement": sign_agreement,
        "classification_shifts": classification_shifts,
        "window_results": window_results,
    }


def attach_interval_sensitivity_to_result(
    primary_result: Dict[str, Any],
    sensitivity_diagnostics: Dict[str, Any],
) -> Dict[str, Any]:
    """Attach interval sensitivity diagnostics to an existing AnalysisResult dictionary.

    If any eligible window shifts classification between 'supported' and 'inconclusive',
    appends an explicit scientific caveat to primary_result['caveats'].
    """
    res = dict(primary_result)
    if "method" in res and "diagnostics" in res["method"]:
        res["method"]["diagnostics"]["interval_sensitivity"] = sensitivity_diagnostics

    if sensitivity_diagnostics.get("classification_shifts", False):
        shift_caveat = (
            "Interval sensitivity demonstrates that statistical detection status shifts across "
            "alternative start/end endpoints; trends should be interpreted with caution."
        )
        if shift_caveat not in res.get("caveats", []):
            res.setdefault("caveats", []).append(shift_caveat)

    return res
