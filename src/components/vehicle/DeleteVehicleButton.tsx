"use client";

import { useState, useTransition } from "react";
import { deleteVehicle } from "@/actions/vehicles";
import { RetroButton } from "@/components/retro";

export function DeleteVehicleButton({ vehicleId, title }: { vehicleId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <RetroButton type="button" variant="ghost" className="shrink-0 text-danger" onClick={() => setConfirming(true)} aria-label={`Remove ${title}`}>
        Remove
      </RetroButton>
    );
  }

  return (
    <div className="basis-full space-y-2 rounded-lg bg-danger-soft p-3" role="alert">
      <p className="text-sm">
        Remove <strong>{title}</strong>? Its photos, policy, damage results and chat are deleted for good.
      </p>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex gap-2">
        <RetroButton type="button" variant="secondary" className="flex-1" disabled={pending} onClick={() => (setConfirming(false), setError(null))}>
          Cancel
        </RetroButton>
        <RetroButton
          type="button"
          variant="danger"
          className="flex-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteVehicle(vehicleId);
              if (!res.ok) setError(res.error);
            })
          }
        >
          {pending ? "Removing…" : "Remove"}
        </RetroButton>
      </div>
    </div>
  );
}
