"""Spatial grid trend estimator for Terra Odyssey Phase 4.

Subdivides a bounding box into a regular grid of cells and estimates
an independent OLS+HAC (Newey-West, L=1) linear trend for each cell
using real NASA observation data already loaded as an xarray DataArray.

Design constraints:
  - Maximum 40x40 = 1600 cells to keep memory and runtime bounded.
  - Default cell resolution: 0.5° × 0.5°.
  - Minimum 10 valid years per cell; cells below threshold are marked null.
  - Fill/QA masking must be applied BEFORE passing da to this module.
  - No synthetic fallbacks; raises ValueError if da is empty.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import xarray as xr
import statsmodels.api as sm

logger = logging.getLogger("terra_odyssey.analysis.spatial_grid")

# Hard limits to keep computation feasible in a single request
_MAX_CELLS_PER_AXIS = 40
_MIN_VALID_YEARS = 10
_DEFAULT_RESOLUTION_DEG = 0.5


def _cell_ols_hac(
    years: np.ndarray,
    values: np.ndarray,
) -> Optional[Dict[str, Any]]:
    """OLS+HAC (Newey-West L=1) trend for a single 1-D annual series.

    Returns None if there are fewer than _MIN_VALID_YEARS valid observations.
    Returns a dict with keys: slope, se, t_stat, p_raw, n_years, intercept.
    """
    valid = ~np.isnan(values)
    y = values[valid]
    t = years[valid].astype(np.float64)
    n = int(valid.sum())

    if n < _MIN_VALID_YEARS:
        return None

    x = t - t.mean()
    X = sm.add_constant(x, has_constant="add")
    try:
        model = sm.OLS(y, X).fit()
        robust = model.get_robustcov_results(
            cov_type="HAC",
            maxlags=1,
            use_correction=True,
        )
        slope = float(robust.params[1])
        se = float(robust.bse[1])
        t_stat = float(robust.tvalues[1])
        p_raw = float(robust.pvalues[1])
        intercept = float(robust.params[0])
    except Exception as exc:
        logger.debug("Cell OLS failed: %s", exc)
        return None

    return {
        "slope": slope,
        "se": se,
        "t_stat": t_stat,
        "p_raw": p_raw,
        "n_years": n,
        "intercept": intercept,
    }


def _build_cell_grid(
    bbox: Tuple[float, float, float, float],
    resolution: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """Return arrays of cell center longitudes and latitudes.

    Clamps the number of cells to _MAX_CELLS_PER_AXIS per axis.
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    lon_span = max_lon - min_lon
    lat_span = max_lat - min_lat

    n_lon = min(int(np.ceil(lon_span / resolution)), _MAX_CELLS_PER_AXIS)
    n_lat = min(int(np.ceil(lat_span / resolution)), _MAX_CELLS_PER_AXIS)

    # At least 1 cell per axis
    n_lon = max(n_lon, 1)
    n_lat = max(n_lat, 1)

    step_lon = lon_span / n_lon
    step_lat = lat_span / n_lat

    lons = np.array([min_lon + (i + 0.5) * step_lon for i in range(n_lon)])
    lats = np.array([min_lat + (j + 0.5) * step_lat for j in range(n_lat)])
    return lons, lats


def estimate_spatial_grid(
    da: xr.DataArray,
    bbox: Tuple[float, float, float, float],
    variable: str,
    unit: str,
    resolution: float = _DEFAULT_RESOLUTION_DEG,
) -> List[Dict[str, Any]]:
    """Estimate per-cell OLS+HAC linear trend across a spatial grid.

    Parameters
    ----------
    da : xr.DataArray
        Annual-mean DataArray with dimensions (year, lat, lon) or (time, lat, lon).
        All fill/QA masking must be applied before calling this function.
    bbox : tuple
        (min_lon, min_lat, max_lon, max_lat) bounding box for the study region.
    variable : str
        Variable identifier (used for logging only).
    unit : str
        Physical unit string (e.g. "°C", "mm/year") attached to each cell record.
    resolution : float
        Cell size in degrees (default 0.5°).

    Returns
    -------
    list of dict
        Each dict contains:
          lon_center, lat_center, slope, se, p_raw, n_years, unit
          or lon_center, lat_center, null=True (if cell has insufficient data)
    """
    if da is None or da.size == 0:
        raise ValueError("DataArray is empty; cannot estimate spatial grid.")

    # Normalise time dimension name
    time_dim = "year" if "year" in da.dims else "time"
    lat_dim = "lat" if "lat" in da.dims else "latitude"
    lon_dim = "lon" if "lon" in da.dims else "longitude"

    # Extract year integer array from the time coordinate
    if time_dim == "year":
        years_all = da[time_dim].values.astype(np.float64)
    else:
        import pandas as pd
        times = pd.DatetimeIndex(da[time_dim].values)  # type: ignore[arg-type]
        years_all = np.array([float(t.year) for t in times])

    # Build cell centres
    cell_lons, cell_lats = _build_cell_grid(bbox, resolution)
    min_lon, min_lat, max_lon, max_lat = bbox

    step_lon = (max_lon - min_lon) / len(cell_lons)
    step_lat = (max_lat - min_lat) / len(cell_lats)

    records: List[Dict[str, Any]] = []
    n_valid = 0
    n_null = 0

    for lat_c in cell_lats:
        for lon_c in cell_lons:
            # Cell bounds
            lon0 = lon_c - step_lon / 2
            lon1 = lon_c + step_lon / 2
            lat0 = lat_c - step_lat / 2
            lat1 = lat_c + step_lat / 2

            # Spatial slice: select all grid points within cell bounds
            try:
                cell = da.sel(
                    {lat_dim: slice(lat0, lat1), lon_dim: slice(lon0, lon1)}
                )
                if cell.size == 0:
                    # No grid points in cell — try nearest neighbour
                    cell = da.sel(
                        {lat_dim: lat_c, lon_dim: lon_c},
                        method="nearest",
                    )
                    # Ensure 1-D time series
                    if cell.ndim > 1:
                        cell = cell.isel({d: 0 for d in cell.dims if d != time_dim})
                    ts = cell.values.astype(np.float64)
                else:
                    # Area-weighted spatial mean within cell
                    lat_weights = np.cos(
                        np.deg2rad(cell[lat_dim].values.astype(np.float64))
                    )
                    weights = xr.DataArray(
                        lat_weights,
                        dims=[lat_dim],
                        coords={lat_dim: cell[lat_dim]},
                    )
                    ts = cell.weighted(weights).mean(dim=[lat_dim, lon_dim]).values.astype(np.float64)
            except Exception as exc:
                logger.debug("Cell slice failed at (%.2f, %.2f): %s", lat_c, lon_c, exc)
                records.append({
                    "lon_center": round(float(lon_c), 4),
                    "lat_center": round(float(lat_c), 4),
                    "null": True,
                    "null_reason": "slice_error",
                })
                n_null += 1
                continue

            result = _cell_ols_hac(years_all, ts)

            if result is None:
                records.append({
                    "lon_center": round(float(lon_c), 4),
                    "lat_center": round(float(lat_c), 4),
                    "null": True,
                    "null_reason": "insufficient_data",
                })
                n_null += 1
            else:
                records.append({
                    "lon_center": round(float(lon_c), 4),
                    "lat_center": round(float(lat_c), 4),
                    "slope": round(result["slope"], 6),
                    "slope_per_decade": round(result["slope"] * 10.0, 6),
                    "se": round(result["se"], 6),
                    "t_stat": round(result["t_stat"], 4),
                    "p_raw": round(result["p_raw"], 6),
                    "n_years": result["n_years"],
                    "unit": unit,
                    "null": False,
                })
                n_valid += 1

    logger.info(
        "[spatial_grid] variable=%s cells=%d valid=%d null=%d",
        variable, len(records), n_valid, n_null,
    )
    return records
