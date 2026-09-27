import "server-only";
import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { env } from "@/lib/env";

export type UploadKind = "photos" | "policies";

export const UPLOAD_RULES: Record<UploadKind, { types: Record<string, string>; maxBytes: number }> = {
  photos: { types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }, maxBytes: 15 * 1024 * 1024 },
  policies: { types: { "application/pdf": "pdf", "text/plain": "txt" }, maxBytes: 20 * 1024 * 1024 },
};

export const VIEW_URL_TTL_SECONDS = 60 * 60;

let client: Storage | undefined;
const file = (key: string) => (client ??= new Storage({ projectId: env().GOOGLE_CLOUD_PROJECT })).bucket(env().GCS_BUCKET_NAME).file(key);

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
  const [{ url, fields }] = await file(key).generateSignedPostPolicyV4({
    expires: Date.now() + 300_000,
    conditions: [
      ["content-length-range", 1, UPLOAD_RULES[kind].maxBytes],
      ["eq", "$Content-Type", contentType],
    ],
    fields: { "Content-Type": contentType },
  });
  return { url, fields, key };
}

export async function headObject(key: string): Promise<{ contentType?: string; size?: number } | null> {
  try {
    const [meta] = await file(key).getMetadata();
    return { contentType: meta.contentType, size: Number(meta.size) };
  } catch {
    return null;
  }
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const [bytes] = await file(key).download();
  return bytes;
}

export async function putObject(key: string, body: Buffer | string, contentType: string) {
  await file(key).save(body, { contentType, resumable: false });
}

export async function deleteObject(key: string) {
  await file(key).delete({ ignoreNotFound: true });
}

/** Short-lived private read URL. Never store it; generate on read. */
export async function getViewUrl(key: string, opts?: { downloadName?: string }) {
  const [url] = await file(key).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + VIEW_URL_TTL_SECONDS * 1000,
    ...(opts?.downloadName ? { responseDisposition: `inline; filename="${opts.downloadName.replace(/"/g, "")}"` } : {}),
  });
  return url;
}
