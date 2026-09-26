"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { InsurancePolicy, type InsurancePolicyDoc } from "@/models/InsurancePolicy";
import { PastedPolicyTextSchema } from "@/schemas/policy";
import { analyzePolicy, NotAPolicyError, summarizePolicy } from "@/services/ai/policy-analysis";
import { getOpenIncident, refreshIncidentStatus } from "@/services/claims/state";
import { getProvider } from "@/services/insurance/providers";
import {
  createUpload,
  getObjectBytes,
  headObject,
  isOwnedKey,
  makeKey,
  putObject,
  validateUpload,
  type PresignedUpload,
} from "@/services/storage/s3";
import { requireVehicle } from "@/services/vehicles/context";
import type { ActionResult } from "@/types";

type Owner = Awaited<ReturnType<typeof requireVehicle>>;
type PolicyResult = ActionResult<{ policyId: string }>;

const READ_FAILED = "We couldn't read this policy. Tap Retry, or upload a clearer copy.";
const NOT_A_POLICY = "This doesn't look like an auto insurance policy. Upload your policy or declarations page.";
const NOT_FOUND = "We couldn't find that policy. Refresh and try again.";

const fail = (error: string) => ({ ok: false as const, error });
const objectId = z.string().refine((id) => isValidObjectId(id));
const providerId = z.string().refine((id) => Boolean(getProvider(id)), "Pick your insurer from the list.");

const UploadSchema = z.object({ contentType: z.string().max(100), size: z.number() });
const RegisterSchema = z.object({
  key: z.string().min(1).max(300),
  providerId,
  fileName: z.string().transform((s) => s.trim().slice(0, 120) || "policy.pdf"),
});
const PasteSchema = z.object({ providerId, text: PastedPolicyTextSchema });

export async function createPolicyUpload(
  vehicleId: string,
  input: { contentType: string; size: number },
): Promise<ActionResult<PresignedUpload>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  const parsed = UploadSchema.safeParse(input);
  if (!parsed.success) return fail("Please upload your policy as a PDF.");
  const invalid = validateUpload("policies", parsed.data.contentType, parsed.data.size);
  if (invalid) return fail(invalid);
  try {
    return { ok: true, data: await createUpload("policies", String(user._id), String(vehicle._id), parsed.data.contentType) };
  } catch (err) {
    console.error("createPolicyUpload", err);
    return fail("We couldn't start the upload. Check your connection and try again.");
  }
}

export async function registerPolicy(
  vehicleId: string,
  input: { key: string; providerId: string; fileName: string },
): Promise<PolicyResult> {
  const owner = await requireVehicle(vehicleId);
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) return fail("Pick your insurer, then upload your policy again.");
  const { key, fileName } = parsed.data;
  if (!isOwnedKey(key, "policies", String(owner.user._id), String(owner.vehicle._id))) {
    return fail("That upload didn't match this car. Please upload it again.");
  }
  const head = await headObject(key);
  if (!head) return fail("Your upload didn't finish. Check your connection and upload it again.");
  const invalid = validateUpload("policies", head.contentType ?? "", head.size ?? 0);
  if (invalid) return fail(invalid);
  return createAndAnalyze(owner, { providerId: parsed.data.providerId, s3Key: key, fileName });
}

export async function registerPolicyText(vehicleId: string, input: { providerId: string; text: string }): Promise<PolicyResult> {
  const owner = await requireVehicle(vehicleId);
  const parsed = PasteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Paste the full policy or declarations page.");
  const s3Key = makeKey("policies", String(owner.user._id), String(owner.vehicle._id), "text/plain");
  try {
    await putObject(s3Key, parsed.data.text, "text/plain; charset=utf-8");
  } catch (err) {
    console.error("registerPolicyText upload", err);
    return fail("We couldn't save your policy text. Check your connection and try again.");
  }
  return createAndAnalyze(owner, { providerId: parsed.data.providerId, s3Key, fileName: "Pasted policy text" });
}

export async function retryPolicyExtraction(vehicleId: string, policyId: string): Promise<PolicyResult> {
  const owner = await requireVehicle(vehicleId);
  if (!objectId.safeParse(policyId).success) return fail(NOT_FOUND);
  const policy = await InsurancePolicy.findOne({ _id: policyId, userId: owner.user._id, vehicleId: owner.vehicle._id });
  if (!policy) return fail(NOT_FOUND);
  policy.set({ status: "processing", error: undefined });
  await policy.save();
  return analyzeAndSave(owner, policy);
}

export async function updatePolicyProvider(vehicleId: string, policyId: string, newProviderId: string): Promise<ActionResult> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  const parsed = z.object({ policyId: objectId, providerId }).safeParse({ policyId, providerId: newProviderId });
  if (!parsed.success) return fail("Pick your insurer from the list.");
  const res = await InsurancePolicy.updateOne(
    { _id: parsed.data.policyId, userId: user._id, vehicleId: vehicle._id },
    { providerId: parsed.data.providerId },
  );
  if (!res.matchedCount) return fail(NOT_FOUND);
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

async function createAndAnalyze(owner: Owner, input: { providerId: string; s3Key: string; fileName: string }): Promise<PolicyResult> {
  const { user, vehicle } = owner;
  const policy = await InsurancePolicy.create({ ...input, userId: user._id, vehicleId: vehicle._id, status: "processing" });
  const incident = await getOpenIncident(user._id, vehicle._id);
  if (incident) {
    incident.insurancePolicyId = policy._id;
    await incident.save();
  }
  await refreshIncidentStatus(user._id, vehicle._id);
  return analyzeAndSave(owner, policy);
}

async function analyzeAndSave({ user, vehicle }: Owner, policy: HydratedDocument<InsurancePolicyDoc>): Promise<PolicyResult> {
  try {
    const bytes = await getObjectBytes(policy.s3Key);
    const extracted = await analyzePolicy(policy.s3Key.endsWith(".txt") ? { text: bytes.toString("utf8") } : { pdf: bytes });
    const summary = await summarizePolicy(extracted).catch((err) => {
      console.error("Policy summary failed", policy._id, err);
      return null;
    });
    policy.set({ extractedData: extracted, aiSummary: summary, status: "processed", error: undefined });
  } catch (err) {
    console.error("Policy extraction failed", policy._id, err);
    policy.set({ status: "failed", error: err instanceof NotAPolicyError ? NOT_A_POLICY : READ_FAILED });
  }
  await policy.save();
  await refreshIncidentStatus(user._id, vehicle._id);
  revalidatePath("/", "layout");
  return policy.status === "processed" ? { ok: true, data: { policyId: String(policy._id) } } : fail(policy.error ?? READ_FAILED);
}
