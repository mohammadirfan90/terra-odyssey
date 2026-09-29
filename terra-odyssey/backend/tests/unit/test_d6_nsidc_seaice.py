"""Unit tests for NOAA/NSIDC Sea Ice Index v4 Ingestion Adapter (D6)."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from data.adapters.d6_nsidc_seaice import NsidcSeaIceAdapter
from backend.stepper import run_pipeline


@pytest.fixture
def sample_seaice_cube():
    """Create a sample NSIDC Sea Ice extent DataArray across 3 years (36 months)."""
    times = pd.date_range("2020-01-01", periods=36, freq="MS")
    lats = np.linspace(60.0, 88.0, 5)
    lons = np.linspace(-180.0, 180.0, 6)

    # Monthly extent with seasonal cycle: winter high ~15.0, September low ~4.5
    data = np.zeros((36, 5, 6), dtype=np.float32)
    for m_idx, t in enumerate(times):
        month = t.month
        # Minimum in September (month 9), maximum in March (month 3)
        extent_val = 10.0 + 5.0 * np.cos(2 * np.pi * (month - 3) / 12.0)
        data[m_idx, :, :] = extent_val

    # Add fill value
    data[0, 0, 0] = -9999.0
    # Add unphysical high outlier
    data[1, 0, 0] = 55.0

    da = xr.DataArray(
        data,
        coords={"time": times, "lat": lats, "lon": lons},
        dims=["time", "lat", "lon"],
        name="extent",
        attrs={"units": "10^6 km^2"},
    )
    return da


def test_seaice_decode(sample_seaice_cube):
    adapter = NsidcSeaIceAdapter()
    ds = sample_seaice_cube.to_dataset()
    da = adapter.decode(ds)
    assert da.name == "extent"
    assert da.shape == (36, 5, 6)


def test_seaice_validate(sample_seaice_cube):
    adapter = NsidcSeaIceAdapter()
    masked = adapter.quality_mask(sample_seaice_cube)
    assert adapter.validate(masked) is True

    # Unmasked cube with -9999.0 should fail validation
    with pytest.raises(ValueError, match="Sea ice values contain unmasked negative fill values"):
        adapter.validate(sample_seaice_cube)

    # Array with all NaNs should fail validation
    all_nan = xr.full_like(sample_seaice_cube, np.nan)
    with pytest.raises(ValueError, match="contains no valid"):
        adapter.validate(all_nan)


def test_seaice_quality_mask(sample_seaice_cube):
    adapter = NsidcSeaIceAdapter()
    masked = adapter.quality_mask(sample_seaice_cube)

    # -9999.0 masked to NaN
    assert np.isnan(masked.values[0, 0, 0])
    # 55.0 outlier masked to NaN
    assert np.isnan(masked.values[1, 0, 0])
    # Valid extent kept
    assert masked.values[2, 0, 0] > 0.0


def test_seaice_convert_units(sample_seaice_cube):
    adapter = NsidcSeaIceAdapter()
    converted = adapter.convert_units(sample_seaice_cube)
    assert converted.attrs["units"] == "10^6 km^2"
    assert converted.attrs["standard_name"] == "sea_ice_extent"
    assert "NSIDC / NOAA" in converted.attrs["provider"]


def test_seaice_extract_annual_minimum(sample_seaice_cube):
    adapter = NsidcSeaIceAdapter()
    # Mask out bad values first
    masked = adapter.quality_mask(sample_seaice_cube)
    min_series = adapter.extract_annual_minimum(masked, hemisphere="north")

    assert "year" in min_series.coords
    assert len(min_series.coords["year"]) == 3  # 2020, 2021, 2022
    assert "September" in min_series.attrs["temporal_support"]
    # September extent should be the minimum around ~5.0 million km^2
    assert min_series.sel(year=2020).values[1, 1] < 6.0


def test_seaice_normalize_to_annual_modes(sample_seaice_cube):
    adapter = NsidcSeaIceAdapter()
    masked = adapter.quality_mask(sample_seaice_cube)

    # Mode 1: annual_mean
    annual_mean = adapter.normalize_to_annual(masked, mode="annual_mean", min_months=10)
    assert len(annual_mean.coords["year"]) == 3

    # Mode 2: september_minimum
    sep_min = adapter.normalize_to_annual(masked, mode="september_minimum")
    assert len(sep_min.coords["year"]) == 3
    assert "September" in sep_min.attrs["temporal_support"]


def test_seaice_citation():
    adapter = NsidcSeaIceAdapter()
    cite = adapter.cite()
    assert cite["dataset_id"] == "nsidc_sea_ice"
    assert cite["version"] == "4.0"
    assert "15%" in cite["scientific_note"]


def test_seaice_pipeline_demo_sample(tmp_path):
    """Test full pipeline execution with NSIDC Sea Ice demo sample."""
    db_file = tmp_path / "seaice_test.db"
    art_dir = tmp_path / "seaice_art"

    payload = {
        "dataset_id": "nsidc_sea_ice",
        "variable": "extent",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-180.0, 65.0, 180.0, 90.0],
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "demo_sample",
        "selection_status": "predefined",
    }

    result = run_pipeline(
        job_id="test-seaice-job",
        request_data=payload,
        artifacts_base_dir=art_dir,
        store_db_path=db_file,
    )

    assert result["job_status"] == "succeeded"
    assert (art_dir / "test-seaice-job" / "investigation_record.json").is_file()
    assert (art_dir / "test-seaice-job" / "series.json").is_file()
