import { readFileSync } from "node:fs";
import path from "node:path";
import type { PolicyFormChunk } from "@/services/insurance/policy-forms";
import { POLICY_PRODUCTS, type PolicyProduct } from "@/types";

export type RetrievalCase = { q: string; product: PolicyProduct; form?: RegExp; section?: RegExp; text?: RegExp };

const HEADER = "question,product,form,section,text";

const parseLine = (line: string) => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map((m) => m[1]?.replace(/""/g, '"') ?? m[2]);

const pattern = (cell: string) => (cell ? new RegExp(cell, "i") : undefined);

export function readCases(file = path.join(process.cwd(), "eval", "policy-rag.csv")): RetrievalCase[] {
  const [header, ...lines] = readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim());
  if (header !== HEADER) throw new Error(`${file}: the header must be ${HEADER}`);
  return lines.map((line, i) => {
    const cells = parseLine(line);
    const [q, product, form, section, text] = cells;
    if (cells.length !== 5 || !q || !POLICY_PRODUCTS.includes(product as PolicyProduct)) throw new Error(`${file}:${i + 2}: expected ${HEADER}`);
    return { q, product: product as PolicyProduct, form: pattern(form), section: pattern(section), text: pattern(text) };
  });
}

export const matches = (c: RetrievalCase, chunk: PolicyFormChunk) =>
  (!c.form || c.form.test(chunk.form)) && (!c.section || c.section.test(chunk.section)) && (!c.text || c.text.test(chunk.text));
