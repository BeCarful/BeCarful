"use client";

import { useState, useTransition } from "react";
import { recheckCoverage } from "@/actions/insurance";
import { RetroButton } from "@/components/retro";

export function RecheckCoverage({ vehicleId, policyId, label, subtle = false }: { vehicleId: string; policyId: string; label: string; subtle?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      setError(null);
      const res = await recheckCoverage(vehicleId, policyId).catch(() => null);
      if (!res?.ok) setError(res?.error ?? "Couldn't reach BeCarful. Check your connection and try again.");
    });
  return (
    <div className={subtle ? "" : "space-y-2"}>
      {subtle ? (
        <button type="button" onClick={run} disabled={pending} className="min-h-11 rounded-lg px-2 font-semibold text-accent hover:underline disabled:opacity-60">
          {pending ? "Checking…" : label}
        </button>
      ) : (
        <RetroButton onClick={run} disabled={pending} className="w-full">
          {pending ? "Checking your coverage…" : label}
        </RetroButton>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
