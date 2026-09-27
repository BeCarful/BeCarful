from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import datetime

import imagehash
import pillow_heif
from PIL import Image, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

from cv_module.domain.errors import ImageValidationError
from cv_module.domain.models import CaptureTime, QualityMetrics

pillow_heif.register_heif_opener()

SUPPORTED_CONTENT_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
)
FORMAT_TO_CONTENT_TYPES: dict[str, frozenset[str]] = {
    "JPEG": frozenset({"image/jpeg"}),
    "PNG": frozenset({"image/png"}),
    "WEBP": frozenset({"image/webp"}),
    "HEIF": frozenset({"image/heic", "image/heif"}),
}
NORMALIZED_JPEG_QUALITIES = (90, 82, 74, 66, 58)


@dataclass(frozen=True)
class ProcessedImage:
    jpeg_bytes: bytes
    metrics: QualityMetrics
    capture_time: CaptureTime
    deterministic_usable: bool
    quality_reasons: tuple[str, ...]


class ImageProcessor:
    def __init__(
        self,
        *,
        maximum_bytes: int,
        maximum_pixels: int,
        normalized_long_edge: int,
        minimum_short_edge: int,
        maximum_normalized_bytes: int = 7_000_000,
    ) -> None:
        self._maximum_bytes = maximum_bytes
        self._maximum_pixels = maximum_pixels
        self._normalized_long_edge = normalized_long_edge
        self._minimum_short_edge = minimum_short_edge
        self._maximum_normalized_bytes = maximum_normalized_bytes

    def process(self, data: bytes, declared_content_type: str) -> ProcessedImage:
        if declared_content_type not in SUPPORTED_CONTENT_TYPES:
            raise ImageValidationError("unsupported image content type")
        if not data or len(data) > self._maximum_bytes:
            raise ImageValidationError("image is empty or exceeds the maximum size")

        try:
            with Image.open(io.BytesIO(data)) as source:
                detected_format = (source.format or "").upper()
                allowed_types = FORMAT_TO_CONTENT_TYPES.get(detected_format, frozenset())
                if declared_content_type not in allowed_types:
                    raise ImageValidationError("declared content type does not match image bytes")
                source_width, source_height = source.size
                if source_width * source_height > self._maximum_pixels:
                    raise ImageValidationError("image exceeds the maximum pixel count")
                capture_time = self._capture_time(source)
                source.load()
                image = ImageOps.exif_transpose(source)
        except ImageValidationError:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise ImageValidationError("image cannot be decoded safely") from exc

        width, height = image.size
        image = self._to_rgb(image)
        reasons: list[str] = []
        deterministic_usable = True
        if min(width, height) < self._minimum_short_edge:
            reasons.append("low_resolution")

        grayscale = ImageOps.grayscale(image)
        brightness = float(ImageStat.Stat(grayscale).mean[0])
        edge_variance = float(ImageStat.Stat(grayscale.filter(ImageFilter.FIND_EDGES)).var[0])
        histogram = grayscale.histogram()
        pixels = max(1, width * height)
        clipped_dark = sum(histogram[:6]) / pixels
        clipped_bright = sum(histogram[250:]) / pixels

        if brightness < 35:
            reasons.append("too_dark")
        elif brightness > 225:
            reasons.append("too_bright")
        if edge_variance < 20:
            reasons.append("possibly_blurry")

        metrics = QualityMetrics(
            width=width,
            height=height,
            brightness_mean=round(brightness, 4),
            edge_variance=round(edge_variance, 4),
            clipped_dark_ratio=round(clipped_dark, 6),
            clipped_bright_ratio=round(clipped_bright, 6),
            perceptual_hash=str(imagehash.phash(image)),
        )

        normalized = image.copy()
        normalized.thumbnail((self._normalized_long_edge, self._normalized_long_edge))
        normalized_bytes: bytes | None = None
        for quality in NORMALIZED_JPEG_QUALITIES:
            output = io.BytesIO()
            normalized.save(output, format="JPEG", quality=quality, optimize=True)
            candidate = output.getvalue()
            if len(candidate) <= self._maximum_normalized_bytes:
                normalized_bytes = candidate
                break
        if normalized_bytes is None:
            raise ImageValidationError("normalized image exceeds the Gemini inline data limit")
        return ProcessedImage(
            jpeg_bytes=normalized_bytes,
            metrics=metrics,
            capture_time=capture_time,
            deterministic_usable=deterministic_usable,
            quality_reasons=tuple(reasons),
        )

    @staticmethod
    def _to_rgb(image: Image.Image) -> Image.Image:
        if image.mode == "RGB":
            return image
        if image.mode in {"RGBA", "LA"}:
            rgba = image.convert("RGBA")
            background = Image.new("RGBA", rgba.size, "white")
            return Image.alpha_composite(background, rgba).convert("RGB")
        return image.convert("RGB")

    @staticmethod
    def _capture_time(image: Image.Image) -> CaptureTime:
        try:
            exif = image.getexif()
            raw_timestamp = exif.get(36867)
            raw_offset = exif.get(36881) or exif.get(36880)
            if not isinstance(raw_timestamp, str):
                return CaptureTime()
            local = datetime.strptime(raw_timestamp, "%Y:%m:%d %H:%M:%S")
            if isinstance(raw_offset, str) and len(raw_offset) == 6:
                aware = datetime.fromisoformat(f"{local.isoformat()}{raw_offset}")
                return CaptureTime(
                    value=aware.isoformat(),
                    timezone_known=True,
                    source="exif",
                )
            return CaptureTime(
                value=local.isoformat(),
                timezone_known=False,
                source="exif",
            )
        except (TypeError, ValueError, OSError):
            return CaptureTime()


def perceptual_hash_distance(first: str, second: str) -> int:
    return (int(first, 16) ^ int(second, 16)).bit_count()
