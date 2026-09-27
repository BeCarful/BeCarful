import type { ChatMessageView } from "@/services/ai/chat";
import type { ActionResult } from "@/types";

export type ChatExchange = { user: ChatMessageView; reply: ChatMessageView };

export type ChatStreamEvent =
  | { type: "delta"; text: string; fresh: boolean }
  | ({ type: "done" } & ChatExchange)
  | { type: "error"; error: string };

const OFFLINE = "Couldn't reach BeCarful. Check your connection, then tap Retry.";

export async function streamChat(vehicleId: string, text: string, onText: (soFar: string) => void): Promise<ActionResult<ChatExchange>> {
  try {
    const res = await fetch("/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId, text }),
    });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? OFFLINE };
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let soFar = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return { ok: false, error: "The answer was cut off. Tap Retry." };
      buffer += value;
      for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
        const ev = JSON.parse(buffer.slice(0, nl)) as ChatStreamEvent;
        buffer = buffer.slice(nl + 1);
        if (ev.type === "error") return { ok: false, error: ev.error };
        if (ev.type === "done") return { ok: true, data: { user: ev.user, reply: ev.reply } };
        soFar = ev.fresh ? ev.text : soFar + ev.text;
        onText(soFar);
      }
    }
  } catch {
    return { ok: false, error: OFFLINE };
  }
}
