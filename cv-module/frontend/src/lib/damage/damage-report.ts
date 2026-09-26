import { isPartId, type PartId } from "@/lib/car/car-parts";

import { buildDamageScale, type DamageLevel } from "./damage-scale";

export const VISUAL_SEVERITIES = ["minor", "moderate", "severe"] as const;
export type VisualSeverity = (typeof VISUAL_SEVERITIES)[number];

/** One damaged part as reported by the damage model. */
export type PartDamage = {
  partId: PartId;
  severity: VisualSeverity;
  damageTypes: string[];
};

export type DamageReport = {
  parts: PartDamage[];
};

/** A damaged part with its level and color already worked out, ready to draw. */
export type ResolvedPartDamage = PartDamage & {
  level: number;
  color: string;
};

const SEVERITY_RANK: Readonly<Record<VisualSeverity, number>> = {
  minor: 1,
  moderate: 2,
  severe: 3,
};

function isVisualSeverity(value: unknown): value is VisualSeverity {
  return (
    typeof value === "string" &&
    (VISUAL_SEVERITIES as readonly string[]).includes(value)
  );
}

export function severityToLevel(
  severity: VisualSeverity,
  levelCount: number,
): number {
  return Math.max(
    1,
    Math.ceil(
      (SEVERITY_RANK[severity] / VISUAL_SEVERITIES.length) * levelCount,
    ),
  );
}

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
    const { partId, severity, damageTypes } = (entry ?? {}) as {
      partId?: unknown;
      severity?: unknown;
      damageTypes?: unknown;
    };
    if (typeof partId !== "string" || !isPartId(partId)) {
      throw new Error(
        `parts[${index}]: unknown partId ${JSON.stringify(partId)}`,
      );
    }
    if (!isVisualSeverity(severity)) {
      throw new Error(`parts[${index}] (${partId}): unknown severity`);
    }
    if (
      !Array.isArray(damageTypes) ||
      !damageTypes.every((damageType) => typeof damageType === "string")
    ) {
      throw new Error(
        `parts[${index}] (${partId}): damageTypes must be strings`,
      );
    }
    if (seenPartIds.has(partId)) {
      throw new Error(`parts[${index}]: ${partId} is listed more than once`);
    }
    seenPartIds.add(partId);
    return { partId, severity, damageTypes: [...new Set(damageTypes)] };
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
    const level = severityToLevel(part.severity, scale.length);
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
  return [...damage.values()].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}

export function findingsToDamageReport(
  findings: ReadonlyArray<{
    part_id: PartId;
    damage_type: string;
    visual_severity: VisualSeverity;
  }>,
): DamageReport {
  const byPart = new Map<PartId, PartDamage>();
  for (const finding of findings) {
    const existing = byPart.get(finding.part_id);
    if (!existing) {
      byPart.set(finding.part_id, {
        partId: finding.part_id,
        severity: finding.visual_severity,
        damageTypes: [finding.damage_type],
      });
      continue;
    }
    if (
      SEVERITY_RANK[finding.visual_severity] > SEVERITY_RANK[existing.severity]
    ) {
      existing.severity = finding.visual_severity;
    }
    if (!existing.damageTypes.includes(finding.damage_type)) {
      existing.damageTypes.push(finding.damage_type);
    }
  }
  return { parts: [...byPart.values()] };
}
