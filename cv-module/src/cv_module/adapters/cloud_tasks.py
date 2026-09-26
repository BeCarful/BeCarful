from __future__ import annotations

import asyncio
import hashlib
import json

from google.api_core.exceptions import AlreadyExists
from google.cloud import tasks_v2


class CloudTasksAnalysisQueue:
    def __init__(
        self,
        project: str,
        region: str,
        queue: str,
        worker_url: str,
        invoker_service_account: str,
    ) -> None:
        self._client = tasks_v2.CloudTasksClient()
        self._parent = self._client.queue_path(project, region, queue)
        self._worker_url = worker_url.rstrip("/")
        self._invoker_service_account = invoker_service_account

    async def enqueue(self, claim_id: str, analysis_run_id: str) -> None:
        task_id = hashlib.sha256(f"{claim_id}:{analysis_run_id}".encode()).hexdigest()[:32]
        task_name = f"{self._parent}/tasks/{task_id}"
        body = json.dumps(
            {"claim_id": claim_id, "analysis_run_id": analysis_run_id},
            separators=(",", ":"),
        ).encode()
        task = tasks_v2.Task(
            name=task_name,
            http_request=tasks_v2.HttpRequest(
                http_method=tasks_v2.HttpMethod.POST,
                url=f"{self._worker_url}/internal/v1/analysis-runs:process",
                headers={"Content-Type": "application/json"},
                body=body,
                oidc_token=tasks_v2.OidcToken(
                    service_account_email=self._invoker_service_account,
                    audience=self._worker_url,
                ),
            ),
            dispatch_deadline={"seconds": 1200},
        )
        try:
            await asyncio.to_thread(
                self._client.create_task,
                request=tasks_v2.CreateTaskRequest(parent=self._parent, task=task),
            )
        except AlreadyExists:
            return
