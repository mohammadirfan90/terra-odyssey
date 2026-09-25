"""RFC 9457 Problem Details error definitions and handlers for Terra Odyssey API."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.backend.schemas import ProblemDetails

logger = logging.getLogger("terra_odyssey.backend.errors")


class TerraOdysseyError(Exception):
    """Base exception for all Terra Odyssey domain and operational errors."""

    status_code: int = 500
    code: str = "internal_error"
    title: str = "Internal Server Error"
    type_uri: str = "https://terra-odyssey.local/errors/internal-error"
    retryable: bool = False

    def __init__(
        self,
        detail: str,
        *,
        code: Optional[str] = None,
        title: Optional[str] = None,
        status_code: Optional[int] = None,
        type_uri: Optional[str] = None,
        retryable: Optional[bool] = None,
        invalid_params: Optional[List[Dict[str, Any]]] = None,
        instance: Optional[str] = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        if code is not None:
            self.code = code
        if title is not None:
            self.title = title
        if status_code is not None:
            self.status_code = status_code
        if type_uri is not None:
            self.type_uri = type_uri
        if retryable is not None:
            self.retryable = retryable
        self.invalid_params = invalid_params
        self.instance = instance

    def to_problem_details(self, instance: Optional[str] = None) -> ProblemDetails:
        return ProblemDetails(
            type=self.type_uri,
            title=self.title,
            status=self.status_code,
            code=self.code,
            detail=self.detail,
            instance=self.instance or instance,
            retryable=self.retryable,
            invalid_params=self.invalid_params,
        )


class DataUnavailableError(TerraOdysseyError):
    """Raised when required NASA granules or DAAC services are unreachable or unconfigured."""

    status_code = 503
    code = "data_unavailable"
    title = "Required NASA data unavailable"
    type_uri = "https://terra-odyssey.local/errors/data-unavailable"
    retryable = True


class ScientificallyIneligibleError(TerraOdysseyError):
    """Raised when investigation parameters violate scientific rules (e.g. interval < 20 years)."""

    status_code = 422
    code = "scientifically_ineligible"
    title = "Scientifically Ineligible Investigation"
    type_uri = "https://terra-odyssey.local/errors/scientifically-ineligible"
    retryable = False


class InvalidGeometryError(TerraOdysseyError):
    """Raised when spatial geometries or bounding boxes fail validation or topology checks."""

    status_code = 400
    code = "invalid_geometry"
    title = "Invalid Geometry Specification"
    type_uri = "https://terra-odyssey.local/errors/invalid-geometry"
    retryable = False


class InvestigationNotFoundError(TerraOdysseyError):
    """Raised when a requested investigation job or record cannot be found."""

    status_code = 404
    code = "investigation_not_found"
    title = "Investigation Not Found"
    type_uri = "https://terra-odyssey.local/errors/investigation-not-found"
    retryable = False


class InvestigationConflictError(TerraOdysseyError):
    """Raised when source release or manifest has mutated, requiring explicit snapshot rerun."""

    status_code = 409
    code = "investigation_conflict"
    title = "Investigation State Conflict"
    type_uri = "https://terra-odyssey.local/errors/investigation-conflict"
    retryable = False


def register_error_handlers(app: FastAPI) -> None:
    """Register RFC 9457 Problem Details exception handlers on a FastAPI application."""

    @app.exception_handler(TerraOdysseyError)
    async def terra_odyssey_error_handler(request: Request, exc: TerraOdysseyError) -> JSONResponse:
        problem = exc.to_problem_details(instance=str(request.url.path))
        return JSONResponse(
            status_code=exc.status_code,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        invalid_params = []
        for err in exc.errors():
            loc_str = " -> ".join(str(x) for x in err.get("loc", []))
            invalid_params.append({
                "name": loc_str,
                "reason": err.get("msg", "Invalid value"),
                "type": err.get("type", "value_error"),
            })

        problem = ProblemDetails(
            type="https://terra-odyssey.local/errors/validation-error",
            title="Request Validation Error",
            status=422,
            code="validation_error",
            detail=f"The request failed validation with {len(invalid_params)} error(s).",
            instance=str(request.url.path),
            retryable=False,
            invalid_params=invalid_params,
        )
        return JSONResponse(
            status_code=422,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        problem = ProblemDetails(
            type="https://terra-odyssey.local/errors/http-error",
            title="HTTP Error",
            status=exc.status_code,
            code=f"http_{exc.status_code}",
            detail=str(exc.detail) if exc.detail else "An HTTP error occurred.",
            instance=str(request.url.path),
            retryable=exc.status_code in {502, 503, 504},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server exception at %s: %s", request.url.path, exc)
        problem = ProblemDetails(
            type="https://terra-odyssey.local/errors/internal-error",
            title="Internal Server Error",
            status=500,
            code="internal_error",
            detail="An unexpected internal server error occurred.",
            instance=str(request.url.path),
            retryable=False,
        )
        return JSONResponse(
            status_code=500,
            content=problem.model_dump(exclude_none=True),
            media_type="application/problem+json",
        )
