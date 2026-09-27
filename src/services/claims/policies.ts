import type { CoverageItem } from "@/services/ai/coverage-rules";
import { INCIDENT_PERIL, NOT_FOUND_IN_POLICY, PERILS, type CoverageStatus, type IncidentType, type PolicyStatus } from "@/types";

type PolicyLike = { status: PolicyStatus; coverageChecklist?: unknown };

export const checklistOf = (policy: { coverageChecklist?: unknown } | null | undefined) =>
  (policy?.coverageChecklist as { items?: CoverageItem[] } | null | undefined)?.items ?? null;

const STATUS_RANK: PolicyStatus[] = ["processed", "processing", "failed"];

export function policiesStatus(policies: { status: PolicyStatus }[]): PolicyStatus | null {
  return STATUS_RANK.find((s) => policies.some((p) => p.status === s)) ?? null;
}

export function claimPolicy<P extends PolicyLike>(policies: P[], type?: IncidentType | null): P | null {
  const peril = type ? INCIDENT_PERIL[type] : null;
  const processed = policies.filter((p) => p.status === "processed");
  return processed.find((p) => peril && checklistOf(p)?.some((i) => i.peril === peril && i.status === "covered")) ?? processed[0] ?? policies[0] ?? null;
}

const COVERAGE_RANK: CoverageStatus[] = ["covered", "not_covered", "unknown"];

export function combinedCoverage(policies: PolicyLike[]): CoverageItem[] | null {
  const lists = policies.filter((p) => p.status === "processed").map(checklistOf).filter((l): l is CoverageItem[] => l !== null);
  if (!lists.length) return null;
  return PERILS.map((peril) => {
    const rows = lists.map((l) => l.find((i) => i.peril === peril)).filter((i): i is CoverageItem => Boolean(i));
    return COVERAGE_RANK.map((s) => rows.find((r) => r.status === s)).find(Boolean) ?? { peril, status: "unknown", detail: NOT_FOUND_IN_POLICY, law: null };
  });
}
