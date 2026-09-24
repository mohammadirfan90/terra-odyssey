"""Synthetic GPM IMERG test fixture generator.

Generates labeled synthetic xarray Datasets matching the GPM_3IMERGM data contract
for offline numerical and unit testing.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import xarray as xr


def generate_synthetic_gpm_cube(
    n_times: int = 12,
    n_lats: int = 10,
    n_lons: int = 12,
    insert_fill_values: bool = True,
) -> xr.Dataset:
    """Generate synthetic GPM IMERG netCDF-compatible Dataset.

    Parameters:
        n_times: Number of monthly intervals.
        n_lats: Number of latitude points.
        n_lons: Number of longitude points.
        insert_fill_values: Whether to include explicit -9999.9 fill values.
    """
    times = pd.date_range("2021-01-01", periods=n_times, freq="MS")
    lats = np.linspace(-60.0, 60.0, n_lats, dtype=np.float32)
    lons = np.linspace(-170.0, 170.0, n_lons, dtype=np.float32)

    # Base precipitation rate: ~0.15 mm/hr (~100 mm/month) with tropics peak
    data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)

    for t_idx in range(n_times):
        seasonal_cycle = 0.05 * np.cos(2 * np.pi * t_idx / 12.0)
        for lat_idx, lat in enumerate(lats):
            # Higher rain near equator (ITCZ)
            itcz_effect = max(0.0, 0.25 * (1.0 - abs(lat) / 30.0))
            data[t_idx, lat_idx, :] = 0.10 + itcz_effect + seasonal_cycle

    if insert_fill_values and n_times > 0 and n_lats > 0 and n_lons > 0:
        data[0, 0, 0] = -9999.9
        data[1, 1, 1] = -9999.9
        # Also negative physically impossible rate
        data[2, 2, 2] = -0.5

    ds = xr.Dataset(
        data_vars={
            "precipitationCal": (
                ("time", "lat", "lon"),
                data,
                {
                    "units": "mm/hr",
                    "long_name": "Multi-satellite precipitation estimate with gauge calibration",
                    "standard_name": "precipitation_flux",
                    "_FillValue": -9999.9,
                },
            )
        },
        coords={
            "time": times,
            "lat": lats,
            "lon": lons,
        },
        attrs={
            "title": "Synthetic GPM IMERG Test Dataset",
            "source_type": "mission_product",
            "version": "07",
            "collection": "GPM_3IMERGM",
        },
    )
    return ds
