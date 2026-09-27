"use server";

import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { ChatMessage } from "@/models/ChatMessage";
import { assistantById } from "@/components/chat/assistants";
import { requireUser } from "@/lib/auth";
import { agentTool } from "@/services/ai/agent-tools";
import { chatSubjects, recentMessages, toChatView, type ChatMessageView, type ChatSubject } from "@/services/ai/chat";
import { runChatAgent } from "@/services/ai/chat-agent";
import { MAX_SPEECH_BYTES, transcribe } from "@/services/ai/voice";
import { requireVehicle } from "@/services/vehicles/context";
import type { ActionResult } from "@/types";

const MessageText = z.string().trim().min(1, "Type a question first.").max(1000, "Keep your message under 1000 characters.");

export type ChatExchange = { user: ChatMessageView; reply: ChatMessageView };

export async function loadChat(vehicleId: string): Promise<ActionResult<{ messages: ChatMessageView[]; subjects: ChatSubject[] }>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  try {
    const [messages, subjects] = await Promise.all([recentMessages(user._id, vehicle._id, 50), chatSubjects(user._id)]);
    return { ok: true, data: { messages, subjects } };
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

/** Retry = call again with the same text: an unanswered identical last message is reused, not duplicated. */
export async function sendChatMessage(vehicleId: string, text: string): Promise<ActionResult<ChatExchange>> {
  const { user, vehicle } = await requireVehicle(vehicleId);
  const parsed = MessageText.safeParse(text);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const scope = { userId: user._id, vehicleId: vehicle._id };
  try {
    const last = await ChatMessage.findOne(scope).sort({ createdAt: -1, _id: -1 });
    const userMsg =
      last?.role === "user" && last.content === parsed.data
        ? last
        : await ChatMessage.create({ ...scope, role: "user", content: parsed.data });
    // A new message makes older proposals stale: they must be asked for again.
    await ChatMessage.updateMany({ ...scope, "action.status": "pending" }, { "action.status": "cancelled" });
    const { text: content, action } = await runChatAgent(user._id, vehicle._id, assistantById(user.assistantId).name);
    const reply = await ChatMessage.create({ ...scope, role: "assistant", content, ...(action ? { action } : {}) });
    return { ok: true, data: { user: toChatView(userMsg), reply: toChatView(reply) } };
  } catch (err) {
    console.error("sendChatMessage", err);
    return { ok: false, error: "I couldn't answer just now. Check your connection, then tap Retry." };
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
