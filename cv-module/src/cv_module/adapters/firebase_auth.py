from __future__ import annotations

import asyncio

from firebase_admin import auth  # type: ignore[import-untyped]

from cv_module.domain.errors import ForbiddenError
from cv_module.ports.auth import AuthenticatedUser


class FirebaseAuthVerifier:
    async def verify(self, token: str | None) -> AuthenticatedUser:
        if token is None:
            raise ForbiddenError("a bearer token is required")
        try:
            decoded = await asyncio.to_thread(auth.verify_id_token, token, True)
        except Exception as exc:
            raise ForbiddenError("invalid or revoked authentication token") from exc
        uid = decoded.get("uid") or decoded.get("sub")
        if not isinstance(uid, str) or not uid:
            raise ForbiddenError("authentication token has no user identity")
        return AuthenticatedUser(uid=uid)
