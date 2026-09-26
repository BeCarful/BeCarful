from __future__ import annotations

import io
import random
from collections.abc import Callable

import pytest
from PIL import Image, ImageDraw

from cv_module.adapters.disabled_auth import DisabledAuthVerifier
from cv_module.adapters.in_memory import (
    InMemoryClaimRepository,
    InMemoryObjectStorage,
    InMemoryTaskQueue,
)
from cv_module.config import Settings
from cv_module.container import AppContainer
from tests.fakes import FakeInference, FrozenClock


@pytest.fixture
def settings() -> Settings:
    return Settings(
        app_env="test",
        backend_mode="memory",
        minimum_short_edge=256,
        normalized_long_edge=1024,
    )


@pytest.fixture
def inference() -> FakeInference:
    return FakeInference()


@pytest.fixture
def container(settings: Settings, inference: FakeInference) -> AppContainer:
    return AppContainer(
        settings=settings,
        auth=DisabledAuthVerifier(settings.anonymous_owner_uid),
        repository=InMemoryClaimRepository(),
        storage=InMemoryObjectStorage(),
        tasks=InMemoryTaskQueue(),
        inference=inference,
        clock=FrozenClock(),
    )


@pytest.fixture
def jpeg_factory() -> Callable[[int], bytes]:
    def create(seed: int) -> bytes:
        rng = random.Random(seed)
        image = Image.new("RGB", (900, 700), (40 + seed * 31 % 180, 80, 140))
        draw = ImageDraw.Draw(image)
        for _ in range(40):
            x1 = rng.randint(0, 800)
            y1 = rng.randint(0, 600)
            x2 = min(899, x1 + rng.randint(20, 140))
            y2 = min(699, y1 + rng.randint(20, 140))
            color = (rng.randrange(256), rng.randrange(256), rng.randrange(256))
            draw.rectangle((x1, y1, x2, y2), fill=color)
        draw.text((20, 20), f"view-{seed}", fill="yellow")
        output = io.BytesIO()
        image.save(output, "JPEG", quality=92)
        return output.getvalue()

    return create
