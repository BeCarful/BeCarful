"use server";

import { isValidObjectId } from "mongoose";
import { ChatMessage } from "@/models/ChatMessage";
import { requireUser } from "@/lib/auth";
import { agentTool } from "@/services/ai/agent-tools";
import { recentMessages, toChatView, type ChatMessageView } from "@/services/ai/chat";
import { MAX_SPEECH_BYTES, transcribe } from "@/services/ai/voice";
import { requireVehicle } from "@/services/vehicles/context";
import type { ActionResult } from "@/types";

export async function loadChat(vehicleId: string): Promise<ActionResult<ChatMessageView[]>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  try {
    return { ok: true, data: await recentMessages(user._id, vehicle._id, 30) };
  } catch (err) {
    console.error("loadChat", err);
    return { ok: false, error: "Couldn't load the chat. Check your connection and try again." };
  }
}

export async function transcribeSpeech(form: FormData): Promise<ActionResult<string>> {
  await requireUser();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || !audio.type.startsWith("audio/")) return { ok: false, error: "I didn't catch that. Tap the mic and try again." };
  if (audio.size > MAX_SPEECH_BYTES) return { ok: false, error: "That was a bit long for me. Try a shorter question." };
  try {
    const text = (await transcribe(audio)).slice(0, 1000);
    return text ? { ok: true, data: text } : { ok: false, error: "I didn't catch that. Tap the mic and try again." };
  } catch (err) {
    console.error("transcribeSpeech", err);
    return { ok: false, error: "Voice isn't working right now. Type your question instead." };
  }
}

/** The user's tap on a proposed write. Runs it at most once. */
export async function resolveChatAction(vehicleId: string, messageId: string, approve: boolean): Promise<ActionResult<ChatMessageView>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  if (!isValidObjectId(messageId)) return { ok: false, error: "That action is no longer available." };
  const scope = { userId: user._id, vehicleId: vehicle._id };
  const msg = await ChatMessage.findOneAndUpdate(
    { _id: messageId, ...scope, role: "assistant", "action.status": "pending" },
    { "action.status": approve ? "running" : "cancelled" },
    { new: true },
  );
  if (!msg?.action) return { ok: false, error: "That action already ran or expired. Ask again if you still need it." };
  if (!approve) return { ok: true, data: toChatView(msg) };

  const tool = agentTool(msg.action.tool);
  const args = tool?.parameters.safeParse(msg.action.args);
  let result: unknown;
  try {
    result = tool && args?.success ? await tool.run(scope, args.data as never) : { ok: false, error: "That action isn't available anymore." };
  } catch (err) {
    console.error("resolveChatAction", msg.action.tool, err);
    result = { ok: false, error: "That didn't work. Try again in a moment." };
  }
  const failed = (result as { ok?: boolean } | null)?.ok === false;
  msg.action.status = failed ? "failed" : "done";
  msg.action.result = failed ? String((result as { error?: string }).error ?? "That didn't work.") : "Done";
  await msg.save();
  return { ok: true, data: toChatView(msg) };
}
