import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { connectDB } from "@/lib/db";
import { Statute } from "@/models/Statute";
import { JURISDICTIONS, type Jurisdiction } from "@/types";

export type StatuteChunk = { citation: string; url: string; jurisdiction: Jurisdiction; text: string };
export type StatuteHit = StatuteChunk & { score: number };

type Doc = { citation: string; section?: string; text: string };
export type Index<T extends Doc> = { chunks: T[]; tf: Map<string, number>[]; lengths: number[]; df: Map<string, number>; avgLength: number };

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
  return chunkLines(body.filter((l) => !l.trim().startsWith("History."))).map((text) => ({ citation, url, jurisdiction, text }));
}

export function chunkLines(lines: string[], maxChars = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let buf = "";
  for (const line of lines.map((l) => l.trim()).filter(Boolean)) {
    if (buf && buf.length + line.length > maxChars) {
      chunks.push(buf);
      buf = "";
    }
    buf = buf ? `${buf}\n${line}` : line;
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export function buildIndex<T extends Doc>(chunks: T[]): Index<T> {
  const df = new Map<string, number>();
  const tf = chunks.map((c) => {
    const counts = new Map<string, number>();
    for (const t of tokenize(`${c.citation}\n${c.section ?? ""}\n${c.text}`)) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return counts;
  });
  const lengths = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  return { chunks, tf, lengths, df, avgLength: lengths.reduce((a, b) => a + b, 0) / Math.max(chunks.length, 1) };
}

// ponytail: in-memory BM25 over ~70 statute files (~470 KB); move to embeddings + a vector index if the corpus grows or recall suffers.
export function search<T extends Doc>(index: Index<T>, query: string, opts: { filter?: (chunk: T) => boolean; limit?: number } = {}): (T & { score: number })[] {
  const terms = [...new Set(tokenize(query))];
  const n = index.chunks.length;
  const k1 = 1.2;
  const b = 0.75;
  const hits: (T & { score: number })[] = [];
  index.chunks.forEach((chunk, i) => {
    if (opts.filter && !opts.filter(chunk)) return;
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

export function readStatuteFiles(dataDir = path.join(process.cwd(), "data")): StatuteChunk[] {
  return JURISDICTIONS.flatMap((j) =>
    readdirSync(path.join(dataDir, j))
      .filter((f) => f.endsWith(".txt"))
      .sort()
      .flatMap((f) => chunkStatute(readFileSync(path.join(dataDir, j, f), "utf8"), j)),
  );
}

export function cachedIndex<T extends Doc>(load: () => Promise<T[]>, emptyError: string): () => Promise<Index<T>> {
  let cached: Promise<Index<T>> | undefined;
  return () =>
    (cached ??= load()
      .then((chunks) => {
        if (!chunks.length) throw new Error(emptyError);
        return buildIndex(chunks);
      })
      .catch((err) => {
        cached = undefined;
        throw err;
      }));
}

export const statuteIndex = cachedIndex<StatuteChunk>(async () => {
  await connectDB();
  return Statute.find({}, { _id: 0, citation: 1, url: 1, jurisdiction: 1, text: 1 }).sort({ _id: 1 }).lean();
}, "No statutes in MongoDB. Run `npm run ingest`.");

export const searchStatutes = async (query: string, { jurisdiction, limit }: { jurisdiction?: Jurisdiction; limit?: number } = {}): Promise<StatuteHit[]> =>
  search(await statuteIndex(), query, { limit, filter: jurisdiction && ((c) => c.jurisdiction === jurisdiction) });
