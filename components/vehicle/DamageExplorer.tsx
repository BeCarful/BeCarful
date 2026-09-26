"use client";

import { useRef, useState, type ReactNode } from "react";
import { RetroBadge, RetroCard } from "@/components/retro";
import { RETAKE_HINT } from "@/components/photos/AnalysisSummary";
import { PhotoGallery } from "@/components/photos/PhotoGallery";
import { PhotoThumbnail } from "@/components/photos/PhotoThumbnail";
import { PhotoViewer } from "@/components/photos/PhotoViewer";
import { areaLabel } from "@/services/claims/damage";
import type { PhotoView } from "@/services/photos/view";
import { componentLabel, type AggregatedDamage, type ComponentId } from "@/types";
import { CarDamageView } from "./CarDamageView";
import { Garage } from "./Garage";
import { LOW_CONFIDENCE, SeverityBadge, confidenceLabel } from "./SeverityBadge";

const typesLabel = (d: AggregatedDamage) => d.damageTypes.map((t) => t.replace(/_/g, " ")).join(", ");

function Note({ tone = "warn", children }: { tone?: "warn" | "muted"; children: ReactNode }) {
  return <p className={`rounded-lg px-3 py-2 text-sm ${tone === "warn" ? "bg-warn-soft text-ink" : "bg-panel-shade text-ink-soft"}`}>{children}</p>;
}

/** Home: car + damage details, with vehicle info and actions slotted under the car. */
export function DamageExplorer({
  vehicleId,
  modelId,
  damage,
  photos,
  incidentPhotoCount,
  needsReview,
  failedCount,
  children,
}: {
  vehicleId: string;
  modelId?: string | null;
  damage: AggregatedDamage[];
  photos: PhotoView[];
  incidentPhotoCount: number;
  needsReview: boolean;
  failedCount: number;
  children: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ComponentId | null>(null);
  const [viewer, setViewer] = useState<{ photos: PhotoView[]; index: number } | null>(null);

  const detail = selected ? damage.find((d) => d.component === selected) : undefined;
  const related = detail ? photos.filter((p) => detail.photoIds.includes(p.id)) : [];

  function focus(id: ComponentId) {
    setSelected(id);
    stage.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const badge =
    damage.length > 0 ? (
      <RetroBadge tone="danger" className="pulse-ring">
        {damage.length} damaged part{damage.length === 1 ? "" : "s"}
      </RetroBadge>
    ) : needsReview ? (
      <RetroBadge tone="warn">Needs review</RetroBadge>
    ) : incidentPhotoCount > 0 ? (
      <RetroBadge tone="ok">No damage found</RetroBadge>
    ) : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div ref={stage} className="scroll-mt-24 space-y-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <Garage
          badge={badge}
          footer={
            <p className="text-sm text-ink-soft">
              {damage.length > 0 ? "Tap a red part, or a damage card, for details." : "Tap any part of the car to check it."}
            </p>
          }
        >
          <CarDamageView modelId={modelId} damage={damage} focused={selected} onSelect={setSelected} />
        </Garage>

        {selected && (
          <RetroCard
            aria-live="polite"
            className="fade-in"
            title={componentLabel(selected)}
            action={
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close details"
                className="-m-2 grid size-11 place-items-center rounded-lg text-ink-soft transition hover:bg-panel-shade hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            }
          >
            {detail ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={detail.severity} />
                  <span className="text-sm text-ink-soft">AI confidence {confidenceLabel(detail.confidence)}</span>
                </div>
                {detail.damageTypes.length > 0 && <p className="text-sm capitalize">{typesLabel(detail)}</p>}
                {detail.description && <p className="text-sm leading-relaxed">{detail.description}</p>}
                {detail.confidence < LOW_CONFIDENCE && <Note>Low confidence. Add a close-up of this part.</Note>}
                {related.length > 0 && (
                  <ul className="flex gap-2 overflow-x-auto pt-1 pb-1" aria-label="Photos of this part">
                    {related.map((p, i) => (
                      <li key={p.id}>
                        <PhotoThumbnail vehicleId={vehicleId} photo={p} className="size-16" onOpen={() => setViewer({ photos: related, index: i })} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm">
                No damage detected on the {componentLabel(selected).toLowerCase()}. Spot something? Take a close-up photo of it.
              </p>
            )}
          </RetroCard>
        )}
      </div>

      <div className="lg:col-start-2 lg:row-start-1">{children}</div>

      <div className="min-w-0 lg:col-start-1 lg:row-start-3">
        <PhotoGallery vehicleId={vehicleId} photos={photos} />
      </div>

      {incidentPhotoCount > 0 && (
        <RetroCard
          title="Damage"
          className="lg:col-start-2 lg:row-span-2 lg:row-start-2"
          action={damage.length > 0 && <span className="text-sm text-ink-soft">{damage.length} {damage.length === 1 ? "part" : "parts"}</span>}
        >
          <div className="space-y-3">
            {failedCount > 0 && (
              <Note>
                {failedCount === 1 ? "1 photo" : `${failedCount} photos`} couldn&apos;t be analyzed. Open it in Photos and tap Retry
                analysis.
              </Note>
            )}
            {needsReview && (
              <Note>
                Some photos were hard to read. {RETAKE_HINT}
                {damage[0] && ` Start with the ${areaLabel(damage[0].component)}.`}
              </Note>
            )}
            {damage.length === 0 && !needsReview && failedCount === 0 && (
              <Note tone="muted">No visible damage found in your photos. If you can see damage, take a close-up of it.</Note>
            )}
            {damage.length > 0 && (
              <ul className="space-y-2">
                {damage.map((d) => (
                  <li key={d.component}>
                    <button
                      type="button"
                      onClick={() => focus(d.component)}
                      aria-pressed={selected === d.component}
                      className={`w-full rounded-xl border border-border bg-panel p-4 text-left transition hover:border-accent/50 ${selected === d.component ? "ring-2 ring-accent" : ""}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{componentLabel(d.component)}</span>
                        <SeverityBadge severity={d.severity} />
                      </span>
                      <span className="mt-2 block text-sm text-ink-soft">
                        <span className="capitalize">{typesLabel(d) || "Damage"}</span> · AI confidence {confidenceLabel(d.confidence)}
                      </span>
                      {d.confidence < LOW_CONFIDENCE && <span className="mt-1 block text-sm text-warn">Low confidence. Add a close-up.</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </RetroCard>
      )}

      {viewer && <PhotoViewer vehicleId={vehicleId} photos={viewer.photos} startIndex={viewer.index} onClose={() => setViewer(null)} />}
    </div>
  );
}
