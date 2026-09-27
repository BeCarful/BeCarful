import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { NextResponse, type NextRequest } from "next/server";
import { InsurancePolicy } from "@/models/InsurancePolicy";
import { getViewUrl } from "@/services/storage/gcs";
import { requireVehicle } from "@/services/vehicles/context";

// Mints a fresh presigned URL per tap, so a long-open page never links to an expired one.
export async function GET(req: NextRequest) {
  const { user, vehicle } = await requireVehicle(req.nextUrl.searchParams.get("vehicleId") ?? "");
  const policyId = req.nextUrl.searchParams.get("policyId") ?? "";
  if (!isValidObjectId(policyId)) notFound();
  const policy = await InsurancePolicy.findOne({ _id: policyId, userId: user._id, vehicleId: vehicle._id });
  if (!policy) notFound();
  return NextResponse.redirect(await getViewUrl(policy.s3Key), 303);
}
