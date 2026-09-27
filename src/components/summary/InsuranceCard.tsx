import type { ReactNode } from "react";
import { TuxemonAvatar } from "@/components/chat/TuxemonAssistant";
import { Law, MonsterCredits } from "@/components/insurance/CoverageChecklist";
import { PERIL_MONSTERS } from "@/components/insurance/peril-monsters";
import { ProviderName } from "@/components/insurance/ProviderPicker";
import { RetroBadge, RetroCard, RetroLinkButton } from "@/components/retro";
import type { PolicyExtraction } from "@/schemas/policy";
import type { CoverageItem } from "@/services/ai/coverage-rules";
import type { InsuranceProvider } from "@/services/insurance/providers";
import { INCIDENT_PERIL, NOT_FOUND_IN_POLICY, PERIL_LABELS, type CoverageStatus, type IncidentType, type PolicyStatus } from "@/types";

type Tone = "neutral" | "warn" | "danger" | "ok";

export type PolicyView = { id: string; status: PolicyStatus; provider?: InsuranceProvider; extracted: PolicyExtraction | null; checklist: CoverageItem[] | null };

const POLICY_BADGE: Record<PolicyStatus, [Tone, string]> = {
  processing: ["warn", "Reading"],
  processed: ["ok", "On file"],
  failed: ["danger", "Can't read"],
};

const COVERAGE_BADGE: Record<CoverageStatus, [Tone, string]> = {
  covered: ["ok", "Covered"],
  not_covered: ["danger", "Not covered"],
  unknown: ["warn", "Not found"],
};

const COVERAGE_ORDER: CoverageStatus[] = ["covered", "unknown", "not_covered"];

const MAX_THREATS = 3;

const Badge = ({ tone }: { tone: [Tone, string] }) => <RetroBadge tone={tone[0]}>{tone[1]}</RetroBadge>;

function Facts({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="mt-2 space-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap gap-x-2">
          <dt className="text-ink-soft">{label}:</dt>
          <dd className={`min-w-0 break-words ${value ? "font-semibold text-ink tabular-nums" : "text-muted"}`}>{value || NOT_FOUND_IN_POLICY}</dd>
        </div>
      ))}
    </dl>
  );
}

function PolicyRow({ policy, badge, children }: { policy: PolicyView; badge: ReactNode; children?: ReactNode }) {
  return (
    <li className="rounded-lg border border-border p-3">
      <p className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{policy.provider ? <ProviderName provider={policy.provider} /> : "Unknown insurer"}</span>
        {badge}
      </p>
      {children}
    </li>
  );
}

function IncidentCoverage({ type, policies }: { type?: IncidentType | null; policies: PolicyView[] }) {
  if (!type) {
    return (
      <p className="rounded-lg bg-panel-shade px-3 py-2 text-sm text-ink">
        <a href="#incident" className="font-semibold text-accent underline underline-offset-2">
          Tell us what happened
        </a>{" "}
        to check if your {policies.length > 1 ? "policies cover" : "policy covers"} it.
      </p>
    );
  }
  const peril = INCIDENT_PERIL[type];
  if (!peril) return <p className="rounded-lg bg-panel-shade px-3 py-2 text-sm text-ink">This doesn&apos;t match one coverage type. Check your policy details.</p>;

  const rows = policies
    .map((p) => ({ p, row: p.checklist ? (p.checklist.find((i) => i.peril === peril) ?? { peril, status: "unknown" as const, detail: NOT_FOUND_IN_POLICY, law: null }) : null }))
    .sort((a, b) => (a.row ? COVERAGE_ORDER.indexOf(a.row.status) : 9) - (b.row ? COVERAGE_ORDER.indexOf(b.row.status) : 9));
  return (
    <>
      <p className="text-sm font-semibold text-ink">{PERIL_LABELS[peril]}</p>
      <ul className="space-y-2">
        {rows.map(({ p, row }) => (
          <PolicyRow
            key={p.id}
            policy={p}
            badge={<Badge tone={p.status !== "processed" ? POLICY_BADGE[p.status] : row ? COVERAGE_BADGE[row.status] : ["neutral", "Not checked"]} />}
          >
            {row ? (
              <>
                <p className="mt-1 text-sm text-ink-soft">{row.detail}</p>
                <Law law={row.law} />
              </>
            ) : (
              p.status === "processed" && <p className="mt-1 text-sm text-ink-soft">Coverage not checked yet. Open the policy to run the check.</p>
            )}
            {p.status === "processed" && <Facts rows={[["Deductible", p.extracted?.deductibles]]} />}
          </PolicyRow>
        ))}
      </ul>
    </>
  );
}

function CoverageGaps({ checklist, many }: { checklist: CoverageItem[] | null; many: boolean }) {
  if (!checklist) return <p className="text-sm text-ink-soft">We haven&apos;t checked which risks your {many ? "policies cover" : "policy covers"} yet.</p>;
  const threats = checklist.filter((i) => i.status !== "covered");
  if (!threats.length) {
    return <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">✓ Covered for all {checklist.length} risks we check</p>;
  }
  const shown = threats.slice(0, MAX_THREATS);
  return (
    <div>
      <p className="text-sm font-semibold text-ink">
        {threats.length} {threats.length === 1 ? "risk" : "risks"} {many ? "none of your policies cover or mention" : "your policy doesn't cover or mention"}
      </p>
      <ul className="mt-2 space-y-2">
        {shown.map((t) => {
          const m = PERIL_MONSTERS[t.peril];
          return (
            <li key={t.peril} className="flex items-center gap-3">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel-shade">
                <TuxemonAvatar frame="front" scale={1} sheet={m.sheet} label={m.name} />
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium text-ink">{PERIL_LABELS[t.peril]}</span>
                <span className="text-ink-soft">
                  <span className="font-display">{m.name}</span> may attack
                </span>
              </span>
              <Badge tone={COVERAGE_BADGE[t.status]} />
            </li>
          );
        })}
      </ul>
      {threats.length > MAX_THREATS && <p className="mt-2 text-sm text-ink-soft">+{threats.length - MAX_THREATS} more in your policy details</p>}
      <MonsterCredits items={shown} />
    </div>
  );
}

type Props = { policies: PolicyView[]; combined: CoverageItem[] | null; incident: { type?: IncidentType | null } | null };

export function InsuranceCard({ policies, combined, incident }: Props) {
  const many = policies.length > 1;
  const title = incident ? "Am I covered?" : many ? "Your policies" : "Your policy";
  if (!policies.length) {
    return (
      <RetroCard title={title}>
        <div className="space-y-3">
          <p className="font-semibold">No policy yet</p>
          <p className="text-sm text-ink-soft">Upload it so we can check your coverage and find your claim page.</p>
          <RetroLinkButton href="/insurance" className="w-full">
            Add your insurance
          </RetroLinkButton>
        </div>
      </RetroCard>
    );
  }

  return (
    <RetroCard title={title} action={many && <RetroBadge tone="neutral">{policies.length} active</RetroBadge>}>
      <div className="space-y-3">
        {incident ? (
          <IncidentCoverage type={incident.type} policies={policies} />
        ) : (
          <>
            <ul className="space-y-2">
              {policies.map((p) => (
                <PolicyRow key={p.id} policy={p} badge={<Badge tone={POLICY_BADGE[p.status]} />}>
                  {p.status === "processed" ? (
                    <Facts
                      rows={[
                        ["Deductible", p.extracted?.deductibles],
                        ["Policy number", p.extracted?.policyNumber],
                        ["Effective", p.extracted?.effectiveDates],
                      ]}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-ink-soft">
                      {p.status === "failed" ? "We couldn't read that PDF. Upload a clearer copy." : "Reading your policy…"}
                    </p>
                  )}
                </PolicyRow>
              ))}
            </ul>
            <CoverageGaps checklist={combined} many={many} />
          </>
        )}
        <RetroLinkButton href="/insurance" variant="secondary" className="w-full">
          {many ? "Manage policies" : "Policy details"}
        </RetroLinkButton>
      </div>
    </RetroCard>
  );
}
