from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, ConfigDict

from cv_module.domain.models import AssessmentInferenceResult, IntakeInferenceResult


class InferenceImage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_id: str
    uri: str
    content_type: str


class DamageInference(Protocol):
    @property
    def model_id(self) -> str: ...

    @property
    def prompt_version(self) -> str: ...

    async def classify_intake(self, images: list[InferenceImage]) -> IntakeInferenceResult: ...

    async def assess_damage(self, images: list[InferenceImage]) -> AssessmentInferenceResult: ...
