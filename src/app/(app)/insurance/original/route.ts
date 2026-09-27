import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { getActivePolicy } from "@/services/claims/state";
import { getViewUrl } from "@/services/storage/gcs";
import { requireVehicle } from "@/services/vehicles/context";

// Mints a fresh presigned URL per tap, so a long-open page never links to an expired one.
export async function GET(req: NextRequest) {
  const { user, vehicle } = await requireVehicle(req.nextUrl.searchParams.get("vehicleId") ?? "");
  const policy = await getActivePolicy(user._id, vehicle._id);
  if (!policy) notFound();
  return NextResponse.redirect(await getViewUrl(policy.s3Key), 303);
}
