"""Unit tests for catalog, capabilities, schemas, and RFC 9457 error handlers."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.backend.app import create_app
from src.backend.errors import (
    DataUnavailableError,
    InvalidGeometryError,
    InvestigationNotFoundError,
    ScientificallyIneligibleError,
)
from src.backend.schemas import InvestigationRequest, PeriodRequest


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_catalog_returns_reviewed_datasets(client):
    """Assert MERRA-2 and GPM IMERG are present with correct metadata and units."""
    response = client.get("/api/catalog")
    assert response.status_code == 200
    data = response.json()

    assert "datasets" in data
    datasets = data["datasets"]
    assert "merra2_t2m" in datasets
    assert "gpm_imerg_precipitation" in datasets

    # Verify MERRA-2
    m2 = datasets["merra2_t2m"]
    assert m2["variable"] == "T2M"
    assert m2["units"] == "degC"
    assert m2["coverage_start"] == "1980-01-01"
    assert m2["collection"] == "M2TMNXSLV"
    assert "annual_mean" in m2["supported_aggregations"]

    # Verify GPM IMERG
    gpm = datasets["gpm_imerg_precipitation"]
    assert gpm["variable"] == "precipitationCal"
    assert gpm["units"] == "mm/year"
    assert gpm["coverage_start"] == "2000-06-01"
    assert gpm["collection"] == "GPM_3IMERGM"
    assert "annual_total" in gpm["supported_aggregations"]

    # Verify defaults
    defaults = data["defaults"]
    assert defaults["dataset_id"] == "merra2_t2m"
    assert defaults["estimator_family"] == "ols_hac"
    assert defaults["fdr_method"] == "fdr_by"


def test_capabilities_endpoint(client):
    """Assert execution modes and environment metadata are exposed."""
    response = client.get("/api/capabilities")
    assert response.status_code == 200
    data = response.json()

    assert "execution_modes" in data
    assert "auto" in data["execution_modes"]
    assert "cached_only" in data["execution_modes"]
    assert "demo_sample" in data["execution_modes"]
    assert data["system_version"] == "0.1.0"
    assert "environment" in data
    assert "python_version" in data["environment"]


def test_request_schema_validation():
    """Verify strict validation of periods and geometries without silent coercion."""
    # Valid request with bbox
    valid_payload = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2001, "end_year": 2025},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "auto",
        "estimator_family": "ols_hac",
        "selection_status": "predefined",
    }
    req = InvestigationRequest(**valid_payload)
    assert req.dataset_id == "merra2_t2m"
    assert req.period.start_year == 2001
    assert req.period.end_year == 2025

    # Invalid year order: start > end
    with pytest.raises(ValidationError) as exc_info:
        PeriodRequest(start_year=2025, end_year=2000)
    assert "start_year (2025) must be less than or equal to end_year (2000)" in str(exc_info.value)

    # Invalid year bounds: < 1900
    with pytest.raises(ValidationError):
        PeriodRequest(start_year=1850, end_year=1900)

    # Invalid bbox: length != 4
    with pytest.raises(ValidationError) as exc_info:
        InvestigationRequest(**{**valid_payload, "region_a": [-120.0, 35.0, -115.0]})
    assert "Bounding box must contain exactly 4 coordinates" in str(exc_info.value)

    # Invalid bbox: min_lon >= max_lon
    with pytest.raises(ValidationError) as exc_info:
        InvestigationRequest(**{**valid_payload, "region_a": [-115.0, 35.0, -120.0, 40.0]})
    assert "min_lon (-115.0) must be strictly less than max_lon (-120.0)" in str(exc_info.value)

    # Valid GeoJSON polygon
    valid_geojson = {
        "type": "Polygon",
        "coordinates": [[
            [-120.0, 35.0],
            [-115.0, 35.0],
            [-115.0, 40.0],
            [-120.0, 40.0],
            [-120.0, 35.0],
        ]],
    }
    req_geojson = InvestigationRequest(**{**valid_payload, "region_a": valid_geojson})
    assert req_geojson.region_a["type"] == "Polygon"

    # Malformed GeoJSON: missing coordinates
    with pytest.raises(ValidationError) as exc_info:
        InvestigationRequest(**{**valid_payload, "region_a": {"type": "Polygon"}})
    assert "GeoJSON Polygon must contain 'coordinates'" in str(exc_info.value)


def test_rfc9457_error_formatting():
    """Trigger custom scientific and operational errors and verify RFC 9457 Problem Details."""
    app = create_app()

    @app.get("/api/test-error/data-unavailable")
    def trigger_data_unavailable():
        raise DataUnavailableError("Simulated missing NASA granule")

    @app.get("/api/test-error/ineligible")
    def trigger_ineligible():
        raise ScientificallyIneligibleError("Interval length is 10 years; minimum 20 years required")

    @app.get("/api/test-error/invalid-geometry")
    def trigger_invalid_geometry():
        raise InvalidGeometryError("Self-intersecting polygon boundary detected")

    @app.get("/api/test-error/not-found")
    def trigger_not_found():
        raise InvestigationNotFoundError("Investigation inv-999 does not exist")

    client = TestClient(app)

    # 1. 503 DataUnavailableError
    r503 = client.get("/api/test-error/data-unavailable")
    assert r503.status_code == 503
    assert r503.headers["content-type"] == "application/problem+json"
    body503 = r503.json()
    assert body503["status"] == 503
    assert body503["code"] == "data_unavailable"
    assert body503["title"] == "Required NASA data unavailable"
    assert body503["retryable"] is True
    assert "Simulated missing NASA granule" in body503["detail"]

    # 2. 422 ScientificallyIneligibleError
    r422 = client.get("/api/test-error/ineligible")
    assert r422.status_code == 422
    assert r422.headers["content-type"] == "application/problem+json"
    body422 = r422.json()
    assert body422["status"] == 422
    assert body422["code"] == "scientifically_ineligible"
    assert body422["retryable"] is False

    # 3. 400 InvalidGeometryError
    r400 = client.get("/api/test-error/invalid-geometry")
    assert r400.status_code == 400
    assert r400.headers["content-type"] == "application/problem+json"
    body400 = r400.json()
    assert body400["code"] == "invalid_geometry"

    # 4. 404 InvestigationNotFoundError
    r404 = client.get("/api/test-error/not-found")
    assert r404.status_code == 404
    assert r404.headers["content-type"] == "application/problem+json"
    body404 = r404.json()
    assert body404["code"] == "investigation_not_found"

    # 5. 404 Standard route not found
    r_unknown = client.get("/api/non-existent-endpoint")
    assert r_unknown.status_code == 404
    assert r_unknown.headers["content-type"] == "application/problem+json"
    assert r_unknown.json()["code"] == "http_404"
