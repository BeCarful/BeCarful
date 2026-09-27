import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { connectDB } from "@/lib/db";
import { PolicyForm } from "@/models/PolicyForm";
import { dot, embed, isQuotaError } from "@/services/ai/embeddings";
import { cachedIndex, chunkLines, search, type Index } from "@/services/law/statutes";
import { POLICY_PRODUCTS, type PolicyProduct } from "@/types";
import { PROVIDERS } from "./providers";

export type PolicyFormChunk = {
  providerId: string;
  product: PolicyProduct;
  form: string;
  citation: string;
  section: string;
  term?: string | null;
  source: string;
  text: string;
  embedding?: number[] | null;
};

const SECTION_CHARS = 2500;
const CANDIDATES = 20;
const RRF_K = 60;
const PART = /^(PART [A-G] [–-] .+|THIS POLICY|DEFINITIONS|(PROPERTY DAMAGE )?LIABILITY COVERAGE( [–-].*)?|NO-FAULT COVERAGE|MEDICAL PAYMENTS COVERAGE|UNINSURED MOTOR VEHICLE COVERAGE( [–-].*)?|PHYSICAL DAMAGE COVERAGES|DEATH, DISMEMBERMENT AND LOSS OF SIGHT|LOSS OF EARNINGS COVERAGE|INSURED’S DUTIES|GENERAL TERMS)$/;
const DEFINITION = /^(?:[A-Z]\. )?“?([A-Za-z][\w’'®-]*(?: [\w’'®-]+){0,4}?)”? (?:means|includes)\b/;
const SMALL = new Set(["a", "an", "and", "or", "of", "the", "to", "for", "in", "on", "by", "with", "at", "as", "from", "under"]);

const endsSentence = (l: string) => /[.:;”)\]]$/.test(l);
const isCaps = (l: string) => l.length <= 60 && /^[A-Z][A-Z ’'&,/()–-]*[A-Z)]$/.test(l);
const isTitle = (l: string) =>
  l.length <= 70 && /[a-z]/.test(l) && !/[.,;:“”]|\s{3}/.test(l) && l.split(" ").every((w, i) => /^[A-Z]/.test(w) || (i > 0 && (SMALL.has(w) || /^[–-]$/.test(w))));
const ITEM = /^\d+\.\s+(.+)$/;
const wraps = (heading: string) => /\s(and|or|of|to|for|the|[–-])$/.test(heading);

type Section = { path: string[]; term?: string; lines: string[] };

export function splitSections(body: string[]): Section[] {
  const lines = body.map((l) => l.trim()).filter(Boolean);
  const partStyle = lines.some((l) => /^PART [A-G] [–-] /.test(l));
  const sections: Section[] = [{ path: [], lines: [] }];
  let part = "";
  let sub = "";
  let item = "";
  let numberedSubs = false;
  let prev = "";
  let after: "part" | "heading" | null = "heading";
  const path = (term?: string) => [part, sub, item, term].filter((p): p is string => !!p);
  const open = (term?: string) => sections.push({ path: path(term), term, lines: [] });

  for (const line of lines) {
    const boundary = after !== null || endsSentence(prev);
    const definitions = /^DEFINITIONS$/.test(part) || /definition/i.test(sub);
    const term = boundary && definitions ? line.match(DEFINITION)?.[1] : undefined;
    const realTerm = term && !/^(A|An|The) /.test(term) ? term : undefined;
    const numbered = line.match(ITEM)?.[1];
    const isPart = partStyle ? /^PART [A-G] [–-] /.test(line) || (!part && line === "DEFINITIONS") : PART.test(line);
    if (boundary && isPart) {
      [part, sub, item, numberedSubs, after] = [line, "", "", false, "part"];
      open();
    } else if (!partStyle && after === "part" && line.length <= 25 && !/[.:;]/.test(line)) {
      part = `${part} ${line}`;
      sections.at(-1)!.path = path();
    } else if (after === "heading" && (wraps(item || sub) || /^[A-Z][a-z]+$/.test(line)) && (partStyle ? isCaps(line) : isTitle(line))) {
      if (item) item = `${item} ${line}`;
      else sub = `${sub} ${line}`;
      sections.at(-1)!.path = path();
    } else if (boundary && !numberedSubs && (partStyle ? isCaps(line) : isTitle(line))) {
      [sub, item, after] = [line, "", "heading"];
      open();
    } else if (boundary && numbered && !partStyle && isTitle(numbered)) {
      if (!sub || numberedSubs) [sub, item, numberedSubs] = [numbered, "", true];
      else item = numbered;
      after = "heading";
      open();
    } else if (realTerm) {
      open(realTerm);
      sections.at(-1)!.lines.push(line);
      after = null;
    } else {
      sections.at(-1)!.lines.push(line);
      after = null;
    }
    prev = line;
  }
  return sections.filter((s) => s.lines.length);
}

export function chunkPolicyForm(raw: string, providerId: string): PolicyFormChunk[] {
  const lines = raw.split("\n");
  const end = lines.findIndex((l) => !l.trim());
  const [citation = "", ...fields] = lines.slice(0, end);
  const meta = Object.fromEntries(fields.map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
  const product = meta.Product as PolicyProduct;
  if (!POLICY_PRODUCTS.includes(product) || !meta.Source || !meta.Form)
    throw new Error(`Policy form "${citation}" needs Form:, Product: (${POLICY_PRODUCTS.join(" | ")}) and Source: header lines`);
  return splitSections(lines.slice(end + 1)).flatMap(({ path: sectionPath, term, lines: sectionLines }) => {
    const texts = chunkLines(sectionLines, SECTION_CHARS);
    const section = sectionPath.join(" › ") || "Opening text";
    return texts.map((text, i) => ({
      providerId,
      product,
      form: meta.Form,
      citation,
      section: texts.length > 1 ? `${section} (part ${i + 1} of ${texts.length})` : section,
      ...(term ? { term } : {}),
      source: meta.Source,
      text,
    }));
  });
}

export function readPolicyForms(dataDir = path.join(process.cwd(), "data")): PolicyFormChunk[] {
  return PROVIDERS.filter((p) => existsSync(path.join(dataDir, p.id))).flatMap((p) =>
    readdirSync(path.join(dataDir, p.id))
      .filter((f) => f.endsWith(".txt"))
      .sort()
      .flatMap((f) => chunkPolicyForm(readFileSync(path.join(dataDir, p.id, f), "utf8"), p.id)),
  );
}

const normalizeForm = (f: string) => f.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function matchForms(declared: string[], forms: string[]): { matched: string[]; missing: string[] } {
  const hit = (d: string, f: string) => normalizeForm(d).includes(normalizeForm(f));
  return {
    matched: forms.filter((f) => declared.some((d) => hit(d, f))),
    missing: declared.filter((d) => !forms.some((f) => hit(d, f))),
  };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function definitionsFor(hit: PolicyFormChunk, definitions: PolicyFormChunk[], max = 3): { term: string; text: string }[] {
  const seen = new Set([hit.term?.toLowerCase()]);
  const part = hit.section.split(" › ")[0];
  const rank = (d: PolicyFormChunk) => (d.form === hit.form ? 1 : 0) + (d.form === hit.form && d.section.startsWith(part) ? 1 : 0);
  return definitions
    .filter((d) => {
      const term = d.term!;
      const quoted = new RegExp(`“${escape(term)}”`, "i").test(hit.text);
      return quoted || (term.includes(" ") && new RegExp(`\\b${escape(term)}\\b`, "i").test(hit.text));
    })
    .sort((a, b) => rank(b) - rank(a) || b.term!.length - a.term!.length)
    .filter((d) => !seen.has(d.term!.toLowerCase()) && seen.add(d.term!.toLowerCase()))
    .slice(0, max)
    .map((d) => ({ term: d.term!, text: d.text.slice(0, 600) }));
}

export const embeddingText = (c: PolicyFormChunk) => `${c.citation}\n${c.section}\n${c.text}`;

const chunkKey = (c: PolicyFormChunk) => `${c.form}\u0000${c.section}`;

export function fuseRankings(rankings: PolicyFormChunk[][], limit: number): PolicyFormChunk[] {
  const scores = new Map<string, { chunk: PolicyFormChunk; score: number }>();
  for (const ranking of rankings)
    ranking.forEach((chunk, rank) => {
      const entry = scores.get(chunkKey(chunk)) ?? { chunk, score: 0 };
      entry.score += 1 / (RRF_K + rank + 1);
      scores.set(chunkKey(chunk), entry);
    });
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit).map((e) => e.chunk);
}

export const rankByVector = (chunks: PolicyFormChunk[], queryVector: number[]) =>
  chunks
    .filter((c) => c.embedding?.length)
    .map((c) => ({ c, score: dot(queryVector, c.embedding!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES)
    .map((e) => e.c);

export const keywordRank = (index: Index<PolicyFormChunk>, query: string, inScope: (c: PolicyFormChunk) => boolean) =>
  search(index, query, { limit: CANDIDATES, filter: inScope });

let vectorsPausedUntil = 0;

async function vectorRanking(chunks: PolicyFormChunk[], query: string): Promise<PolicyFormChunk[]> {
  if (Date.now() < vectorsPausedUntil || !chunks.some((c) => c.embedding?.length)) return [];
  try {
    const [q] = await embed([query], "RETRIEVAL_QUERY");
    return rankByVector(chunks, q);
  } catch (err) {
    if (isQuotaError(err)) vectorsPausedUntil = Date.now() + 60_000;
    console.warn("Policy form search is keyword-only for now:", String((err as Error).message).slice(0, 200));
    return [];
  }
}

export const policyFormIndex = cachedIndex<PolicyFormChunk>(async () => {
  await connectDB();
  return PolicyForm.find({}, { _id: 0, __v: 0 }).sort({ _id: 1 }).lean();
}, "No policy forms in MongoDB. Run `npm run ingest`.");

export async function searchPolicyForms(
  query: string,
  { providerId, formNumbers = [], product = "personal_car", limit = 4 }: { providerId: string; formNumbers?: string[]; product?: PolicyProduct; limit?: number },
) {
  const index = await policyFormIndex();
  const forms = [...new Set(index.chunks.filter((c) => c.providerId === providerId).map((c) => c.form))];
  if (!forms.length) return null;
  const { matched, missing } = matchForms(formNumbers, forms);
  const inScope = (c: PolicyFormChunk) => c.providerId === providerId && (matched.length ? matched.includes(c.form) : c.product === product);
  const definitions = index.chunks.filter((c) => c.term && inScope(c));
  return {
    scope: matched.length ? ("policy_forms" as const) : ("insurer_standard" as const),
    matched,
    missing,
    hits: fuseRankings([keywordRank(index, query, inScope), await vectorRanking(index.chunks.filter(inScope), query)], limit).map((h) => ({
      ...h,
      embedding: undefined,
      definitions: definitionsFor(h, definitions),
    })),
  };
}
