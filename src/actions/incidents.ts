"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOpenIncident, loadClaimState, refreshIncidentStatus } from "@/services/claims/state";
import { requireVehicle } from "@/services/vehicles/context";
import { INCIDENT_TYPES, type ActionResult } from "@/types";

const IncidentInfoSchema = z.object({
  type: z.enum(INCIDENT_TYPES, "Pick what happened."),
  occurredAt: z.coerce
    .date("Pick when it happened.")
    .refine((d) => d.getTime() <= Date.now() + 10 * 60_000, "That time is in the future. Pick when it happened."),
  location: z.string("Add where it happened.").trim().min(2, "Add where it happened.").max(200, "Keep the location short."),
  notes: z.string().trim().max(2000, "Keep notes under 2000 characters.").optional(),
});

export type IncidentInfoInput = z.input<typeof IncidentInfoSchema>;

const SAVE_FAILED = "Couldn't save. Check your connection and try again.";

export async function updateIncidentInfo(vehicleId: string, input: IncidentInfoInput): Promise<ActionResult> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  const parsed = IncidentInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const incident = await getOpenIncident(user._id, vehicle._id);
    if (!incident) return { ok: false, error: "No open incident. Take a photo of the damage to start one." };
    incident.set({ ...parsed.data, notes: parsed.data.notes ?? "" });
    await incident.save();
    await refreshIncidentStatus(user._id, vehicle._id);
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function markClaimFiled(vehicleId: string): Promise<ActionResult> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  try {
    const { incident, todos } = await loadClaimState(user._id, vehicle._id);
    if (!incident || todos.filed || !todos.readyToFile) {
      return { ok: false, error: "You're not ready to file yet. Finish the to-do list first." };
    }
    incident.set({ status: "filed", filedAt: new Date() });
    await incident.save();
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function closeIncident(vehicleId: string): Promise<ActionResult> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  try {
    const incident = await getOpenIncident(user._id, vehicle._id);
    if (incident?.status !== "filed") return { ok: false, error: "File your claim before closing the incident." };
    incident.status = "closed";
    await incident.save();
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
