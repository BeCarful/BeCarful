from __future__ import annotations

import json
from datetime import UTC, datetime

from cv_module.domain.enums import VehicleView
from cv_module.domain.errors import InferenceContractError
from cv_module.domain.models import (
    AssessmentInferenceResult,
    GeminiAssessmentOutput,
    IntakeImageResult,
    IntakeInferenceResult,
    IntakeOutput,
    RawFinding,
)
from cv_module.ports.inference import InferenceImage


class FrozenClock:
    def __init__(self) -> None:
        self.current = datetime(2026, 9, 26, 16, 30, tzinfo=UTC)

    def now(self) -> datetime:
        return self.current


class FakeInference:
    def __init__(self) -> None:
        self.views: dict[str, VehicleView] = {}
        self.same_vehicle = True
        self.findings: list[RawFinding] = []
        self.intake_calls = 0
        self.assessment_calls = 0
        self.fail_intake_contract = 0
        self.fail_assessment_contract = 0
        self.transient_assessment_failures = 0

    @property
    def model_id(self) -> str:
        return "fake-model"

    @property
    def prompt_version(self) -> str:
        return "fake-v1"

    async def classify_intake(self, images: list[InferenceImage]) -> IntakeInferenceResult:
        self.intake_calls += 1
        if self.fail_intake_contract > 0:
            self.fail_intake_contract -= 1
            raise InferenceContractError("injected intake failure")
        output = IntakeOutput(
            images=[
                IntakeImageResult(
                    image_id=image.image_id,
                    vehicle_present=True,
                    view=self.views.get(image.image_id, VehicleView.UNKNOWN),
                    semantic_usable=True,
                )
                for image in images
            ],
            same_vehicle=self.same_vehicle,
        )
        return IntakeInferenceResult(
            output=output,
            raw_response=json.dumps(output.model_dump(mode="json")),
        )

    async def assess_damage(self, images: list[InferenceImage]) -> AssessmentInferenceResult:
        self.assessment_calls += 1
        if self.transient_assessment_failures > 0:
            self.transient_assessment_failures -= 1
            raise RuntimeError("injected transient assessment failure")
        if self.fail_assessment_contract > 0:
            self.fail_assessment_contract -= 1
            raise InferenceContractError("injected assessment failure")
        output = GeminiAssessmentOutput(findings=self.findings)
        return AssessmentInferenceResult(
            output=output,
            raw_response=json.dumps(output.model_dump(mode="json")),
        )
