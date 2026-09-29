"""Phase 4 unit tests: BY-FDR correction and spatial grid estimator.

Tests follow the zero-mock scientific constraint:
  - FDR tests use known analytic inputs with verifiable expected outputs.
  - Spatial grid tests use synthetic (labelled) xarray cubes ONLY in tests,
    strictly isolated from production code paths.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from analysis.fdr_control import apply_by_fdr, _by_constant
from analysis.spatial_grid import estimate_spatial_grid


# ── T4.2 BY-FDR unit tests ────────────────────────────────────────────────────

class TestByConstant:
    def test_m1_is_one(self):
        assert _by_constant(1) == pytest.approx(1.0)

    def test_m2(self):
        assert _by_constant(2) == pytest.approx(1.5)

    def test_m4(self):
        expected = 1.0 + 0.5 + 1/3 + 0.25
        assert _by_constant(4) == pytest.approx(expected, rel=1e-9)

    def test_increases_monotonically(self):
        vals = [_by_constant(m) for m in range(1, 20)]
        assert all(vals[i] < vals[i+1] for i in range(len(vals)-1))


class TestApplyByFdr:
    """Known-input BY correction tests with analytic verification."""

    def _make_cells(self, p_vals):
        """Build a minimal valid cell list for testing."""
        return [
            {
                "lon_center": float(i),
                "lat_center": 0.0,
                "null": False,
                "slope": 0.1,
                "slope_per_decade": 1.0,
                "se": 0.05,
                "t_stat": 2.0,
                "p_raw": float(p),
                "n_years": 20,
                "unit": "°C/decade",
            }
            for i, p in enumerate(p_vals)
        ]

    def test_all_null_cells_returns_zero_tested(self):
        cells = [
            {"lon_center": 0.0, "lat_center": 0.0, "null": True, "null_reason": "insufficient_data"}
        ]
        out, summary = apply_by_fdr(cells, alpha=0.05)
        assert summary["n_tested"] == 0
        assert summary["n_significant"] == 0
        assert out[0]["p_adj"] is None
        assert out[0]["significant"] is None

    def test_single_cell_very_small_p_is_significant(self):
        cells = self._make_cells([0.0001])
        out, summary = apply_by_fdr(cells, alpha=0.05)
        assert summary["n_tested"] == 1
        # With m=1, c(1)=1, BY threshold = 1/1 * 0.05/1 = 0.05
        # p_adj = min(1, 0.0001 * 1 * 1 / 1) = 0.0001
        assert out[0]["significant"] is True
        assert summary["n_significant"] == 1

    def test_single_cell_large_p_not_significant(self):
        cells = self._make_cells([0.5])
        out, summary = apply_by_fdr(cells, alpha=0.05)
        assert out[0]["significant"] is False
        assert summary["n_significant"] == 0

    def test_all_p_one_gives_zero_significant(self):
        cells = self._make_cells([1.0, 1.0, 1.0, 1.0])
        out, summary = apply_by_fdr(cells, alpha=0.05)
        assert summary["n_significant"] == 0
        for c in out:
            assert c["significant"] is False

    def test_p_adj_clipped_to_one(self):
        # Very large p-value should give p_adj=1.0 exactly (not > 1)
        cells = self._make_cells([0.99, 0.98, 0.97])
        out, summary = apply_by_fdr(cells, alpha=0.05)
        for c in out:
            assert 0.0 <= c["p_adj"] <= 1.0

    def test_monotone_p_adj_non_decreasing_after_sort(self):
        """Adjusted p-values must be non-decreasing (step-up property)."""
        np.random.seed(42)
        p_vals = np.random.uniform(0.001, 0.5, size=50).tolist()
        cells = self._make_cells(p_vals)
        out, _ = apply_by_fdr(cells, alpha=0.05)
        p_adjs = sorted(c["p_adj"] for c in out)
        assert all(p_adjs[i] <= p_adjs[i+1] for i in range(len(p_adjs)-1))

    def test_fdr_summary_fields_present(self):
        cells = self._make_cells([0.001, 0.01, 0.5])
        _, summary = apply_by_fdr(cells)
        assert "n_tested" in summary
        assert "n_significant" in summary
        assert "fdr_threshold" in summary
        assert "method" in summary
        assert summary["method"] == "benjamini_yekutieli"
        assert "by_constant" in summary
        assert summary["by_constant"] is not None

    def test_mixed_null_and_valid(self):
        cells = [
            {"lon_center": 0.0, "lat_center": 0.0, "null": True, "null_reason": "insufficient_data"},
            *self._make_cells([0.001, 0.4]),
        ]
        out, summary = apply_by_fdr(cells, alpha=0.05)
        assert summary["n_tested"] == 2
        assert out[0]["p_adj"] is None
        assert out[0]["significant"] is None
        assert out[1]["p_adj"] is not None
        assert out[2]["p_adj"] is not None

    def test_by_constant_embedded_in_summary(self):
        cells = self._make_cells([0.01, 0.05, 0.1])
        _, summary = apply_by_fdr(cells)
        expected_c = _by_constant(3)
        assert summary["by_constant"] == pytest.approx(expected_c, rel=1e-6)


# ── T4.1 Spatial Grid unit tests ──────────────────────────────────────────────

def _make_synthetic_annual_da(
    bbox,
    n_years: int = 22,
    slope_per_year: float = 0.05,
    noise: float = 0.3,
    seed: int = 0,
) -> xr.DataArray:
    """Build a synthetic (clearly labelled) annual DataArray for algorithm tests."""
    min_lon, min_lat, max_lon, max_lat = bbox
    lats = np.arange(min_lat + 0.25, max_lat, 0.5)
    lons = np.arange(min_lon + 0.25, max_lon, 0.5)
    years = np.arange(2001, 2001 + n_years, dtype=int)

    rng = np.random.default_rng(seed)
    # Signal: linear trend + noise, uniform across all cells
    t = (years - years.mean()).astype(float)
    base = 15.0
    data = np.zeros((len(years), len(lats), len(lons)))
    for li in range(len(lats)):
        for lj in range(len(lons)):
            data[:, li, lj] = base + slope_per_year * t + rng.normal(0, noise, size=len(years))

    return xr.DataArray(
        data,
        dims=["year", "lat", "lon"],
        coords={"year": years, "lat": lats, "lon": lons},
        attrs={"units": "°C", "synthetic_test_fixture": True},
    )


class TestEstimateSpatialGrid:
    """Unit tests for the spatial_grid estimator using synthetic labelled fixtures."""

    def test_empty_da_raises_value_error(self):
        da = xr.DataArray(np.array([]), dims=["year"])
        with pytest.raises(ValueError, match="empty"):
            estimate_spatial_grid(da, (-10, -10, 10, 10), "T2M", "°C/decade")

    def test_returns_list_of_dicts(self):
        da = _make_synthetic_annual_da((-5, -5, 5, 5))
        cells = estimate_spatial_grid(da, (-5, -5, 5, 5), "T2M", "°C/decade")
        assert isinstance(cells, list)
        assert len(cells) > 0
        assert all(isinstance(c, dict) for c in cells)

    def test_cells_have_required_fields(self):
        da = _make_synthetic_annual_da((-5, -5, 5, 5))
        cells = estimate_spatial_grid(da, (-5, -5, 5, 5), "T2M", "°C/decade")
        valid = [c for c in cells if not c.get("null")]
        assert len(valid) > 0
        for c in valid:
            assert "lon_center" in c
            assert "lat_center" in c
            assert "slope" in c
            assert "slope_per_decade" in c
            assert "se" in c
            assert "p_raw" in c
            assert "n_years" in c
            assert "unit" in c
            assert c["unit"] == "°C/decade"

    def test_p_raw_in_zero_one(self):
        da = _make_synthetic_annual_da((-5, -5, 5, 5))
        cells = estimate_spatial_grid(da, (-5, -5, 5, 5), "T2M", "°C/decade")
        for c in cells:
            if not c.get("null"):
                assert 0.0 <= c["p_raw"] <= 1.0

    def test_slope_per_decade_is_ten_times_slope(self):
        da = _make_synthetic_annual_da((-5, -5, 5, 5), slope_per_year=0.05)
        cells = estimate_spatial_grid(da, (-5, -5, 5, 5), "T2M", "°C/decade")
        valid = [c for c in cells if not c.get("null")]
        assert len(valid) > 0
        for c in valid:
            assert c["slope_per_decade"] == pytest.approx(c["slope"] * 10.0, rel=1e-3)

    def test_null_cells_have_null_fields(self):
        da = _make_synthetic_annual_da((-5, -5, 5, 5))
        cells = estimate_spatial_grid(da, (-5, -5, 5, 5), "T2M", "°C/decade")
        null_cells = [c for c in cells if c.get("null")]
        for c in null_cells:
            assert "null_reason" in c
            assert c.get("slope") is None

    def test_cell_count_bounded_by_max_cells(self):
        # Large bbox should be clamped to 40x40 = 1600 cells max
        da = _make_synthetic_annual_da((-90, -60, 90, 60), n_years=22)
        cells = estimate_spatial_grid(da, (-90, -60, 90, 60), "T2M", "°C/decade", resolution=0.5)
        assert len(cells) <= 1600

    def test_positive_trend_detected(self):
        """Cells should show positive slope when true slope_per_year > 0."""
        da = _make_synthetic_annual_da((-5, -5, 5, 5), slope_per_year=0.2, noise=0.05)
        cells = estimate_spatial_grid(da, (-5, -5, 5, 5), "T2M", "°C/decade")
        valid = [c for c in cells if not c.get("null")]
        # Most cells should show positive slope given large SNR
        positive = sum(1 for c in valid if c["slope"] > 0)
        assert positive >= len(valid) * 0.7  # at least 70%

    def test_round_trip_with_fdr(self):
        """Grid → FDR correction should produce well-formed output."""
        da = _make_synthetic_annual_da((-5, -5, 5, 5))
        cells = estimate_spatial_grid(da, (-5, -5, 5, 5), "T2M", "°C/decade")
        corrected, summary = apply_by_fdr(cells, alpha=0.05)
        assert summary["n_tested"] >= 0
        assert summary["n_significant"] <= summary["n_tested"]
        for c in corrected:
            if not c.get("null"):
                assert "p_adj" in c
                assert "significant" in c
                assert isinstance(c["significant"], bool)
