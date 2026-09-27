import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "danger" | "ok" | "warn";

const tones: Record<Tone, string> = {
  neutral: "bg-panel-shade text-ink-soft",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
};

export function RetroBadge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
