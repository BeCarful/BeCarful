from __future__ import annotations

from cv_module.domain.enums import ClaimStatus
from cv_module.domain.errors import ConflictError

ALLOWED_TRANSITIONS: dict[ClaimStatus, frozenset[ClaimStatus]] = {
    ClaimStatus.DRAFT: frozenset({ClaimStatus.QUEUED, ClaimStatus.DELETED}),
    ClaimStatus.QUEUED: frozenset(
        {ClaimStatus.PREPROCESSING, ClaimStatus.FAILED, ClaimStatus.DELETED}
    ),
    ClaimStatus.PREPROCESSING: frozenset(
        {
            ClaimStatus.QUEUED,
            ClaimStatus.ASSESSING,
            ClaimStatus.NEEDS_MORE_PHOTOS,
            ClaimStatus.NEEDS_HUMAN_REVIEW,
            ClaimStatus.FAILED,
            ClaimStatus.DELETED,
        }
    ),
    ClaimStatus.ASSESSING: frozenset(
        {
            ClaimStatus.QUEUED,
            ClaimStatus.COMPLETED,
            ClaimStatus.NEEDS_HUMAN_REVIEW,
            ClaimStatus.FAILED,
            ClaimStatus.DELETED,
        }
    ),
    ClaimStatus.NEEDS_MORE_PHOTOS: frozenset({ClaimStatus.QUEUED, ClaimStatus.DELETED}),
    ClaimStatus.NEEDS_HUMAN_REVIEW: frozenset({ClaimStatus.QUEUED, ClaimStatus.DELETED}),
    ClaimStatus.FAILED: frozenset({ClaimStatus.QUEUED, ClaimStatus.DELETED}),
    ClaimStatus.COMPLETED: frozenset({ClaimStatus.QUEUED, ClaimStatus.DELETED}),
    ClaimStatus.DELETED: frozenset(),
}


def ensure_transition(current: ClaimStatus, target: ClaimStatus) -> None:
    if current == target:
        return
    if target not in ALLOWED_TRANSITIONS[current]:
        raise ConflictError(f"claim cannot transition from {current} to {target}")
