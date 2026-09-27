import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { DamageAssessment } from "@/models/DamageAssessment";
import { DamagePhoto } from "@/models/DamagePhoto";
import { EvidenceShare } from "@/models/EvidenceShare";
import { Incident } from "@/models/Incident";
import { User } from "@/models/User";
import { Vehicle } from "@/models/Vehicle";
import { aggregateDamage } from "@/services/claims/damage";
import { getViewUrl } from "@/services/storage/gcs";
import { vehicleTitle } from "@/services/vehicles/context";
import type { DamagedComponent } from "@/types";
import { hashShareToken, isLive } from "./token";

export const MAX_LIVE_SHARES = 10;

export async function listShareLinks(userId: Types.ObjectId, vehicleId: Types.ObjectId, incidentId: Types.ObjectId) {
  const links = await EvidenceShare.find({ userId, vehicleId, incidentId, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  return links.map((l) => ({
    id: l._id.toString(),
    label: l.label ?? null,
    expiresAt: l.expiresAt.toISOString(),
    openCount: l.openCount,
  }));
}

/** The evidence behind a share link, or null when the link is unknown or expired. Counts the open. */
export async function loadSharedEvidence(token: string) {
  await connectDB();
  const share = await EvidenceShare.findOne({ tokenHash: hashShareToken(token) });
  if (!share || !isLive(share)) return null;

  const { userId, vehicleId, incidentId } = share;
  const scope = { userId, vehicleId, incidentId };
  const [user, vehicle, incident, photos, assessments] = await Promise.all([
    User.findById(userId),
    Vehicle.findOne({ _id: vehicleId, userId }),
    Incident.findOne({ _id: incidentId, userId, vehicleId }),
    DamagePhoto.find(scope).sort({ createdAt: 1 }).lean(),
    DamageAssessment.find(scope).lean(),
  ]);
  if (!user || !vehicle || !incident) return null;

  await EvidenceShare.updateOne({ _id: share._id }, { $inc: { openCount: 1 }, $set: { lastOpenedAt: new Date() } });

  return {
    sharedBy: user.name,
    expiresAt: share.expiresAt.toISOString(),
    vehicle: {
      title: vehicleTitle(vehicle),
      color: vehicle.color,
      plate: `${vehicle.licensePlate} (${vehicle.state})`,
      vinLast4: vehicle.vin ? vehicle.vin.slice(-4) : null,
    },
    incident: {
      type: incident.type ?? null,
      occurredAt: incident.occurredAt?.toISOString() ?? null,
      location: incident.location ?? null,
      notes: incident.notes ?? null,
    },
    damage: aggregateDamage(
      assessments.map((a) => ({ photoId: a.photoId, damagedComponents: a.damagedComponents as DamagedComponent[] })),
    ),
    photos: await Promise.all(
      photos.map(async (p, i) => ({
        id: p._id.toString(),
        url: await getViewUrl(p.s3Key, { downloadName: `photo-${i + 1}.${p.s3Key.split(".").pop()}` }),
        source: p.source,
        capturedAt: p.capturedAt?.toISOString() ?? null,
        receivedAt: (p.serverReceivedAt ?? p.createdAt).toISOString(),
        location:
          p.latitude != null && p.longitude != null
            ? { latitude: p.latitude, longitude: p.longitude, accuracy: p.locationAccuracy ?? null }
            : null,
        sha256: p.sha256 ?? null,
      })),
    ),
  };
}

export type SharedEvidence = NonNullable<Awaited<ReturnType<typeof loadSharedEvidence>>>;
