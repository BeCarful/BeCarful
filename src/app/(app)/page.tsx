import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { RetroCard, RetroLinkButton, retroButtonClass } from "@/components/retro";
import { CallButton, ClaimActions } from "@/components/summary/ClaimActions";
import { DamageCard } from "@/components/summary/DamageCard";
import { IncidentForm } from "@/components/summary/IncidentForm";
import { InsuranceCard } from "@/components/summary/InsuranceCard";
import { StatusPanel } from "@/components/summary/StatusPanel";
import { TodoCard } from "@/components/summary/TodoCard";
import type { PolicyExtraction } from "@/schemas/policy";
import type { CoverageItem } from "@/services/ai/coverage-rules";
import { loadClaimState } from "@/services/claims/state";
import { isOfficialUrl } from "@/services/insurance/providers";
import { getViewUrl } from "@/services/storage/gcs";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";

export const metadata: Metadata = { title: "Summary · BeCarful" };

export default async function SummaryPage() {
  const { user, selected } = await getVehicleContext();
  if (!selected) redirect("/vehicles/new");

  const { todos, policy, provider, incident, photos, assessments, damage } = await loadClaimState(user._id, selected._id);
  const vehicleId = selected._id.toString();
  const extracted = policy?.extractedData as PolicyExtraction | null | undefined;
  const checklist = (policy?.coverageChecklist as { items?: CoverageItem[] } | null)?.items ?? null;
  const recentPhotos = await Promise.all(photos.slice(0, 4).map(async (p) => ({ id: p._id.toString(), url: await getViewUrl(p.s3Key) })));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Summary" title={vehicleTitle(selected)} description={`${selected.color} · ${selected.licensePlate} (${selected.state})`} />

      <StatusPanel incident={incident} items={todos.items} />

      <div className="@container">
        <div className="grid items-start gap-6 @xl:grid-cols-2">
          {incident && (
            <DamageCard
              vehicleId={vehicleId}
              damage={damage}
              photos={recentPhotos}
              photoCount={photos.length}
              analyzing={photos.filter((p) => p.analysisStatus === "pending" || p.analysisStatus === "analyzing").length}
              needsReview={assessments.some((a) => a.needsManualReview)}
            />
          )}
          <InsuranceCard policy={policy} provider={provider} extracted={extracted} checklist={checklist} incident={incident} />
          {!incident && (
            <RetroCard title="If something happens">
              <p className="text-sm text-ink-soft">Crash mode walks you through Florida&apos;s at-the-scene steps, then helps you photograph the damage.</p>
              <div className="mt-4 grid gap-3">
                <RetroLinkButton href="/crash" variant="danger" className="w-full">
                  Crash mode
                </RetroLinkButton>
                {provider && <CallButton provider={provider} />}
                {provider && isOfficialUrl(provider, provider.claimsUrl) && (
                  <a href={provider.claimsUrl} target="_blank" rel="noopener noreferrer" className={retroButtonClass("secondary", "w-full")}>
                    {provider.name} claims page <span aria-hidden>↗</span>
                    <span className="sr-only">(opens {provider.name} in a new tab)</span>
                  </a>
                )}
              </div>
            </RetroCard>
          )}
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
