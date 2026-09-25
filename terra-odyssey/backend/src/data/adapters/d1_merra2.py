"""MERRA-2 2-Meter Air Temperature Ingestion Adapter (D1).

Dataset: MERRA-2 monthly mean 2-meter air temperature (M2TMNXSLV v5.12.4).
Source Type: Model Reanalysis (NASA GMAO / GES DISC).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import httpx
import numpy as np
import xarray as xr


class Merra2Adapter:
    """Ingestion and normalization adapter for NASA MERRA-2 T2M product."""

    DATASET_ID = "D1"
    COLLECTION = "M2TMNXSLV"
    VERSION = "5.12.4"
    SOURCE_TYPE = "model_reanalysis"
    VARIABLE = "T2M"
    DOI = "10.5067/AP1B0BA5PD2K"
    CMR_ENDPOINT = "https://cmr.earthdata.nasa.gov/search/granules.json"
    FILL_VALUE_THRESHOLD = 1.0e14
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
        """Query NASA CMR for available MERRA-2 granules."""
        url = self.build_cmr_query_url(start_date, end_date, limit)
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url)
                response.raise_for_status()
                data = response.json()
        except Exception as exc:
            raise RuntimeError(f"NASA CMR metadata query failed: {exc}") from exc

        entries = data.get("feed", {}).get("entry", [])
        granules: List[Dict[str, Any]] = []
        for entry in entries:
            urls = [
                link.get("href")
                for link in entry.get("links", [])
                if link.get("rel") == "http://esipfed.org/ns/fedsearch/1.1/data#"
                or link.get("href", "").endswith((".nc", ".nc4"))
            ]
            granules.append(
                {
                    "title": entry.get("title"),
                    "granule_ur": entry.get("producer_granule_id") or entry.get("id"),
                    "time_start": entry.get("time_start"),
                    "time_end": entry.get("time_end"),
                    "download_urls": urls,
                    "dataset_id": self.DATASET_ID,
                    "collection": self.COLLECTION,
                }
            )
        return granules

    def decode(
        self, dataset_or_path: Union[str, Path, xr.Dataset]
    ) -> xr.DataArray:
        """Decode netCDF4 dataset or open file and extract T2M variable."""
        if isinstance(dataset_or_path, xr.Dataset):
            ds = dataset_or_path
        else:
            ds = xr.open_dataset(dataset_or_path, engine="netcdf4")

        if self.VARIABLE not in ds:
            raise KeyError(
                f"Variable '{self.VARIABLE}' not found in dataset. Available: {list(ds.data_vars)}"
            )

        da = ds[self.VARIABLE]
        return da

    def validate(self, da: xr.DataArray) -> bool:
        """Validate coordinates, spatial ranges, and dimensions."""
        dims = set(da.dims)
        lat_coord = None
        lon_coord = None

        for name in ("lat", "latitude"):
            if name in da.coords:
                lat_coord = da.coords[name]
                break
        for name in ("lon", "longitude"):
            if name in da.coords:
                lon_coord = da.coords[name]
                break

        if lat_coord is None or lon_coord is None:
            raise ValueError(
                f"Missing spatial coordinates. Found: {list(da.coords.keys())}"
            )

        lat_min, lat_max = float(lat_coord.min()), float(lat_coord.max())
        lon_min, lon_max = float(lon_coord.min()), float(lon_coord.max())

        if lat_min < -90.0 or lat_max > 90.0:
            raise ValueError(
                f"Latitude out of bounds [-90, 90]: [{lat_min}, {lat_max}]"
            )
        if lon_min < -180.0 or lon_max > 360.0:
            raise ValueError(
                f"Longitude out of bounds [-180, 180]: [{lon_min}, {lon_max}]"
            )

        return True

    def quality_mask(self, da: xr.DataArray) -> xr.DataArray:
        """Mask source fill values (>= 1.0e14) to NaN."""
        masked = da.where(da < self.FILL_VALUE_THRESHOLD, other=np.nan)
        return masked

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        """Convert temperature values from Kelvin to Celsius: T_C = T_K - 273.15."""
        celsius = da - self.KELVIN_OFFSET
        celsius.attrs = dict(da.attrs)
        celsius.attrs["units"] = "degC"
        celsius.attrs["long_name"] = "2-meter air temperature"
        celsius.attrs["source_type"] = self.SOURCE_TYPE
        return celsius

    def process(
        self, dataset_or_path: Union[str, Path, xr.Dataset]
    ) -> xr.DataArray:
        """Execute complete normalization pipeline: decode -> validate -> mask -> convert."""
        da = self.decode(dataset_or_path)
        self.validate(da)
        masked = self.quality_mask(da)
        celsius = self.convert_units(masked)
        return celsius

    def cite(self) -> Dict[str, Any]:
        """Return canonical citation and provenance metadata."""
        return {
            "dataset_id": self.DATASET_ID,
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.VARIABLE,
            "doi": self.DOI,
            "provider": "NASA GMAO / GES DISC",
            "documentation": f"https://doi.org/{self.DOI}",
            "scientific_note": "MERRA-2 is an atmospheric reanalysis model incorporating assimilated observations, not a direct satellite measurement.",
        }
