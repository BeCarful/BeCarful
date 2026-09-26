from __future__ import annotations

import hashlib
import json
import secrets
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath

from cv_module.domain.errors import ConflictError, InvalidInputError, NotFoundError
from cv_module.ports.storage import ObjectMetadata, UploadAuthorization


class LocalFileObjectStorage:
    """Private, write-once local object storage for development and evaluation."""

    def __init__(self, root: Path, api_base_url: str) -> None:
        self._root = root.resolve()
        self._intent_root = self._root / ".upload-intents"
        self._api_base_url = api_base_url.rstrip("/")
        self._root.mkdir(parents=True, exist_ok=True)
        self._intent_root.mkdir(parents=True, exist_ok=True)

    async def create_upload_authorization(
        self, object_name: str, content_type: str, expires_in_seconds: int
    ) -> UploadAuthorization:
        self._object_path(object_name)
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(seconds=expires_in_seconds)
        intent = {
            "object_name": object_name,
            "content_type": content_type,
            "expires_at": expires_at.isoformat(),
        }
        self._intent_path(token).write_text(json.dumps(intent), encoding="utf-8")
        return UploadAuthorization(
            url=f"{self._api_base_url}/v1/local-uploads/{token}",
            required_headers={"Content-Type": content_type},
            expires_in_seconds=expires_in_seconds,
        )

    async def put_authorized(self, token: str, data: bytes, content_type: str) -> None:
        intent_path = self._intent_path(token)
        try:
            intent = json.loads(intent_path.read_text(encoding="utf-8"))
            object_name = str(intent["object_name"])
            expected_content_type = str(intent["content_type"])
            expires_at = datetime.fromisoformat(str(intent["expires_at"]))
        except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise NotFoundError("local upload authorization was not found") from exc
        if expires_at <= datetime.now(UTC):
            intent_path.unlink(missing_ok=True)
            raise InvalidInputError("local upload authorization expired")
        if content_type != expected_content_type:
            raise InvalidInputError("upload content type does not match its authorization")
        await self._write(object_name, data, content_type, write_once=True)
        intent_path.unlink(missing_ok=True)

    async def stat(self, object_name: str) -> ObjectMetadata:
        path = self._object_path(object_name)
        metadata_path = self._metadata_path(path)
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            size_bytes = path.stat().st_size
        except (FileNotFoundError, json.JSONDecodeError) as exc:
            raise NotFoundError("local object was not found") from exc
        return ObjectMetadata(
            object_name=object_name,
            size_bytes=size_bytes,
            content_type=str(metadata["content_type"]),
            generation=str(metadata["generation"]),
            sha256=str(metadata["sha256"]),
        )

    async def download(self, object_name: str) -> bytes:
        try:
            return self._object_path(object_name).read_bytes()
        except FileNotFoundError as exc:
            raise NotFoundError("local object was not found") from exc

    async def upload_bytes(self, object_name: str, data: bytes, content_type: str) -> None:
        await self._write(object_name, data, content_type, write_once=False)

    async def upload_json(self, object_name: str, payload: str) -> None:
        await self.upload_bytes(object_name, payload.encode("utf-8"), "application/json")

    async def delete_prefix(self, prefix: str) -> None:
        path = self._object_path(prefix)
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()
            self._metadata_path(path).unlink(missing_ok=True)

    def gcs_uri(self, object_name: str) -> str:
        return self._object_path(object_name).as_uri()

    async def _write(
        self,
        object_name: str,
        data: bytes,
        content_type: str,
        *,
        write_once: bool,
    ) -> None:
        path = self._object_path(object_name)
        if write_once and path.exists():
            raise ConflictError("write-once local object already exists")
        path.parent.mkdir(parents=True, exist_ok=True)
        generation = secrets.token_hex(12)
        sha256 = hashlib.sha256(data).hexdigest()
        temporary_path = path.with_name(f".{path.name}.{generation}.tmp")
        temporary_metadata_path = self._metadata_path(temporary_path)
        temporary_path.write_bytes(data)
        temporary_metadata_path.write_text(
            json.dumps(
                {
                    "content_type": content_type,
                    "generation": generation,
                    "sha256": sha256,
                }
            ),
            encoding="utf-8",
        )
        temporary_path.replace(path)
        temporary_metadata_path.replace(self._metadata_path(path))

    def _object_path(self, object_name: str) -> Path:
        logical_path = PurePosixPath(object_name)
        if logical_path.is_absolute() or not logical_path.parts:
            raise InvalidInputError("invalid local object name")
        if any(part in {"", ".", ".."} for part in logical_path.parts):
            raise InvalidInputError("invalid local object name")
        path = self._root.joinpath(*logical_path.parts).resolve()
        if path != self._root and self._root not in path.parents:
            raise InvalidInputError("local object path escapes its storage root")
        return path

    def _intent_path(self, token: str) -> Path:
        allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
        if not token or any(character not in allowed for character in token):
            raise NotFoundError("local upload authorization was not found")
        return self._intent_root / f"{token}.json"

    @staticmethod
    def _metadata_path(path: Path) -> Path:
        return path.with_name(f"{path.name}.metadata.json")
