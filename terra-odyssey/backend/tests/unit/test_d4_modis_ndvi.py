"""Unit tests for the D4 MODIS Vegetation Index NDVI (MOD13A3.061) adapter."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from src.data.adapters.d4_modis_ndvi import ModisNdviAdapter


@pytest.fixture
def sample_modis_ndvi_ds() -> xr.Dataset:
    """Create synthetic MODIS MOD13A3 xarray Dataset for testing."""
    times = pd.date_range("2020-01-01", periods=6, freq="MS")
    lats = np.linspace(-10.0, 10.0, 5)
    lons = np.linspace(20.0, 40.0, 5)

    # 6000 * 0.0001 = 0.60 NDVI
    data = np.full((len(times), len(lats), len(lons)), 6000.0, dtype=np.float32)
    # Inject fill value -3000
    data[0, 0, 0] = -3000.0
    # Inject out-of-range value
    data[0, 1, 1] = 15000.0

    ds = xr.Dataset(
        data_vars={
            "1_km_monthly_NDVI": (["time", "lat", "lon"], data),
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
    adapter = ModisNdviAdapter()
    url = adapter.build_cmr_query_url(start_date="2021-01-01", end_date="2021-12-31", limit=25)

    assert "short_name=MOD13A3" in url
    assert "version=061" in url
    assert "page_size=25" in url
    assert "temporal=2021-01-01T00:00:00Z,2021-12-31T23:59:59Z" in url


def test_decode_extracts_ndvi(sample_modis_ndvi_ds):
    """Verify decode extracts and renames to canonical NDVI variable."""
    adapter = ModisNdviAdapter()
    ds = adapter.decode(sample_modis_ndvi_ds)
    assert "NDVI" in ds.data_vars


def test_decode_missing_variable_raises():
    """Verify decode raises KeyError when NDVI variable is absent."""
    adapter = ModisNdviAdapter()
    empty_ds = xr.Dataset()
    with pytest.raises(KeyError, match="NDVI"):
        adapter.decode(empty_ds)


def test_validate_coordinates(sample_modis_ndvi_ds):
    """Verify coordinate range validation."""
    adapter = ModisNdviAdapter()
    adapter.validate_coordinates(sample_modis_ndvi_ds)

    # Out of range longitude
    bad_ds = sample_modis_ndvi_ds.copy()
    bad_ds["lon"] = np.linspace(170.0, 195.0, 5)
    with pytest.raises(ValueError, match="Longitude"):
        adapter.validate_coordinates(bad_ds)


def test_quality_mask_fill_values(sample_modis_ndvi_ds):
    """Verify fill value -3000 is masked to NaN."""
    adapter = ModisNdviAdapter()
    decoded = adapter.decode(sample_modis_ndvi_ds)
    masked = adapter.apply_quality_mask(decoded)
    vals = masked["NDVI"].values

    assert np.isnan(vals[0, 0, 0])
    assert not np.isnan(vals[0, 2, 2])


def test_unit_conversion_and_scaling(sample_modis_ndvi_ds):
    """Verify scale factor (0.0001) and physical range masking."""
    adapter = ModisNdviAdapter()
    decoded = adapter.decode(sample_modis_ndvi_ds)
    masked = adapter.apply_quality_mask(decoded)
    converted = adapter.convert_units(masked)
    vals = converted["NDVI"].values

    # 6000 * 0.0001 = 0.60
    assert pytest.approx(vals[0, 2, 2], rel=1e-4) == 0.60
    # Out of range value (15000 -> 1.5) masked to NaN
    assert np.isnan(vals[0, 1, 1])
    assert converted["NDVI"].attrs["units"] == "dimensionless"


def test_full_process_pipeline(sample_modis_ndvi_ds):
    """Verify end-to-end processing pipeline."""
    adapter = ModisNdviAdapter()
    processed = adapter.process(sample_modis_ndvi_ds)

    assert "NDVI" in processed.data_vars
    assert np.isnan(processed["NDVI"].values[0, 0, 0])
    assert processed["NDVI"].attrs["units"] == "dimensionless"


def test_citation_provenance():
    """Verify citation metadata dictionary contents."""
    adapter = ModisNdviAdapter()
    prov = adapter.get_citation_provenance()

    assert prov["dataset_id"] == "D4"
    assert prov["collection"] == "MOD13A3"
    assert prov["version"] == "061"
    assert "LP DAAC" in prov["daac"]
    assert prov["doi"] == "10.5067/MODIS/MOD13A3.061"
