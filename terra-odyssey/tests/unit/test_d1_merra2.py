"""Unit tests for MERRA-2 T2M Data Ingestion Adapter (D1)."""

import json
from pathlib import Path
import numpy as np
import pytest
import xarray as xr

from src.data.adapters.d1_merra2 import Merra2Adapter
from tests.fixtures.synthetic_merra2 import generate_synthetic_merra2_cube


@pytest.fixture
def adapter():
    return Merra2Adapter()


@pytest.fixture
def synthetic_ds():
    return generate_synthetic_merra2_cube(n_times=6, n_lats=8, n_lons=10, insert_fill_values=True)


def test_cmr_query_url_builder(adapter):
    """Test NASA CMR URL parameters conform to official collection specification."""
    url = adapter.build_cmr_query_url(start_date="1980-01-01", end_date="2025-12-31", limit=50)
    assert "short_name=M2TMNXSLV" in url
    assert "version=5.12.4" in url
    assert "page_size=50" in url
    assert "temporal=1980-01-01T00:00:00Z,2025-12-31T23:59:59Z" in url


def test_decode_extracts_t2m(adapter, synthetic_ds):
    """Test decoding successfully extracts the T2M DataArray."""
    da = adapter.decode(synthetic_ds)
    assert isinstance(da, xr.DataArray)
    assert da.name == "T2M"
    assert "time" in da.dims
    assert "lat" in da.dims
    assert "lon" in da.dims


def test_decode_missing_variable_raises(adapter):
    """Test decoding raises KeyError when T2M is not in dataset."""
    empty_ds = xr.Dataset({"OTHER_VAR": ("x", [1, 2, 3])})
    with pytest.raises(KeyError, match="Variable 'T2M' not found"):
        adapter.decode(empty_ds)


def test_validate_coordinates(adapter, synthetic_ds):
    """Test coordinate validation passes on standard grid and fails on out-of-bounds coords."""
    da = adapter.decode(synthetic_ds)
    assert adapter.validate(da) is True

    # Test invalid latitude
    invalid_lat_ds = synthetic_ds.copy()
    invalid_lat_ds["lat"] = invalid_lat_ds["lat"] + 100.0  # Out of range [-90, 90]
    with pytest.raises(ValueError, match="Latitude out of bounds"):
        adapter.validate(invalid_lat_ds["T2M"])


def test_quality_mask_fill_values(adapter, synthetic_ds):
    """Test fill values (>= 1.0e14) are masked to NaN while valid temperatures are preserved."""
    da = adapter.decode(synthetic_ds)
    masked = adapter.quality_mask(da)

    # Check known fill value locations are now NaN
    assert np.isnan(masked.values[0, 0, 0])
    assert np.isnan(masked.values[1, 1, 1])

    # Check valid values remain numeric
    assert not np.isnan(masked.values[0, 1, 0])
    assert masked.values[0, 1, 0] < 1.0e14


def test_unit_conversion_kelvin_to_celsius(adapter):
    """Test explicit conversion from Kelvin to Celsius: T_C = T_K - 273.15."""
    # Test known physical reference points
    test_k = xr.DataArray(
        [273.15, 293.15, 373.15],
        dims=["sample"],
        attrs={"units": "K"},
    )
    celsius = adapter.convert_units(test_k)

    assert celsius.attrs["units"] == "degC"
    assert np.isclose(celsius.values[0], 0.00, atol=1e-5)
    assert np.isclose(celsius.values[1], 20.00, atol=1e-5)
    assert np.isclose(celsius.values[2], 100.00, atol=1e-5)


def test_full_process_pipeline(adapter, synthetic_ds):
    """Test full processing pipeline (decode, validate, mask, convert)."""
    processed = adapter.process(synthetic_ds)

    assert isinstance(processed, xr.DataArray)
    assert processed.attrs["units"] == "degC"
    assert np.isnan(processed.values[0, 0, 0])
    # Valid temperatures should be around -50 °C to +50 °C for Earth surface air
    valid_vals = processed.values[~np.isnan(processed.values)]
    assert valid_vals.min() > -100.0
    assert valid_vals.max() < 100.0


def test_citation_provenance(adapter):
    """Test citation metadata contains required scientific and provider attributes."""
    citation = adapter.cite()
    assert citation["dataset_id"] == "D1"
    assert citation["collection"] == "M2TMNXSLV"
    assert citation["version"] == "5.12.4"
    assert citation["doi"] == "10.5067/AP1B0BA5PD2K"
    assert citation["source_type"] == "model_reanalysis"
    assert "reanalysis" in citation["scientific_note"].lower()


def test_manifest_conformance(adapter):
    """Test adapter metadata conforms to the committed d1_merra2.json manifest."""
    manifest_path = Path(__file__).resolve().parents[2] / "data" / "manifests" / "d1_merra2.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    citation = adapter.cite()
    assert citation["dataset_id"] == manifest["dataset_id"]
    assert citation["collection"] == manifest["collection"]
    assert citation["version"] == manifest["version"]
    assert citation["doi"] == manifest["provenance"]["doi"]
    assert citation["source_type"] == manifest["source_type"]
