import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PolicyForm } from "@/models/PolicyForm";
import { Statute } from "@/models/Statute";
import { embed } from "@/services/ai/embeddings";
import { embeddingText, readPolicyForms } from "@/services/insurance/policy-forms";
import { readStatuteFiles } from "@/services/law/statutes";

async function main() {
  const statutes = readStatuteFiles();
  const chunks = readPolicyForms();
  const vectors = await embed(chunks.map(embeddingText), "RETRIEVAL_DOCUMENT", { quotaRetries: 10 });
  const forms = chunks.map((c, i) => ({ ...c, embedding: vectors[i] }));
  await connectDB();
  await Statute.deleteMany({});
  await Statute.insertMany(statutes);
  await PolicyForm.deleteMany({});
  await PolicyForm.insertMany(forms);
  const count = (chunks: { citation: string }[]) => new Set(chunks.map((c) => c.citation)).size;
  console.log(`Ingested ${statutes.length} chunks from ${count(statutes)} statutes and ${forms.length} chunks from ${count(forms)} policy forms.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
