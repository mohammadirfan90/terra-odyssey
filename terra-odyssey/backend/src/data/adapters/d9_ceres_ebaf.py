"""D9: NASA Langley CERES EBAF Ed4.2.1 Radiative Flux Adapter.

Dataset ID: ceres_ebaf
Product: CERES_EBAF_Ed4.2.1
Provider: NASA Langley Atmospheric Science Data Center (ASDC)
Domain: Global top-of-atmosphere radiative flux (W/m^2)
Sign convention: Downward radiative flux is positive. Net = Solar - Reflected SW - Emitted LW.

CRITICAL SCIENTIFIC RULES:
1. Preserve explicit sign convention (downward positive: net energy entering the Earth system).
2. Physical bounds check: Earth's energy imbalance is bounded regionally within [-50, 50] W/m^2.
3. Fill values must be explicitly masked to NaN. Missing months are never treated as zeros.
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import xarray as xr


class CeresEbafAdapter:
    """Adapter for NASA Langley CERES EBAF Ed4.2.1 Top-of-Atmosphere radiative flux."""

    DATASET_ID = "ceres_ebaf"
    ALIAS_ID = "D9"
    COLLECTION = "CERES_EBAF_Ed4.2.1"
    VERSION = "Ed4.2.1"
    CANONICAL_VARIABLE = "toa_net"
    CANONICAL_UNITS = "W/m^2"

    # Fill values
    FILL_VALUES: List[float] = [-999.0, 9999.0, -9999.0, -32767.0]

    # Physical valid ranges (W/m^2)
    BOUNDS: Dict[str, tuple] = {
        "toa_net": (-50.0, 50.0),
        "toa_sw": (0.0, 450.0),
        "toa_lw": (50.0, 400.0),
        "solar": (0.0, 600.0),
        "default": (-100.0, 1500.0),
    }

    def decode(self, ds: xr.Dataset, variable: Optional[str] = None) -> xr.DataArray:
        """Extract requested TOA flux component from CERES NetCDF dataset."""
        var_req = variable or self.CANONICAL_VARIABLE

        var_mapping = {
            "toa_net": ["toa_net_all_mon", "toa_net", "net_flux", "toa_net_clr_mon"],
            "toa_sw": ["toa_sw_all_mon", "toa_sw", "sw_flux", "toa_sw_clr_mon"],
            "toa_lw": ["toa_lw_all_mon", "toa_lw", "lw_flux", "toa_lw_clr_mon"],
            "solar": ["solar_mon", "solar", "toa_solar_all_mon"],
        }

        candidates = var_mapping.get(var_req, [var_req])

        target_var = None
        for candidate in candidates:
            if candidate in ds:
                target_var = candidate
                break

        if target_var is None:
            # Fallback to any variable containing candidate keywords
            for dv in ds.data_vars:
                if any(k in str(dv).lower() for k in ["net", "flux", "toa", "radiation"]):
                    target_var = str(dv)
                    break

        if target_var is None:
            raise KeyError(
                f"Radiative flux variable '{var_req}' not found in CERES dataset. Available: {list(ds.data_vars)}"
            )

        da = ds[target_var]
        da.name = var_req
        return da

    def validate(self, da: xr.DataArray) -> bool:
        """Validate coordinates, grid bounds, and physical radiative flux range."""
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
                f"Missing spatial coordinates in CERES data. Found: {list(da.coords.keys())}"
            )

        if float(lat_coord.min()) < -90.0 or float(lat_coord.max()) > 90.0:
            raise ValueError(f"Latitude out of bounds: [{lat_coord.min()}, {lat_coord.max()}]")

        valid_vals = da.values[~np.isnan(da.values)]
        if len(valid_vals) == 0:
            raise ValueError("CERES DataArray contains no valid non-NaN observations.")

        var_name = str(da.name or "toa_net").lower()
        min_bound, max_bound = self.BOUNDS.get(var_name, self.BOUNDS["default"])

        min_val = float(np.min(valid_vals))
        max_val = float(np.max(valid_vals))

        if min_val < min_bound or max_val > max_bound:
            raise ValueError(
                f"CERES flux values outside valid physical range [{min_bound}, {max_bound}] W/m^2: "
                f"min={min_val}, max={max_val}"
            )

        return True

    def quality_mask(self, da: xr.DataArray) -> xr.DataArray:
        """Mask fill values and unphysical flux values to NaN."""
        masked = da.copy()

        for fv in self.FILL_VALUES:
            masked = masked.where(masked != fv, other=np.nan)

        var_name = str(da.name or "toa_net").lower()
        min_bound, max_bound = self.BOUNDS.get(var_name, self.BOUNDS["default"])

        masked = masked.where(
            (masked >= min_bound) & (masked <= max_bound),
            other=np.nan,
        )
        return masked

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        """Ensure canonical units of W/m^2 and downward positive sign metadata."""
        out = da.copy()
        out.attrs["units"] = self.CANONICAL_UNITS
        out.attrs["sign_convention"] = "downward_positive"
        out.attrs["long_name"] = "Top-of-Atmosphere Net Radiative Flux"
        out.attrs["provider"] = "NASA Langley ASDC"
        return out

    def normalize_to_annual(self, da: xr.DataArray, min_months: int = 10) -> xr.DataArray:
        """Normalize monthly radiative flux to annual means with minimum valid month threshold."""
        if "time" not in da.dims:
            return da

        def _calc_annual_mean(group: xr.DataArray) -> xr.DataArray:
            valid_count = (~np.isnan(group)).sum(dim="time")
            mean_val = group.mean(dim="time", skipna=True)
            return xr.where(valid_count >= min_months, mean_val, np.nan)

        annual = da.groupby("time.year").map(_calc_annual_mean)
        annual.attrs = dict(da.attrs)
        annual.attrs["temporal_support"] = f"annual mean (minimum {min_months} valid months)"
        return annual

    def cite(self) -> Dict[str, Any]:
        """Return provenance citation and scientific attribution."""
        return {
            "dataset_id": self.DATASET_ID,
            "alias_id": self.ALIAS_ID,
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "doi": "10.5067/TERRA+AQUA/CERES/EBAF_L3B004.2",
            "citation": "Loeb, N. G., et al. (2018). Clouds and the Earth's Radiant Energy System (CERES) Energy Balanced and Filled (EBAF) Top-of-Atmosphere (TOA) Edition-4.0 Data Product.",
            "provider": "NASA Langley Atmospheric Science Data Center (ASDC)",
            "documentation": "https://ceres.larc.nasa.gov/data/",
            "scientific_note": "CERES Energy Balanced and Filled (EBAF) Ed4.2.1 monthly radiative fluxes. Sign convention: downward radiative fluxes are positive.",
        }
