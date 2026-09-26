from __future__ import annotations

from enum import StrEnum


class ClaimStatus(StrEnum):
    DRAFT = "draft"
    QUEUED = "queued"
    PREPROCESSING = "preprocessing"
    ASSESSING = "assessing"
    COMPLETED = "completed"
    NEEDS_MORE_PHOTOS = "needs_more_photos"
    NEEDS_HUMAN_REVIEW = "needs_human_review"
    FAILED = "failed"
    DELETED = "deleted"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    RETRYABLE = "retryable"
    COMPLETED = "completed"
    NEEDS_MORE_PHOTOS = "needs_more_photos"
    NEEDS_HUMAN_REVIEW = "needs_human_review"
    FAILED = "failed"


class LeaseState(StrEnum):
    ACQUIRED = "acquired"
    BUSY = "busy"
    TERMINAL = "terminal"


class ImageState(StrEnum):
    PREPARED = "prepared"
    FROZEN = "frozen"
    PROCESSED = "processed"
    UNUSABLE = "unusable"


class VehicleView(StrEnum):
    FRONT = "front"
    REAR = "rear"
    LEFT = "left"
    RIGHT = "right"
    FRONT_LEFT = "front_left"
    FRONT_RIGHT = "front_right"
    REAR_LEFT = "rear_left"
    REAR_RIGHT = "rear_right"
    UNKNOWN = "unknown"


class DamageType(StrEnum):
    DENT = "dent"
    SCRATCH = "scratch"
    CRACK = "crack"
    GLASS_SHATTER = "glass_shatter"
    LAMP_BROKEN = "lamp_broken"
    TIRE_FLAT = "tire_flat"
    DETACHED_PART = "detached_part"
    DEFORMATION_OTHER = "deformation_other"


class VisualSeverity(StrEnum):
    MINOR = "minor"
    MODERATE = "moderate"
    SEVERE = "severe"


class ConfidenceBand(StrEnum):
    UNVALIDATED = "unvalidated"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class PartId(StrEnum):
    HOOD = "hood"
    ROOF = "roof"
    TRUNK = "trunk"
    FRONT_BUMPER = "front_bumper"
    REAR_BUMPER = "rear_bumper"
    WINDSHIELD = "windshield"
    REAR_WINDOW = "rear_window"
    HEADLIGHT_LEFT = "headlight_left"
    HEADLIGHT_RIGHT = "headlight_right"
    TAILLIGHT_LEFT = "taillight_left"
    TAILLIGHT_RIGHT = "taillight_right"
    FENDER_FRONT_LEFT = "fender_front_left"
    FENDER_FRONT_RIGHT = "fender_front_right"
    FENDER_REAR_LEFT = "fender_rear_left"
    FENDER_REAR_RIGHT = "fender_rear_right"
    DOOR_FRONT_LEFT = "door_front_left"
    DOOR_FRONT_RIGHT = "door_front_right"
    DOOR_REAR_LEFT = "door_rear_left"
    DOOR_REAR_RIGHT = "door_rear_right"
    MIRROR_LEFT = "mirror_left"
    MIRROR_RIGHT = "mirror_right"
    WHEEL_FRONT_LEFT = "wheel_front_left"
    WHEEL_FRONT_RIGHT = "wheel_front_right"
    WHEEL_REAR_LEFT = "wheel_rear_left"
    WHEEL_REAR_RIGHT = "wheel_rear_right"
    GRILLE = "grille"
    SIDE_SKIRT_LEFT = "side_skirt_left"
    SIDE_SKIRT_RIGHT = "side_skirt_right"
    WINDOW_FRONT_LEFT = "window_front_left"
    WINDOW_FRONT_RIGHT = "window_front_right"


class ReviewReason(StrEnum):
    CONFIDENCE_UNVALIDATED = "confidence_unvalidated"
    LOW_CONFIDENCE = "low_confidence"
    SEVERE_DAMAGE = "severe_damage"
    INCOMPLETE_COVERAGE = "incomplete_coverage"
    VEHICLE_INCONSISTENCY = "vehicle_inconsistency"
    IMAGE_QUALITY = "image_quality"
    MODEL_CONTRACT_FAILURE = "model_contract_failure"


REQUIRED_VIEWS: frozenset[VehicleView] = frozenset(
    {VehicleView.FRONT, VehicleView.REAR, VehicleView.LEFT, VehicleView.RIGHT}
)
RECOMMENDED_VIEWS: frozenset[VehicleView] = frozenset(
    {
        VehicleView.FRONT_LEFT,
        VehicleView.FRONT_RIGHT,
        VehicleView.REAR_LEFT,
        VehicleView.REAR_RIGHT,
    }
)
