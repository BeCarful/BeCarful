from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict

from cv_module.config import Settings, get_settings
from cv_module.container import AppContainer, build_container
from cv_module.domain.errors import RetryablePipelineError, RunBusyError
from cv_module.logging_config import configure_logging


class ProcessRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str
    analysis_run_id: str


def create_worker_app(
    *, container: AppContainer | None = None, settings: Settings | None = None
) -> FastAPI:
    active_settings = settings or get_settings()
    configure_logging(active_settings.log_level)
    application = FastAPI(
        title="BeCarful Assessment Worker",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    application.state.container = container or build_container(active_settings)

    @application.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @application.post(
        "/internal/v1/analysis-runs:process",
        status_code=status.HTTP_204_NO_CONTENT,
    )
    async def process_run(
        request: ProcessRunRequest,
        x_cloudtasks_taskretrycount: int = Header(default=0),
    ) -> Response:
        try:
            await application.state.container.assessment_pipeline.process(
                request.claim_id,
                request.analysis_run_id,
                task_retry_count=x_cloudtasks_taskretrycount,
            )
        except (RetryablePipelineError, RunBusyError) as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return application


app = create_worker_app()
