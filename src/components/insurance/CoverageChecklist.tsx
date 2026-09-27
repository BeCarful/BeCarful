import type { CSSProperties } from "react";
import { TuxemonAttribution, TuxemonAvatar } from "@/components/chat/TuxemonAssistant";
import { RetroBadge, RetroCard } from "@/components/retro";
import type { CoverageItem } from "@/services/ai/coverage-rules";
import { PERIL_LABELS } from "@/types";
import { PERIL_MONSTERS } from "./peril-monsters";
import { RecheckCoverage } from "./RecheckCoverage";

const link = "underline decoration-dotted underline-offset-2 hover:text-accent";

export function Law({ law }: { law: CoverageItem["law"] }) {
  if (!law) return null;
  return (
    <a href={law.url} target="_blank" rel="noopener noreferrer" className={`mt-1 inline-block text-xs text-ink-soft ${link}`}>
      {law.citation} ↗
    </a>
  );
}

export function MonsterCredits({ items }: { items: CoverageItem[] }) {
  return <TuxemonAttribution monsters={[...new Set(items.map((i) => PERIL_MONSTERS[i.peril]))]} className="mt-4" />;
}

/** Uncovered risks as Tuxemon that "may attack", covered ones as a short checklist. */
export function CoverageChecklist({ vehicleId, items }: { vehicleId: string; items: CoverageItem[] | null }) {
  if (!items) {
    return (
      <RetroCard title="What could attack?">
        <p className="mb-4 text-sm text-ink-soft">We haven&apos;t checked which risks your policy covers yet.</p>
        <RecheckCoverage vehicleId={vehicleId} label="Check my coverage" />
      </RetroCard>
    );
  }
  const threats = items.filter((i) => i.status !== "covered");
  const covered = items.filter((i) => i.status === "covered");

  return (
    <div className="space-y-6">
      {threats.length > 0 && (
        <RetroCard
          title="Wild Tuxemon on your route"
          className="@container"
          action={
            <RetroBadge tone="danger">
              {threats.length} may attack
            </RetroBadge>
          }
        >
          <p className="mb-3 text-sm text-ink-soft">Risks your policy doesn&apos;t cover, or doesn&apos;t mention.</p>
          <ul className="grid gap-2 @2xl:grid-cols-2">
            {threats.map((t, i) => {
              const m = PERIL_MONSTERS[t.peril];
              return (
                <li key={t.peril} className="flex items-center gap-3 rounded-xl border border-border bg-panel p-3" style={{ "--tux-delay": `${i * 90}ms` } as CSSProperties}>
                  <span className="grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-lg bg-panel-shade">
                    <TuxemonAvatar frame="front" scale={1} sheet={m.sheet} label={m.name} className="tux-wild" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <span className="font-semibold">
                        <span className="font-display">{m.name}</span> may attack you
                      </span>
                      <RetroBadge tone={t.status === "not_covered" ? "danger" : "warn"}>
                        {t.status === "not_covered" ? "Not covered" : "Not found"}
                      </RetroBadge>
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-ink">{PERIL_LABELS[t.peril]}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{t.detail}</p>
                    <Law law={t.law} />
                  </div>
                </li>
              );
            })}
          </ul>
          <MonsterCredits items={threats} />
        </RetroCard>
      )}

      {covered.length > 0 && (
        <RetroCard title="You're protected against" className="@container" action={<RetroBadge tone="ok">{covered.length} covered</RetroBadge>}>
          <ul className="grid gap-2 @2xl:grid-cols-2">
            {covered.map((c) => (
              <li key={c.peril} className="flex gap-3 rounded-lg bg-ok-soft/60 px-3 py-2">
                <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ok text-[11px] font-bold text-white">
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{PERIL_LABELS[c.peril]}</p>
                  <p className="text-sm text-ink-soft">{c.detail}</p>
                  <Law law={c.law} />
                </div>
              </li>
            ))}
          </ul>
        </RetroCard>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink">
        <span className="flex-1">Checked by AI against your policy and Florida/federal law. Your policy document is the final word.</span>
        <RecheckCoverage vehicleId={vehicleId} label="Check again" subtle />
      </div>
    </div>
  );
}
