"use server";

import { z } from "zod";
import { ChatMessage } from "@/models/ChatMessage";
import { generateReply, toChatView, type ChatMessageView } from "@/services/ai/chat";
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
    const content = await generateReply(user._id, vehicle._id);
    const reply = await ChatMessage.create({ ...scope, role: "assistant", content });
    return { ok: true, data: { user: toChatView(userMsg), reply: toChatView(reply) } };
  } catch (err) {
    console.error("sendChatMessage", err);
    return { ok: false, error: "I couldn't answer just now. Check your connection, then tap Retry." };
  }
}
