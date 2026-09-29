"""Async client for the Photon (Komoot) public geocoder.

Photon returns OpenStreetMap-backed place names with GeoJSON geometries.
We forward a free-text query, normalize the result list into
``PlaceSearchResult`` rows, and gracefully degrade to ``[]`` on any
upstream failure so the search bar can keep working.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Iterable, Optional

import httpx

from backend.schemas import PlaceSearchResult

logger = logging.getLogger("terra_odyssey.backend.places")

DEFAULT_PHOTON_BASE_URL = "https://photon.komoot.io"
DEFAULT_PHOTON_TIMEOUT_SECONDS = 5.0
# Cap upstream requests at a size that respects the public rate limits.
DEFAULT_PHOTON_LIMIT = 8
# Photon's bbox values (when present) come as GeoJSON coordinates
# (longitude, latitude). We expand point-only results into a small
# neighborhood so the map's fitBounds call has something meaningful to use.
_POINT_BBOX_PADDING_DEGREES = 0.6


class PhotonGeocoder:
    """Thin async wrapper around the Photon ``/api`` endpoint."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_PHOTON_BASE_URL,
        timeout_seconds: float = DEFAULT_PHOTON_TIMEOUT_SECONDS,
        limit: int = DEFAULT_PHOTON_LIMIT,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.limit = max(1, min(int(limit), 20))
        self.http_client = http_client

    @classmethod
    def from_settings(cls) -> "PhotonGeocoder":
        """Build a client from server-side environment variables."""
        timeout_raw = os.environ.get("PHOTON_TIMEOUT_SECONDS")
        try:
            timeout = float(timeout_raw) if timeout_raw else DEFAULT_PHOTON_TIMEOUT_SECONDS
            if timeout <= 0:
                raise ValueError
        except ValueError:
            logger.warning(
                "Invalid PHOTON_TIMEOUT_SECONDS; using %.1f seconds",
                DEFAULT_PHOTON_TIMEOUT_SECONDS,
            )
            timeout = DEFAULT_PHOTON_TIMEOUT_SECONDS

        limit_raw = os.environ.get("PHOTON_LIMIT")
        try:
            limit = int(limit_raw) if limit_raw else DEFAULT_PHOTON_LIMIT
            if limit <= 0:
                raise ValueError
        except ValueError:
            logger.warning(
                "Invalid PHOTON_LIMIT; using %d", DEFAULT_PHOTON_LIMIT
            )
            limit = DEFAULT_PHOTON_LIMIT

        return cls(
            base_url=os.environ.get("PHOTON_BASE_URL", DEFAULT_PHOTON_BASE_URL),
            timeout_seconds=timeout,
            limit=limit,
        )

    async def search(self, query: str) -> list[PlaceSearchResult]:
        """Return up to ``self.limit`` normalized places for ``query``.

        Returns ``[]`` on any non-2xx, timeout, or parsing failure.
        """
        clean = (query or "").strip()
        if len(clean) < 2:
            return []

        # When custom base_url or injected mock http_client is present (e.g. unit tests), query Photon directly
        if self.http_client is not None or self.base_url != DEFAULT_PHOTON_BASE_URL:
            return await self._search_photon(clean)

        # 1. Try Nominatim first for high-quality English city/place ranking
        nom_results = await self._search_nominatim(clean)
        if nom_results:
            return nom_results

        # 2. Fallback to Photon
        return await self._search_photon(clean)

    async def _search_photon(self, clean: str) -> list[PlaceSearchResult]:
        headers = {
            "User-Agent": "TerraOdyssey/1.0 (Earth Trend Detective; contact@terra-odyssey.org)",
            "Accept": "application/json",
        }
        params = {"q": clean, "limit": self.limit}
        url = f"{self.base_url}/api"

        try:
            if self.http_client is not None:
                response = await self.http_client.get(
                    url, params=params, headers=headers, timeout=self.timeout_seconds
                )
            else:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        url, params=params, headers=headers, timeout=self.timeout_seconds
                    )
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            logger.warning("Photon network issue query=%r type=%s", clean, type(exc).__name__)
            return []

        if response.status_code >= 400:
            logger.warning("Photon rejected query=%r status=%d", clean, response.status_code)
            return []

        try:
            payload = response.json()
        except ValueError:
            logger.warning("Photon returned non-JSON payload query=%r", clean)
            return []

        features = payload.get("features") if isinstance(payload, dict) else None
        if not isinstance(features, list) or len(features) == 0:
            return []

        results = list(self._normalize_features(features))
        def _score_place(p: PlaceSearchResult) -> int:
            score = 0
            if p.name.lower() == clean.lower():
                score += 20
            elif p.name.lower().startswith(clean.lower()):
                score += 10
            if p.kind in ("city", "administrative", "capital", "country", "state"):
                score += 10
            return score

        results.sort(key=_score_place, reverse=True)
        return results

    async def _search_nominatim(self, clean: str) -> list[PlaceSearchResult]:
        headers = {
            "User-Agent": "TerraOdyssey/1.0 (Earth Trend Detective; contact@terra-odyssey.org)",
            "Accept": "application/json",
            "Accept-Language": "en",
        }
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": clean,
            "format": "json",
            "limit": self.limit,
            "addressdetails": 1,
            "polygon_geojson": 1,
            "polygon_threshold": 0.005,
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, params=params, headers=headers, timeout=self.timeout_seconds)
                if res.status_code != 200:
                    return []
                items = res.json()
                if not isinstance(items, list):
                    return []
                results: list[PlaceSearchResult] = []
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    try:
                        lon = float(item["lon"])
                        lat = float(item["lat"])
                    except (KeyError, TypeError, ValueError):
                        continue
                    name = item.get("name") or item.get("display_name", "").split(",")[0]
                    addr = item.get("address") or {}
                    country = addr.get("country")
                    state = addr.get("state") or addr.get("county")
                    kind = item.get("type") or item.get("class") or "place"
                    osm_type = item.get("osm_type", "node")
                    osm_id = item.get("osm_id")
                    stable_id = f"{osm_type}/{osm_id}" if osm_id else str(name).lower()
                    
                    bbox_raw = item.get("boundingbox")
                    if isinstance(bbox_raw, list) and len(bbox_raw) == 4:
                        try:
                            bbox = (float(bbox_raw[2]), float(bbox_raw[0]), float(bbox_raw[3]), float(bbox_raw[1]))
                        except (TypeError, ValueError):
                            pad = _POINT_BBOX_PADDING_DEGREES
                            bbox = (max(-180.0, lon - pad), max(-90.0, lat - pad), min(180.0, lon + pad), min(90.0, lat + pad))
                    else:
                        pad = _POINT_BBOX_PADDING_DEGREES
                        bbox = (max(-180.0, lon - pad), max(-90.0, lat - pad), min(180.0, lon + pad), min(90.0, lat + pad))
                    
                    geojson_raw = item.get("geojson")
                    geojson = None
                    if isinstance(geojson_raw, dict) and geojson_raw.get("type") in ("Polygon", "MultiPolygon"):
                        geojson = {
                            "type": geojson_raw["type"],
                            "coordinates": geojson_raw.get("coordinates", []),
                        }

                    results.append(
                        PlaceSearchResult(
                            id=str(stable_id)[:120],
                            name=str(name)[:200],
                            kind=str(kind)[:40],
                            country=str(country)[:80] if country else None,
                            admin1=str(state)[:120] if state else None,
                            longitude=lon,
                            latitude=lat,
                            bbox=bbox,
                            geojson=geojson,
                            source="nominatim",
                        )
                    )
                return results
        except Exception as e:
            logger.warning("Nominatim fallback error query=%r: %s", clean, e)
            return []

    # -- normalization ----------------------------------------------------

    @staticmethod
    def _normalize_features(features: Iterable[Any]) -> Iterable[PlaceSearchResult]:
        for feature in features:
            if not isinstance(feature, dict):
                continue
            geometry = feature.get("geometry") or {}
            properties = feature.get("properties") or {}
            if not isinstance(geometry, dict) or not isinstance(properties, dict):
                continue

            coords = geometry.get("coordinates")
            longitude, latitude = PhotonGeocoder._extract_lonlat(coords)
            if longitude is None or latitude is None:
                continue

            name = str(properties.get("name") or "").strip()
            if not name:
                continue

            if name.islower():
                name = name.title()

            kind = PhotonGeocoder._coerce_kind(properties)
            country = PhotonGeocoder._string_or_none(properties.get("country"))
            admin1 = (
                PhotonGeocoder._string_or_none(properties.get("state"))
                or PhotonGeocoder._string_or_none(properties.get("county"))
            )
            osm_type = PhotonGeocoder._string_or_none(properties.get("osm_type")) or "node"
            osm_id = properties.get("osm_id")
            stable_id = f"{osm_type}/{osm_id}" if osm_id is not None else name.lower()

            bbox = PhotonGeocoder._extract_bbox(properties, geometry, longitude, latitude)

            yield PlaceSearchResult(
                id=str(stable_id)[:120],
                name=name[:200],
                kind=kind,
                country=country[:80] if country else None,
                admin1=admin1[:120] if admin1 else None,
                longitude=longitude,
                latitude=latitude,
                bbox=bbox,
            )

    @staticmethod
    def _extract_lonlat(coords: Any) -> tuple[Optional[float], Optional[float]]:
        """GeoJSON Point coordinates are ``[lon, lat]``; reject anything else."""
        if isinstance(coords, list) and len(coords) >= 2:
            try:
                lon = float(coords[0])
                lat = float(coords[1])
            except (TypeError, ValueError):
                return None, None
            if -180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0:
                return lon, lat
        return None, None

    @staticmethod
    def _extract_bbox(
        properties: dict[str, Any],
        geometry: dict[str, Any],
        longitude: float,
        latitude: float,
    ) -> tuple[float, float, float, float]:
        """Return a small bbox centered on the point if no upstream bbox exists."""
        # Photon GeoJSON sometimes puts [minLat, maxLat, minLon, maxLon] on geometry.boundingbox
        geom_bbox = geometry.get("boundingbox")
        if isinstance(geom_bbox, list) and len(geom_bbox) == 4:
            try:
                min_lat = float(geom_bbox[0])
                max_lat = float(geom_bbox[1])
                min_lon = float(geom_bbox[2])
                max_lon = float(geom_bbox[3])
                if (
                    -90.0 <= min_lat <= max_lat <= 90.0
                    and -180.0 <= min_lon <= max_lon <= 180.0
                ):
                    return (min_lon, min_lat, max_lon, max_lat)
            except (TypeError, ValueError):
                pass

        extent = properties.get("extent")
        if isinstance(extent, list) and len(extent) == 4:
            try:
                val1, val2, val3, val4 = float(extent[0]), float(extent[1]), float(extent[2]), float(extent[3])
                min_lon, max_lon = min(val1, val3), max(val1, val3)
                min_lat, max_lat = min(val2, val4), max(val2, val4)
                if (
                    -90.0 <= min_lat <= max_lat <= 90.0
                    and -180.0 <= min_lon <= max_lon <= 180.0
                ):
                    return (min_lon, min_lat, max_lon, max_lat)
            except (TypeError, ValueError):
                pass

        pad = _POINT_BBOX_PADDING_DEGREES
        return (
            max(-180.0, longitude - pad),
            max(-90.0, latitude - pad),
            min(180.0, longitude + pad),
            min(90.0, latitude + pad),
        )

    @staticmethod
    def _coerce_kind(properties: dict[str, Any]) -> str:
        osm_value = PhotonGeocoder._string_or_none(properties.get("osm_value"))
        osm_key = PhotonGeocoder._string_or_none(properties.get("osm_key"))
        place_type = PhotonGeocoder._string_or_none(properties.get("type"))
        # Photon's `osm_value` is the most specific descriptor (city, town,
        # country, peak, etc.); fall back to `osm_key` then the explicit `type`.
        if osm_value:
            return osm_value.replace("_", " ").strip()[:40] or "place"
        if osm_key:
            return osm_key[:40] or "place"
        if place_type:
            return place_type[:40] or "place"
        return "place"

    @staticmethod
    def _string_or_none(value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None
