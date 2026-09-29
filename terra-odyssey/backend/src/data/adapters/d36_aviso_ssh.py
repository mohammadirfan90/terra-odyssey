"""AVISO+ Sea Surface Height Anomaly Adapter (D36).

Dataset: AVISO+ DT2021 monthly gridded SLA — DUACS delayed-time.
Source Type: Satellite altimetry (NASA / CNES, distributed via PODAAC).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import httpx
import numpy as np
import xarray as xr


class AvisoSshAdapter:
    """Ingestion and normalization adapter for AVISO SLA product."""

    DATASET_ID = "D36"
    COLLECTION = "SEALEVEL_GLO_PHY_L4_MY_008_047"
    VERSION = "DT2021"
    SOURCE_TYPE = "satellite_altimetry"
    VARIABLE = "sla"
    DOI = "10.48670/moi-00148"
    CMR_ENDPOINT = "https://cmr.earthdata.nasa.gov/search/granules.json"
    FILL_VALUE_THRESHOLD = -32768.0

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

        granules: List[Dict[str, Any]] = []
        for entry in data.get("feed", {}).get("entry", []):
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

        if float(lat_coord.min()) < -90 or float(lat_coord.max()) > 90:
            raise ValueError("Latitude out of bounds")
        if float(lon_coord.min()) < -180 or float(lon_coord.max()) > 360:
            raise ValueError("Longitude out of bounds")
        return True

    def quality_mask(self, da: xr.DataArray) -> xr.DataArray:
        # AVISO SLA is centered on zero; clip gross outliers
        return da.where(np.abs(da) < 5.0, other=np.nan)

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        out = da.copy()
        out.attrs = dict(da.attrs)
        out.attrs["units"] = "m"
        out.attrs["long_name"] = "Sea level anomaly (mean sea surface reference)"
        return out

    def process(self, dataset_or_path: Union[str, Path, xr.Dataset]) -> xr.DataArray:
        da = self.decode(dataset_or_path)
        self.validate(da)
        return self.convert_units(self.quality_mask(da))

    def cite(self) -> Dict[str, Any]:
        return {
            "dataset_id": self.DATASET_ID,
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.VARIABLE,
            "doi": self.DOI,
            "provider": "CNES / NASA PODAAC",
            "documentation": f"https://doi.org/{self.DOI}",
            "scientific_note": (
                "AVISO is a multi-mission altimetry merge (TOPEX/Poseidon, "
                "Jason, Sentinel-6). Signal dominated by ENSO and long-term "
                "sea-level rise."
            ),
        }
