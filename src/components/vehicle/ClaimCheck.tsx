import { RetroBadge } from "@/components/retro";
import type { CheckStatus, ClaimCheckItem, ClaimVerdict } from "@/services/claims/claim-check";

const VERDICT: Record<ClaimVerdict, { tone: "ok" | "warn" | "danger"; label: string; line: (fixes: number) => string }> = {
  supported: { tone: "ok", label: "Well supported", line: () => "Your evidence and policy line up." },
  gaps: { tone: "warn", label: "Some gaps", line: (n) => `${n} ${n === 1 ? "thing" : "things"} could slow your claim down.` },
  at_risk: { tone: "danger", label: "At risk", line: () => "Something here could get your claim denied." },
};

const MARK: Record<CheckStatus, { icon: string; className: string; label: string }> = {
  ok: { icon: "✓", className: "bg-ok-soft text-ok", label: "OK" },
  warn: { icon: "!", className: "bg-warn-soft text-warn", label: "Check" },
  fail: { icon: "✕", className: "bg-danger-soft text-danger", label: "Problem" },
  info: { icon: "i", className: "bg-panel-shade text-ink-soft", label: "Note" },
};

export function ClaimCheck({ verdict, items }: { verdict: ClaimVerdict; items: ClaimCheckItem[] }) {
  const v = VERDICT[verdict];
  const fixes = items.filter((i) => i.status === "warn" || i.status === "fail").length;
  return (
    <details id="claim-check" className="group surface-card scroll-mt-24">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold text-ink">Claim check</span>
            <RetroBadge tone={v.tone}>{v.label}</RetroBadge>
          </span>
          <span className="mt-0.5 block text-sm text-ink-soft">{v.line(fixes)}</span>
        </span>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="px-5 pb-5">
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="flex gap-3 py-3 first:pt-0">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${MARK[i.status].className}`}>
                <span aria-hidden>{MARK[i.status].icon}</span>
                <span className="sr-only">{MARK[i.status].label}:</span>
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold break-words text-ink">{i.title}</p>
                {i.detail && <p className="mt-0.5 break-words text-ink-soft">{i.detail}</p>}
                {i.law && (
                  <a href={i.law.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-accent underline">
                    {i.law.citation}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 rounded-lg bg-panel-shade px-3 py-2 text-xs text-ink-soft">
          This checks your photos and policy for common reasons claims get delayed or denied. It isn&apos;t a prediction: your insurer decides the claim.
        </p>
      </div>
    </details>
  );
}
