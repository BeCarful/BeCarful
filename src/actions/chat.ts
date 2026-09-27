"use server";

import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { ChatMessage } from "@/models/ChatMessage";
import { agentTool } from "@/services/ai/agent-tools";
import { toChatView, type ChatMessageView } from "@/services/ai/chat";
import { runChatAgent } from "@/services/ai/chat-agent";
import { requireVehicle } from "@/services/vehicles/context";
import type { ActionResult } from "@/types";

const MessageText = z.string().trim().min(1, "Type a question first.").max(1000, "Keep your message under 1000 characters.");

export type ChatExchange = { user: ChatMessageView; reply: ChatMessageView };

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
    const { text: content, action } = await runChatAgent(user._id, vehicle._id);
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
