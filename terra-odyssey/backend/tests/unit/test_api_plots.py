"""Unit and API integration tests for SQLite study plot persistence."""

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.store import JobStore


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Create test client backed by temporary SQLite store."""
    db_file = tmp_path / "test_plots.db"
    monkeypatch.setattr("backend.store.default_db_path", lambda: db_file)
    app = create_app()
    return TestClient(app), db_file


def test_job_store_study_plots_sqlite(tmp_path):
    """Verify SQLite CRUD operations, JSON serialization, and active state transitions."""
    db_file = tmp_path / "sqlite_plots_test.db"
    store = JobStore(db_file)

    sample_plot = {
        "plot_id": "plot-test-001",
        "name": "California Central Valley",
        "is_active": True,
        "geometry_type": "Polygon",
        "coordinates": [
            [[-121.5, 36.5], [-119.5, 36.5], [-119.5, 38.0], [-121.5, 38.0], [-121.5, 36.5]]
        ],
        "bbox": [-121.5, 36.5, -119.5, 38.0],
        "measurements": {
            "areaKm2": 28450.5,
            "areaHa": 2845050.0,
            "perimeterKm": 720.4,
            "centroid": [-120.5, 37.25],
            "bounds": {"minLat": 36.5, "maxLat": 38.0, "minLon": -121.5, "maxLon": -119.5},
            "vertexCount": 5,
        },
        "dataset_id": "merra2_t2m",
    }

    # 1. Upsert into SQLite
    created = store.upsert_study_plot(sample_plot)
    assert created["plot_id"] == "plot-test-001"
    assert created["name"] == "California Central Valley"
    assert created["is_active"] is True
    assert created["bbox"] == [-121.5, 36.5, -119.5, 38.0]
    assert created["measurements"]["areaKm2"] == 28450.5
    assert len(created["coordinates"][0]) == 5

    # 2. Get by ID
    retrieved = store.get_study_plot("plot-test-001")
    assert retrieved is not None
    assert retrieved["plot_id"] == "plot-test-001"

    # 3. Active plot retrieval
    active = store.get_active_study_plot()
    assert active is not None
    assert active["plot_id"] == "plot-test-001"

    # 4. Upsert second plot and verify active transition
    second_plot = {
        "plot_id": "plot-test-002",
        "name": "Mojave Desert",
        "is_active": True,
        "geometry_type": "Polygon",
        "coordinates": [[[-116.0, 34.0], [-115.0, 34.0], [-115.0, 35.0], [-116.0, 35.0], [-116.0, 34.0]]],
        "bbox": [-116.0, 34.0, -115.0, 35.0],
        "measurements": {"areaKm2": 10500.0, "areaHa": 1050000.0, "perimeterKm": 410.0},
    }
    store.upsert_study_plot(second_plot)

    # First plot should now be inactive
    first_updated = store.get_study_plot("plot-test-001")
    assert first_updated["is_active"] is False

    active_now = store.get_active_study_plot()
    assert active_now["plot_id"] == "plot-test-002"

    # 5. List plots
    all_plots = store.list_study_plots()
    assert len(all_plots) == 2

    # 6. Delete plot
    assert store.delete_study_plot("plot-test-001") is True
    assert store.get_study_plot("plot-test-001") is None
    assert len(store.list_study_plots()) == 1

    # 7. Clear all plots
    cleared_count = store.clear_study_plots()
    assert cleared_count == 1
    assert len(store.list_study_plots()) == 0


def test_api_plots_endpoints(client):
    """Test full REST endpoint suite for study plot persistence."""
    c, db_file = client

    # Initially empty
    res = c.get("/api/plots")
    assert res.status_code == 200
    assert res.json() == []

    res = c.get("/api/plots/active")
    assert res.status_code == 200
    assert res.json() is None

    # Create a plot via POST
    payload = {
        "plot_id": "plot-api-01",
        "name": "Sierra Nevada Study Region",
        "is_active": True,
        "geometry_type": "Polygon",
        "coordinates": [
            [[-120.0, 37.0], [-118.5, 37.0], [-118.5, 39.0], [-120.0, 39.0], [-120.0, 37.0]]
        ],
        "bbox": [-120.0, 37.0, -118.5, 39.0],
        "measurements": {
            "areaKm2": 15400.2,
            "areaHa": 1540020.0,
            "perimeterKm": 612.0,
            "centroid": [-119.25, 38.0],
            "bounds": {"minLat": 37.0, "maxLat": 39.0, "minLon": -120.0, "maxLon": -118.5},
            "vertexCount": 5,
        },
        "dataset_id": "merra2_t2m",
    }
    create_res = c.post("/api/plots", json=payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["plot_id"] == "plot-api-01"
    assert created_data["name"] == "Sierra Nevada Study Region"
    assert created_data["is_active"] is True
    assert created_data["measurements"]["areaKm2"] == 15400.2

    # Fetch active plot
    active_res = c.get("/api/plots/active")
    assert active_res.status_code == 200
    assert active_res.json()["plot_id"] == "plot-api-01"

    # Fetch specific plot by ID
    get_res = c.get("/api/plots/plot-api-01")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Sierra Nevada Study Region"

    # 404 for unknown plot
    not_found_res = c.get("/api/plots/non-existent-plot")
    assert not_found_res.status_code == 404

    # Delete specific plot
    del_res = c.delete("/api/plots/plot-api-01")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Verify deleted
    assert c.get("/api/plots/plot-api-01").status_code == 404
    assert c.get("/api/plots/active").json() is None

    # Create two plots, then clear all
    c.post("/api/plots", json={**payload, "plot_id": "p1"})
    c.post("/api/plots", json={**payload, "plot_id": "p2"})
    assert len(c.get("/api/plots").json()) == 2

    clear_res = c.delete("/api/plots")
    assert clear_res.status_code == 200
    assert clear_res.json()["count"] == 2
    assert len(c.get("/api/plots").json()) == 0
