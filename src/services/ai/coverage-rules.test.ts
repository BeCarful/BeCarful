import assert from "node:assert/strict";
import { test } from "node:test";
import type { PolicyExtraction } from "@/schemas/policy";
import { NOT_FOUND_IN_POLICY, PERILS } from "@/types";
import { enforceEvidence, resolveLaw, type AgentChecklist } from "./coverage-rules";

const extraction: PolicyExtraction = {
  provider: "State Farm",
  policyNumber: null,
  policyType: "Auto",
  effectiveDates: null,
  premium: null,
  coveredVehicle: null,
  collision: "$500 deductible",
  comprehensive: null,
  liability: "$100,000/$300,000/$50,000",
  deductibles: null,
  rentalReimbursement: null,
  roadsideAssistance: null,
  otherCoverage: ["Personal injury protection (PIP): $10,000"],
  exclusions: ["Flood damage is excluded"],
  formNumbers: [],
};

const statutes = [
  { citation: "Florida Statutes (2026) § 627.736 Required personal injury protection benefits.", url: "https://fl.test/627.736" },
  { citation: "Florida Statutes (2026) § 627.7288 Comprehensive coverage; deductible not to apply to motor vehicle glass.", url: "https://fl.test/627.7288" },
  { citation: "15 U.S.C. §1012. Regulation by State law", url: "https://us.test/1012" },
];

test("covered needs a backing policy field", () => {
  const agent: AgentChecklist = {
    items: [
      { peril: "collision", status: "covered", basis: "collision", detail: "Covered, $500 deductible.", law: null },
      { peril: "theft", status: "covered", basis: "comprehensive", detail: "Covered.", law: null },
      { peril: "fire", status: "covered", basis: null, detail: "Covered.", law: null },
      { peril: "flood", status: "covered", basis: "exclusions", detail: "Covered.", law: null },
      { peril: "flood", status: "not_covered", basis: "exclusions", detail: "Excluded.", law: null },
    ],
  };
  const items = enforceEvidence(agent, extraction, statutes);
  const by = Object.fromEntries(items.map((i) => [i.peril, i]));
  assert.deepEqual(items.map((i) => i.peril), [...PERILS]);
  assert.equal(by.collision.status, "covered");
  assert.equal(by.theft.status, "unknown");
  assert.equal(by.theft.detail, NOT_FOUND_IN_POLICY);
  assert.equal(by.fire.status, "unknown");
  assert.equal(by.flood.status, "unknown", "first row per peril wins, and exclusions never back 'covered'");
  assert.equal(by.roadside.status, "unknown");
});

test("not_covered keeps the agent's explanation", () => {
  const items = enforceEvidence(
    { items: [{ peril: "glass", status: "not_covered", basis: null, detail: "No comprehensive, so no glass coverage.", law: "Fla. Stat. § 627.7288" }] },
    extraction,
    statutes,
  );
  const glass = items.find((i) => i.peril === "glass")!;
  assert.equal(glass.detail, "No comprehensive, so no glass coverage.");
  assert.deepEqual(glass.law, { citation: "Fla. Stat. § 627.7288", url: "https://fl.test/627.7288" });
});

test("resolveLaw only returns statutes we have", () => {
  assert.equal(resolveLaw("Fla. Stat. § 627.736", statutes)?.url, "https://fl.test/627.736");
  assert.equal(resolveLaw("section 627.736(1)", statutes)?.citation, "Fla. Stat. § 627.736");
  assert.equal(resolveLaw("15 U.S.C. § 1012", statutes)?.citation, "15 U.S.C. § 1012");
  assert.equal(resolveLaw("Fla. Stat. § 627.73", statutes), null);
  assert.equal(resolveLaw("Fla. Stat. § 999.999", statutes), null);
  assert.equal(resolveLaw(null, statutes), null);
});
