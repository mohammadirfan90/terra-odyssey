"""Unit tests for NOAA OISST v2.1 Ingestion Adapter (D7)."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from data.adapters.d7_noaa_oisst import NoaaOisstAdapter
from backend.stepper import run_pipeline


@pytest.fixture
def sample_oisst_cube():
    """Create a sample OISST SST DataArray across 3 years."""
    times = pd.date_range("2020-01-01", periods=36, freq="MS")
    lats = np.linspace(-40.0, 40.0, 5)
    lons = np.linspace(-150.0, 150.0, 6)

    data = np.full((36, 5, 6), 22.4, dtype=np.float32)
    # Add land fill value
    data[0, 0, 0] = -999.0
    # Add unphysical freezing outlier (ice flag / non-ocean)
    data[1, 0, 0] = -5.0
    # Add extreme high outlier
    data[2, 0, 0] = 55.0

    da = xr.DataArray(
        data,
        coords={"time": times, "lat": lats, "lon": lons},
        dims=["time", "lat", "lon"],
        name="sst",
        attrs={"units": "degC"},
    )
    return da


def test_oisst_decode(sample_oisst_cube):
    adapter = NoaaOisstAdapter()
    ds = sample_oisst_cube.to_dataset()
    da = adapter.decode(ds)
    assert da.name == "sst"
    assert da.shape == (36, 5, 6)


def test_oisst_validate(sample_oisst_cube):
    adapter = NoaaOisstAdapter()
    assert adapter.validate(sample_oisst_cube) is True

    bad_cube = sample_oisst_cube.assign_coords(lat=np.array([-95.0, 0, 10, 20, 30]))
    with pytest.raises(ValueError, match="Latitude out of bounds"):
        adapter.validate(bad_cube)


def test_oisst_quality_mask(sample_oisst_cube):
    adapter = NoaaOisstAdapter()
    masked = adapter.quality_mask(sample_oisst_cube)

    # -999.0 land masked to NaN
    assert np.isnan(masked.values[0, 0, 0])
    # -5.0 ice flag masked to NaN
    assert np.isnan(masked.values[1, 0, 0])
    # 55.0 high outlier masked to NaN
    assert np.isnan(masked.values[2, 0, 0])
    # Valid ocean SST kept
    assert masked.values[3, 0, 0] == pytest.approx(22.4)


def test_oisst_convert_units(sample_oisst_cube):
    adapter = NoaaOisstAdapter()
    converted = adapter.convert_units(sample_oisst_cube)
    assert converted.attrs["units"] == "degC"
    assert "Daily Sea Surface Temperature" in converted.attrs["long_name"]
    assert "NOAA NCEI" in converted.attrs["provider"]


def test_oisst_normalize_to_annual(sample_oisst_cube):
    adapter = NoaaOisstAdapter()
    annual = adapter.normalize_to_annual(sample_oisst_cube, min_months=10)
    assert "year" in annual.coords
    assert len(annual.coords["year"]) == 3
    assert not np.isnan(annual.sel(year=2020).values[1, 1])


def test_oisst_citation():
    adapter = NoaaOisstAdapter()
    cite = adapter.cite()
    assert cite["dataset_id"] == "noaa_oisst"
    assert cite["version"] == "2.1"
    assert "AVHRR" in cite["scientific_note"]


def test_oisst_pipeline_demo_sample(tmp_path):
    """Test full pipeline execution with NOAA OISST demo sample."""
    db_file = tmp_path / "oisst_test.db"
    art_dir = tmp_path / "oisst_art"

    payload = {
        "dataset_id": "noaa_oisst",
        "variable": "sst",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-140.0, -10.0, -110.0, 10.0],
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "demo_sample",
        "selection_status": "predefined",
    }

    result = run_pipeline(
        job_id="test-oisst-job",
        request_data=payload,
        artifacts_base_dir=art_dir,
        store_db_path=db_file,
    )

    assert result["job_status"] == "succeeded"
    assert (art_dir / "test-oisst-job" / "investigation_record.json").is_file()
    assert (art_dir / "test-oisst-job" / "series.json").is_file()
