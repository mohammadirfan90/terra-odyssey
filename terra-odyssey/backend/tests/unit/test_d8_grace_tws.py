"""Unit tests for D8: NASA JPL GRACE / GRACE-FO Mascon Adapter."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from data.adapters.d8_grace_tws import GraceTwsAdapter
from backend.stepper import run_pipeline


@pytest.fixture
def sample_grace_cube():
    """Create synthetic GRACE monthly cube spanning 2016 to 2019 (covering the gap)."""
    times = pd.date_range("2016-01-01", periods=48, freq="MS")
    lats = np.linspace(-40.0, 40.0, 5)
    lons = np.linspace(-60.0, 60.0, 6)

    # Monthly LWE anomaly with seasonal fluctuation
    data = np.zeros((48, 5, 6), dtype=np.float32)
    for m_idx, t in enumerate(times):
        # Monthly oscillation ±10 cm around -2 cm trend
        val = -2.0 + 10.0 * np.sin(2 * np.pi * t.month / 12.0)
        data[m_idx, :, :] = val

    # Set 11-month transition gap (2017-07 to 2018-05) to NaN as required by science rules
    gap_mask = (times >= "2017-07-01") & (times <= "2018-05-31")
    data[gap_mask, :, :] = np.nan

    da = xr.DataArray(
        data,
        coords={"time": times, "lat": lats, "lon": lons},
        dims=["time", "lat", "lon"],
        name="lwe_thickness",
        attrs={"units": "cm"},
    )
    return da


def test_grace_decode(sample_grace_cube):
    adapter = GraceTwsAdapter()
    ds = sample_grace_cube.to_dataset()
    da = adapter.decode(ds)
    assert da.name == "lwe_thickness"
    assert da.shape == (48, 5, 6)


def test_grace_validate(sample_grace_cube):
    adapter = GraceTwsAdapter()
    assert adapter.validate(sample_grace_cube) is True

    # Bad lat
    bad_lats = sample_grace_cube.assign_coords(lat=np.array([-95.0, 0, 10, 20, 30]))
    with pytest.raises(ValueError, match="Latitude out of bounds"):
        adapter.validate(bad_lats)

    # All NaN
    all_nan = xr.full_like(sample_grace_cube, np.nan)
    with pytest.raises(ValueError, match="contains no valid"):
        adapter.validate(all_nan)


def test_grace_uninterpolated_gap_rule(sample_grace_cube):
    """Verify that an interpolated value in the 2017-07 to 2018-05 gap triggers strict error."""
    adapter = GraceTwsAdapter()

    # With NaNs in gap, validation passes
    assert adapter.verify_uninterpolated_gap(sample_grace_cube) is True

    # Artificially interpolate or fill a gap month
    interpolated_cube = sample_grace_cube.copy(deep=True)
    times = pd.to_datetime(interpolated_cube.coords["time"].values)
    gap_idx = np.where((times >= "2017-07-01") & (times <= "2018-05-31"))[0]
    # Set one gap month to a synthetic number
    interpolated_cube.values[gap_idx[0], 0, 0] = -3.5

    with pytest.raises(ValueError, match="prohibits interpolating this mission gap"):
        adapter.validate(interpolated_cube)


def test_grace_quality_mask(sample_grace_cube):
    adapter = GraceTwsAdapter()
    test_cube = sample_grace_cube.copy(deep=True)
    test_cube.values[0, 0, 0] = -9999.0  # fill value
    test_cube.values[1, 0, 0] = 5000.0  # unphysical outlier

    masked = adapter.quality_mask(test_cube)
    assert np.isnan(masked.values[0, 0, 0])
    assert np.isnan(masked.values[1, 0, 0])


def test_grace_convert_units(sample_grace_cube):
    adapter = GraceTwsAdapter()
    converted = adapter.convert_units(sample_grace_cube)
    assert converted.attrs["units"] == "cm"
    assert "NASA JPL" in converted.attrs["provider"]
    assert "uninterpolated_201707_201805" == converted.attrs["gap_policy"]


def test_grace_normalize_to_annual(sample_grace_cube):
    adapter = GraceTwsAdapter()
    # With min_months=6, 2016, 2017 (6 valid months), 2018 (7 valid months), 2019 are computed
    annual = adapter.normalize_to_annual(sample_grace_cube, min_months=6)
    assert "year" in annual.coords
    assert len(annual.coords["year"]) == 4
    assert not np.isnan(annual.sel(year=2017).values[1, 1])

    # With min_months=10, 2017 and 2018 (only 6-7 valid months) must be NaN
    annual_strict = adapter.normalize_to_annual(sample_grace_cube, min_months=10)
    assert np.isnan(annual_strict.sel(year=2017).values[1, 1])
    assert np.isnan(annual_strict.sel(year=2018).values[1, 1])
    # Full years 2016 and 2019 remain valid
    assert not np.isnan(annual_strict.sel(year=2016).values[1, 1])


def test_grace_citation():
    adapter = GraceTwsAdapter()
    cite = adapter.cite()
    assert cite["dataset_id"] == "grace_tws"
    assert "10.5067/TEMSC-3JC64" in cite["doi"]
    assert "11-month observation gap" in cite["scientific_note"]


def test_grace_pipeline_demo_sample(tmp_path):
    """Test full pipeline execution with GRACE TWS demo sample."""
    db_file = tmp_path / "grace_test.db"
    art_dir = tmp_path / "grace_art"

    payload = {
        "dataset_id": "grace_tws",
        "variable": "lwe_thickness",
        "period": {"start_year": 2002, "end_year": 2024},
        "region_a": [-65.0, -15.0, -50.0, 0.0],  # Amazon basin
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "demo_sample",
        "selection_status": "predefined",
    }

    result = run_pipeline(
        job_id="test-grace-job",
        request_data=payload,
        artifacts_base_dir=art_dir,
        store_db_path=db_file,
    )

    assert result["job_status"] == "succeeded"
    assert (art_dir / "test-grace-job" / "investigation_record.json").is_file()
    assert (art_dir / "test-grace-job" / "series.json").is_file()
