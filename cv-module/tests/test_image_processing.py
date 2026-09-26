from __future__ import annotations

import io

import pillow_heif
import pytest
from PIL import Image

from cv_module.domain.errors import ImageValidationError
from cv_module.services.image_processing import ImageProcessor


def processor(
    maximum_bytes: int = 2_000_000,
    maximum_pixels: int = 4_000_000,
    maximum_normalized_bytes: int = 7_000_000,
) -> ImageProcessor:
    return ImageProcessor(
        maximum_bytes=maximum_bytes,
        maximum_pixels=maximum_pixels,
        normalized_long_edge=1024,
        minimum_short_edge=64,
        maximum_normalized_bytes=maximum_normalized_bytes,
    )


def test_corrupt_image_is_rejected() -> None:
    with pytest.raises(ImageValidationError):
        processor().process(b"not an image", "image/jpeg")


def test_mime_signature_mismatch_is_rejected() -> None:
    output = io.BytesIO()
    Image.new("RGB", (100, 100), "red").save(output, "PNG")
    with pytest.raises(ImageValidationError):
        processor().process(output.getvalue(), "image/jpeg")


def test_exif_time_without_offset_is_preserved_as_local() -> None:
    image = Image.new("RGB", (800, 600), "blue")
    exif = Image.Exif()
    exif[36867] = "2026:09:25 21:14:03"
    output = io.BytesIO()
    image.save(output, "JPEG", exif=exif)

    result = processor().process(output.getvalue(), "image/jpeg")

    assert result.capture_time.value == "2026-09-25T21:14:03"
    assert result.capture_time.timezone_known is False
    assert result.capture_time.source == "exif"


def test_exif_time_with_offset_is_timezone_aware() -> None:
    image = Image.new("RGB", (800, 600), "blue")
    exif = Image.Exif()
    exif[36867] = "2026:09:25 21:14:03"
    exif[36881] = "-04:00"
    output = io.BytesIO()
    image.save(output, "JPEG", exif=exif)

    result = processor().process(output.getvalue(), "image/jpeg")

    assert result.capture_time.value == "2026-09-25T21:14:03-04:00"
    assert result.capture_time.timezone_known is True


def test_oversized_payload_is_rejected() -> None:
    with pytest.raises(ImageValidationError):
        processor(maximum_bytes=4).process(b"12345", "image/jpeg")


def test_excessive_pixel_count_is_rejected_before_decode() -> None:
    output = io.BytesIO()
    Image.new("RGB", (100, 100), "red").save(output, "JPEG")

    with pytest.raises(ImageValidationError):
        processor(maximum_pixels=5_000).process(output.getvalue(), "image/jpeg")


def test_heic_image_is_normalized_to_jpeg() -> None:
    image = Image.new("RGB", (800, 600), "green")
    output = io.BytesIO()
    pillow_heif.from_pillow(image).save(output)

    result = processor().process(output.getvalue(), "image/heic")

    assert result.jpeg_bytes.startswith(b"\xff\xd8")
    assert result.metrics.width == 800
    assert result.metrics.height == 600


def test_normalized_image_is_recompressed_to_inline_limit() -> None:
    image = Image.effect_noise((800, 800), 100).convert("RGB")
    output = io.BytesIO()
    image.save(output, "PNG")
    data = output.getvalue()
    baseline = processor(maximum_bytes=len(data) + 1).process(data, "image/png")

    compressed = processor(
        maximum_bytes=len(data) + 1,
        maximum_normalized_bytes=len(baseline.jpeg_bytes) - 1,
    ).process(data, "image/png")

    assert len(compressed.jpeg_bytes) < len(baseline.jpeg_bytes)


def test_normalized_image_that_cannot_fit_inline_limit_is_rejected() -> None:
    image = Image.effect_noise((800, 800), 100).convert("RGB")
    output = io.BytesIO()
    image.save(output, "PNG")
    data = output.getvalue()

    with pytest.raises(ImageValidationError):
        processor(
            maximum_bytes=len(data) + 1,
            maximum_normalized_bytes=1,
        ).process(data, "image/png")
