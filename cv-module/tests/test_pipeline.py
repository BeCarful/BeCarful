from __future__ import annotations

from collections.abc import Callable

import pytest

from cv_module.adapters.in_memory import InMemoryClaimRepository, InMemoryObjectStorage
from cv_module.container import AppContainer
from cv_module.domain.enums import (
    ClaimStatus,
    DamageType,
    PartId,
    ReviewReason,
    RunStatus,
    VehicleView,
    VisualSeverity,
)
from cv_module.domain.errors import ConflictError, ForbiddenError, RetryablePipelineError
from cv_module.domain.models import BoundingBox, Evidence, RawFinding
from tests.fakes import FakeInference


async def prepare_claim(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
    views: list[VehicleView],
) -> tuple[str, str, list[str]]:
    claim = await container.claims.create_claim("alice")
    image_ids: list[str] = []
    storage = container.storage
    assert isinstance(storage, InMemoryObjectStorage)
    for index, view in enumerate(views):
        content = jpeg_factory(index + 1)
        prepared = await container.claims.prepare_upload(
            "alice",
            claim.claim_id,
            content_type="image/jpeg",
            size_bytes=len(content),
            file_name=f"folder/{view.value}.jpg",
        )
        await storage.put_for_test(prepared.image.object_name, content, "image/jpeg")
        inference.views[prepared.image.image_id] = view
        image_ids.append(prepared.image.image_id)
    submission = await container.claims.submit("alice", claim.claim_id)
    return claim.claim_id, submission.run.analysis_run_id, image_ids


@pytest.mark.asyncio
async def test_complete_coverage_produces_reviewable_assessment(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim_id, run_id, image_ids = await prepare_claim(
        container,
        inference,
        jpeg_factory,
        [VehicleView.FRONT, VehicleView.REAR, VehicleView.LEFT, VehicleView.RIGHT],
    )
    inference.findings = [
        RawFinding(
            part_id=PartId.FRONT_BUMPER,
            damage_type=DamageType.DENT,
            visual_severity=VisualSeverity.MODERATE,
            model_confidence=0.91,
            evidence=[
                Evidence(
                    image_id=image_ids[0],
                    bbox=BoundingBox(x_min=0.1, y_min=0.2, x_max=0.6, y_max=0.8),
                )
            ],
        )
    ]

    status = await container.assessment_pipeline.process(claim_id, run_id)
    assessment = await container.claims.get_assessment("alice", claim_id)

    assert status == RunStatus.NEEDS_HUMAN_REVIEW
    assert assessment.status == ClaimStatus.NEEDS_HUMAN_REVIEW
    assert assessment.coverage.complete is True
    assert len(assessment.findings) == 1
    assert assessment.findings[0].confidence.score is None
    assert assessment.needs_human_review is True
    assert set(assessment.processing.stage_timings_ms) == {
        "preprocessing",
        "intake",
        "assessment",
    }

    exported = await container.claims.get_claim_export("alice", claim_id)
    assert exported.assessment == assessment
    assert {image.file_name for image in exported.source_images} == {
        "front.jpg",
        "rear.jpg",
        "left.jpg",
        "right.jpg",
    }
    assert exported.raw_gemini.intake["same_vehicle"] is True
    assert exported.raw_gemini.assessment is not None
    assert exported.raw_gemini.assessment["findings"][0]["part_id"] == "front_bumper"

    with pytest.raises(ForbiddenError):
        await container.claims.get_claim_export("bob", claim_id)


@pytest.mark.asyncio
async def test_single_view_runs_damage_inference_and_flags_incomplete_coverage(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim_id, run_id, _ = await prepare_claim(
        container,
        inference,
        jpeg_factory,
        [VehicleView.FRONT],
    )

    status = await container.assessment_pipeline.process(claim_id, run_id)
    assessment = await container.claims.get_assessment("alice", claim_id)

    assert status == RunStatus.NEEDS_HUMAN_REVIEW
    assert set(assessment.coverage.missing) == {
        VehicleView.REAR,
        VehicleView.LEFT,
        VehicleView.RIGHT,
    }
    assert ReviewReason.INCOMPLETE_COVERAGE in assessment.review_reasons
    assert inference.assessment_calls == 1
    exported = await container.claims.get_claim_export("alice", claim_id)
    assert exported.raw_gemini.assessment is not None


@pytest.mark.asyncio
async def test_multiple_vehicles_routes_to_review_without_damage_call(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim_id, run_id, _ = await prepare_claim(
        container,
        inference,
        jpeg_factory,
        [VehicleView.FRONT, VehicleView.REAR, VehicleView.LEFT, VehicleView.RIGHT],
    )
    inference.same_vehicle = False

    status = await container.assessment_pipeline.process(claim_id, run_id)

    assert status == RunStatus.NEEDS_HUMAN_REVIEW
    assert inference.assessment_calls == 0


@pytest.mark.asyncio
async def test_repeated_delivery_is_idempotent(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim_id, run_id, _ = await prepare_claim(
        container,
        inference,
        jpeg_factory,
        [VehicleView.FRONT, VehicleView.REAR, VehicleView.LEFT, VehicleView.RIGHT],
    )

    first = await container.assessment_pipeline.process(claim_id, run_id)
    second = await container.assessment_pipeline.process(claim_id, run_id)

    assert first == second == RunStatus.NEEDS_HUMAN_REVIEW
    assert inference.assessment_calls == 1


@pytest.mark.asyncio
async def test_invalid_evidence_reference_fails_after_semantic_retry(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim_id, run_id, _ = await prepare_claim(
        container,
        inference,
        jpeg_factory,
        [VehicleView.FRONT, VehicleView.REAR, VehicleView.LEFT, VehicleView.RIGHT],
    )
    inference.findings = [
        RawFinding(
            part_id=PartId.HOOD,
            damage_type=DamageType.SCRATCH,
            visual_severity=VisualSeverity.MINOR,
            model_confidence=0.8,
            evidence=[
                Evidence(
                    image_id="invented-image",
                    bbox=BoundingBox(x_min=0.1, y_min=0.1, x_max=0.2, y_max=0.2),
                )
            ],
        )
    ]

    status = await container.assessment_pipeline.process(claim_id, run_id)
    claim = await container.claims.get_owned_claim("alice", claim_id)

    assert status == RunStatus.FAILED
    assert inference.assessment_calls == 2
    assert claim.failure_code == "model_contract_failure"


@pytest.mark.asyncio
async def test_corrupt_image_becomes_missing_coverage(
    container: AppContainer,
    inference: FakeInference,
) -> None:
    claim = await container.claims.create_claim("alice")
    storage = container.storage
    assert isinstance(storage, InMemoryObjectStorage)
    prepared = await container.claims.prepare_upload(
        "alice", claim.claim_id, content_type="image/jpeg", size_bytes=6
    )
    await storage.put_for_test(prepared.image.object_name, b"broken", "image/jpeg")
    submission = await container.claims.submit("alice", claim.claim_id)

    status = await container.assessment_pipeline.process(
        claim.claim_id, submission.run.analysis_run_id
    )
    assessment = await container.claims.get_assessment("alice", claim.claim_id)

    assert status == RunStatus.NEEDS_MORE_PHOTOS
    assert assessment.images[0].usable is False
    assert assessment.images[0].quality is None


@pytest.mark.asyncio
async def test_duplicate_photo_does_not_satisfy_a_second_view(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim = await container.claims.create_claim("alice")
    storage = container.storage
    assert isinstance(storage, InMemoryObjectStorage)
    duplicate = jpeg_factory(1)
    views = [VehicleView.FRONT, VehicleView.REAR, VehicleView.LEFT, VehicleView.RIGHT]
    for index, view in enumerate(views):
        content = duplicate if index == 3 else jpeg_factory(index + 1)
        prepared = await container.claims.prepare_upload(
            "alice",
            claim.claim_id,
            content_type="image/jpeg",
            size_bytes=len(content),
        )
        await storage.put_for_test(prepared.image.object_name, content, "image/jpeg")
        inference.views[prepared.image.image_id] = view
    submission = await container.claims.submit("alice", claim.claim_id)

    status = await container.assessment_pipeline.process(
        claim.claim_id, submission.run.analysis_run_id
    )
    assessment = await container.claims.get_assessment("alice", claim.claim_id)

    assert status == RunStatus.NEEDS_HUMAN_REVIEW
    assert set(assessment.coverage.missing) & {VehicleView.FRONT, VehicleView.RIGHT}
    assert ReviewReason.INCOMPLETE_COVERAGE in assessment.review_reasons
    assert inference.assessment_calls == 1
    assert any(image.duplicate_of for image in assessment.images)


@pytest.mark.asyncio
async def test_resubmission_after_missing_view_creates_new_run(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim_id, first_run_id, _ = await prepare_claim(
        container,
        inference,
        jpeg_factory,
        [VehicleView.FRONT, VehicleView.REAR, VehicleView.LEFT],
    )
    assert (
        await container.assessment_pipeline.process(claim_id, first_run_id)
        == RunStatus.NEEDS_HUMAN_REVIEW
    )

    content = jpeg_factory(99)
    prepared = await container.claims.prepare_upload(
        "alice", claim_id, content_type="image/jpeg", size_bytes=len(content)
    )
    storage = container.storage
    assert isinstance(storage, InMemoryObjectStorage)
    await storage.put_for_test(prepared.image.object_name, content, "image/jpeg")
    inference.views[prepared.image.image_id] = VehicleView.RIGHT
    second = await container.claims.submit("alice", claim_id)

    status = await container.assessment_pipeline.process(claim_id, second.run.analysis_run_id)

    assert second.run.analysis_run_id != first_run_id
    assert status == RunStatus.NEEDS_HUMAN_REVIEW


@pytest.mark.asyncio
async def test_transient_failure_is_retried_without_duplicate_result(
    container: AppContainer,
    inference: FakeInference,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim_id, run_id, _ = await prepare_claim(
        container,
        inference,
        jpeg_factory,
        [VehicleView.FRONT, VehicleView.REAR, VehicleView.LEFT, VehicleView.RIGHT],
    )
    inference.transient_assessment_failures = 1

    with pytest.raises(RetryablePipelineError):
        await container.assessment_pipeline.process(claim_id, run_id, task_retry_count=0)
    status = await container.assessment_pipeline.process(claim_id, run_id, task_retry_count=1)

    assert status == RunStatus.NEEDS_HUMAN_REVIEW
    assert inference.assessment_calls == 2


@pytest.mark.asyncio
async def test_claim_enforces_twelve_image_limit(
    container: AppContainer,
    inference: FakeInference,
) -> None:
    claim = await container.claims.create_claim("alice")
    for _ in range(12):
        await container.claims.prepare_upload(
            "alice", claim.claim_id, content_type="image/jpeg", size_bytes=100
        )

    with pytest.raises(ConflictError):
        await container.claims.prepare_upload(
            "alice", claim.claim_id, content_type="image/jpeg", size_bytes=100
        )


@pytest.mark.asyncio
async def test_deletion_removes_objects_and_leaves_anonymous_tombstone(
    container: AppContainer,
    jpeg_factory: Callable[[int], bytes],
) -> None:
    claim = await container.claims.create_claim("alice")
    content = jpeg_factory(1)
    prepared = await container.claims.prepare_upload(
        "alice",
        claim.claim_id,
        content_type="image/jpeg",
        size_bytes=len(content),
    )
    storage = container.storage
    repository = container.repository
    assert isinstance(storage, InMemoryObjectStorage)
    assert isinstance(repository, InMemoryClaimRepository)
    await storage.put_for_test(prepared.image.object_name, content, "image/jpeg")

    await container.claims.delete_claim("alice", claim.claim_id)

    assert not storage.objects
    assert await repository.get_claim(claim.claim_id) is None
    assert len(repository.deletion_tombstones) == 1
