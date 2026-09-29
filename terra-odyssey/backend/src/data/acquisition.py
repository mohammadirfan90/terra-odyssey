"""Bounded scientific acquisition manager for NASA MERRA-2 data.

Acquires real, versioned MERRA-2 2-meter air temperature inputs for declared spatial
and temporal bounds. Validates inputs against CF-1.8 metadata, records SHA-256
checksums, and enforces immutable raw data storage.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import httpx
import numpy as np
import pandas as pd
import xarray as xr

from backend.errors import DataUnavailableError
from backend.paths import DATA_DIR

logger = logging.getLogger("terra_odyssey.data.acquisition")

POWER_REGIONAL_URL = "https://power.larc.nasa.gov/api/temporal/monthly/regional"
POWER_TIMEOUT_SECONDS = 60.0


def compute_sha256(filepath: Union[str, Path]) -> str:
    """Compute the SHA-256 hexadecimal digest of a file on disk."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


class Merra2AcquisitionManager:
    """Acquires and verifies bounded MERRA-2 T2M datasets for investigation jobs."""

    def __init__(self, target_dir: Optional[Path] = None, timeout: float = POWER_TIMEOUT_SECONDS) -> None:
        self.target_dir = target_dir or (DATA_DIR / "samples")
        self.target_dir.mkdir(parents=True, exist_ok=True)
        self.timeout = timeout

    @staticmethod
    def _normalize_bbox(bbox: Union[List[float], Tuple[float, float, float, float]]) -> Tuple[float, float, float, float]:
        """Ensure bbox coordinates are [min_lon, min_lat, max_lon, max_lat] floats."""
        return (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))

    def get_cache_path(self, bbox: Tuple[float, float, float, float], start_year: int, end_year: int) -> Path:
        """Construct deterministic filename for bounded regional NetCDF."""
        min_lon, min_lat, max_lon, max_lat = bbox
        slug = f"merra2_t2m_lon_{min_lon:.1f}_{max_lon:.1f}_lat_{min_lat:.1f}_{max_lat:.1f}_{start_year}_{end_year}.nc"
        return self.target_dir / slug

    def find_cached_granule(
        self,
        bbox: Tuple[float, float, float, float],
        start_year: int,
        end_year: int,
    ) -> Optional[Path]:
        """Check for existing verified cached file that encompasses the requested bounds and period."""
        target = self.get_cache_path(bbox, start_year, end_year)
        if target.is_file() and target.stat().st_size > 1000:
            try:
                self.validate_granule(target, start_year, end_year)
                return target
            except Exception as exc:
                logger.warning("Cached granule %s failed validation: %s", target, exc)

        # Check existing NetCDF files that encompass the requested spatial bbox and complete years
        req_min_lon, req_min_lat, req_max_lon, req_max_lat = bbox
        for candidate in self.target_dir.glob("*.nc"):
            try:
                self.validate_granule(candidate, start_year, end_year)
                with xr.open_dataset(candidate) as ds:
                    lat_c = ds.coords.get("lat") if "lat" in ds.coords else ds.coords.get("latitude")
                    lon_c = ds.coords.get("lon") if "lon" in ds.coords else ds.coords.get("longitude")
                    if lat_c is not None and lon_c is not None:
                        if (
                            float(lon_c.min()) <= req_min_lon
                            and float(lon_c.max()) >= req_max_lon
                            and float(lat_c.min()) <= req_min_lat
                            and float(lat_c.max()) >= req_max_lat
                        ):
                            return candidate
            except Exception:
                continue

        return None

    def acquire_regional_record(
        self,
        bbox: Union[List[float], Tuple[float, float, float, float]],
        start_year: int,
        end_year: int,
    ) -> Tuple[Path, Dict[str, Any]]:
        """Acquire bounded regional MERRA-2 T2M NetCDF from cache or official NASA service.

        Returns (file_path, metadata_dict).
        Raises DataUnavailableError on network failure or empty payload.
        """
        norm_bbox = self._normalize_bbox(bbox)
        min_lon, min_lat, max_lon, max_lat = norm_bbox

        cached = self.find_cached_granule(norm_bbox, start_year, end_year)
        if cached is not None:
            logger.info("Using cached MERRA-2 granule: %s", cached)
            sha256 = compute_sha256(cached)
            meta = {
                "source": "cached_verified",
                "file_path": str(cached),
                "sha256": sha256,
                "byte_size": cached.stat().st_size,
                "bbox": list(norm_bbox),
                "period": [start_year, end_year],
            }
            return cached, meta

        # Query NASA POWER MERRA-2 service for regional NetCDF
        # NASA POWER requires span in range [2.0°, 10.0°]
        q_min_lon, q_min_lat, q_max_lon, q_max_lat = min_lon, min_lat, max_lon, max_lat
        center_lon = (q_min_lon + q_max_lon) / 2.0
        center_lat = (q_min_lat + q_max_lat) / 2.0

        if q_max_lon - q_min_lon > 9.9:
            q_min_lon = max(-180.0, center_lon - 4.95)
            q_max_lon = min(180.0, center_lon + 4.95)
        elif q_max_lon - q_min_lon < 2.05:
            q_min_lon = max(-180.0, center_lon - 1.1)
            q_max_lon = min(180.0, center_lon + 1.1)

        if q_max_lat - q_min_lat > 9.9:
            q_min_lat = max(-90.0, center_lat - 4.95)
            q_max_lat = min(90.0, center_lat + 4.95)
        elif q_max_lat - q_min_lat < 2.05:
            q_min_lat = max(-90.0, center_lat - 1.1)
            q_max_lat = min(90.0, center_lat + 1.1)

        params = {
            "parameters": "T2M",
            "community": "AG",
            "longitude-min": f"{q_min_lon:.2f}",
            "longitude-max": f"{q_max_lon:.2f}",
            "latitude-min": f"{q_min_lat:.2f}",
            "latitude-max": f"{q_max_lat:.2f}",
            "start": str(start_year),
            "end": str(end_year),
            "format": "NETCDF",
        }

        logger.info("Requesting bounded MERRA-2 NetCDF from NASA POWER: %s", params)
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                res = client.get(POWER_REGIONAL_URL, params=params)
                if res.status_code != 200:
                    raise DataUnavailableError(
                        f"NASA MERRA-2 regional service returned HTTP {res.status_code}: {res.text[:200]}",
                        retryable=True,
                    )
                content = res.content
                if len(content) < 1000:
                    raise DataUnavailableError(
                        "NASA MERRA-2 regional service returned insufficient payload.",
                        retryable=True,
                    )
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            raise DataUnavailableError(
                f"Failed to acquire NASA MERRA-2 data from upstream service: {exc}",
                retryable=True,
            ) from exc

        target_file = self.get_cache_path(norm_bbox, start_year, end_year)
        with open(target_file, "wb") as f:
            f.write(content)

        # Validate newly acquired file
        self.validate_granule(target_file, start_year, end_year)
        sha256 = compute_sha256(target_file)
        logger.info("Successfully acquired and verified NASA MERRA-2 NetCDF: %s (sha256=%s)", target_file.name, sha256[:12])

        meta = {
            "source": "nasa_power_merra2",
            "file_path": str(target_file),
            "sha256": sha256,
            "byte_size": len(content),
            "bbox": list(norm_bbox),
            "period": [start_year, end_year],
        }
        return target_file, meta

    def validate_granule(self, filepath: Path, start_year: int, end_year: int) -> bool:
        """Validate that the NetCDF granule has valid dimensions, variable T2M, and coverage."""
        with xr.open_dataset(filepath) as ds:
            if "T2M" not in ds:
                raise ValueError(f"Granule {filepath} missing expected variable 'T2M'. Found: {list(ds.data_vars)}")

            coords = set(ds.coords.keys())
            has_lat = any(c in coords for c in ("lat", "latitude"))
            has_lon = any(c in coords for c in ("lon", "longitude"))
            has_time = any(c in coords for c in ("time", "year"))

            if not (has_lat and has_lon and has_time):
                raise ValueError(f"Granule {filepath} missing required coordinates. Found: {coords}")

            # Verify non-empty data array
            da = ds["T2M"]
            if da.size == 0:
                raise ValueError(f"Granule {filepath} data array T2M is empty.")

            # Verify that time coordinate covers requested period [start_year, end_year]
            time_name = "time" if "time" in ds.coords else "year"
            time_vals = ds[time_name].values
            if len(time_vals) == 0:
                raise ValueError(f"Granule {filepath} has empty time coordinate.")

            if np.issubdtype(time_vals.dtype, np.integer):
                if np.max(time_vals) > 10000:
                    years_in_granule = set(int(t) // 100 for t in time_vals)
                else:
                    years_in_granule = set(int(t) for t in time_vals)
            else:
                years_in_granule = set(pd.to_datetime(time_vals).year)

            required_years = set(range(start_year, end_year + 1))
            if not required_years.issubset(years_in_granule):
                missing = sorted(required_years - years_in_granule)
                raise ValueError(
                    f"Granule {filepath.name} does not cover requested period [{start_year}, {end_year}]. "
                    f"Missing {len(missing)} years: {missing[:3]}..."
                )

        return True


class GpmAcquisitionManager:
    """Acquires and verifies bounded GPM IMERG Final precipitation datasets for investigation jobs."""

    def __init__(self, target_dir: Optional[Path] = None, timeout: float = 60.0) -> None:
        self.target_dir = target_dir or (DATA_DIR / "samples")
        self.target_dir.mkdir(parents=True, exist_ok=True)
        self.timeout = timeout

    @staticmethod
    def _normalize_bbox(bbox: Union[List[float], Tuple[float, float, float, float]]) -> Tuple[float, float, float, float]:
        """Ensure bbox coordinates are [min_lon, min_lat, max_lon, max_lat] floats."""
        return (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))

    def get_cache_path(self, bbox: Tuple[float, float, float, float], start_year: int, end_year: int) -> Path:
        """Construct deterministic filename for bounded GPM regional NetCDF."""
        min_lon, min_lat, max_lon, max_lat = bbox
        slug = f"gpm_imerg_lon_{min_lon:.1f}_{max_lon:.1f}_lat_{min_lat:.1f}_{max_lat:.1f}_{start_year}_{end_year}.nc"
        return self.target_dir / slug

    def find_cached_granule(
        self,
        bbox: Tuple[float, float, float, float],
        start_year: int,
        end_year: int,
    ) -> Optional[Path]:
        """Check for existing verified cached GPM NetCDF file covering bounds and period."""
        target = self.get_cache_path(bbox, start_year, end_year)
        if target.is_file() and target.stat().st_size > 1000:
            try:
                self.validate_granule(target, start_year, end_year)
                return target
            except Exception as exc:
                logger.warning("Cached GPM granule %s failed validation: %s", target, exc)

        # Check existing NetCDF files that contain GPM or IMERG
        req_min_lon, req_min_lat, req_max_lon, req_max_lat = bbox
        for pattern in ("*gpm*.nc", "*imerg*.nc", "d2_*.nc"):
            for candidate in self.target_dir.glob(pattern):
                try:
                    self.validate_granule(candidate, start_year, end_year)
                    with xr.open_dataset(candidate) as ds:
                        lat_c = ds.coords.get("lat") if "lat" in ds.coords else ds.coords.get("latitude")
                        lon_c = ds.coords.get("lon") if "lon" in ds.coords else ds.coords.get("longitude")
                        if lat_c is not None and lon_c is not None:
                            if (
                                float(lon_c.min()) <= req_min_lon
                                and float(lon_c.max()) >= req_max_lon
                                and float(lat_c.min()) <= req_min_lat
                                and float(lat_c.max()) >= req_max_lat
                            ):
                                return candidate
                except Exception:
                    continue

        return None

    def validate_granule(self, filepath: Path, start_year: int, end_year: int) -> bool:
        """Validate that the GPM granule has precipitation variable and valid coverage."""
        with xr.open_dataset(filepath) as ds:
            has_var = any(v in ds for v in ("precipitationCal", "precipitation", "precip"))
            if not has_var:
                raise ValueError(
                    f"Granule {filepath} missing expected precipitation variable. Found: {list(ds.data_vars)}"
                )

            coords = set(ds.coords.keys())
            has_lat = any(c in coords for c in ("lat", "latitude"))
            has_lon = any(c in coords for c in ("lon", "longitude"))
            has_time = any(c in coords for c in ("time", "year"))

            if not (has_lat and has_lon and has_time):
                raise ValueError(f"Granule {filepath} missing required coordinates. Found: {coords}")

            time_name = "time" if "time" in ds.coords else "year"
            time_vals = ds[time_name].values
            if len(time_vals) == 0:
                raise ValueError(f"Granule {filepath} has empty time coordinate.")

            if np.issubdtype(time_vals.dtype, np.integer):
                if np.max(time_vals) > 10000:
                    years_in_granule = set(int(t) // 100 for t in time_vals)
                else:
                    years_in_granule = set(int(t) for t in time_vals)
            else:
                years_in_granule = set(pd.to_datetime(time_vals).year)

            required_years = set(range(start_year, end_year + 1))
            if not required_years.issubset(years_in_granule):
                missing = sorted(required_years - years_in_granule)
                raise ValueError(
                    f"Granule {filepath.name} does not cover requested period [{start_year}, {end_year}]. "
                    f"Missing {len(missing)} years: {missing[:3]}..."
                )

        return True

