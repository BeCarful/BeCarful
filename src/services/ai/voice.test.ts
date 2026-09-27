import assert from "node:assert/strict";
import { test } from "node:test";
import { speechText } from "./voice";

test("speechText drops bullets and bold but keeps hyphens inside words", () => {
  assert.equal(speechText("Next steps:\n- **Call** State Farm\n* Take a close-up\nA follow-up call"), "Next steps:\nCall State Farm\nTake a close-up\nA follow-up call");
});
