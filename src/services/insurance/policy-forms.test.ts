import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIndex, search } from "@/services/law/statutes";
import { chunkPolicyForm, definitionsFor, fuseRankings, matchForms, readPolicyForms, splitSections, type PolicyFormChunk } from "./policy-forms";
import { RETRIEVAL_CASES, matches } from "./policy-forms.cases";

const chunks = readPolicyForms();
const index = buildIndex(chunks);
const inProduct = (product: PolicyFormChunk["product"]) => (c: PolicyFormChunk) => c.providerId === "state-farm" && c.product === product;

test("chunkPolicyForm reads the header", () => {
  const raw = "Form X: Test\nForm: X 1\nInsurers: Test Co\nProduct: personal_car\nSource: filing 1\nRetrieved: 2026-09-26\n\nBody line.";
  const [c, ...rest] = chunkPolicyForm(raw, "state-farm");
  assert.equal(rest.length, 0);
  assert.deepEqual(c, { providerId: "state-farm", product: "personal_car", form: "X 1", citation: "Form X: Test", section: "Opening text", source: "filing 1", text: "Body line." });
  assert.throws(() => chunkPolicyForm(raw.replace("personal_car", "boat"), "state-farm"));
});

test("splitSections follows parts, subsections, numbered coverages and definitions", () => {
  const body = [
    "DEFINITIONS",
    "Newly Acquired Car means a car newly owned by you.",
    "PHYSICAL DAMAGE COVERAGES",
    "This policy provides Physical Damage Coverages.",
    "Insuring Agreements",
    "1. Comprehensive Coverage",
    "We will pay for loss caused by theft.",
    "Exclusions",
    "THERE IS NO COVERAGE FOR RACING.",
  ];
  const paths = splitSections(body).map((s) => s.path.join(" › "));
  assert.deepEqual(paths, [
    "DEFINITIONS › Newly Acquired Car",
    "PHYSICAL DAMAGE COVERAGES",
    "PHYSICAL DAMAGE COVERAGES › Insuring Agreements › Comprehensive Coverage",
    "PHYSICAL DAMAGE COVERAGES › Exclusions",
  ]);
  assert.equal(splitSections(body)[0].term, "Newly Acquired Car");
});

test("the 9810C booklet splits into its coverage sections", () => {
  const sections = new Set(chunks.filter((c) => c.form === "9810C").map((c) => c.section.replace(/ \(part \d+ of \d+\)$/, "")));
  for (const s of [
    "PHYSICAL DAMAGE COVERAGES › Insuring Agreements › Comprehensive Coverage",
    "PHYSICAL DAMAGE COVERAGES › Exclusions",
    "NO-FAULT COVERAGE › Limits",
    "INSURED’S DUTIES › Questioning Under Oath",
    "GENERAL TERMS › Cancellation",
    "DEFINITIONS › Newly Acquired Car",
  ])
    assert.ok(sections.has(s), s);
  assert.equal(new Set(chunks.map((c) => c.citation)).size, 40);
});

test("matchForms maps declared form numbers to saved forms", () => {
  const forms = ["9810C", "2835AR", "SC 103 FL", "SC 900"];
  assert.deepEqual(matchForms(["Form 9810C", "SC 103 FL 06 26", "6128S.1"], forms), { matched: ["9810C", "SC 103 FL"], missing: ["6128S.1"] });
  assert.deepEqual(matchForms(["9810A"], forms).matched, []);
});

test("definitionsFor attaches the terms a passage uses", () => {
  const chunk = (form: string, section: string, text: string, term?: string) =>
    ({ providerId: "state-farm", product: "classic_plus", form, citation: form, section, text, term }) as PolicyFormChunk;
  const defs = [
    chunk("SC 900", "DEFINITIONS › Your covered auto", "“Your covered auto” means any vehicle shown in the Declarations.", "Your covered auto"),
    chunk("SC 900", "DEFINITIONS › Paddock", "“Paddock” means an area at a track.", "Paddock"),
  ];
  const hit = chunk("SC 108 FL", "PART D", "We will pay for loss to “your covered auto”.");
  assert.deepEqual(definitionsFor(hit, defs).map((d) => d.term), ["Your covered auto"]);
});

test("fuseRankings favors passages both searches agree on", () => {
  const c = (section: string) => ({ form: "9810C", section }) as PolicyFormChunk;
  const [a, b, x] = [c("A"), c("B"), c("X")];
  assert.deepEqual(fuseRankings([[a, x], [b, x]], 3).map((h) => h.section), ["X", "A", "B"]);
});

test("keyword search keeps its hit rate on the retrieval test set", () => {
  let hits = 0;
  for (const c of RETRIEVAL_CASES) {
    assert.ok(chunks.some((ch) => ch.product === c.product && matches(c, ch)), `no evidence in the corpus for: ${c.q}`);
    hits += Number(search(index, c.q, { limit: 4, filter: inProduct(c.product) }).some((h) => matches(c, h)));
  }
  assert.ok(hits >= 23, `hit@4 fell to ${hits}/${RETRIEVAL_CASES.length}`);
});
