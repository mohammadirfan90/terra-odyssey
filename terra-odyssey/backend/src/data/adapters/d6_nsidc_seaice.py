"""NOAA/NSIDC Sea Ice Index Ingestion Adapter (D6 / G02135 v4).

Dataset: Sea Ice Index, Version 4 (Monthly Sea Ice Extent and Area).
Provider: National Snow and Ice Data Center (NSIDC) / NOAA NCEI.
Source Type: Multi-Sensor Satellite Microwave Radiometry (SMMR, SSM/I, SSMIS).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import httpx
import numpy as np
import pandas as pd
import xarray as xr


class NsidcSeaIceAdapter:
    """Ingestion and normalization adapter for NOAA/NSIDC Sea Ice Index v4."""

    DATASET_ID = "nsidc_sea_ice"
    ALIAS_ID = "D6"
    COLLECTION = "G02135"
    VERSION = "4.0"
    SOURCE_TYPE = "satellite_retrieval"
    VARIABLE = "extent"
    DOI = "10.7265/N5K072F8"
    FILL_VALUE_THRESHOLD = 0.0  # Extent cannot be negative; fill values often -9999.0
    MAX_PHYSICAL_EXTENT = 25.0  # Max physical hemisphere extent in 10^6 km^2

    def __init__(self, timeout: float = 30.0) -> None:
        self.timeout = timeout

    def decode(
        self,
        dataset_or_path: Union[str, Path, xr.Dataset],
        variable: Optional[str] = None,
    ) -> xr.DataArray:
        """Decode dataset and extract sea ice extent or area."""
        if isinstance(dataset_or_path, xr.Dataset):
            ds = dataset_or_path
        else:
            ds = xr.open_dataset(dataset_or_path, engine="netcdf4")

        target_var = variable or self.VARIABLE
        if target_var not in ds:
            for candidate in (target_var, "extent", "area", "seaice_extent", "ice_extent"):
                if candidate in ds:
                    target_var = candidate
                    break

        if target_var not in ds:
            raise KeyError(
                f"Variable '{target_var}' not found in Sea Ice dataset. Available: {list(ds.data_vars)}"
            )

        da = ds[target_var]
        return da

    def validate(self, da: xr.DataArray) -> bool:
        """Validate extent values within physical bounds [0, 25] million km^2."""
        valid_vals = da.values[~np.isnan(da.values)]
        if len(valid_vals) == 0:
            raise ValueError("Sea ice DataArray contains no valid non-NaN observations.")

        min_val = float(np.min(valid_vals))
        max_val = float(np.max(valid_vals))

        if min_val < -100.0:
            raise ValueError(f"Sea ice values contain unmasked negative fill values: min={min_val}")
        if max_val > 50.0:
            raise ValueError(f"Sea ice extent exceeds physical upper threshold: max={max_val}")

        return True

    def quality_mask(self, da: xr.DataArray) -> xr.DataArray:
        """Mask negative values, missing data, and unphysical values to NaN."""
        masked = da.where(
            (da >= self.FILL_VALUE_THRESHOLD) & (da <= self.MAX_PHYSICAL_EXTENT),
            other=np.nan,
        )
        return masked

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        """Ensure canonical units of 10^6 km^2 and scientific metadata."""
        out = da.copy()
        out.attrs["units"] = "10^6 km^2"
        out.attrs["standard_name"] = (
            "sea_ice_extent" if "extent" in str(da.name).lower() else "sea_ice_area"
        )
        out.attrs["source_type"] = self.SOURCE_TYPE
        out.attrs["provider"] = "NSIDC / NOAA"
        return out

    def extract_annual_minimum(self, da: xr.DataArray, hemisphere: str = "north") -> xr.DataArray:
        """Extract the authoritative annual minimum sea ice extent (September for Arctic, Feb for Antarctic)."""
        if "time" not in da.dims:
            return da

        target_month = 9 if hemisphere.lower() in ("north", "arctic", "nh") else 2
        # Filter for the target minimum month
        month_vals = da["time"].dt.month
        min_month_da = da.sel(time=(month_vals == target_month))

        years = min_month_da["time"].dt.year.values
        # Create year-indexed series
        result = min_month_da.assign_coords(time=years).rename({"time": "year"})
        result.attrs = dict(da.attrs)
        result.attrs["temporal_support"] = (
            f"annual {'September' if target_month == 9 else 'February'} minimum"
        )
        return result

    def normalize_to_annual(
        self,
        da: xr.DataArray,
        mode: str = "annual_mean",
        hemisphere: str = "north",
        min_months: int = 10,
    ) -> xr.DataArray:
        """Aggregate monthly sea ice observations into annual time series."""
        if "time" not in da.dims:
            return da

        if mode == "september_minimum":
            return self.extract_annual_minimum(da, hemisphere=hemisphere)

        def _annual_mean(group: xr.DataArray) -> xr.DataArray:
            valid_count = group.notnull().sum(dim="time")
            mean_val = group.mean(dim="time", skipna=True)
            return mean_val.where(valid_count >= min_months, other=np.nan)

        annual = da.groupby("time.year").map(_annual_mean)
        annual.attrs = dict(da.attrs)
        annual.attrs["temporal_support"] = "annual mean sea ice extent"
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
            "provider": "NSIDC / NOAA",
            "documentation": f"https://doi.org/{self.DOI}",
            "scientific_note": (
                "NOAA/NSIDC Sea Ice Index v4 tracks sea ice extent and area derived from "
                "passive microwave sensors (SMMR, SSM/I, SSMIS). Extent is defined as ocean area "
                "with ice concentration >= 15%. Northern and Southern Hemisphere records are strictly separate."
            ),
        }
