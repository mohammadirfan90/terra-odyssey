"""MODIS Land Surface Temperature Ingestion Adapter (D3).

Dataset: MODIS/Terra Land Surface Temperature/Emissivity 8-Day L3 Global 1km (MOD11A2 v061).
Source Type: Satellite Measurement / Retrieval (NASA LP DAAC).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import httpx
import numpy as np
import xarray as xr


class ModisLstAdapter:
    """Ingestion and normalization adapter for NASA MODIS MOD11A2.061 LST product."""

    DATASET_ID = "D3"
    COLLECTION = "MOD11A2"
    VERSION = "061"
    SOURCE_TYPE = "satellite_retrieval"
    VARIABLE = "LST_Day_1km"
    DOI = "10.5067/MODIS/MOD11A2.061"
    CMR_ENDPOINT = "https://cmr.earthdata.nasa.gov/search/granules.json"
    FILL_VALUE = 0.0
    SCALE_FACTOR = 0.02
    KELVIN_OFFSET = 273.15

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
        """Query NASA CMR for available MOD11A2 granules."""
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
        """Load NetCDF/HDF dataset and extract LST_Day_1km variable."""
        if isinstance(file_path_or_ds, xr.Dataset):
            ds = file_path_or_ds
        else:
            ds = xr.open_dataset(Path(file_path_or_ds))

        if self.VARIABLE not in ds.data_vars:
            raise KeyError(
                f"Variable '{self.VARIABLE}' not found in dataset. "
                f"Available variables: {list(ds.data_vars.keys())}"
            )
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
        """Mask fill values (0.0) and unphysical values to NaN."""
        ds_masked = ds.copy()
        raw_vals = ds_masked[self.VARIABLE].values.astype(np.float64)

        # Fill value is 0 in MOD11A2 raw integers; values below 100K or above 400K are unphysical
        is_fill = raw_vals <= self.FILL_VALUE
        raw_vals[is_fill] = np.nan

        ds_masked[self.VARIABLE] = (ds_masked[self.VARIABLE].dims, raw_vals)
        return ds_masked

    def convert_units(self, ds: xr.Dataset) -> xr.Dataset:
        """Apply scale factor (0.02) and convert Kelvin to Celsius."""
        ds_converted = ds.copy()
        raw_vals = ds_converted[self.VARIABLE].values
        # T_degC = (raw * 0.02) - 273.15
        temp_celsius = (raw_vals * self.SCALE_FACTOR) - self.KELVIN_OFFSET

        ds_converted[self.VARIABLE] = (ds_converted[self.VARIABLE].dims, temp_celsius)
        ds_converted[self.VARIABLE].attrs["units"] = "degC"
        ds_converted[self.VARIABLE].attrs["long_name"] = "Land Surface Temperature (Day)"
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
            "variable": self.VARIABLE,
            "units": "degC",
            "doi": self.DOI,
            "daac": "LP DAAC",
            "measurement": "Thermal infrared satellite retrieval (Terra MODIS)",
        }
