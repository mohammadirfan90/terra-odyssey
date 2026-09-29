"""Terra Odyssey NASA Data Adapters.

This module provides normalized ingestion adapters for NASA Earth observation
products, handling CMR collection discovery, decoding, fill-value masking,
unit conversion, and citation provenance.
"""

from .d1_merra2 import Merra2Adapter
from .d2_gpm_imerg import GpmImergAdapter
from .d3_modis_lst import ModisLstAdapter
from .d4_modis_ndvi import ModisNdviAdapter
from .d5_gistemp import GistempAdapter
from .d6_nsidc_seaice import NsidcSeaIceAdapter
from .d7_noaa_oisst import NoaaOisstAdapter
from .d8_grace_tws import GraceTwsAdapter
from .d9_ceres_ebaf import CeresEbafAdapter
from .d29_merra2_precip import Merra2PrecipAdapter
from .d30_merra2_aod import Merra2AodAdapter
from .d31_airs_co import AIRSCOAdapter
from .d32_airs_precip import AIRSPrecipAdapter
from .d33_ghrsst_mur import GhrsstMurAdapter
from .d34_aquarius_sss import AquariusSSSAdapter
from .d35_smap_sss import SmapSssAdapter
from .d36_aviso_ssh import AvisoSshAdapter
from .climate_index import ClimateIndexAdapter

__all__ = [
    "Merra2Adapter",
    "GpmImergAdapter",
    "ModisLstAdapter",
    "ModisNdviAdapter",
    "GistempAdapter",
    "NsidcSeaIceAdapter",
    "NoaaOisstAdapter",
    "GraceTwsAdapter",
    "CeresEbafAdapter",
    "Merra2PrecipAdapter",
    "Merra2AodAdapter",
    "AIRSCOAdapter",
    "AIRSPrecipAdapter",
    "GhrsstMurAdapter",
    "AquariusSSSAdapter",
    "SmapSssAdapter",
    "AvisoSshAdapter",
    "ClimateIndexAdapter",
]
