"""Unit tests for GISTEMP v4 Ingestion Adapter (D5)."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from data.adapters.d5_gistemp import GistempAdapter
from backend.stepper import run_pipeline


@pytest.fixture
def sample_gistemp_cube():
    """Create a sample GISTEMP anomaly DataArray across 3 years."""
    times = pd.date_range("2020-01-01", periods=36, freq="MS")
    lats = np.linspace(-88.0, 88.0, 5)
    lons = np.linspace(-178.0, 178.0, 6)

    data = np.full((36, 5, 6), 0.85, dtype=np.float32)
    # Add fill value
    data[0, 0, 0] = 9999.0
    # Add unphysical outlier
    data[1, 0, 0] = 45.0

    da = xr.DataArray(
        data,
        coords={"time": times, "lat": lats, "lon": lons},
        dims=["time", "lat", "lon"],
        name="temperature_anomaly",
        attrs={"units": "degC anomaly"},
    )
    return da


def test_gistemp_decode(sample_gistemp_cube):
    adapter = GistempAdapter()
    ds = sample_gistemp_cube.to_dataset()
    da = adapter.decode(ds)
    assert da.name == "temperature_anomaly"
    assert da.shape == (36, 5, 6)


def test_gistemp_validate(sample_gistemp_cube):
    adapter = GistempAdapter()
    assert adapter.validate(sample_gistemp_cube) is True

    # Bad coordinates
    bad_cube = sample_gistemp_cube.assign_coords(lat=np.array([-95.0, 0, 10, 20, 30]))
    with pytest.raises(ValueError, match="Latitude out of bounds"):
        adapter.validate(bad_cube)


def test_gistemp_quality_mask(sample_gistemp_cube):
    adapter = GistempAdapter()
    masked = adapter.quality_mask(sample_gistemp_cube)

    # 9999.0 masked to NaN
    assert np.isnan(masked.values[0, 0, 0])
    # 45.0 outlier masked to NaN
    assert np.isnan(masked.values[1, 0, 0])
    # Valid values kept
    assert masked.values[2, 0, 0] == pytest.approx(0.85)


def test_gistemp_convert_units(sample_gistemp_cube):
    adapter = GistempAdapter()
    converted = adapter.convert_units(sample_gistemp_cube)
    assert converted.attrs["units"] == "degC anomaly"
    assert converted.attrs["baseline_period"] == "1951-1980"
    assert "NASA Goddard Institute for Space Studies" in converted.attrs["provider"]


def test_gistemp_normalize_to_annual(sample_gistemp_cube):
    adapter = GistempAdapter()
    annual = adapter.normalize_to_annual(sample_gistemp_cube, min_months=10)
    assert "year" in annual.coords
    assert len(annual.coords["year"]) == 3
    # Check that 2020 annual mean is close to 0.85
    assert not np.isnan(annual.sel(year=2020).values[1, 1])


def test_gistemp_citation():
    adapter = GistempAdapter()
    cite = adapter.cite()
    assert cite["dataset_id"] == "gistemp_v4"
    assert cite["version"] == "4.0"
    assert "1951–1980" in cite["scientific_note"]


def test_gistemp_pipeline_demo_sample(tmp_path):
    """Test full pipeline execution with GISTEMP demo sample."""
    db_file = tmp_path / "gistemp_test.db"
    art_dir = tmp_path / "gistemp_art"

    payload = {
        "dataset_id": "gistemp_v4",
        "variable": "temperature_anomaly",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "demo_sample",
        "selection_status": "predefined",
    }

    result = run_pipeline(
        job_id="test-gistemp-job",
        request_data=payload,
        artifacts_base_dir=art_dir,
        store_db_path=db_file,
    )

    assert result["job_status"] == "succeeded"
    assert (art_dir / "test-gistemp-job" / "investigation_record.json").is_file()
    assert (art_dir / "test-gistemp-job" / "series.json").is_file()
