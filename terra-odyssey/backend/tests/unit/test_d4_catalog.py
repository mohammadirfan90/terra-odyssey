"""Unit tests for D4 MODIS NDVI catalog registration and schema validation."""

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.schemas import InvestigationRequest


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_catalog_contains_d4_modis_ndvi(client):
    """Assert D4 MODIS NDVI is registered and queryable from /api/catalog."""
    response = client.get("/api/catalog")
    assert response.status_code == 200
    data = response.json()

    assert "datasets" in data
    assert "d4_modis_ndvi" in data["datasets"]

    d4 = data["datasets"]["d4_modis_ndvi"]
    assert d4["dataset_id"] == "d4_modis_ndvi"
    assert "Vegetation Indices" in d4["name"]
    assert d4["collection"] == "MOD13A3"
    assert d4["version"] == "061"
    assert "NDVI" in d4["variable"]
    assert d4["units"] == "dimensionless"
    assert d4["temporal_support"] == "monthly composite"
    assert d4["coverage_start"] == "2000-02-01"


def test_d4_quality_policy_and_provenance(client):
    """Verify D4 MODIS NDVI quality policy, fill values, and LP DAAC provenance."""
    response = client.get("/api/catalog")
    assert response.status_code == 200
    d4 = response.json()["datasets"]["d4_modis_ndvi"]

    qp = d4["quality_policy"]
    assert len(qp["fill_values"]) > 0
    assert "mask_description" in qp

    prov = d4["provenance"]
    assert "10.5067/MODIS/MOD13A3.061" in prov["doi"]
    assert len(prov["documentation_urls"]) > 0


def test_investigation_request_with_d4_ndvi():
    """Verify InvestigationRequest successfully validates with D4 dataset and NDVI variable."""
    payload = {
        "dataset_id": "d4_modis_ndvi",
        "variable": "NDVI",
        "period": {"start_year": 2002, "end_year": 2023},
        "region_a": [-65.0, -10.0, -55.0, 0.0],  # Amazon Basin
        "region_b": [-60.0, -25.0, -50.0, -15.0],  # Cerrado
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "auto",
        "estimator_family": "ols_hac",
        "selection_status": "predefined",
    }
    req = InvestigationRequest(**payload)
    assert req.dataset_id == "d4_modis_ndvi"
    assert req.variable == "NDVI"
    assert req.region_a == [-65.0, -10.0, -55.0, 0.0]
    assert req.region_b == [-60.0, -25.0, -50.0, -15.0]
