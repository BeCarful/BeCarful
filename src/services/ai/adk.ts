import "server-only";
import { Gemini, InMemoryRunner, StreamingMode, createEvent, getFunctionCalls, isFinalResponse, type LlmAgent } from "@google/adk";
import type { Content } from "@google/genai";
import { GEMINI_MODEL, gemini, genaiAuth } from "./gemini";

class SharedClientGemini extends Gemini {
  override get apiClient() {
    return gemini();
  }
}

export const adkModel = (model = GEMINI_MODEL) => new SharedClientGemini({ model, ...genaiAuth() });

type Turn = { role: "user" | "assistant"; content: string };

// ponytail: in-memory ADK session rebuilt per request from MongoDB history; swap for a persistent session service if ADK-side state is ever needed.
/** Runs one agent turn. Returns the final text and the merged session state delta (outputKey values land there). */
export async function runAgent(
  agent: LlmAgent,
  opts: { userId: string; message: Content; history?: Turn[]; onText?: (delta: string, fresh: boolean) => void },
) {
  const runner = new InMemoryRunner({ agent, appName: "becarful" });
  const session = await runner.sessionService.createSession({ appName: "becarful", userId: opts.userId });
  for (const t of opts.history ?? []) {
    await runner.sessionService.appendEvent({
      session,
      event: createEvent({
        author: t.role === "user" ? "user" : agent.name,
        content: { role: t.role === "user" ? "user" : "model", parts: [{ text: t.content }] },
      }),
    });
  }

  let text = "";
  let fresh = true;
  const state: Record<string, unknown> = {};
  const runConfig = opts.onText ? { streamingMode: StreamingMode.SSE } : undefined;
  for await (const ev of runner.runAsync({ userId: opts.userId, sessionId: session.id, newMessage: opts.message, runConfig })) {
    if (ev.errorCode) throw new Error(`ADK ${ev.errorCode}: ${ev.errorMessage}`);
    Object.assign(state, ev.actions?.stateDelta);
    if (getFunctionCalls(ev).length) fresh = true;
    if (ev.partial && ev.author === agent.name && opts.onText) {
      const delta = ev.content?.parts?.map((p) => (p.thought ? "" : (p.text ?? ""))).join("");
      if (delta) {
        opts.onText(delta, fresh);
        fresh = false;
      }
    }
    if (isFinalResponse(ev) && ev.author === agent.name) {
      const t = ev.content?.parts?.map((p) => (p.thought ? "" : (p.text ?? ""))).join("").trim();
      if (t) text = t;
    }
  }
  return { text, state };
}
