import "server-only";
import sharp from "sharp";
import type { PhotoIssue } from "@/types";

const FORMATS: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
const MAX_PIXELS = 40_000_000;
const LONG_EDGE = 2048;
const MIN_SHORT_EDGE = 720;
const EDGES = { width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] };

export class UnreadablePhotoError extends Error {}

export type PreparedPhoto = { jpeg: Buffer; width: number; height: number; issues: PhotoIssue[] };

function meanAndVariance(pixels: Buffer) {
  let sum = 0;
  let squares = 0;
  for (const v of pixels) {
    sum += v;
    squares += v * v;
  }
  const mean = sum / pixels.length;
  return { mean, variance: squares / pixels.length - mean * mean };
}

export async function prepareImage(bytes: Buffer, contentType: string): Promise<PreparedPhoto> {
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (!meta?.format || meta.format !== FORMATS[contentType]) throw new UnreadablePhotoError("Photo bytes don't match its type");
  if (!meta.width || !meta.height || meta.width * meta.height > MAX_PIXELS) throw new UnreadablePhotoError("Photo is too large");

  const upright = sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate().flatten({ background: "#ffffff" });
  const grey = upright.clone().greyscale();
  const [greyPixels, edgePixels, normalized] = await Promise.all([
    grey.clone().raw().toBuffer(),
    grey.clone().convolve(EDGES).raw().toBuffer(),
    upright
      .clone()
      .resize(LONG_EDGE, LONG_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true }),
  ]).catch((err: unknown) => {
    throw new UnreadablePhotoError("Photo can't be decoded", { cause: err });
  });

  const brightness = meanAndVariance(greyPixels).mean;
  const issues: PhotoIssue[] = [];
  if (Math.min(meta.width, meta.height) < MIN_SHORT_EDGE) issues.push("low_resolution");
  if (brightness < 35) issues.push("too_dark");
  else if (brightness > 225) issues.push("too_bright");
  if (meanAndVariance(edgePixels).variance < 20) issues.push("possibly_blurry");

  return { jpeg: normalized.data, width: normalized.info.width, height: normalized.info.height, issues };
}
