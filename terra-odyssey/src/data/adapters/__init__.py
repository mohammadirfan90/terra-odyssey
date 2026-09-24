"""Terra Odyssey NASA Data Adapters.

This module provides normalized ingestion adapters for NASA Earth observation
products, handling CMR collection discovery, decoding, fill-value masking,
unit conversion, and citation provenance.
"""

from .d1_merra2 import Merra2Adapter
from .d2_gpm_imerg import GpmImergAdapter

__all__ = ["Merra2Adapter", "GpmImergAdapter"]
