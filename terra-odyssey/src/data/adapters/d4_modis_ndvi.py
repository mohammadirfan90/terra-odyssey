"""MODIS Vegetation Indices (NDVI) Ingestion Adapter (D4).

Dataset: MODIS/Terra Vegetation Indices Monthly L3 Global 1km (MOD13A3 v061).
Source Type: Satellite Retrieval / Derived Index (NASA LP DAAC).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import httpx
import numpy as np
import xarray as xr


class ModisNdviAdapter:
    """Ingestion and normalization adapter for NASA MODIS MOD13A3.061 NDVI product."""

    DATASET_ID = "D4"
    COLLECTION = "MOD13A3"
    VERSION = "061"
    SOURCE_TYPE = "satellite_derived_index"
    VARIABLE = "1_km_monthly_NDVI"
    CANONICAL_VARIABLE = "NDVI"
    DOI = "10.5067/MODIS/MOD13A3.061"
    CMR_ENDPOINT = "https://cmr.earthdata.nasa.gov/search/granules.json"
    FILL_VALUE = -3000.0
    SCALE_FACTOR = 0.0001
    VALID_RANGE = (-0.2, 1.0)

    def __init__(self, timeout: float = 30.0) -> None:
        """Initialize adapter with HTTP timeout configuration."""
        self.timeout = timeout

    def build_cmr_query_url(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
    ) -> str:
        """Construct the official NASA CMR search query URL."""
        base = f"{self.CMR_ENDPOINT}?short_name={self.COLLECTION}&version={self.VERSION}&page_size={limit}"
        if start_date and end_date:
            base += f"&temporal={start_date}T00:00:00Z,{end_date}T23:59:59Z"
        elif start_date:
            base += f"&temporal={start_date}T00:00:00Z,"
        return base

    def discover(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Query NASA CMR for available MOD13A3 granules."""
        url = self.build_cmr_query_url(start_date, end_date, limit)
        response = httpx.get(url, timeout=self.timeout)
        response.raise_for_status()
        data = response.json()
        entries = data.get("feed", {}).get("entry", [])
        granules = []
        for entry in entries:
            granule_id = entry.get("title", "")
            download_url = None
            for link in entry.get("links", []):
                if link.get("rel") == "http://esipfed.org/ns/fedsearch/1.1/data#":
                    download_url = link.get("href")
                    break
            granules.append({
                "granule_id": granule_id,
                "download_url": download_url,
                "time_start": entry.get("time_start"),
                "time_end": entry.get("time_end"),
            })
        return granules

    def decode(self, file_path_or_ds: Union[str, Path, xr.Dataset]) -> xr.Dataset:
        """Load NetCDF/HDF dataset and extract monthly NDVI variable."""
        if isinstance(file_path_or_ds, xr.Dataset):
            ds = file_path_or_ds
        else:
            ds = xr.open_dataset(Path(file_path_or_ds))

        # Accept either canonical or raw HDF variable naming
        matched_var = None
        for candidate in [self.VARIABLE, self.CANONICAL_VARIABLE, "NDVI", "1 km monthly NDVI"]:
            if candidate in ds.data_vars:
                matched_var = candidate
                break

        if matched_var is None:
            raise KeyError(
                f"NDVI variable not found in dataset. "
                f"Available variables: {list(ds.data_vars.keys())}"
            )

        if matched_var != self.CANONICAL_VARIABLE:
            ds = ds.rename({matched_var: self.CANONICAL_VARIABLE})

        return ds

    def validate_coordinates(self, ds: xr.Dataset) -> None:
        """Validate presence and bounds of spatial and temporal coordinates."""
        coords = set(ds.coords.keys()).union(ds.dims)
        lat_names = {"lat", "latitude"}
        lon_names = {"lon", "longitude"}
        time_names = {"time"}

        has_lat = bool(coords.intersection(lat_names))
        has_lon = bool(coords.intersection(lon_names))
        has_time = bool(coords.intersection(time_names))

        if not (has_lat and has_lon and has_time):
            raise ValueError(
                f"Missing required coordinates. Found: {list(coords)}. "
                "Expected latitude, longitude, and time coordinates."
            )

        lat_coord = next(c for c in coords if c in lat_names)
        lon_coord = next(c for c in coords if c in lon_names)

        lats = ds[lat_coord].values
        lons = ds[lon_coord].values

        if np.any(lats < -90.0) or np.any(lats > 90.0):
            raise ValueError(f"Latitude values out of range [-90, 90]: [{lats.min()}, {lats.max()}]")
        if np.any(lons < -180.0) or np.any(lons > 180.0):
            raise ValueError(f"Longitude values out of range [-180, 180]: [{lons.min()}, {lons.max()}]")

    def apply_quality_mask(self, ds: xr.Dataset) -> xr.Dataset:
        """Mask fill values (-3000) and unphysical values to NaN."""
        ds_masked = ds.copy()
        raw_vals = ds_masked[self.CANONICAL_VARIABLE].values.astype(np.float64)

        # Raw fill value in MOD13A3 is -3000
        is_fill = raw_vals <= self.FILL_VALUE
        raw_vals[is_fill] = np.nan

        ds_masked[self.CANONICAL_VARIABLE] = (ds_masked[self.CANONICAL_VARIABLE].dims, raw_vals)
        return ds_masked

    def convert_units(self, ds: xr.Dataset) -> xr.Dataset:
        """Apply scale factor (0.0001) to yield normalized NDVI in [-0.2, 1.0]."""
        ds_converted = ds.copy()
        raw_vals = ds_converted[self.CANONICAL_VARIABLE].values
        scaled_ndvi = raw_vals * self.SCALE_FACTOR

        # Mask any values outside physical NDVI range [-0.2, 1.0]
        invalid_physical = (scaled_ndvi < self.VALID_RANGE[0]) | (scaled_ndvi > self.VALID_RANGE[1])
        scaled_ndvi[invalid_physical] = np.nan

        ds_converted[self.CANONICAL_VARIABLE] = (ds_converted[self.CANONICAL_VARIABLE].dims, scaled_ndvi)
        ds_converted[self.CANONICAL_VARIABLE].attrs["units"] = "dimensionless"
        ds_converted[self.CANONICAL_VARIABLE].attrs["long_name"] = "Normalized Difference Vegetation Index (1km Monthly)"
        ds_converted[self.CANONICAL_VARIABLE].attrs["valid_range"] = list(self.VALID_RANGE)
        return ds_converted

    def process(self, file_path_or_ds: Union[str, Path, xr.Dataset]) -> xr.Dataset:
        """Execute full ingestion, validation, masking, and conversion pipeline."""
        ds = self.decode(file_path_or_ds)
        self.validate_coordinates(ds)
        ds_masked = self.apply_quality_mask(ds)
        ds_final = self.convert_units(ds_masked)
        return ds_final

    def get_citation_provenance(self) -> Dict[str, Any]:
        """Return standardized NASA provenance metadata."""
        return {
            "dataset_id": self.DATASET_ID,
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.CANONICAL_VARIABLE,
            "units": "dimensionless",
            "doi": self.DOI,
            "daac": "LP DAAC",
            "measurement": "Optical vegetation index retrieval (Terra MODIS)",
        }
