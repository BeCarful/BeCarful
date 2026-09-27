import "server-only";
import { gemini } from "./gemini";

export const EMBEDDING_MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;
const BATCH = 50;

const unit = (v: number[]) => {
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
};

export const isQuotaError = (err: unknown) => (err as { status?: number }).status === 429;

export async function embed(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY", { quotaRetries = 0 } = {}): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await gemini().models.embedContent({
          model: EMBEDDING_MODEL,
          contents: texts.slice(i, i + BATCH),
          config: { taskType, outputDimensionality: DIMENSIONS },
        });
        out.push(...(res.embeddings ?? []).map((e) => unit(e.values ?? [])));
        break;
      } catch (err) {
        if (!isQuotaError(err) || attempt >= quotaRetries) throw err;
        const wait = Math.min(15_000 * (attempt + 1), 60_000);
        console.warn(`Embedding quota reached at ${i}/${texts.length}; retrying in ${wait / 1000}s`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  if (out.length !== texts.length || out.some((v) => v.length !== DIMENSIONS)) throw new Error("Embedding response did not match the request");
  return out;
}

export const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
