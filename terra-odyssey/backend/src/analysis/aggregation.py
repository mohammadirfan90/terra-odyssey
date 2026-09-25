"""Temporal aggregation and missingness validation engine for Terra Odyssey.

Enforces non-negotiable scientific rules:
1. Strict 12/12 calendar-month completeness for inferential annual means (temperature)
   and annual accumulation totals (precipitation).
2. Day-of-month weighting with leap-year awareness for annual temperature means.
3. Explicit seasonal boundary aggregation (DJF assigns Dec y-1 to year y).
4. Consecutive annual sequence validation requiring at least 20 continuous years
   for inferential trend estimation without collapsing time gaps.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import xarray as xr


def aggregate_annual_temperature(da_monthly: xr.DataArray) -> xr.DataArray:
    """Compute day-weighted annual mean temperature enforcing strict 12/12 monthly completeness.

    Mathematical formulation:
        T_annual = sum(T_m * d_m) / sum(d_m) for m in {1..12}
    where d_m is the exact number of calendar days in month m (including leap-year Feb = 29 days).

    If any month is missing (NaN) or the year has fewer than 12 valid months,
    the resulting annual value is strictly masked to NaN.

    Parameters
    ----------
    da_monthly : xr.DataArray
        Monthly temperature DataArray with a datetime-like 'time' coordinate.

    Returns
    -------
    xr.DataArray
        Annual mean temperature with coordinate 'year'. Incomplete years are NaN.
    """
    if "time" not in da_monthly.dims and "time" not in da_monthly.coords:
        raise ValueError("da_monthly must contain a 'time' dimension or coordinate.")

    # Calculate days in each calendar month with exact leap-year awareness
    days_in_month = da_monthly.time.dt.days_in_month

    # Count valid (non-null) months per year
    valid_months = da_monthly.notnull().groupby("time.year").sum(dim="time")

    # Mask days where observations are null to prevent denominator mismatch
    masked_days = days_in_month.where(da_monthly.notnull())

    # Weighted numerator and denominator
    weighted_sum = (da_monthly * days_in_month).groupby("time.year").sum(dim="time", skipna=False)
    total_days = masked_days.groupby("time.year").sum(dim="time", skipna=False)

    # Compute weighted annual mean strictly where all 12 calendar months are present and valid
    annual_mean = (weighted_sum / total_days).where(valid_months == 12)

    # Preserve metadata attributes
    annual_mean.name = da_monthly.name or "temperature_annual_mean"
    annual_mean.attrs = dict(da_monthly.attrs)
    annual_mean.attrs.update(
        {
            "temporal_aggregation": "annual_mean_day_weighted",
            "completeness_policy": "strict_12_of_12_months",
            "units": da_monthly.attrs.get("units", "degC"),
        }
    )
    return annual_mean


def aggregate_annual_precipitation(da_monthly_accum: xr.DataArray) -> xr.DataArray:
    """Compute annual precipitation total accumulation enforcing strict 12/12 completeness.

    Mathematical formulation:
        P_annual = sum(P_m,accum) for m in {1..12}

    If any calendar month is missing, the annual sum evaluates to NaN rather than
    undercounting the true water budget.

    Parameters
    ----------
    da_monthly_accum : xr.DataArray
        Monthly precipitation accumulation (e.g. mm/month) with 'time' dimension.

    Returns
    -------
    xr.DataArray
        Annual precipitation accumulation with coordinate 'year' (mm/year).
    """
    if "time" not in da_monthly_accum.dims and "time" not in da_monthly_accum.coords:
        raise ValueError("da_monthly_accum must contain a 'time' dimension or coordinate.")

    valid_months = da_monthly_accum.notnull().groupby("time.year").sum(dim="time")
    annual_sum = da_monthly_accum.groupby("time.year").sum(dim="time", skipna=False).where(valid_months == 12)

    annual_sum.name = da_monthly_accum.name or "precipitation_annual_total"
    annual_sum.attrs = dict(da_monthly_accum.attrs)
    annual_sum.attrs.update(
        {
            "temporal_aggregation": "annual_accumulation_sum",
            "completeness_policy": "strict_12_of_12_months",
            "units": "mm/year",
        }
    )
    return annual_sum


def get_partial_year_diagnostic(da_monthly: xr.DataArray) -> xr.Dataset:
    """Provide descriptive diagnostic summary for incomplete years (e.g. 10-11 months).

    Note: These partial-year statistics are strictly for exploratory diagnostic
    inspection and are NOT eligible to enter inferential trend estimation.
    """
    days_in_month = da_monthly.time.dt.days_in_month
    valid_months = da_monthly.notnull().groupby("time.year").sum(dim="time")
    weighted_sum = (da_monthly * days_in_month).groupby("time.year").sum(dim="time", skipna=True)
    masked_days = days_in_month.where(da_monthly.notnull()).groupby("time.year").sum(dim="time", skipna=True)

    partial_mean = weighted_sum / masked_days
    is_inferential_eligible = valid_months == 12

    ds_diag = xr.Dataset(
        data_vars={
            "weighted_mean": partial_mean,
            "valid_months_count": valid_months,
            "is_inferential_eligible": is_inferential_eligible,
        }
    )
    ds_diag.attrs["description"] = "Descriptive diagnostic only. Partial years must NOT enter trend inference."
    return ds_diag


def aggregate_seasonal(da_monthly: xr.DataArray, season: str = "DJF") -> xr.DataArray:
    """Compute seasonal summary with exact calendar boundaries.

    Seasons:
        - 'DJF': Dec (year-1), Jan (year), Feb (year). Assigned to year of Jan/Feb.
        - 'MAM': Mar, Apr, May of calendar year.
        - 'JJA': Jun, Jul, Aug of calendar year.
        - 'SON': Sep, Oct, Nov of calendar year.

    Strict rule: All 3 constituent months must be non-null; otherwise returns NaN.

    Parameters
    ----------
    da_monthly : xr.DataArray
        Monthly time series with datetime 'time' coordinate.
    season : str
        One of 'DJF', 'MAM', 'JJA', 'SON'.

    Returns
    -------
    xr.DataArray
        Seasonal time series indexed by season_year.
    """
    season = season.upper()
    valid_seasons = {"DJF", "MAM", "JJA", "SON"}
    if season not in valid_seasons:
        raise ValueError(f"Unknown season '{season}'. Must be one of {valid_seasons}.")

    time_idx = pd.to_datetime(da_monthly.time.values)
    years = time_idx.year
    months = time_idx.month

    if season == "DJF":
        # December belongs to winter of the following year
        season_year = np.where(months == 12, years + 1, years)
        season_mask = np.isin(months, [12, 1, 2])
    elif season == "MAM":
        season_year = years
        season_mask = np.isin(months, [3, 4, 5])
    elif season == "JJA":
        season_year = years
        season_mask = np.isin(months, [6, 7, 8])
    else:  # SON
        season_year = years
        season_mask = np.isin(months, [9, 10, 11])

    # Subset to the months in this season
    da_season = da_monthly.isel(time=season_mask)
    season_year_sub = season_year[season_mask]

    # Assign season_year coordinate
    da_season = da_season.assign_coords(season_year=("time", season_year_sub))

    # Calculate day-weighted seasonal mean
    days_in_month = da_season.time.dt.days_in_month
    valid_months = da_season.notnull().groupby("season_year").sum(dim="time")

    weighted_sum = (da_season * days_in_month).groupby("season_year").sum(dim="time", skipna=False)
    masked_days = days_in_month.where(da_season.notnull()).groupby("season_year").sum(dim="time", skipna=False)

    # Strictly require 3 valid months per season
    seasonal_mean = (weighted_sum / masked_days).where(valid_months == 3)
    seasonal_mean.name = f"{da_monthly.name or 'val'}_{season.lower()}"
    seasonal_mean.attrs = dict(da_monthly.attrs)
    seasonal_mean.attrs.update(
        {
            "temporal_aggregation": f"seasonal_mean_{season}",
            "completeness_policy": "strict_3_of_3_months",
        }
    )
    return seasonal_mean


def validate_consecutive_series(
    years: np.ndarray,
    values: np.ndarray,
    min_years: int = 20,
) -> Dict[str, Any]:
    """Validate that an annual time series forms an unbroken, consecutive sequence.

    Scientific constraints:
    - Never collapse non-consecutive years into consecutive indices.
    - Require at least `min_years` (default 20) consecutive complete annual observations
      for inferential trend detection.

    Parameters
    ----------
    years : np.ndarray
        Array of integer year coordinates.
    values : np.ndarray
        Array of corresponding annual values (floats).
    min_years : int
        Minimum number of consecutive complete years required (default: 20).

    Returns
    -------
    dict
        Dictionary containing:
        - 'is_eligible': bool
        - 'valid_count': int
        - 'expected_count': int
        - 'missing_years': list[int]
        - 'reason': Optional[str]
    """
    years = np.asarray(years, dtype=int)
    values = np.asarray(values, dtype=float)

    if len(years) != len(values):
        raise ValueError("Length of 'years' and 'values' arrays must match.")

    # Find valid (non-NaN) indices
    valid_mask = ~np.isnan(values)
    valid_years = years[valid_mask]
    valid_count = int(len(valid_years))

    if valid_count == 0:
        return {
            "is_eligible": False,
            "valid_count": 0,
            "expected_count": 0,
            "missing_years": [],
            "reason": "All annual values are NaN.",
        }

    start_year = int(valid_years[0])
    end_year = int(valid_years[-1])
    expected_full_range = list(range(start_year, end_year + 1))
    expected_count = len(expected_full_range)
    missing_years = sorted(list(set(expected_full_range) - set(valid_years)))

    # Check continuity: difference between adjacent years must all be 1
    is_consecutive = (valid_count == expected_count) and bool(np.all(np.diff(valid_years) == 1))
    meets_min_years = valid_count >= min_years

    if not is_consecutive:
        reason = f"Series has temporal gaps ({len(missing_years)} missing years: {missing_years[:5]}...). Cannot collapse time."
    elif not meets_min_years:
        reason = f"Series span ({valid_count} years) is below minimum inferential threshold ({min_years} years)."
    else:
        reason = None

    return {
        "is_eligible": is_consecutive and meets_min_years,
        "valid_count": valid_count,
        "expected_count": expected_count,
        "missing_years": missing_years,
        "start_year": start_year,
        "end_year": end_year,
        "reason": reason,
    }
