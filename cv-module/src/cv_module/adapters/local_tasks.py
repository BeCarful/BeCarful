from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from cv_module.domain.enums import RunStatus
from cv_module.domain.errors import RetryablePipelineError, RunBusyError

logger = logging.getLogger(__name__)

TaskHandler = Callable[[str, str, int], Awaitable[RunStatus]]


class LocalAnalysisTaskQueue:
    """Runs analysis in the API process for the single-process local runtime."""

    def __init__(self) -> None:
        self._handler: TaskHandler | None = None
        self._running: dict[tuple[str, str], asyncio.Task[None]] = {}

    def bind(self, handler: TaskHandler) -> None:
        self._handler = handler

    async def enqueue(self, claim_id: str, analysis_run_id: str) -> None:
        if self._handler is None:
            raise RuntimeError("local analysis task queue has no bound handler")
        key = (claim_id, analysis_run_id)
        existing = self._running.get(key)
        if existing is not None and not existing.done():
            return
        task = asyncio.create_task(self._run(key), name=f"local-analysis-{analysis_run_id}")
        self._running[key] = task
        task.add_done_callback(lambda _task: self._running.pop(key, None))

    async def _run(self, key: tuple[str, str]) -> None:
        assert self._handler is not None
        claim_id, analysis_run_id = key
        for attempt in range(3):
            try:
                await self._handler(claim_id, analysis_run_id, attempt)
                return
            except (RetryablePipelineError, RunBusyError):
                if attempt == 2:
                    logger.exception(
                        "local analysis retries exhausted",
                        extra={"run_id": analysis_run_id},
                    )
                    return
                await asyncio.sleep(0.1 * (2**attempt))
