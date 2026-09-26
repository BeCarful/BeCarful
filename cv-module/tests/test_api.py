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


def test_local_cors_allows_frontend_origins_only(
    container: AppContainer, settings: Settings
) -> None:
    client = TestClient(create_app(container=container, settings=settings))
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }

    allowed = client.options("/v1/claims", headers=headers)
    denied = client.options(
        "/v1/claims",
        headers={**headers, "Origin": "https://untrusted.example"},
    )

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-origin" not in denied.headers


def test_readiness_reports_missing_gemini_api_key_without_exposing_secrets(
    container: AppContainer,
) -> None:
    settings = Settings(
        app_env="test",
        backend_mode="memory",
        inference_mode="gemini",
        gemini_auth_mode="api_key",
        google_api_key=None,
    )
    client = TestClient(create_app(container=container, settings=settings))

    response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "inference_mode": "gemini",
        "gemini_auth_mode": "api_key",
        "gemini_model": "gemini-3.8-flash",
        "reasons": ["GOOGLE_API_KEY is required for Gemini API-key authentication"],
    }


def test_readiness_accepts_configured_gemini_api_key(container: AppContainer) -> None:
    settings = Settings(
        app_env="test",
        backend_mode="memory",
        inference_mode="gemini",
        gemini_auth_mode="api_key",
        google_api_key="unit-test-value",
    )
    client = TestClient(create_app(container=container, settings=settings))

    response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert "unit-test-value" not in response.text


def test_api_key_is_redacted_from_settings_representation() -> None:
    settings = Settings(google_api_key="unit-test-value")

    assert "unit-test-value" not in str(settings)
    assert "unit-test-value" not in settings.model_dump_json()


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


def test_export_is_not_available_before_assessment(
    container: AppContainer, settings: Settings
) -> None:
    client = TestClient(create_app(container=container, settings=settings))
    claim_id = client.post("/v1/claims").json()["claim_id"]

    response = client.get(f"/v1/claims/{claim_id}/export")

    assert response.status_code == 404
    assert response.json()["error"] == "assessment_not_ready"


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


def test_production_rejects_gemini_api_key_authentication() -> None:
    with pytest.raises(ValidationError, match="production Gemini authentication must use ADC"):
        Settings(
            app_env="production",
            backend_mode="gcp",
            auth_mode="firebase",
            inference_mode="gemini",
            gemini_auth_mode="api_key",
            google_api_key="unit-test-value",
            gcp_project="test-project",
            storage_bucket="test-bucket",
            worker_url="https://worker.example.test",
            task_invoker_service_account="tasks@test-project.iam.gserviceaccount.com",
        )
