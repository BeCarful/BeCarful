from __future__ import annotations

from cv_module.ports.auth import AuthenticatedUser


class DisabledAuthVerifier:
    """Supply one non-authenticated owner for local and evaluation environments."""

    def __init__(self, owner_uid: str) -> None:
        self._owner_uid = owner_uid

    async def verify(self, _token: str | None) -> AuthenticatedUser:
        return AuthenticatedUser(uid=self._owner_uid)
