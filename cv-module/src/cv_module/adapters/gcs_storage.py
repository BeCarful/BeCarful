from __future__ import annotations

import asyncio
import hashlib
from datetime import timedelta
from typing import Any, cast

from google.api_core.exceptions import NotFound
from google.auth import default
from google.auth.transport.requests import Request
from google.cloud import storage  # type: ignore[attr-defined]

from cv_module.domain.errors import NotFoundError
from cv_module.ports.storage import ObjectMetadata, UploadAuthorization


class GcsObjectStorage:
    def __init__(self, project: str, bucket_name: str) -> None:
        self._client = storage.Client(project=project)
        self._bucket = self._client.bucket(bucket_name)
        self._bucket_name = bucket_name
        self._credentials, _ = default()

    async def create_upload_authorization(
        self, object_name: str, content_type: str, expires_in_seconds: int
    ) -> UploadAuthorization:
        def sign() -> str:
            blob = self._bucket.blob(object_name)
            signing_options: dict[str, Any] = {}
            if not hasattr(self._credentials, "sign_bytes"):
                self._credentials.refresh(Request())  # type: ignore[no-untyped-call]
                signing_options = {
                    "service_account_email": getattr(
                        self._credentials, "service_account_email", None
                    ),
                    "access_token": self._credentials.token,
                }
            return cast(
                str,
                blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(seconds=expires_in_seconds),
                    method="PUT",
                    content_type=content_type,
                    headers={"x-goog-if-generation-match": "0"},
                    **signing_options,
                ),
            )

        url = await asyncio.to_thread(sign)
        return UploadAuthorization(
            url=url,
            required_headers={
                "Content-Type": content_type,
                "x-goog-if-generation-match": "0",
            },
            expires_in_seconds=expires_in_seconds,
        )

    async def stat(self, object_name: str) -> ObjectMetadata:
        def read() -> ObjectMetadata:
            blob = self._bucket.blob(object_name)
            try:
                blob.reload()
                content = blob.download_as_bytes(if_generation_match=blob.generation)
            except NotFound as exc:
                raise NotFoundError("uploaded object not found") from exc
            return ObjectMetadata(
                object_name=object_name,
                size_bytes=int(blob.size or len(content)),
                content_type=blob.content_type or "application/octet-stream",
                generation=str(blob.generation),
                sha256=hashlib.sha256(content).hexdigest(),
            )

        return await asyncio.to_thread(read)

    async def download(self, object_name: str) -> bytes:
        def read() -> bytes:
            try:
                return cast(bytes, self._bucket.blob(object_name).download_as_bytes())
            except NotFound as exc:
                raise NotFoundError("object not found") from exc

        return await asyncio.to_thread(read)

    async def upload_bytes(self, object_name: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(
            self._bucket.blob(object_name).upload_from_string,
            data,
            content_type=content_type,
        )

    async def upload_json(self, object_name: str, payload: str) -> None:
        await self.upload_bytes(object_name, payload.encode(), "application/json")

    async def delete_prefix(self, prefix: str) -> None:
        def delete() -> None:
            blobs = list(self._client.list_blobs(self._bucket, prefix=prefix, versions=True))
            for blob in blobs:
                blob.delete(if_generation_match=blob.generation)

        await asyncio.to_thread(delete)

    def gcs_uri(self, object_name: str) -> str:
        return f"gs://{self._bucket_name}/{object_name}"
