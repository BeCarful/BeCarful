"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ChatMessage } from "@/models/ChatMessage";
import { DamageAssessment } from "@/models/DamageAssessment";
import { DamagePhoto } from "@/models/DamagePhoto";
import { Incident } from "@/models/Incident";
import { InsurancePolicy } from "@/models/InsurancePolicy";
import { Vehicle } from "@/models/Vehicle";
import { VehicleInputSchema } from "@/schemas/vehicle";
import { deleteVehicleObjects } from "@/services/storage/gcs";
import { carModel } from "@/services/vehicles/car-models";
import { requireVehicle } from "@/services/vehicles/context";
import type { ActionResult } from "@/types";

export type VehicleFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

export async function createVehicle(_: VehicleFormState, fd: FormData): Promise<VehicleFormState> {
  const user = await requireUser();
  const values = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = VehicleInputSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }
  const { year, make, model } = carModel(parsed.data.modelId);
  const vehicle = await Vehicle.create({ ...parsed.data, year, make, model, userId: user._id });
  user.lastVehicleId = vehicle._id;
  await user.save();
  revalidatePath("/", "layout");
  redirect("/insurance");
}

export async function selectVehicle(vehicleId: string) {
  const { user, vehicle } = await requireVehicle(vehicleId);
  user.lastVehicleId = vehicle._id;
  await user.save();
  revalidatePath("/", "layout");
}

/** Removes the vehicle and everything scoped to it. Files go first so a failure leaves nothing orphaned and a retry finishes the job. */
export async function deleteVehicle(vehicleId: string): Promise<ActionResult> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  const scope = { userId: user._id, vehicleId: vehicle._id };
  try {
    await deleteVehicleObjects(String(user._id), String(vehicle._id));
    await Promise.all([
      DamageAssessment.deleteMany(scope),
      DamagePhoto.deleteMany(scope),
      Incident.deleteMany(scope),
      InsurancePolicy.deleteMany(scope),
      ChatMessage.deleteMany(scope),
    ]);
    await Vehicle.deleteOne({ _id: vehicle._id, userId: user._id });
    if (user.lastVehicleId?.equals(vehicle._id)) {
      const next = await Vehicle.findOne({ userId: user._id }).sort({ createdAt: -1 }).select("_id");
      user.lastVehicleId = next?._id ?? null;
      await user.save();
    }
  } catch (err) {
    console.error("deleteVehicle", err);
    return { ok: false, error: "We couldn't remove this vehicle. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
