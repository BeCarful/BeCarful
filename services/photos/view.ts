import "server-only";
import type { Types } from "mongoose";
import { DamageAssessment } from "@/models/DamageAssessment";
import { DamagePhoto } from "@/models/DamagePhoto";
import type { DamageAnalysis } from "@/schemas/damage";
import { getViewUrl } from "@/services/storage/s3";
import type { AnalysisStatus, DamagedComponent, PhotoSource } from "@/types";

type Id = Types.ObjectId | string;

// ponytail: an analysis cut off by the function timeout stays "analyzing"; after this long, show it as failed so Retry appears.
const STALE_ANALYSIS_MS = 3 * 60_000;

type AssessmentLike = Pick<DamageAnalysis, "summary" | "needsManualReview"> & { damagedComponents: DamagedComponent[] };

/** Plain, client-safe copy of a stored assessment. */
export function toAnalysis(a: AssessmentLike): DamageAnalysis {
  return {
    summary: a.summary,
    needsManualReview: a.needsManualReview,
    damagedComponents: a.damagedComponents.map((c) => ({
      component: c.component,
      damageTypes: [...c.damageTypes],
      severity: c.severity,
      confidence: c.confidence,
      description: c.description,
    })),
  };
}

export type PhotoView = {
  id: string;
  url: string;
  source: PhotoSource;
  /** capturedAt for camera photos (client clock), serverReceivedAt for uploads. ISO string. */
  date: string;
  hasLocation: boolean;
  analysisStatus: AnalysisStatus;
  analysis: DamageAnalysis | null;
};

/** Every photo of this vehicle, newest first, with a fresh presigned URL and its AI result. */
export async function listPhotoViews(userId: Id, vehicleId: Id): Promise<PhotoView[]> {
  const [photos, assessments] = await Promise.all([
    DamagePhoto.find({ userId, vehicleId }).sort({ createdAt: -1 }).lean(),
    DamageAssessment.find({ userId, vehicleId }).lean(),
  ]);
  const byPhoto = new Map(assessments.map((a) => [a.photoId.toString(), a]));
  return Promise.all(
    photos.map(async (p) => {
      const a = byPhoto.get(p._id.toString());
      return {
        id: p._id.toString(),
        url: await getViewUrl(p.s3Key),
        source: p.source,
        date: ((p.source === "camera" && p.capturedAt) || p.serverReceivedAt || p.createdAt).toISOString(),
        hasLocation: p.latitude != null && p.longitude != null,
        analysisStatus:
          (p.analysisStatus === "analyzing" || p.analysisStatus === "pending") && Date.now() - p.updatedAt.getTime() > STALE_ANALYSIS_MS
            ? "failed"
            : p.analysisStatus,
        analysis: a ? toAnalysis(a) : null,
      };
    }),
  );
}
