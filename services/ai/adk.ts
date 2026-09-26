import "server-only";
import { Gemini, InMemoryRunner, createEvent, isFinalResponse, type LlmAgent } from "@google/adk";
import type { Content } from "@google/genai";
import { genaiAuth, geminiModel } from "./gemini";

export const adkModel = () => new Gemini({ model: geminiModel(), ...genaiAuth() });

type Turn = { role: "user" | "assistant"; content: string };

// ponytail: in-memory ADK session rebuilt per request from MongoDB history; swap for a persistent session service if ADK-side state is ever needed.
/** Runs one agent turn. Returns the final text and the merged session state delta (outputKey values land there). */
export async function runAgent(agent: LlmAgent, opts: { userId: string; message: Content; history?: Turn[] }) {
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
  const state: Record<string, unknown> = {};
  for await (const ev of runner.runAsync({ userId: opts.userId, sessionId: session.id, newMessage: opts.message })) {
    if (ev.errorCode) throw new Error(`ADK ${ev.errorCode}: ${ev.errorMessage}`);
    Object.assign(state, ev.actions?.stateDelta);
    if (isFinalResponse(ev) && ev.author === agent.name) {
      const t = ev.content?.parts?.map((p) => (p.thought ? "" : (p.text ?? ""))).join("").trim();
      if (t) text = t;
    }
  }
  return { text, state };
}
