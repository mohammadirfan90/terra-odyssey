/**
 * NASA GIBS (Global Imagery Browse Services) WMTS integration for Terra Odyssey.
 *
 * Provides real NASA satellite imagery tiles synchronized to historical map dates.
 * Adheres to open EPSG:3857 (Web Mercator) WMTS endpoints without authentication.
 */

export interface GibsLayerDefinition {
  id: string;
  name: string;
  variable: string;
  tileMatrixSet: string;
  format: "jpg" | "png";
  startDate: string;
  endDate: string;
  resolution: string;
  description: string;
  attribution: string;
  legendUnit?: string;
  paletteType?: "temperature" | "precipitation" | "vegetation" | "ice" | "reflectance";
}

export const GIBS_AVAILABLE_LAYERS: Record<string, GibsLayerDefinition> = {
  MODIS_Terra_CorrectedReflectance_TrueColor: {
    id: "MODIS_Terra_CorrectedReflectance_TrueColor",
    name: "MODIS Terra True Color Reflectance",
    variable: "Surface Reflectance",
    tileMatrixSet: "GoogleMapsCompatible_Level9",
    format: "jpg",
    startDate: "2000-02-24",
    endDate: "2026-09-24",
    resolution: "250 m",
    description: "Daily natural-color satellite imagery from the Terra MODIS instrument.",
    attribution: "NASA EOSDIS GIBS / Terra MODIS",
    paletteType: "reflectance",
  },
  MODIS_Terra_Land_Surface_Temp_Day: {
    id: "MODIS_Terra_Land_Surface_Temp_Day",
    name: "MODIS Land Surface Temp (Day)",
    variable: "LST_Day_1km",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    format: "png",
    startDate: "2000-03-05",
    endDate: "2026-09-14",
    resolution: "1 km",
    description: "Daily clear-sky composite of daytime land surface skin temperature from MODIS Terra.",
    attribution: "NASA LP DAAC / MODIS",
    legendUnit: "°C",
    paletteType: "temperature",
  },
  IMERG_Precipitation_Rate: {
    id: "IMERG_Precipitation_Rate",
    name: "GPM IMERG Precipitation Rate",
    variable: "precipitationCal",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    format: "png",
    startDate: "2000-06-01",
    endDate: "2025-09-30",
    resolution: "0.1° (~10 km)",
    description: "Multi-satellite estimated precipitation rate from the Global Precipitation Measurement mission.",
    attribution: "NASA GES DISC / GPM",
    legendUnit: "mm/hr",
    paletteType: "precipitation",
  },
  MODIS_Terra_L3_NDVI_Monthly: {
    id: "MODIS_Terra_L3_NDVI_Monthly",
    name: "MODIS Vegetation Index (NDVI)",
    variable: "NDVI",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    format: "png",
    startDate: "2000-02-01",
    endDate: "2026-08-31",
    resolution: "1 km",
    description: "Monthly Normalized Difference Vegetation Index showing photosynthetic activity.",
    attribution: "NASA LP DAAC / MODIS",
    legendUnit: "NDVI",
    paletteType: "vegetation",
  },
  GHRSST_L4_MUR_Sea_Surface_Temperature: {
    id: "GHRSST_L4_MUR_Sea_Surface_Temperature",
    name: "MUR Sea Surface Temperature",
    variable: "sst",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    format: "png",
    startDate: "2002-06-01",
    endDate: "2026-09-20",
    resolution: "1 km",
    description: "Multi-scale Ultra-high Resolution sea surface temperature analysis.",
    attribution: "NASA JPL / PO.DAAC",
    legendUnit: "°C",
    paletteType: "temperature",
  },
  AIRS_Precipitation_Day: {
    id: "AIRS_Precipitation_Day",
    name: "AIRS Daily Precipitation",
    variable: "precipitation",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    format: "png",
    startDate: "2002-09-01",
    endDate: "2026-09-20",
    resolution: "1°",
    description: "Atmospheric Infrared Sounder daily retrieved precipitation estimate.",
    attribution: "NASA GES DISC / AIRS",
    legendUnit: "mm/day",
    paletteType: "precipitation",
  },
};

/**
 * Dataset ID to default GIBS layer mapping.
 */
export const DATASET_TO_GIBS_LAYER: Record<string, string> = {
  merra2_t2m: "MODIS_Terra_Land_Surface_Temp_Day",
  gpm_imerg_precipitation: "IMERG_Precipitation_Rate",
  d3_modis_lst: "MODIS_Terra_Land_Surface_Temp_Day",
  d4_modis_ndvi: "MODIS_Terra_L3_NDVI_Monthly",
  nsidc_sea_ice: "GHRSST_L4_MUR_Sea_Surface_Temperature",
  noaa_oisst: "GHRSST_L4_MUR_Sea_Surface_Temperature",
  gistemp_v4: "MODIS_Terra_Land_Surface_Temp_Day",
  ceres_ebaf: "MODIS_Terra_CorrectedReflectance_TrueColor",
  grace_tws: "MODIS_Terra_CorrectedReflectance_TrueColor",
};

/**
 * Construct a standard Web Mercator WMTS tile URL template for a specific date,
 * gracefully clamping to the valid date range so a layer is always visible.
 */
export function buildGibsTileUrl(
  layerId: string,
  dateStr?: string, // YYYY-MM-DD
): { urlTemplate: string; isAvailable: boolean; effectiveDate: string; reason?: string } {
  // Fall back to True Color reflectance if unknown
  const resolvedLayerId = GIBS_AVAILABLE_LAYERS[layerId]
    ? layerId
    : "MODIS_Terra_CorrectedReflectance_TrueColor";
  const layer = GIBS_AVAILABLE_LAYERS[resolvedLayerId];

  let targetDate = (dateStr || "2024-06-15").trim();

  // Clamp date to available range
  if (targetDate < layer.startDate) {
    targetDate = layer.startDate;
  } else if (targetDate > layer.endDate) {
    targetDate = layer.endDate;
  }

  // NASA GIBS WMTS URL pattern:
  // https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/{tileMatrixSet}/{z}/{y}/{x}.{format}
  const urlTemplate = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${targetDate}/${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.format}`;

  return {
    urlTemplate,
    isAvailable: true,
    effectiveDate: targetDate,
  };
}
