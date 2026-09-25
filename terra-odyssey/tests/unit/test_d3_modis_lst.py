"""Unit tests for the D3 MODIS Land Surface Temperature (MOD11A2.061) adapter."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from src.data.adapters.d3_modis_lst import ModisLstAdapter


@pytest.fixture
def sample_modis_ds() -> xr.Dataset:
    """Create synthetic MODIS MOD11A2 xarray Dataset for testing."""
    times = pd.date_range("2020-01-01", periods=4, freq="8D")
    lats = np.linspace(30.0, 35.0, 5)
    lons = np.linspace(-120.0, -115.0, 5)

    # 15000 * 0.02 = 300 Kelvin -> 26.85 Celsius
    data = np.full((len(times), len(lats), len(lons)), 15000.0, dtype=np.float32)
    # Inject fill value 0.0
    data[0, 0, 0] = 0.0

    ds = xr.Dataset(
        data_vars={
            "LST_Day_1km": (["time", "lat", "lon"], data),
        },
        coords={
            "time": times,
            "lat": lats,
            "lon": lons,
        },
    )
    return ds


def test_cmr_query_url_builder():
    """Verify CMR query URL formatting."""
    adapter = ModisLstAdapter()
    url = adapter.build_cmr_query_url(start_date="2020-01-01", end_date="2020-12-31", limit=50)

    assert "short_name=MOD11A2" in url
    assert "version=061" in url
    assert "page_size=50" in url
    assert "temporal=2020-01-01T00:00:00Z,2020-12-31T23:59:59Z" in url


def test_decode_extracts_lst(sample_modis_ds):
    """Verify decode accepts dataset containing LST_Day_1km."""
    adapter = ModisLstAdapter()
    ds = adapter.decode(sample_modis_ds)
    assert "LST_Day_1km" in ds.data_vars


def test_decode_missing_variable_raises():
    """Verify decode raises KeyError when required variable is absent."""
    adapter = ModisLstAdapter()
    empty_ds = xr.Dataset()
    with pytest.raises(KeyError, match="LST_Day_1km"):
        adapter.decode(empty_ds)


def test_validate_coordinates(sample_modis_ds):
    """Verify coordinate range validation."""
    adapter = ModisLstAdapter()
    adapter.validate_coordinates(sample_modis_ds)

    # Out of range latitude
    bad_ds = sample_modis_ds.copy()
    bad_ds["lat"] = np.linspace(85.0, 95.0, 5)
    with pytest.raises(ValueError, match="Latitude"):
        adapter.validate_coordinates(bad_ds)


def test_quality_mask_fill_values(sample_modis_ds):
    """Verify fill value 0.0 is masked to NaN."""
    adapter = ModisLstAdapter()
    masked = adapter.apply_quality_mask(sample_modis_ds)
    vals = masked["LST_Day_1km"].values

    assert np.isnan(vals[0, 0, 0])
    assert not np.isnan(vals[0, 1, 1])


def test_unit_conversion_kelvin_to_celsius(sample_modis_ds):
    """Verify scale factor and Kelvin to Celsius conversion."""
    adapter = ModisLstAdapter()
    converted = adapter.convert_units(sample_modis_ds)
    vals = converted["LST_Day_1km"].values

    # 15000 * 0.02 = 300.0 K -> 300.0 - 273.15 = 26.85 °C
    expected_celsius = 300.0 - 273.15
    assert pytest.approx(vals[0, 1, 1], rel=1e-4) == expected_celsius
    assert converted["LST_Day_1km"].attrs["units"] == "degC"


def test_full_process_pipeline(sample_modis_ds):
    """Verify end-to-end processing pipeline."""
    adapter = ModisLstAdapter()
    processed = adapter.process(sample_modis_ds)

    assert "LST_Day_1km" in processed.data_vars
    assert np.isnan(processed["LST_Day_1km"].values[0, 0, 0])
    assert processed["LST_Day_1km"].attrs["units"] == "degC"


def test_citation_provenance():
    """Verify citation metadata dictionary contents."""
    adapter = ModisLstAdapter()
    prov = adapter.get_citation_provenance()

    assert prov["dataset_id"] == "D3"
    assert prov["collection"] == "MOD11A2"
    assert prov["version"] == "061"
    assert "LP DAAC" in prov["daac"]
    assert prov["doi"] == "10.5067/MODIS/MOD11A2.061"
