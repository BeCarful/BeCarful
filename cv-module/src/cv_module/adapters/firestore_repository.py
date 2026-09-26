from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime
from typing import Any, TypeVar, cast

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel

from cv_module.domain.enums import ClaimStatus, LeaseState, RunStatus
from cv_module.domain.errors import ConflictError, NotFoundError
from cv_module.domain.models import AnalysisRun, AssessmentV1, ClaimRecord, ImageRecord, RunLease
from cv_module.domain.transitions import ensure_transition

ModelT = TypeVar("ModelT", bound=BaseModel)

TERMINAL_RUN_STATUSES = frozenset(
    {
        RunStatus.COMPLETED,
        RunStatus.NEEDS_MORE_PHOTOS,
        RunStatus.NEEDS_HUMAN_REVIEW,
        RunStatus.FAILED,
    }
)


def _dump(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json")


class FirestoreClaimRepository:
    def __init__(self, project: str) -> None:
        self._client = firestore.Client(project=project)

    def _claim_ref(self, claim_id: str) -> Any:
        return self._client.collection("claims").document(claim_id)

    def _image_ref(self, claim_id: str, image_id: str) -> Any:
        return self._claim_ref(claim_id).collection("images").document(image_id)

    def _run_ref(self, claim_id: str, run_id: str) -> Any:
        return self._claim_ref(claim_id).collection("runs").document(run_id)

    def _assessment_ref(self, claim_id: str, run_id: str) -> Any:
        return self._claim_ref(claim_id).collection("assessments").document(run_id)

    async def create_claim(self, claim: ClaimRecord) -> None:
        def create() -> None:
            ref = self._claim_ref(claim.claim_id)
            if ref.get().exists:
                raise ConflictError("claim already exists")
            ref.create(_dump(claim))

        await asyncio.to_thread(create)

    async def get_claim(self, claim_id: str) -> ClaimRecord | None:
        snapshot = await asyncio.to_thread(self._claim_ref(claim_id).get)
        return ClaimRecord.model_validate(snapshot.to_dict()) if snapshot.exists else None

    async def list_claims_for_owner(self, owner_uid: str) -> list[ClaimRecord]:
        def query() -> list[ClaimRecord]:
            snapshots = (
                self._client.collection("claims")
                .where(filter=FieldFilter("owner_uid", "==", owner_uid))
                .stream()
            )
            return [ClaimRecord.model_validate(snapshot.to_dict()) for snapshot in snapshots]

        return await asyncio.to_thread(query)

    async def update_claim(self, claim: ClaimRecord) -> None:
        await asyncio.to_thread(self._claim_ref(claim.claim_id).set, _dump(claim))

    async def add_image(self, image: ImageRecord) -> None:
        def create() -> None:
            ref = self._image_ref(image.claim_id, image.image_id)
            if ref.get().exists:
                raise ConflictError("image already exists")
            ref.create(_dump(image))

        await asyncio.to_thread(create)

    async def get_image(self, claim_id: str, image_id: str) -> ImageRecord | None:
        snapshot = await asyncio.to_thread(self._image_ref(claim_id, image_id).get)
        return ImageRecord.model_validate(snapshot.to_dict()) if snapshot.exists else None

    async def list_images(self, claim_id: str) -> list[ImageRecord]:
        def stream() -> list[ImageRecord]:
            return [
                ImageRecord.model_validate(snapshot.to_dict())
                for snapshot in self._claim_ref(claim_id).collection("images").stream()
            ]

        return await asyncio.to_thread(stream)

    async def update_image(self, image: ImageRecord) -> None:
        await asyncio.to_thread(
            self._image_ref(image.claim_id, image.image_id).set,
            _dump(image),
        )

    async def create_run(self, run: AnalysisRun) -> None:
        def create() -> None:
            ref = self._run_ref(run.claim_id, run.analysis_run_id)
            if ref.get().exists:
                raise ConflictError("analysis run already exists")
            ref.create(_dump(run))

        await asyncio.to_thread(create)

    async def get_run(self, claim_id: str, run_id: str) -> AnalysisRun | None:
        snapshot = await asyncio.to_thread(self._run_ref(claim_id, run_id).get)
        return AnalysisRun.model_validate(snapshot.to_dict()) if snapshot.exists else None

    async def acquire_run(
        self, claim_id: str, run_id: str, now: datetime, lease_until: datetime
    ) -> RunLease:
        ref = self._run_ref(claim_id, run_id)

        def acquire() -> RunLease:
            transaction = self._client.transaction()

            @firestore.transactional
            def transact(txn: Any) -> RunLease:
                snapshot = ref.get(transaction=txn)
                if not snapshot.exists:
                    raise NotFoundError("analysis run not found")
                run = AnalysisRun.model_validate(snapshot.to_dict())
                if run.status in TERMINAL_RUN_STATUSES:
                    return RunLease(state=LeaseState.TERMINAL, run=run)
                if run.status == RunStatus.RUNNING and run.lease_until and run.lease_until > now:
                    return RunLease(state=LeaseState.BUSY, run=run)
                run.status = RunStatus.RUNNING
                run.updated_at = now
                run.lease_until = lease_until
                run.attempt_count += 1
                txn.set(ref, _dump(run))
                return RunLease(state=LeaseState.ACQUIRED, run=run)

            return cast(RunLease, transact(transaction))

        return await asyncio.to_thread(acquire)

    async def set_run_status(
        self,
        claim_id: str,
        run_id: str,
        status: RunStatus,
        now: datetime,
        *,
        error_code: str | None = None,
    ) -> AnalysisRun:
        run = await self.get_run(claim_id, run_id)
        if run is None:
            raise NotFoundError("analysis run not found")
        run.status = status
        run.updated_at = now
        run.error_code = error_code
        run.lease_until = None
        await asyncio.to_thread(self._run_ref(claim_id, run_id).set, _dump(run))
        return run

    async def set_claim_status(
        self,
        claim_id: str,
        status: ClaimStatus,
        now: datetime,
        *,
        failure_code: str | None = None,
    ) -> ClaimRecord:
        claim = await self.get_claim(claim_id)
        if claim is None:
            raise NotFoundError("claim not found")
        ensure_transition(claim.status, status)
        claim.status = status
        claim.updated_at = now
        claim.failure_code = failure_code
        await asyncio.to_thread(self._claim_ref(claim_id).set, _dump(claim))
        return claim

    async def save_assessment(self, assessment: AssessmentV1) -> None:
        claim_ref = self._claim_ref(assessment.claim_id)
        assessment_ref = self._assessment_ref(assessment.claim_id, assessment.analysis_run_id)

        def save() -> None:
            transaction = self._client.transaction()

            @firestore.transactional
            def transact(txn: Any) -> None:
                snapshot = claim_ref.get(transaction=txn)
                if not snapshot.exists:
                    raise NotFoundError("claim was deleted before assessment persistence")
                claim = ClaimRecord.model_validate(snapshot.to_dict())
                if claim.status == ClaimStatus.DELETED:
                    raise NotFoundError("claim was deleted before assessment persistence")
                txn.set(assessment_ref, _dump(assessment))

            transact(transaction)

        await asyncio.to_thread(save)

    async def get_assessment(self, claim_id: str, run_id: str) -> AssessmentV1 | None:
        snapshot = await asyncio.to_thread(self._assessment_ref(claim_id, run_id).get)
        return AssessmentV1.model_validate(snapshot.to_dict()) if snapshot.exists else None

    async def delete_claim_tree(self, claim_id: str, deleted_at: datetime) -> None:
        def delete() -> None:
            claim_ref = self._claim_ref(claim_id)
            batch = self._client.batch()
            for collection_name in ("images", "runs", "assessments"):
                for document in claim_ref.collection(collection_name).stream():
                    batch.delete(document.reference)
            batch.delete(claim_ref)
            tombstone_id = hashlib.sha256(claim_id.encode()).hexdigest()
            batch.set(
                self._client.collection("deletion_tombstones").document(tombstone_id),
                {"claim_hash": tombstone_id, "deleted_at": deleted_at.isoformat()},
            )
            batch.commit()

        await asyncio.to_thread(delete)
