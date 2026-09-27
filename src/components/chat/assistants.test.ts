import assert from "node:assert/strict";
import { test } from "node:test";
import { ASSISTANTS, VOICES } from "./assistants";

test("every Tuxemon assistant has its own ElevenLabs voice", () => {
  for (const a of ASSISTANTS) assert.ok(VOICES[a.id], `${a.name} has no voice in VOICES`);
  assert.equal(new Set(ASSISTANTS.map((a) => a.voiceId)).size, ASSISTANTS.length);
});
