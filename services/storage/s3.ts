import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export type UploadKind = "photos" | "policies";

export const UPLOAD_RULES: Record<UploadKind, { types: Record<string, string>; maxBytes: number }> = {
  photos: { types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }, maxBytes: 15 * 1024 * 1024 },
  policies: { types: { "application/pdf": "pdf", "text/plain": "txt" }, maxBytes: 20 * 1024 * 1024 },
};

export const VIEW_URL_TTL_SECONDS = 60 * 60;

let client: S3Client | undefined;
function s3() {
  const e = env();
  return (client ??= new S3Client({
    region: e.AWS_REGION,
    credentials: { accessKeyId: e.AWS_ACCESS_KEY_ID, secretAccessKey: e.AWS_SECRET_ACCESS_KEY },
    ...(e.S3_ENDPOINT ? { endpoint: e.S3_ENDPOINT, forcePathStyle: true } : {}),
  }));
}
const bucket = () => env().S3_BUCKET_NAME;

const keyPrefix = (kind: UploadKind, userId: string, vehicleId: string) => `users/${userId}/vehicles/${vehicleId}/${kind}/`;

/** Returns an error message, or null when the file is acceptable. */
export function validateUpload(kind: UploadKind, contentType: string, size: number): string | null {
  const rule = UPLOAD_RULES[kind];
  if (!rule.types[contentType] || (kind === "policies" && contentType !== "application/pdf")) {
    return kind === "photos" ? "Please use a JPEG, PNG or WebP photo." : "Please upload your policy as a PDF.";
  }
  if (!Number.isFinite(size) || size <= 0) return "That file looks empty.";
  if (size > rule.maxBytes) return `That file is too large (max ${rule.maxBytes / 1024 / 1024} MB).`;
  return null;
}

/** Safe key: never includes the user's filename. */
export function makeKey(kind: UploadKind, userId: string, vehicleId: string, contentType: string) {
  return `${keyPrefix(kind, userId, vehicleId)}${randomUUID()}.${UPLOAD_RULES[kind].types[contentType]}`;
}

/** Guards against a client registering a key that belongs to another user/vehicle. */
export function isOwnedKey(key: string, kind: UploadKind, userId: string, vehicleId: string) {
  return key.startsWith(keyPrefix(kind, userId, vehicleId)) && !key.includes("..");
}

export type PresignedUpload = { url: string; fields: Record<string, string>; key: string };

/** Browser POSTs the file straight to S3; S3 enforces type and size. */
export async function createUpload(
  kind: UploadKind,
  userId: string,
  vehicleId: string,
  contentType: string,
): Promise<PresignedUpload> {
  const key = makeKey(kind, userId, vehicleId, contentType);
  const { url, fields } = await createPresignedPost(s3(), {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ["content-length-range", 1, UPLOAD_RULES[kind].maxBytes],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
    Expires: 300,
  });
  return { url, fields, key };
}

export async function headObject(key: string): Promise<{ contentType?: string; size?: number } | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { contentType: res.ContentType, size: res.ContentLength };
  } catch {
    return null;
  }
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return Buffer.from(await res.Body!.transformToByteArray());
}

export async function putObject(key: string, body: Buffer | string, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Short-lived private read URL. Never store it; generate on read. */
export function getViewUrl(key: string, opts?: { downloadName?: string }) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ...(opts?.downloadName ? { ResponseContentDisposition: `inline; filename="${opts.downloadName.replace(/"/g, "")}"` } : {}),
    }),
    { expiresIn: VIEW_URL_TTL_SECONDS },
  );
}
