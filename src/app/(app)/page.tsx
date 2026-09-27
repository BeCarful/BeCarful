import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { RetroBadge, RetroCard, RetroLinkButton } from "@/components/retro";
import { ProviderName } from "@/components/insurance/ProviderPicker";
import { ClaimActions } from "@/components/summary/ClaimActions";
import { IncidentForm } from "@/components/summary/IncidentForm";
import { StatusPanel } from "@/components/summary/StatusPanel";
import { TodoCard } from "@/components/summary/TodoCard";
import type { PolicyExtraction } from "@/schemas/policy";
import { areaLabel } from "@/services/claims/damage";
import { loadClaimState } from "@/services/claims/state";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";
import { NOT_FOUND_IN_POLICY, componentLabel, type PolicyStatus, type Severity } from "@/types";

export const metadata: Metadata = { title: "Summary · BeCarful" };

type Tone = "neutral" | "warn" | "danger" | "ok";

const SEVERITY_TONE: Record<Severity, Tone> = { minor: "neutral", moderate: "warn", severe: "danger" };

const POLICY_BADGE: Record<PolicyStatus, [Tone, string]> = {
  processing: ["warn", "Reading"],
  processed: ["ok", "On file"],
  failed: ["danger", "Can't read"],
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function SummaryPage() {
  const { user, selected } = await getVehicleContext();
  if (!selected) redirect("/vehicles/new");

  const { todos, policy, provider, incident, photos, assessments, damage } = await loadClaimState(user._id, selected._id);
  const vehicleId = selected._id.toString();
  const extracted = policy?.extractedData as PolicyExtraction | null | undefined;
  const top = damage[0];
  const analyzing = photos.filter((p) => p.analysisStatus === "pending" || p.analysisStatus === "analyzing").length;
  const needsReview = assessments.some((a) => a.needsManualReview);
  const policyBadge = policy ? POLICY_BADGE[policy.status] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claim summary"
        title="Your claim at a glance"
        description={`${vehicleTitle(selected)}: what happened, what your policy says, and what to do next.`}
      />

      <StatusPanel status={incident?.status ?? null} items={todos.items} />

      <div className="@container">
        <div className="grid gap-6 @xl:grid-cols-2 @4xl:grid-cols-3">
          <RetroCard title="Your Car">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg leading-tight font-semibold">{vehicleTitle(selected)}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {selected.color} · {selected.licensePlate} ({selected.state})
                </p>
              </div>
              <Image src="/scenery/car.svg" alt="" width={96} height={44} unoptimized className="pixelated mt-1 w-20 shrink-0" />
            </div>
          </RetroCard>

          <RetroCard title="Damage" action={needsReview && <RetroBadge tone="warn">Needs review</RetroBadge>}>
            <div className="space-y-2">
              {top ? (
                <>
                  <p className="flex items-baseline gap-2">
                    <span className="font-display text-4xl leading-none font-semibold text-danger tabular-nums">{damage.length}</span>
                    damaged {damage.length === 1 ? "part" : "parts"}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    Worst: <strong className="text-ink">{componentLabel(top.component)}</strong>
                    <RetroBadge tone={SEVERITY_TONE[top.severity]}>{top.severity}</RetroBadge>
                  </p>
                  <p className="text-sm text-ink-soft">
                    Around the {areaLabel(top.component)} · {plural(photos.length, "photo")}
                  </p>
                  {analyzing > 0 && <p className="text-sm text-ink-soft">Checking {plural(analyzing, "more photo")}…</p>}
                </>
              ) : (
                <>
                  <p className="font-semibold">No damage recorded</p>
                  <p className="text-sm text-ink-soft">
                    {analyzing > 0
                      ? `Checking ${plural(analyzing, "photo")}…`
                      : photos.length > 0
                        ? `Nothing visible in ${plural(photos.length, "photo")}.`
                        : "Take photos if something happened to your car."}
                  </p>
                </>
              )}
              {needsReview && (
                <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-ink">
                  Some photos were unclear. An adjuster may need to inspect the car.
                </p>
              )}
              <RetroLinkButton href="/garage" variant="secondary" className="mt-2 w-full">
                {top ? "See it on your car" : "Add photos"}
              </RetroLinkButton>
            </div>
          </RetroCard>

          <RetroCard title="Insurance" action={policyBadge && <RetroBadge tone={policyBadge[0]}>{policyBadge[1]}</RetroBadge>}>
            {policy ? (
              <div className="space-y-3">
                <p className="text-lg leading-tight font-semibold">{provider ? <ProviderName provider={provider} /> : "Unknown insurer"}</p>
                {policy.status === "processed" ? (
                  <dl className="divide-y divide-border text-sm">
                    {(
                      [
                        ["Collision", extracted?.collision],
                        ["Comprehensive", extracted?.comprehensive],
                        ["Deductible", extracted?.deductibles],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="py-2 first:pt-0 last:pb-0">
                        <dt className="text-xs font-medium text-ink-soft">{label}</dt>
                        <dd className={`mt-0.5 break-words ${value ? "font-semibold text-ink tabular-nums" : "text-muted"}`}>
                          {value || NOT_FOUND_IN_POLICY}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-ink-soft">
                    {policy.status === "failed" ? "We couldn't read that PDF. Upload a clearer copy." : "Reading your policy…"}
                  </p>
                )}
                <RetroLinkButton href="/insurance" variant="secondary" className="w-full">
                  {policy.status === "failed" ? "Re-upload policy" : "Policy details"}
                </RetroLinkButton>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-semibold">No policy yet</p>
                <p className="text-sm text-ink-soft">Upload it so we can check your coverage and find your claim page.</p>
                <RetroLinkButton href="/insurance" className="w-full">
                  Add your insurance
                </RetroLinkButton>
              </div>
            )}
          </RetroCard>
        </div>
      </div>

      <div className={`grid items-start gap-6 ${incident ? "lg:grid-cols-2" : ""}`}>
        <TodoCard items={todos.items} provider={provider}>
          <ClaimActions
            vehicleId={vehicleId}
            todos={todos}
            provider={provider}
            policyNumber={extracted?.policyNumber}
            photoCount={photos.length}
            incident={incident}
          />
        </TodoCard>

        {incident && (
          <RetroCard id="incident" title="Incident details" className="scroll-mt-24">
            <p className="-mt-1 mb-4 text-sm text-ink-soft">Your insurer will ask for these.</p>
            <IncidentForm
              vehicleId={vehicleId}
              now={new Date().toISOString()}
              initial={{
                type: incident.type ?? null,
                occurredAt: incident.occurredAt?.toISOString() ?? null,
                location: incident.location ?? "",
                notes: incident.notes ?? "",
              }}
            />
          </RetroCard>
        )}
      </div>
    </div>
  );
}
