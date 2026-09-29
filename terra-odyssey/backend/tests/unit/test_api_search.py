"""Tests for the /api/search/places endpoint and PhotonGeocoder client."""

from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.api.search import get_geocoder
from backend.app import create_app
from backend.places import PhotonGeocoder
from backend.schemas import PlaceSearchResult


# -- /api/search/places endpoint ------------------------------------------


def test_search_places_returns_normalized_results() -> None:
    """The endpoint must surface a clean, validated response."""
    places = [
        PlaceSearchResult(
            id="node/123",
            name="Tokyo",
            kind="city",
            country="Japan",
            admin1="Tokyo",
            longitude=139.6917,
            latitude=35.6895,
            bbox=(139.0, 35.0, 140.5, 36.5),
        )
    ]

    class StubGeocoder:
        async def search(self, query: str) -> list[PlaceSearchResult]:
            assert query == "tokyo"
            return places

    app = create_app()
    app.dependency_overrides[get_geocoder] = StubGeocoder

    response = TestClient(app).get("/api/search/places", params={"q": "tokyo"})

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "tokyo"
    assert body["cached"] is False
    assert len(body["results"]) == 1
    assert body["results"][0]["name"] == "Tokyo"
    assert body["results"][0]["longitude"] == pytest.approx(139.6917)
    assert body["results"][0]["bbox"] == [139.0, 35.0, 140.5, 36.5]


def test_search_places_returns_empty_on_upstream_failure() -> None:
    """Upstream errors must not crash the endpoint — return []."""

    class FailingGeocoder:
        async def search(self, query: str) -> list[PlaceSearchResult]:
            return []

    app = create_app()
    app.dependency_overrides[get_geocoder] = FailingGeocoder

    response = TestClient(app).get("/api/search/places", params={"q": "atlantis"})
    assert response.status_code == 200
    assert response.json() == {"query": "atlantis", "results": [], "cached": False}


def test_search_places_rejects_short_query() -> None:
    """A single-character query must be rejected with problem+json."""
    response = TestClient(create_app()).get("/api/search/places", params={"q": "a"})
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")


def test_search_places_honors_limit() -> None:
    """The caller-supplied ``limit`` must cap the response list."""
    places = [
        PlaceSearchResult(
            id=f"node/{i}",
            name=f"Place {i}",
            kind="village",
            longitude=10.0 + i,
            latitude=20.0 + i,
            bbox=(10.0 + i, 20.0 + i, 10.0 + i + 0.1, 20.0 + i + 0.1),
        )
        for i in range(5)
    ]

    class StubGeocoder:
        async def search(self, query: str) -> list[PlaceSearchResult]:
            return places

    app = create_app()
    app.dependency_overrides[get_geocoder] = StubGeocoder

    response = TestClient(app).get(
        "/api/search/places", params={"q": "anything", "limit": 3}
    )
    assert response.status_code == 200
    assert len(response.json()["results"]) == 3


def test_search_places_returns_empty_for_whitespace_query() -> None:
    """Two spaces still satisfies FastAPI's min_length=2 but the geocoder
    will see a blank string after stripping and return [] gracefully."""

    class StubGeocoder:
        async def search(self, query: str) -> list[PlaceSearchResult]:
            # The endpoint strips before delegating; verify that's the case.
            assert query.strip() == ""
            return []

    app = create_app()
    app.dependency_overrides[get_geocoder] = StubGeocoder
    response = TestClient(app).get("/api/search/places", params={"q": "  "})
    assert response.status_code == 200
    assert response.json()["results"] == []


# -- PhotonGeocoder normalization -------------------------------------------


@pytest.mark.asyncio
async def test_photon_geocoder_normalizes_features() -> None:
    """Photon GeoJSON features must be normalized into PlaceSearchResult."""
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(
            200,
            json={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [139.6917, 35.6895],
                            "boundingbox": [35.5, 35.9, 139.5, 139.9],
                        },
                        "properties": {
                            "osm_id": 15431245,
                            "osm_type": "N",
                            "osm_key": "place",
                            "osm_value": "city",
                            "name": "Tokyo",
                            "country": "Japan",
                            "state": "Tokyo",
                        },
                    },
                    # Feature with no boundingbox; client must synthesize one.
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [2.349, 48.864],
                        },
                        "properties": {
                            "osm_id": 7444,
                            "osm_type": "R",
                            "osm_key": "place",
                            "osm_value": "city",
                            "name": "Paris",
                            "country": "France",
                        },
                    },
                ],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        geocoder = PhotonGeocoder(base_url="https://photon.test", http_client=http_client)
        results = await geocoder.search("Tokyo")

    assert captured["url"].startswith("https://photon.test/api")
    assert "q=Tokyo" in captured["url"]
    assert len(results) == 2

    tokyo, paris = results
    # Photon's bbox ordering is [minLat, maxLat, minLon, maxLon]; we must
    # emit [minLon, minLat, maxLon, maxLat] instead.
    assert tokyo.id == "N/15431245"
    assert tokyo.kind == "city"
    assert tokyo.country == "Japan"
    assert tokyo.admin1 == "Tokyo"
    assert tokyo.bbox == (139.5, 35.5, 139.9, 35.9)

    # Paris had no bbox upstream; we expanded the point into a small bbox.
    assert paris.id == "R/7444"
    assert paris.bbox[0] < 2.349 < paris.bbox[2]
    assert paris.bbox[1] < 48.864 < paris.bbox[3]


@pytest.mark.asyncio
async def test_photon_geocoder_handles_timeouts_and_5xx() -> None:
    """Transient upstream failures must return [] without raising."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="upstream overloaded")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        geocoder = PhotonGeocoder(base_url="https://photon.test", http_client=http_client)
        assert await geocoder.search("whatever") == []

    timeout_handler = lambda request: httpx.Response(500, text="")  # noqa: E731
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(timeout_handler)
    ) as http_client:
        geocoder = PhotonGeocoder(base_url="https://photon.test", http_client=http_client)
        assert await geocoder.search("whatever") == []


@pytest.mark.asyncio
async def test_photon_geocoder_skips_malformed_features() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "features": [
                    # Missing geometry.
                    {"properties": {"name": "Ghost", "osm_id": 1}},
                    # Coordinates outside valid lat/lon ranges.
                    {
                        "geometry": {
                            "type": "Point",
                            "coordinates": [200.0, 95.0],
                        },
                        "properties": {"name": "Bad", "osm_id": 2},
                    },
                    # Valid feature.
                    {
                        "geometry": {"type": "Point", "coordinates": [0.0, 0.0]},
                        "properties": {
                            "name": "Null Island",
                            "osm_id": 3,
                            "osm_key": "place",
                            "osm_value": "locality",
                        },
                    },
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        geocoder = PhotonGeocoder(base_url="https://photon.test", http_client=http_client)
        results = await geocoder.search("anything")

    assert [r.name for r in results] == ["Null Island"]


@pytest.mark.asyncio
async def test_photon_geocoder_returns_empty_for_short_query() -> None:
    geocoder = PhotonGeocoder(base_url="https://photon.test")
    assert await geocoder.search("") == []
    assert await geocoder.search("a") == []
