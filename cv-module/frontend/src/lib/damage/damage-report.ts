import { isPartId, type PartId } from "@/lib/car/car-parts";

import {
  buildDamageScale,
  type DamageLevel,
  scoreToLevel,
} from "./damage-scale";

/** One damaged part as reported by the damage model. */
export type PartDamage = {
  partId: PartId;
  /** 0 (barely damaged) to 1 (most severe). */
  score: number;
};

export type DamageReport = {
  parts: PartDamage[];
};

/** A damaged part with its level and color already worked out, ready to draw. */
export type ResolvedPartDamage = PartDamage & {
  level: number;
  color: string;
};

/**
 * Checks untrusted data (e.g. an API response) and returns a typed report.
 * Throws with a clear message on the first problem instead of guessing.
 */
export function parseDamageReport(data: unknown): DamageReport {
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as { parts?: unknown }).parts)
  ) {
    throw new Error("Damage report must be an object with a `parts` array");
  }

  const seenPartIds = new Set<PartId>();
  const parts = (data as { parts: unknown[] }).parts.map((entry, index) => {
    const { partId, score } = (entry ?? {}) as {
      partId?: unknown;
      score?: unknown;
    };
    if (typeof partId !== "string" || !isPartId(partId)) {
      throw new Error(
        `parts[${index}]: unknown partId ${JSON.stringify(partId)}`,
      );
    }
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 1
    ) {
      throw new Error(
        `parts[${index}] (${partId}): score must be a number from 0 to 1`,
      );
    }
    if (seenPartIds.has(partId)) {
      throw new Error(`parts[${index}]: ${partId} is listed more than once`);
    }
    seenPartIds.add(partId);
    return { partId, score };
  });

  return { parts };
}

/**
 * Adds level and color to each damaged part and indexes them by part ID.
 */
export function resolveDamage(
  report: DamageReport,
  scale: DamageLevel[] = buildDamageScale(),
): Map<PartId, ResolvedPartDamage> {
  const resolved = new Map<PartId, ResolvedPartDamage>();
  for (const part of report.parts) {
    const level = scoreToLevel(part.score, scale.length);
    resolved.set(part.partId, {
      ...part,
      level,
      color: scale[level - 1].color,
    });
  }
  return resolved;
}

/** Damaged parts ordered from most to least severe, for the list in the UI. */
export function sortBySeverity(
  damage: Map<PartId, ResolvedPartDamage>,
): ResolvedPartDamage[] {
  return [...damage.values()].sort((a, b) => b.score - a.score);
}
