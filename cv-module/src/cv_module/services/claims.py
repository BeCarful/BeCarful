from __future__ import annotations

import hashlib
import json
import secrets
from dataclasses import dataclass

from cv_module.config import Settings
from cv_module.domain.enums import ClaimStatus, ImageState, RunStatus
from cv_module.domain.errors import (
    AssessmentNotReadyError,
    ConflictError,
    ForbiddenError,
    InvalidInputError,
    NotFoundError,
)
from cv_module.domain.models import (
    AnalysisRun,
    AssessmentV1,
    ClaimExportV1,
    ClaimRecord,
    ImageRecord,
    RawGeminiResponses,
    SourceImageExport,
)
from cv_module.domain.transitions import ensure_transition
from cv_module.ports.clock import Clock
from cv_module.ports.repository import ClaimRepository
from cv_module.ports.storage import ObjectStorage, UploadAuthorization
from cv_module.ports.tasks import AnalysisTaskQueue
from cv_module.services.image_processing import SUPPORTED_CONTENT_TYPES


@dataclass(frozen=True)
class PreparedUpload:
    image: ImageRecord
    authorization: UploadAuthorization


@dataclass(frozen=True)
class Submission:
    claim: ClaimRecord
    run: AnalysisRun


class ClaimService:
    def __init__(
        self,
        repository: ClaimRepository,
        storage: ObjectStorage,
        tasks: AnalysisTaskQueue,
        clock: Clock,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._storage = storage
        self._tasks = tasks
        self._clock = clock
        self._settings = settings

    async def create_claim(self, owner_uid: str) -> ClaimRecord:
        now = self._clock.now()
        claim = ClaimRecord(
            claim_id=f"clm_{secrets.token_hex(12)}",
            owner_uid=owner_uid,
            status=ClaimStatus.DRAFT,
            created_at=now,
            updated_at=now,
        )
        await self._repository.create_claim(claim)
        return claim

    async def prepare_upload(
        self,
        owner_uid: str,
        claim_id: str,
        *,
        content_type: str,
        size_bytes: int,
        file_name: str | None = None,
    ) -> PreparedUpload:
        claim = await self.get_owned_claim(owner_uid, claim_id)
        if claim.status not in {
            ClaimStatus.DRAFT,
            ClaimStatus.NEEDS_MORE_PHOTOS,
            ClaimStatus.NEEDS_HUMAN_REVIEW,
            ClaimStatus.FAILED,
        }:
            raise ConflictError("images cannot be added while this claim is processing")
        if content_type not in SUPPORTED_CONTENT_TYPES:
            raise InvalidInputError("unsupported image content type")
        if size_bytes <= 0 or size_bytes > self._settings.maximum_image_bytes:
            raise InvalidInputError("image size is outside the allowed range")
        images = await self._repository.list_images(claim_id)
        if len(images) >= self._settings.maximum_images_per_claim:
            raise ConflictError("claim already has the maximum number of images")

        now = self._clock.now()
        image_id = f"img_{secrets.token_hex(10)}"
        object_name = f"claims/{claim_id}/uploads/{image_id}"
        image = ImageRecord(
            image_id=image_id,
            claim_id=claim_id,
            object_name=object_name,
            content_type=content_type,
            declared_size_bytes=size_bytes,
            file_name=self._sanitize_file_name(file_name),
            state=ImageState.PREPARED,
            created_at=now,
        )
        authorization = await self._storage.create_upload_authorization(
            object_name,
            content_type,
            self._settings.upload_url_ttl_seconds,
        )
        await self._repository.add_image(image)
        claim.image_count = len(images) + 1
        claim.updated_at = now
        await self._repository.update_claim(claim)
        return PreparedUpload(image=image, authorization=authorization)

    async def submit(self, owner_uid: str, claim_id: str) -> Submission:
        claim = await self.get_owned_claim(owner_uid, claim_id)
        if claim.status in {
            ClaimStatus.QUEUED,
            ClaimStatus.PREPROCESSING,
            ClaimStatus.ASSESSING,
        }:
            if not claim.active_run_id:
                raise ConflictError("processing claim has no active run")
            run = await self._repository.get_run(claim_id, claim.active_run_id)
            if run is None:
                raise ConflictError("active analysis run is missing")
            return Submission(claim=claim, run=run)
        if claim.status not in {
            ClaimStatus.DRAFT,
            ClaimStatus.NEEDS_MORE_PHOTOS,
            ClaimStatus.NEEDS_HUMAN_REVIEW,
            ClaimStatus.FAILED,
            ClaimStatus.COMPLETED,
        }:
            raise ConflictError("claim cannot be submitted in its current state")

        images = await self._repository.list_images(claim_id)
        if not images:
            raise InvalidInputError("at least one uploaded image is required")

        frozen: list[ImageRecord] = []
        for image in sorted(images, key=lambda item: item.image_id):
            metadata = await self._storage.stat(image.object_name)
            if metadata.size_bytes > self._settings.maximum_image_bytes:
                raise InvalidInputError(f"{image.image_id} exceeds the maximum size")
            if metadata.content_type != image.content_type:
                raise InvalidInputError(f"{image.image_id} content type changed during upload")
            image.state = ImageState.FROZEN
            image.uploaded_at = self._clock.now()
            image.generation = metadata.generation
            image.sha256 = metadata.sha256
            await self._repository.update_image(image)
            frozen.append(image)

        generation_material = "|".join(f"{image.image_id}:{image.generation}" for image in frozen)
        run_digest = hashlib.sha256(f"{claim_id}|{generation_material}".encode()).hexdigest()[:24]
        run_id = f"run_{run_digest}"
        existing = await self._repository.get_run(claim_id, run_id)
        if existing:
            claim.active_run_id = run_id
            return Submission(claim=claim, run=existing)

        now = self._clock.now()
        run = AnalysisRun(
            analysis_run_id=run_id,
            claim_id=claim_id,
            status=RunStatus.QUEUED,
            created_at=now,
            updated_at=now,
            submitted_image_generations={
                image.image_id: image.generation or "" for image in frozen
            },
        )
        await self._repository.create_run(run)
        ensure_transition(claim.status, ClaimStatus.QUEUED)
        claim.status = ClaimStatus.QUEUED
        claim.active_run_id = run_id
        claim.updated_at = now
        claim.failure_code = None
        await self._repository.update_claim(claim)
        try:
            await self._tasks.enqueue(claim_id, run_id)
        except Exception:
            await self._repository.set_run_status(
                claim_id,
                run_id,
                RunStatus.FAILED,
                self._clock.now(),
                error_code="task_enqueue_failed",
            )
            await self._repository.set_claim_status(
                claim_id,
                ClaimStatus.FAILED,
                self._clock.now(),
                failure_code="task_enqueue_failed",
            )
            raise
        return Submission(claim=claim, run=run)

    async def get_owned_claim(self, owner_uid: str, claim_id: str) -> ClaimRecord:
        claim = await self._repository.get_claim(claim_id)
        if claim is None:
            raise NotFoundError("claim not found")
        if claim.owner_uid != owner_uid:
            raise ForbiddenError("claim belongs to another user")
        return claim

    async def get_assessment(self, owner_uid: str, claim_id: str) -> AssessmentV1:
        claim = await self.get_owned_claim(owner_uid, claim_id)
        if not claim.active_run_id:
            raise NotFoundError("claim has no assessment")
        assessment = await self._repository.get_assessment(claim_id, claim.active_run_id)
        if assessment is None:
            raise NotFoundError("assessment is not ready")
        return assessment

    async def get_claim_export(self, owner_uid: str, claim_id: str) -> ClaimExportV1:
        claim = await self.get_owned_claim(owner_uid, claim_id)
        if not claim.active_run_id:
            raise AssessmentNotReadyError("claim has no completed assessment")
        assessment = await self._repository.get_assessment(claim_id, claim.active_run_id)
        if assessment is None:
            raise AssessmentNotReadyError("assessment is not ready")

        run = await self._repository.get_run(claim_id, claim.active_run_id)
        if run is None:
            raise NotFoundError("analysis run not found")
        submitted_ids = set(run.submitted_image_generations)
        images = [
            image
            for image in await self._repository.list_images(claim_id)
            if image.image_id in submitted_ids
        ]
        images.sort(key=lambda image: (image.created_at, image.image_id))

        artifact_prefix = f"claims/{claim_id}/runs/{claim.active_run_id}/raw"
        intake = await self._download_json_object(f"{artifact_prefix}/intake.json")
        try:
            raw_assessment = await self._download_json_object(
                f"{artifact_prefix}/assessment.json"
            )
        except NotFoundError:
            raw_assessment = None

        return ClaimExportV1(
            claim_id=claim_id,
            analysis_run_id=claim.active_run_id,
            source_images=[
                SourceImageExport(
                    image_id=image.image_id,
                    file_name=image.file_name,
                    content_type=image.content_type,
                    size_bytes=image.declared_size_bytes,
                )
                for image in images
            ],
            assessment=assessment,
            raw_gemini=RawGeminiResponses(
                intake=intake,
                assessment=raw_assessment,
            ),
        )

    async def delete_claim(self, owner_uid: str, claim_id: str) -> None:
        await self.get_owned_claim(owner_uid, claim_id)
        await self._repository.set_claim_status(claim_id, ClaimStatus.DELETED, self._clock.now())
        await self._storage.delete_prefix(f"claims/{claim_id}/")
        await self._repository.delete_claim_tree(claim_id, self._clock.now())

    async def delete_account_data(self, owner_uid: str) -> int:
        claims = await self._repository.list_claims_for_owner(owner_uid)
        for claim in claims:
            await self._repository.set_claim_status(
                claim.claim_id, ClaimStatus.DELETED, self._clock.now()
            )
            await self._storage.delete_prefix(f"claims/{claim.claim_id}/")
            await self._repository.delete_claim_tree(claim.claim_id, self._clock.now())
        return len(claims)

    async def _download_json_object(self, object_name: str) -> dict[str, object]:
        payload = await self._storage.download(object_name)
        try:
            decoded = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise InvalidInputError("stored Gemini artifact is not valid JSON") from exc
        if not isinstance(decoded, dict):
            raise InvalidInputError("stored Gemini artifact must be a JSON object")
        return decoded

    @staticmethod
    def _sanitize_file_name(file_name: str | None) -> str | None:
        if file_name is None:
            return None
        basename = file_name.replace("\\", "/").rsplit("/", maxsplit=1)[-1]
        sanitized = "".join(character for character in basename if ord(character) >= 32).strip()
        if not sanitized:
            raise InvalidInputError("file name must contain visible characters")
        return sanitized[:255]
