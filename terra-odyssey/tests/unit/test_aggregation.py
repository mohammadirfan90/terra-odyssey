"""Unit tests for temporal aggregation, calendar weighting, and missingness validation."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from src.analysis.aggregation import (
    aggregate_annual_precipitation,
    aggregate_annual_temperature,
    aggregate_seasonal,
    get_partial_year_diagnostic,
    validate_consecutive_series,
)


def create_monthly_temperature_series(
    start: str,
    end: str,
    const_temp: float = 15.0,
) -> xr.DataArray:
    """Helper to generate monthly temperature DataArray."""
    times = pd.date_range(start=start, end=end, freq="MS")
    data = np.full(len(times), const_temp, dtype=np.float64)
    da = xr.DataArray(
        data,
        coords={"time": times},
        dims=["time"],
        name="T2M",
        attrs={"units": "degC"},
    )
    return da


def test_annual_temperature_complete_year():
    """Verify exact day-weighted calculation for leap vs non-leap years."""
    # 2024 is a leap year (366 days, Feb has 29 days)
    da_2024 = create_monthly_temperature_series("2024-01-01", "2024-12-01", const_temp=10.0)
    # Set Feb to 20.0, rest 10.0
    da_2024.loc[{"time": "2024-02-01"}] = 20.0

    # Expected day-weighted mean:
    # Jan=31, Feb=29, Mar=31, Apr=30, May=31, Jun=30, Jul=31, Aug=31, Sep=30, Oct=31, Nov=30, Dec=31 = 366 days
    # (11 * 10 * days + 20 * 29) / 366 = (3370 + 580) / 366 = 3950 / 366 = 10.792349726775956
    expected_2024 = (10.0 * (366 - 29) + 20.0 * 29) / 366.0

    annual = aggregate_annual_temperature(da_2024)
    val = float(annual.sel(year=2024).values)
    assert pytest.approx(expected_2024, rel=1e-7) == val

    # 2023 is non-leap (365 days, Feb has 28 days)
    da_2023 = create_monthly_temperature_series("2023-01-01", "2023-12-01", const_temp=10.0)
    da_2023.loc[{"time": "2023-02-01"}] = 20.0
    expected_2023 = (10.0 * (365 - 28) + 20.0 * 28) / 365.0

    annual_2023 = aggregate_annual_temperature(da_2023)
    val_2023 = float(annual_2023.sel(year=2023).values)
    assert pytest.approx(expected_2023, rel=1e-7) == val_2023


def test_annual_temperature_missing_month_masked():
    """Verify that any missing month causes annual mean to be masked to NaN."""
    da = create_monthly_temperature_series("2022-01-01", "2022-12-01", const_temp=15.0)
    # Mask June (month 6) to NaN
    da.loc[{"time": "2022-06-01"}] = np.nan

    annual = aggregate_annual_temperature(da)
    assert np.isnan(float(annual.sel(year=2022).values))


def test_annual_precipitation_complete_and_incomplete():
    """Verify precipitation accumulation sums 12 months or masks to NaN."""
    times = pd.date_range(start="2020-01-01", end="2021-12-01", freq="MS")
    # 50 mm/month
    data = np.full(len(times), 50.0, dtype=np.float64)
    # Mask November 2021
    data[22] = np.nan

    da_precip = xr.DataArray(
        data,
        coords={"time": times},
        dims=["time"],
        name="precipitationCal",
        attrs={"units": "mm/month"},
    )

    annual_p = aggregate_annual_precipitation(da_precip)

    # 2020 has 12 valid months -> 12 * 50 = 600 mm
    assert float(annual_p.sel(year=2020).values) == 600.0
    # 2021 has 11 valid months -> NaN
    assert np.isnan(float(annual_p.sel(year=2021).values))


def test_seasonal_djf_year_boundary():
    """Verify DJF assigns December y-1 to year y winter season."""
    # 2020-11-01 through 2021-03-01
    times = pd.date_range(start="2020-11-01", end="2021-03-01", freq="MS")
    data = np.array([5.0, 10.0, 12.0, 14.0, 16.0], dtype=np.float64)
    # Dec 2020=10.0 (31 days), Jan 2021=12.0 (31 days), Feb 2021=14.0 (28 days) -> Total = 90 days
    # Expected weighted mean: (10*31 + 12*31 + 14*28) / 90 = (310 + 372 + 392) / 90 = 1074 / 90 = 11.933333333333334
    expected_djf = (10.0 * 31 + 12.0 * 31 + 14.0 * 28) / 90.0

    da = xr.DataArray(data, coords={"time": times}, dims=["time"], name="T2M")
    djf = aggregate_seasonal(da, season="DJF")

    # Winter of 2021
    val = float(djf.sel(season_year=2021).values)
    assert pytest.approx(expected_djf, rel=1e-7) == val


def test_seasonal_incomplete_masked():
    """Verify seasonal aggregation yields NaN if any of the 3 months is missing."""
    times = pd.date_range(start="2021-06-01", end="2021-08-01", freq="MS")
    # June, July, August -> JJA
    data = np.array([20.0, np.nan, 25.0])
    da = xr.DataArray(data, coords={"time": times}, dims=["time"], name="T2M")
    jja = aggregate_seasonal(da, season="JJA")
    assert np.isnan(float(jja.sel(season_year=2021).values))


def test_partial_year_diagnostic():
    """Verify partial year diagnostic exposes descriptive mean without affecting inferential series."""
    da = create_monthly_temperature_series("2022-01-01", "2022-12-01", const_temp=15.0)
    da.loc[{"time": "2022-07-01"}] = np.nan

    diag = get_partial_year_diagnostic(da)
    assert int(diag["valid_months_count"].sel(year=2022).values) == 11
    assert bool(diag["is_inferential_eligible"].sel(year=2022).values) is False
    assert not np.isnan(float(diag["weighted_mean"].sel(year=2022).values))


def test_consecutive_series_validation():
    """Verify consecutive series validation detects temporal gaps and rejects non-consecutive series."""
    years = np.arange(2001, 2026)  # 25 years
    values = np.linspace(10.0, 15.0, 25)

    # 1. Complete consecutive series >= 20 years
    res = validate_consecutive_series(years, values, min_years=20)
    assert res["is_eligible"] is True
    assert res["valid_count"] == 25
    assert len(res["missing_years"]) == 0

    # 2. Series with a temporal gap (missing 2012)
    values_with_gap = values.copy()
    values_with_gap[years == 2012] = np.nan
    res_gap = validate_consecutive_series(years, values_with_gap, min_years=20)
    assert res_gap["is_eligible"] is False
    assert 2012 in res_gap["missing_years"]
    assert "Cannot collapse time" in res_gap["reason"]

    # 3. Series under minimum threshold (18 years)
    res_short = validate_consecutive_series(years[:18], values[:18], min_years=20)
    assert res_short["is_eligible"] is False
    assert "below minimum inferential threshold" in res_short["reason"]
