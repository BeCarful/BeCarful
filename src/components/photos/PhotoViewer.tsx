"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { deletePhoto, retryPhotoAnalysis } from "@/actions/photos";
import { RetroBadge, RetroButton } from "@/components/retro";
import type { PhotoView } from "@/services/photos/view";
import { componentLabel, type DamagedComponent, type VehicleView } from "@/types";
import { AnalysisSummary } from "./AnalysisSummary";
import { CloseButton, FullScreenDialog, SHEET_CLASS } from "./FullScreenDialog";
import { PhotoImage } from "./PhotoImage";

const NAV_BUTTON = "hidden size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-40 md:grid";

function Chevron({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const viewLabel = (v: VehicleView) => `${v.charAt(0).toUpperCase()}${v.slice(1).replace("_", "-")} view`;

function DamageBoxes({ items, size: [w, h] }: { items: DamagedComponent[]; size: [number, number] }) {
  const boxed = items.flatMap(({ component, box }) => (box ? [{ component, box }] : []));
  if (!boxed.length) return null;
  const font = Math.max(w, h) * 0.022;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      {boxed.map(({ component, box }) => (
        <g key={component}>
          <rect
            x={box.xMin * w}
            y={box.yMin * h}
            width={(box.xMax - box.xMin) * w}
            height={(box.yMax - box.yMin) * h}
            className="fill-none stroke-danger"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={box.xMin * w + font * 0.4}
            y={box.yMin * h + font * 1.2}
            fontSize={font}
            strokeWidth={font * 0.18}
            paintOrder="stroke"
            className="fill-white stroke-black font-medium"
          >
            {componentLabel(component)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function PhotoViewer({
  vehicleId,
  photos,
  startIndex = 0,
  onClose,
}: {
  vehicleId: string;
  photos: PhotoView[];
  startIndex?: number;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sizes, setSizes] = useState<Record<string, [number, number]>>({});

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = startIndex * el.clientWidth;
  }, [startIndex]);

  function onScroll() {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) {
      setIndex(i);
      setZoom(null);
      setError(null);
      setConfirmingDelete(false);
    }
  }

  function go(delta: number) {
    const el = scroller.current;
    const i = Math.max(0, Math.min(photos.length - 1, index + delta));
    el?.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  function toggleZoom(e: React.MouseEvent<HTMLButtonElement>) {
    if (zoom) return setZoom(null);
    const r = e.currentTarget.getBoundingClientRect();
    const fromPointer = e.detail > 0;
    setZoom({
      x: fromPointer ? ((e.clientX - r.left) / r.width) * 100 : 50,
      y: fromPointer ? ((e.clientY - r.top) / r.height) * 100 : 50,
    });
  }

  async function retry(photoId: string) {
    setRetrying(photoId);
    setError(null);
    const res = await retryPhotoAnalysis(vehicleId, photoId).catch(() => null);
    setRetrying(null);
    if (!res) setError("Network problem. Check your connection and try again.");
    else if (!res.ok) setError(res.error);
    else if (!res.data.analysis) setError("Still couldn't analyze it. Try again later, or take a clearer photo.");
  }

  async function remove(photoId: string) {
    setDeleting(true);
    setError(null);
    const res = await deletePhoto(vehicleId, photoId).catch(() => null);
    setDeleting(false);
    if (!res) return setError("Network problem. Check your connection and try again.");
    if (!res.ok) return setError(res.error);
    // The server revalidates the page, so the gallery and 3D damage refresh without this photo.
    onClose();
  }

  const photo = photos[Math.min(index, photos.length - 1)];
  const camera = photo.source === "camera";

  return (
    <FullScreenDialog
      label="Photo viewer"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium tabular-nums" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <div className="flex gap-2">
          {photos.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous photo" className={NAV_BUTTON}>
                <Chevron d="m15 6-6 6 6 6" />
              </button>
              <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} aria-label="Next photo" className={NAV_BUTTON}>
                <Chevron d="m9 6 6 6-6 6" />
              </button>
            </>
          )}
          <CloseButton onClick={onClose} />
        </div>
      </div>

      <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {photos.map((p, i) => {
          const zoomed = zoom !== null && i === index;
          return (
            <div key={p.id} className="flex h-full w-full shrink-0 snap-center snap-always overflow-hidden">
              <button
                type="button"
                onClick={toggleZoom}
                aria-label={zoomed ? "Zoom out" : "Zoom in"}
                className={`size-full ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
              >
                <div
                  className="relative size-full transition-transform duration-200"
                  style={zoomed ? { transform: "scale(2.5)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
                >
                  <PhotoImage
                    vehicleId={vehicleId}
                    photoId={p.id}
                    src={p.url}
                    alt={`${p.source === "camera" ? "Camera" : "Uploaded"} photo ${i + 1} of ${photos.length}`}
                    className="size-full object-contain"
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      setSizes((s) => ({ ...s, [p.id]: [naturalWidth, naturalHeight] }));
                    }}
                  />
                  {p.analysis && sizes[p.id] && <DamageBoxes items={p.analysis.damagedComponents} size={sizes[p.id]} />}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <div className={`${SHEET_CLASS} mt-3 max-h-[40dvh] space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <RetroBadge tone={camera ? "accent" : "neutral"}>{camera ? "Camera" : "Uploaded"}</RetroBadge>
          <RetroBadge tone={photo.hasLocation ? "ok" : "neutral"}>
            {photo.hasLocation ? "Location recorded" : "Location unavailable"}
          </RetroBadge>
          {photo.analysis && photo.analysis.view !== "unknown" && <RetroBadge tone="neutral">{viewLabel(photo.analysis.view)}</RetroBadge>}
        </div>
        <p className="text-sm text-ink-soft">
          {camera ? `Captured ${formatDate(photo.date)} · device time` : `Uploaded ${formatDate(photo.date)}`}
        </p>
        {photo.seal && (
          <p className="text-xs text-ink-soft">
            Sealed by BeCarful {formatDate(photo.receivedAt)} with its time and location: <span className="break-all font-mono">{photo.seal}</span>
          </p>
        )}
        <AnalysisSummary
          analysis={photo.analysis}
          failed={photo.analysisStatus === "failed"}
          retrying={retrying === photo.id}
          onRetry={() => retry(photo.id)}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {confirmingDelete ? (
          <div className="space-y-2 rounded-lg bg-danger-soft p-3 text-ink" role="alert">
            <p className="text-sm">Delete this photo? Its damage result is removed too, and this can&apos;t be undone.</p>
            <div className="flex gap-2">
              <RetroButton type="button" variant="secondary" className="flex-1" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
                Cancel
              </RetroButton>
              <RetroButton type="button" variant="danger" className="flex-1" disabled={deleting} onClick={() => remove(photo.id)}>
                {deleting ? "Deleting…" : "Delete"}
              </RetroButton>
            </div>
          </div>
        ) : (
          <RetroButton type="button" variant="ghost" className="text-danger" onClick={() => setConfirmingDelete(true)}>
            Delete photo
          </RetroButton>
        )}
      </div>
    </FullScreenDialog>
  );
}
