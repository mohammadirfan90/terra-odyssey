# Terra Odyssey — API Contract V2

This document defines the canonical HTTP/REST and Server-Sent Events (SSE) contract for the Terra Odyssey Scientific Backend API (v2). The API exposes dataset discovery, investigation orchestration, structured grid delivery, linked time-series retrieval, and reproducible bundle exports.

---

## 1. Protocol Conventions

- **Base URL**: `/api/v1`
- **Default Media Type**: `application/json`
- **Error Media Type**: `application/problem+json` (compliant with [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457))
- **Event Stream**: `text/event-stream` for investigation job lifecycle updates
- **Encoding**: UTF-8
- **Coordinates**: Bounding boxes formatted as `[min_lon, min_lat, max_lon, max_lat]` with longitude $\in [-180, 180]$ and latitude $\in [-90, 90]$.

---

## 2. API Endpoints

### 2.1 Capabilities
`GET /api/v1/capabilities`

Returns runtime metadata, supported datasets, statistical estimators, and export formats.

#### Response (200 OK)
```json
{
  "system_version": "0.1.0-mvp",
  "api_version": "v1",
  "supported_datasets": [
    "merra2_t2m",
    "gpm_imerg",
    "d3_modis_lst",
    "d4_modis_ndvi"
  ],
  "supported_estimators": [
    "ols_hac",
    "theil_sen",
    "modified_mann_kendall",
    "block_bootstrap"
  ],
  "export_formats": ["json", "csv", "zip", "report"]
}
```

---

### 2.2 Dataset Catalog
`GET /api/v1/catalog`

Lists registered NASA products with their collection names, versions, DAAC endpoints, physical variables, and temporal support.

#### Response (200 OK)
```json
{
  "datasets": [
    {
      "id": "merra2_t2m",
      "title": "MERRA-2 2-Meter Air Temperature (Monthly)",
      "collection": "M2TMNXSLV",
      "version": "5.12.4",
      "daac": "NASA GES DISC",
      "doi": "10.5067/AP1B0BA5PD2Z",
      "temporal_range": {
        "start": "1980-01-01",
        "end": "2024-12-31"
      },
      "spatial_resolution": "0.5° × 0.625°",
      "variables": [
        {
          "name": "T2M",
          "units": "degC",
          "long_name": "2-Meter Air Temperature"
        }
      ]
    },
    {
      "id": "gpm_imerg",
      "title": "GPM IMERG Final Precipitation L3 1 Month 0.1 Degree V07B",
      "collection": "GPM_3IMERGM",
      "version": "07B",
      "daac": "NASA GES DISC",
      "doi": "10.5067/GPM/IMERG/3B-MONTH/07",
      "temporal_range": {
        "start": "2000-06-01",
        "end": "2024-12-31"
      },
      "spatial_resolution": "0.1° × 0.1°",
      "variables": [
        {
          "name": "precipitation",
          "units": "mm/month",
          "long_name": "Monthly Precipitation Accumulation"
        }
      ]
    }
  ]
}
```

---

### 2.3 Create Investigation
`POST /api/v1/investigations`

Launches an asynchronous investigation job.

#### Request Body
```json
{
  "dataset_id": "merra2_t2m",
  "variable": "T2M",
  "period": {
    "start_year": 2000,
    "end_year": 2024
  },
  "region_a": {
    "name": "Mediterranean Basin",
    "bbox": [-10.0, 30.0, 40.0, 45.0]
  },
  "region_b": {
    "name": "Northern Europe",
    "bbox": [5.0, 50.0, 30.0, 70.0]
  },
  "estimator": "ols_hac",
  "quality_policy": "standard"
}
```

#### Response (202 Accepted)
```json
{
  "job_id": "inv-9a8b7c6d5e4f",
  "job_status": "queued",
  "stage": "validating",
  "progress": 0,
  "created_at": "2026-09-26T04:00:00Z",
  "links": {
    "status": "/api/v1/investigations/inv-9a8b7c6d5e4f/status",
    "events": "/api/v1/investigations/inv-9a8b7c6d5e4f/events",
    "map": "/api/v1/investigations/inv-9a8b7c6d5e4f/map",
    "series": "/api/v1/investigations/inv-9a8b7c6d5e4f/series",
    "evidence": "/api/v1/investigations/inv-9a8b7c6d5e4f/evidence"
  }
}
```

---

### 2.4 Investigation Status
`GET /api/v1/investigations/{job_id}/status`

Returns current processing stage and progress.

#### Response (200 OK)
```json
{
  "job_id": "inv-9a8b7c6d5e4f",
  "job_status": "succeeded",
  "stage": "completed",
  "progress": 100,
  "started_at": "2026-09-26T04:00:01Z",
  "completed_at": "2026-09-26T04:00:08Z",
  "error": null
}
```

---

### 2.5 Structured Map Grid Delivery
`GET /api/v1/investigations/{job_id}/map`

Delivers high-density spatial trend values, confidence bounds, and color scales for client-side canvas rasterization.

#### Response (200 OK)
```json
{
  "job_id": "inv-9a8b7c6d5e4f",
  "grid": {
    "bounds": [-180, -90, 180, 90],
    "resolution_deg": [0.5, 0.625],
    "dimensions": [360, 576],
    "cells": [
      {
        "lat": 35.25,
        "lon": 12.50,
        "slope_per_decade": 0.42,
        "p_value": 0.0012,
        "is_significant": true
      }
    ]
  },
  "legend": {
    "variable": "T2M",
    "units": "degC/decade",
    "min_val": -1.5,
    "max_val": 1.5,
    "palette": "coolwarm"
  }
}
```

---

### 2.6 Linked Time Series
`GET /api/v1/investigations/{job_id}/series`

Returns aggregated regional monthly/annual observations, deseasonalized anomalies, and fitted trend lines.

#### Response (200 OK)
```json
{
  "job_id": "inv-9a8b7c6d5e4f",
  "data": [
    {
      "year": 2000,
      "region_a_actual": 14.2,
      "region_a_trend": 14.15,
      "region_b_actual": 8.1,
      "region_b_trend": 8.05,
      "difference_actual": 6.1,
      "difference_trend": 6.10
    }
  ]
}
```

---

### 2.7 Evidence Snapshot & Provenance
`GET /api/v1/investigations/{job_id}/evidence`

Returns full `InvestigationRecord` containing statistical effect sizes, HAC confidence intervals, paired contrast metrics, degrees of freedom, and explicit caveats.

---

### 2.8 Bundle Export
`GET /api/v1/investigations/{job_id}/export/{format}`

Downloads self-contained investigation packages (`format` $\in \{\text{json}, \text{csv}, \text{zip}, \text{report}\}$).

---

## 3. RFC 9457 Problem Details Error Responses

When an error occurs, the API returns HTTP status $4\mathrm{xx}$ or $5\mathrm{xx}$ with `Content-Type: application/problem+json`:

```json
{
  "type": "https://terra-odyssey.earth/errors/invalid-spatial-bounds",
  "title": "Invalid Spatial Bounding Box",
  "status": 422,
  "detail": "Region A min_lon (-190.0) is outside the valid geographic range [-180, 180].",
  "instance": "/api/v1/investigations",
  "invalid_params": [
    {
      "name": "region_a.bbox[0]",
      "reason": "Value must be greater than or equal to -180."
    }
  ]
}
```
