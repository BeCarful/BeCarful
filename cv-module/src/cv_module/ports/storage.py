from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field


class ObjectMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    object_name: str
    size_bytes: int = Field(ge=0)
    content_type: str
    generation: str
    sha256: str


class UploadAuthorization(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str
    method: str = "PUT"
    required_headers: dict[str, str]
    expires_in_seconds: int


class ObjectStorage(Protocol):
    async def create_upload_authorization(
        self, object_name: str, content_type: str, expires_in_seconds: int
    ) -> UploadAuthorization: ...

    async def stat(self, object_name: str) -> ObjectMetadata: ...

    async def download(self, object_name: str) -> bytes: ...

    async def upload_bytes(self, object_name: str, data: bytes, content_type: str) -> None: ...

    async def upload_json(self, object_name: str, payload: str) -> None: ...

    async def delete_prefix(self, prefix: str) -> None: ...

    def gcs_uri(self, object_name: str) -> str: ...
