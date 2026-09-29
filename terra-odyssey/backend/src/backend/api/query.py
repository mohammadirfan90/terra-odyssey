"""Protected natural-language query endpoint backed by NVIDIA NIM."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.nim_client import AI_CAVEAT, NvidiaNimClient
from backend.schemas import UniversalQueryRequest, UniversalQueryResponse

router = APIRouter(prefix="/query", tags=["Query"])


def get_nim_client() -> NvidiaNimClient:
    """Create a request-scoped client from server-only configuration."""
    return NvidiaNimClient.from_environment()


@router.post("", response_model=UniversalQueryResponse)
async def answer_universal_query(
    request: UniversalQueryRequest,
    nim_client: NvidiaNimClient = Depends(get_nim_client),
) -> UniversalQueryResponse:
    """Answer an app-wide question without exposing NVIDIA credentials."""
    completion = await nim_client.complete(request.query)
    return UniversalQueryResponse(
        answer=completion.answer,
        model=completion.model,
        provider="NVIDIA NIM",
        latency_ms=completion.latency_ms,
        caveat=AI_CAVEAT,
    )
