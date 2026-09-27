"use client";

import { useOptimistic, useTransition } from "react";
import { selectVehicle } from "@/actions/vehicles";
import type { VehicleOption } from "@/components/layout/VehicleSelector";
import { openCamera, PhotoCapture } from "@/components/photos/PhotoActions";
import { PixelIcon } from "@/components/photos/PixelIcon";
import { RetroButton } from "@/components/retro";

export function CrashPhotos({ vehicles, selectedId }: { vehicles: VehicleOption[]; selectedId: string }) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(selectedId);

  return (
    <>
      <label htmlFor="crash-vehicle" className="field-label">
        Car you were driving
      </label>
      <div className="flex gap-3">
        <select
          id="crash-vehicle"
          className="field-select min-w-0 flex-1"
          value={shown}
          disabled={pending}
          onChange={(e) => {
            const id = e.target.value;
            startTransition(async () => {
              setShown(id);
              await selectVehicle(id);
            });
          }}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
        <RetroButton type="button" onClick={openCamera} disabled={pending} icon={<PixelIcon name="camera" className="size-5" />}>
          Add photos
        </RetroButton>
      </div>
      <PhotoCapture key={selectedId} vehicleId={selectedId} exitHref="/garage" />
    </>
  );
}
