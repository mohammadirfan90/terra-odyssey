"""Multiple-testing adjustment and family-wise evidence adjudication engine.

Enforces non-negotiable scientific constraints:
1. Benjamini-Yekutieli (BY, 2001) as primary default for spatial fields to control
   FDR under arbitrary dependency.
2. Benjamini-Hochberg (BH, 1995) as sensitivity diagnostic.
3. Explicit family freezing with family_id, family_size, and hypothesis_id.
4. Mandatory 'selection_status': 'exploratory_map_selected' disclosure.
5. Re-adjudication of contrast evidence status under multiplicity.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from statsmodels.stats.multitest import multipletests


def adjust_pvalues(
    p_values: np.ndarray,
    method: str = "fdr_by",
    alpha: float = 0.05,
) -> Tuple[np.ndarray, np.ndarray]:
    """Adjust p-values using statsmodels multipletests.

    Parameters
    ----------
    p_values : np.ndarray
        1D array of p-values in [0, 1].
    method : str
        'fdr_by' (Benjamini-Yekutieli) or 'fdr_bh' (Benjamini-Hochberg).
    alpha : float
        FDR threshold (default: 0.05).

    Returns
    -------
    tuple of (rejected_mask, adjusted_p_values)
    """
    p_values = np.asarray(p_values, dtype=np.float64)
    if len(p_values) == 0:
        return np.array([], dtype=bool), np.array([], dtype=np.float64)

    # Clip for safety
    p_clipped = np.clip(p_values, 0.0, 1.0)
    reject, pvals_corrected, _, _ = multipletests(p_clipped, alpha=alpha, method=method)
    return reject, pvals_corrected


def adjudicate_contrast_family(
    contrast_results: List[Dict[str, Any]],
    family_id: str,
    fdr_level: float = 0.05,
) -> List[Dict[str, Any]]:
    """Adjudicate an exploratory family of candidate contrasts under Benjamini-Yekutieli FDR control.

    Parameters
    ----------
    contrast_results : list of dict
        List of AnalysisResult dictionaries for candidate contrasts in the family.
    family_id : str
        Unique identifier for the declared test family.
    fdr_level : float
        Target false discovery rate (default: 0.05).

    Returns
    -------
    list of dict
        Updated list of AnalysisResult dictionaries with multiplicity fields and re-adjudicated status.
    """
    if not contrast_results:
        return []

    family_size = len(contrast_results)

    # Extract raw contrast p-values
    raw_p_values = np.array(
        [
            res["method"].get("raw_p_value", res["method"].get("p_value", 1.0))
            if (res.get("method") and res["method"].get("raw_p_value") is not None)
            else 1.0
            for res in contrast_results
        ],
        dtype=np.float64,
    )

    # 1. Primary adjustment: Benjamini-Yekutieli (fdr_by)
    rej_by, adj_p_by = adjust_pvalues(raw_p_values, method="fdr_by", alpha=fdr_level)

    # 2. Sensitivity diagnostic: Benjamini-Hochberg (fdr_bh)
    rej_bh, adj_p_bh = adjust_pvalues(raw_p_values, method="fdr_bh", alpha=fdr_level)

    adjudicated_results = []
    for i, res in enumerate(contrast_results):
        updated = dict(res)
        method_dict = dict(updated.get("method", {}))
        diag_dict = dict(method_dict.get("diagnostics", {}))

        raw_p = float(raw_p_values[i])
        by_p = float(adj_p_by[i])
        bh_p = float(adj_p_bh[i])

        method_dict.update(
            {
                "selection_status": "exploratory_map_selected",
                "test_family": family_id,
                "family_id": family_id,
                "family_size": family_size,
                "hypothesis_id": updated.get("analysis_id", f"hyp_{i}"),
                "multiplicity_method": "fdr_by",
                "fdr_level": float(fdr_level),
                "raw_p_value": raw_p,
                "adjusted_p_value": by_p,
                "decision_p_value": by_p,
            }
        )

        diag_dict["multiplicity_sensitivity"] = {
            "fdr_bh_adjusted_p": bh_p,
            "fdr_bh_rejected": bool(rej_bh[i]),
        }
        method_dict["diagnostics"] = diag_dict
        updated["method"] = method_dict

        caveats = list(updated.get("caveats", []))
        selection_disclosure = (
            f"Region pair was selected after exploratory search across family '{family_id}' "
            f"({family_size} candidate contrasts); multiplicity controlled using Benjamini-Yekutieli (BY)."
        )
        if selection_disclosure not in caveats:
            caveats.append(selection_disclosure)

        # Evidence re-adjudication
        current_status = updated.get("status", "inconclusive")
        sub_status = diag_dict.get("contrast_sub_status", "")

        if current_status == "supported" or sub_status == "opposite_trend_pair":
            if by_p >= fdr_level:
                # Downgraded by multiplicity
                updated["status"] = "inconclusive"
                diag_dict["contrast_sub_status"] = "contrast_not_supported_after_multiplicity"
                downgrade_caveat = (
                    f"Opposite empirical slopes observed, but paired difference is not statistically "
                    f"significant after Benjamini-Yekutieli multiplicity adjustment (raw p={raw_p:.4e}, "
                    f"adjusted p={by_p:.4e} >= {fdr_level})."
                )
                if downgrade_caveat not in caveats:
                    caveats.append(downgrade_caveat)
                updated["interpretation"] = {
                    "level": "spatial_contrast",
                    "text": (
                        f"Nominal opposite slopes observed, but contrast is inconclusive after "
                        f"Benjamini-Yekutieli multiplicity control across {family_size} tests "
                        f"(adjusted p={by_p:.4e} >= {fdr_level})."
                    ),
                }
            else:
                # Stays supported
                updated["status"] = "supported"
                diag_dict["contrast_sub_status"] = "opposite_trend_pair"
                by_support_caveat = (
                    f"Statistically supported under Benjamini-Yekutieli FDR control "
                    f"(adjusted p={by_p:.4e} < {fdr_level})."
                )
                if by_support_caveat not in caveats:
                    caveats.append(by_support_caveat)
                updated["interpretation"] = {
                    "level": "spatial_contrast",
                    "text": (
                        f"Statistically supported opposite-trend pair under Benjamini-Yekutieli "
                        f"multiplicity control across {family_size} tests (adjusted p={by_p:.4e} < {fdr_level})."
                    ),
                }

        updated["caveats"] = caveats
        adjudicated_results.append(updated)

    return adjudicated_results
