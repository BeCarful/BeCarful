"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { InsurancePolicy, type InsurancePolicyDoc } from "@/models/InsurancePolicy";
import { PastedPolicyTextSchema, PolicyExtractionSchema, type PolicyExtraction } from "@/schemas/policy";
import { checkCoverage } from "@/services/ai/coverage";
import { analyzePolicy, NotAPolicyError, summarizePolicy } from "@/services/ai/policy-analysis";
import { refreshIncidentStatus } from "@/services/claims/state";
import { FLORIDA_PLANS_RETRIEVED, getFloridaPlan, type FloridaPlan } from "@/services/insurance/florida-plans";
import { getProvider } from "@/services/insurance/providers";
import {
  createUpload,
  deleteObject,
  getObjectBytes,
  headObject,
  isOwnedKey,
  makeKey,
  putObject,
  validateUpload,
  type PresignedUpload,
} from "@/services/storage/gcs";
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
const replaces = objectId.optional();
const RegisterSchema = z.object({
  key: z.string().min(1).max(300),
  providerId,
  fileName: z.string().transform((s) => s.trim().slice(0, 120) || "policy.pdf"),
  replaces,
});
const PasteSchema = z.object({ providerId, text: PastedPolicyTextSchema, replaces });

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
  input: { key: string; providerId: string; fileName: string; replaces?: string },
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
  return createAndAnalyze(owner, { providerId: parsed.data.providerId, s3Key: key, fileName }, undefined, parsed.data.replaces);
}

export async function registerPolicyText(vehicleId: string, input: { providerId: string; text: string; replaces?: string }): Promise<PolicyResult> {
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
  return createAndAnalyze(owner, { providerId: parsed.data.providerId, s3Key, fileName: "Pasted policy text" }, undefined, parsed.data.replaces);
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

/** No policy document: use an example Florida configuration. Its text is stored as the "original" like a pasted policy. */
export async function chooseFloridaPlan(vehicleId: string, planId: string): Promise<PolicyResult> {
  const owner = await requireVehicle(vehicleId);
  const plan = getFloridaPlan(planId);
  if (!plan) return fail("Pick a plan from the list.");
  const insurer = getProvider(plan.providerId)?.name ?? plan.providerId;
  const s3Key = makeKey("policies", String(owner.user._id), String(owner.vehicle._id), "text/plain");
  try {
    await putObject(s3Key, planText(plan, insurer), "text/plain; charset=utf-8");
  } catch (err) {
    console.error("chooseFloridaPlan upload", err);
    return fail("We couldn't save that plan. Check your connection and try again.");
  }
  const extracted: PolicyExtraction = { provider: insurer, policyNumber: null, effectiveDates: null, premium: null, coveredVehicle: null, formNumbers: [], ...plan.coverage };
  return createAndAnalyze(owner, { providerId: plan.providerId, s3Key, fileName: `${insurer} ${plan.name} (Florida example)`, planId: plan.id }, extracted);
}

/** Re-runs the coverage agent for one policy (e.g. after it failed). */
export async function recheckCoverage(vehicleId: string, policyId: string): Promise<ActionResult> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  if (!objectId.safeParse(policyId).success) return fail(NOT_FOUND);
  const policy = await InsurancePolicy.findOne({ _id: policyId, userId: user._id, vehicleId: vehicle._id });
  const extracted = PolicyExtractionSchema.safeParse(policy?.extractedData);
  if (!policy || policy.status !== "processed" || !extracted.success) return fail("Add your policy first.");
  const checklist = await runCoverage({ user, vehicle }, policy.providerId, extracted.data);
  if (!checklist) return fail("We couldn't check your coverage just now. Try again in a moment.");
  policy.set({ coverageChecklist: checklist });
  await policy.save();
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function removePolicy(vehicleId: string, policyId: string): Promise<ActionResult> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  if (!objectId.safeParse(policyId).success) return fail(NOT_FOUND);
  const policy = await InsurancePolicy.findOneAndDelete({ _id: policyId, userId: user._id, vehicleId: vehicle._id });
  if (!policy) return fail(NOT_FOUND);
  await deleteObject(policy.s3Key).catch((err) => console.error("removePolicy object", policy.s3Key, err));
  await refreshIncidentStatus(user._id, vehicle._id);
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

function planText(plan: FloridaPlan, insurer: string) {
  const c = plan.coverage;
  const line = (label: string, v: string | null) => `${label}: ${v ?? "Not included"}`;
  return [
    `${insurer}: ${plan.name}. Example Florida configuration, not a quote and not your actual policy.`,
    plan.summary,
    line("Policy type", c.policyType),
    line("Liability", c.liability),
    line("Collision", c.collision),
    line("Comprehensive", c.comprehensive),
    line("Deductibles", c.deductibles),
    line("Rental reimbursement", c.rentalReimbursement),
    line("Roadside assistance", c.roadsideAssistance),
    `Other coverage:\n${c.otherCoverage.map((o) => `- ${o}`).join("\n") || "- None"}`,
    `Limitations:\n${c.exclusions.map((e) => `- ${e}`).join("\n") || "- None listed"}`,
    `Sources (retrieved ${FLORIDA_PLANS_RETRIEVED}):\n${plan.sources.map((src) => `- ${src.title}: ${src.url}`).join("\n")}`,
  ].join("\n\n");
}

async function runCoverage({ user, vehicle }: Pick<Owner, "user" | "vehicle">, providerId: string, extraction: PolicyExtraction) {
  try {
    const items = await checkCoverage({ userId: String(user._id), vehicleState: vehicle.state, insurer: getProvider(providerId)?.name ?? null, extraction });
    return { items, generatedAt: new Date() };
  } catch (err) {
    console.error("checkCoverage", err);
    return null;
  }
}

async function createAndAnalyze(
  owner: Owner,
  input: { providerId: string; s3Key: string; fileName: string; planId?: string },
  known?: PolicyExtraction,
  replaces?: string,
): Promise<PolicyResult> {
  const { user, vehicle } = owner;
  const fresh = { ...input, planId: input.planId ?? null, uploadedAt: new Date(), status: "processing" as const, extractedData: null, aiSummary: null, coverageChecklist: null, error: undefined };
  let policy;
  if (replaces) {
    policy = await InsurancePolicy.findOne({ _id: replaces, userId: user._id, vehicleId: vehicle._id });
    if (!policy) return fail(NOT_FOUND);
    const oldKey = policy.s3Key;
    policy.set(fresh);
    await policy.save();
    if (oldKey !== input.s3Key) await deleteObject(oldKey).catch((err) => console.error("replace policy object", oldKey, err));
  } else {
    policy = await InsurancePolicy.create({ ...fresh, userId: user._id, vehicleId: vehicle._id });
  }
  await refreshIncidentStatus(user._id, vehicle._id);
  return analyzeAndSave(owner, policy, known);
}

async function analyzeAndSave(
  { user, vehicle }: Owner,
  policy: HydratedDocument<InsurancePolicyDoc>,
  known?: PolicyExtraction,
): Promise<PolicyResult> {
  try {
    let extracted = known;
    if (!extracted) {
      const bytes = await getObjectBytes(policy.s3Key);
      extracted = await analyzePolicy(policy.s3Key.endsWith(".txt") ? { text: bytes.toString("utf8") } : { pdf: bytes });
    }
    const [summary, checklist] = await Promise.all([
      summarizePolicy(extracted).catch((err) => {
        console.error("Policy summary failed", policy._id, err);
        return null;
      }),
      runCoverage({ user, vehicle }, policy.providerId, extracted),
    ]);
    policy.set({ extractedData: extracted, aiSummary: summary, coverageChecklist: checklist, status: "processed", error: undefined });
  } catch (err) {
    console.error("Policy extraction failed", policy._id, err);
    policy.set({ status: "failed", error: err instanceof NotAPolicyError ? NOT_A_POLICY : READ_FAILED });
  }
  await policy.save();
  await refreshIncidentStatus(user._id, vehicle._id);
  revalidatePath("/", "layout");
  return policy.status === "processed" ? { ok: true, data: { policyId: String(policy._id) } } : fail(policy.error ?? READ_FAILED);
}
