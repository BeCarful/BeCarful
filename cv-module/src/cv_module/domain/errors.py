from __future__ import annotations


class DomainError(Exception):
    code = "domain_error"


class NotFoundError(DomainError):
    code = "not_found"


class AssessmentNotReadyError(NotFoundError):
    code = "assessment_not_ready"


class ForbiddenError(DomainError):
    code = "forbidden"


class ConflictError(DomainError):
    code = "conflict"


class InvalidInputError(DomainError):
    code = "invalid_input"


class ImageValidationError(DomainError):
    code = "image_validation_failed"


class InferenceContractError(DomainError):
    code = "inference_contract_failed"


class InferenceConfigurationError(DomainError):
    code = "inference_configuration_failed"


class RetryablePipelineError(DomainError):
    code = "retryable_pipeline_error"


class RunBusyError(RetryablePipelineError):
    code = "run_lease_busy"
