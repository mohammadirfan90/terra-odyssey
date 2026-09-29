"""Unit tests for GPM IMERG Final Monthly Precipitation Data Adapter (D2)."""

import json
from pathlib import Path
import numpy as np
import pytest
import xarray as xr

from data.adapters.d2_gpm_imerg import GpmImergAdapter
from tests.fixtures.synthetic_gpm import generate_synthetic_gpm_cube


@pytest.fixture
def adapter():
    return GpmImergAdapter()


@pytest.fixture
def synthetic_ds():
    return generate_synthetic_gpm_cube(n_times=6, n_lats=8, n_lons=10, insert_fill_values=True)


def test_cmr_query_url_builder(adapter):
    """Test NASA CMR URL parameters conform to official GPM IMERG collection specification."""
    url = adapter.build_cmr_query_url(start_date="2000-06-01", end_date="2025-12-31", limit=25)
    assert "short_name=GPM_3IMERGM" in url
    assert "version=07" in url
    assert "page_size=25" in url
    assert "temporal=2000-06-01T00:00:00Z,2025-12-31T23:59:59Z" in url


def test_decode_extracts_precipitation_cal(adapter, synthetic_ds):
    """Test decoding successfully extracts the precipitationCal DataArray."""
    da = adapter.decode(synthetic_ds)
    assert isinstance(da, xr.DataArray)
    assert da.name == "precipitationCal"
    assert "time" in da.dims
    assert "lat" in da.dims
    assert "lon" in da.dims


def test_decode_missing_variable_raises(adapter):
    """Test decoding raises KeyError when neither precipitationCal nor precipitation exists."""
    empty_ds = xr.Dataset({"UNSUPPORTED_VAR": ("x", [1, 2, 3])})
    with pytest.raises(KeyError, match="Neither 'precipitationCal' nor 'precipitation' found"):
        adapter.decode(empty_ds)


def test_validate_coordinates(adapter, synthetic_ds):
    """Test coordinate validation passes on standard grid and fails on out-of-bounds coords."""
    da = adapter.decode(synthetic_ds)
    assert adapter.validate(da) is True

    # Test invalid latitude
    invalid_lat_ds = synthetic_ds.copy()
    invalid_lat_ds["lat"] = invalid_lat_ds["lat"] + 100.0  # Out of range [-90, 90]
    with pytest.raises(ValueError, match="Latitude out of bounds"):
        adapter.validate(invalid_lat_ds["precipitationCal"])


def test_quality_mask_fill_values_and_negatives(adapter, synthetic_ds):
    """Test fill values (-9999.9) and negative rates are masked to NaN."""
    da = adapter.decode(synthetic_ds)
    masked = adapter.quality_mask(da)

    # Check fill value locations are now NaN
    assert np.isnan(masked.values[0, 0, 0])
    assert np.isnan(masked.values[1, 1, 1])

    # Check negative value location is now NaN
    assert np.isnan(masked.values[2, 2, 2])

    # Check valid values remain positive numbers
    assert not np.isnan(masked.values[0, 1, 0])
    assert masked.values[0, 1, 0] >= 0.0


def test_monthly_accumulation_calendar_hours(adapter):
    """Test conversion from rate (mm/hr) to accumulation (mm/month) using exact calendar hours."""
    rate = xr.DataArray([1.0], dims=["sample"], attrs={"units": "mm/hr"})

    # January 2024: 31 days = 744 hours
    jan_accum = adapter.calculate_accumulation(rate, year=2024, month=1)
    assert jan_accum.attrs["units"] == "mm/month"
    assert jan_accum.attrs["calendar_hours"] == 744.0
    assert np.isclose(jan_accum.values[0], 744.0)

    # February 2021 (non-leap year): 28 days = 672 hours
    feb_non_leap = adapter.calculate_accumulation(rate, year=2021, month=2)
    assert feb_non_leap.attrs["calendar_hours"] == 672.0
    assert np.isclose(feb_non_leap.values[0], 672.0)

    # February 2024 (leap year): 29 days = 696 hours
    feb_leap = adapter.calculate_accumulation(rate, year=2024, month=2)
    assert feb_leap.attrs["calendar_hours"] == 696.0
    assert np.isclose(feb_leap.values[0], 696.0)

    # April: 30 days = 720 hours
    apr_accum = adapter.calculate_accumulation(rate, year=2024, month=4)
    assert apr_accum.attrs["calendar_hours"] == 720.0
    assert np.isclose(apr_accum.values[0], 720.0)


def test_monthly_accumulation_invalid_month_raises(adapter):
    """Test passing invalid month raises ValueError."""
    rate = xr.DataArray([1.0], dims=["sample"])
    with pytest.raises(ValueError, match="Invalid month: 13"):
        adapter.calculate_accumulation(rate, year=2024, month=13)


def test_full_process_pipeline(adapter, synthetic_ds):
    """Test full processing pipeline (decode, validate, mask, accumulate)."""
    # Process for July 2024 (31 days = 744 hours)
    processed = adapter.process(synthetic_ds, year=2024, month=7)

    assert isinstance(processed, xr.DataArray)
    assert processed.attrs["units"] == "mm/month"
    assert np.isnan(processed.values[0, 0, 0])
    valid_vals = processed.values[~np.isnan(processed.values)]
    assert valid_vals.min() >= 0.0


def test_citation_provenance(adapter):
    """Test citation metadata contains required scientific and mission attributes."""
    citation = adapter.cite()
    assert citation["dataset_id"] == "D2"
    assert citation["collection"] == "GPM_3IMERGM"
    assert citation["version"] == "07"
    assert citation["doi"] == "10.5067/GPM/IMERG/3B-MONTH/07"
    assert citation["source_type"] == "mission_product"
    assert "gpm" in citation["scientific_note"].lower()


def test_manifest_conformance(adapter):
    """Test adapter metadata conforms to the committed d2_gpm_imerg.json manifest."""
    manifest_path = Path(__file__).resolve().parents[2] / "data" / "manifests" / "d2_gpm_imerg.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    citation = adapter.cite()
    assert citation["dataset_id"] == manifest["dataset_id"]
    assert citation["collection"] == manifest["collection"]
    assert citation["version"] == manifest["version"]
    assert citation["doi"] == manifest["provenance"]["doi"]
    assert citation["source_type"] == manifest["source_type"]


def test_cube_accumulation_leap_years(adapter):
    """Test multi-month cube rate-to-accumulation conversion accounting for leap years."""
    import pandas as pd
    times = pd.date_range("2020-01-01", periods=24, freq="MS")  # 2020 (leap) and 2021 (non-leap)
    rates = xr.DataArray(
        np.ones((24, 2, 2), dtype=np.float32),
        coords={"time": times, "lat": [0.0, 1.0], "lon": [0.0, 1.0]},
        dims=["time", "lat", "lon"],
        attrs={"units": "mm/hr"},
    )

    accum = adapter.calculate_cube_accumulation(rates)
    assert accum.attrs["units"] == "mm/month"

    # February 2020 (29 days = 696 hrs)
    feb_2020 = accum.sel(time="2020-02-01").values[0, 0]
    assert np.isclose(feb_2020, 696.0)

    # February 2021 (28 days = 672 hrs)
    feb_2021 = accum.sel(time="2021-02-01").values[0, 0]
    assert np.isclose(feb_2021, 672.0)


def test_aggregate_annual_precipitation_complete_years(adapter):
    """Test annual accumulation summing complete 12-month calendar years."""
    import pandas as pd
    from data.adapters.d2_gpm_imerg import aggregate_annual_precipitation

    times = pd.date_range("2020-01-01", periods=24, freq="MS")
    rates = xr.DataArray(
        np.ones(24, dtype=np.float64),
        coords={"time": times},
        dims=["time"],
        attrs={"units": "mm/hr"},
    )
    monthly_accum = adapter.calculate_cube_accumulation(rates)
    annual = aggregate_annual_precipitation(monthly_accum, strict_12_months=True)

    assert annual.attrs["units"] == "mm/year"
    assert annual.attrs["completeness_policy"] == "strict_12_of_12_months"
    assert set(annual["year"].values) == {2020, 2021}
    # 2020 leap year has 8784 hours, 2021 non-leap year has 8760 hours
    assert np.isclose(annual.sel(year=2020).values, 8784.0)
    assert np.isclose(annual.sel(year=2021).values, 8760.0)


def test_aggregate_annual_precipitation_rejects_missing_months(adapter):
    """Test that years with missing months are masked to NaN and not zeroed."""
    import pandas as pd
    from data.adapters.d2_gpm_imerg import aggregate_annual_precipitation

    # 2020 has 12 months, 2021 has only 11 months (December missing)
    times = list(pd.date_range("2020-01-01", periods=12, freq="MS")) + list(
        pd.date_range("2021-01-01", periods=11, freq="MS")
    )
    rates = xr.DataArray(
        np.ones(len(times), dtype=np.float64),
        coords={"time": pd.to_datetime(times)},
        dims=["time"],
        attrs={"units": "mm/hr"},
    )
    monthly_accum = adapter.calculate_cube_accumulation(rates)
    annual = aggregate_annual_precipitation(monthly_accum, strict_12_months=True)

    # 2020 is complete, 2021 must be NaN (never zeroed or partial!)
    assert not np.isnan(annual.sel(year=2020).values)
    assert np.isnan(annual.sel(year=2021).values)

    # If all years are incomplete, strictly raises ValueError
    incomplete_only = monthly_accum.sel(time=slice("2021-01-01", "2021-11-01"))
    with pytest.raises(ValueError, match="No complete calendar years found"):
        aggregate_annual_precipitation(incomplete_only, strict_12_months=True)
