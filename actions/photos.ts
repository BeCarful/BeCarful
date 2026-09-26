"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { DamageAssessment } from "@/models/DamageAssessment";
import { DamagePhoto, type DamagePhotoDoc } from "@/models/DamagePhoto";
import { Incident } from "@/models/Incident";
import type { DamageAnalysis } from "@/schemas/damage";
import { analyzeDamage } from "@/services/ai/damage-analysis";
import { geminiModel } from "@/services/ai/gemini";
import { getOrCreateOpenIncident, refreshIncidentStatus } from "@/services/claims/state";
import {
  createUpload,
  getObjectBytes,
  getViewUrl,
  headObject,
  isOwnedKey,
  validateUpload,
  type PresignedUpload,
} from "@/services/storage/s3";
import { toAnalysis } from "@/services/photos/view";
import { requireVehicle } from "@/services/vehicles/context";
import type { ActionResult } from "@/types";

/** analysis is null when the photo was saved but Gemini couldn't analyze it. */
export type PhotoResult = { photoId: string; analysis: DamageAnalysis | null };

const UploadInput = z.object({ contentType: z.string().max(100), size: z.number() });

const key = z.string().min(1).max(512);
const RegisterInput = z.discriminatedUnion("source", [
  z.object({
    key,
    source: z.literal("camera"),
    capturedAt: z.iso.datetime().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    locationAccuracy: z.number().nonnegative().optional(),
  }),
  // Uploads never carry capture time or location: we don't know them.
  z.object({ key, source: z.literal("upload") }),
]);
export type RegisterPhotoInput = z.input<typeof RegisterInput>;

const TRY_AGAIN = "Something went wrong on our side. Please try again.";

export async function createPhotoUpload(
  vehicleId: string,
  input: { contentType: string; size: number },
): Promise<ActionResult<PresignedUpload>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  const parsed = UploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a JPEG, PNG or WebP photo." };
  const invalid = validateUpload("photos", parsed.data.contentType, parsed.data.size);
  if (invalid) return { ok: false, error: invalid };
  try {
    return { ok: true, data: await createUpload("photos", user.id, vehicle.id, parsed.data.contentType) };
  } catch (err) {
    console.error("createPhotoUpload", err);
    return { ok: false, error: "We couldn't start the upload. Check your connection and try again." };
  }
}

export async function registerPhoto(vehicleId: string, input: RegisterPhotoInput): Promise<ActionResult<PhotoResult>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  const parsed = RegisterInput.safeParse(input);
  if (!parsed.success || !isOwnedKey(parsed.data.key, "photos", user.id, vehicle.id)) {
    return { ok: false, error: "That upload doesn't belong to this vehicle. Take the photo again." };
  }
  const data = parsed.data;

  try {
    // Idempotent: a retry after a dropped response must not create a second photo.
    const existing = await DamagePhoto.findOne({ userId: user._id, vehicleId: vehicle._id, s3Key: data.key });
    if (existing) {
      if (existing.analysisStatus === "done") return { ok: true, data: await resultFor(existing) };
      return { ok: true, data: await analyze(existing) };
    }

    const head = await headObject(data.key);
    if (!head) return { ok: false, error: "We couldn't find your upload. Please try again." };
    if (!head.contentType || validateUpload("photos", head.contentType, head.size ?? 0)) {
      return { ok: false, error: "That file isn't a supported photo. Use a JPEG, PNG or WebP under 15 MB." };
    }

    const incident = await getOrCreateOpenIncident(user._id, vehicle._id);
    const photo = await DamagePhoto.create({
      userId: user._id,
      vehicleId: vehicle._id,
      incidentId: incident._id,
      s3Key: data.key,
      contentType: head.contentType,
      source: data.source,
      serverReceivedAt: new Date(),
      ...(data.source === "camera"
        ? {
            capturedAt: data.capturedAt ? new Date(data.capturedAt) : undefined,
            latitude: data.latitude,
            longitude: data.longitude,
            locationAccuracy: data.locationAccuracy,
          }
        : {}),
    });
    return { ok: true, data: await analyze(photo) };
  } catch (err) {
    console.error("registerPhoto", err);
    return { ok: false, error: TRY_AGAIN };
  }
}

export async function retryPhotoAnalysis(vehicleId: string, photoId: string): Promise<ActionResult<PhotoResult>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  if (!isValidObjectId(photoId)) return { ok: false, error: "Photo not found." };
  try {
    const photo = await DamagePhoto.findOne({ _id: photoId, userId: user._id, vehicleId: vehicle._id });
    if (!photo) return { ok: false, error: "Photo not found." };
    return { ok: true, data: await analyze(photo) };
  } catch (err) {
    console.error("retryPhotoAnalysis", err);
    return { ok: false, error: TRY_AGAIN };
  }
}

export async function getPhotoViewUrl(vehicleId: string, photoId: string): Promise<ActionResult<string>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  if (!isValidObjectId(photoId)) return { ok: false, error: "Photo not found." };
  try {
    const photo = await DamagePhoto.findOne({ _id: photoId, userId: user._id, vehicleId: vehicle._id }).select("s3Key");
    if (!photo) return { ok: false, error: "Photo not found." };
    return { ok: true, data: await getViewUrl(photo.s3Key) };
  } catch (err) {
    console.error("getPhotoViewUrl", err);
    return { ok: false, error: "We couldn't load this photo. Refresh the page to try again." };
  }
}

async function analyze(photo: HydratedDocument<DamagePhotoDoc>): Promise<PhotoResult> {
  const scope = { userId: photo.userId, vehicleId: photo.vehicleId };
  photo.analysisStatus = "analyzing";
  await photo.save();
  await Incident.updateOne({ _id: photo.incidentId, ...scope, status: { $nin: ["filed", "closed"] } }, { status: "analyzing" });

  let analysis: DamageAnalysis | null = null;
  try {
    analysis = await analyzeDamage(await getObjectBytes(photo.s3Key), photo.contentType);
    await DamageAssessment.findOneAndUpdate(
      { photoId: photo._id, ...scope },
      { ...analysis, incidentId: photo.incidentId, aiModel: geminiModel() },
      { upsert: true },
    );
    photo.analysisStatus = "done";
  } catch (err) {
    console.error("analyzeDamage", err);
    analysis = null;
    photo.analysisStatus = "failed";
  }
  await photo.save();
  await refreshIncidentStatus(scope.userId, scope.vehicleId);
  revalidatePath("/", "layout");
  return { photoId: photo.id, analysis };
}

async function resultFor(photo: HydratedDocument<DamagePhotoDoc>): Promise<PhotoResult> {
  const a = await DamageAssessment.findOne({ photoId: photo._id, userId: photo.userId, vehicleId: photo.vehicleId }).lean();
  return { photoId: photo.id, analysis: a ? toAnalysis(a) : null };
}
