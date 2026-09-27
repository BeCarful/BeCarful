import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIndex, chunkStatute, readStatuteFiles, search } from "./statutes";

const index = buildIndex(readStatuteFiles());
const top = (q: string, jurisdiction?: "florida" | "federal") => search(index, q, { limit: 3, filter: jurisdiction && ((c) => c.jurisdiction === jurisdiction) }).map((h) => h.citation);

test("chunkStatute reads the header and drops History lines", () => {
  const raw = "Florida Statutes (2026) § 1.1 Test.\nSource: https://example.test/1\nRetrieved: 2026-09-26\n\n(1) Body text.\nHistory.—s. 1.";
  const [c, ...rest] = chunkStatute(raw, "florida");
  assert.equal(rest.length, 0);
  assert.equal(c.url, "https://example.test/1");
  assert.equal(c.text, "(1) Body text.");
});

test("finds the Florida PIP statute", () => {
  assert.ok(top("personal injury protection benefits $10,000 medical", "florida").some((c) => c.includes("627.736")));
});

test("finds the windshield deductible rule", () => {
  assert.ok(top("comprehensive coverage deductible windshield").some((c) => c.includes("627.7288")));
});

test("finds uninsured motorist coverage", () => {
  assert.ok(top("uninsured motor vehicle coverage").some((c) => c.includes("627.727")));
});

test("jurisdiction filter keeps federal only", () => {
  const hits = search(index, "state regulation of the business of insurance", { filter: (c) => c.jurisdiction === "federal" });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => h.jurisdiction === "federal"));
  assert.ok(hits.slice(0, 3).some((h) => h.citation.includes("1012")));
});
