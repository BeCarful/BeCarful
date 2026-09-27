import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { assistantById } from "@/components/chat/assistants";
import { requireUser } from "@/lib/auth";
import { ChatMessage } from "@/models/ChatMessage";
import { speak, voiceEnabled } from "@/services/ai/voice";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!voiceEnabled() || !isValidObjectId(id)) notFound();
  const msg = await ChatMessage.findOne({ _id: id, userId: user._id, role: "assistant" }).select("content").lean<{ content: string }>();
  if (!msg) notFound();
  try {
    return new Response(await speak(msg.content, assistantById(user.assistantId).voice), { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
  } catch (err) {
    console.error("speak", err);
    return new Response("Voice is unavailable right now.", { status: 503 });
  }
}
