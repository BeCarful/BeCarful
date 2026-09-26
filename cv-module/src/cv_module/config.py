from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    app_env: Literal["local", "test", "staging", "production"] = "local"
    backend_mode: Literal["memory", "local", "gcp"] = "local"
    auth_mode: Literal["disabled", "development", "firebase"] = "disabled"
    anonymous_owner_uid: str = Field(default="anonymous-evaluation-user", min_length=1)
    inference_mode: Literal["stub", "gemini"] = "stub"
    log_level: str = "INFO"

    gcp_project: str | None = None
    gcp_region: str = "us-central1"
    gemini_location: str = "us"
    gemini_model: str = "gemini-3.8-flash"
    gemini_input_cost_per_million_usd: float | None = Field(default=None, ge=0)
    gemini_output_cost_per_million_usd: float | None = Field(default=None, ge=0)
    storage_bucket: str | None = None
    tasks_queue: str = "car-damage-analysis"
    worker_url: str | None = None
    task_invoker_service_account: str | None = None
    local_data_dir: Path = Path("var/local")
    local_api_base_url: str = "http://127.0.0.1:8000"

    upload_url_ttl_seconds: int = Field(default=900, ge=60, le=3600)
    worker_lease_seconds: int = Field(default=1200, ge=60, le=1800)
    maximum_images_per_claim: int = Field(default=12, ge=4, le=12)
    maximum_image_bytes: int = Field(default=20 * 1024 * 1024, ge=1)
    maximum_image_pixels: int = Field(default=40_000_000, ge=1)
    normalized_long_edge: int = Field(default=2048, ge=1024, le=4096)
    minimum_short_edge: int = Field(default=720, ge=256, le=2048)
    git_revision: str = "unknown"

    @model_validator(mode="after")
    def validate_cloud_configuration(self) -> Settings:
        if self.backend_mode == "gcp":
            required = {
                "gcp_project": self.gcp_project,
                "storage_bucket": self.storage_bucket,
                "worker_url": self.worker_url,
                "task_invoker_service_account": self.task_invoker_service_account,
            }
            missing = [name for name, value in required.items() if not value]
            if missing:
                raise ValueError(f"missing GCP settings: {', '.join(missing)}")
        if self.inference_mode == "gemini" and not self.gcp_project:
            raise ValueError("INFERENCE_MODE=gemini requires GCP_PROJECT")
        if self.app_env in {"staging", "production"} and self.backend_mode != "gcp":
            raise ValueError("staging and production require BACKEND_MODE=gcp")
        if self.auth_mode == "development" and self.app_env not in {"local", "test"}:
            raise ValueError("AUTH_MODE=development is only allowed in local and test environments")
        if self.app_env == "production" and self.auth_mode == "disabled":
            raise ValueError("production requires authentication")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
