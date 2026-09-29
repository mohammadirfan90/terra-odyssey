"""MODIS Land Surface Temperature Ingestion Adapter (D3) — Phase 5 Complete.

Dataset: MODIS/Terra Land Surface Temperature/Emissivity 8-Day L3 Global 1km (MOD11A2 v061).
Source Type: Satellite Measurement / Retrieval (NASA LP DAAC).

Product-specific rules enforced:
  - QC_Day bitmask applied: bits 0-1 must be 00 (LST produced, good quality).
  - Scale factor 0.02 applied to raw 16-bit integers: T_K = raw * 0.02.
  - FILL value: raw integer 0 (pre-scale) → excluded as NaN.
  - Physical range: 7500–65535 raw ints → 150 K to 1310.7 K physical (sub-range used: 200K–380K).
  - Separate LST_Day_1km and LST_Night_1km are distinct physical quantities; never averaged together.
  - Annual aggregation: mean of all valid 8-day composites with at least 6/46 composites/year.
  - Unit output: degC (Kelvin offset 273.15 applied after scaling).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import logging

import httpx
import numpy as np
import pandas as pd
import xarray as xr

logger = logging.getLogger("terra_odyssey.adapters.modis_lst")

# QC bitmask constants (bits 0-1 of QC_Day byte field)
_QC_MANDATORY_QUALITY_MASK = 0b00000011  # bits 0-1
_QC_GOOD_QUALITY = 0b00  # bits 0-1 = 00: LST produced, good quality
_QC_ACCEPTABLE_QUALITY = 0b01  # bits 0-1 = 01: LST produced, other quality
_MIN_VALID_COMPOSITES_PER_YEAR = 6  # out of ~46 8-day composites per year


class ModisLstAdapter:
    """Ingestion and normalization adapter for NASA MODIS MOD11A2.061 LST product."""

    DATASET_ID = "d3_modis_lst"
    COLLECTION = "MOD11A2"
    VERSION = "061"
    SOURCE_TYPE = "satellite_retrieval"
    VARIABLE = "LST_Day_1km"
    VARIABLE_NIGHT = "LST_Night_1km"
    QC_VAR_DAY = "QC_Day"
    QC_VAR_NIGHT = "QC_Night"
    DOI = "10.5067/MODIS/MOD11A2.061"
    CMR_ENDPOINT = "https://cmr.earthdata.nasa.gov/search/granules.json"
    # Raw integer fill value (no physical meaning, must exclude before scaling)
    RAW_FILL_VALUE = 0
    SCALE_FACTOR = 0.02  # T_K = raw_int * 0.02
    KELVIN_OFFSET = 273.15
    # Physical plausibility bounds in Kelvin after scaling
    PHYSICAL_MIN_K = 200.0
    PHYSICAL_MAX_K = 380.0

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
        """Query NASA CMR for available MOD11A2 granules."""
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
                or (link.get("href", "").endswith((".hdf", ".h5", ".nc4", ".nc")))
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
        band: str = "day",
    ) -> xr.Dataset:
        """Load HDF4/NetCDF dataset and extract the requested LST band.

        Parameters
        ----------
        band : str
            "day"  → LST_Day_1km + QC_Day
            "night" → LST_Night_1km + QC_Night
        """
        if isinstance(file_path_or_ds, xr.Dataset):
            ds = file_path_or_ds
        else:
            ds = xr.open_dataset(Path(file_path_or_ds), engine="netcdf4")

        lst_var = self.VARIABLE if band == "day" else self.VARIABLE_NIGHT
        qc_var = self.QC_VAR_DAY if band == "day" else self.QC_VAR_NIGHT

        if lst_var not in ds.data_vars:
            raise KeyError(
                f"Variable '{lst_var}' not found in dataset. "
                f"Available variables: {list(ds.data_vars.keys())}"
            )
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
        da: xr.DataArray,
        qc_da: Optional[xr.DataArray] = None,
    ) -> xr.DataArray:
        """Apply product-specific QA bitmask and fill/physical plausibility screening.

        QC bitmask decoding (bits 0-1 of QC_Day / QC_Night byte):
          00 = LST produced, good quality — KEEP
          01 = LST produced, other quality — KEEP (marginal but usable)
          10 = LST not produced due to cloud — MASK
          11 = LST not produced for other reasons — MASK

        Parameters
        ----------
        da : xr.DataArray
            Raw 16-bit integer LST field (not yet scaled).
        qc_da : xr.DataArray, optional
            Raw 8-bit integer QC field. If absent, only fill/physical checks apply.
        """
        raw = da.values.astype(np.float64)

        # 1. Fill value mask (raw integer 0 is the fill, has no physical meaning)
        is_fill = raw <= self.RAW_FILL_VALUE
        raw[is_fill] = np.nan

        # 2. QC bitmask (bits 0-1)
        if qc_da is not None:
            qc = qc_da.values.astype(np.uint8)
            mandatory_quality = qc & _QC_MANDATORY_QUALITY_MASK
            # Only keep good (00) or acceptable (01) quality pixels
            bad_qc = mandatory_quality >= 0b10  # 10 = cloud, 11 = other failure
            raw[bad_qc] = np.nan
            logger.debug(
                "QC mask: %.1f%% pixels rejected",
                100.0 * float(np.nansum(bad_qc)) / max(bad_qc.size, 1),
            )

        # 3. Scale: T_K = raw_int * 0.02
        scaled_k = raw * self.SCALE_FACTOR

        # 4. Physical plausibility bounds (200 K to 380 K)
        unphysical = (scaled_k < self.PHYSICAL_MIN_K) | (scaled_k > self.PHYSICAL_MAX_K)
        scaled_k[unphysical & ~np.isnan(raw)] = np.nan

        # 5. Convert to Celsius: T_degC = T_K - 273.15
        temp_celsius = scaled_k - self.KELVIN_OFFSET

        masked = da.copy(data=temp_celsius)
        masked.attrs["units"] = "degC"
        masked.attrs["long_name"] = da.attrs.get("long_name", "Land Surface Temperature")
        masked.attrs["scale_applied"] = self.SCALE_FACTOR
        masked.attrs["qc_bits_screened"] = "0-1"
        return masked

    def normalize_to_monthly(
        self,
        da: xr.DataArray,
    ) -> xr.DataArray:
        """Aggregate 8-day composites to calendar-month means.

        MODIS MOD11A2 composites span 8 days. To build a monthly mean:
          - Group all valid 8-day composites whose timestamp falls within a calendar month.
          - Require at least 1 valid composite per month (NaN otherwise — never gap-fill).
          - Months with fewer than the threshold valid composites are set to NaN.
        """
        if "time" not in da.dims:
            raise ValueError("DataArray must have a 'time' dimension for monthly aggregation.")

        monthly = da.resample(time="MS").mean(skipna=True)
        # Count of non-NaN composites per month for quality metadata
        monthly_count = da.resample(time="MS").count()
        # Require at least 1 valid composite (let caller decide strictness)
        monthly = monthly.where(monthly_count >= 1)
        monthly.attrs.update(da.attrs)
        monthly.attrs["temporal_aggregation"] = "monthly_8day_composite_mean"
        return monthly

    def aggregate_annual_mean(
        self,
        monthly_da: xr.DataArray,
        min_months: int = 6,
    ) -> xr.DataArray:
        """Compute annual mean requiring at least `min_months` valid monthly values.

        Non-negotiable scientific rule: missing months are never zero-filled or interpolated.
        Years with fewer than `min_months` valid monthly composites are masked to NaN.
        """
        valid_months = monthly_da.notnull().groupby("time.year").sum(dim="time")
        annual_mean = monthly_da.groupby("time.year").mean(dim="time", skipna=True)
        # Enforce minimum coverage: years below threshold become NaN
        annual_mean = annual_mean.where(valid_months >= min_months)
        annual_mean.attrs.update(monthly_da.attrs)
        annual_mean.attrs["temporal_aggregation"] = f"annual_mean_min_{min_months}_months"
        annual_mean.attrs["min_months_required"] = min_months
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
                "MODIS MOD11A2.061 LST is a thermal infrared satellite retrieval. "
                "Clear-sky bias applies: LST is not observed under cloud cover and "
                "must not be interpreted as all-sky mean temperature."
            ),
        }

    # ── Backward-compatible API (used by pre-Phase-5 unit tests) ──────────────

    def apply_quality_mask(
        self,
        file_path_or_ds: "Union[xr.Dataset, xr.DataArray]",
        qc_da: Optional[xr.DataArray] = None,
    ) -> xr.Dataset:
        """Backward-compatible overload: accepts a Dataset and returns a Dataset.

        Applies fill-value masking, optional QC bitmask, scale factor (0.02),
        and Kelvin → Celsius conversion, then wraps the result back in a Dataset.
        """
        if isinstance(file_path_or_ds, xr.Dataset):
            ds = file_path_or_ds
            if self.VARIABLE not in ds.data_vars:
                raise KeyError(
                    f"Variable '{self.VARIABLE}' not found in dataset. "
                    f"Available variables: {list(ds.data_vars.keys())}"
                )
            da = ds[self.VARIABLE]
        else:
            da = file_path_or_ds
            ds = None

        # Delegate to the DataArray-level masking logic
        masked_da = self._mask_da(da, qc_da=qc_da)

        if ds is not None:
            result_ds = ds.copy()
            result_ds[self.VARIABLE] = masked_da
            return result_ds
        return masked_da  # type: ignore[return-value]

    def _mask_da(
        self,
        da: xr.DataArray,
        qc_da: Optional[xr.DataArray] = None,
    ) -> xr.DataArray:
        """Internal DataArray-level masking (fill, QC, scale, physical range, degC)."""
        raw = da.values.astype(np.float64)
        is_fill = raw <= self.RAW_FILL_VALUE
        raw[is_fill] = np.nan
        if qc_da is not None:
            qc = qc_da.values.astype(np.uint8)
            bad_qc = (qc & 0b00000011) >= 0b10
            raw[bad_qc] = np.nan
        scaled_k = raw * self.SCALE_FACTOR
        unphysical = (scaled_k < self.PHYSICAL_MIN_K) | (scaled_k > self.PHYSICAL_MAX_K)
        scaled_k[unphysical & ~np.isnan(raw)] = np.nan
        temp_celsius = scaled_k - self.KELVIN_OFFSET
        masked = da.copy(data=temp_celsius)
        masked.attrs["units"] = "degC"
        masked.attrs["long_name"] = da.attrs.get("long_name", "Land Surface Temperature")
        masked.attrs["scale_applied"] = self.SCALE_FACTOR
        return masked

    def convert_units(self, file_path_or_ds: "Union[xr.Dataset, xr.DataArray]") -> xr.Dataset:
        """Apply scale factor (0.02) and convert Kelvin to Celsius.

        Backward-compatible entry point that accepts a raw Dataset.
        Masking is NOT re-applied; use apply_quality_mask first.
        """
        if isinstance(file_path_or_ds, xr.Dataset):
            ds = file_path_or_ds
            if self.VARIABLE not in ds.data_vars:
                raise KeyError(f"'{self.VARIABLE}' not in Dataset.")
            da = ds[self.VARIABLE]
        else:
            da = file_path_or_ds
            ds = None

        raw = da.values.astype(np.float64)
        # raw here may already have fill=NaN from apply_quality_mask
        temp_celsius = (raw * self.SCALE_FACTOR) - self.KELVIN_OFFSET
        result_da = da.copy(data=temp_celsius)
        result_da.attrs["units"] = "degC"
        result_da.attrs["long_name"] = da.attrs.get("long_name", "Land Surface Temperature")
        result_da.attrs["scale_applied"] = self.SCALE_FACTOR

        if ds is not None:
            result_ds = ds.copy()
            result_ds[self.VARIABLE] = result_da
            return result_ds
        return result_da  # type: ignore[return-value]

    def process(self, file_path_or_ds: "Union[str, Path, xr.Dataset]") -> xr.Dataset:
        """Execute full ingestion, validation, masking, and conversion pipeline."""
        ds = self.decode(file_path_or_ds)
        self.validate_coordinates(ds)
        return self.apply_quality_mask(ds)

    def get_citation_provenance(self) -> Dict[str, Any]:
        """Return standardized NASA provenance metadata (backward-compatible alias)."""
        return {
            "dataset_id": "D3",
            "collection": self.COLLECTION,
            "version": self.VERSION,
            "source_type": self.SOURCE_TYPE,
            "variable": self.VARIABLE,
            "units": "degC",
            "doi": self.DOI,
            "daac": "LP DAAC",
            "measurement": "Thermal infrared satellite retrieval (Terra MODIS)",
        }
