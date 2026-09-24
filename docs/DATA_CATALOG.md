# Data catalog — quick coding reference

The long scientific blueprint contains the full catalog. These four records are
the default implementation surface; all access must resolve the current NASA
collection/version through CMR or the official provider rather than guessing a
file URL.

| ID | Product | Role | Native support | Initial use | Main caveat |
|---|---|---|---|---|---|
| D1 | MERRA-2 `M2TMNXSLV` v5.12.4, `T2M` | Core | Monthly, global 0.5° × 0.625°, from 1980 | 1981–2025 temperature trends; 2001–2025 comparisons | Reanalysis/model-data-assimilation output; observing-system changes |
| D2 | GPM IMERG Final `GPM_3IMERGM` v07 | Core | Monthly, global 0.1°, from 2000 | 2001–2025 annual precipitation accumulation and contrasts | Satellite/gauge mixture, terrain/snow, delayed Final stream |
| D3 | MODIS `MOD11A2.061` | Supporting | 8-day, nominal 1 km, from 2000 | Selected regional day/night LST | Clear-sky sampling, QA bits, compositing, Terra orbit changes |
| D4 | MODIS `MOD13A3.061` | Supporting | Monthly, nominal 1 km, from 2000 | Selected regional NDVI/EVI | QA, aerosols, snow/cloud, not yield or carbon flux |

## Access contract

1. Resolve the collection and version with CMR.
2. Record collection concept ID, version, granules, checksums, retrieval time,
   and documentation URLs in `dataset-manifest.schema.json` form.
3. Acquire a sample granule and validate dimensions, coordinates, units, scale,
   fill values, date, and QA before historical download.
4. Store raw files immutably; normalize into versioned cubes.
5. Quarantine malformed or incomplete inputs; never silently drop them.

## Optional modules

D5 GRACE/GRACE-FO storage, D6 SMAP L4 moisture, D7 CERES EBAF energy flux, D8
MODIS snow, and D9 GISTEMP are documented in the long blueprint. Add one at a
time only after core validation. D6 is descriptive short-record context, and
D5 requires gap-aware basin analysis; neither should be forced into the default
trend test.

## Source links

- MERRA-2: https://doi.org/10.5067/AP1B0BA5PD2K
- IMERG: https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07
- MOD11A2: https://doi.org/10.5067/MODIS/MOD11A2.061
- MOD13A3: https://doi.org/10.5067/MODIS/MOD13A3.061
- NASA CMR: https://cmr.earthdata.nasa.gov/search/collections.json
- Earthdata Search: https://search.earthdata.nasa.gov/

