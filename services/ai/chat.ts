import "server-only";
import type { Content } from "@google/genai";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ChatMessage } from "@/models/ChatMessage";
import { Vehicle } from "@/models/Vehicle";
import { PolicyExtractionSchema } from "@/schemas/policy";
import { loadClaimState } from "@/services/claims/state";
import { MIN_DAMAGE_PHOTOS } from "@/services/claims/todos";
import { vehicleTitle } from "@/services/vehicles/context";
import { NOT_FOUND_IN_POLICY, componentLabel } from "@/types";
import { ASSISTANT_NAME } from "@/components/chat/TuxemonAssistant";
import { gemini, geminiModel } from "./gemini";

type Id = Types.ObjectId | string;

const HISTORY_FOR_MODEL = 20;

export type ChatMessageView = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

type MessageLike = { _id: Types.ObjectId; role: "user" | "assistant"; content: string; createdAt: Date };

export function toChatView(m: MessageLike): ChatMessageView {
  return { id: m._id.toString(), role: m.role, content: m.content, createdAt: m.createdAt.toISOString() };
}

/** Newest `limit` messages of this user's thread for this vehicle, oldest first. */
export async function recentMessages(userId: Id, vehicleId: Id, limit: number): Promise<ChatMessageView[]> {
  await connectDB();
  const docs = await ChatMessage.find({ userId, vehicleId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean<MessageLike[]>();
  return docs.reverse().map(toChatView);
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "not recorded");

/** Compact JSON facts about one vehicle. Everything is scoped by owner + vehicle. */
export async function buildVehicleContext(userId: Id, vehicleId: Id): Promise<string> {
  await connectDB();
  const [vehicle, claim] = await Promise.all([Vehicle.findOne({ _id: vehicleId, userId }), loadClaimState(userId, vehicleId)]);
  if (!vehicle) throw new Error("Vehicle not found for this user");
  const { policy, provider, incident, photos, assessments, damage, todos } = claim;
  const extracted = PolicyExtractionSchema.safeParse(policy?.extractedData);

  return JSON.stringify({
    vehicle: {
      name: vehicleTitle(vehicle),
      color: vehicle.color,
      licensePlate: `${vehicle.licensePlate} (${vehicle.state})`,
      vinLast4: vehicle.vin ? vehicle.vin.slice(-4) : "not provided",
    },
    insurer: provider
      ? { name: provider.name, claimsPhone: provider.phone, claimsUrl: provider.claimsUrl }
      : "No insurer on file yet. The user can add their policy from the Insurance button on Home.",
    policy: policy
      ? {
          status: policy.status,
          uploadedAt: day(policy.uploadedAt),
          plainSummary: policy.aiSummary ?? "Not available yet",
          details: extracted.success
            ? Object.fromEntries(
                Object.entries(extracted.data).map(([k, v]) => [k, Array.isArray(v) ? (v.length ? v : NOT_FOUND_IN_POLICY) : (v ?? NOT_FOUND_IN_POLICY)]),
              )
            : "Policy details have not been extracted yet",
        }
      : "No policy uploaded yet",
    photosForCurrentIncident: {
      total: photos.length,
      takenWithCamera: photos.filter((p) => p.source === "camera").length,
      uploadedFromDevice: photos.filter((p) => p.source === "upload").length,
      withLocationRecorded: photos.filter((p) => p.latitude != null && p.longitude != null).length,
      stillAnalyzingOrFailed: photos.filter((p) => p.analysisStatus !== "done").length,
      recommendedMinimumForDamage: MIN_DAMAGE_PHOTOS,
    },
    detectedDamage: damage.length
      ? damage.map((d) => ({
          part: componentLabel(d.component),
          severity: d.severity,
          types: d.damageTypes,
          aiConfidence: `${Math.round(d.confidence * 100)}%`,
          description: d.description,
          photos: d.photoIds.length,
        }))
      : photos.length
        ? "No damage detected in analyzed photos"
        : "No photos yet",
    damageNeedsManualReview: assessments.some((a) => a.needsManualReview),
    currentIncident: incident
      ? {
          type: incident.type ?? "not recorded",
          date: day(incident.occurredAt),
          location: incident.location || "not recorded",
          notes: incident.notes || "none",
          status: incident.status,
        }
      : "No open incident",
    todoList: todos.items.map((t) => `${t.done ? "[done]" : "[todo]"} ${t.title}${t.detail ? ` (${t.detail})` : ""}`),
    readyToFileClaim: todos.readyToFile,
    claimFiled: todos.filed,
  });
}

const SYSTEM_PROMPT = `You are ${ASSISTANT_NAME}, a friendly Tuxemon companion inside BeCarful, a car insurance helper app. You help the user with ONE vehicle only: the one in VEHICLE CONTEXT below.

Rules:
- Be concise: at most 3 short sentences, or a short list with "- " bullets. Plain text only: no markdown headings, bold, tables or link syntax.
- Warm and calm, never childish. The user may be standing next to a damaged car.
- If anyone might be hurt or in danger, tell them to get to safety and call 911 before anything else.
- Use only facts from VEHICLE CONTEXT and this conversation. Never invent policy terms, amounts, dates, damage or next steps.
- Coverage: only repeat what the policy data clearly says. If something is missing or unclear, say "${NOT_FOUND_IN_POLICY}" and suggest confirming with the insurer by phone. Never promise that something is covered or that a claim will be paid.
- Claims: only give the insurer's claimsUrl and claimsPhone exactly as written in VEHICLE CONTEXT. Never make up, guess or change a URL or phone number. The Summary tab also has a verified Start Claim button.
- Only discuss this vehicle. If asked about another vehicle, tell the user to switch vehicles with the selector at the top of the screen.
- No legal advice. For fault, lawsuits or injuries, suggest the insurer or a licensed professional.
- Detected damage comes from AI photo analysis and can be wrong; mention that when it matters.
- In the app: Take Photo / Upload Photo and Insurance are on the Home tab; progress, to-dos and the claim link are on the Summary tab.`;

/** Gemini wants alternating turns starting with the user: merge repeats, drop a leading model turn. */
function toGeminiContents(history: Pick<ChatMessageView, "role" | "content">[]): Content[] {
  const contents: Content[] = [];
  for (const m of history) {
    const role = m.role === "user" ? "user" : "model";
    const prev = contents.at(-1);
    if (prev?.role === role) prev.parts?.push({ text: m.content });
    else if (contents.length || role === "user") contents.push({ role, parts: [{ text: m.content }] });
  }
  return contents;
}

/** Answers the latest user message in this user's thread for this vehicle. */
export async function generateReply(userId: Id, vehicleId: Id): Promise<string> {
  const [history, context] = await Promise.all([
    recentMessages(userId, vehicleId, HISTORY_FOR_MODEL),
    buildVehicleContext(userId, vehicleId),
  ]);

  const contents = toGeminiContents(history);
  if (contents.at(-1)?.role !== "user") throw new Error("No user message to answer");

  const res = await gemini().models.generateContent({
    model: geminiModel(),
    contents,
    config: { systemInstruction: `${SYSTEM_PROMPT}\n\nVEHICLE CONTEXT (JSON):\n${context}`, temperature: 0.4 },
  });
  const text = res.text?.trim();
  if (!text) throw new Error("Empty reply from Gemini");
  return text;
}
