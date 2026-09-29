"""Phase 6 Tests: Grounded AI Narrative Summarizer using NVIDIA NIM Nemotron.

Tests cover:
  1. Evidence payload construction (no raw arrays, verified statistics only).
  2. Model configuration (default nvidia/nemotron-3-super-120b-a12b, env var override).
  3. API key handling and availability checks.
  4. Prompt construction adhering to 10 scientific grounding rules.
  5. Mocked NIM client completion generation with tokens, latency, and metadata.
  6. Retry and backoff resilience on transient failures.
  7. API route integration: POST/GET endpoints, 503 without key, 404/409 error handling.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.ai_narrator import (
    NvidiaAINarrator,
    build_evidence_payload,
    _DEFAULT_MODEL,
    _SYSTEM_PROMPT,
    _PROMPT_VERSION,
)
from backend.app import create_app
from backend.stepper import run_pipeline
from backend.store import JobStore


# ── Sample Record Fixture ─────────────────────────────────────────────────────

SAMPLE_RECORD = {
    "schema_version": "1.0.0",
    "job": {
        "job_id": "test-job-001",
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "region_b": None,
        "result_status": "supported",
    },
    "provenance": {
        "dataset_name": "MERRA-2 Reanalysis",
        "source_type": "atmospheric reanalysis",
        "doi": "10.5067/VJAFPLI1CSIV",
    },
    "results": [
        {
            "region": "region_a",
            "region_label": "Western US Test",
            "status": "supported",
            "n_years": 25,
            "slope_per_decade": 0.342,
            "slope_units": "K/decade",
            "ci_95": [0.120, 0.564],
            "p_value": 0.0032,
            "r_squared": 0.45,
            "autocorrelation_correction": "Newey-West HAC",
        }
    ],
}

SAMPLE_CONTRAST_RECORD = {
    "schema_version": "1.0.0",
    "job": {
        "job_id": "test-contrast-002",
        "dataset_id": "gpm_imergm",
        "variable": "precipitation",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-125.0, 42.0, -117.0, 49.0],
        "region_b": [-106.0, 26.0, -93.0, 36.0],
        "result_status": "supported",
    },
    "provenance": {
        "dataset_name": "GPM IMERG Final Precipitation",
        "source_type": "satellite retrieval",
        "doi": "10.5067/GPM/IMERG/3B-MONTH/07",
    },
    "results": [
        {
            "region": "region_a",
            "region_label": "Pacific Northwest",
            "status": "supported",
            "n_years": 25,
            "slope_per_decade": -12.4,
            "slope_units": "mm/decade",
            "ci_95": [-22.1, -2.7],
            "p_value": 0.015,
            "contrast": {
                "delta_slope_per_decade": -28.6,
                "delta_ci_95": [-45.2, -12.0],
                "delta_p_value": 0.0018,
                "status": "supported",
            },
        }
    ],
}


# ── Unit Tests: Payload Builder ───────────────────────────────────────────────

def test_build_evidence_payload_basic():
    payload = build_evidence_payload(SAMPLE_RECORD)
    assert payload["dataset"] == "MERRA-2 Reanalysis"
    assert payload["dataset_id"] == "merra2_t2m"
    assert payload["variable"] == "T2M"
    assert payload["result_status"] == "supported"
    assert len(payload["results"]) == 1

    r0 = payload["results"][0]
    assert r0["region"] == "Western US Test"
    assert r0["slope_per_decade"] == 0.342
    assert r0["slope_units"] == "K/decade"
    assert r0["ci_95_lower"] == 0.120
    assert r0["ci_95_upper"] == 0.564
    assert r0["p_value"] == 0.0032
    assert "raw_data" not in payload  # zero-mock rule: no raw data arrays passed


def test_build_evidence_payload_contrast():
    payload = build_evidence_payload(SAMPLE_CONTRAST_RECORD)
    assert len(payload["results"]) == 1
    r0 = payload["results"][0]
    assert "contrast" in r0
    assert r0["contrast"]["delta_slope_per_decade"] == -28.6
    assert r0["contrast"]["delta_ci_95"] == [-45.2, -12.0]
    assert r0["contrast"]["delta_p_value"] == 0.0018
    assert r0["contrast"]["contrast_status"] == "supported"


# ── Unit Tests: Narrator Configuration ────────────────────────────────────────

def test_narrator_default_model():
    narrator = NvidiaAINarrator()
    assert narrator.model == "nvidia/nemotron-3-super-120b-a12b"
    assert _DEFAULT_MODEL == "nvidia/nemotron-3-super-120b-a12b"


def test_narrator_model_override(monkeypatch):
    monkeypatch.setenv("NVIDIA_NIM_MODEL", "nvidia/custom-nemotron-model")
    narrator = NvidiaAINarrator()
    assert narrator.model == "nvidia/custom-nemotron-model"

    # Constructor arg takes precedence over env var
    explicit = NvidiaAINarrator(model="nvidia/explicit-model")
    assert explicit.model == "nvidia/explicit-model"


def test_narrator_availability_check(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    narrator = NvidiaAINarrator()
    assert not narrator.is_available()

    with pytest.raises(EnvironmentError, match="NVIDIA_API_KEY"):
        narrator._get_api_key()

    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-testkey123")
    assert narrator.is_available()
    assert narrator._get_api_key() == "nvapi-testkey123"


def test_system_prompt_scientific_rules():
    """Ensure the system prompt enforces the 10 strict scientific grounding rules."""
    assert "STRICT RULES" in _SYSTEM_PROMPT
    assert "Do NOT assert causation" in _SYSTEM_PROMPT
    assert "verbatim" in _SYSTEM_PROMPT
    assert "inconclusive" in _SYSTEM_PROMPT
    assert "not significant" in _SYSTEM_PROMPT.lower()


# ── Unit Tests: Mocked NIM Completion Generation ─────────────────────────────

def test_narrator_generate_summary_mocked(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-mock-key")

    mock_choice = MagicMock()
    mock_choice.message.content = (
        "Between 2000 and 2024, the MERRA-2 surface air temperature over Western US "
        "exhibited a statistically supported positive trend of +0.342 K/decade "
        "(95% CI: [0.120, 0.564], p = 0.0032). Accounting for temporal autocorrelation "
        "via Newey-West HAC covariance confirms the robustness of this signal."
    )
    mock_usage = MagicMock()
    mock_usage.total_tokens = 142

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = mock_usage

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    narrator = NvidiaAINarrator()
    with patch.object(narrator, "_build_client", return_value=mock_client):
        result = narrator.generate_summary(SAMPLE_RECORD)

    assert result["summary_text"] is not None
    assert "+0.342 K/decade" in result["summary_text"]
    assert result["model"] == "nvidia/nemotron-3-super-120b-a12b"
    assert result["prompt_version"] == _PROMPT_VERSION
    assert result["tokens_used"] == 142
    assert result["latency_ms"] is not None
    assert result["latency_ms"] >= 0
    assert result["error"] is None

    # Verify call parameters
    create_args = mock_client.chat.completions.create.call_args[1]
    assert create_args["model"] == "nvidia/nemotron-3-super-120b-a12b"
    assert len(create_args["messages"]) == 2
    assert create_args["messages"][0]["role"] == "system"
    assert create_args["messages"][1]["role"] == "user"


def test_narrator_retry_on_failure(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-mock-key")

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("NIM Gateway Timeout 504")

    narrator = NvidiaAINarrator(max_retries=1)
    with patch.object(narrator, "_build_client", return_value=mock_client), patch("time.sleep"):
        result = narrator.generate_summary(SAMPLE_RECORD)

    assert result["summary_text"] is None
    assert "NIM Gateway Timeout 504" in result["error"]
    assert mock_client.chat.completions.create.call_count == 2  # 1 initial + 1 retry


# ── Integration Tests: FastAPI Narrative Endpoints ────────────────────────────

@pytest.fixture
def api_client(tmp_path, monkeypatch):
    db_file = tmp_path / "api_narrative_test.db"
    art_dir = tmp_path / "api_narrative_artifacts"
    monkeypatch.setattr("backend.store.default_db_path", lambda: db_file)
    app = create_app()
    return TestClient(app), db_file, art_dir


def test_narrative_endpoint_no_api_key(api_client, monkeypatch):
    """POST /investigations/{job_id}/narrative returns 503 when NVIDIA_API_KEY is unset."""
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    c, db_file, art_dir = api_client

    payload = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "demo_sample",
        "selection_status": "predefined",
    }
    res = c.post("/api/investigations", json=payload)
    job_id = res.json()["job_id"]
    run_pipeline(job_id=job_id, request_data=payload, artifacts_base_dir=art_dir, store_db_path=db_file)

    post_res = c.post(f"/api/investigations/{job_id}/narrative")
    assert post_res.status_code == 503
    data = post_res.json()
    assert "NVIDIA_API_KEY is not configured" in data["error"]
    assert "nvidia/nemotron-3-super-120b-a12b" in data["model"]


def test_narrative_endpoint_lifecycle_mocked(api_client, monkeypatch):
    """POST /investigations/{job_id}/narrative generates and GET caches the narrative."""
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-test-key")
    c, db_file, art_dir = api_client

    payload = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "demo_sample",
        "selection_status": "predefined",
    }
    res = c.post("/api/investigations", json=payload)
    job_id = res.json()["job_id"]
    run_pipeline(job_id=job_id, request_data=payload, artifacts_base_dir=art_dir, store_db_path=db_file)

    # 1. Before generation: GET returns 404
    get_before = c.get(f"/api/investigations/{job_id}/narrative")
    assert get_before.status_code == 404

    # 2. Mock the NvidiaAINarrator.generate_summary
    mock_narrative_result = {
        "summary_text": "MERRA-2 analysis indicates a warming trend of +0.34 K/decade.",
        "model": "nvidia/nemotron-3-super-120b-a12b",
        "prompt_version": "v1.0.0",
        "evidence_payload": {"dataset": "MERRA-2 Reanalysis"},
        "tokens_used": 128,
        "latency_ms": 350,
        "error": None,
    }

    with patch("backend.ai_narrator.NvidiaAINarrator.generate_summary", return_value=mock_narrative_result):
        post_res = c.post(f"/api/investigations/{job_id}/narrative")
        assert post_res.status_code == 200
        post_data = post_res.json()
        assert post_data["summary_text"] == "MERRA-2 analysis indicates a warming trend of +0.34 K/decade."
        assert post_data["model"] == "nvidia/nemotron-3-super-120b-a12b"

    # 3. After generation: GET returns the cached narrative from artifacts
    get_after = c.get(f"/api/investigations/{job_id}/narrative")
    assert get_after.status_code == 200
    get_data = get_after.json()
    assert get_data["summary_text"] == "MERRA-2 analysis indicates a warming trend of +0.34 K/decade."
    assert get_data["tokens_used"] == 128
