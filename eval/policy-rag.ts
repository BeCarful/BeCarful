import mongoose from "mongoose";
import { embed } from "@/services/ai/embeddings";
import { fuseRankings, keywordRank, policyFormIndex, rankByVector, type PolicyFormChunk } from "@/services/insurance/policy-forms";
import { matches, readCases } from "./cases";

const K = 4;

async function main() {
  const cases = readCases();
  const index = await policyFormIndex();
  const vectors = await embed(cases.map((c) => c.q), "RETRIEVAL_QUERY", { quotaRetries: 10 });
  const score = { keyword: 0, vector: 0, hybrid: 0 };
  cases.forEach((c, i) => {
    const inScope = (ch: PolicyFormChunk) => ch.providerId === "state-farm" && ch.product === c.product;
    const keyword = keywordRank(index, c.q, inScope);
    const vector = rankByVector(index.chunks.filter(inScope), vectors[i]);
    const hybrid = fuseRankings([keyword, vector], K);
    const hit = (list: PolicyFormChunk[]) => list.slice(0, K).some((ch) => matches(c, ch));
    const [k, v, h] = [hit(keyword), hit(vector), hit(hybrid)];
    score.keyword += Number(k);
    score.vector += Number(v);
    score.hybrid += Number(h);
    if (!k || !v || !h) console.log(`${k ? "✓" : "✗"} keyword  ${v ? "✓" : "✗"} vector  ${h ? "✓" : "✗"} hybrid  ${c.q}`);
  });
  const n = cases.length;
  console.log(`hit@${K}: keyword ${score.keyword}/${n}, vector ${score.vector}/${n}, hybrid ${score.hybrid}/${n}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
