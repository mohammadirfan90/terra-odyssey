"""MERRA-2 Time-Averaged Surface Precipitation Flux Ingestion Adapter (D29).

Dataset: MERRA-2 monthly mean surface precipitation (M2T1NXFLX v5.12.4).
Source Type: Model Reanalysis (NASA GMAO / GES DISC).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import httpx
import numpy as np
import xarray as xr


class Merra2PrecipAdapter:
    """Ingestion and normalization adapter for MERRA-2 PRECTOT product."""

    DATASET_ID = "D29"
    COLLECTION = "M2T1NXFLX"
    VERSION = "5.12.4"
    SOURCE_TYPE = "model_reanalysis"
    VARIABLE = "PRECTOT"
    DOI = "10.5067/0J5VGD2HNNOO"
    CMR_ENDPOINT = "https://cmr.earthdata.nasa.gov/search/granules.json"
    FILL_VALUE_THRESHOLD = 1.0e14
    # Convert kg m-2 s-1 (mass flux) → mm/month using exact calendar-month hours
    SECONDS_PER_HOUR = 3600.0

    def __init__(self, timeout: float = 30.0) -> None:
        self.timeout = timeout

    def build_cmr_query_url(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
    ) -> str:
        base = (
            f"{self.CMR_ENDPOINT}?short_name={self.COLLECTION}"
            f"&version={self.VERSION}&page_size={limit}"
        )
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

    def decode(self, dataset_or_path: Union[str, Path, xr.Dataset]) -> xr.DataArray:
        if isinstance(dataset_or_path, xr.Dataset):
            ds = dataset_or_path
        else:
            ds = xr.open_dataset(dataset_or_path, engine="netcdf4")
        if self.VARIABLE not in ds:
            raise KeyError(
                f"Variable '{self.VARIABLE}' not found. Available: {list(ds.data_vars)}"
            )
        return ds[self.VARIABLE]

    def validate(self, da: xr.DataArray) -> bool:
        for name in ("lat", "latitude"):
            if name in da.coords:
                lat_coord = da.coords[name]
                break
        else:
            raise ValueError("Missing latitude coordinate")
        for name in ("lon", "longitude"):
            if name in da.coords:
                lon_coord = da.coords[name]
                break
        else:
            raise ValueError("Missing longitude coordinate")

        lat_min, lat_max = float(lat_coord.min()), float(lat_coord.max())
        lon_min, lon_max = float(lon_coord.min()), float(lon_coord.max())
        if lat_min < -90 or lat_max > 90:
            raise ValueError(f"Latitude out of bounds: [{lat_min}, {lat_max}]")
        if lon_min < -180 or lon_max > 360:
            raise ValueError(f"Longitude out of bounds: [{lon_min}, {lon_max}]")
        return True

    def quality_mask(self, da: xr.DataArray) -> xr.DataArray:
        return da.where(da < self.FILL_VALUE_THRESHOLD, other=np.nan)

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        """Convert kg m-2 s-1 → mm/month by integrating over calendar-month hours."""
        if "time" not in da.coords:
            raise ValueError("Time coordinate required for monthly integration")

        monthly_mm: list[xr.DataArray] = []
        for month_label in da["time"].values:
            ts = np.datetime64(month_label).astype("datetime64[D]")
            # Days in the month
            year = int(str(ts)[:4])
            month = int(str(ts)[5:7])
            if month == 12:
                next_month_start = np.datetime64(f"{year + 1}-01-01")
            else:
                next_month_start = np.datetime64(f"{year}-{month + 1:02d}-01")
            month_start = np.datetime64(f"{year}-{month:02d}-01")
            days_in_month = (next_month_start - month_start).astype(int)
            hours_in_month = days_in_month * 24
            seconds_in_month = hours_in_month * self.SECONDS_PER_HOUR
            sliced: xr.DataArray = da.sel(time=month_label)  # type: ignore[assignment]
            monthly_mm.append(sliced * seconds_in_month)

        stacked = xr.concat(monthly_mm, dim="time")
        stacked.attrs = dict(da.attrs)
        stacked.attrs["units"] = "mm/month"
        stacked.attrs["long_name"] = "Monthly total precipitation"
        return stacked

    def process(self, dataset_or_path: Union[str, Path, xr.Dataset]) -> xr.DataArray:
        da = self.decode(dataset_or_path)
        self.validate(da)
        masked = self.quality_mask(da)
        return self.convert_units(masked)

    def cite(self) -> Dict[str, Any]:
        return {
            "dataset_id": self.DATASET_ID,
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.VARIABLE,
            "doi": self.DOI,
            "provider": "NASA GMAO / GES DISC",
            "documentation": f"https://doi.org/{self.DOI}",
            "scientific_note": (
                "MERRA-2 precipitation is a model-derived flux, not a direct "
                "satellite retrieval. For purely observed precipitation, use "
                "GPM IMERG (D2)."
            ),
        }
