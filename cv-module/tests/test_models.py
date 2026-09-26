from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from cv_module.domain.enums import ClaimStatus, VehicleView
from cv_module.domain.models import (
    AssessmentSummary,
    AssessmentV1,
    BoundingBox,
    Coverage,
    ProcessingMetadata,
    RawFinding,
)


def test_bounding_box_rejects_reversed_coordinates() -> None:
    with pytest.raises(ValidationError):
        BoundingBox(x_min=0.8, y_min=0.1, x_max=0.2, y_max=0.9)


def test_coverage_consistency_is_enforced() -> None:
    now = datetime.now(UTC)
    with pytest.raises(ValidationError):
        AssessmentV1(
            claim_id="clm_test",
            analysis_run_id="run_test",
            status=ClaimStatus.NEEDS_MORE_PHOTOS,
            submitted_at=now,
            completed_at=now,
            processing=ProcessingMetadata(
                model_id="fake",
                prompt_version="v1",
                schema_version="1.0",
                code_revision="test",
                started_at=now,
                completed_at=now,
                latency_ms=1,
            ),
            images=[],
            coverage=Coverage(
                required=[VehicleView.FRONT],
                observed=[],
                missing=[VehicleView.FRONT],
                recommended_missing=[],
                complete=True,
            ),
            findings=[],
            summary=AssessmentSummary(damaged_part_ids=[]),
            needs_human_review=True,
            review_reasons=[],
            limitations=[],
        )


def test_unknown_part_taxonomy_value_is_rejected() -> None:
    with pytest.raises(ValidationError):
        RawFinding.model_validate(
            {
                "part_id": "engine",
                "damage_type": "dent",
                "visual_severity": "minor",
                "model_confidence": 0.5,
                "evidence": [
                    {
                        "image_id": "img_1",
                        "bbox": {"x_min": 0.1, "y_min": 0.1, "x_max": 0.2, "y_max": 0.2},
                    }
                ],
            }
        )
