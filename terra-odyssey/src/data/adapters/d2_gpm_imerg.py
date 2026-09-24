"""GPM IMERG Final Monthly Precipitation Ingestion Adapter (D2).

Dataset: GPM IMERG Final Monthly Precipitation (GPM_3IMERGM v07).
Source Type: Mission Product (NASA GPM / GES DISC).
"""

from __future__ import annotations

import calendar
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import httpx
import numpy as np
import xarray as xr


class GpmImergAdapter:
    """Ingestion and normalization adapter for NASA GPM IMERG Final precipitation."""

    DATASET_ID = "D2"
    COLLECTION = "GPM_3IMERGM"
    VERSION = "07"
    SOURCE_TYPE = "mission_product"
    VARIABLE = "precipitationCal"
    ALT_VARIABLE = "precipitation"
    DOI = "10.5067/GPM/IMERG/3B-MONTH/07"
    CMR_ENDPOINT = "https://cmr.earthdata.nasa.gov/search/granules.json"
    FILL_VALUE_THRESHOLD = -9000.0

    def __init__(self, timeout: float = 30.0) -> None:
        """Initialize adapter with HTTP timeout configuration."""
        self.timeout = timeout

    def build_cmr_query_url(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
    ) -> str:
        """Construct the official NASA CMR search query URL for GPM IMERG Final."""
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
        """Query NASA CMR for available GPM IMERG monthly granules."""
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
                or link.get("href", "").endswith((".HDF5", ".h5", ".nc4", ".nc"))
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
        """Decode dataset and extract calibrated precipitation rate."""
        if isinstance(dataset_or_path, xr.Dataset):
            ds = dataset_or_path
        else:
            ds = xr.open_dataset(dataset_or_path, engine="netcdf4")

        target_var = None
        for candidate in (self.VARIABLE, self.ALT_VARIABLE):
            if candidate in ds:
                target_var = candidate
                break

        if target_var is None:
            raise KeyError(
                f"Neither '{self.VARIABLE}' nor '{self.ALT_VARIABLE}' found in dataset. Available: {list(ds.data_vars)}"
            )

        da = ds[target_var]
        return da

    def validate(self, da: xr.DataArray) -> bool:
        """Validate coordinates, spatial ranges, and dimensions."""
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
        """Mask fill values (<= -9000.0) and negative rates to NaN."""
        masked = da.where((da > self.FILL_VALUE_THRESHOLD) & (da >= 0.0), other=np.nan)
        return masked

    def calculate_accumulation(
        self, da: xr.DataArray, year: int, month: int
    ) -> xr.DataArray:
        """Convert rate (mm/hr) to total monthly accumulation (mm/month) using exact calendar month hours."""
        if not (1 <= month <= 12):
            raise ValueError(f"Invalid month: {month}. Must be 1-12.")

        _, days_in_month = calendar.monthrange(year, month)
        hours_in_month = days_in_month * 24.0

        accumulation = da * hours_in_month
        accumulation.attrs = dict(da.attrs)
        accumulation.attrs["units"] = "mm/month"
        accumulation.attrs["long_name"] = "Monthly accumulated precipitation"
        accumulation.attrs["source_type"] = self.SOURCE_TYPE
        accumulation.attrs["calendar_hours"] = hours_in_month
        accumulation.attrs["calendar_days"] = days_in_month
        return accumulation

    def process(
        self, dataset_or_path: Union[str, Path, xr.Dataset], year: int, month: int
    ) -> xr.DataArray:
        """Execute complete normalization pipeline: decode -> validate -> mask -> accumulate."""
        da = self.decode(dataset_or_path)
        self.validate(da)
        masked = self.quality_mask(da)
        accumulated = self.calculate_accumulation(masked, year, month)
        return accumulated

    def cite(self) -> Dict[str, Any]:
        """Return canonical citation and provenance metadata."""
        return {
            "dataset_id": self.DATASET_ID,
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.VARIABLE,
            "doi": self.DOI,
            "provider": "NASA GPM / GES DISC",
            "documentation": f"https://doi.org/{self.DOI}",
            "scientific_note": "GPM IMERG Final is a multi-satellite precipitation estimate combining microwave, infrared, and gauge calibration.",
        }
