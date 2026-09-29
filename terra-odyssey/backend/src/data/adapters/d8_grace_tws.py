"""D8: NASA JPL GRACE and GRACE-FO Tellus Mascon Water Storage Adapter.

Dataset ID: grace_tws
Product: TELLUS_GRAC_L3_JPL_RL06_v04 (RL06.1)
Provider: NASA Jet Propulsion Laboratory (JPL) / PO.DAAC
Domain: Global terrestrial water storage anomalies (cm liquid water equivalent)
Reference baseline: 2004-2009 mean baseline

CRITICAL SCIENTIFIC RULES:
1. The 11-month observation gap (2017-07 through 2018-05) between GRACE and
   GRACE-FO missions must NEVER be interpolated.
2. Missing months must be represented as NaN; they must not be converted to 0
   or silently filled.
3. Terrestrial water storage values are physical anomalies bounded within
   [-1000.0, 1000.0] cm LWE.
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import xarray as xr


class GraceTwsAdapter:
    """Adapter for NASA JPL GRACE/GRACE-FO Level-3 Mascon TWS anomalies."""

    DATASET_ID = "grace_tws"
    ALIAS_ID = "D8"
    COLLECTION = "TELLUS_GRAC_L3_JPL_RL06_v04"
    VERSION = "RL06.1"
    CANONICAL_VARIABLE = "lwe_thickness"
    CANONICAL_UNITS = "cm"

    # Fill values from JPL Mascon NetCDF metadata
    FILL_VALUES: List[float] = [-9999.0, 9999.0, 32767.0, -32767.0]

    # Physical valid bounds in cm liquid water equivalent thickness
    MIN_PHYSICAL_LWE = -1000.0
    MAX_PHYSICAL_LWE = 1000.0

    # 11-month transition gap bounds (inclusive)
    GAP_START = pd.Timestamp("2017-07-01")
    GAP_END = pd.Timestamp("2018-05-31")

    def decode(self, ds: xr.Dataset, variable: Optional[str] = None) -> xr.DataArray:
        """Extract LWE thickness anomaly from GRACE/GRACE-FO Mascon NetCDF dataset."""
        candidates = [
            variable,
            "lwe_thickness",
            "lwe_thickness_uncertainty",
            "tws_anomaly",
            "tws",
            "liquid_water_equivalent_thickness",
        ]
        target_var = None
        for candidate in candidates:
            if candidate and candidate in ds:
                target_var = candidate
                break

        if target_var is None:
            raise KeyError(
                f"LWE thickness variable not found in GRACE dataset. Available: {list(ds.data_vars)}"
            )

        da = ds[target_var]
        da.name = "lwe_thickness"
        return da

    def validate(self, da: xr.DataArray) -> bool:
        """Validate coordinates, physical anomaly range, and uninterpolated mission gap."""
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
                f"Missing spatial coordinates in GRACE data. Found: {list(da.coords.keys())}"
            )

        if float(lat_coord.min()) < -90.0 or float(lat_coord.max()) > 90.0:
            raise ValueError(f"Latitude out of bounds: [{lat_coord.min()}, {lat_coord.max()}]")

        valid_vals = da.values[~np.isnan(da.values)]
        if len(valid_vals) == 0:
            raise ValueError("GRACE DataArray contains no valid non-NaN observations.")

        min_val = float(np.min(valid_vals))
        max_val = float(np.max(valid_vals))

        if min_val < self.MIN_PHYSICAL_LWE:
            raise ValueError(f"GRACE LWE below physical lower bound: {min_val} < {self.MIN_PHYSICAL_LWE}")
        if max_val > self.MAX_PHYSICAL_LWE:
            raise ValueError(f"GRACE LWE above physical upper bound: {max_val} > {self.MAX_PHYSICAL_LWE}")

        # Enforce gap verification
        self.verify_uninterpolated_gap(da)

        return True

    def verify_uninterpolated_gap(self, da: xr.DataArray) -> bool:
        """Verify that the 11-month transition gap (2017-07 to 2018-05) contains no interpolated values."""
        if "time" not in da.coords:
            return True

        times = pd.to_datetime(da.coords["time"].values)
        in_gap = (times >= self.GAP_START) & (times <= self.GAP_END)
        if not np.any(in_gap):
            # Gap months not present in this subset
            return True

        gap_da = da.isel(time=in_gap)
        gap_vals = gap_da.values
        non_nan_count = int(np.sum(~np.isnan(gap_vals)))
        if non_nan_count > 0:
            raise ValueError(
                f"GRACE 11-month transition gap (2017-07 to 2018-05) contains {non_nan_count} non-NaN values. "
                "Non-negotiable science rule prohibits interpolating this mission gap."
            )
        return True

    def quality_mask(
        self,
        da: xr.DataArray,
        scale_factor_da: Optional[xr.DataArray] = None,
    ) -> xr.DataArray:
        """Apply quality masking, scale factors, and enforce the 11-month mission gap."""
        masked = da.copy()

        # Mask fill values
        for fv in self.FILL_VALUES:
            masked = masked.where(masked != fv, other=np.nan)

        # Mask unphysical values outside [-1000, 1000] cm
        masked = masked.where(
            (masked >= self.MIN_PHYSICAL_LWE) & (masked <= self.MAX_PHYSICAL_LWE),
            other=np.nan,
        )

        # Apply JPL Mascon scale factor if provided
        if scale_factor_da is not None:
            # Align spatial coordinates
            sf = scale_factor_da.where(scale_factor_da > 0, other=np.nan)
            masked = masked * sf

        # Enforce NaN in the 11-month transition gap
        if "time" in masked.coords:
            times = pd.to_datetime(masked.coords["time"].values)
            gap_mask = (times >= self.GAP_START) & (times <= self.GAP_END)
            if np.any(gap_mask):
                gap_indices = np.where(gap_mask)[0]
                masked.values[gap_indices] = np.nan

        return masked

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        """Ensure canonical units (cm liquid water equivalent) and metadata."""
        out = da.copy()
        out.attrs["units"] = self.CANONICAL_UNITS
        out.attrs["standard_name"] = "liquid_water_equivalent_thickness_anomaly"
        out.attrs["long_name"] = "Terrestrial Water Storage Anomaly"
        out.attrs["reference_baseline"] = "2004-2009 mean baseline"
        out.attrs["provider"] = "NASA JPL / PO.DAAC"
        out.attrs["gap_policy"] = "uninterpolated_201707_201805"
        return out

    def normalize_to_annual(self, da: xr.DataArray, min_months: int = 6) -> xr.DataArray:
        """Normalize monthly LWE anomaly to annual means with gap-aware coverage threshold."""
        if "time" not in da.dims:
            return da

        def _calc_annual_mean(group: xr.DataArray) -> xr.DataArray:
            # Count valid (non-NaN) months for each grid cell
            valid_count = (~np.isnan(group)).sum(dim="time")
            mean_val = group.mean(dim="time", skipna=True)
            # Require at least min_months of observations
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
            "doi": "10.5067/TEMSC-3JC64",
            "citation": "Watkins, M. M., et al. (2015). Improved methods for observing Earth's time variable mass from GRACE.",
            "provider": "NASA Jet Propulsion Laboratory (JPL) / PO.DAAC",
            "documentation": "https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/",
            "scientific_note": "JPL GRACE/GRACE-FO RL06.1Mv04 Mascon solutions. 11-month observation gap (2017-07 to 2018-05) between GRACE and GRACE-FO missions is preserved without synthetic interpolation.",
        }
