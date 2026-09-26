from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta

from cv_module.config import Settings
from cv_module.domain.enums import (
    RECOMMENDED_VIEWS,
    REQUIRED_VIEWS,
    ClaimStatus,
    ConfidenceBand,
    DamageType,
    ImageState,
    LeaseState,
    PartId,
    ReviewReason,
    RunStatus,
    VehicleView,
    VisualSeverity,
)
from cv_module.domain.errors import (
    ImageValidationError,
    InferenceContractError,
    NotFoundError,
    RetryablePipelineError,
    RunBusyError,
)
from cv_module.domain.models import (
    AssessmentInferenceResult,
    AssessmentSummary,
    AssessmentV1,
    Confidence,
    Coverage,
    Evidence,
    Finding,
    ImageAssessment,
    ImageRecord,
    IntakeInferenceResult,
    ProcessingMetadata,
    RawFinding,
)
from cv_module.ports.clock import Clock
from cv_module.ports.inference import DamageInference, InferenceImage
from cv_module.ports.repository import ClaimRepository
from cv_module.ports.storage import ObjectStorage
from cv_module.services.image_processing import ImageProcessor, perceptual_hash_distance

logger = logging.getLogger(__name__)

LIMITATIONS = [
    "Evaluation output only; not an insurance estimate or coverage decision.",
    "Not a safety, drivability, liability, fraud, or total-loss determination.",
    "Only visible exterior damage in the submitted photographs can be considered.",
    "Professional inspection is required before acting on the result.",
]

SEVERITY_RANK = {
    VisualSeverity.MINOR: 1,
    VisualSeverity.MODERATE: 2,
    VisualSeverity.SEVERE: 3,
}


class AssessmentPipeline:
    def __init__(
        self,
        repository: ClaimRepository,
        storage: ObjectStorage,
        inference: DamageInference,
        image_processor: ImageProcessor,
        clock: Clock,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._storage = storage
        self._inference = inference
        self._image_processor = image_processor
        self._clock = clock
        self._settings = settings

    async def process(self, claim_id: str, run_id: str, *, task_retry_count: int = 0) -> RunStatus:
        now = self._clock.now()
        try:
            lease = await self._repository.acquire_run(
                claim_id,
                run_id,
                now,
                now + timedelta(seconds=self._settings.worker_lease_seconds),
            )
        except NotFoundError:
            return RunStatus.FAILED
        if lease.state == LeaseState.TERMINAL:
            return lease.run.status
        if lease.state == LeaseState.BUSY:
            raise RunBusyError("analysis run is already leased")

        started_at = now
        started_timer = time.perf_counter()
        try:
            return await self._process_acquired(
                claim_id,
                run_id,
                lease.run.submitted_image_generations,
                lease.run.created_at,
                started_at,
                started_timer,
                task_retry_count,
            )
        except InferenceContractError:
            await self._fail_run(claim_id, run_id, "model_contract_failure")
            return RunStatus.FAILED
        except Exception as exc:
            if task_retry_count < 2:
                await self._repository.set_run_status(
                    claim_id,
                    run_id,
                    RunStatus.RETRYABLE,
                    self._clock.now(),
                    error_code="transient_pipeline_failure",
                )
                await self._repository.set_claim_status(
                    claim_id,
                    ClaimStatus.QUEUED,
                    self._clock.now(),
                    failure_code=None,
                )
                raise RetryablePipelineError("pipeline attempt failed and can be retried") from exc
            await self._fail_run(claim_id, run_id, "pipeline_retry_exhausted")
            return RunStatus.FAILED

    async def _process_acquired(
        self,
        claim_id: str,
        run_id: str,
        submitted_generations: dict[str, str],
        submitted_at: datetime,
        started_at: datetime,
        started_timer: float,
        task_retry_count: int,
    ) -> RunStatus:
        await self._repository.set_claim_status(
            claim_id, ClaimStatus.PREPROCESSING, self._clock.now()
        )
        stage_timings: dict[str, int] = {}
        stage_started = time.perf_counter()
        all_images = {
            image.image_id: image for image in await self._repository.list_images(claim_id)
        }
        submitted: list[ImageRecord] = []
        for image_id, generation in submitted_generations.items():
            image = all_images.get(image_id)
            if image is None or image.generation != generation:
                raise NotFoundError("submitted image generation is unavailable")
            submitted.append(image)

        image_results: list[ImageAssessment] = []
        inference_images: list[InferenceImage] = []
        seen_hashes: list[tuple[str, str]] = []
        for image in submitted:
            result, inference_image = await self._preprocess_image(claim_id, run_id, image)
            if result.quality is not None:
                for previous_id, previous_hash in seen_hashes:
                    if perceptual_hash_distance(result.quality.perceptual_hash, previous_hash) <= 4:
                        result.duplicate_of = previous_id
                        result.usable = False
                        result.quality_reasons.append("perceptual_duplicate")
                        break
                if result.duplicate_of is None:
                    seen_hashes.append((result.image_id, result.quality.perceptual_hash))
            image_results.append(result)
            if result.usable and inference_image is not None:
                inference_images.append(inference_image)

        stage_timings["preprocessing"] = int((time.perf_counter() - stage_started) * 1000)
        stage_started = time.perf_counter()
        intake, intake_retry_count = await self._intake_with_retry(inference_images)
        stage_timings["intake"] = int((time.perf_counter() - stage_started) * 1000)
        self._apply_intake(image_results, intake)
        usable_ids = {image.image_id for image in image_results if image.usable}
        usable_inference_images = [
            image for image in inference_images if image.image_id in usable_ids
        ]
        coverage = self._coverage(image_results)

        await self._storage.upload_json(
            f"claims/{claim_id}/runs/{run_id}/raw/intake.json",
            intake.raw_response,
        )

        if not intake.output.same_vehicle:
            return await self._finish_without_findings(
                claim_id=claim_id,
                run_id=run_id,
                submitted_at=submitted_at,
                started_at=started_at,
                started_timer=started_timer,
                retry_count=task_retry_count + intake_retry_count,
                stage_timings=stage_timings,
                image_results=image_results,
                coverage=coverage,
                intake=intake,
                status=ClaimStatus.NEEDS_HUMAN_REVIEW,
                run_status=RunStatus.NEEDS_HUMAN_REVIEW,
                reasons=[
                    ReviewReason.VEHICLE_INCONSISTENCY,
                    ReviewReason.CONFIDENCE_UNVALIDATED,
                ],
            )

        if not coverage.complete:
            return await self._finish_without_findings(
                claim_id=claim_id,
                run_id=run_id,
                submitted_at=submitted_at,
                started_at=started_at,
                started_timer=started_timer,
                retry_count=task_retry_count + intake_retry_count,
                stage_timings=stage_timings,
                image_results=image_results,
                coverage=coverage,
                intake=intake,
                status=ClaimStatus.NEEDS_MORE_PHOTOS,
                run_status=RunStatus.NEEDS_MORE_PHOTOS,
                reasons=[
                    ReviewReason.INCOMPLETE_COVERAGE,
                    ReviewReason.CONFIDENCE_UNVALIDATED,
                ],
            )

        await self._repository.set_claim_status(claim_id, ClaimStatus.ASSESSING, self._clock.now())
        stage_started = time.perf_counter()
        assessment_result, assessment_retry_count = await self._assessment_with_retry(
            usable_inference_images,
            usable_ids,
        )
        stage_timings["assessment"] = int((time.perf_counter() - stage_started) * 1000)
        await self._storage.upload_json(
            f"claims/{claim_id}/runs/{run_id}/raw/assessment.json",
            assessment_result.raw_response,
        )
        findings = self._aggregate_findings(assessment_result.output.findings)
        review_reasons = [ReviewReason.CONFIDENCE_UNVALIDATED]
        if any(f.visual_severity == VisualSeverity.SEVERE for f in findings):
            review_reasons.append(ReviewReason.SEVERE_DAMAGE)
        if any(image.quality_reasons for image in image_results):
            review_reasons.append(ReviewReason.IMAGE_QUALITY)

        completed_at = self._clock.now()
        prompt_tokens = _sum_optional(
            intake.usage.prompt_tokens, assessment_result.usage.prompt_tokens
        )
        output_tokens = _sum_optional(
            intake.usage.output_tokens, assessment_result.usage.output_tokens
        )
        assessment = AssessmentV1(
            claim_id=claim_id,
            analysis_run_id=run_id,
            status=ClaimStatus.NEEDS_HUMAN_REVIEW,
            submitted_at=submitted_at,
            completed_at=completed_at,
            processing=ProcessingMetadata(
                model_id=self._inference.model_id,
                prompt_version=self._inference.prompt_version,
                schema_version="1.0",
                code_revision=self._settings.git_revision,
                started_at=started_at,
                completed_at=completed_at,
                latency_ms=int((time.perf_counter() - started_timer) * 1000),
                queue_latency_ms=_milliseconds_between(submitted_at, started_at),
                stage_timings_ms=stage_timings,
                prompt_tokens=prompt_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=self._estimated_cost(prompt_tokens, output_tokens),
                retry_count=(task_retry_count + intake_retry_count + assessment_retry_count),
            ),
            images=image_results,
            coverage=coverage,
            findings=findings,
            summary=self._summary(findings),
            needs_human_review=True,
            review_reasons=list(dict.fromkeys(review_reasons)),
            limitations=LIMITATIONS,
        )
        await self._repository.save_assessment(assessment)
        await self._repository.set_run_status(
            claim_id, run_id, RunStatus.NEEDS_HUMAN_REVIEW, completed_at
        )
        await self._repository.set_claim_status(
            claim_id, ClaimStatus.NEEDS_HUMAN_REVIEW, completed_at
        )
        self._log_completion(assessment)
        return RunStatus.NEEDS_HUMAN_REVIEW

    async def _preprocess_image(
        self, claim_id: str, run_id: str, image: ImageRecord
    ) -> tuple[ImageAssessment, InferenceImage | None]:
        uploaded_at = image.uploaded_at or image.created_at
        try:
            metadata = await self._storage.stat(image.object_name)
            if metadata.generation != image.generation or metadata.sha256 != image.sha256:
                raise ImageValidationError("uploaded image changed after submission")
            data = await self._storage.download(image.object_name)
            processed = await asyncio.to_thread(
                self._image_processor.process,
                data,
                image.content_type,
            )
            normalized_name = f"claims/{claim_id}/runs/{run_id}/normalized/{image.image_id}.jpg"
            await self._storage.upload_bytes(normalized_name, processed.jpeg_bytes, "image/jpeg")
            image.normalized_object_name = normalized_name
            image.capture_time = processed.capture_time
            image.state = (
                ImageState.PROCESSED if processed.deterministic_usable else ImageState.UNUSABLE
            )
            await self._repository.update_image(image)
            result = ImageAssessment(
                image_id=image.image_id,
                uploaded_at=uploaded_at,
                capture_time=processed.capture_time,
                view=VehicleView.UNKNOWN,
                quality=processed.metrics,
                usable=processed.deterministic_usable,
                quality_reasons=list(processed.quality_reasons),
            )
            inference_image = InferenceImage(
                image_id=image.image_id,
                uri=self._storage.gcs_uri(normalized_name),
                content_type="image/jpeg",
            )
            return result, inference_image
        except ImageValidationError as exc:
            image.state = ImageState.UNUSABLE
            await self._repository.update_image(image)
            return (
                ImageAssessment(
                    image_id=image.image_id,
                    uploaded_at=uploaded_at,
                    capture_time=image.capture_time,
                    view=VehicleView.UNKNOWN,
                    quality=None,
                    usable=False,
                    quality_reasons=[exc.code],
                ),
                None,
            )

    async def _intake_with_retry(
        self, images: list[InferenceImage]
    ) -> tuple[IntakeInferenceResult, int]:
        if not images:
            from cv_module.domain.models import IntakeOutput

            return (
                IntakeInferenceResult(
                    output=IntakeOutput(images=[], same_vehicle=True), raw_response="{}"
                ),
                0,
            )
        expected_ids = {image.image_id for image in images}
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                result = await self._inference.classify_intake(images)
                actual_ids = {image.image_id for image in result.output.images}
                if actual_ids != expected_ids:
                    raise InferenceContractError("intake image IDs do not match inputs")
                return result, attempt
            except InferenceContractError as exc:
                last_error = exc
        raise InferenceContractError("intake contract failed after retry") from last_error

    async def _assessment_with_retry(
        self, images: list[InferenceImage], usable_ids: set[str]
    ) -> tuple[AssessmentInferenceResult, int]:
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                result = await self._inference.assess_damage(images)
                for finding in result.output.findings:
                    if any(evidence.image_id not in usable_ids for evidence in finding.evidence):
                        raise InferenceContractError(
                            "assessment referenced an unknown or unusable image"
                        )
                return result, attempt
            except InferenceContractError as exc:
                last_error = exc
        raise InferenceContractError("assessment contract failed after retry") from last_error

    @staticmethod
    def _apply_intake(image_results: list[ImageAssessment], intake: IntakeInferenceResult) -> None:
        by_id = {item.image_id: item for item in intake.output.images}
        for image in image_results:
            semantic = by_id.get(image.image_id)
            if semantic is None:
                continue
            image.view = semantic.view
            image.usable = image.usable and semantic.semantic_usable and semantic.vehicle_present
            image.quality_reasons.extend(semantic.quality_reasons)
            if not semantic.vehicle_present:
                image.quality_reasons.append("vehicle_not_present")
            image.quality_reasons = list(dict.fromkeys(image.quality_reasons))

    @staticmethod
    def _coverage(images: list[ImageAssessment]) -> Coverage:
        observed_set = {image.view for image in images if image.usable}
        missing = REQUIRED_VIEWS - observed_set
        recommended_missing = RECOMMENDED_VIEWS - observed_set
        order = {view: index for index, view in enumerate(VehicleView)}
        return Coverage(
            required=sorted(REQUIRED_VIEWS, key=order.__getitem__),
            observed=sorted(observed_set, key=order.__getitem__),
            missing=sorted(missing, key=order.__getitem__),
            recommended_missing=sorted(recommended_missing, key=order.__getitem__),
            complete=not missing,
        )

    async def _finish_without_findings(
        self,
        *,
        claim_id: str,
        run_id: str,
        submitted_at: datetime,
        started_at: datetime,
        started_timer: float,
        retry_count: int,
        stage_timings: dict[str, int],
        image_results: list[ImageAssessment],
        coverage: Coverage,
        intake: IntakeInferenceResult,
        status: ClaimStatus,
        run_status: RunStatus,
        reasons: list[ReviewReason],
    ) -> RunStatus:
        completed_at = self._clock.now()
        run = await self._repository.get_run(claim_id, run_id)
        if run is None:
            raise NotFoundError("analysis run not found")
        assessment = AssessmentV1(
            claim_id=claim_id,
            analysis_run_id=run_id,
            status=status,
            submitted_at=submitted_at,
            completed_at=completed_at,
            processing=ProcessingMetadata(
                model_id=self._inference.model_id,
                prompt_version=self._inference.prompt_version,
                schema_version="1.0",
                code_revision=self._settings.git_revision,
                started_at=started_at,
                completed_at=completed_at,
                latency_ms=int((time.perf_counter() - started_timer) * 1000),
                queue_latency_ms=_milliseconds_between(submitted_at, started_at),
                stage_timings_ms=stage_timings,
                prompt_tokens=intake.usage.prompt_tokens,
                output_tokens=intake.usage.output_tokens,
                estimated_cost_usd=self._estimated_cost(
                    intake.usage.prompt_tokens, intake.usage.output_tokens
                ),
                retry_count=retry_count,
            ),
            images=image_results,
            coverage=coverage,
            findings=[],
            summary=AssessmentSummary(damaged_part_ids=[]),
            needs_human_review=True,
            review_reasons=reasons,
            limitations=LIMITATIONS,
        )
        await self._repository.save_assessment(assessment)
        await self._repository.set_run_status(claim_id, run_id, run_status, completed_at)
        await self._repository.set_claim_status(claim_id, status, completed_at)
        self._log_completion(assessment)
        return run_status

    def _estimated_cost(self, prompt_tokens: int | None, output_tokens: int | None) -> float | None:
        input_rate = self._settings.gemini_input_cost_per_million_usd
        output_rate = self._settings.gemini_output_cost_per_million_usd
        if input_rate is None or output_rate is None:
            return None
        if prompt_tokens is None and output_tokens is None:
            return None
        total = (prompt_tokens or 0) * input_rate + (output_tokens or 0) * output_rate
        return round(total / 1_000_000, 8)

    @staticmethod
    def _log_completion(assessment: AssessmentV1) -> None:
        processing = assessment.processing
        logger.info(
            "analysis run completed",
            extra={
                "claim_id": assessment.claim_id,
                "analysis_run_id": assessment.analysis_run_id,
                "status": assessment.status,
                "duration_ms": processing.latency_ms,
                "queue_latency_ms": processing.queue_latency_ms,
                "stage_timings_ms": processing.stage_timings_ms,
                "prompt_tokens": processing.prompt_tokens,
                "output_tokens": processing.output_tokens,
                "estimated_cost_usd": processing.estimated_cost_usd,
            },
        )

    @staticmethod
    def _aggregate_findings(raw_findings: list[RawFinding]) -> list[Finding]:
        grouped: dict[tuple[PartId, DamageType], list[RawFinding]] = {}
        for finding in raw_findings:
            grouped.setdefault((finding.part_id, finding.damage_type), []).append(finding)
        findings: list[Finding] = []
        for (part_id, damage_type), group in sorted(
            grouped.items(), key=lambda item: (str(item[0][0]), str(item[0][1]))
        ):
            severity = max(
                group, key=lambda item: SEVERITY_RANK[item.visual_severity]
            ).visual_severity
            evidence_by_key: dict[str, Evidence] = {}
            for item in group:
                for evidence in item.evidence:
                    key = json.dumps(evidence.model_dump(mode="json"), sort_keys=True)
                    evidence_by_key[key] = evidence
            identity = f"{part_id}:{damage_type}"
            finding_id = f"dmg_{hashlib.sha256(identity.encode()).hexdigest()[:16]}"
            findings.append(
                Finding(
                    finding_id=finding_id,
                    part_id=part_id,
                    damage_type=damage_type,
                    visual_severity=severity,
                    confidence=Confidence(band=ConfidenceBand.UNVALIDATED),
                    evidence=list(evidence_by_key.values()),
                )
            )
        return findings

    @staticmethod
    def _summary(findings: list[Finding]) -> AssessmentSummary:
        if not findings:
            return AssessmentSummary(damaged_part_ids=[])
        maximum = max(findings, key=lambda item: SEVERITY_RANK[item.visual_severity])
        return AssessmentSummary(
            damaged_part_ids=sorted({finding.part_id for finding in findings}, key=str),
            maximum_visual_severity=maximum.visual_severity,
        )

    async def _fail_run(self, claim_id: str, run_id: str, error_code: str) -> None:
        now = self._clock.now()
        logger.error(
            "analysis run failed",
            extra={"claim_id": claim_id, "analysis_run_id": run_id, "error_code": error_code},
        )
        await self._repository.set_run_status(
            claim_id, run_id, RunStatus.FAILED, now, error_code=error_code
        )
        await self._repository.set_claim_status(
            claim_id, ClaimStatus.FAILED, now, failure_code=error_code
        )


def _sum_optional(first: int | None, second: int | None) -> int | None:
    if first is None and second is None:
        return None
    return (first or 0) + (second or 0)


def _milliseconds_between(start: datetime, end: datetime) -> int:
    return max(0, int((end - start).total_seconds() * 1000))
