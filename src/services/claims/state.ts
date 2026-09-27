import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { DamageAssessment } from "@/models/DamageAssessment";
import { DamagePhoto } from "@/models/DamagePhoto";
import { Incident } from "@/models/Incident";
import { InsurancePolicy } from "@/models/InsurancePolicy";
import type { CoverageItem } from "@/services/ai/coverage-rules";
import { getProvider } from "@/services/insurance/providers";
import type { PolicyExtraction } from "@/schemas/policy";
import type { DamagedComponent } from "@/types";
import { checkClaim } from "./claim-check";
import { aggregateDamage, damagePhotoCount } from "./damage";
import { computeTodos, nextIncidentStatus, type ClaimState } from "./todos";

type Id = Types.ObjectId | string;

export const getActivePolicy = (userId: Id, vehicleId: Id) =>
  InsurancePolicy.findOne({ userId, vehicleId }).sort({ uploadedAt: -1 });

/** The open incident is the newest one that isn't closed. */
export const getOpenIncident = (userId: Id, vehicleId: Id) =>
  Incident.findOne({ userId, vehicleId, status: { $ne: "closed" } }).sort({ createdAt: -1 });

export async function getOrCreateOpenIncident(userId: Id, vehicleId: Id) {
  const open = await getOpenIncident(userId, vehicleId);
  if (open) return open;
  const policy = await getActivePolicy(userId, vehicleId);
  return Incident.create({ userId, vehicleId, insurancePolicyId: policy?._id, status: "documenting" });
}

/** Everything the summary, to-dos and chat need for one vehicle, scoped by owner + vehicle. */
export async function loadClaimState(userId: Id, vehicleId: Id) {
  await connectDB();
  const [policy, incident] = await Promise.all([getActivePolicy(userId, vehicleId), getOpenIncident(userId, vehicleId)]);
  const [photos, assessments] = incident
    ? await Promise.all([
        DamagePhoto.find({ userId, vehicleId, incidentId: incident._id }).sort({ createdAt: -1 }),
        DamageAssessment.find({ userId, vehicleId, incidentId: incident._id }),
      ])
    : [[], []];
  const damage = aggregateDamage(
    assessments.map((a) => ({ photoId: a.photoId, damagedComponents: a.damagedComponents as DamagedComponent[] })),
  );
  const provider = getProvider(policy?.providerId);
  const state: ClaimState = {
    policyStatus: policy?.status ?? null,
    providerName: provider?.name ?? null,
    photoCount: photos.length,
    damage,
    incident: incident
      ? { type: incident.type, occurredAt: incident.occurredAt, location: incident.location, status: incident.status }
      : null,
  };
  const todos = computeTodos(state);
  return { state, todos, policy, provider, incident, photos, assessments, damage };
}

/** Call after any change that can affect the to-do list (photo, analysis, policy, incident info). */
export async function refreshIncidentStatus(userId: Id, vehicleId: Id) {
  const { state, todos, incident } = await loadClaimState(userId, vehicleId);
  const next = nextIncidentStatus(state, todos);
  if (incident && next && next !== incident.status) {
    incident.status = next;
    await incident.save();
  }
  return { state, todos };
}

/** The claim check, once the open claim is ready to file or filed. */
export function claimCheckFor({ incident, policy, photos, assessments, damage }: Awaited<ReturnType<typeof loadClaimState>>) {
  if (incident?.status !== "ready_to_file" && incident?.status !== "filed") return null;
  return checkClaim({
    incidentType: incident.type ?? null,
    occurredAt: incident.occurredAt ?? null,
    policy: policy && {
      extraction: policy.status === "processed" ? (policy.extractedData as PolicyExtraction | null) : null,
      coverage: (policy.coverageChecklist as { items: CoverageItem[] } | null)?.items ?? null,
      examplePlan: Boolean(policy.planId),
    },
    photos: photos.map((p) => ({
      showsDamage: damage.some((d) => d.photoIds.includes(p._id.toString())),
      source: p.source,
      capturedAt: p.source === "camera" ? (p.capturedAt ?? null) : null,
      hasLocation: p.latitude != null && p.longitude != null,
    })),
    damagePhotos: damagePhotoCount(damage),
    unclearPhotos: assessments.filter((a) => a.needsManualReview).length,
  });
}
