from __future__ import annotations

import json

from cv_module.domain.enums import VehicleView
from cv_module.domain.models import (
    AssessmentInferenceResult,
    GeminiAssessmentOutput,
    IntakeImageResult,
    IntakeInferenceResult,
    IntakeOutput,
)
from cv_module.ports.inference import InferenceImage


class LocalNoDamageInference:
    """Safe local adapter that exercises flow without pretending to detect damage."""

    @property
    def model_id(self) -> str:
        return "local-no-damage-stub"

    @property
    def prompt_version(self) -> str:
        return "v1-local"

    async def classify_intake(self, images: list[InferenceImage]) -> IntakeInferenceResult:
        canonical_order = [
            VehicleView.FRONT,
            VehicleView.REAR,
            VehicleView.LEFT,
            VehicleView.RIGHT,
            VehicleView.FRONT_LEFT,
            VehicleView.FRONT_RIGHT,
            VehicleView.REAR_LEFT,
            VehicleView.REAR_RIGHT,
        ]
        output = IntakeOutput(
            images=[
                IntakeImageResult(
                    image_id=image.image_id,
                    vehicle_present=True,
                    view=canonical_order[index]
                    if index < len(canonical_order)
                    else VehicleView.UNKNOWN,
                    semantic_usable=True,
                )
                for index, image in enumerate(images)
            ],
            same_vehicle=True,
        )
        return IntakeInferenceResult(
            output=output,
            raw_response=json.dumps(output.model_dump(mode="json")),
        )

    async def assess_damage(self, images: list[InferenceImage]) -> AssessmentInferenceResult:
        output = GeminiAssessmentOutput(findings=[])
        return AssessmentInferenceResult(
            output=output,
            raw_response=json.dumps(output.model_dump(mode="json")),
        )
