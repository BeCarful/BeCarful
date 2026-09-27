import assert from "node:assert/strict";
import { test } from "node:test";
import type { PolicyExtraction } from "@/schemas/policy";
import { checkClaim, parsePolicyPeriod, policyActiveOn, type ClaimCheckInput } from "./claim-check";

const extraction: PolicyExtraction = {
  provider: "State Farm",
  policyNumber: "SF-1",
  policyType: "Auto",
  effectiveDates: "2026-03-01 to 2026-09-01",
  premium: null,
  coveredVehicle: null,
  collision: "Covered, $500 deductible",
  comprehensive: null,
  liability: null,
  deductibles: "Collision $500",
  rentalReimbursement: null,
  roadsideAssistance: null,
  otherCoverage: [],
  exclusions: [],
  formNumbers: [],
};

const occurredAt = new Date("2026-06-10T18:00:00Z");
const camera = { source: "camera" as const, capturedAt: new Date("2026-06-10T18:20:00Z"), hasLocation: true, showsDamage: true };
const good: ClaimCheckInput = {
  incidentType: "collision",
  occurredAt,
  policy: { extraction, coverage: [{ peril: "collision", status: "covered", detail: "Collision is covered.", law: null }], examplePlan: false },
  photos: [camera, camera, camera],
  damagePhotos: 3,
  unclearPhotos: 0,
};

const statusOf = (input: ClaimCheckInput, id: string) => checkClaim(input).items.find((i) => i.id === id)?.status;

test("parsePolicyPeriod reads ISO, US and month-name dates", () => {
  assert.deepEqual(parsePolicyPeriod("2026-03-01 to 2026-09-01")?.map((d) => d.toISOString().slice(0, 10)), ["2026-03-01", "2026-09-01"]);
  assert.deepEqual(parsePolicyPeriod("03/01/2026 - 09/01/2026")?.map((d) => d.toISOString().slice(0, 10)), ["2026-03-01", "2026-09-01"]);
  assert.deepEqual(parsePolicyPeriod("Policy period: Mar 01, 2026 to September 1 2026")?.map((d) => d.toISOString().slice(0, 10)), ["2026-03-01", "2026-09-01"]);
  assert.equal(parsePolicyPeriod("Six months"), null);
});

test("policyActiveOn is unsure within a day of either end", () => {
  const text = "2026-03-01 to 2026-09-01";
  assert.equal(policyActiveOn(text, occurredAt), true);
  assert.equal(policyActiveOn(text, new Date("2026-09-20T12:00:00Z")), false);
  assert.equal(policyActiveOn(text, new Date("2026-02-01T12:00:00Z")), false);
  assert.equal(policyActiveOn(text, new Date("2026-09-01T20:00:00Z")), null);
});

test("well-documented covered claim is supported", () => {
  const r = checkClaim(good);
  assert.equal(r.verdict, "supported");
  assert.equal(r.items.find((i) => i.id === "deductible")?.title, "Deductible: Collision $500");
});

test("not covered or outside the policy period puts the claim at risk", () => {
  const notCovered = { ...good, policy: { ...good.policy!, coverage: [{ peril: "collision" as const, status: "not_covered" as const, detail: "No collision coverage.", law: null }] } };
  assert.equal(checkClaim(notCovered).verdict, "at_risk");
  const lapsed = { ...good, occurredAt: new Date("2026-10-01T12:00:00Z"), photos: [] };
  assert.equal(statusOf(lapsed, "policy_dates"), "fail");
  assert.equal(checkClaim({ ...good, policy: null }).verdict, "at_risk");
});

test("unknown coverage and weak evidence are gaps, never covered", () => {
  assert.equal(statusOf({ ...good, policy: { ...good.policy!, coverage: null } }, "coverage"), "warn");
  assert.equal(statusOf({ ...good, incidentType: "other" }, "coverage"), "warn");
  assert.equal(statusOf({ ...good, incidentType: "hail" }, "coverage"), "warn");
  assert.equal(statusOf({ ...good, damagePhotos: 1 }, "damage_photos"), "warn");
  assert.equal(statusOf({ ...good, photos: [{ source: "upload", capturedAt: null, hasLocation: false, showsDamage: true }] }, "live_photos"), "warn");
  assert.equal(statusOf({ ...good, photos: [{ ...camera, hasLocation: false }] }, "location"), "warn");
  assert.equal(statusOf({ ...good, photos: [{ ...camera, capturedAt: new Date("2026-06-20T00:00:00Z") }] }, "timing"), "warn");
  assert.equal(statusOf({ ...good, photos: [{ ...camera, capturedAt: new Date("2026-06-09T00:00:00Z") }] }, "prior_damage"), "warn");
  assert.equal(statusOf({ ...good, policy: { ...good.policy!, examplePlan: true } }, "example_plan"), "warn");
  assert.equal(checkClaim({ ...good, unclearPhotos: 1 }).verdict, "gaps");
});

test("undamaged photos from before the incident are a good sign, not a gap", () => {
  const walkaround = { ...camera, capturedAt: new Date("2026-05-27T18:00:00Z"), showsDamage: false };
  const r = checkClaim({ ...good, photos: [walkaround, walkaround, camera, camera, camera] });
  assert.equal(r.verdict, "supported");
  assert.equal(r.items.find((i) => i.id === "before_photos")?.status, "ok");
  assert.equal(r.items.find((i) => i.id === "timing")?.status, "ok");
});
