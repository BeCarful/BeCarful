"use client";

import { useRef, useState, type ReactNode } from "react";
import { RetroBadge, RetroButton, RetroCard } from "@/components/retro";
import { openCamera } from "@/components/photos/PhotoActions";
import { RETAKE_HINT } from "@/components/photos/AnalysisSummary";
import { PhotoGallery } from "@/components/photos/PhotoGallery";
import { PhotoThumbnail } from "@/components/photos/PhotoThumbnail";
import { PhotoViewer } from "@/components/photos/PhotoViewer";
import { LocalTime } from "@/components/summary/LocalTime";
import { SIDES, areaLabel, sidesOf, type Side } from "@/services/claims/damage";
import type { PhotoView } from "@/services/photos/view";
import { componentLabel, type AggregatedDamage, type ComponentId } from "@/types";
import { CarDamageView } from "./CarDamageView";
import { Garage } from "./Garage";
import { LOW_CONFIDENCE, SeverityBadge, confidenceLabel } from "./SeverityBadge";

const typesLabel = (d: AggregatedDamage) => d.damageTypes.map((t) => t.replace(/_/g, " ")).join(", ");

const SIDE_LABEL: Record<Side, string> = { front: "Front", rear: "Rear", left: "Left side", right: "Right side" };

const isFine = (p: PhotoView) => p.analysis !== null && p.analysis.damagedComponents.length === 0 && !p.analysis.needsManualReview;

function photoSides(p: PhotoView): Side[] {
  if (!p.analysis) return [];
  const { view, damagedComponents } = p.analysis;
  return sidesOf(view !== "unknown" ? view : damagedComponents.map((c) => c.component).join(" "));
}

function Note({ tone = "warn", children }: { tone?: "warn" | "muted"; children: ReactNode }) {
  return <p className={`rounded-lg px-3 py-2 text-sm ${tone === "warn" ? "bg-warn-soft text-ink" : "bg-panel-shade text-ink-soft"}`}>{children}</p>;
}

function Item({
  id,
  selected = false,
  onOpen,
  summary,
  children,
}: {
  id: string;
  selected?: boolean;
  onOpen?: () => void;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <li>
      <details
        data-component={id}
        onToggle={(e) => e.currentTarget.open && onOpen?.()}
        className={`group/item rounded-xl border border-border bg-panel transition hover:border-accent/50 ${selected ? "ring-2 ring-accent" : ""}`}
      >
        <summary className="flex cursor-pointer list-none items-start gap-2 p-4 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">{summary}</span>
          <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-ink-soft transition-transform group-open/item:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="space-y-3 px-4 pb-4">{children}</div>
      </details>
    </li>
  );
}

function Shots({
  vehicleId,
  photos,
  damaged,
  onOpen,
}: {
  vehicleId: string;
  photos: PhotoView[];
  damaged: (p: PhotoView) => boolean;
  onOpen: (index: number) => void;
}) {
  return (
    <ul className="-m-1 flex gap-3 overflow-x-auto p-1" aria-label="Photos">
      {photos.map((p, i) => (
        <li key={p.id} className="w-24 shrink-0">
          <PhotoThumbnail
            vehicleId={vehicleId}
            photo={p}
            className={`size-24 ring-2 ${damaged(p) ? "ring-danger" : "ring-ok"}`}
            onOpen={() => onOpen(i)}
          />
          <p className="mt-1.5 text-xs leading-tight text-ink-soft">
            <LocalTime iso={p.date} withTime />
          </p>
        </li>
      ))}
    </ul>
  );
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
  const list = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ComponentId | null>(null);
  const [viewer, setViewer] = useState<{ photos: PhotoView[]; index: number } | null>(null);

  const detail = selected ? damage.find((d) => d.component === selected) : undefined;
  const related = detail ? photos.filter((p) => detail.photoIds.includes(p.id)) : [];

  const damagedIds = new Set(damage.flatMap((d) => d.photoIds));
  const isDamaged = (p: PhotoView) => damagedIds.has(p.id);
  const latestFine = new Map(SIDES.map((s) => [s, photos.find((p) => isFine(p) && photoSides(p).includes(s))]));
  const openViewer = (list: PhotoView[]) => (index: number) => setViewer({ photos: list, index });

  function focus(id: ComponentId) {
    setSelected(id);
    stage.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Tapping a part on the car brings its card into view in the (lg+) scrolling list without moving the page.
  function selectOnCar(id: ComponentId) {
    setSelected(id);
    const box = list.current;
    const card = box?.querySelector(`[data-component="${id}"]`);
    if (!box || !card) return;
    const outer = box.getBoundingClientRect();
    const inner = card.getBoundingClientRect();
    if (inner.top < outer.top || inner.bottom > outer.bottom) box.scrollBy({ top: inner.top - outer.top - 8, behavior: "smooth" });
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
    <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr] lg:grid-rows-[auto_1fr_auto]">
      <div ref={stage} className="scroll-mt-24 space-y-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <Garage
          badge={badge}
          footer={
            <p className="text-sm text-ink-soft">
              {damage.length > 0 ? "Tap a red part, or a damage card, for details." : "Tap any part of the car to check it."}
            </p>
          }
        >
          <CarDamageView modelId={modelId} damage={damage} focused={selected} onSelect={selectOnCar} />
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
            <RetroButton type="button" variant="secondary" onClick={openCamera} className="mt-4 w-full sm:w-auto">
              <span aria-hidden>+</span> Take a close-up
            </RetroButton>
          </RetroCard>
        )}
      </div>

      <div className="lg:col-start-2 lg:row-start-1">{children}</div>

      <div className="min-w-0 lg:col-span-2 lg:row-start-3">
        <PhotoGallery vehicleId={vehicleId} photos={photos} />
      </div>

      {/* lg+: the card fills the space beside the car and its list scrolls, instead of stretching the page. */}
      <div className="lg:relative lg:col-start-2 lg:row-start-2 lg:min-h-96 lg:self-stretch">
        <RetroCard
          title="Condition"
          className="lg:absolute lg:inset-0 lg:flex lg:flex-col"
          action={damage.length > 0 && <span className="text-sm text-ink-soft">{damage.length} damaged {damage.length === 1 ? "part" : "parts"}</span>}
        >
          <div ref={list} className="space-y-3 lg:-m-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:p-1">
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
            {incidentPhotoCount > 0 && damage.length === 0 && !needsReview && failedCount === 0 && (
              <Note tone="muted">No visible damage found in your photos. If you can see damage, take a close-up of it.</Note>
            )}
            <ul className="space-y-2">
              {damage.map((d) => {
                const shots = photos.filter((p) => d.photoIds.includes(p.id) || sidesOf(d.component).some((s) => latestFine.get(s) === p));
                return (
                  <Item
                    key={d.component}
                    id={d.component}
                    selected={selected === d.component}
                    onOpen={() => setSelected(d.component)}
                    summary={
                      <>
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{componentLabel(d.component)}</span>
                          <SeverityBadge severity={d.severity} />
                        </span>
                        <span className="mt-2 block text-sm text-ink-soft">
                          <span className="capitalize">{typesLabel(d) || "Damage"}</span> · AI confidence {confidenceLabel(d.confidence)}
                        </span>
                        {d.confidence < LOW_CONFIDENCE && <span className="mt-1 block text-sm text-warn">Low confidence. Add a close-up.</span>}
                      </>
                    }
                  >
                    <Shots vehicleId={vehicleId} photos={shots} damaged={isDamaged} onOpen={openViewer(shots)} />
                    <RetroButton type="button" variant="secondary" onClick={() => focus(d.component)} className="w-full sm:w-auto">
                      Show on car
                    </RetroButton>
                  </Item>
                );
              })}
              {SIDES.map((s) => {
                const shots = photos.filter((p) => photoSides(p).includes(s) && (isDamaged(p) || latestFine.get(s) === p));
                const fine = latestFine.get(s);
                return (
                  <Item
                    key={s}
                    id={s}
                    summary={
                      <>
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{SIDE_LABEL[s]}</span>
                          {shots.some(isDamaged) ? (
                            <RetroBadge tone="danger">Damage</RetroBadge>
                          ) : fine ? (
                            <RetroBadge tone="ok">Documented</RetroBadge>
                          ) : (
                            <RetroBadge tone="neutral">No photo</RetroBadge>
                          )}
                        </span>
                        <span className="mt-2 block text-sm text-ink-soft">
                          {fine ? (
                            <>
                              Last clear photo <LocalTime iso={fine.date} />
                            </>
                          ) : (
                            "No clear photo of this side yet"
                          )}
                        </span>
                      </>
                    }
                  >
                    {shots.length > 0 && <Shots vehicleId={vehicleId} photos={shots} damaged={isDamaged} onOpen={openViewer(shots)} />}
                    <RetroButton type="button" variant="secondary" onClick={openCamera} className="w-full sm:w-auto">
                      <span aria-hidden>+</span> Take a photo of the {s === "front" || s === "rear" ? s : `${s} side`}
                    </RetroButton>
                  </Item>
                );
              })}
            </ul>
            <p className="text-xs text-ink-soft">Take the front, rear and both sides now, so there&apos;s a sealed, dated record of your car before anything happens.</p>
          </div>
        </RetroCard>
      </div>

      {viewer && <PhotoViewer vehicleId={vehicleId} photos={viewer.photos} startIndex={viewer.index} onClose={() => setViewer(null)} />}
    </div>
  );
}
