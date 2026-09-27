import assert from "node:assert/strict";
import { test } from "node:test";
import { streamChat, type ChatStreamEvent } from "./stream";

function serve(events: ChatStreamEvent[], split = 7) {
  const raw = events.map((e) => `${JSON.stringify(e)}\n`).join("");
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(c) {
          for (let i = 0; i < raw.length; i += split) c.enqueue(new TextEncoder().encode(raw.slice(i, i + split)));
          c.close();
        },
      }),
    );
}

const msg = (id: string, role: "user" | "assistant", content: string) => ({ id, role, content, createdAt: "2026-09-27T00:00:00.000Z" });

test("streamChat accumulates deltas, restarts on a fresh segment and returns the saved exchange", async () => {
  const seen: string[] = [];
  serve([
    { type: "delta", text: "Let me ", fresh: true },
    { type: "delta", text: "check.", fresh: false },
    { type: "delta", text: "Your deductible ", fresh: true },
    { type: "delta", text: "is $500.", fresh: false },
    { type: "done", user: msg("u1", "user", "deductible?"), reply: msg("a1", "assistant", "Your deductible is $500."), navigate: "/insurance" },
  ]);
  const res = await streamChat("v1", "deductible?", (t) => seen.push(t));
  assert.deepEqual(seen, ["Let me ", "Let me check.", "Your deductible ", "Your deductible is $500."]);
  assert.ok(res.ok && res.data.reply.id === "a1" && res.data.navigate === "/insurance");
});

test("streamChat only lets the chat open paths inside the app", async () => {
  for (const [href, expected] of [["//evil.test", null], ["https://evil.test", null], ["/\\evil.test", null], ["/garage", "/garage"]]) {
    serve([{ type: "done", user: msg("u", "user", "open"), reply: msg("a", "assistant", "Opening."), navigate: href }]);
    const res = await streamChat("v1", "open", () => {});
    assert.equal(res.ok && res.data.navigate, expected, String(href));
  }
});

test("streamChat surfaces server errors and cut-off streams", async () => {
  serve([{ type: "error", error: "I couldn't answer just now." }]);
  assert.deepEqual(await streamChat("v1", "hi", () => {}), { ok: false, error: "I couldn't answer just now." });
  serve([{ type: "delta", text: "Half an ans", fresh: true }]);
  assert.equal((await streamChat("v1", "hi", () => {})).ok, false);
});
