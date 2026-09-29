"""Climate Index Adapter for NOAA Climate Prediction Center / NCEI Indices.

Covers standardized global climate teleconnection patterns:
- Oceanic Niño Index (ONI)
- North Atlantic Oscillation (NAO)
- Atlantic Multidecadal Oscillation (AMO)
- Pacific Decadal Oscillation (PDO)
- Indian Ocean Dipole (IOD / DMI)
- Arctic Oscillation (AO)
- Multivariate ENSO Index (MEI)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import numpy as np
import xarray as xr


class ClimateIndexAdapter:
    """Ingestion and normalization adapter for NOAA climate teleconnection indices."""

    DATASET_ID = "CLIMATE_INDEX"
    COLLECTION = "NOAA_CPC_INDEX"
    VERSION = "1.0"
    SOURCE_TYPE = "surface_observation_analysis"

    def __init__(self, timeout: float = 30.0) -> None:
        self.timeout = timeout

    def discover(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        return []

    def decode(self, dataset_or_path: Union[str, Path, xr.Dataset]) -> xr.DataArray:
        if isinstance(dataset_or_path, xr.Dataset):
            ds = dataset_or_path
        else:
            ds = xr.open_dataset(dataset_or_path)

        data_vars = list(ds.data_vars)
        if not data_vars:
            raise KeyError("Dataset contains no data variables")
        # Return first available data variable
        return ds[data_vars[0]]

    def validate(self, da: xr.DataArray) -> bool:
        if "time" not in da.coords and "year" not in da.coords:
            raise ValueError("Missing time coordinate in climate index data array")
        return True

    def quality_mask(self, da: xr.DataArray) -> xr.DataArray:
        # Standard anomaly screening: extreme outliers > 10 sigma masked
        return da.where(np.abs(da) < 20.0, other=np.nan)

    def convert_units(self, da: xr.DataArray) -> xr.DataArray:
        out = da.copy()
        if "units" not in out.attrs:
            out.attrs["units"] = "anomaly"
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
            "provider": "NOAA Climate Prediction Center / NCEI",
            "documentation": "https://www.cpc.ncep.noaa.gov/",
            "scientific_note": (
                "Standardized climate indices derived from historical sea surface "
                "temperature and atmospheric geopotential height observations."
            ),
        }
