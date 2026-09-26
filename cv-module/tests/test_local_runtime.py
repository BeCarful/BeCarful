from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cv_module.adapters.local_repository import LocalJsonClaimRepository
from cv_module.adapters.local_storage import LocalFileObjectStorage
from cv_module.adapters.local_tasks import LocalAnalysisTaskQueue
from cv_module.api.app import create_app
from cv_module.config import Settings
from cv_module.container import build_container
from cv_module.domain.enums import ClaimStatus, RunStatus
from cv_module.domain.errors import ConflictError, InvalidInputError
from cv_module.domain.models import ClaimRecord


@pytest.mark.asyncio
async def test_local_storage_authorization_is_durable_and_write_once(tmp_path: Path) -> None:
    storage = LocalFileObjectStorage(tmp_path / "objects", "http://testserver")
    first = await storage.create_upload_authorization("claims/one/source", "image/jpeg", 60)
    token = first.url.rsplit("/", maxsplit=1)[-1]

    await storage.put_authorized(token, b"jpeg-data", "image/jpeg")
    metadata = await storage.stat("claims/one/source")

    assert metadata.size_bytes == 9
    assert await storage.download("claims/one/source") == b"jpeg-data"

    second = await storage.create_upload_authorization("claims/one/source", "image/jpeg", 60)
    with pytest.raises(ConflictError):
        await storage.put_authorized(
            second.url.rsplit("/", maxsplit=1)[-1], b"replacement", "image/jpeg"
        )


@pytest.mark.asyncio
async def test_local_storage_rejects_path_traversal(tmp_path: Path) -> None:
    storage = LocalFileObjectStorage(tmp_path / "objects", "http://testserver")

    with pytest.raises(InvalidInputError):
        await storage.create_upload_authorization("../outside", "image/jpeg", 60)


@pytest.mark.asyncio
async def test_local_repository_survives_reconstruction(tmp_path: Path) -> None:
    repository_path = tmp_path / "repository.json"
    repository = LocalJsonClaimRepository(repository_path)
    now = datetime.now(UTC)
    claim = ClaimRecord(
        claim_id="clm_local",
        owner_uid="anonymous",
        status=ClaimStatus.DRAFT,
        created_at=now,
        updated_at=now,
    )
    await repository.create_claim(claim)

    reconstructed = LocalJsonClaimRepository(repository_path)

    assert await reconstructed.get_claim(claim.claim_id) == claim


@pytest.mark.asyncio
async def test_local_task_queue_runs_bound_handler() -> None:
    queue = LocalAnalysisTaskQueue()
    completed = asyncio.Event()

    async def handler(_claim_id: str, _run_id: str, _retry_count: int) -> RunStatus:
        completed.set()
        return RunStatus.COMPLETED

    queue.bind(handler)
    await queue.enqueue("clm_local", "run_local")

    await asyncio.wait_for(completed.wait(), timeout=1)


def test_local_api_upload_and_in_process_assessment(
    tmp_path: Path, jpeg_factory: Callable[[int], bytes]
) -> None:
    settings = Settings(
        app_env="test",
        backend_mode="local",
        auth_mode="disabled",
        inference_mode="stub",
        local_data_dir=tmp_path / "local",
        local_api_base_url="http://testserver",
        minimum_short_edge=256,
        normalized_long_edge=1024,
    )
    container = build_container(settings)

    with TestClient(create_app(container=container, settings=settings)) as client:
        claim_id = client.post("/v1/claims").json()["claim_id"]
        for seed in range(1, 5):
            content = jpeg_factory(seed)
            prepared = client.post(
                f"/v1/claims/{claim_id}/images:prepare-upload",
                json={"content_type": "image/jpeg", "size_bytes": len(content)},
            )
            assert prepared.status_code == 201
            ticket = prepared.json()
            uploaded = client.put(
                ticket["upload_url"],
                content=content,
                headers=ticket["required_headers"],
            )
            assert uploaded.status_code == 204

        submitted = client.post(f"/v1/claims/{claim_id}:submit")
        assert submitted.status_code == 202

        deadline = time.monotonic() + 3
        assessment = client.get(f"/v1/claims/{claim_id}/assessment")
        while assessment.status_code == 404 and time.monotonic() < deadline:
            time.sleep(0.02)
            assessment = client.get(f"/v1/claims/{claim_id}/assessment")

        assert assessment.status_code == 200
        assert assessment.json()["status"] == ClaimStatus.NEEDS_HUMAN_REVIEW
        assert (tmp_path / "local" / "repository.json").is_file()
