import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { ASSISTANTS, assistantById } from "@/components/chat/assistants";
import { requireUser } from "@/lib/auth";
import { ChatMessage } from "@/models/ChatMessage";
import { speak, voiceEnabled } from "@/services/ai/voice";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!voiceEnabled()) notFound();
  const params = req.nextUrl.searchParams;
  const sample = ASSISTANTS.find((a) => a.id === params.get("sample"));
  let text = sample ? `Hi! I'm ${sample.name}. I'll help you with your car, your policy and your claim.` : "";
  if (!sample) {
    const id = params.get("id") ?? "";
    if (!isValidObjectId(id)) notFound();
    const msg = await ChatMessage.findOne({ _id: id, userId: user._id, role: "assistant" }).select("content").lean<{ content: string }>();
    if (!msg) notFound();
    text = msg.content;
  }
  try {
    const voice = (sample ?? assistantById(user.assistantId)).voice;
    return new Response(await speak(text, voice), { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
  } catch (err) {
    console.error("speak", err);
    return new Response("Voice is unavailable right now.", { status: 503 });
  }
}
