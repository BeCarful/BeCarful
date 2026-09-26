from __future__ import annotations

import hashlib
from collections import defaultdict
from copy import deepcopy
from datetime import datetime

from cv_module.domain.enums import ClaimStatus, LeaseState, RunStatus
from cv_module.domain.errors import ConflictError, NotFoundError
from cv_module.domain.models import AnalysisRun, AssessmentV1, ClaimRecord, ImageRecord, RunLease
from cv_module.domain.transitions import ensure_transition
from cv_module.ports.auth import AuthenticatedUser
from cv_module.ports.storage import ObjectMetadata, UploadAuthorization

TERMINAL_RUN_STATUSES = frozenset(
    {
        RunStatus.COMPLETED,
        RunStatus.NEEDS_MORE_PHOTOS,
        RunStatus.NEEDS_HUMAN_REVIEW,
        RunStatus.FAILED,
    }
)


class InMemoryClaimRepository:
    def __init__(self) -> None:
        self.claims: dict[str, ClaimRecord] = {}
        self.images: dict[str, dict[str, ImageRecord]] = defaultdict(dict)
        self.runs: dict[str, dict[str, AnalysisRun]] = defaultdict(dict)
        self.assessments: dict[str, dict[str, AssessmentV1]] = defaultdict(dict)
        self.deletion_tombstones: dict[str, datetime] = {}

    async def create_claim(self, claim: ClaimRecord) -> None:
        if claim.claim_id in self.claims:
            raise ConflictError("claim already exists")
        self.claims[claim.claim_id] = deepcopy(claim)

    async def get_claim(self, claim_id: str) -> ClaimRecord | None:
        claim = self.claims.get(claim_id)
        return deepcopy(claim) if claim else None

    async def list_claims_for_owner(self, owner_uid: str) -> list[ClaimRecord]:
        return [deepcopy(c) for c in self.claims.values() if c.owner_uid == owner_uid]

    async def update_claim(self, claim: ClaimRecord) -> None:
        if claim.claim_id not in self.claims:
            raise NotFoundError("claim not found")
        self.claims[claim.claim_id] = deepcopy(claim)

    async def add_image(self, image: ImageRecord) -> None:
        if image.image_id in self.images[image.claim_id]:
            raise ConflictError("image already exists")
        self.images[image.claim_id][image.image_id] = deepcopy(image)

    async def get_image(self, claim_id: str, image_id: str) -> ImageRecord | None:
        image = self.images[claim_id].get(image_id)
        return deepcopy(image) if image else None

    async def list_images(self, claim_id: str) -> list[ImageRecord]:
        return [deepcopy(i) for i in self.images[claim_id].values()]

    async def update_image(self, image: ImageRecord) -> None:
        if image.image_id not in self.images[image.claim_id]:
            raise NotFoundError("image not found")
        self.images[image.claim_id][image.image_id] = deepcopy(image)

    async def create_run(self, run: AnalysisRun) -> None:
        if run.analysis_run_id in self.runs[run.claim_id]:
            raise ConflictError("analysis run already exists")
        self.runs[run.claim_id][run.analysis_run_id] = deepcopy(run)

    async def get_run(self, claim_id: str, run_id: str) -> AnalysisRun | None:
        run = self.runs[claim_id].get(run_id)
        return deepcopy(run) if run else None

    async def acquire_run(
        self, claim_id: str, run_id: str, now: datetime, lease_until: datetime
    ) -> RunLease:
        run = self.runs[claim_id].get(run_id)
        if run is None:
            raise NotFoundError("analysis run not found")
        if run.status in TERMINAL_RUN_STATUSES:
            return RunLease(state=LeaseState.TERMINAL, run=deepcopy(run))
        if run.status == RunStatus.RUNNING and run.lease_until and run.lease_until > now:
            return RunLease(state=LeaseState.BUSY, run=deepcopy(run))
        run.status = RunStatus.RUNNING
        run.updated_at = now
        run.lease_until = lease_until
        run.attempt_count += 1
        return RunLease(state=LeaseState.ACQUIRED, run=deepcopy(run))

    async def set_run_status(
        self,
        claim_id: str,
        run_id: str,
        status: RunStatus,
        now: datetime,
        *,
        error_code: str | None = None,
    ) -> AnalysisRun:
        run = self.runs[claim_id].get(run_id)
        if run is None:
            raise NotFoundError("analysis run not found")
        run.status = status
        run.updated_at = now
        run.error_code = error_code
        run.lease_until = None
        return deepcopy(run)

    async def set_claim_status(
        self,
        claim_id: str,
        status: ClaimStatus,
        now: datetime,
        *,
        failure_code: str | None = None,
    ) -> ClaimRecord:
        claim = self.claims.get(claim_id)
        if claim is None:
            raise NotFoundError("claim not found")
        ensure_transition(claim.status, status)
        claim.status = status
        claim.updated_at = now
        claim.failure_code = failure_code
        return deepcopy(claim)

    async def save_assessment(self, assessment: AssessmentV1) -> None:
        claim = self.claims.get(assessment.claim_id)
        if claim is None or claim.status == ClaimStatus.DELETED:
            raise NotFoundError("claim was deleted before assessment persistence")
        self.assessments[assessment.claim_id][assessment.analysis_run_id] = deepcopy(assessment)

    async def get_assessment(self, claim_id: str, run_id: str) -> AssessmentV1 | None:
        assessment = self.assessments[claim_id].get(run_id)
        return deepcopy(assessment) if assessment else None

    async def delete_claim_tree(self, claim_id: str, deleted_at: datetime) -> None:
        self.claims.pop(claim_id, None)
        self.images.pop(claim_id, None)
        self.runs.pop(claim_id, None)
        self.assessments.pop(claim_id, None)
        self.deletion_tombstones[hashlib.sha256(claim_id.encode()).hexdigest()] = deleted_at


class InMemoryObjectStorage:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str, str]] = {}
        self._generation = 0

    async def create_upload_authorization(
        self, object_name: str, content_type: str, expires_in_seconds: int
    ) -> UploadAuthorization:
        return UploadAuthorization(
            url=f"memory://upload/{object_name}",
            required_headers={
                "Content-Type": content_type,
                "x-goog-if-generation-match": "0",
            },
            expires_in_seconds=expires_in_seconds,
        )

    async def put_for_test(self, object_name: str, data: bytes, content_type: str) -> None:
        if object_name in self.objects:
            raise ConflictError("write-once object already exists")
        self._generation += 1
        self.objects[object_name] = (data, content_type, str(self._generation))

    async def stat(self, object_name: str) -> ObjectMetadata:
        try:
            data, content_type, generation = self.objects[object_name]
        except KeyError as exc:
            raise NotFoundError("uploaded object not found") from exc
        return ObjectMetadata(
            object_name=object_name,
            size_bytes=len(data),
            content_type=content_type,
            generation=generation,
            sha256=hashlib.sha256(data).hexdigest(),
        )

    async def download(self, object_name: str) -> bytes:
        try:
            return self.objects[object_name][0]
        except KeyError as exc:
            raise NotFoundError("object not found") from exc

    async def upload_bytes(self, object_name: str, data: bytes, content_type: str) -> None:
        self._generation += 1
        self.objects[object_name] = (data, content_type, str(self._generation))

    async def upload_json(self, object_name: str, payload: str) -> None:
        await self.upload_bytes(object_name, payload.encode(), "application/json")

    async def delete_prefix(self, prefix: str) -> None:
        for object_name in list(self.objects):
            if object_name.startswith(prefix):
                del self.objects[object_name]

    def gcs_uri(self, object_name: str) -> str:
        return f"memory://objects/{object_name}"


class InMemoryTaskQueue:
    def __init__(self) -> None:
        self.tasks: list[tuple[str, str]] = []

    async def enqueue(self, claim_id: str, analysis_run_id: str) -> None:
        task = (claim_id, analysis_run_id)
        if task not in self.tasks:
            self.tasks.append(task)


class DevelopmentAuthVerifier:
    async def verify(self, token: str | None) -> AuthenticatedUser:
        if token is None or not token.startswith("dev:") or len(token) <= 4:
            from cv_module.domain.errors import ForbiddenError

            raise ForbiddenError("development token must use dev:<uid>")
        return AuthenticatedUser(uid=token[4:])
