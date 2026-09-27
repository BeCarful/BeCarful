import assert from "node:assert/strict";
import { test } from "node:test";
import { hashShareToken, isLive, newShareToken } from "./token";

test("share tokens are URL-safe, unique and stored only as a hash", () => {
  const a = newShareToken();
  const b = newShareToken();
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.token, b.token);
  assert.equal(a.tokenHash, hashShareToken(a.token));
  assert.notEqual(a.tokenHash, a.token);
});

test("a link stops working when it expires", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  assert.equal(isLive({ expiresAt: new Date("2026-09-27T12:00:01Z") }, now), true);
  assert.equal(isLive({ expiresAt: now }, now), false);
  assert.equal(isLive({ expiresAt: new Date("2026-09-20T12:00:00Z") }, now), false);
});
