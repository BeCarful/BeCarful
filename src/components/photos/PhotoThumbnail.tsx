"use client";

import type { PhotoView } from "@/services/photos/view";
import { PhotoImage } from "./PhotoImage";
import { PixelIcon, type PixelIconName } from "./PixelIcon";

function Badge({ icon, className, label }: { icon: PixelIconName; className: string; label: string }) {
  return (
    <span title={label} className={`grid size-6 place-items-center rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.3)] ${className}`}>
      <PixelIcon name={icon} className="size-3.5" />
    </span>
  );
}

export function PhotoThumbnail({
  vehicleId,
  photo,
  onOpen,
  className = "size-24",
}: {
  vehicleId: string;
  photo: PhotoView;
  onOpen: () => void;
  className?: string;
}) {
  const damaged = (photo.analysis?.damagedComponents.length ?? 0) > 0;
  const failed = photo.analysisStatus === "failed";
  const kind = photo.source === "camera" ? "Camera photo" : "Uploaded photo";
  const label = [kind, damaged && "damage detected", failed && "not analyzed", photo.hasLocation && "location recorded"]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}. Open`}
      className={`relative block shrink-0 overflow-hidden rounded-lg border border-border bg-panel-shade transition hover:ring-2 hover:ring-accent/50 ${className}`}
    >
      <PhotoImage vehicleId={vehicleId} photoId={photo.id} src={photo.url} alt="" className="size-full object-cover" />
      <span className="absolute left-1 top-1" aria-hidden>
        {photo.source === "camera" ? (
          <Badge icon="camera" label="Camera" className="bg-accent text-accent-ink" />
        ) : (
          <Badge icon="upload" label="Uploaded" className="bg-panel text-ink" />
        )}
      </span>
      <span className="absolute bottom-1 right-1 flex gap-1" aria-hidden>
        {photo.hasLocation && <Badge icon="pin" label="Location recorded" className="bg-ok text-panel" />}
        {damaged && <Badge icon="alert" label="Damage detected" className="bg-danger text-panel" />}
        {failed && <Badge icon="alert" label="Not analyzed" className="bg-warn text-panel" />}
      </span>
      {(photo.analysisStatus === "pending" || photo.analysisStatus === "analyzing") && (
        <span className="absolute inset-0 animate-pulse bg-black/30" aria-hidden />
      )}
    </button>
  );
}
