"""NOAA Daily Optimum Interpolation Sea Surface Temperature Ingestion Adapter (D7 / OISST v2.1).

Dataset: NOAA 1/4° Daily Optimum Interpolation SST Version 2.1 (AVHRR-only).
Provider: NOAA National Centers for Environmental Information (NCEI).
Source Type: Blended Satellite (AVHRR) + In-Situ (Ships, Buoys, Argo floats) Optimum Interpolation.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import httpx
import numpy as np
import xarray as xr


class NoaaOisstAdapter:
    """Ingestion and normalization adapter for NOAA 0.25° OISST v2.1 product."""

    DATASET_ID = "noaa_oisst"
    ALIAS_ID = "D7"
    COLLECTION = "NOAA_OISST_V2.1"
    VERSION = "2.1"
    SOURCE_TYPE = "blended_satellite_in_situ"
    VARIABLE = "sst"
    DOI = "10.25921/RE9P-PT57"
    CLIMATOLOGY_PERIOD = "1971-2000"
    FILL_VALUE_THRESHOLD = -900.0  # Land or missing flag (typically -999.0)
    MIN_PHYSICAL_SST = -2.5       # Seawater freezes at ~ -1.8°C; values below -2.5°C are non-ocean
    MAX_PHYSICAL_SST = 45.0        # Physical ocean surface temperature ceiling

    def __init__(self, timeout: float = 30.0) -> None:
        self.timeout = timeout

    def decode(
        self,
        dataset_or_path: Union[str, Path, xr.Dataset],
        variable: Optional[str] = None,
    ) -> xr.DataArray:
        """Decode NetCDF dataset and extract SST or anomaly variable."""
        if isinstance(dataset_or_path, xr.Dataset):
            ds = dataset_or_path
        else:
            ds = xr.open_dataset(dataset_or_path, engine="netcdf4")

        target_var = variable or self.VARIABLE
        if target_var not in ds:
            # Check for alternative naming conventions
            candidates = [target_var, "sst", "anom", "sea_surface_temperature"]
            found = None
            for c in candidates:
                if c in ds:
                    found = c
                    break
            if found is None:
                raise KeyError(
                    f"Variable '{target_var}' not found in OISST dataset. Available: {list(ds.data_vars)}"
                )
            target_var = found

        da = ds[target_var]
        # Squeeze singleton zlev / elevation dimensions if present in OISST
        if "zlev" in da.dims:
            da = da.squeeze("zlev", drop=True)
        return da

    def validate(self, da: xr.DataArray) -> bool:
        """Validate coordinates, grid bounds, and marine domain."""
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
                f"Missing spatial coordinates in OISST data. Found: {list(da.coords.keys())}"
            )

        lat_min, lat_max = float(lat_coord.min()), float(lat_coord.max())
        lon_min, lon_max = float(lon_coord.min()), float(lon_coord.max())

        if lat_min < -90.0 or lat_max > 90.0:
            raise ValueError(f"Latitude out of bounds [-90, 90]: [{lat_min}, {lat_max}]")
        if lon_min < -180.0 or lon_max > 360.0:
            raise ValueError(f"Longitude out of bounds [-180, 360]: [{lon_min}, {lon_max}]")

        return True

    def quality_mask(self, da: xr.DataArray) -> xr.DataArray:
        """Mask land pixels, ice flags, and unphysical values to NaN."""
        # Mask fill values (e.g. -999.0) and unphysical temperatures outside [-2.5, 45.0] °C
        # If variable is 'anom', physical range is roughly [-15, 15] °C
        is_anom = "anom" in str(da.name).lower()
        if is_anom:
            masked = da.where(
                (da > self.FILL_VALUE_THRESHOLD) & (np.abs(da) <= 15.0),
                other=np.nan,
            )
        else:
            masked = da.where(
                (da > self.FILL_VALUE_THRESHOLD)
                & (da >= self.MIN_PHYSICAL_SST)
                & (da <= self.MAX_PHYSICAL_SST),
                other=np.nan,
            )
        return masked

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        """Standardize units and scientific metadata."""
        out = da.copy()
        is_anom = "anom" in str(da.name).lower()
        if is_anom:
            out.attrs["units"] = "degC anomaly"
            out.attrs["long_name"] = "Daily Sea Surface Temperature Anomaly"
            out.attrs["climatology_baseline"] = self.CLIMATOLOGY_PERIOD
        else:
            out.attrs["units"] = "degC"
            out.attrs["long_name"] = "Daily Sea Surface Temperature"
        out.attrs["source_type"] = self.SOURCE_TYPE
        out.attrs["provider"] = "NOAA NCEI"
        return out

    def normalize_to_annual(
        self, da: xr.DataArray, min_months: int = 10
    ) -> xr.DataArray:
        """Aggregate monthly or daily SST to annual means requiring min_months valid."""
        if "time" not in da.dims:
            return da

        def _annual_mean(group: xr.DataArray) -> xr.DataArray:
            valid_count = group.notnull().sum(dim="time")
            mean_val = group.mean(dim="time", skipna=True)
            return mean_val.where(valid_count >= min_months, other=np.nan)

        annual = da.groupby("time.year").map(_annual_mean)
        annual.attrs = dict(da.attrs)
        annual.attrs["temporal_support"] = "annual mean SST"
        return annual

    def process(
        self,
        dataset_or_path: Union[str, Path, xr.Dataset],
        variable: Optional[str] = None,
    ) -> xr.DataArray:
        """Execute complete normalization pipeline: decode -> validate -> mask -> convert."""
        da = self.decode(dataset_or_path, variable=variable)
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
            "provider": "NOAA NCEI",
            "documentation": f"https://doi.org/{self.DOI}",
            "scientific_note": (
                "NOAA OISST v2.1 provides 0.25° optimum interpolation of AVHRR satellite retrievals "
                "calibrated against in-situ ship, drifting buoy, and Argo float observations. "
                "Land pixels are masked out; freezing seawater lower threshold is -1.8°C."
            ),
        }
