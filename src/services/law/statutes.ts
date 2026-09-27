import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const JURISDICTIONS = ["florida", "federal"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export type StatuteChunk = { citation: string; url: string; jurisdiction: Jurisdiction; text: string };
export type StatuteHit = StatuteChunk & { score: number };

type Index = { chunks: StatuteChunk[]; tf: Map<string, number>[]; lengths: number[]; df: Map<string, number>; avgLength: number };

const CHUNK_CHARS = 1500;
const STOPWORDS = new Set(
  "a an and are as at be by for from has have if in is it its of on or shall such that the this to under was were which with any may not no".split(" "),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith("ies") ? `${t.slice(0, -3)}y` : t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

/** One file = header (citation, Source:, Retrieved:) + body; the body is split into ~1500-char chunks on line breaks. */
export function chunkStatute(raw: string, jurisdiction: Jurisdiction): StatuteChunk[] {
  const [citation = "", sourceLine = "", , ...body] = raw.split("\n");
  const url = sourceLine.replace(/^Source:\s*/, "").trim();
  const chunks: StatuteChunk[] = [];
  let buf = "";
  for (const line of body.map((l) => l.trim()).filter((l) => l && !l.startsWith("History."))) {
    if (buf && buf.length + line.length > CHUNK_CHARS) {
      chunks.push({ citation, url, jurisdiction, text: buf });
      buf = "";
    }
    buf = buf ? `${buf}\n${line}` : line;
  }
  if (buf) chunks.push({ citation, url, jurisdiction, text: buf });
  return chunks;
}

export function buildIndex(chunks: StatuteChunk[]): Index {
  const df = new Map<string, number>();
  const tf = chunks.map((c) => {
    const counts = new Map<string, number>();
    for (const t of tokenize(`${c.citation}\n${c.text}`)) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return counts;
  });
  const lengths = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  return { chunks, tf, lengths, df, avgLength: lengths.reduce((a, b) => a + b, 0) / Math.max(chunks.length, 1) };
}

// ponytail: in-memory BM25 over ~70 statute files (~470 KB); move to embeddings + a vector index if the corpus grows or recall suffers.
export function search(index: Index, query: string, opts: { jurisdiction?: Jurisdiction; limit?: number } = {}): StatuteHit[] {
  const terms = [...new Set(tokenize(query))];
  const n = index.chunks.length;
  const k1 = 1.2;
  const b = 0.75;
  const hits: StatuteHit[] = [];
  index.chunks.forEach((chunk, i) => {
    if (opts.jurisdiction && chunk.jurisdiction !== opts.jurisdiction) return;
    let score = 0;
    for (const t of terms) {
      const f = index.tf[i].get(t);
      if (!f) continue;
      const df = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * index.lengths[i]) / index.avgLength));
    }
    if (score > 0) hits.push({ ...chunk, score });
  });
  return hits.sort((x, y) => y.score - x.score).slice(0, opts.limit ?? 5);
}

let cached: Index | undefined;

export function statuteIndex(dataDir = path.join(process.cwd(), "data")): Index {
  if (cached) return cached;
  const chunks = JURISDICTIONS.flatMap((j) =>
    readdirSync(path.join(dataDir, j))
      .filter((f) => f.endsWith(".txt"))
      .sort()
      .flatMap((f) => chunkStatute(readFileSync(path.join(dataDir, j, f), "utf8"), j)),
  );
  return (cached = buildIndex(chunks));
}

export const searchStatutes = (query: string, opts?: { jurisdiction?: Jurisdiction; limit?: number }) => search(statuteIndex(), query, opts);
