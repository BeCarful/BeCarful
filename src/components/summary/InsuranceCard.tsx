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

const MAX_THREATS = 3;

function Facts({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="divide-y divide-border text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="py-2 first:pt-0 last:pb-0">
          <dt className="text-xs font-medium text-ink-soft">{label}</dt>
          <dd className={`mt-0.5 break-words ${value ? "font-semibold text-ink tabular-nums" : "text-muted"}`}>{value || NOT_FOUND_IN_POLICY}</dd>
        </div>
      ))}
    </dl>
  );
}

function IncidentCoverage({ type, checklist }: { type?: IncidentType | null; checklist: CoverageItem[] | null }) {
  const peril = type ? INCIDENT_PERIL[type] : null;
  if (!type) {
    return (
      <p className="rounded-lg bg-panel-shade px-3 py-2 text-sm text-ink">
        <a href="#incident" className="font-semibold text-accent underline underline-offset-2">
          Tell us what happened
        </a>{" "}
        to check if your policy covers it.
      </p>
    );
  }
  if (!peril) return <p className="rounded-lg bg-panel-shade px-3 py-2 text-sm text-ink">This doesn&apos;t match one coverage type. Check your policy details.</p>;
  if (!checklist) return <p className="rounded-lg bg-panel-shade px-3 py-2 text-sm text-ink">We haven&apos;t checked your coverage yet. Open your policy details to run the check.</p>;

  const row = checklist.find((i) => i.peril === peril) ?? { peril, status: "unknown", detail: NOT_FOUND_IN_POLICY, law: null };
  const [tone, label] = COVERAGE_BADGE[row.status];
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{PERIL_LABELS[peril]}</span>
        <RetroBadge tone={tone}>{label}</RetroBadge>
      </p>
      <p className="mt-1 text-sm text-ink-soft">{row.detail}</p>
      <Law law={row.law} />
    </div>
  );
}

function CoverageGaps({ checklist }: { checklist: CoverageItem[] | null }) {
  if (!checklist) return <p className="text-sm text-ink-soft">We haven&apos;t checked which risks your policy covers yet.</p>;
  const threats = checklist.filter((i) => i.status !== "covered");
  if (!threats.length) {
    return <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">✓ Covered for all {checklist.length} risks we check</p>;
  }
  const shown = threats.slice(0, MAX_THREATS);
  return (
    <div>
      <p className="text-sm font-semibold text-ink">
        {threats.length} {threats.length === 1 ? "risk isn't" : "risks aren't"} covered or mentioned
      </p>
      <ul className="mt-2 space-y-2">
        {shown.map((t) => {
          const m = PERIL_MONSTERS[t.peril];
          const [tone, label] = COVERAGE_BADGE[t.status];
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
              <RetroBadge tone={tone}>{label}</RetroBadge>
            </li>
          );
        })}
      </ul>
      {threats.length > MAX_THREATS && <p className="mt-2 text-sm text-ink-soft">+{threats.length - MAX_THREATS} more in your policy details</p>}
      <MonsterCredits items={shown} />
    </div>
  );
}

type Props = {
  policy: { status: PolicyStatus } | null;
  provider?: InsuranceProvider;
  extracted?: PolicyExtraction | null;
  checklist: CoverageItem[] | null;
  incident: { type?: IncidentType | null } | null;
};

export function InsuranceCard({ policy, provider, extracted, checklist, incident }: Props) {
  const title = incident ? "Am I covered?" : "Your policy";
  if (!policy) {
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

  const [tone, label] = POLICY_BADGE[policy.status];
  return (
    <RetroCard title={title} action={<RetroBadge tone={tone}>{label}</RetroBadge>}>
      <div className="space-y-3">
        <p className="text-lg leading-tight font-semibold">{provider ? <ProviderName provider={provider} /> : "Unknown insurer"}</p>
        {policy.status !== "processed" ? (
          <p className="text-sm text-ink-soft">
            {policy.status === "failed" ? "We couldn't read that PDF. Upload a clearer copy." : "Reading your policy…"}
          </p>
        ) : incident ? (
          <>
            <IncidentCoverage type={incident.type} checklist={checklist} />
            <Facts
              rows={[
                ["Deductible", extracted?.deductibles],
                ["Policy number", extracted?.policyNumber],
              ]}
            />
          </>
        ) : (
          <>
            <Facts
              rows={[
                ["Deductible", extracted?.deductibles],
                ["Policy number", extracted?.policyNumber],
                ["Effective dates", extracted?.effectiveDates],
              ]}
            />
            <CoverageGaps checklist={checklist} />
          </>
        )}
        <RetroLinkButton href="/insurance" variant="secondary" className="w-full">
          {policy.status === "failed" ? "Re-upload policy" : "Policy details"}
        </RetroLinkButton>
      </div>
    </RetroCard>
  );
}
