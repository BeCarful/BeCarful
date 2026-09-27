import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { DamageAssessment } from "@/models/DamageAssessment";
import { DamagePhoto } from "@/models/DamagePhoto";
import { Incident } from "@/models/Incident";
import { InsurancePolicy } from "@/models/InsurancePolicy";
import { getProvider } from "@/services/insurance/providers";
import type { DamagedComponent } from "@/types";
import { aggregateDamage } from "./damage";
import { claimPolicy, policiesStatus } from "./policies";
import { computeTodos, nextIncidentStatus, type ClaimState } from "./todos";

type Id = Types.ObjectId | string;

export const getPolicies = (userId: Id, vehicleId: Id) => InsurancePolicy.find({ userId, vehicleId }).sort({ uploadedAt: 1 });

/** The open incident is the newest one that isn't closed. */
export const getOpenIncident = (userId: Id, vehicleId: Id) =>
  Incident.findOne({ userId, vehicleId, status: { $ne: "closed" } }).sort({ createdAt: -1 });

export async function getOrCreateOpenIncident(userId: Id, vehicleId: Id) {
  const open = await getOpenIncident(userId, vehicleId);
  if (open) return open;
  return Incident.create({ userId, vehicleId, status: "documenting" });
}

/** Everything the summary, to-dos and chat need for one vehicle, scoped by owner + vehicle. */
export async function loadClaimState(userId: Id, vehicleId: Id) {
  await connectDB();
  const [policies, incident] = await Promise.all([getPolicies(userId, vehicleId), getOpenIncident(userId, vehicleId)]);
  const [photos, assessments] = incident
    ? await Promise.all([
        DamagePhoto.find({ userId, vehicleId, incidentId: incident._id }).sort({ createdAt: -1 }),
        DamageAssessment.find({ userId, vehicleId, incidentId: incident._id }),
      ])
    : [[], []];
  const damage = aggregateDamage(
    assessments.map((a) => ({ photoId: a.photoId, damagedComponents: a.damagedComponents as DamagedComponent[] })),
  );
  const policy = claimPolicy(policies, incident?.type);
  const provider = getProvider(policy?.providerId);
  const state: ClaimState = {
    policyStatus: policiesStatus(policies),
    providerName: provider?.name ?? null,
    photoCount: photos.length,
    damage,
    incident: incident
      ? { type: incident.type, occurredAt: incident.occurredAt, location: incident.location, status: incident.status }
      : null,
  };
  const todos = computeTodos(state);
  return { state, todos, policies, policy, provider, incident, photos, assessments, damage };
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
