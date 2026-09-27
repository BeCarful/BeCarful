import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import { z } from "zod";
import { closeIncident, markClaimFiled, updateIncidentInfo } from "@/actions/incidents";
import { chooseFloridaPlan, updatePolicyProvider } from "@/actions/insurance";
import { deletePhoto } from "@/actions/photos";
import { selectVehicle } from "@/actions/vehicles";
import { Vehicle } from "@/models/Vehicle";
import { getActivePolicy, getOpenIncident, loadClaimState } from "@/services/claims/state";
import { FLORIDA_PLANS, getFloridaPlan } from "@/services/insurance/florida-plans";
import { PROVIDERS, getProvider } from "@/services/insurance/providers";
import { vehicleTitle } from "@/services/vehicles/context";
import { INCIDENT_TYPES, PERIL_LABELS } from "@/types";
import { buildVehicleContext } from "./chat";
import type { CoverageItem } from "./coverage-rules";
import type { ToolKind } from "./guard";

export type ToolScope = { userId: Types.ObjectId; vehicleId: Types.ObjectId };

export type AgentTool = {
  name: string;
  description: string;
  kind: ToolKind;
  parameters: z.ZodObject;
  run: (scope: ToolScope, args: never) => Promise<unknown>;
  /** Button label for a write that waits for the user's tap. */
  describe?: (scope: ToolScope, args: never) => Promise<string>;
};

const tool = <P extends z.ZodObject>(t: {
  name: string;
  description: string;
  kind: ToolKind;
  parameters: P;
  run: (scope: ToolScope, args: z.infer<P>) => Promise<unknown>;
  describe?: (scope: ToolScope, args: z.infer<P>) => Promise<string>;
}) => t as unknown as AgentTool;

const vehicleArg = z.string().optional().describe("vehicleId from list_vehicles. Omit for the vehicle this chat is about.");
const NO_VEHICLE = { ok: false, error: "That vehicle isn't in this user's garage." };

/** Every vehicle lookup is scoped to the signed-in user. */
async function target(scope: ToolScope, vehicleId?: string) {
  const id = vehicleId ?? String(scope.vehicleId);
  return isValidObjectId(id) ? Vehicle.findOne({ _id: id, userId: scope.userId }) : null;
}

async function named(scope: ToolScope, vehicleId: string | undefined, text: (name: string) => string) {
  const v = await target(scope, vehicleId);
  return text(v ? vehicleTitle(v) : "this vehicle");
}

export const AGENT_TOOLS: AgentTool[] = [
  tool({
    name: "list_vehicles",
    description: "Lists the user's vehicles with their ids.",
    kind: "read",
    parameters: z.object({}),
    run: async (scope) => {
      const vehicles = await Vehicle.find({ userId: scope.userId }).sort({ createdAt: -1 });
      return {
        vehicles: vehicles.map((v) => ({
          vehicleId: String(v._id),
          name: vehicleTitle(v),
          color: v.color,
          plate: `${v.licensePlate} (${v.state})`,
          isThisChat: v._id.equals(scope.vehicleId),
        })),
      };
    },
  }),
  tool({
    name: "get_vehicle_status",
    description: "Full current facts for one vehicle: insurer, policy details, coverage checklist, photos, detected damage, open incident and to-do list.",
    kind: "read",
    parameters: z.object({ vehicleId: vehicleArg }),
    run: async (scope, { vehicleId }) => {
      const v = await target(scope, vehicleId);
      if (!v) return NO_VEHICLE;
      const policy = await getActivePolicy(scope.userId, v._id);
      const checklist = (policy?.coverageChecklist as { items?: CoverageItem[] } | null)?.items;
      return {
        ...JSON.parse(await buildVehicleContext(scope.userId, v._id)),
        coverageChecklist: checklist?.map((i) => ({ risk: PERIL_LABELS[i.peril], status: i.status, detail: i.detail, law: i.law?.citation })) ?? "Not checked yet",
      };
    },
  }),
  tool({
    name: "list_photos",
    description: "Photos of the vehicle's open incident with ids, source, date and what the AI found in each.",
    kind: "read",
    parameters: z.object({ vehicleId: vehicleArg }),
    run: async (scope, { vehicleId }) => {
      const v = await target(scope, vehicleId);
      if (!v) return NO_VEHICLE;
      const { photos, assessments } = await loadClaimState(scope.userId, v._id);
      return {
        photos: photos.map((p) => ({
          photoId: String(p._id),
          source: p.source === "camera" ? "taken with camera" : "uploaded",
          date: (p.capturedAt ?? p.serverReceivedAt ?? p.createdAt)?.toISOString().slice(0, 10),
          analysisStatus: p.analysisStatus,
          aiFinding: assessments.find((a) => a.photoId.equals(p._id))?.summary ?? null,
        })),
      };
    },
  }),
  tool({
    name: "list_florida_plans",
    description: "Example Florida auto insurance configurations per insurer, built from Florida law and each insurer's own pages (not price quotes).",
    kind: "read",
    parameters: z.object({ providerId: z.enum(PROVIDERS.map((p) => p.id) as [string, ...string[]]).optional() }),
    run: async (_scope, { providerId }) => ({
      plans: FLORIDA_PLANS.filter((p) => !providerId || p.providerId === providerId).map((p) => ({
        planId: p.id,
        insurer: getProvider(p.providerId)?.name,
        name: p.name,
        summary: p.summary,
        coverage: p.coverage,
      })),
    }),
  }),
  tool({
    name: "update_incident_details",
    description: "Saves what happened, when and where for the vehicle's open incident. Only pass fields the user gave you.",
    kind: "write",
    parameters: z.object({
      vehicleId: vehicleArg,
      type: z.enum(INCIDENT_TYPES).optional(),
      occurredAt: z.string().optional().describe("ISO 8601 date-time, e.g. 2026-09-25T14:30:00-04:00"),
      location: z.string().max(200).optional(),
      notes: z.string().max(2000).optional(),
    }),
    run: async (scope, { vehicleId, ...patch }) => {
      const v = await target(scope, vehicleId);
      if (!v) return NO_VEHICLE;
      const incident = await getOpenIncident(scope.userId, v._id);
      if (!incident) return { ok: false, error: "No open incident yet. The user needs to take a photo of the damage first." };
      return updateIncidentInfo(String(v._id), {
        type: patch.type ?? incident.type ?? undefined,
        occurredAt: patch.occurredAt ?? incident.occurredAt?.toISOString(),
        location: patch.location ?? incident.location ?? undefined,
        notes: patch.notes ?? incident.notes ?? undefined,
      } as Parameters<typeof updateIncidentInfo>[1]);
    },
    describe: (scope, a) =>
      named(scope, a.vehicleId, (n) => `Save incident details for ${n}: ${[a.type, a.occurredAt, a.location, a.notes].filter(Boolean).join(", ")}`),
  }),
  tool({
    name: "switch_vehicle",
    description: "Switches the app to another of the user's vehicles.",
    kind: "write",
    parameters: z.object({ vehicleId: z.string() }),
    run: async (scope, { vehicleId }) => {
      const v = await target(scope, vehicleId);
      if (!v) return NO_VEHICLE;
      await selectVehicle(String(v._id));
      return { ok: true, note: "The app now shows this vehicle. This chat thread stays with the previous one." };
    },
    describe: (scope, a) => named(scope, a.vehicleId, (n) => `Switch to ${n}`),
  }),
  tool({
    name: "choose_florida_plan",
    description: "Sets one of the example Florida plans (planId from list_florida_plans) as the vehicle's insurance when the user has no policy document.",
    kind: "write",
    parameters: z.object({ planId: z.string(), vehicleId: vehicleArg }),
    run: async (scope, { planId, vehicleId }) => {
      const v = await target(scope, vehicleId);
      if (!v) return NO_VEHICLE;
      return chooseFloridaPlan(String(v._id), planId);
    },
    describe: async (scope, a) => {
      const plan = getFloridaPlan(a.planId);
      return named(scope, a.vehicleId, (n) => `Use ${getProvider(plan?.providerId)?.name ?? ""} ${plan?.name ?? a.planId} for ${n}`);
    },
  }),
  tool({
    name: "set_insurer",
    description: "Changes which insurer the vehicle's current policy belongs to.",
    kind: "write",
    parameters: z.object({ providerId: z.enum(PROVIDERS.map((p) => p.id) as [string, ...string[]]), vehicleId: vehicleArg }),
    run: async (scope, { providerId, vehicleId }) => {
      const v = await target(scope, vehicleId);
      if (!v) return NO_VEHICLE;
      const policy = await getActivePolicy(scope.userId, v._id);
      if (!policy) return { ok: false, error: "No policy yet. Upload one or choose a Florida plan first." };
      return updatePolicyProvider(String(v._id), String(policy._id), providerId);
    },
    describe: (scope, a) => named(scope, a.vehicleId, (n) => `Set ${getProvider(a.providerId)?.name} as the insurer for ${n}`),
  }),
  tool({
    name: "mark_claim_filed",
    description: "Marks the open incident's claim as filed with the insurer. Only after the user says they filed it.",
    kind: "destructive",
    parameters: z.object({ vehicleId: vehicleArg }),
    run: async (scope, { vehicleId }) => {
      const v = await target(scope, vehicleId);
      return v ? markClaimFiled(String(v._id)) : NO_VEHICLE;
    },
    describe: (scope, a) => named(scope, a.vehicleId, (n) => `Mark the claim for ${n} as filed`),
  }),
  tool({
    name: "close_incident",
    description: "Closes a filed incident. The next photo starts a new one.",
    kind: "destructive",
    parameters: z.object({ vehicleId: vehicleArg }),
    run: async (scope, { vehicleId }) => {
      const v = await target(scope, vehicleId);
      return v ? closeIncident(String(v._id)) : NO_VEHICLE;
    },
    describe: (scope, a) => named(scope, a.vehicleId, (n) => `Close the incident for ${n}`),
  }),
  tool({
    name: "delete_photo",
    description: "Permanently deletes one photo (photoId from list_photos) and its AI result.",
    kind: "destructive",
    parameters: z.object({ photoId: z.string(), vehicleId: vehicleArg }),
    run: async (scope, { photoId, vehicleId }) => {
      const v = await target(scope, vehicleId);
      return v ? deletePhoto(String(v._id), photoId) : NO_VEHICLE;
    },
    describe: (scope, a) => named(scope, a.vehicleId, (n) => `Permanently delete this photo of ${n}`),
  }),
];

export const agentTool = (name: string) => AGENT_TOOLS.find((t) => t.name === name);
