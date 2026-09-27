import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { RetroCard, RetroLinkButton, retroButtonClass } from "@/components/retro";
import { CallButton, ClaimActions } from "@/components/summary/ClaimActions";
import { DamageCard } from "@/components/summary/DamageCard";
import { Deadlines } from "@/components/summary/Deadlines";
import { IncidentForm } from "@/components/summary/IncidentForm";
import { ShareEvidence } from "@/components/summary/ShareEvidence";
import { CarSwitcher } from "@/components/summary/CarSwitcher";
import { InsuranceCard, type PolicyView } from "@/components/summary/InsuranceCard";
import { StatusPanel } from "@/components/summary/StatusPanel";
import { TodoCard } from "@/components/summary/TodoCard";
import { PolicyExtractionSchema, type PolicyExtraction } from "@/schemas/policy";
import { damagePhotoCount } from "@/services/claims/damage";
import { claimDeadlines } from "@/services/claims/deadlines";
import { checklistOf, combinedCoverage } from "@/services/claims/policies";
import { loadClaimState } from "@/services/claims/state";
import { getProvider, isOfficialUrl, type InsuranceProvider } from "@/services/insurance/providers";
import { listShareLinks } from "@/services/share/evidence";
import { getViewUrl } from "@/services/storage/gcs";
import { getVehicleContext, vehicleModel, vehicleTitle } from "@/services/vehicles/context";

export const metadata: Metadata = { title: "Summary · BeCarful" };

export default async function SummaryPage() {
  const { user, vehicles, selected } = await getVehicleContext();
  if (!selected) redirect("/vehicles/new");

  const { todos, policies, policy, provider, incident, photos, assessments, damage } = await loadClaimState(user._id, selected._id);
  const vehicleId = selected._id.toString();
  const extracted = policy?.extractedData as PolicyExtraction | null | undefined;
  const policyViews: PolicyView[] = policies.map((p) => ({
    id: String(p._id),
    status: p.status,
    provider: getProvider(p.providerId),
    extracted: PolicyExtractionSchema.safeParse(p.extractedData).data ?? null,
    checklist: checklistOf(p),
  }));
  const insurers = [...new Map(policyViews.flatMap((p) => (p.provider ? [[p.provider.id, p.provider] as const] : []))).values()] as InsuranceProvider[];
  const damageIds = new Set(damage.flatMap((d) => d.photoIds));
  const cardPhotos = damage.length ? photos.filter((p) => damageIds.has(p._id.toString())) : photos;
  const recentPhotos = await Promise.all(cardPhotos.slice(0, 4).map(async (p) => ({ id: p._id.toString(), url: await getViewUrl(p.s3Key) })));
  const shareLinks = incident && photos.length > 0 ? await listShareLinks(user._id, selected._id, incident._id) : null;
  const deadlines =
    incident && (damage.length > 0 || incident.type || incident.occurredAt)
      ? {
          deadlines: claimDeadlines({ type: incident.type, providerId: provider?.id, providerName: provider?.name, filed: incident.status === "filed" }),
          from: (incident.occurredAt ?? incident.createdAt).toISOString(),
          estimated: !incident.occurredAt,
        }
      : null;

  return (
    <div className="space-y-6">
      {vehicles.length > 1 && <CarSwitcher vehicles={vehicles.map((v) => ({ id: v._id.toString(), title: vehicleTitle(v), plate: v.licensePlate }))} selectedId={vehicleId} />}
      <PageHeader
        eyebrow="Summary"
        title={vehicleTitle(selected)}
        description={[selected.nickname && vehicleModel(selected), selected.color, `${selected.licensePlate} (${selected.state})`].filter(Boolean).join(" · ")}
      />

      <StatusPanel incident={incident} items={todos.items} />

      <div className="@container">
        <div className="grid items-start gap-6 @xl:grid-cols-2">
          {incident && (
            <DamageCard
              vehicleId={vehicleId}
              damage={damage}
              photos={recentPhotos}
              photoCount={cardPhotos.length}
              analyzing={photos.filter((p) => p.analysisStatus === "pending" || p.analysisStatus === "analyzing").length}
              needsReview={assessments.some((a) => a.needsManualReview)}
            />
          )}
          <InsuranceCard policies={policyViews} combined={combinedCoverage(policies)} incident={incident} />
          {!incident && (
            <RetroCard title="If something happens">
              <p className="text-sm text-ink-soft">Crash mode walks you through Florida&apos;s at-the-scene steps, then helps you photograph the damage.</p>
              <div className="mt-4 grid gap-3">
                <RetroLinkButton href="/crash" variant="danger" className="w-full">
                  Crash mode
                </RetroLinkButton>
                {insurers.map((i) => (
                  <div key={i.id} className="grid gap-3">
                    <CallButton provider={i} />
                    {isOfficialUrl(i, i.claimsUrl) && (
                      <a href={i.claimsUrl} target="_blank" rel="noopener noreferrer" className={retroButtonClass("secondary", "w-full")}>
                        {i.name} claims page <span aria-hidden>↗</span>
                        <span className="sr-only">(opens {i.name} in a new tab)</span>
                      </a>
                    )}
                  </div>
                ))}
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
            photoCount={damagePhotoCount(damage)}
            incident={incident}
          />
          {deadlines && <Deadlines {...deadlines} now={new Date().toISOString()} detailsHref="#incident" />}
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

        {shareLinks && (
          <RetroCard id="share" title="Share evidence" className="scroll-mt-24">
            <p className="-mt-1 mb-4 text-sm text-ink-soft">
              Send your photos and incident details to an adjuster or the police. Anyone with the link can view them until it expires.
            </p>
            <ShareEvidence vehicleId={vehicleId} vehicleTitle={vehicleModel(selected)} links={shareLinks} />
          </RetroCard>
        )}
      </div>
    </div>
  );
}
