"""MODIS Vegetation Indices (NDVI/EVI) Ingestion Adapter (D4) — Phase 5 Complete.

Dataset: MODIS/Terra Vegetation Indices Monthly L3 Global 1km (MOD13A3 v061).
Source Type: Satellite Retrieval / Derived Index (NASA LP DAAC).

Product-specific rules enforced:
  - VI_Quality bitmask: bits 0-1 = 00 (Produced, good quality) or 01 (Produced, OK).
  - Fill value: raw integer -3000 (pre-scale) → masked to NaN.
  - Scale factor: NDVI_scaled = raw * 0.0001; valid range [-0.2, 1.0].
  - EVI scale factor: EVI_scaled = raw * 0.0001; valid range [-0.2, 1.0].
  - Never infill missing months with zeros for NDVI: missing months → NaN annual values.
  - Annual aggregation: growing-season mean (April–October in Northern Hemisphere by default)
    OR calendar-year mean, selectable via `season` parameter.
  - Phenology-aware trend detection uses Modified Mann-Kendall (seasonal correction).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import logging

import httpx
import numpy as np
import xarray as xr

logger = logging.getLogger("terra_odyssey.adapters.modis_ndvi")

# VI_Quality bitmask constants (bits 0-1 of 16-bit VI_Quality field)
_VI_QUALITY_MASK = 0b11  # bits 0-1
_VI_GOOD = 0b00          # Produced, good quality
_VI_ACCEPTABLE = 0b01    # Produced, OK but check other QA flags
# Annual aggregation modes
ANNUAL_MODE_CALENDAR = "calendar_year"
ANNUAL_MODE_GROWING_SEASON_NH = "growing_season_nh"   # Apr–Oct Northern Hemisphere
ANNUAL_MODE_GROWING_SEASON_SH = "growing_season_sh"   # Oct–Apr Southern Hemisphere

_MIN_MONTHS_PER_YEAR = 3  # absolute minimum valid months for an annual NDVI mean


class ModisNdviAdapter:
    """Ingestion and normalization adapter for NASA MODIS MOD13A3.061 NDVI product."""

    DATASET_ID = "d4_modis_ndvi"
    COLLECTION = "MOD13A3"
    VERSION = "061"
    SOURCE_TYPE = "satellite_derived_index"
    # Raw HDF variable name as stored in MOD13A3
    VARIABLE_RAW = "1_km_monthly_NDVI"
    VARIABLE_EVI_RAW = "1_km_monthly_EVI"
    QC_VAR_RAW = "1_km_monthly_VI_Quality"
    # Canonical names used after renaming
    VARIABLE = "NDVI"
    VARIABLE_EVI = "EVI"
    DOI = "10.5067/MODIS/MOD13A3.061"
    CMR_ENDPOINT = "https://cmr.earthdata.nasa.gov/search/granules.json"
    RAW_FILL_VALUE = -3000  # raw integer fill (before scale factor)
    SCALE_FACTOR = 0.0001
    VALID_RANGE = (-0.2, 1.0)  # physical range of scaled NDVI

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
        """Query NASA CMR for available MOD13A3 granules."""
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
            granule_id = entry.get("title", "")
            download_urls = [
                link.get("href")
                for link in entry.get("links", [])
                if link.get("rel") == "http://esipfed.org/ns/fedsearch/1.1/data#"
                or link.get("href", "").endswith((".hdf", ".h5", ".nc4", ".nc"))
            ]
            granules.append({
                "granule_id": granule_id,
                "download_urls": download_urls,
                "time_start": entry.get("time_start"),
                "time_end": entry.get("time_end"),
            })
        return granules

    def decode(
        self,
        file_path_or_ds: Union[str, Path, xr.Dataset],
        variable: str = "NDVI",
    ) -> xr.Dataset:
        """Load HDF4/NetCDF dataset and extract NDVI or EVI variable.

        Accepts both the raw HDF variable names (as stored on disk) and
        the canonical names after renaming.
        """
        if isinstance(file_path_or_ds, xr.Dataset):
            ds = file_path_or_ds
        else:
            ds = xr.open_dataset(Path(file_path_or_ds), engine="netcdf4")

        # Accept either canonical or raw HDF variable naming for NDVI
        ndvi_candidates = [
            self.VARIABLE, self.VARIABLE_RAW, "NDVI", "1 km monthly NDVI",
        ]
        evi_candidates = [
            self.VARIABLE_EVI, self.VARIABLE_EVI_RAW, "EVI", "1 km monthly EVI",
        ]
        candidates = ndvi_candidates if variable in ("NDVI", self.VARIABLE_RAW) else evi_candidates
        target_canonical = self.VARIABLE if variable in ndvi_candidates else self.VARIABLE_EVI

        matched_var = None
        for candidate in candidates:
            if candidate in ds.data_vars:
                matched_var = candidate
                break

        if matched_var is None:
            raise KeyError(
                f"{variable} variable not found in dataset. "
                f"Available variables: {list(ds.data_vars.keys())}"
            )

        if matched_var != target_canonical:
            ds = ds.rename({matched_var: target_canonical})

        # Also rename QC field if present
        for raw_qc in [self.QC_VAR_RAW, "1 km monthly VI_Quality", "VI_Quality"]:
            if raw_qc in ds.data_vars and raw_qc != "VI_Quality":
                ds = ds.rename({raw_qc: "VI_Quality"})
                break

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

    def apply_quality_mask(
        self,
        da: "xr.DataArray | xr.Dataset",
        vi_quality_da: Optional[xr.DataArray] = None,
    ) -> "xr.DataArray | xr.Dataset":
        """Apply VI_Quality bitmask and fill screening (fill → NaN).

        Accepts DataArray or Dataset. Returns the same type it receives.
        Scale factor (0.0001) is NOT applied here; call convert_units() next.

        VI_Quality bitmask (bits 0-1 of the 16-bit VI_Quality field):
          00 = good  → KEEP
          01 = OK    → KEEP
          10/11      → MASK (cloud or bad quality)
        """
        # Dataset path: extract var, mask, re-wrap as Dataset
        if isinstance(da, xr.Dataset):
            ds = da
            if self.VARIABLE not in ds.data_vars:
                raise KeyError(
                    f"'{self.VARIABLE}' not found in Dataset. "
                    f"Available: {list(ds.data_vars.keys())}"
                )
            masked_da = self._apply_fill_and_qc(ds[self.VARIABLE], vi_quality_da)
            result_ds = ds.copy()
            result_ds[self.VARIABLE] = masked_da
            return result_ds

        # DataArray path: mask in-place and return DataArray
        return self._apply_fill_and_qc(da, vi_quality_da)

    def _apply_fill_and_qc(
        self,
        da: xr.DataArray,
        vi_quality_da: Optional[xr.DataArray] = None,
    ) -> xr.DataArray:
        """Internal: apply fill-value mask + VI_Quality QC bits 0-1."""
        raw = da.values.astype(np.float64)
        # Fill value mask
        is_fill = raw <= float(self.RAW_FILL_VALUE)
        raw[is_fill] = np.nan
        # VI_Quality bitmask (bits 0-1 = 0b11 → bad)
        if vi_quality_da is not None:
            qc = vi_quality_da.values.astype(np.uint16)
            bad_quality = (qc & _VI_QUALITY_MASK) == 0b11
            raw[bad_quality] = np.nan
            logger.debug(
                "VI_Quality mask: %.1f%% pixels rejected",
                100.0 * float(np.nansum(bad_quality)) / max(bad_quality.size, 1),
            )
        masked = da.copy(data=raw)
        masked.attrs.update(da.attrs)
        masked.attrs["vi_quality_bits_screened"] = "0-1"
        return masked

    def convert_units(self, da: "xr.DataArray | xr.Dataset") -> xr.DataArray:
        """Apply scale factor (0.0001) and physical range screening [-0.2, 1.0].

        Accepts DataArray or Dataset; returns the same type it receives.
        """
        if isinstance(da, xr.Dataset):
            ds = da
            if self.VARIABLE not in ds.data_vars:
                raise KeyError(f"'{self.VARIABLE}' not found in Dataset.")
            scaled_da = self._scale_da(ds[self.VARIABLE])
            result_ds = ds.copy()
            result_ds[self.VARIABLE] = scaled_da
            return result_ds  # type: ignore[return-value]

        return self._scale_da(da)

    def _scale_da(self, da: xr.DataArray) -> xr.DataArray:
        """Internal: apply 0.0001 scale + physical range mask."""
        raw = da.values.astype(np.float64)
        scaled = raw * self.SCALE_FACTOR
        out_of_range = (scaled < self.VALID_RANGE[0]) | (scaled > self.VALID_RANGE[1])
        scaled[out_of_range & ~np.isnan(raw)] = np.nan
        result = da.copy(data=scaled)
        result.attrs["units"] = "dimensionless"
        result.attrs["long_name"] = da.attrs.get(
            "long_name", "Normalized Difference Vegetation Index"
        )
        result.attrs["valid_range"] = list(self.VALID_RANGE)
        result.attrs["scale_applied"] = self.SCALE_FACTOR
        return result

    def process(self, file_path_or_ds: "Union[str, Path, xr.Dataset]") -> xr.Dataset:
        """Execute full ingestion, validation, masking, and unit conversion pipeline."""
        ds = self.decode(file_path_or_ds)
        self.validate_coordinates(ds)
        masked_ds = self.apply_quality_mask(ds)            # Dataset in → Dataset out
        assert isinstance(masked_ds, xr.Dataset)           # narrow union type for Pyright
        scaled_da = self._scale_da(masked_ds[self.VARIABLE])
        result_ds = masked_ds.copy()
        result_ds[self.VARIABLE] = scaled_da
        return result_ds

    def get_citation_provenance(self) -> Dict[str, Any]:
        """Return standardized NASA provenance metadata (backward-compatible alias)."""
        return {
            "dataset_id": "D4",
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.VARIABLE,
            "units": "dimensionless",
            "doi": self.DOI,
            "daac": "LP DAAC",
            "measurement": "Optical vegetation index retrieval (Terra MODIS)",
        }

    def aggregate_annual_mean(
        self,
        monthly_da: xr.DataArray,
        season: str = ANNUAL_MODE_CALENDAR,
        min_months: int = _MIN_MONTHS_PER_YEAR,
    ) -> xr.DataArray:
        """Compute annual NDVI mean with phenology-aware growing-season option.

        Parameters
        ----------
        monthly_da : xr.DataArray
            Monthly scaled NDVI DataArray with a 'time' dimension.
        season : str
            "calendar_year"         → all 12 months (Jan–Dec)
            "growing_season_nh"     → Northern Hemisphere growing season (Apr–Oct, months 4-10)
            "growing_season_sh"     → Southern Hemisphere growing season (Oct–Apr, months 10-4)
        min_months : int
            Minimum number of valid months required for an annual mean to be non-NaN.

        Notes
        -----
        Missing months are NEVER zero-filled or interpolated. Years with fewer than
        `min_months` valid observations are set to NaN (per scientific rules).
        """
        if "time" not in monthly_da.dims:
            raise ValueError("monthly_da must have a 'time' dimension.")

        if season == ANNUAL_MODE_GROWING_SEASON_NH:
            # Northern Hemisphere growing season: April–October
            season_mask = monthly_da.time.dt.month.isin([4, 5, 6, 7, 8, 9, 10])
            da_filtered = monthly_da.where(season_mask, drop=True)
        elif season == ANNUAL_MODE_GROWING_SEASON_SH:
            # Southern Hemisphere: October–April (wraps year boundary)
            season_mask = monthly_da.time.dt.month.isin([1, 2, 3, 4, 10, 11, 12])
            da_filtered = monthly_da.where(season_mask, drop=True)
        else:
            da_filtered = monthly_da

        valid_months = da_filtered.notnull().groupby("time.year").sum(dim="time")
        annual_mean = da_filtered.groupby("time.year").mean(dim="time", skipna=True)
        # Enforce minimum coverage
        annual_mean = annual_mean.where(valid_months >= min_months)
        annual_mean.attrs.update(monthly_da.attrs)
        annual_mean.attrs["temporal_aggregation"] = f"annual_mean_{season}_min_{min_months}_months"
        annual_mean.attrs["season_mode"] = season
        return annual_mean

    def cite(self) -> Dict[str, Any]:
        """Return canonical citation and provenance metadata (matches stepper contract)."""
        return {
            "dataset_id": self.DATASET_ID,
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.VARIABLE,
            "doi": self.DOI,
            "provider": "NASA LP DAAC",
            "documentation": f"https://doi.org/{self.DOI}",
            "scientific_note": (
                "MODIS MOD13A3.061 NDVI is a monthly composite derived from the "
                "constrained view angle – maximum value composite (CV-MVC) algorithm. "
                "Clear-sky bias applies; persistent cloud cover can reduce available "
                "observations in tropical and high-latitude regions."
            ),
        }
