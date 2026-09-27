import { test } from "node:test";
import assert from "node:assert/strict";
import type { CoverageItem } from "@/services/ai/coverage-rules";
import { claimPolicy, combinedCoverage, policiesStatus } from "./policies";

const row = (peril: CoverageItem["peril"], status: CoverageItem["status"]): CoverageItem => ({ peril, status, detail: status, law: null });
const sf = { id: "sf", status: "processed" as const, coverageChecklist: { items: [row("collision", "not_covered"), row("theft", "covered")] } };
const geico = { id: "geico", status: "processed" as const, coverageChecklist: { items: [row("collision", "covered"), row("theft", "unknown")] } };
const reading = { id: "new", status: "processing" as const, coverageChecklist: null };

test("claim goes to the insurer that covers the incident", () => {
  assert.equal(claimPolicy([sf, geico], "collision")?.id, "geico");
  assert.equal(claimPolicy([sf, geico], "theft")?.id, "sf");
  assert.equal(claimPolicy([reading, sf, geico], "other")?.id, "sf");
  assert.equal(claimPolicy([reading], null)?.id, "new");
  assert.equal(claimPolicy([], "collision"), null);
});

test("status is the best any policy reached", () => {
  assert.equal(policiesStatus([reading, sf]), "processed");
  assert.equal(policiesStatus([{ status: "failed" }, reading]), "processing");
  assert.equal(policiesStatus([]), null);
});

test("combined coverage: covered by any policy wins, gaps stay gaps", () => {
  const c = combinedCoverage([sf, geico, reading])!;
  assert.equal(c.find((i) => i.peril === "collision")?.status, "covered");
  assert.equal(c.find((i) => i.peril === "theft")?.status, "covered");
  assert.equal(c.find((i) => i.peril === "flood")?.status, "unknown");
  assert.equal(combinedCoverage([reading]), null);
});
