"""GISS Surface Temperature Analysis Ingestion Adapter (D5 / GISTEMP v4).

Dataset: GISTEMP Surface Temperature Analysis v4.0 (Global 2.0° grid, 250 km smoothing).
Provider: NASA Goddard Institute for Space Studies (GISS).
Source Type: Surface In-Situ + Satellite Blended Anomaly Analysis (GHCN-v4 + ERSSTv5).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import httpx
import numpy as np
import xarray as xr


class GistempAdapter:
    """Ingestion and normalization adapter for NASA GISS GISTEMP v4 product."""

    DATASET_ID = "gistemp_v4"
    ALIAS_ID = "D5"
    COLLECTION = "GISTEMP_V4"
    VERSION = "4.0"
    SOURCE_TYPE = "surface_observation_analysis"
    VARIABLE = "temperature_anomaly"
    DOI = "10.2767/92882"
    BASELINE_PERIOD = "1951-1980"
    FILL_VALUE_THRESHOLD = 1000.0  # GISS fill values often 9999.0 or -9999.0

    def __init__(self, timeout: float = 30.0) -> None:
        self.timeout = timeout

    def decode(
        self, dataset_or_path: Union[str, Path, xr.Dataset]
    ) -> xr.DataArray:
        """Decode NetCDF dataset and extract surface temperature anomaly variable."""
        if isinstance(dataset_or_path, xr.Dataset):
            ds = dataset_or_path
        else:
            ds = xr.open_dataset(dataset_or_path, engine="netcdf4")

        # GISTEMP variables may be named 'temperature_anomaly', 'tempanomaly', or 'anom'
        var_name = None
        for candidate in (self.VARIABLE, "tempanomaly", "anom", "tas_anom", "temperature"):
            if candidate in ds:
                var_name = candidate
                break

        if var_name is None:
            raise KeyError(
                f"GISTEMP temperature anomaly variable not found in dataset. Available: {list(ds.data_vars)}"
            )

        da = ds[var_name]
        return da

    def validate(self, da: xr.DataArray) -> bool:
        """Validate coordinates, grid bounds, and anomaly range."""
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
                f"Missing spatial coordinates in GISTEMP data. Found: {list(da.coords.keys())}"
            )

        lat_min, lat_max = float(lat_coord.min()), float(lat_coord.max())
        lon_min, lon_max = float(lon_coord.min()), float(lon_coord.max())

        if lat_min < -90.0 or lat_max > 90.0:
            raise ValueError(f"Latitude out of bounds [-90, 90]: [{lat_min}, {lat_max}]")
        if lon_min < -180.0 or lon_max > 360.0:
            raise ValueError(f"Longitude out of bounds [-180, 360]: [{lon_min}, {lon_max}]")

        return True

    def quality_mask(self, da: xr.DataArray) -> xr.DataArray:
        """Mask GISTEMP fill values (|val| >= 1000) and unphysical anomalies to NaN."""
        # Valid Earth surface temperature anomalies rarely exceed +/- 25 degC
        masked = da.where((np.abs(da) < self.FILL_VALUE_THRESHOLD) & (np.abs(da) <= 25.0), other=np.nan)
        return masked

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        """Normalize units and attach CF-compliant scientific metadata."""
        out = da.copy()
        out.attrs["units"] = "degC anomaly"
        out.attrs["long_name"] = "Surface Air and Sea Surface Temperature Anomaly"
        out.attrs["baseline_period"] = self.BASELINE_PERIOD
        out.attrs["source_type"] = self.SOURCE_TYPE
        out.attrs["provider"] = "NASA Goddard Institute for Space Studies"
        return out

    def normalize_to_annual(
        self, da: xr.DataArray, min_months: int = 10
    ) -> xr.DataArray:
        """Aggregate monthly temperature anomalies into annual means requiring min_months valid."""
        if "time" not in da.dims:
            return da

        def _annual_mean(group: xr.DataArray) -> xr.DataArray:
            valid_count = group.notnull().sum(dim="time")
            mean_val = group.mean(dim="time", skipna=True)
            return mean_val.where(valid_count >= min_months, other=np.nan)

        annual = da.groupby("time.year").map(_annual_mean)
        annual.attrs = dict(da.attrs)
        annual.attrs["temporal_support"] = "annual mean of monthly anomalies"
        return annual

    def process(
        self, dataset_or_path: Union[str, Path, xr.Dataset]
    ) -> xr.DataArray:
        """Execute full normalization pipeline: decode -> validate -> mask -> convert."""
        da = self.decode(dataset_or_path)
        self.validate(da)
        masked = self.quality_mask(da)
        result = self.convert_units(masked)
        return result

    def cite(self) -> Dict[str, Any]:
        """Return canonical citation and provenance metadata."""
        return {
            "dataset_id": self.DATASET_ID,
            "alias_id": self.ALIAS_ID,
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.VARIABLE,
            "doi": self.DOI,
            "provider": "NASA GISS",
            "documentation": f"https://doi.org/{self.DOI}",
            "scientific_note": (
                "GISTEMP v4 is a surface observation analysis blending meteorological station records "
                "(GHCN-v4) and ocean temperature analyses (ERSSTv5) expressed as anomalies relative to "
                "the 1951–1980 base period with 250 km spatial smoothing."
            ),
        }
