"""Terra Odyssey - Analysis & Statistical Trend Engine."""

from .aggregation import (
    aggregate_annual_precipitation,
    aggregate_annual_temperature,
    aggregate_seasonal,
    get_partial_year_diagnostic,
    validate_consecutive_series,
)
from .block_bootstrap import (
    BlockBootstrapResult,
    moving_block_bootstrap_trend,
)
from .interval_sensitivity import (
    attach_interval_sensitivity_to_result,
    compute_interval_sensitivity,
)
from .modified_mann_kendall import (
    MannKendallResult,
    compute_sens_slope,
    modified_mann_kendall_test,
)
from .multiplicity import (
    adjudicate_contrast_family,
    adjust_pvalues,
)
from .paired_contrast import estimate_paired_contrast
from .spatial_aggregation import (
    aggregate_spatial_mean,
    compute_cell_bounds_and_areas,
    compute_polygon_weights,
    normalize_geometry,
)
from .trend_estimator import (
    adjudicate_trend_evidence,
    estimate_linear_trend,
    fit_ols_hac_trend,
)

__all__ = [
    "aggregate_annual_temperature",
    "aggregate_annual_precipitation",
    "aggregate_seasonal",
    "get_partial_year_diagnostic",
    "validate_consecutive_series",
    "estimate_linear_trend",
    "fit_ols_hac_trend",
    "adjudicate_trend_evidence",
    "compute_interval_sensitivity",
    "attach_interval_sensitivity_to_result",
    "compute_cell_bounds_and_areas",
    "compute_polygon_weights",
    "aggregate_spatial_mean",
    "normalize_geometry",
    "estimate_paired_contrast",
    "adjust_pvalues",
    "adjudicate_contrast_family",
    "modified_mann_kendall_test",
    "MannKendallResult",
    "compute_sens_slope",
    "moving_block_bootstrap_trend",
    "BlockBootstrapResult",
]
