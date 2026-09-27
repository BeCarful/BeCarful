import assert from "node:assert/strict";
import { test } from "node:test";
import { silenceDetector } from "./vad";

const STEP = 50;

function stopTime(segments: [level: number, ms: number][]) {
  const shouldStop = silenceDetector();
  let now = 0;
  for (const [level, ms] of segments) {
    for (let end = now + ms; now < end; now += STEP) if (shouldStop(level, now)) return now;
  }
  return null;
}

test("stops about 1.4 s after the user stops talking, not during short pauses", () => {
  const at = stopTime([
    [0.002, 500],
    [0.1, 1500],
    [0.003, 400],
    [0.12, 1000],
    [0.002, 3000],
  ]);
  assert.ok(at !== null && at >= 3400 + 1400 && at <= 3400 + 1500, String(at));
});

test("gives up after 8 s when nobody speaks", () => {
  assert.equal(stopTime([[0.002, 10_000]]), 8000);
});

test("steady background noise isn't taken for speech, and long speech isn't cut off", () => {
  assert.equal(stopTime([[0.03, 5000]]), null);
  assert.equal(stopTime([[0.03, 500], [0.15, 12_000]]), null);
  const at = stopTime([[0.03, 500], [0.15, 2000], [0.03, 3000]]);
  assert.ok(at !== null && at >= 2500 + 1400 && at <= 2500 + 1500, String(at));
});
