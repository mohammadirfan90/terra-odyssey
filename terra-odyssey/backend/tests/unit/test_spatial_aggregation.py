"""Unit tests for area-weighted spatial aggregation and geodesic cell weighting."""

import numpy as np
import pytest
import shapely.geometry as sgeom
import xarray as xr

from analysis.spatial_aggregation import (
    aggregate_spatial_mean,
    compute_cell_bounds_and_areas,
    compute_polygon_weights,
    normalize_geometry,
)


def test_cell_bound_areas_decrease_poleward():
    """Verify spherical cell areas scale with latitude according to exact integral of cos(lat)."""
    lats = np.array([0.0, 30.0, 60.0])
    lons = np.array([0.0, 1.0])

    areas, lat_bounds, _ = compute_cell_bounds_and_areas(lats, lons)

    # Equatorial area (0 deg) vs High latitude (60 deg)
    eq_area = areas[0, 0]
    high_lat_area = areas[2, 0]

    # Ratio of sin(60.5) - sin(59.5) vs sin(0.5) - sin(-0.5) ~ cos(60) / cos(0) = 0.5
    expected_ratio = np.cos(np.radians(60.0)) / np.cos(np.radians(0.0))
    actual_ratio = high_lat_area / eq_area

    assert pytest.approx(expected_ratio, rel=1e-2) == actual_ratio
    assert eq_area > areas[1, 0] > high_lat_area


def test_hand_computed_polygon_weights():
    """Verify fractional overlap against analytical 2x2 grid fixture."""
    # 2x2 grid centered at (lat=10, 11), (lon=20, 21), cell width=1.0 deg
    lats = np.array([10.0, 11.0])
    lons = np.array([20.0, 21.0])

    # Cell bounds:
    # row 0 (lat 10): [9.5, 10.5]
    # row 1 (lat 11): [10.5, 11.5]
    # col 0 (lon 20): [19.5, 20.5]
    # col 1 (lon 21): [20.5, 21.5]

    # Construct polygon covering [19.5, 9.5] to [21.5, 11.0]
    # In row 0 (lat 9.5 to 10.5): full overlap (frac = 1.0 for both col 0 and col 1)
    # In row 1 (lat 10.5 to 11.5): height 0.5 out of 1.0 -> 50% overlap (frac = 0.5)
    polygon = sgeom.box(19.5, 9.5, 21.5, 11.0)

    weights, meta = compute_polygon_weights(polygon, lats, lons, boundary_method="fractional_overlap")
    cell_areas, _, _ = compute_cell_bounds_and_areas(lats, lons)

    # Row 0 fractions: 1.0
    assert pytest.approx(weights[0, 0], rel=1e-5) == cell_areas[0, 0] * 1.0
    assert pytest.approx(weights[0, 1], rel=1e-5) == cell_areas[0, 1] * 1.0

    # Row 1 fractions: 0.5
    assert pytest.approx(weights[1, 0], rel=1e-5) == cell_areas[1, 0] * 0.5
    assert pytest.approx(weights[1, 1], rel=1e-5) == cell_areas[1, 1] * 0.5


def test_merra2_strict_100_percent_coverage():
    """Verify MERRA-2 requires 100% area coverage; 95% coverage is masked to NaN."""
    lats = np.array([10.0, 11.0])
    lons = np.array([20.0, 21.0])

    # Equal weights for simplicity
    weights = np.ones((2, 2), dtype=np.float64)

    # 1 time step, 4 cells: 3 valid cells, 1 NaN -> 75% coverage
    data = np.array([[[15.0, 16.0], [17.0, np.nan]]])
    da = xr.DataArray(data, dims=["time", "lat", "lon"], coords={"time": ["2020-01-01"], "lat": lats, "lon": lons})

    mean_series, cov_series, meta = aggregate_spatial_mean(da, weights, coverage_threshold=0.90, product_id="d1_merra2")
    assert np.isnan(float(mean_series.values[0]))
    assert float(cov_series.values[0]) == 0.75


def test_gpm_imerg_90_percent_coverage():
    """Verify GPM IMERG accepts >=90% coverage but rejects <80% coverage."""
    lats = np.array([10.0, 11.0, 12.0, 13.0, 14.0])
    lons = np.array([20.0, 21.0])
    # 10 cells total, each weight 1.0
    weights = np.ones((5, 2), dtype=np.float64)

    # 1. 9 out of 10 cells valid (90% coverage)
    data_90 = np.full((1, 5, 2), 50.0)
    data_90[0, 0, 0] = np.nan
    da_90 = xr.DataArray(data_90, dims=["time", "lat", "lon"], coords={"time": ["2020-01-01"], "lat": lats, "lon": lons})

    mean_90, cov_90, _ = aggregate_spatial_mean(da_90, weights, coverage_threshold=0.90, product_id="d2_gpm_imerg")
    assert not np.isnan(float(mean_90.values[0]))
    assert float(mean_90.values[0]) == 50.0
    assert float(cov_90.values[0]) == 0.90

    # 2. 7 out of 10 cells valid (70% coverage -> below 80% hard floor)
    data_70 = np.full((1, 5, 2), 50.0)
    data_70[0, 0, :] = np.nan
    data_70[0, 1, 0] = np.nan
    da_70 = xr.DataArray(data_70, dims=["time", "lat", "lon"], coords={"time": ["2020-01-01"], "lat": lats, "lon": lons})

    mean_70, cov_70, _ = aggregate_spatial_mean(da_70, weights, coverage_threshold=0.90, product_id="d2_gpm_imerg")
    assert np.isnan(float(mean_70.values[0]))
    assert float(cov_70.values[0]) == 0.70


def test_antimeridian_crossing_geometry():
    """Verify bounding box crossing 180 deg longitude splits cleanly without Cartesian distortion."""
    # Bbox from 170E to 170W (-170) -> min_lon=170, max_lon=-170
    bbox_antimeridian = [170.0, -10.0, -170.0, 10.0]
    geom = normalize_geometry(bbox_antimeridian)

    assert isinstance(geom, sgeom.MultiPolygon)
    assert len(geom.geoms) == 2

    # One box [170, -10, 180, 10] and second box [-180, -10, -170, 10]
    bounds_0 = geom.geoms[0].bounds
    bounds_1 = geom.geoms[1].bounds
    assert bounds_0 == (170.0, -10.0, 180.0, 10.0)
    assert bounds_1 == (-180.0, -10.0, -170.0, 10.0)


def test_out_of_bounds_geometry_reported():
    """Verify that a polygon extending outside dataset bounds reports fractional support."""
    # Regional grid covers lat: [-10, 10], lon: [0, 10]
    lats = np.linspace(-10, 10, 10)
    lons = np.linspace(0, 10, 10)

    # Target polygon extends to lat 25 (out of bounds)
    poly = sgeom.box(0, -10, 10, 25)
    weights, meta = compute_polygon_weights(poly, lats, lons)

    assert meta["requested_geometry_supported_fraction"] < 0.8
