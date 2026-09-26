from __future__ import annotations

from datetime import datetime
from typing import Protocol

from cv_module.domain.enums import ClaimStatus, RunStatus
from cv_module.domain.models import (
    AnalysisRun,
    AssessmentV1,
    ClaimRecord,
    ImageRecord,
    RunLease,
)


class ClaimRepository(Protocol):
    async def create_claim(self, claim: ClaimRecord) -> None: ...

    async def get_claim(self, claim_id: str) -> ClaimRecord | None: ...

    async def list_claims_for_owner(self, owner_uid: str) -> list[ClaimRecord]: ...

    async def update_claim(self, claim: ClaimRecord) -> None: ...

    async def add_image(self, image: ImageRecord) -> None: ...

    async def get_image(self, claim_id: str, image_id: str) -> ImageRecord | None: ...

    async def list_images(self, claim_id: str) -> list[ImageRecord]: ...

    async def update_image(self, image: ImageRecord) -> None: ...

    async def create_run(self, run: AnalysisRun) -> None: ...

    async def get_run(self, claim_id: str, run_id: str) -> AnalysisRun | None: ...

    async def acquire_run(
        self, claim_id: str, run_id: str, now: datetime, lease_until: datetime
    ) -> RunLease: ...

    async def set_run_status(
        self,
        claim_id: str,
        run_id: str,
        status: RunStatus,
        now: datetime,
        *,
        error_code: str | None = None,
    ) -> AnalysisRun: ...

    async def set_claim_status(
        self,
        claim_id: str,
        status: ClaimStatus,
        now: datetime,
        *,
        failure_code: str | None = None,
    ) -> ClaimRecord: ...

    async def save_assessment(self, assessment: AssessmentV1) -> None: ...

    async def get_assessment(self, claim_id: str, run_id: str) -> AssessmentV1 | None: ...

    async def delete_claim_tree(self, claim_id: str, deleted_at: datetime) -> None: ...
