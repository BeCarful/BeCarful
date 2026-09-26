from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from importlib.resources import files
from pathlib import Path
from typing import Any

import pytest

from cv_module.adapters import gemini_inference as gemini_module
from cv_module.adapters.gemini_inference import GeminiDamageInference
from cv_module.domain.enums import PartId
from cv_module.domain.errors import InferenceConfigurationError
from cv_module.ports.inference import InferenceImage


@dataclass
class FakeResponse:
    text: str = '{"status":"ok"}'
    usage_metadata: object | None = None


class FakeModels:
    def __init__(self, response: FakeResponse | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self.response = response or FakeResponse()

    def generate_content(self, **kwargs: Any) -> FakeResponse:
        self.calls.append(kwargs)
        return self.response


class FakeClient:
    def __init__(self, response: FakeResponse | None = None) -> None:
        self.models = FakeModels(response)


@dataclass
class FakeUsage:
    prompt_token_count: int = 12
    candidates_token_count: int = 7


def test_assessment_v2_part_list_matches_part_taxonomy() -> None:
    prompt = files("cv_module.prompts").joinpath("assessment-v2.txt").read_text(encoding="utf-8")
    allowed_section = prompt.split("Allowed Parts List:\n", maxsplit=1)[1]
    listed_parts: list[str] = []
    for line in allowed_section.splitlines():
        if line.startswith("- "):
            _, values = line.split(":", maxsplit=1)
            listed_parts.extend(value.strip() for value in values.split(","))

    assert Counter(listed_parts) == Counter(part.value for part in PartId)


@pytest.mark.asyncio
async def test_api_key_client_does_not_receive_project_or_location(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    initializer_calls: list[dict[str, Any]] = []
    fake_client = FakeClient()

    def client_factory(**kwargs: Any) -> FakeClient:
        initializer_calls.append(kwargs)
        return fake_client

    monkeypatch.setattr(gemini_module.genai, "Client", client_factory)
    inference = GeminiDamageInference(
        project="test-project",
        location="us",
        model_id="gemini-3.8-flash",
        auth_mode="api_key",
        api_key="unit-test-value",
    )

    model_id = await inference.smoke_test()

    assert initializer_calls == [{"enterprise": True, "api_key": "unit-test-value"}]
    assert model_id == "gemini-3.8-flash"
    assert fake_client.models.calls[0]["model"] == "gemini-3.8-flash"


@pytest.mark.asyncio
async def test_missing_api_key_blocks_gemini_request() -> None:
    inference = GeminiDamageInference(
        project="test-project",
        location="us",
        model_id="gemini-3.8-flash",
        auth_mode="api_key",
        api_key=None,
    )

    with pytest.raises(InferenceConfigurationError):
        await inference.smoke_test()


@pytest.mark.asyncio
async def test_mocked_structured_intake_response_is_parsed(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    image_path = tmp_path / "normalized.jpg"
    image_path.write_bytes(b"small-image")
    response = FakeResponse(
        text=(
            '{"images":[{"image_id":"image-1","vehicle_present":true,'
            '"view":"front","semantic_usable":true,"quality_reasons":[]}],'
            '"same_vehicle":true}'
        ),
        usage_metadata=FakeUsage(),
    )
    fake_client = FakeClient(response)
    monkeypatch.setattr(gemini_module.genai, "Client", lambda **_: fake_client)
    inference = GeminiDamageInference(
        project=None,
        location="us",
        model_id="gemini-3.8-flash",
        auth_mode="api_key",
        api_key="unit-test-value",
    )

    result = await inference.classify_intake(
        [
            InferenceImage(
                image_id="image-1",
                uri=image_path.as_uri(),
                content_type="image/jpeg",
            )
        ]
    )

    assert result.output.same_vehicle is True
    assert result.output.images[0].image_id == "image-1"
    assert result.usage.prompt_tokens == 12
    assert result.usage.output_tokens == 7
    assert fake_client.models.calls[0]["model"] == "gemini-3.8-flash"


@pytest.mark.asyncio
async def test_mocked_damage_assessment_uses_v2_prompt(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    image_path = tmp_path / "normalized.jpg"
    image_path.write_bytes(b"small-image")
    fake_client = FakeClient(FakeResponse(text='{"findings":[]}'))
    monkeypatch.setattr(gemini_module.genai, "Client", lambda **_: fake_client)
    inference = GeminiDamageInference(
        project=None,
        location="us",
        model_id="gemini-3.8-flash",
        auth_mode="api_key",
        api_key="unit-test-value",
    )

    result = await inference.assess_damage(
        [
            InferenceImage(
                image_id="image-1",
                uri=image_path.as_uri(),
                content_type="image/jpeg",
            )
        ]
    )

    prompt = fake_client.models.calls[0]["contents"].parts[0].text
    assert result.output.findings == []
    assert inference.prompt_version == "v2"
    assert "Allowed Parts List:" in prompt
    assert "Do not invent, rename, generalize" in prompt
