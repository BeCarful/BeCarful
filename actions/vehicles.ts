"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicle } from "@/models/Vehicle";
import { VehicleInputSchema } from "@/schemas/vehicle";
import { requireVehicle } from "@/services/vehicles/context";

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
  const vehicle = await Vehicle.create({ ...parsed.data, userId: user._id });
  user.lastVehicleId = vehicle._id;
  await user.save();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function selectVehicle(vehicleId: string) {
  const { user, vehicle } = await requireVehicle(vehicleId);
  user.lastVehicleId = vehicle._id;
  await user.save();
  revalidatePath("/", "layout");
}
