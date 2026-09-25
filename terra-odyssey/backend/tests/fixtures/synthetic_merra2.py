"""Synthetic MERRA-2 test fixture generator.

Generates labeled synthetic xarray Datasets matching the MERRA-2 M2TMNXSLV
data contract for offline numerical and unit testing.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import xarray as xr


def generate_synthetic_merra2_cube(
    n_times: int = 12,
    n_lats: int = 10,
    n_lons: int = 12,
    insert_fill_values: bool = True,
) -> xr.Dataset:
    """Generate synthetic MERRA-2 netCDF-compatible Dataset.

    Parameters:
        n_times: Number of monthly intervals.
        n_lats: Number of latitude points.
        n_lons: Number of longitude points.
        insert_fill_values: Whether to include explicit 1.0e15 fill values.
    """
    times = pd.date_range("2020-01-01", periods=n_times, freq="MS")
    lats = np.linspace(-80.0, 80.0, n_lats, dtype=np.float32)
    lons = np.linspace(-170.0, 170.0, n_lons, dtype=np.float32)

    # Base temperature: 273.15 K (0 °C) + latitude gradient + seasonal cycle
    t_base = 273.15
    data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)

    for t_idx in range(n_times):
        seasonal_offset = 15.0 * np.sin(2 * np.pi * t_idx / 12.0)
        for lat_idx, lat in enumerate(lats):
            lat_effect = (1.0 - abs(lat) / 90.0) * 20.0
            data[t_idx, lat_idx, :] = t_base + lat_effect + seasonal_offset

    if insert_fill_values and n_times > 0 and n_lats > 0 and n_lons > 0:
        data[0, 0, 0] = 1.0e15
        data[1, 1, 1] = 1.0e15

    ds = xr.Dataset(
        data_vars={
            "T2M": (
                ("time", "lat", "lon"),
                data,
                {
                    "units": "K",
                    "long_name": "2-meter air temperature",
                    "standard_name": "air_temperature",
                    "fmissing_value": 1.0e15,
                },
            )
        },
        coords={
            "time": times,
            "lat": lats,
            "lon": lons,
        },
        attrs={
            "title": "Synthetic MERRA-2 Test Dataset",
            "source_type": "model_reanalysis",
            "version": "5.12.4",
            "collection": "M2TMNXSLV",
        },
    )
    return ds
