import "server-only";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireUser } from "@/lib/auth";
import { Vehicle } from "@/models/Vehicle";

/** Signed-in user, their vehicles, and the selected one (last-selected, else newest). */
export async function getVehicleContext() {
  const user = await requireUser();
  const vehicles = await Vehicle.find({ userId: user._id }).sort({ createdAt: -1 });
  const selected = vehicles.find((v) => user.lastVehicleId && v._id.equals(user.lastVehicleId)) ?? vehicles[0] ?? null;
  return { user, vehicles, selected };
}

/**
 * Ownership gate for every vehicle-scoped action/page. Always pass the vehicleId the
 * client is acting on (not the server-side selection) so another tab can't retarget it.
 */
export async function requireVehicle(vehicleId: string) {
  const user = await requireUser();
  if (!isValidObjectId(vehicleId)) notFound();
  const vehicle = await Vehicle.findOne({ _id: vehicleId, userId: user._id });
  if (!vehicle) notFound();
  return { user, vehicle };
}

export function vehicleTitle(v: { year: number; make: string; model: string; trim?: string | null }) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}
