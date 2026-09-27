import { createHash, createHmac } from "node:crypto";

export type SealFields = {
  vehicleId: string;
  sha256: string;
  serverReceivedAt: Date;
  capturedAt?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
};

export const sha256Hex = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

export function sealPhoto(f: SealFields, secret: string) {
  const payload = [
    "becarful-photo-seal-v1",
    f.vehicleId,
    f.sha256,
    f.capturedAt?.toISOString() ?? "",
    f.serverReceivedAt.toISOString(),
    f.latitude ?? "",
    f.longitude ?? "",
    f.locationAccuracy ?? "",
  ].join("|");
  return createHmac("sha256", secret).update(payload).digest("hex");
}
