import "server-only";
import { gemini } from "./gemini";

export const EMBEDDING_MODEL = "gemini-embedding-2";
const DIMENSIONS = 768;
const CONCURRENCY = 8;
const PREFIX = { RETRIEVAL_QUERY: "task: search result | query: ", RETRIEVAL_DOCUMENT: "title: none | text: " };

const unit = (v: number[]) => {
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
};

export const isQuotaError = (err: unknown) => (err as { status?: number }).status === 429;

async function embedOne(text: string, quotaRetries: number): Promise<number[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await gemini().models.embedContent({ model: EMBEDDING_MODEL, contents: text, config: { outputDimensionality: DIMENSIONS } });
      return unit(res.embeddings?.[0]?.values ?? []);
    } catch (err) {
      if (!isQuotaError(err) || attempt >= quotaRetries) throw err;
      const wait = Math.min(15_000 * (attempt + 1), 60_000);
      console.warn(`Embedding quota reached; retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export async function embed(texts: string[], taskType: keyof typeof PREFIX, { quotaRetries = 0 } = {}): Promise<number[][]> {
  const out: number[][] = new Array(texts.length);
  let next = 0;
  const worker = async () => {
    while (next < texts.length) {
      const i = next++;
      out[i] = await embedOne(PREFIX[taskType] + texts[i], quotaRetries);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker));
  if (out.some((v) => v?.length !== DIMENSIONS)) throw new Error("Embedding response did not match the request");
  return out;
}

export const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
