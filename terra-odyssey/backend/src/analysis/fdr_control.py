"""Benjamini-Yekutieli (BY) FDR multiplicity correction for spatial trend grids.

BY is chosen over BH because it is valid under arbitrary dependence structures,
including positive spatial autocorrelation in climate fields — the most common
and scientifically relevant case for gridded Earth system data.

Reference:
    Benjamini, Y. & Yekutieli, D. (2001). The control of the false discovery
    rate in multiple testing under dependency. Annals of Statistics, 29(4),
    1165–1188. https://doi.org/10.1214/aos/1013699998

Scientific rules enforced:
  - "Not significant" ≠ "no change"; p_adj and effect size are both reported.
  - The BY correction constant c(m) = Σ(1/k, k=1..m) is explicit in the summary.
  - Cells with null=True are excluded from the correction family; their p_adj
    is set to null and significant to null (not False, to avoid implying evidence
    of no trend where data was insufficient).
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("terra_odyssey.analysis.fdr_control")

_DEFAULT_ALPHA = 0.05


def _by_constant(m: int) -> float:
    """Compute the BY correction constant c(m) = sum(1/k, k=1..m)."""
    return sum(1.0 / k for k in range(1, m + 1))


def apply_by_fdr(
    cells: List[Dict[str, Any]],
    alpha: float = _DEFAULT_ALPHA,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Apply Benjamini-Yekutieli FDR correction to a list of spatial grid cells.

    Parameters
    ----------
    cells : list of dict
        Output from `estimate_spatial_grid`. Each cell must have either
        `null=True` or `p_raw` (float in [0, 1]).
    alpha : float
        Family-wise FDR target level (default 0.05).

    Returns
    -------
    cells_out : list of dict
        Same dicts with `p_adj` and `significant` fields added.
    fdr_summary : dict
        Summary block: n_tested, n_significant, fdr_threshold, method,
        by_constant, alpha.
    """
    # Separate valid (non-null) cells with their original indices
    valid_indices: List[int] = []
    p_raw_vals: List[float] = []

    for i, cell in enumerate(cells):
        if not cell.get("null", True) and cell.get("p_raw") is not None:
            valid_indices.append(i)
            p_raw_vals.append(float(cell["p_raw"]))

    m = len(valid_indices)

    # Output copy
    cells_out = [dict(c) for c in cells]

    # Mark null cells explicitly
    for i, cell in enumerate(cells_out):
        if cell.get("null", True):
            cell["p_adj"] = None
            cell["significant"] = None

    if m == 0:
        logger.warning("[fdr_control] No valid cells to correct — all null.")
        return cells_out, {
            "n_tested": 0,
            "n_significant": 0,
            "fdr_threshold": None,
            "method": "benjamini_yekutieli",
            "by_constant": None,
            "alpha": alpha,
        }

    c_m = _by_constant(m)
    p_arr = np.array(p_raw_vals, dtype=np.float64)

    # Sort p-values ascending, track original positions
    order = np.argsort(p_arr)
    sorted_p = p_arr[order]
    ranks = np.arange(1, m + 1, dtype=np.float64)

    # BY threshold for each rank: (rank / m) * (alpha / c(m))
    by_thresholds = (ranks / m) * (alpha / c_m)

    # Adjusted p-values: p_adj[i] = min over j>=i of (m * c_m * p_sorted[j] / j)
    # Using the step-up formulation: p_adj = sorted_p * m * c_m / rank, then
    # cumulative minimum from the right.
    p_adj_sorted = np.minimum(1.0, sorted_p * m * c_m / ranks)
    # Enforce monotonicity (step-up): take cumulative min from right
    p_adj_sorted = np.minimum.accumulate(p_adj_sorted[::-1])[::-1]

    # Find significance threshold: largest rank where sorted_p <= by_threshold
    sig_mask = sorted_p <= by_thresholds
    fdr_threshold: Optional[float] = None
    if sig_mask.any():
        last_sig_rank = int(np.where(sig_mask)[0].max()) + 1  # 1-indexed
        fdr_threshold = float(by_thresholds[last_sig_rank - 1])

    # Map adjusted p-values back to original valid_indices order
    p_adj_in_original_order = np.empty(m, dtype=np.float64)
    p_adj_in_original_order[order] = p_adj_sorted

    n_significant = 0
    for k, orig_i in enumerate(valid_indices):
        p_adj_val = float(np.clip(p_adj_in_original_order[k], 0.0, 1.0))
        is_sig = bool(p_adj_val < alpha)
        cells_out[orig_i]["p_adj"] = round(p_adj_val, 6)
        cells_out[orig_i]["significant"] = is_sig
        if is_sig:
            n_significant += 1

    fdr_summary = {
        "n_tested": m,
        "n_significant": n_significant,
        "fdr_threshold": round(fdr_threshold, 6) if fdr_threshold is not None else None,
        "method": "benjamini_yekutieli",
        "by_constant": round(c_m, 6),
        "alpha": alpha,
    }

    logger.info(
        "[fdr_control] BY FDR: m=%d significant=%d threshold=%s",
        m, n_significant, fdr_threshold,
    )
    return cells_out, fdr_summary
