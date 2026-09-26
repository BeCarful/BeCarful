from __future__ import annotations

import asyncio
import json
from importlib.resources import files
from pathlib import Path
from typing import Any, Literal, TypeVar
from urllib.parse import urlparse
from urllib.request import url2pathname

from google import genai as genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from cv_module.domain.errors import InferenceConfigurationError, InferenceContractError
from cv_module.domain.models import (
    AssessmentInferenceResult,
    GeminiAssessmentOutput,
    InferenceUsage,
    IntakeInferenceResult,
    IntakeOutput,
)
from cv_module.ports.inference import InferenceImage

OutputT = TypeVar("OutputT", bound=BaseModel)


class SmokeOutput(BaseModel):
    status: Literal["ok"]


class GeminiDamageInference:
    def __init__(
        self,
        project: str | None,
        location: str,
        model_id: str,
        *,
        auth_mode: Literal["api_key", "adc"] = "adc",
        api_key: str | None = None,
        inline_image_max_bytes: int = 7_000_000,
    ) -> None:
        self._client: genai.Client | None
        if auth_mode == "api_key":
            self._client = (
                genai.Client(enterprise=True, api_key=api_key) if api_key is not None else None
            )
        elif project is not None:
            self._client = genai.Client(enterprise=True, project=project, location=location)
        else:
            self._client = None
        self._model_id = model_id
        self._prompt_version = "v2"
        self._inline_image_max_bytes = inline_image_max_bytes

    @property
    def model_id(self) -> str:
        return self._model_id

    @property
    def prompt_version(self) -> str:
        return self._prompt_version

    async def classify_intake(self, images: list[InferenceImage]) -> IntakeInferenceResult:
        output, raw, usage = await self._generate(
            prompt_name="intake-v1.txt",
            images=images,
            output_type=IntakeOutput,
        )
        return IntakeInferenceResult(output=output, raw_response=raw, usage=usage)

    async def assess_damage(self, images: list[InferenceImage]) -> AssessmentInferenceResult:
        output, raw, usage = await self._generate(
            prompt_name="assessment-v2.txt",
            images=images,
            output_type=GeminiAssessmentOutput,
        )
        return AssessmentInferenceResult(output=output, raw_response=raw, usage=usage)

    async def smoke_test(self) -> str:
        client = self._require_client()
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=SmokeOutput.model_json_schema(),
            max_output_tokens=256,
            thinking_config=types.ThinkingConfig(thinking_level="LOW"),
        )
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self._model_id,
                contents='Return exactly this JSON object: {"status":"ok"}',
                config=config,
            )
            SmokeOutput.model_validate(json.loads(response.text or ""))
        except (json.JSONDecodeError, ValidationError, AttributeError, TypeError) as exc:
            raise InferenceContractError("Gemini smoke response failed validation") from exc
        return self._model_id

    async def _generate(
        self,
        *,
        prompt_name: str,
        images: list[InferenceImage],
        output_type: type[OutputT],
    ) -> tuple[OutputT, str, InferenceUsage]:
        client = self._require_client()
        prompt = files("cv_module.prompts").joinpath(prompt_name).read_text(encoding="utf-8")
        parts: list[Any] = [types.Part.from_text(text=prompt)]
        for image in images:
            parts.append(types.Part.from_text(text=f"IMAGE_ID={image.image_id}"))
            if image.uri.startswith("file:"):
                local_path = Path(url2pathname(urlparse(image.uri).path))
                inline_data = await asyncio.to_thread(local_path.read_bytes)
                if len(inline_data) > self._inline_image_max_bytes:
                    raise InferenceConfigurationError(
                        "normalized image exceeds the Gemini inline data limit"
                    )
                parts.append(
                    types.Part.from_bytes(
                        data=inline_data,
                        mime_type=image.content_type,
                    )
                )
            else:
                parts.append(types.Part.from_uri(file_uri=image.uri, mime_type=image.content_type))
        content = types.Content(role="user", parts=parts)
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=output_type.model_json_schema(),
            thinking_config=types.ThinkingConfig(thinking_level="MEDIUM"),
        )
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self._model_id,
                contents=content,
                config=config,
            )
            raw = response.text or ""
            output = output_type.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValidationError, AttributeError, TypeError) as exc:
            raise InferenceContractError("Gemini response failed contract validation") from exc

        usage_metadata = getattr(response, "usage_metadata", None)
        usage = InferenceUsage(
            prompt_tokens=getattr(usage_metadata, "prompt_token_count", None),
            output_tokens=getattr(usage_metadata, "candidates_token_count", None),
        )
        return output, raw, usage

    def _require_client(self) -> genai.Client:
        if self._client is None:
            raise InferenceConfigurationError("Gemini authentication is not configured")
        return self._client
