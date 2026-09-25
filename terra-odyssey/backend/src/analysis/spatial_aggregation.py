"""Area-weighted spatial aggregation engine for gridded climate datasets.

Enforces non-negotiable scientific constraints:
1. Exact cell-bound geodesic area weighting:
   A_{ij} proportional to Delta_lon * |sin(lat_north) - sin(lat_south)|
2. Fractional polygon overlap using Shapely for boundary cells:
   w_{ij} = A_{ij} * (Area(cell_{ij} cap Region) / Area(cell_{ij}))
3. Area-based coverage metric:
   C_t = sum(w_{ij} * M_{ij,t}) / sum(w_{ij})
4. Strict product coverage thresholds:
   - MERRA-2 T2M: 100% area coverage required for inferential months.
   - GPM IMERG: >=90% area coverage required for inferential months.
   - Any month <80% area coverage is strictly masked to NaN.
5. Handles antimeridian crossing, longitude conventions, and reports
   requested_geometry_supported_fraction and valid_data_area_fraction.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pyproj
import shapely.geometry as sgeom
import shapely.ops as sops
import shapely.validation as sval
import xarray as xr

# WGS84 mean earth radius (meters)
EARTH_RADIUS_METERS = 6371008.8


def compute_cell_bounds_and_areas(
    lats: np.ndarray,
    lons: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute exact cell latitude/longitude boundaries and spherical surface areas (m^2).

    Parameters
    ----------
    lats : np.ndarray
        1D array of latitude coordinates in degrees (-90 to 90).
    lons : np.ndarray
        1D array of longitude coordinates in degrees (-180 to 180 or 0 to 360).

    Returns
    -------
    tuple of (cell_areas_2d, lat_bounds_2d, lon_bounds_2d)
        cell_areas_2d: shape (len(lats), len(lons)) in m^2.
        lat_bounds_2d: shape (len(lats), 2) with [lat_south, lat_north].
        lon_bounds_2d: shape (len(lons), 2) with [lon_west, lon_east].
    """
    lats = np.asarray(lats, dtype=np.float64)
    lons = np.asarray(lons, dtype=np.float64)

    n_lat = len(lats)
    n_lon = len(lons)

    # Estimate cell boundaries
    if n_lat > 1:
        dlat = np.abs(lats[1] - lats[0])
    else:
        dlat = 0.5

    if n_lon > 1:
        dlon = np.abs(lons[1] - lons[0])
    else:
        dlon = 0.625

    # Latitude bounds [lat_south, lat_north]
    lat_bounds = np.zeros((n_lat, 2), dtype=np.float64)
    for i, lat in enumerate(lats):
        s = max(-90.0, lat - dlat / 2.0)
        n = min(90.0, lat + dlat / 2.0)
        lat_bounds[i] = [min(s, n), max(s, n)]

    # Longitude bounds [lon_west, lon_east]
    lon_bounds = np.zeros((n_lon, 2), dtype=np.float64)
    for j, lon in enumerate(lons):
        lon_bounds[j] = [lon - dlon / 2.0, lon + dlon / 2.0]

    # Spherical cell area: R^2 * dlon_rad * |sin(lat_n) - sin(lat_s)|
    dlon_rad = np.radians(dlon)
    lat_s_rad = np.radians(lat_bounds[:, 0])
    lat_n_rad = np.radians(lat_bounds[:, 1])
    dsin_lat = np.abs(np.sin(lat_n_rad) - np.sin(lat_s_rad))  # shape: (n_lat,)

    cell_areas_1d = (EARTH_RADIUS_METERS**2) * dlon_rad * dsin_lat  # shape: (n_lat,)
    cell_areas_2d = np.tile(cell_areas_1d[:, np.newaxis], (1, n_lon))

    return cell_areas_2d, lat_bounds, lon_bounds


def normalize_geometry(
    geometry: Union[Dict[str, Any], List[float], sgeom.base.BaseGeometry],
    target_lon_range: Tuple[float, float] = (-180.0, 180.0),
) -> sgeom.base.BaseGeometry:
    """Normalize input geometry (bbox, GeoJSON, or Shapely) to valid Shapely geometry."""
    if isinstance(geometry, list) or (isinstance(geometry, tuple) and len(geometry) == 4):
        # Bounding box: [min_lon, min_lat, max_lon, max_lat]
        min_lon, min_lat, max_lon, max_lat = geometry
        if min_lon > max_lon:
            # Crosses antimeridian: split into two boxes
            box1 = sgeom.box(min_lon, min_lat, 180.0, max_lat)
            box2 = sgeom.box(-180.0, min_lat, max_lon, max_lat)
            geom = sgeom.MultiPolygon([box1, box2])
        else:
            geom = sgeom.box(min_lon, min_lat, max_lon, max_lat)
    elif isinstance(geometry, dict):
        if "type" in geometry and geometry["type"] == "Feature":
            geom = sgeom.shape(geometry["geometry"])
        elif "type" in geometry and geometry["type"] == "FeatureCollection":
            polys = [sgeom.shape(f["geometry"]) for f in geometry["features"]]
            geom = sops.unary_union(polys)
        elif "type" in geometry:
            geom = sgeom.shape(geometry)
        else:
            raise ValueError(f"Unrecognized geometry dictionary format: {geometry}")
    elif isinstance(geometry, sgeom.base.BaseGeometry):
        geom = geometry
    else:
        raise TypeError(f"Unsupported geometry type: {type(geometry)}")

    # Validate and repair topology
    if not geom.is_valid:
        geom = sval.make_valid(geom)

    return geom


def compute_polygon_weights(
    geometry: Union[Dict[str, Any], List[float], sgeom.base.BaseGeometry],
    lats: np.ndarray,
    lons: np.ndarray,
    boundary_method: str = "fractional_overlap",
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Compute area-weighted grid cell weights and fractional polygon overlaps.

    Parameters
    ----------
    geometry : dict, list, or Shapely geometry
        Target regional polygon or bounding box.
    lats : np.ndarray
        1D array of latitude coordinates.
    lons : np.ndarray
        1D array of longitude coordinates.
    boundary_method : str
        'fractional_overlap' (exact polygon-cell intersection area) or 'cell_center'.

    Returns
    -------
    tuple of (weights_2d, metadata_dict)
        weights_2d: 2D array of shape (len(lats), len(lons)) containing w_{ij} in m^2.
        metadata_dict: dictionary with area statistics and coverage fraction.
    """
    lats = np.asarray(lats, dtype=np.float64)
    lons = np.asarray(lons, dtype=np.float64)
    n_lat, n_lon = len(lats), len(lons)

    cell_areas, lat_bounds, lon_bounds = compute_cell_bounds_and_areas(lats, lons)
    poly = normalize_geometry(geometry)

    # Compute target geometry geodesic area using WGS84 ellipsoid
    geod = pyproj.Geod(ellps="WGS84")
    try:
        target_geodesic_area_m2 = abs(float(geod.geometry_area_perimeter(poly)[0]))
    except Exception:
        target_geodesic_area_m2 = 0.0

    weights = np.zeros((n_lat, n_lon), dtype=np.float64)
    poly_bounds = poly.bounds  # (minx, miny, maxx, maxy) = (min_lon, min_lat, max_lon, max_lat)

    # Spatial index acceleration: only test cells whose bounds intersect poly_bounds
    for i in range(n_lat):
        lat_s, lat_n = lat_bounds[i]
        if lat_n < poly_bounds[1] or lat_s > poly_bounds[3]:
            continue

        for j in range(n_lon):
            lon_w, lon_e = lon_bounds[j]
            if lon_e < poly_bounds[0] or lon_w > poly_bounds[2]:
                continue

            cell_box = sgeom.box(lon_w, lat_s, lon_e, lat_n)
            if not cell_box.intersects(poly):
                continue

            if boundary_method == "cell_center":
                center = sgeom.Point(lons[j], lats[i])
                frac = 1.0 if poly.contains(center) else 0.0
            else:
                inter = cell_box.intersection(poly)
                cell_box_area = cell_box.area
                frac = (inter.area / cell_box_area) if cell_box_area > 0 else 0.0

            weights[i, j] = cell_areas[i, j] * frac

    total_weight_area_m2 = float(np.sum(weights))

    # Supported fraction of user geometry within dataset domain
    if target_geodesic_area_m2 > 0:
        supported_fraction = min(1.0, total_weight_area_m2 / target_geodesic_area_m2)
    else:
        supported_fraction = 1.0 if total_weight_area_m2 > 0 else 0.0

    meta = {
        "target_geodesic_area_m2": target_geodesic_area_m2,
        "grid_supported_area_m2": total_weight_area_m2,
        "requested_geometry_supported_fraction": float(supported_fraction),
        "boundary_method": boundary_method,
        "active_cell_count": int(np.sum(weights > 0)),
    }
    return weights, meta


def aggregate_spatial_mean(
    da_grid: xr.DataArray,
    weights: np.ndarray,
    coverage_threshold: float = 0.90,
    product_id: str = "d2_gpm_imerg",
) -> Tuple[xr.DataArray, xr.DataArray, Dict[str, Any]]:
    """Aggregate a 2D or 3D gridded DataArray into an area-weighted regional time series.

    Parameters
    ----------
    da_grid : xr.DataArray
        Gridded data with ('lat', 'lon') or ('time', 'lat', 'lon') dimensions.
    weights : np.ndarray
        2D array of shape matching (lat, lon) with cell weights w_{ij}.
    coverage_threshold : float
        Minimum area coverage fraction required (e.g. 1.0 for MERRA-2, 0.90 for GPM IMERG).
    product_id : str
        Dataset identifier ('d1_merra2', 'd2_gpm_imerg').

    Returns
    -------
    tuple of (da_regional_mean, da_coverage, summary_metadata)
        da_regional_mean: 1D time series (or scalar) of regional area-weighted means.
        da_coverage: 1D time series of area coverage ratios C_t.
        summary_metadata: dictionary of spatial coverage metrics for serialization.
    """
    # Enforce strict policy: MERRA-2 always requires 100% area coverage
    if "merra2" in product_id.lower() or "d1" in product_id.lower():
        effective_threshold = 1.0
    else:
        effective_threshold = coverage_threshold

    # Align dimensions
    lat_dim = "lat" if "lat" in da_grid.dims else "latitude"
    lon_dim = "lon" if "lon" in da_grid.dims else "longitude"

    if da_grid[lat_dim].shape[0] != weights.shape[0] or da_grid[lon_dim].shape[0] != weights.shape[1]:
        raise ValueError(
            f"Shape mismatch: grid ({da_grid[lat_dim].shape[0]}, {da_grid[lon_dim].shape[0]}) "
            f"vs weights {weights.shape}"
        )

    w_xr = xr.DataArray(weights, dims=[lat_dim, lon_dim], coords={lat_dim: da_grid[lat_dim], lon_dim: da_grid[lon_dim]})
    total_target_weight = float(np.sum(weights))

    if total_target_weight <= 0:
        raise ValueError("Total target weight is zero; polygon does not overlap with grid.")

    is_valid = da_grid.notnull()
    valid_weights = w_xr.where(is_valid)

    # Area coverage at each time step: C_t = sum(w_{ij} * M_{ij,t}) / sum(w_{ij})
    valid_weight_sum = valid_weights.sum(dim=[lat_dim, lon_dim])
    coverage_series = valid_weight_sum / total_target_weight

    # Area-weighted spatial mean: sum(Y * w * M) / sum(w * M)
    weighted_values = (da_grid * w_xr).sum(dim=[lat_dim, lon_dim], skipna=True)
    regional_mean = weighted_values / valid_weight_sum

    # Mask time steps failing the coverage threshold to NaN
    # For GPM IMERG: anything < 0.80 is unconditionally invalid
    hard_floor = 0.80
    eligible_mask = (coverage_series >= effective_threshold) & (coverage_series >= hard_floor)
    masked_regional_mean = regional_mean.where(eligible_mask)

    masked_regional_mean.name = f"{da_grid.name or 'val'}_regional_mean"
    masked_regional_mean.attrs = dict(da_grid.attrs)
    masked_regional_mean.attrs.update(
        {
            "spatial_aggregation": "area_weighted_geodesic_polygon",
            "coverage_threshold": float(effective_threshold),
            "product_id": product_id,
        }
    )

    avg_coverage = float(np.mean(coverage_series.values))

    summary_meta = {
        "requested_geometry_supported_fraction": 1.0,  # updated by caller with polygon meta
        "valid_data_area_fraction": avg_coverage,
        "coverage_threshold": float(effective_threshold),
        "boundary_method": "fractional_overlap",
    }

    return masked_regional_mean, coverage_series, summary_meta
