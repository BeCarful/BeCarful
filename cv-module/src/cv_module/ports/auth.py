from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, ConfigDict


class AuthenticatedUser(BaseModel):
    model_config = ConfigDict(extra="forbid")
    uid: str


class AuthVerifier(Protocol):
    async def verify(self, token: str | None) -> AuthenticatedUser: ...
