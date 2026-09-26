import { SEVERITIES, type AggregatedDamage, type ComponentId, type DamagedComponent } from "@/types";

type AssessmentLike = { photoId: { toString(): string } | string; damagedComponents: DamagedComponent[] };

const rank = (s: DamagedComponent["severity"]) => SEVERITIES.indexOf(s);

/** Merge per-photo assessments into one entry per component (worst severity wins). Most severe first. */
export function aggregateDamage(assessments: AssessmentLike[]): AggregatedDamage[] {
  const byComponent = new Map<ComponentId, AggregatedDamage>();
  for (const a of assessments) {
    const photoId = a.photoId.toString();
    for (const sub of a.damagedComponents) {
      // Copy fields explicitly: spreading a Mongoose subdocument drops them.
      const c: DamagedComponent = {
        component: sub.component,
        damageTypes: [...sub.damageTypes],
        severity: sub.severity,
        confidence: sub.confidence,
        description: sub.description,
      };
      const prev = byComponent.get(c.component);
      if (!prev) {
        byComponent.set(c.component, { ...c, photoIds: [photoId] });
        continue;
      }
      const worse = rank(c.severity) > rank(prev.severity) || (rank(c.severity) === rank(prev.severity) && c.confidence > prev.confidence);
      byComponent.set(c.component, {
        ...(worse ? c : prev),
        damageTypes: [...new Set([...prev.damageTypes, ...c.damageTypes])],
        confidence: Math.max(prev.confidence, c.confidence),
        photoIds: prev.photoIds.includes(photoId) ? prev.photoIds : [...prev.photoIds, photoId],
      });
    }
  }
  return [...byComponent.values()].sort((a, b) => rank(b.severity) - rank(a.severity) || b.confidence - a.confidence);
}

/** "front-left side", "rear", "roof"... for human copy. */
export function areaLabel(component: ComponentId): string {
  const side = component.includes("left") ? "left" : component.includes("right") ? "right" : "";
  const end = /front|hood|windshield|headlight/.test(component) ? "front" : /rear|trunk|taillight/.test(component) ? "rear" : "";
  if (end && side) return `${end}-${side} side`;
  if (side) return `${side} side`;
  if (end) return end;
  return component.replace(/_/g, " ");
}
