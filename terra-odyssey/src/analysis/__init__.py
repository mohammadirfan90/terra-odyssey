"""Terra Odyssey - Analysis & Statistical Trend Engine."""

from .aggregation import (
    aggregate_annual_precipitation,
    aggregate_annual_temperature,
    aggregate_seasonal,
    get_partial_year_diagnostic,
    validate_consecutive_series,
)
from .interval_sensitivity import (
    attach_interval_sensitivity_to_result,
    compute_interval_sensitivity,
)
from .trend_estimator import estimate_linear_trend

__all__ = [
    "aggregate_annual_temperature",
    "aggregate_annual_precipitation",
    "aggregate_seasonal",
    "get_partial_year_diagnostic",
    "validate_consecutive_series",
    "estimate_linear_trend",
    "compute_interval_sensitivity",
    "attach_interval_sensitivity_to_result",
]
