from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from cv_module.domain.enums import (
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

UnitFloat = Annotated[float, Field(ge=0.0, le=1.0)]


class DomainModel(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=False)


class CaptureTime(DomainModel):
    value: str | None = None
    timezone_known: bool = False
    source: Literal["exif", "none"] = "none"


class ClaimRecord(DomainModel):
    claim_id: str
    owner_uid: str
    status: ClaimStatus
    created_at: datetime
    updated_at: datetime
    active_run_id: str | None = None
    image_count: int = 0
    failure_code: str | None = None


class ImageRecord(DomainModel):
    image_id: str
    claim_id: str
    object_name: str
    content_type: str
    declared_size_bytes: int
    state: ImageState
    created_at: datetime
    uploaded_at: datetime | None = None
    generation: str | None = None
    sha256: str | None = None
    normalized_object_name: str | None = None
    capture_time: CaptureTime = Field(default_factory=CaptureTime)


class AnalysisRun(DomainModel):
    analysis_run_id: str
    claim_id: str
    status: RunStatus
    created_at: datetime
    updated_at: datetime
    submitted_image_generations: dict[str, str]
    attempt_count: int = 0
    lease_until: datetime | None = None
    error_code: str | None = None


class RunLease(DomainModel):
    state: LeaseState
    run: AnalysisRun


class QualityMetrics(DomainModel):
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    brightness_mean: float = Field(ge=0.0, le=255.0)
    edge_variance: float = Field(ge=0.0)
    clipped_dark_ratio: UnitFloat
    clipped_bright_ratio: UnitFloat
    perceptual_hash: str


class IntakeImageResult(DomainModel):
    image_id: str
    vehicle_present: bool
    view: VehicleView
    semantic_usable: bool
    quality_reasons: list[str] = Field(default_factory=list)


class IntakeOutput(DomainModel):
    images: list[IntakeImageResult]
    same_vehicle: bool

    @model_validator(mode="after")
    def unique_images(self) -> IntakeOutput:
        ids = [image.image_id for image in self.images]
        if len(ids) != len(set(ids)):
            raise ValueError("intake output contains duplicate image IDs")
        return self


class BoundingBox(DomainModel):
    x_min: UnitFloat
    y_min: UnitFloat
    x_max: UnitFloat
    y_max: UnitFloat

    @model_validator(mode="after")
    def ordered_coordinates(self) -> BoundingBox:
        if self.x_min >= self.x_max or self.y_min >= self.y_max:
            raise ValueError("bounding box minimums must be less than maximums")
        return self


class Evidence(DomainModel):
    image_id: str
    bbox: BoundingBox


class RawFinding(DomainModel):
    part_id: PartId
    damage_type: DamageType
    visual_severity: VisualSeverity
    model_confidence: UnitFloat
    evidence: list[Evidence] = Field(min_length=1)


class GeminiAssessmentOutput(DomainModel):
    findings: list[RawFinding]


class Confidence(DomainModel):
    score: UnitFloat | None = None
    band: ConfidenceBand = ConfidenceBand.UNVALIDATED
    calibration_version: str | None = None

    @model_validator(mode="after")
    def consistent_calibration(self) -> Confidence:
        if self.band == ConfidenceBand.UNVALIDATED:
            if self.score is not None or self.calibration_version is not None:
                raise ValueError(
                    "unvalidated confidence cannot expose score or calibration version"
                )
        elif self.score is None or self.calibration_version is None:
            raise ValueError("validated confidence requires score and calibration version")
        return self


class Finding(DomainModel):
    finding_id: str
    part_id: PartId
    damage_type: DamageType
    visual_severity: VisualSeverity
    confidence: Confidence
    evidence: list[Evidence] = Field(min_length=1)


class ImageAssessment(DomainModel):
    image_id: str
    uploaded_at: datetime
    capture_time: CaptureTime
    view: VehicleView
    quality: QualityMetrics | None = None
    usable: bool
    quality_reasons: list[str] = Field(default_factory=list)
    duplicate_of: str | None = None


class Coverage(DomainModel):
    required: list[VehicleView]
    observed: list[VehicleView]
    missing: list[VehicleView]
    recommended_missing: list[VehicleView]
    complete: bool


class AssessmentSummary(DomainModel):
    damaged_part_ids: list[PartId]
    maximum_visual_severity: VisualSeverity | None = None


class ProcessingMetadata(DomainModel):
    model_id: str
    prompt_version: str
    schema_version: str
    code_revision: str
    started_at: datetime
    completed_at: datetime
    latency_ms: int = Field(ge=0)
    queue_latency_ms: int = Field(default=0, ge=0)
    stage_timings_ms: dict[str, int] = Field(default_factory=dict)
    prompt_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    estimated_cost_usd: float | None = Field(default=None, ge=0)
    retry_count: int = Field(default=0, ge=0)


class AssessmentV1(DomainModel):
    schema_version: Literal["1.0"] = "1.0"
    claim_id: str
    analysis_run_id: str
    status: ClaimStatus
    submitted_at: datetime
    completed_at: datetime
    processing: ProcessingMetadata
    images: list[ImageAssessment]
    coverage: Coverage
    findings: list[Finding]
    summary: AssessmentSummary
    needs_human_review: bool
    review_reasons: list[ReviewReason]
    limitations: list[str]

    @model_validator(mode="after")
    def validate_evidence_references(self) -> AssessmentV1:
        image_ids = {image.image_id for image in self.images}
        for finding in self.findings:
            for evidence in finding.evidence:
                if evidence.image_id not in image_ids:
                    raise ValueError(f"unknown evidence image_id: {evidence.image_id}")
        if self.coverage.complete != (len(self.coverage.missing) == 0):
            raise ValueError("coverage.complete disagrees with coverage.missing")
        return self


class InferenceUsage(DomainModel):
    prompt_tokens: int | None = None
    output_tokens: int | None = None


class IntakeInferenceResult(DomainModel):
    output: IntakeOutput
    raw_response: str
    usage: InferenceUsage = Field(default_factory=InferenceUsage)


class AssessmentInferenceResult(DomainModel):
    output: GeminiAssessmentOutput
    raw_response: str
    usage: InferenceUsage = Field(default_factory=InferenceUsage)
