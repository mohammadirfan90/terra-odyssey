"""Unit tests for D9: NASA Langley CERES EBAF Ed4.2.1 Adapter."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from data.adapters.d9_ceres_ebaf import CeresEbafAdapter
from backend.stepper import run_pipeline


@pytest.fixture
def sample_ceres_cube():
    """Create synthetic monthly CERES TOA flux cube spanning 36 months."""
    times = pd.date_range("2020-01-01", periods=36, freq="MS")
    lats = np.linspace(-60.0, 60.0, 5)
    lons = np.linspace(-120.0, 120.0, 6)

    # Monthly TOA net flux ~0.8 W/m^2 with seasonal swing
    data = np.zeros((36, 5, 6), dtype=np.float32)
    for m_idx, t in enumerate(times):
        val = 0.8 + 2.5 * np.sin(2 * np.pi * t.month / 12.0)
        data[m_idx, :, :] = val

    # Add fill value
    data[0, 0, 0] = -999.0
    # Add unphysical outlier
    data[1, 0, 0] = 120.0

    da = xr.DataArray(
        data,
        coords={"time": times, "lat": lats, "lon": lons},
        dims=["time", "lat", "lon"],
        name="toa_net",
        attrs={"units": "W/m^2"},
    )
    return da


def test_ceres_decode(sample_ceres_cube):
    adapter = CeresEbafAdapter()
    ds = sample_ceres_cube.to_dataset()
    da = adapter.decode(ds)
    assert da.name == "toa_net"
    assert da.shape == (36, 5, 6)


def test_ceres_validate(sample_ceres_cube):
    adapter = CeresEbafAdapter()
    masked = adapter.quality_mask(sample_ceres_cube)
    assert adapter.validate(masked) is True

    # Bad lat
    bad_lats = masked.assign_coords(lat=np.array([-95.0, 0, 10, 20, 30]))
    with pytest.raises(ValueError, match="Latitude out of bounds"):
        adapter.validate(bad_lats)

    # All NaN
    all_nan = xr.full_like(masked, np.nan)
    with pytest.raises(ValueError, match="contains no valid"):
        adapter.validate(all_nan)

    # Out of physical bound
    with pytest.raises(ValueError, match="outside valid physical range"):
        adapter.validate(sample_ceres_cube)


def test_ceres_quality_mask(sample_ceres_cube):
    adapter = CeresEbafAdapter()
    masked = adapter.quality_mask(sample_ceres_cube)

    # -999.0 fill value masked to NaN
    assert np.isnan(masked.values[0, 0, 0])
    # 120.0 outlier masked to NaN
    assert np.isnan(masked.values[1, 0, 0])
    # Valid observation preserved
    assert not np.isnan(masked.values[2, 2, 2])


def test_ceres_convert_units(sample_ceres_cube):
    adapter = CeresEbafAdapter()
    converted = adapter.convert_units(sample_ceres_cube)
    assert converted.attrs["units"] == "W/m^2"
    assert converted.attrs["sign_convention"] == "downward_positive"
    assert "NASA Langley" in converted.attrs["provider"]


def test_ceres_normalize_to_annual(sample_ceres_cube):
    adapter = CeresEbafAdapter()
    annual = adapter.normalize_to_annual(sample_ceres_cube, min_months=10)
    assert "year" in annual.coords
    assert len(annual.coords["year"]) == 3
    # Check that annual mean exists and is close to ~0.8
    assert not np.isnan(annual.sel(year=2020).values[2, 2])


def test_ceres_citation():
    adapter = CeresEbafAdapter()
    cite = adapter.cite()
    assert cite["dataset_id"] == "ceres_ebaf"
    assert "10.5067" in cite["doi"]
    assert "downward radiative fluxes are positive" in cite["scientific_note"]


def test_ceres_pipeline_demo_sample(tmp_path):
    """Test full pipeline execution with CERES EBAF demo sample."""
    db_file = tmp_path / "ceres_test.db"
    art_dir = tmp_path / "ceres_art"

    payload = {
        "dataset_id": "ceres_ebaf",
        "variable": "toa_net",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-30.0, -10.0, 30.0, 10.0],  # Tropical Atlantic
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "demo_sample",
        "selection_status": "predefined",
    }

    result = run_pipeline(
        job_id="test-ceres-job",
        request_data=payload,
        artifacts_base_dir=art_dir,
        store_db_path=db_file,
    )

    assert result["job_status"] == "succeeded"
    assert (art_dir / "test-ceres-job" / "investigation_record.json").is_file()
    assert (art_dir / "test-ceres-job" / "series.json").is_file()
