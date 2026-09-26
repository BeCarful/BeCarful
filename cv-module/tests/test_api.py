from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from cv_module.adapters.in_memory import DevelopmentAuthVerifier
from cv_module.api.app import create_app
from cv_module.config import Settings
from cv_module.container import AppContainer


def test_api_accepts_requests_without_authentication(
    container: AppContainer, settings: Settings
) -> None:
    client = TestClient(create_app(container=container, settings=settings))
    response = client.post("/v1/claims")
    assert response.status_code == 201


def test_development_auth_can_still_scope_claims(
    container: AppContainer, settings: Settings
) -> None:
    container.auth = DevelopmentAuthVerifier()
    client = TestClient(create_app(container=container, settings=settings))
    created = client.post("/v1/claims", headers={"Authorization": "Bearer dev:alice"})
    claim_id = created.json()["claim_id"]

    response = client.get(f"/v1/claims/{claim_id}", headers={"Authorization": "Bearer dev:bob"})

    assert created.status_code == 201
    assert response.status_code == 403


def test_claim_deletion_removes_access(container: AppContainer, settings: Settings) -> None:
    client = TestClient(create_app(container=container, settings=settings))
    claim_id = client.post("/v1/claims").json()["claim_id"]

    deleted = client.delete(f"/v1/claims/{claim_id}")
    fetched = client.get(f"/v1/claims/{claim_id}")

    assert deleted.status_code == 204
    assert fetched.status_code == 404


def test_account_wide_deletion_is_blocked_without_authentication(
    container: AppContainer, settings: Settings
) -> None:
    client = TestClient(create_app(container=container, settings=settings))

    response = client.delete("/v1/users/me/data")

    assert response.status_code == 409
    assert response.json()["error"] == "conflict"


def test_production_rejects_disabled_authentication() -> None:
    with pytest.raises(ValidationError, match="production requires authentication"):
        Settings(
            app_env="production",
            backend_mode="gcp",
            auth_mode="disabled",
            gcp_project="test-project",
            storage_bucket="test-bucket",
            worker_url="https://worker.example.test",
            task_invoker_service_account="tasks@test-project.iam.gserviceaccount.com",
        )
