"use client";

import Image from "next/image";
import { useState } from "react";
import { RetroCard } from "@/components/retro";
import type { PhotoView } from "@/services/photos/view";
import { PhotoThumbnail } from "./PhotoThumbnail";
import { PhotoViewer } from "./PhotoViewer";

export function PhotoGallery({ vehicleId, photos }: { vehicleId: string; photos: PhotoView[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <RetroCard title="Photos">
        <div className="flex items-center gap-4">
          <Image src="/scenery/car.svg" alt="" width={96} height={44} className="pixelated w-24 shrink-0" />
          <p className="text-sm text-ink-soft">No photos yet. Take or upload a photo of your car. If there&apos;s damage, we&apos;ll map it for you.</p>
        </div>
      </RetroCard>
    );
  }

  return (
    <RetroCard
      title="Photos"
      action={
        <span className="text-sm text-ink-soft">
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
        </span>
      }
    >
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-1 pb-2">
        {photos.map((p, i) => (
          <li key={p.id} className="snap-start">
            <PhotoThumbnail vehicleId={vehicleId} photo={p} onOpen={() => setOpen(i)} />
          </li>
        ))}
      </ul>
      {open !== null && <PhotoViewer vehicleId={vehicleId} photos={photos} startIndex={open} onClose={() => setOpen(null)} />}
    </RetroCard>
  );
}
