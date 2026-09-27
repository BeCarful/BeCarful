"use client";

import Image from "next/image";
import { useState } from "react";
import { RetroButton } from "@/components/retro";
import type { PhotoView } from "@/services/photos/view";
import { openCamera } from "./PhotoActions";
import { PhotoThumbnail } from "./PhotoThumbnail";
import { PhotoViewer } from "./PhotoViewer";

export function PhotoGallery({ vehicleId, photos }: { vehicleId: string; photos: PhotoView[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <details className="group surface-card">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="font-display text-lg font-semibold text-ink">Photos</h2>
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
          <svg viewBox="0 0 24 24" className="size-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="space-y-4 border-t border-border px-5 pt-4 pb-5">
        <RetroButton type="button" onClick={openCamera} className="w-full sm:w-auto">
          <span aria-hidden>+</span> Take photo
        </RetroButton>
        {photos.length === 0 ? (
          <div className="flex items-center gap-4">
            <Image src="/scenery/car.svg" alt="" width={96} height={44} className="pixelated w-24 shrink-0" />
            <p className="text-sm text-ink-soft">No photos yet. Take a photo of your car. If there&apos;s damage, we&apos;ll map it for you.</p>
          </div>
        ) : (
          <ul className="-mx-1 grid grid-cols-3 gap-2 px-1 sm:flex sm:snap-x sm:gap-3 sm:overflow-x-auto sm:pb-2">
            {photos.map((p, i) => (
              <li key={p.id} className="sm:snap-start">
                <PhotoThumbnail vehicleId={vehicleId} photo={p} className="aspect-square w-full sm:size-24" onOpen={() => setOpen(i)} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-soft">Camera only. Each photo is fingerprinted and sealed with its time and location when we receive it.</p>
      </div>
      {open !== null && <PhotoViewer vehicleId={vehicleId} photos={photos} startIndex={open} onClose={() => setOpen(null)} />}
    </details>
  );
}
