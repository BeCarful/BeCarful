from __future__ import annotations

from typing import Annotated, cast

from fastapi import Depends, Request

from cv_module.container import AppContainer
from cv_module.ports.auth import AuthenticatedUser


def get_container(request: Request) -> AppContainer:
    return cast(AppContainer, request.app.state.container)


async def get_current_user(
    request: Request,
    container: Annotated[AppContainer, Depends(get_container)],
) -> AuthenticatedUser:
    scheme, separator, value = request.headers.get("Authorization", "").partition(" ")
    token = None
    if separator and scheme.lower() == "bearer" and value:
        token = value
    return await container.auth.verify(token)


ContainerDependency = Annotated[AppContainer, Depends(get_container)]
UserDependency = Annotated[AuthenticatedUser, Depends(get_current_user)]
