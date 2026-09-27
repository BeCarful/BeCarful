import type { NextRequest } from "next/server";
import { z } from "zod";
import { assistantById } from "@/components/chat/assistants";
import type { ChatStreamEvent } from "@/components/chat/stream";
import { ChatMessage } from "@/models/ChatMessage";
import { toChatView } from "@/services/ai/chat";
import { runChatAgent } from "@/services/ai/chat-agent";
import { requireVehicle } from "@/services/vehicles/context";

export const maxDuration = 60;

const Body = z.object({
  vehicleId: z.string(),
  text: z.string().trim().min(1, "Type a question first.").max(1000, "Keep your message under 1000 characters."),
});

/** Retry = call again with the same text: an unanswered identical last message is reused, not duplicated. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Type a question first." }, { status: 400 });
  const { user, vehicle } = await requireVehicle(parsed.data.vehicleId);
  const scope = { userId: user._id, vehicleId: vehicle._id };
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
        } catch {}
      };
      try {
        const last = await ChatMessage.findOne(scope).sort({ createdAt: -1, _id: -1 });
        const userMsg =
          last?.role === "user" && last.content === parsed.data.text
            ? last
            : await ChatMessage.create({ ...scope, role: "user", content: parsed.data.text });
        // A new message makes older proposals stale: they must be asked for again.
        await ChatMessage.updateMany({ ...scope, "action.status": "pending" }, { "action.status": "cancelled" });
        const { text: content, action } = await runChatAgent(user._id, vehicle._id, assistantById(user.assistantId).name, (text, fresh) =>
          send({ type: "delta", text, fresh }),
        );
        const reply = await ChatMessage.create({ ...scope, role: "assistant", content, ...(action ? { action } : {}) });
        send({ type: "done", user: toChatView(userMsg), reply: toChatView(reply) });
      } catch (err) {
        console.error("chat stream", err);
        send({ type: "error", error: "I couldn't answer just now. Check your connection, then tap Retry." });
      }
      try {
        controller.close();
      } catch {}
    },
  });

  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform" } });
}
