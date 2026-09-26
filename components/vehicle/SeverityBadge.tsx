import { RetroBadge } from "@/components/retro";
import { componentLabel, type DamagedComponent, type Severity } from "@/types";

export const confidenceLabel = (c: number) => `${Math.round(c * 100)}%`;
export const LOW_CONFIDENCE = 0.6;

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <RetroBadge tone={severity === "minor" ? "warn" : "danger"} className={`capitalize ${severity === "severe" ? "bg-danger! text-panel!" : ""}`}>
      {severity}
    </RetroBadge>
  );
}

export function DamageList({ items }: { items: DamagedComponent[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((c) => (
        <li key={c.component} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
          <span className="font-medium">{componentLabel(c.component)}</span>
          <span className="flex shrink-0 items-center gap-2">
            <SeverityBadge severity={c.severity} />
            <span className="w-9 text-right text-xs tabular-nums text-ink-soft" title="AI confidence">
              {confidenceLabel(c.confidence)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
