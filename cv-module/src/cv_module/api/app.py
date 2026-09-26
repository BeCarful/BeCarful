from __future__ import annotations

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from cv_module.api.routes.claims import router as claims_router
from cv_module.api.schemas import ErrorResponse
from cv_module.config import Settings, get_settings
from cv_module.container import AppContainer, build_container
from cv_module.domain.errors import (
    ConflictError,
    DomainError,
    ForbiddenError,
    InvalidInputError,
    NotFoundError,
)
from cv_module.logging_config import configure_logging


def create_app(
    *, container: AppContainer | None = None, settings: Settings | None = None
) -> FastAPI:
    active_settings = settings or get_settings()
    configure_logging(active_settings.log_level)
    application = FastAPI(
        title="BeCarful Car Damage Assessment API",
        version="0.1.0",
        description=(
            "Evaluation-only visible vehicle damage assessment. Results are not insurance, "
            "safety, liability, or repair decisions."
        ),
    )
    application.state.container = container or build_container(active_settings)
    allowed_origins = active_settings.effective_cors_allowed_origins()
    if allowed_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(allowed_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["Content-Type", "Authorization"],
        )
    application.include_router(claims_router)

    @application.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/readyz", include_in_schema=False)
    async def readyz() -> Response:
        errors = active_settings.readiness_errors()
        payload: dict[str, object] = {
            "status": "not_ready" if errors else "ready",
            "inference_mode": active_settings.inference_mode,
        }
        if active_settings.inference_mode == "gemini":
            payload["gemini_auth_mode"] = active_settings.gemini_auth_mode
            payload["gemini_model"] = active_settings.gemini_model
        if errors:
            payload["reasons"] = errors
        return JSONResponse(status_code=503 if errors else 200, content=payload)

    @application.exception_handler(DomainError)
    async def domain_error_handler(_request: Request, exc: DomainError) -> JSONResponse:
        status_code = 400
        if isinstance(exc, NotFoundError):
            status_code = 404
        elif isinstance(exc, ForbiddenError):
            status_code = 403
        elif isinstance(exc, ConflictError):
            status_code = 409
        elif isinstance(exc, InvalidInputError):
            status_code = 422
        payload = ErrorResponse(error=exc.code, message=str(exc))
        return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))

    return application


app = create_app()
