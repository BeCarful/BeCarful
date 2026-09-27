import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTodos, nextIncidentStatus, type ClaimState } from "./todos";
import { aggregateDamage, sidesOf } from "./damage";

const base: ClaimState = { policyStatus: null, providerName: null, photoCount: 0, damage: [], incident: null };
const dent = aggregateDamage([
  {
    photoId: "p1",
    damagedComponents: [
      { component: "front_left_fender", damageTypes: ["dent"], severity: "moderate", confidence: 0.8, description: "" },
    ],
  },
  {
    photoId: "p2",
    damagedComponents: [
      { component: "front_left_fender", damageTypes: ["scratch"], severity: "minor", confidence: 0.9, description: "" },
    ],
  },
]);

const codes = (s: ClaimState) => computeTodos(s).items.filter((t) => !t.done).map((t) => t.code);

test("aggregate keeps worst severity, merges types and photos", () => {
  assert.equal(dent.length, 1);
  assert.equal(dent[0].severity, "moderate");
  assert.deepEqual(dent[0].damageTypes, ["dent", "scratch"]);
  assert.deepEqual(dent[0].photoIds, ["p1", "p2"]);
  assert.equal(dent[0].confidence, 0.9);
});

test("new vehicle: insurance + photos", () => {
  assert.deepEqual(codes(base), ["UPLOAD_INSURANCE", "ADD_PHOTOS"]);
});

test("policy uploaded but unprocessed", () => {
  assert.deepEqual(codes({ ...base, policyStatus: "processing" }), ["PROCESS_POLICY", "ADD_PHOTOS"]);
});

test("damage without insurance asks for more angles and incident info", () => {
  const s: ClaimState = { ...base, photoCount: 1, damage: dent, incident: { status: "action_required" } };
  assert.deepEqual(codes(s), ["UPLOAD_INSURANCE", "ADD_DAMAGE_PHOTOS", "COMPLETE_INCIDENT_INFO", "FILE_CLAIM"]);
  assert.match(computeTodos(s).items[2].title, /front-left side/);
  assert.equal(computeTodos(s).readyToFile, false);
});

test("everything present: ready to file", () => {
  const s: ClaimState = {
    policyStatus: "processed",
    providerName: "State Farm",
    photoCount: 3,
    damage: dent,
    incident: { type: "collision", occurredAt: new Date(), location: "Austin, TX", status: "action_required" },
  };
  const t = computeTodos(s);
  assert.deepEqual(codes(s), ["FILE_CLAIM"]);
  assert.equal(t.readyToFile, true);
  assert.equal(nextIncidentStatus(s, t), "ready_to_file");
  assert.equal(t.items.at(-1)?.title, "File your claim with State Farm");
});

test("filed stays filed", () => {
  const s: ClaimState = { ...base, damage: dent, photoCount: 5, incident: { status: "filed" } };
  assert.equal(nextIncidentStatus(s, computeTodos(s)), "filed");
});

test("photos without damage need nothing else", () => {
  const s: ClaimState = { ...base, policyStatus: "processed", photoCount: 2, incident: { status: "documenting" } };
  assert.deepEqual(codes(s), []);
  assert.equal(nextIncidentStatus(s, computeTodos(s)), "documenting");
});

test("sidesOf maps parts and photo views to car sides", () => {
  assert.deepEqual(sidesOf("left_headlight"), ["front", "left"]);
  assert.deepEqual(sidesOf("rear_right_quarter"), ["rear", "right"]);
  assert.deepEqual(sidesOf("front_left"), ["front", "left"]);
  assert.deepEqual(sidesOf("roof"), []);
  assert.deepEqual(sidesOf("unknown"), []);
});
