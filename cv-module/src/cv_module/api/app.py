from __future__ import annotations

from fastapi import FastAPI, Request
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
    application.include_router(claims_router)

    @application.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

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
