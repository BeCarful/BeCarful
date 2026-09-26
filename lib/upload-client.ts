import type { PresignedUpload } from "@/services/storage/s3";

/** Browser-side: send a file to S3 using a presigned POST from a server action. */
export async function uploadToS3(upload: PresignedUpload, file: File): Promise<void> {
  const body = new FormData();
  for (const [k, v] of Object.entries(upload.fields)) body.append(k, v);
  body.append("file", file);
  const res = await fetch(upload.url, { method: "POST", body });
  if (!res.ok) throw new Error("Upload failed. Check your connection and try again.");
}
