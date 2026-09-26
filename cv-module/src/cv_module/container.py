from __future__ import annotations

from dataclasses import dataclass

import firebase_admin  # type: ignore[import-untyped]

from cv_module.adapters.cloud_tasks import CloudTasksAnalysisQueue
from cv_module.adapters.disabled_auth import DisabledAuthVerifier
from cv_module.adapters.firebase_auth import FirebaseAuthVerifier
from cv_module.adapters.firestore_repository import FirestoreClaimRepository
from cv_module.adapters.gcs_storage import GcsObjectStorage
from cv_module.adapters.gemini_inference import GeminiDamageInference
from cv_module.adapters.in_memory import (
    DevelopmentAuthVerifier,
    InMemoryClaimRepository,
    InMemoryObjectStorage,
    InMemoryTaskQueue,
)
from cv_module.adapters.local_inference import LocalNoDamageInference
from cv_module.adapters.local_repository import LocalJsonClaimRepository
from cv_module.adapters.local_storage import LocalFileObjectStorage
from cv_module.adapters.local_tasks import LocalAnalysisTaskQueue
from cv_module.config import Settings
from cv_module.domain.enums import RunStatus
from cv_module.ports.auth import AuthVerifier
from cv_module.ports.clock import Clock, SystemClock
from cv_module.ports.inference import DamageInference
from cv_module.ports.repository import ClaimRepository
from cv_module.ports.storage import ObjectStorage
from cv_module.ports.tasks import AnalysisTaskQueue
from cv_module.services.assessment import AssessmentPipeline
from cv_module.services.claims import ClaimService
from cv_module.services.image_processing import ImageProcessor


@dataclass
class AppContainer:
    settings: Settings
    auth: AuthVerifier
    repository: ClaimRepository
    storage: ObjectStorage
    tasks: AnalysisTaskQueue
    inference: DamageInference
    clock: Clock

    @property
    def claims(self) -> ClaimService:
        return ClaimService(
            repository=self.repository,
            storage=self.storage,
            tasks=self.tasks,
            clock=self.clock,
            settings=self.settings,
        )

    @property
    def assessment_pipeline(self) -> AssessmentPipeline:
        return AssessmentPipeline(
            repository=self.repository,
            storage=self.storage,
            inference=self.inference,
            image_processor=ImageProcessor(
                maximum_bytes=self.settings.maximum_image_bytes,
                maximum_pixels=self.settings.maximum_image_pixels,
                normalized_long_edge=self.settings.normalized_long_edge,
                minimum_short_edge=self.settings.minimum_short_edge,
                maximum_normalized_bytes=self.settings.gemini_inline_image_max_bytes,
            ),
            clock=self.clock,
            settings=self.settings,
        )


def build_container(settings: Settings) -> AppContainer:
    clock = SystemClock()
    if settings.auth_mode == "disabled":
        auth: AuthVerifier = DisabledAuthVerifier(settings.anonymous_owner_uid)
    elif settings.auth_mode == "development":
        auth = DevelopmentAuthVerifier()
    else:
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app()
        auth = FirebaseAuthVerifier()

    if settings.backend_mode == "memory":
        return AppContainer(
            settings=settings,
            auth=auth,
            repository=InMemoryClaimRepository(),
            storage=InMemoryObjectStorage(),
            tasks=InMemoryTaskQueue(),
            inference=LocalNoDamageInference(),
            clock=clock,
        )

    if settings.backend_mode == "local":
        inference: DamageInference
        if settings.inference_mode == "gemini":
            assert settings.gcp_project is not None
            inference = GeminiDamageInference(
                project=settings.gcp_project,
                location=settings.gemini_location,
                model_id=settings.gemini_model,
                auth_mode=settings.gemini_auth_mode,
                api_key=(
                    settings.google_api_key.get_secret_value()
                    if settings.google_api_key is not None
                    else None
                ),
                inline_image_max_bytes=settings.gemini_inline_image_max_bytes,
            )
        else:
            inference = LocalNoDamageInference()
        local_tasks = LocalAnalysisTaskQueue()
        container = AppContainer(
            settings=settings,
            auth=auth,
            repository=LocalJsonClaimRepository(settings.local_data_dir / "repository.json"),
            storage=LocalFileObjectStorage(
                settings.local_data_dir / "objects", settings.local_api_base_url
            ),
            tasks=local_tasks,
            inference=inference,
            clock=clock,
        )

        async def process_local(claim_id: str, run_id: str, retry_count: int) -> RunStatus:
            return await container.assessment_pipeline.process(
                claim_id, run_id, task_retry_count=retry_count
            )

        local_tasks.bind(process_local)
        return container

    assert settings.gcp_project is not None
    assert settings.storage_bucket is not None
    assert settings.worker_url is not None
    assert settings.task_invoker_service_account is not None
    return AppContainer(
        settings=settings,
        auth=auth,
        repository=FirestoreClaimRepository(settings.gcp_project),
        storage=GcsObjectStorage(settings.gcp_project, settings.storage_bucket),
        tasks=CloudTasksAnalysisQueue(
            project=settings.gcp_project,
            region=settings.gcp_region,
            queue=settings.tasks_queue,
            worker_url=settings.worker_url,
            invoker_service_account=settings.task_invoker_service_account,
        ),
        inference=GeminiDamageInference(
            project=settings.gcp_project,
            location=settings.gemini_location,
            model_id=settings.gemini_model,
            auth_mode=settings.gemini_auth_mode,
            api_key=(
                settings.google_api_key.get_secret_value()
                if settings.google_api_key is not None
                else None
            ),
            inline_image_max_bytes=settings.gemini_inline_image_max_bytes,
        ),
        clock=clock,
    )
