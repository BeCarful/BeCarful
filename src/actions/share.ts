"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { DamagePhoto } from "@/models/DamagePhoto";
import { EvidenceShare } from "@/models/EvidenceShare";
import { getOpenIncident } from "@/services/claims/state";
import { MAX_LIVE_SHARES } from "@/services/share/evidence";
import { newShareToken } from "@/services/share/token";
import { requireVehicle } from "@/services/vehicles/context";
import { SHARE_DAYS, type ActionResult } from "@/types";

const ShareSchema = z.object({
  label: z.string().trim().max(80, "Keep it under 80 characters.").optional(),
  days: z.literal(SHARE_DAYS, "Pick how long the link works."),
});

const SAVE_FAILED = "Couldn't save. Check your connection and try again.";

export async function createShareLink(
  vehicleId: string,
  input: z.input<typeof ShareSchema>,
): Promise<ActionResult<{ id: string; token: string; expiresAt: string }>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  const parsed = ShareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const incident = await getOpenIncident(user._id, vehicle._id);
    const scope = { userId: user._id, vehicleId: vehicle._id, incidentId: incident?._id };
    if (!incident || !(await DamagePhoto.exists(scope))) return { ok: false, error: "Take photos of the damage first." };
    if ((await EvidenceShare.countDocuments({ ...scope, expiresAt: { $gt: new Date() } })) >= MAX_LIVE_SHARES) {
      return { ok: false, error: `You can have ${MAX_LIVE_SHARES} links at once. Stop sharing one first.` };
    }
    const { token, tokenHash } = newShareToken();
    const expiresAt = new Date(Date.now() + parsed.data.days * 24 * 60 * 60_000);
    const share = await EvidenceShare.create({ ...scope, tokenHash, label: parsed.data.label || undefined, expiresAt });
    revalidatePath("/summary");
    return { ok: true, data: { id: share._id.toString(), token, expiresAt: expiresAt.toISOString() } };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

export async function stopShareLink(vehicleId: string, shareId: string): Promise<ActionResult> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  if (!isValidObjectId(shareId)) return { ok: false, error: "That link no longer exists." };
  try {
    await EvidenceShare.deleteOne({ _id: shareId, userId: user._id, vehicleId: vehicle._id });
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
  revalidatePath("/summary");
  return { ok: true, data: undefined };
}
