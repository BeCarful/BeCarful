from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from datetime import datetime
from pathlib import Path
from typing import Any, TypeVar

from cv_module.adapters.in_memory import InMemoryClaimRepository
from cv_module.domain.enums import ClaimStatus, RunStatus
from cv_module.domain.models import AnalysisRun, AssessmentV1, ClaimRecord, ImageRecord, RunLease

ResultT = TypeVar("ResultT")


class LocalJsonClaimRepository(InMemoryClaimRepository):
    """Small, atomic JSON persistence layer for the single-process local runtime."""

    def __init__(self, path: Path) -> None:
        super().__init__()
        self._path = path.resolve()
        self._lock = asyncio.Lock()
        self._load()

    async def create_claim(self, claim: ClaimRecord) -> None:
        await self._mutate(lambda: super(LocalJsonClaimRepository, self).create_claim(claim))

    async def update_claim(self, claim: ClaimRecord) -> None:
        await self._mutate(lambda: super(LocalJsonClaimRepository, self).update_claim(claim))

    async def add_image(self, image: ImageRecord) -> None:
        await self._mutate(lambda: super(LocalJsonClaimRepository, self).add_image(image))

    async def update_image(self, image: ImageRecord) -> None:
        await self._mutate(lambda: super(LocalJsonClaimRepository, self).update_image(image))

    async def create_run(self, run: AnalysisRun) -> None:
        await self._mutate(lambda: super(LocalJsonClaimRepository, self).create_run(run))

    async def acquire_run(
        self, claim_id: str, run_id: str, now: datetime, lease_until: datetime
    ) -> RunLease:
        return await self._mutate(
            lambda: super(LocalJsonClaimRepository, self).acquire_run(
                claim_id, run_id, now, lease_until
            )
        )

    async def set_run_status(
        self,
        claim_id: str,
        run_id: str,
        status: RunStatus,
        now: datetime,
        *,
        error_code: str | None = None,
    ) -> AnalysisRun:
        return await self._mutate(
            lambda: super(LocalJsonClaimRepository, self).set_run_status(
                claim_id, run_id, status, now, error_code=error_code
            )
        )

    async def set_claim_status(
        self,
        claim_id: str,
        status: ClaimStatus,
        now: datetime,
        *,
        failure_code: str | None = None,
    ) -> ClaimRecord:
        return await self._mutate(
            lambda: super(LocalJsonClaimRepository, self).set_claim_status(
                claim_id, status, now, failure_code=failure_code
            )
        )

    async def save_assessment(self, assessment: AssessmentV1) -> None:
        await self._mutate(
            lambda: super(LocalJsonClaimRepository, self).save_assessment(assessment)
        )

    async def delete_claim_tree(self, claim_id: str, deleted_at: datetime) -> None:
        await self._mutate(
            lambda: super(LocalJsonClaimRepository, self).delete_claim_tree(
                claim_id, deleted_at
            )
        )

    async def _mutate(self, operation: Callable[[], Awaitable[ResultT]]) -> ResultT:
        async with self._lock:
            result = await operation()
            self._persist()
            return result

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
            for raw in payload.get("claims", []):
                claim = ClaimRecord.model_validate(raw)
                self.claims[claim.claim_id] = claim
            for raw in payload.get("images", []):
                image = ImageRecord.model_validate(raw)
                self.images[image.claim_id][image.image_id] = image
            for raw in payload.get("runs", []):
                run = AnalysisRun.model_validate(raw)
                self.runs[run.claim_id][run.analysis_run_id] = run
            for raw in payload.get("assessments", []):
                assessment = AssessmentV1.model_validate(raw)
                self.assessments[assessment.claim_id][assessment.analysis_run_id] = assessment
            self.deletion_tombstones = {
                key: datetime.fromisoformat(value)
                for key, value in payload.get("deletion_tombstones", {}).items()
            }
        except (OSError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"local repository is unreadable: {self._path}") from exc

    def _persist(self) -> None:
        payload: dict[str, Any] = {
            "schema_version": 1,
            "claims": [item.model_dump(mode="json") for item in self.claims.values()],
            "images": [
                item.model_dump(mode="json")
                for claim_images in self.images.values()
                for item in claim_images.values()
            ],
            "runs": [
                item.model_dump(mode="json")
                for claim_runs in self.runs.values()
                for item in claim_runs.values()
            ],
            "assessments": [
                item.model_dump(mode="json")
                for claim_assessments in self.assessments.values()
                for item in claim_assessments.values()
            ],
            "deletion_tombstones": {
                key: value.isoformat() for key, value in self.deletion_tombstones.items()
            },
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temporary_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        temporary_path.replace(self._path)
