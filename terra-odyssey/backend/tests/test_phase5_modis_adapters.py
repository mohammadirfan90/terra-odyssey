"""Phase 5 unit tests: MODIS LST and NDVI adapter QA masking and aggregation.

All synthetic DataArrays are clearly labelled as test fixtures (synthetic_test_fixture=True).
Production code paths never use synthetic data (zero-mock scientific rule).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from data.adapters.d3_modis_lst import ModisLstAdapter
from data.adapters.d4_modis_ndvi import (
    ModisNdviAdapter,
    ANNUAL_MODE_CALENDAR,
    ANNUAL_MODE_GROWING_SEASON_NH,
    ANNUAL_MODE_GROWING_SEASON_SH,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_lst_da(
    n_times: int = 24,
    n_lat: int = 4,
    n_lon: int = 4,
    raw_value: float = 14000.0,  # ~7.0°C after scale (14000*0.02=280K; 280-273.15=6.85°C)
    seed: int = 0,
) -> xr.DataArray:
    """Synthetic 8-day composite LST DataArray (raw 16-bit integers before scaling)."""
    times = pd.date_range("2001-01-01", periods=n_times, freq="8D")
    lats = np.linspace(-5.0, 5.0, n_lat)
    lons = np.linspace(-5.0, 5.0, n_lon)
    rng = np.random.default_rng(seed)
    data = np.full((n_times, n_lat, n_lon), raw_value) + rng.normal(0, 50, size=(n_times, n_lat, n_lon))
    return xr.DataArray(
        data.astype(np.float64),
        dims=["time", "lat", "lon"],
        coords={"time": times, "lat": lats, "lon": lons},
        attrs={"units": "raw_int", "synthetic_test_fixture": True},
    )


def _make_ndvi_da(
    n_months: int = 36,
    n_lat: int = 4,
    n_lon: int = 4,
    raw_value: float = 4000.0,  # = 0.40 NDVI after scale (4000 * 0.0001)
    seed: int = 0,
) -> xr.DataArray:
    """Synthetic monthly NDVI DataArray (raw 16-bit integers before scaling)."""
    times = pd.date_range("2001-01-01", periods=n_months, freq="MS")
    lats = np.linspace(-5.0, 5.0, n_lat)
    lons = np.linspace(-5.0, 5.0, n_lon)
    rng = np.random.default_rng(seed)
    data = np.full((n_months, n_lat, n_lon), raw_value) + rng.normal(0, 100, size=(n_months, n_lat, n_lon))
    return xr.DataArray(
        data.astype(np.float64),
        dims=["time", "lat", "lon"],
        coords={"time": times, "lat": lats, "lon": lons},
        attrs={"units": "raw_int", "synthetic_test_fixture": True},
    )


# ── ModisLstAdapter tests ─────────────────────────────────────────────────────

class TestModisLstAdapterInit:
    def test_constants(self):
        a = ModisLstAdapter()
        assert a.SCALE_FACTOR == pytest.approx(0.02)
        assert a.KELVIN_OFFSET == pytest.approx(273.15)
        assert a.COLLECTION == "MOD11A2"
        assert a.VERSION == "061"

    def test_cite_has_required_fields(self):
        a = ModisLstAdapter()
        c = a.cite()
        assert "doi" in c
        assert "documentation" in c
        assert "collection" in c
        assert c["source_type"] == "satellite_retrieval"

    def test_cmr_url_contains_collection(self):
        a = ModisLstAdapter()
        url = a.build_cmr_query_url("2020-01-01", "2020-12-31")
        assert "MOD11A2" in url
        assert "temporal" in url


class TestModisLstQualityMask:
    def test_fill_value_masked_to_nan(self):
        """Raw integer 0 (fill) must become NaN after masking."""
        a = ModisLstAdapter()
        da = _make_lst_da(raw_value=0.0)  # all fill
        masked = a.apply_quality_mask(da)
        assert np.all(np.isnan(masked.values))

    def test_valid_raw_converted_to_celsius(self):
        """Raw 14000 → 14000 * 0.02 = 280 K → 280 - 273.15 = 6.85°C."""
        a = ModisLstAdapter()
        da = _make_lst_da(raw_value=14000.0)
        masked = a.apply_quality_mask(da)
        # With noise ~50 raw → ~1°C noise; centre should be close to 6.85
        mean_celsius = float(np.nanmean(masked.values))
        assert -10.0 < mean_celsius < 20.0
        assert masked.attrs["units"] == "degC"

    def test_unphysical_values_masked(self):
        """Values that map to < 200K or > 380K after scaling must become NaN."""
        a = ModisLstAdapter()
        # Raw 1 → 1 * 0.02 = 0.02 K — far below physical minimum
        da = _make_lst_da(raw_value=1.0)
        masked = a.apply_quality_mask(da)
        # All values should be NaN because 1 > FILL_VALUE=0 but 0.02K is unphysical
        assert np.all(np.isnan(masked.values))

    def test_qc_mask_rejects_cloud_pixels(self):
        """Pixels with QC bits 0-1 = 0b10 (cloud) must be masked to NaN."""
        a = ModisLstAdapter()
        da = _make_lst_da(raw_value=14000.0)
        # QC = 0b10 = 2 for all pixels → cloud → should all be masked
        qc_data = np.full(da.shape, 0b10, dtype=np.uint8)
        qc_da = xr.DataArray(qc_data, dims=da.dims, coords=da.coords)
        masked = a.apply_quality_mask(da, qc_da=qc_da)
        assert np.all(np.isnan(masked.values))

    def test_qc_good_pixels_kept(self):
        """Pixels with QC bits 0-1 = 0b00 (good) must be preserved."""
        a = ModisLstAdapter()
        da = _make_lst_da(raw_value=14000.0)
        qc_data = np.zeros(da.shape, dtype=np.uint8)  # 0b00 = good
        qc_da = xr.DataArray(qc_data, dims=da.dims, coords=da.coords)
        masked = a.apply_quality_mask(da, qc_da=qc_da)
        valid_count = int(np.sum(~np.isnan(masked.values)))
        assert valid_count > 0

    def test_scale_factor_applied(self):
        """Ensure scale factor of 0.02 is applied before Celsius conversion."""
        a = ModisLstAdapter()
        # Raw 15000 → 300 K → 26.85°C
        da = _make_lst_da(raw_value=15000.0, seed=999)
        da_no_noise = da.copy(data=np.full(da.shape, 15000.0))
        masked = a.apply_quality_mask(da_no_noise)
        expected = 15000.0 * 0.02 - 273.15
        assert float(np.nanmean(masked.values)) == pytest.approx(expected, abs=0.01)


class TestModisLstAnnualAggregation:
    def test_normalize_to_monthly_produces_monthly_coords(self):
        """normalize_to_monthly should produce monthly time coordinates."""
        a = ModisLstAdapter()
        da = _make_lst_da(n_times=48, raw_value=14000.0)
        masked = a.apply_quality_mask(da)
        monthly = a.normalize_to_monthly(masked)
        assert "time" in monthly.dims
        # All timestamps should be month-start
        assert all(pd.Timestamp(t).day == 1 for t in monthly.time.values)

    def test_aggregate_annual_below_min_months_is_nan(self):
        """Years with < min_months valid monthly values must be NaN."""
        a = ModisLstAdapter()
        # Build monthly data for 1 year with only 2 non-NaN months
        times = pd.date_range("2001-01-01", periods=12, freq="MS")
        data = np.full((12, 2, 2), np.nan)
        data[0, :, :] = 6.85   # January
        data[6, :, :] = 15.0   # July
        da = xr.DataArray(data, dims=["time", "lat", "lon"],
                          coords={"time": times, "lat": [0.0, 1.0], "lon": [0.0, 1.0]})
        annual = a.aggregate_annual_mean(da, min_months=6)
        # Only 2 valid months → below threshold of 6 → NaN
        assert np.all(np.isnan(annual.values))

    def test_aggregate_annual_enough_months_not_nan(self):
        """Years with >= min_months valid monthly values must be non-NaN."""
        a = ModisLstAdapter()
        times = pd.date_range("2001-01-01", periods=12, freq="MS")
        data = np.full((12, 2, 2), 15.0)  # all 12 months valid
        da = xr.DataArray(data, dims=["time", "lat", "lon"],
                          coords={"time": times, "lat": [0.0, 1.0], "lon": [0.0, 1.0]})
        annual = a.aggregate_annual_mean(da, min_months=6)
        assert np.all(~np.isnan(annual.values))
        assert float(annual.values.mean()) == pytest.approx(15.0, abs=0.01)


# ── ModisNdviAdapter tests ────────────────────────────────────────────────────

class TestModisNdviAdapterInit:
    def test_constants(self):
        a = ModisNdviAdapter()
        assert a.SCALE_FACTOR == pytest.approx(0.0001)
        assert a.VALID_RANGE == (-0.2, 1.0)
        assert a.COLLECTION == "MOD13A3"
        assert a.VERSION == "061"

    def test_cite_has_required_fields(self):
        a = ModisNdviAdapter()
        c = a.cite()
        assert "doi" in c
        assert "documentation" in c
        assert "collection" in c
        assert c["source_type"] == "satellite_derived_index"

    def test_cmr_url_contains_collection(self):
        a = ModisNdviAdapter()
        url = a.build_cmr_query_url("2020-01-01", "2020-12-31")
        assert "MOD13A3" in url
        assert "temporal" in url


class TestModisNdviQualityMask:
    def test_fill_value_masked_to_nan(self):
        """Raw integer exactly at fill (-3000) must become NaN after masking."""
        a = ModisNdviAdapter()
        # Use exact fill value with NO noise so every pixel triggers the mask
        da = _make_ndvi_da(raw_value=-3000.0, seed=0)
        da_exact = da.copy(data=np.full(da.shape, -3000.0))
        masked = a.apply_quality_mask(da_exact)
        assert np.all(np.isnan(masked.values))

    def test_valid_raw_converted_correctly(self):
        """Raw 4000 → fill+QC mask → convert_units → 0.40 NDVI."""
        a = ModisNdviAdapter()
        da = _make_ndvi_da(raw_value=4000.0, seed=999)
        da_clean = da.copy(data=np.full(da.shape, 4000.0))
        masked = a.apply_quality_mask(da_clean)   # fill mask only, still 4000.0
        scaled = a.convert_units(masked)           # 4000.0 * 0.0001 = 0.40
        assert float(np.nanmean(scaled.values)) == pytest.approx(0.40, abs=0.001)
        assert scaled.attrs["units"] == "dimensionless"

    def test_out_of_range_values_masked(self):
        """Values outside [-0.2, 1.0] after scaling must become NaN."""
        a = ModisNdviAdapter()
        # Raw 15000 → 1.5 NDVI after scale — above physical maximum
        da = _make_ndvi_da(raw_value=15000.0)
        masked = a.apply_quality_mask(da)   # fill mask only
        scaled = a.convert_units(masked)    # 15000 * 0.0001 = 1.5 → masked out
        assert np.all(np.isnan(scaled.values))

    def test_vi_quality_bad_pixels_masked(self):
        """VI_Quality bits 0-1 = 0b11 must be masked."""
        a = ModisNdviAdapter()
        da = _make_ndvi_da(raw_value=4000.0)
        qc_data = np.full(da.shape, 0b11, dtype=np.uint16)  # all bad
        qc_da = xr.DataArray(qc_data, dims=da.dims, coords=da.coords)
        masked = a.apply_quality_mask(da, vi_quality_da=qc_da)
        assert np.all(np.isnan(masked.values))

    def test_vi_quality_good_pixels_kept(self):
        """VI_Quality bits 0-1 = 0b00 must be preserved."""
        a = ModisNdviAdapter()
        da = _make_ndvi_da(raw_value=4000.0)
        qc_data = np.zeros(da.shape, dtype=np.uint16)  # 0b00 = good
        qc_da = xr.DataArray(qc_data, dims=da.dims, coords=da.coords)
        masked = a.apply_quality_mask(da, vi_quality_da=qc_da)
        valid_count = int(np.sum(~np.isnan(masked.values)))
        assert valid_count > 0

    def test_scale_factor_applied(self):
        """Ensure scale factor 0.0001 is applied in convert_units."""
        a = ModisNdviAdapter()
        da = _make_ndvi_da(raw_value=7500.0)
        da_clean = da.copy(data=np.full(da.shape, 7500.0))
        masked = a.apply_quality_mask(da_clean)  # still raw 7500.0
        scaled = a.convert_units(masked)          # 7500.0 * 0.0001 = 0.75
        expected = 7500.0 * 0.0001
        assert float(np.nanmean(scaled.values)) == pytest.approx(expected, abs=1e-6)


class TestModisNdviAnnualAggregation:
    def _make_monthly_scaled(self, n_months=36, ndvi_val=0.5, seed=0):
        """Already-scaled monthly NDVI DataArray for aggregation tests."""
        times = pd.date_range("2001-01-01", periods=n_months, freq="MS")
        rng = np.random.default_rng(seed)
        data = np.full((n_months, 2, 2), ndvi_val) + rng.normal(0, 0.01, (n_months, 2, 2))
        return xr.DataArray(
            data,
            dims=["time", "lat", "lon"],
            coords={"time": times, "lat": [0.0, 1.0], "lon": [0.0, 1.0]},
            attrs={"synthetic_test_fixture": True},
        )

    def test_calendar_year_mode_uses_all_12_months(self):
        a = ModisNdviAdapter()
        da = self._make_monthly_scaled(n_months=24, ndvi_val=0.5)
        annual = a.aggregate_annual_mean(da, season=ANNUAL_MODE_CALENDAR, min_months=3)
        assert annual.attrs["season_mode"] == ANNUAL_MODE_CALENDAR
        # Should have 2 complete years
        assert len(annual["year"]) == 2

    def test_nh_growing_season_uses_apr_oct(self):
        a = ModisNdviAdapter()
        da = self._make_monthly_scaled(n_months=24, ndvi_val=0.5)
        annual = a.aggregate_annual_mean(da, season=ANNUAL_MODE_GROWING_SEASON_NH, min_months=3)
        assert annual.attrs["season_mode"] == ANNUAL_MODE_GROWING_SEASON_NH

    def test_below_min_months_is_nan(self):
        a = ModisNdviAdapter()
        # Only Jan–Feb valid in each year → 2 months → below min_months=3
        times = pd.date_range("2001-01-01", periods=12, freq="MS")
        data = np.full((12, 2, 2), np.nan)
        data[0, :, :] = 0.4  # Jan
        data[1, :, :] = 0.5  # Feb
        da = xr.DataArray(data, dims=["time", "lat", "lon"],
                          coords={"time": times, "lat": [0.0, 1.0], "lon": [0.0, 1.0]})
        annual = a.aggregate_annual_mean(da, season=ANNUAL_MODE_CALENDAR, min_months=3)
        assert np.all(np.isnan(annual.values))

    def test_enough_months_gives_valid_mean(self):
        a = ModisNdviAdapter()
        da = self._make_monthly_scaled(n_months=12, ndvi_val=0.6)
        annual = a.aggregate_annual_mean(da, season=ANNUAL_MODE_CALENDAR, min_months=3)
        assert not np.all(np.isnan(annual.values))
        assert float(np.nanmean(annual.values)) == pytest.approx(0.6, abs=0.05)

    def test_missing_months_never_zero_filled(self):
        """Strictly verify that NaN months are not treated as zero in annual mean."""
        a = ModisNdviAdapter()
        times = pd.date_range("2001-01-01", periods=12, freq="MS")
        data = np.full((12, 1, 1), np.nan)
        # Only 4 summer months with value 0.8
        for m in [5, 6, 7, 8]:  # May, Jun, Jul, Aug (indices 4,5,6,7)
            data[m - 1, 0, 0] = 0.8
        da = xr.DataArray(data, dims=["time", "lat", "lon"],
                          coords={"time": times, "lat": [0.0], "lon": [0.0]})
        annual = a.aggregate_annual_mean(da, season=ANNUAL_MODE_CALENDAR, min_months=3)
        # Mean should be ~0.8, not pulled toward 0 by NaN months
        assert float(np.nanmean(annual.values)) == pytest.approx(0.8, abs=0.01)
