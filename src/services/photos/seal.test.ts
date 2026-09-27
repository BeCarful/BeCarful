import assert from "node:assert/strict";
import { test } from "node:test";
import { sealPhoto, sha256Hex } from "./seal";

const SECRET = "x".repeat(32);
const base = {
  vehicleId: "v1",
  sha256: sha256Hex("photo bytes"),
  serverReceivedAt: new Date("2026-09-26T18:00:05Z"),
  capturedAt: new Date("2026-09-26T18:00:00Z"),
  latitude: 30.2686,
  longitude: -97.7555,
  locationAccuracy: 12,
};

test("sha256Hex fingerprints bytes", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sealPhoto binds image, time and location", () => {
  const seal = sealPhoto(base, SECRET);
  assert.match(seal, /^[0-9a-f]{64}$/);
  assert.equal(sealPhoto({ ...base }, SECRET), seal);
  for (const change of [
    { sha256: sha256Hex("other bytes") },
    { capturedAt: new Date("2026-09-25T18:00:00Z") },
    { serverReceivedAt: new Date("2026-09-26T18:00:06Z") },
    { latitude: 30.2687 },
    { longitude: null },
    { vehicleId: "v2" },
  ]) {
    assert.notEqual(sealPhoto({ ...base, ...change }, SECRET), seal, JSON.stringify(change));
  }
  assert.notEqual(sealPhoto(base, "y".repeat(32)), seal);
});
