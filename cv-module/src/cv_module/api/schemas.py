from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from cv_module.domain.enums import ClaimStatus, RunStatus


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PrepareUploadRequest(ApiModel):
    content_type: str
    size_bytes: int = Field(gt=0)
    file_name: str | None = Field(default=None, min_length=1, max_length=255)


class UploadTicketResponse(ApiModel):
    image_id: str
    object_name: str
    upload_url: str
    method: str
    required_headers: dict[str, str]
    expires_in_seconds: int


class ClaimResponse(ApiModel):
    claim_id: str
    status: ClaimStatus
    created_at: datetime
    updated_at: datetime
    active_run_id: str | None
    image_count: int
    failure_code: str | None


class SubmissionResponse(ApiModel):
    claim_id: str
    analysis_run_id: str
    claim_status: ClaimStatus
    run_status: RunStatus


class AccountDeletionResponse(ApiModel):
    deleted_claims: int


class ErrorResponse(ApiModel):
    error: str
    message: str
