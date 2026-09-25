"""Terra Odyssey test fixtures."""

from .synthetic_merra2 import generate_synthetic_merra2_cube
from .synthetic_gpm import generate_synthetic_gpm_cube

__all__ = ["generate_synthetic_merra2_cube", "generate_synthetic_gpm_cube"]
