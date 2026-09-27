import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PhotoActions } from "@/components/photos/PhotoActions";
import { RetroBadge, RetroLinkButton } from "@/components/retro";
import { DamageExplorer } from "@/components/vehicle/DamageExplorer";
import { loadClaimState } from "@/services/claims/state";
import { listPhotoViews } from "@/services/photos/view";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";
import type { IncidentStatus, TaskCode } from "@/types";

// Photo analysis runs inside a server action on this page; give Gemini room.
export const maxDuration = 60;

const STATUS: Partial<Record<IncidentStatus, { label: string; tone: "neutral" | "warn" | "ok" | "accent" }>> = {
  documenting: { label: "Documenting", tone: "neutral" },
  analyzing: { label: "Analyzing", tone: "neutral" },
  action_required: { label: "Action needed", tone: "warn" },
  ready_to_file: { label: "Ready to file", tone: "ok" },
  filed: { label: "Claim filed", tone: "accent" },
};

const NEXT_LABEL: Record<TaskCode, string> = {
  UPLOAD_INSURANCE: "Add policy",
  PROCESS_POLICY: "Open insurance",
  ADD_PHOTOS: "Add photos",
  ADD_DAMAGE_PHOTOS: "Add photos",
  COMPLETE_INCIDENT_INFO: "Add details",
  FILE_CLAIM: "Review claim",
};

export default async function HomePage() {
  const { user, selected: vehicle } = await getVehicleContext();
  if (!vehicle) redirect("/vehicles/new");

  const [claim, photos] = await Promise.all([loadClaimState(user._id, vehicle._id), listPhotoViews(user._id, vehicle._id)]);
  const vehicleId = vehicle.id;
  const status = claim.incident ? STATUS[claim.incident.status] : undefined;
  const next = claim.todos.items.find((t) => !t.done);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your garage"
        title={vehicleTitle(vehicle)}
        description={[vehicle.color, vehicle.licensePlate, vehicle.state].filter(Boolean).join(" · ")}
        action={status && <RetroBadge tone={status.tone}>{status.label}</RetroBadge>}
      />
      {next && (
        <section aria-label="Next step" className="task-card">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Your next step</p>
            <h2 className="mt-1 text-lg font-semibold">{next.title}</h2>
            {next.detail && <p className="mt-1 text-sm text-ink-soft">{next.detail}</p>}
          </div>
          <RetroLinkButton href={!next.href || next.href === "/" ? "#photo-actions" : next.href} className="w-full sm:w-auto">
            {NEXT_LABEL[next.code]} <span aria-hidden>→</span>
          </RetroLinkButton>
        </section>
      )}
      <DamageExplorer
        key={vehicleId}
        vehicleId={vehicleId}
        modelId={vehicle.modelId}
        damage={claim.damage}
        photos={photos}
        incidentPhotoCount={claim.state.photoCount}
        needsReview={claim.assessments.some((a) => a.needsManualReview)}
        failedCount={photos.filter((p) => p.analysisStatus === "failed").length}
      >
        <PhotoActions key={vehicleId} vehicleId={vehicleId} hasPolicy={Boolean(claim.policy)} />
      </DamageExplorer>
    </div>
  );
}
