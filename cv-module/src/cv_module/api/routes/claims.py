from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from cv_module.adapters.local_storage import LocalFileObjectStorage
from cv_module.api.dependencies import ContainerDependency, UserDependency
from cv_module.api.schemas import (
    AccountDeletionResponse,
    ClaimResponse,
    PrepareUploadRequest,
    SubmissionResponse,
    UploadTicketResponse,
)
from cv_module.domain.errors import ConflictError, InvalidInputError, NotFoundError
from cv_module.domain.models import AssessmentV1, ClaimExportV1, ClaimRecord

router = APIRouter(prefix="/v1", tags=["claims"])


@router.put(
    "/local-uploads/{upload_token}",
    status_code=status.HTTP_204_NO_CONTENT,
    include_in_schema=False,
)
async def receive_local_upload(
    upload_token: str,
    request: Request,
    container: ContainerDependency,
) -> Response:
    if not isinstance(container.storage, LocalFileObjectStorage):
        raise NotFoundError("local uploads are not enabled")
    content_type = request.headers.get("Content-Type", "").split(";", maxsplit=1)[0]
    if not content_type:
        raise InvalidInputError("Content-Type is required")
    payload = bytearray()
    async for chunk in request.stream():
        if len(payload) + len(chunk) > container.settings.maximum_image_bytes:
            raise InvalidInputError("image exceeds the maximum size")
        payload.extend(chunk)
    if not payload:
        raise InvalidInputError("image upload is empty")
    await container.storage.put_authorized(upload_token, bytes(payload), content_type)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _claim_response(claim: ClaimRecord) -> ClaimResponse:
    return ClaimResponse(
        claim_id=claim.claim_id,
        status=claim.status,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
        active_run_id=claim.active_run_id,
        image_count=claim.image_count,
        failure_code=claim.failure_code,
    )


@router.post("/claims", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_claim(
    container: ContainerDependency,
    user: UserDependency,
) -> ClaimResponse:
    return _claim_response(await container.claims.create_claim(user.uid))


@router.post(
    "/claims/{claim_id}/images:prepare-upload",
    response_model=UploadTicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def prepare_upload(
    claim_id: str,
    request: PrepareUploadRequest,
    container: ContainerDependency,
    user: UserDependency,
) -> UploadTicketResponse:
    prepared = await container.claims.prepare_upload(
        user.uid,
        claim_id,
        content_type=request.content_type,
        size_bytes=request.size_bytes,
        file_name=request.file_name,
    )
    return UploadTicketResponse(
        image_id=prepared.image.image_id,
        object_name=prepared.image.object_name,
        upload_url=prepared.authorization.url,
        method=prepared.authorization.method,
        required_headers=prepared.authorization.required_headers,
        expires_in_seconds=prepared.authorization.expires_in_seconds,
    )


@router.post(
    "/claims/{claim_id}:submit",
    response_model=SubmissionResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_claim(
    claim_id: str,
    container: ContainerDependency,
    user: UserDependency,
) -> SubmissionResponse:
    submission = await container.claims.submit(user.uid, claim_id)
    return SubmissionResponse(
        claim_id=claim_id,
        analysis_run_id=submission.run.analysis_run_id,
        claim_status=submission.claim.status,
        run_status=submission.run.status,
    )


@router.get("/claims/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: str,
    container: ContainerDependency,
    user: UserDependency,
) -> ClaimResponse:
    return _claim_response(await container.claims.get_owned_claim(user.uid, claim_id))


@router.get("/claims/{claim_id}/assessment", response_model=AssessmentV1)
async def get_assessment(
    claim_id: str,
    container: ContainerDependency,
    user: UserDependency,
) -> AssessmentV1:
    return await container.claims.get_assessment(user.uid, claim_id)


@router.get("/claims/{claim_id}/export", response_model=ClaimExportV1)
async def get_claim_export(
    claim_id: str,
    container: ContainerDependency,
    user: UserDependency,
) -> ClaimExportV1:
    return await container.claims.get_claim_export(user.uid, claim_id)


@router.delete("/claims/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_claim(
    claim_id: str,
    container: ContainerDependency,
    user: UserDependency,
) -> Response:
    await container.claims.delete_claim(user.uid, claim_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/users/me/data", response_model=AccountDeletionResponse)
async def delete_account_data(
    container: ContainerDependency,
    user: UserDependency,
) -> AccountDeletionResponse:
    if container.settings.auth_mode == "disabled":
        raise ConflictError("account-wide deletion is unavailable while authentication is disabled")
    deleted = await container.claims.delete_account_data(user.uid)
    return AccountDeletionResponse(deleted_claims=deleted)
