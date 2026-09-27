import { test } from "node:test";
import assert from "node:assert/strict";
import { claimDeadlines, dueDate } from "./deadlines";

const ids = (s: Parameters<typeof claimDeadlines>[0]) => claimDeadlines(s).map((d) => d.id);

test("State Farm crash: every limit, most urgent first", () => {
  assert.deepEqual(ids({ type: "collision", providerId: "state-farm", filed: false }), [
    "NOTIFY_INSURER",
    "HIT_AND_RUN_POLICE",
    "CRASH_REPORT",
    "PIP_CARE",
    "HIT_AND_RUN_INSURER",
  ]);
});

test("hit-and-run limits only come from State Farm's wording", () => {
  assert.deepEqual(ids({ type: null, providerId: "geico", providerName: "GEICO", filed: false }), ["NOTIFY_INSURER", "CRASH_REPORT", "PIP_CARE"]);
  assert.equal(claimDeadlines({ providerId: null, filed: false })[0].title, "Tell your insurer what happened");
});

test("filed claims drop the notice; non-crashes keep only the notice", () => {
  assert.deepEqual(ids({ type: "collision", providerId: "state-farm", filed: true }), ["HIT_AND_RUN_POLICE", "CRASH_REPORT", "PIP_CARE", "HIT_AND_RUN_INSURER"]);
  assert.deepEqual(ids({ type: "theft", providerId: "state-farm", filed: false }), ["NOTIFY_INSURER"]);
  assert.deepEqual(ids({ type: "flood", filed: true }), []);
});

test("day limits end on the last calendar day; hour limits are exact", () => {
  const crash = new Date(2026, 8, 27, 23, 30);
  assert.deepEqual(dueDate(crash, { days: 14 }), new Date(2026, 9, 11, 23, 59, 59, 999));
  assert.deepEqual(dueDate(crash, { days: 10 }), new Date(2026, 9, 7, 23, 59, 59, 999));
  assert.deepEqual(dueDate(crash, { hours: 24 }), new Date(2026, 8, 28, 23, 30));
});
