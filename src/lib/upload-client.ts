import type { PresignedUpload } from "@/services/storage/gcs";

/** Browser-side: send a file to S3 using a presigned POST from a server action. */
export async function uploadToStorage(upload: PresignedUpload, file: File): Promise<void> {
  const body = new FormData();
  for (const [k, v] of Object.entries(upload.fields)) body.append(k, v);
  body.append("file", file);
  const res = await fetch(upload.url, { method: "POST", body });
  if (!res.ok) throw new Error("Upload failed. Check your connection and try again.");
}
