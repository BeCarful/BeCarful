"use client";

import { useState } from "react";
import { chooseFloridaPlan } from "@/actions/insurance";
import { PixelProgress, RetroButton } from "@/components/retro";
import { FLORIDA_PLANS } from "@/services/insurance/florida-plans";

const STEPS = ["Saving your plan…", "Checking the law…", "Spotting wild Tuxemon…"];

/** For drivers without their policy document: pick the closest example Florida configuration. */
export function FloridaPlanPicker({ vehicleId, providerId, onSaved }: { vehicleId: string; providerId: string; onSaved?: (policyId: string) => void }) {
  const plans = FLORIDA_PLANS.filter((p) => p.providerId === providerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!plans.length) return <p className="text-sm text-ink-soft">No example Florida plans for this insurer yet. Upload your policy instead.</p>;

  async function choose(planId: string) {
    setError(null);
    setBusy(planId);
    const res = await chooseFloridaPlan(vehicleId, planId).catch(() => null);
    if (!res?.ok) {
      setError(res?.error ?? "Something went wrong. Check your connection and try again.");
      setBusy(null);
    } else onSaved?.(res.data.policyId);
  }

  if (busy) return <PixelProgress steps={STEPS} current={1} />;

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {plans.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-panel p-4">
            <p className="font-semibold">{p.name}</p>
            <p className="mt-1 text-sm text-ink-soft">{p.summary}</p>
            <RetroButton variant="secondary" className="mt-3 w-full" onClick={() => choose(p.id)}>
              This is my plan
            </RetroButton>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-soft">Examples built from Florida law and the insurer&apos;s own pages, not quotes. Your policy document is the final word.</p>
    </div>
  );
}
