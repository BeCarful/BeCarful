import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, type JevVerdict } from "./guard";

const jev = (risk: JevVerdict["risk"], requested = 0.9, confidence = 0.9): JevVerdict => ({ risk, requested, confidence });

test("reads always run, even without a classifier", () => {
  assert.equal(decide("read", null).outcome, "allow");
});

test("no classifier fails safe to confirm", () => {
  assert.equal(decide("write", null).outcome, "confirm");
  assert.equal(decide("destructive", null).outcome, "confirm");
});

test("destructive tools always need the user's tap", () => {
  assert.equal(decide("destructive", jev("benign_write")).outcome, "confirm");
});

test("confident suspicious calls are denied", () => {
  assert.equal(decide("write", jev("suspicious")).outcome, "deny");
  assert.equal(decide("destructive", jev("suspicious")).outcome, "deny");
  assert.equal(decide("write", jev("suspicious", 0.9, 0.4)).outcome, "confirm");
});

test("writes run alone only when benign and requested", () => {
  assert.equal(decide("write", jev("benign_write")).outcome, "allow");
  assert.equal(decide("write", jev("benign_write", 0.2)).outcome, "confirm");
  assert.equal(decide("write", jev("destructive")).outcome, "confirm");
});
