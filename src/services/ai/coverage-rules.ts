import { z } from "zod";
import type { PolicyExtraction } from "@/schemas/policy";
import { COVERAGE_STATUSES, NOT_FOUND_IN_POLICY, PERILS, type CoverageStatus, type Peril } from "@/types";

export const COVERAGE_BASES = [
  "collision",
  "comprehensive",
  "liability",
  "deductibles",
  "rentalReimbursement",
  "roadsideAssistance",
  "otherCoverage",
  "exclusions",
] as const;

// What the coverage agent returns. `basis` names the policy field that backs the status.
export const AgentChecklistSchema = z.object({
  items: z.array(
    z.object({
      peril: z.enum(PERILS),
      status: z.enum(COVERAGE_STATUSES),
      basis: z.enum(COVERAGE_BASES).nullable().describe("Policy field that supports the status; null if none does"),
      detail: z.string().describe("One short plain-language sentence for the driver"),
      law: z.string().nullable().describe("Statute citation exactly as returned by search_insurance_law, or null"),
    }),
  ),
});
export type AgentChecklist = z.infer<typeof AgentChecklistSchema>;

export type CoverageItem = { peril: Peril; status: CoverageStatus; detail: string; law: { citation: string; url: string } | null };
export type StatuteRef = { citation: string; url: string };

const hasValue = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "");

/** Maps a model-written citation to a statute we actually have; anything else is dropped. */
export function resolveLaw(text: string | null, statutes: StatuteRef[]): StatuteRef | null {
  const num = text?.match(/§+\s*(\d+(?:\.\d+)*)/)?.[1] ?? text?.match(/\b(\d{3}\.\d{2,5})\b/)?.[1];
  if (!num) return null;
  const hit = statutes.find((s) => new RegExp(`§\\s*${num.replace(/\./g, "\\.")}(?![\\d.]*\\d)`).test(s.citation));
  if (!hit) return null;
  const usc = hit.citation.match(/^(\d+) U\.S\.C\./);
  return { citation: usc ? `${usc[1]} U.S.C. § ${num}` : `Fla. Stat. § ${num}`, url: hit.url };
}

/**
 * Deterministic guardrail on the agent's checklist: one row per peril in PERILS order, and "covered"
 * only when the named policy field really has a value. Anything unsupported becomes "unknown".
 */
export function enforceEvidence(agent: AgentChecklist, extraction: PolicyExtraction, statutes: StatuteRef[]): CoverageItem[] {
  return PERILS.map((peril) => {
    const row = agent.items.find((i) => i.peril === peril);
    if (!row) return { peril, status: "unknown", detail: NOT_FOUND_IN_POLICY, law: null };
    const backed = row.basis !== null && row.basis !== "exclusions" && hasValue(extraction[row.basis]);
    const status: CoverageStatus = row.status === "covered" && !backed ? "unknown" : row.status;
    const detail = status === row.status ? row.detail.trim() || NOT_FOUND_IN_POLICY : NOT_FOUND_IN_POLICY;
    return { peril, status, detail, law: resolveLaw(row.law, statutes) };
  });
}
