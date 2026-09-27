"use client";

import { useState, useTransition } from "react";
import { updatePolicyProvider } from "@/actions/insurance";
import { RetroButton } from "@/components/retro";
import { ProviderPicker } from "./ProviderPicker";

export function ChangeProvider({ vehicleId, policyId, providerId }: { vehicleId: string; policyId: string; providerId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(id: string) {
    if (id === providerId) return setOpen(false);
    startTransition(async () => {
      try {
        const res = await updatePolicyProvider(vehicleId, policyId, id);
        if (res.ok) setOpen(false);
        else setError(res.error);
      } catch {
        setError("Something went wrong. Check your connection and try again.");
      }
    });
  }

  if (!open) {
    return (
      <RetroButton
        variant="ghost"
        className="w-full"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Change insurer
      </RetroButton>
    );
  }
  return (
    <div className="space-y-3">
      <ProviderPicker value={providerId} onChange={pick} disabled={pending} />
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <RetroButton variant="secondary" className="w-full" disabled={pending} onClick={() => setOpen(false)}>
        Cancel
      </RetroButton>
    </div>
  );
}
