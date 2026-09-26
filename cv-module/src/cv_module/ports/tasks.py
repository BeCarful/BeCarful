from __future__ import annotations

from typing import Protocol


class AnalysisTaskQueue(Protocol):
    async def enqueue(self, claim_id: str, analysis_run_id: str) -> None: ...
