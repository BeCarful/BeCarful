from __future__ import annotations

import asyncio
import json

from cv_module.adapters.gemini_inference import GeminiDamageInference
from cv_module.config import Settings


async def run_smoke(settings: Settings) -> dict[str, str]:
    if settings.inference_mode != "gemini":
        raise RuntimeError("INFERENCE_MODE must be gemini for the smoke test")
    errors = settings.readiness_errors()
    if errors:
        raise RuntimeError("; ".join(errors))
    inference = GeminiDamageInference(
        project=settings.gcp_project,
        location=settings.gemini_location,
        model_id=settings.gemini_model,
        auth_mode=settings.gemini_auth_mode,
        api_key=(
            settings.google_api_key.get_secret_value()
            if settings.google_api_key is not None
            else None
        ),
        inline_image_max_bytes=settings.gemini_inline_image_max_bytes,
    )
    model_id = await inference.smoke_test()
    return {
        "status": "ok",
        "model": model_id,
        "authentication": settings.gemini_auth_mode,
    }


def main() -> None:
    result = asyncio.run(run_smoke(Settings()))
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
